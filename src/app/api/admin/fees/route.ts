/**
 * GET/PUT /api/admin/fees — read + edit the marketplace fee configuration.
 *
 * The live defaults live as constants in `@/lib/fees`. There is no dedicated
 * fees table in the Prisma schema, so operator overrides are persisted
 * best-effort to a JSON file under a local data dir. When that write is
 * unavailable (read-only FS, serverless, etc.) the route still returns the
 * merged config with `persisted:false` so the UI degrades gracefully.
 *
 * Every path fails soft — this route NEVER throws to the client. Guarded by
 * the shared admin guard; non-admins get a 401.
 */

import type { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isAdmin } from "@/lib/adminAuth";
import {
  RATE_LE100,
  RATE_GT100,
  RATE_GT200,
  CATALOG_DELIVERY_CENTS,
  DEFAULT_BASE_RATE_CENTS,
  DEPOSIT_CENTS,
  PREMIUM_THRESHOLD_CENTS,
  TXN_FEE_DEFAULT,
  TXN_FEE_OVERRIDES,
  PICKUP_FEES_CENTS,
  PICKUP_FEE_DEFAULT_CENTS,
} from "@/lib/fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------------------------- types ---------------------------------- */

export interface DeliveryTiers {
  /** $/mi for miles 0–100 (non-variant model). */
  rateLe100: number;
  /** $/mi for miles 100–200. */
  rateGt100: number;
  /** $/mi for miles beyond 200. */
  rateGt200: number;
  /** Flat catalog-product delivery, cents. */
  catalogDeliveryCents: number;
  /** Default category base rate, cents. */
  defaultBaseRateCents: number;
}

export interface FeeConfig {
  /** Flat transaction fee as a fraction (0.2 = 20%). */
  txnFeeDefault: number;
  /** Per-category transaction-fee overrides (fraction). */
  txnFeeOverrides: Record<string, number>;
  /** Per-category pickup fees in cents. */
  pickupFeesCents: Record<string, number>;
  /** Fallback pickup fee, cents. */
  pickupFeeDefaultCents: number;
  /** Delivery per-mile tiers + flat rates. */
  deliveryTiers: DeliveryTiers;
  /** Fixed reservation deposit, cents. */
  depositCents: number;
  /** Order subtotal at/above which collection is manual wire, cents. */
  premiumThresholdCents: number;
}

interface FeesResponse {
  ok: boolean;
  config: FeeConfig;
  /** The compiled-in defaults, so the UI can show "live" vs "override". */
  defaults: FeeConfig;
  /** True when stored overrides are layered on top of the defaults. */
  hasOverrides: boolean;
  /** True when the last write actually reached durable storage. */
  persisted: boolean;
  warning?: string;
  error?: string;
}

/* ------------------------------- defaults ---------------------------------- */

function defaultConfig(): FeeConfig {
  return {
    txnFeeDefault: TXN_FEE_DEFAULT,
    txnFeeOverrides: { ...TXN_FEE_OVERRIDES },
    pickupFeesCents: { ...PICKUP_FEES_CENTS },
    pickupFeeDefaultCents: PICKUP_FEE_DEFAULT_CENTS,
    deliveryTiers: {
      rateLe100: RATE_LE100,
      rateGt100: RATE_GT100,
      rateGt200: RATE_GT200,
      catalogDeliveryCents: CATALOG_DELIVERY_CENTS,
      defaultBaseRateCents: DEFAULT_BASE_RATE_CENTS,
    },
    depositCents: DEPOSIT_CENTS,
    premiumThresholdCents: PREMIUM_THRESHOLD_CENTS,
  };
}

/* ------------------------------ persistence -------------------------------- */

const OVERRIDES_PATH = path.join(process.cwd(), ".data", "admin-fee-overrides.json");

/** Read stored overrides. Returns null when none exist or on any failure. */
async function readOverrides(): Promise<Partial<FeeConfig> | null> {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Partial<FeeConfig>;
  } catch {
    return null;
  }
}

/** Persist overrides best-effort. Returns true only when the write succeeded. */
async function writeOverrides(config: FeeConfig): Promise<boolean> {
  try {
    await fs.mkdir(path.dirname(OVERRIDES_PATH), { recursive: true });
    await fs.writeFile(OVERRIDES_PATH, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------- validation -------------------------------- */

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** A non-negative integer cent value, clamped; null when unusable. */
function centsOrNull(v: unknown): number | null {
  if (isFiniteNumber(v)) return Math.max(0, Math.round(v));
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return null;
}

/** A fee fraction in [0, 1]; null when unusable. */
function fractionOrNull(v: unknown): number | null {
  if (isFiniteNumber(v)) return Math.min(1, Math.max(0, v));
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  }
  return null;
}

/** A non-negative rate ($/mi); null when unusable. */
function rateOrNull(v: unknown): number | null {
  if (isFiniteNumber(v)) return Math.max(0, v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return null;
}

function cleanFractionMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    const frac = fractionOrNull(val);
    if (frac != null) out[key] = frac;
  }
  return out;
}

function cleanCentsMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    const cents = centsOrNull(val);
    if (cents != null) out[key] = cents;
  }
  return out;
}

/**
 * Merge an untrusted incoming payload onto the compiled-in defaults, coercing
 * every field. Unknown/garbage fields fall back to the default value, so the
 * result is always a fully-formed, safe FeeConfig.
 */
function sanitize(input: unknown): FeeConfig {
  const d = defaultConfig();
  if (!input || typeof input !== "object" || Array.isArray(input)) return d;
  const src = input as Record<string, unknown>;
  const tiersSrc =
    src.deliveryTiers && typeof src.deliveryTiers === "object" && !Array.isArray(src.deliveryTiers)
      ? (src.deliveryTiers as Record<string, unknown>)
      : {};

  return {
    txnFeeDefault: fractionOrNull(src.txnFeeDefault) ?? d.txnFeeDefault,
    txnFeeOverrides:
      "txnFeeOverrides" in src ? cleanFractionMap(src.txnFeeOverrides) : d.txnFeeOverrides,
    pickupFeesCents:
      "pickupFeesCents" in src ? cleanCentsMap(src.pickupFeesCents) : d.pickupFeesCents,
    pickupFeeDefaultCents: centsOrNull(src.pickupFeeDefaultCents) ?? d.pickupFeeDefaultCents,
    deliveryTiers: {
      rateLe100: rateOrNull(tiersSrc.rateLe100) ?? d.deliveryTiers.rateLe100,
      rateGt100: rateOrNull(tiersSrc.rateGt100) ?? d.deliveryTiers.rateGt100,
      rateGt200: rateOrNull(tiersSrc.rateGt200) ?? d.deliveryTiers.rateGt200,
      catalogDeliveryCents:
        centsOrNull(tiersSrc.catalogDeliveryCents) ?? d.deliveryTiers.catalogDeliveryCents,
      defaultBaseRateCents:
        centsOrNull(tiersSrc.defaultBaseRateCents) ?? d.deliveryTiers.defaultBaseRateCents,
    },
    depositCents: centsOrNull(src.depositCents) ?? d.depositCents,
    premiumThresholdCents: centsOrNull(src.premiumThresholdCents) ?? d.premiumThresholdCents,
  };
}

/** Merge stored overrides (if any) onto defaults into a full FeeConfig. */
function mergedConfig(overrides: Partial<FeeConfig> | null): FeeConfig {
  if (!overrides) return defaultConfig();
  return sanitize(overrides);
}

/* -------------------------------- handlers --------------------------------- */

export async function GET(req: NextRequest): Promise<Response> {
  try {
    if (!(await isAdmin(req))) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const defaults = defaultConfig();
  try {
    const overrides = await readOverrides();
    const body: FeesResponse = {
      ok: true,
      config: mergedConfig(overrides),
      defaults,
      hasOverrides: overrides != null,
      persisted: overrides != null,
    };
    return Response.json(body, { status: 200 });
  } catch (err) {
    const body: FeesResponse = {
      ok: true,
      config: defaults,
      defaults,
      hasOverrides: false,
      persisted: false,
      warning: `Could not read overrides: ${err instanceof Error ? err.message : String(err)}`,
    };
    return Response.json(body, { status: 200 });
  }
}

export async function PUT(req: NextRequest): Promise<Response> {
  try {
    if (!(await isAdmin(req))) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const defaults = defaultConfig();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return Response.json({ ok: false, error: "Body must be a config object." }, { status: 400 });
  }

  // Accept either a bare config or { config: {...} }.
  const candidate =
    "config" in (raw as Record<string, unknown>)
      ? (raw as Record<string, unknown>).config
      : raw;

  const config = sanitize(candidate);
  const persisted = await writeOverrides(config);

  const body: FeesResponse = {
    ok: true,
    config,
    defaults,
    hasOverrides: true,
    persisted,
    warning: persisted
      ? undefined
      : "Overrides applied for this response but not durably saved (read-only storage) — they will not survive a restart.",
  };
  return Response.json(body, { status: 200 });
}

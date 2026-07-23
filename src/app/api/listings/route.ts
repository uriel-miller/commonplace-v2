/**
 * POST /api/listings — create-listing submission endpoint.
 *
 * Flow (every step fails soft — this route NEVER throws to the client):
 *   1. Parse + validate the seller's payload (money in integer cents).
 *   2. If the title is weak/short, call the internal AI rewriter
 *      (POST /api/ai/title) to synthesize title + description from the
 *      category and the seller's dynamic answers.
 *   3. Persist a ListingDraft via Prisma (null-checked; degrades to an
 *      in-memory synthesized preview when no DB is configured or the write fails).
 *   4. Return { id, title, description, payout } where
 *      payout = computeSellerPayout({ priceCents, categorySlug }).
 *
 * Always responds 200 for well-formed input, 400 only for unparseable/invalid input.
 */

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { computeSellerPayout, type PayoutBreakdown } from "@/lib/fees";

export const dynamic = "force-dynamic";

/* --------------------------------- types ---------------------------------- */

type AnswerValue = string | number | Array<string | number>;

interface CreateListingBody {
  categorySlug?: unknown;
  categoryName?: unknown;
  title?: unknown;
  priceCents?: unknown;
  floorCents?: unknown;
  originalCents?: unknown;
  condition?: unknown;
  answers?: unknown;
  photos?: unknown;
  pickupAddress?: unknown;
  sellerContext?: unknown;
}

interface CleanPayload {
  categorySlug: string;
  categoryName: string;
  title: string;
  priceCents: number;
  floorCents: number | null;
  originalCents: number | null;
  condition: string | null;
  answers: Record<string, AnswerValue>;
  photos: string[];
  pickupAddress: string | null;
  sellerContext: string;
}

interface CreateListingResponse {
  ok: boolean;
  id: string;
  title: string;
  description: string;
  payout: PayoutBreakdown;
  persisted: boolean;
  warning?: string;
  error?: string;
}

/* ------------------------------ input parsing ------------------------------ */

function asString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** Parse a money value to a non-negative integer cent count, or null if unusable. */
function asCentsOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n)) return Math.max(0, Math.round(n));
  }
  return null;
}

function asAnswers(v: unknown): Record<string, AnswerValue> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, AnswerValue> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" || typeof val === "number") {
      out[k] = val;
    } else if (Array.isArray(val)) {
      out[k] = val.filter(
        (x): x is string | number => typeof x === "string" || typeof x === "number",
      );
    }
  }
  return out;
}

function asPhotos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

/** True when the seller's title is too weak to publish and should be AI-rewritten. */
function isWeakTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 12) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length < 3;
}

/* --------------------------- AI title generation --------------------------- */

/** Build the internal absolute URL for a same-origin API call. */
function originFor(req: NextRequest): string {
  try {
    return new URL(req.url).origin;
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  }
}

interface AiTitleResult {
  title: string;
  description: string;
}

/**
 * Call the internal AI title route. Returns null on any failure so the caller
 * can fall back to a synthesized title. Bounded by an AbortController timeout.
 */
async function generateAiTitle(
  req: NextRequest,
  p: CleanPayload,
): Promise<AiTitleResult | null> {
  const fields: Record<string, AnswerValue> = { ...p.answers };
  if (p.condition) fields["Condition"] = p.condition;

  const payload = {
    category: p.categoryName || p.categorySlug,
    listingTitle: p.title,
    sellerContext: p.sellerContext,
    fields,
    location: p.pickupAddress ?? undefined,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 47000);
  try {
    const res = await fetch(`${originFor(req)}/api/ai/title`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; description?: string; error?: string };
    if (data.error) return null;
    const title = asString(data.title).trim();
    const description = asString(data.description).trim();
    if (!title) return null;
    return { title, description };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Deterministic fallback title/description when the AI path is unavailable. */
function synthesize(p: CleanPayload): AiTitleResult {
  const base = p.title.trim() || `${p.categoryName || "Item"} for sale`;
  const condPart = p.condition ? `${p.condition} condition ${p.categoryName || "item"}` : "";
  const answerLines = Object.entries(p.answers)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .filter((l) => !/:\s*$/.test(l));
  const description = [condPart, answerLines.join(". ")].filter(Boolean).join(". ").trim();
  return { title: base, description };
}

/* ------------------------------- persistence ------------------------------- */

function newLocalId(): string {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Persist a ListingDraft. Returns the row id and persisted flag. Null-checks
 * Prisma and swallows any DB error, returning a synthesized id so the flow
 * completes even with no database.
 */
async function persistDraft(
  p: CleanPayload,
  title: string,
  description: string,
): Promise<{ id: string; persisted: boolean; warning?: string }> {
  if (!prisma) {
    return { id: newLocalId(), persisted: false, warning: "No database configured — preview only." };
  }
  try {
    const row = await prisma.listingDraft.create({
      data: {
        categorySlug: p.categorySlug || null,
        categoryName: p.categoryName || null,
        title,
        priceCents: p.priceCents,
        floorCents: p.floorCents,
        originalCents: p.originalCents,
        condition: p.condition,
        answers: { ...p.answers, _description: description },
        photos: p.photos,
        pickupAddress: p.pickupAddress,
        status: "draft",
      },
      select: { id: true },
    });
    return { id: row.id, persisted: true };
  } catch (err) {
    return {
      id: newLocalId(),
      persisted: false,
      warning: `Draft not saved to DB: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/* -------------------------------- handler ---------------------------------- */

export async function POST(req: NextRequest): Promise<Response> {
  let raw: CreateListingBody;
  try {
    raw = (await req.json()) as CreateListingBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const priceCents = asCentsOrNull(raw.priceCents);
  if (priceCents == null || priceCents <= 0) {
    return Response.json({ error: "A positive priceCents is required." }, { status: 400 });
  }

  const p: CleanPayload = {
    categorySlug: asString(raw.categorySlug).trim(),
    categoryName: asString(raw.categoryName).trim(),
    title: asString(raw.title),
    priceCents,
    floorCents: asCentsOrNull(raw.floorCents),
    originalCents: asCentsOrNull(raw.originalCents),
    condition: asString(raw.condition).trim() || null,
    answers: asAnswers(raw.answers),
    photos: asPhotos(raw.photos),
    pickupAddress: asString(raw.pickupAddress).trim() || null,
    sellerContext: asString(raw.sellerContext).trim(),
  };

  const payout = computeSellerPayout({ priceCents: p.priceCents, categorySlug: p.categorySlug });

  // Resolve title + description: AI-rewrite weak titles, else keep the seller's.
  let title = p.title.trim();
  let description = "";
  let warning: string | undefined;

  try {
    if (isWeakTitle(p.title)) {
      const ai = await generateAiTitle(req, p);
      if (ai) {
        title = ai.title;
        description = ai.description;
      } else {
        const fb = synthesize(p);
        title = fb.title;
        description = fb.description;
        warning = "AI title unavailable — used a generated fallback.";
      }
    }
  } catch (err) {
    const fb = synthesize(p);
    title = fb.title;
    description = fb.description;
    warning = `Title generation failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  if (!title) title = synthesize(p).title;

  const saved = await persistDraft(p, title, description);

  const body: CreateListingResponse = {
    ok: true,
    id: saved.id,
    title,
    description,
    payout,
    persisted: saved.persisted,
    warning: warning ?? saved.warning,
  };
  return Response.json(body, { status: 200 });
}

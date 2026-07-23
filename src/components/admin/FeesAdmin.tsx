"use client";

/**
 * FeesAdmin — read/edit UI over the marketplace fee configuration.
 *
 * Loads the merged config from GET /api/admin/fees (compiled-in defaults from
 * `@/lib/fees` + any stored operator overrides) and lets the operator edit the
 * transaction fee, per-category pickup fees, per-category txn overrides,
 * delivery tiers, deposit, and premium threshold. Saving PUTs the config back;
 * the route persists best-effort and reports whether it durably saved.
 *
 * Fails soft: network/parse errors surface as an inline banner, never a crash.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { css, sx } from "@/lib/design/css";

/* --------------------------------- config ---------------------------------- */
// Mirrors the FeeConfig contract served by /api/admin/fees (kept local so this
// client component never imports from a server route module).

interface DeliveryTiers {
  rateLe100: number;
  rateGt100: number;
  rateGt200: number;
  catalogDeliveryCents: number;
  defaultBaseRateCents: number;
}

interface FeeConfig {
  txnFeeDefault: number;
  txnFeeOverrides: Record<string, number>;
  pickupFeesCents: Record<string, number>;
  pickupFeeDefaultCents: number;
  deliveryTiers: DeliveryTiers;
  depositCents: number;
  premiumThresholdCents: number;
}

/* --------------------------------- styles ---------------------------------- */

const HEAD = "font-family:'Reckless','Newsreader',serif;color:var(--ink);margin:0";
const CARD =
  "background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:18px";
const LABEL = "font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em";
const INPUT =
  "border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-size:14px;color:var(--ink);background:var(--cream);width:120px;font-variant-numeric:tabular-nums";
const TH =
  "text-align:left;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:6px 10px;border-bottom:1px solid var(--line)";
const TD = "padding:6px 10px;border-bottom:1px solid var(--line);font-size:14px;color:var(--ink)";

/* --------------------------------- helpers --------------------------------- */

function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toCents(dollarStr: string): number {
  const n = Number(dollarStr.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
}
function pct(fraction: number): string {
  return (fraction * 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function toFraction(pctStr: string): number {
  const n = Number(pctStr.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n / 100)) : 0;
}

interface ApiResponse {
  ok: boolean;
  config: FeeConfig;
  defaults: FeeConfig;
  hasOverrides: boolean;
  persisted: boolean;
  warning?: string;
  error?: string;
}

/* ------------------------------- subcomponents ----------------------------- */

function CentsField(props: { cents: number; onChange: (cents: number) => void }) {
  return (
    <span style={sx("display:inline-flex;align-items:center;gap:4px")}>
      <span style={sx("color:var(--muted)")}>$</span>
      <input
        style={sx(INPUT, "width:100px")}
        inputMode="decimal"
        defaultValue={dollars(props.cents)}
        onBlur={(e) => props.onChange(toCents(e.currentTarget.value))}
      />
    </span>
  );
}

/* -------------------------------- component -------------------------------- */

export default function FeesAdmin() {
  const [cfg, setCfg] = useState<FeeConfig | null>(null);
  const [defaults, setDefaults] = useState<FeeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [persistedState, setPersistedState] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/fees", { headers: { Accept: "application/json" } });
      if (res.status === 401) {
        setBanner({ kind: "err", text: "Not authorized. Sign in as an admin to manage fees." });
        setLoading(false);
        return;
      }
      const data = (await res.json()) as ApiResponse;
      if (!data.ok || !data.config) {
        setBanner({ kind: "err", text: data.error || "Could not load fee config." });
      } else {
        setCfg(data.config);
        setDefaults(data.defaults);
        setPersistedState(data.hasOverrides ? data.persisted : null);
        if (data.warning) setBanner({ kind: "err", text: data.warning });
      }
    } catch (err) {
      setBanner({ kind: "err", text: `Failed to load: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!cfg) return;
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: cfg }),
      });
      if (res.status === 401) {
        setBanner({ kind: "err", text: "Not authorized to save fees." });
        return;
      }
      const data = (await res.json()) as ApiResponse;
      if (!data.ok) {
        setBanner({ kind: "err", text: data.error || "Save failed." });
        return;
      }
      setCfg(data.config);
      setPersistedState(data.persisted);
      setBanner({
        kind: data.persisted ? "ok" : "err",
        text: data.persisted
          ? "Saved. Overrides are live."
          : data.warning || "Applied but not durably saved.",
      });
    } catch (err) {
      setBanner({ kind: "err", text: `Save failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSaving(false);
    }
  }, [cfg]);

  const resetToDefaults = useCallback(() => {
    if (defaults) setCfg(structuredClone(defaults));
  }, [defaults]);

  const patch = useCallback((updater: (prev: FeeConfig) => FeeConfig) => {
    setCfg((prev) => (prev ? updater(prev) : prev));
  }, []);

  const pickupRows = useMemo(
    () => (cfg ? Object.entries(cfg.pickupFeesCents).sort((a, b) => a[0].localeCompare(b[0])) : []),
    [cfg],
  );
  const txnRows = useMemo(
    () => (cfg ? Object.entries(cfg.txnFeeOverrides).sort((a, b) => a[0].localeCompare(b[0])) : []),
    [cfg],
  );

  if (loading) {
    return <div style={sx("padding:24px;color:var(--muted)")}>Loading fee config…</div>;
  }
  if (!cfg) {
    return (
      <div style={sx("padding:24px")}>
        {banner && <Banner banner={banner} />}
        <button style={sx(btnStyle)} onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={sx("padding:20px 24px;max-width:920px")}>
      <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;flex-wrap:wrap")}>
        <h1 style={sx(HEAD, "font-size:24px")}>Fee configuration</h1>
        <div style={sx("display:flex;gap:8px;align-items:center")}>
          {persistedState === false && (
            <span style={sx("font-size:12px;color:var(--maroon)")}>overrides not persisted</span>
          )}
          <button style={sx(btnGhost)} onClick={resetToDefaults} disabled={saving}>
            Reset to defaults
          </button>
          <button style={sx(btnStyle, saving ? "opacity:.6" : "")} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {banner && <Banner banner={banner} />}

      {/* Transaction fee + deposit + premium threshold */}
      <div style={sx(CARD)}>
        <h2 style={sx(HEAD, "font-size:16px;margin-bottom:12px")}>Core fees</h2>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px")}>
          <Field label="Transaction fee (%)">
            <input
              style={sx(INPUT)}
              inputMode="decimal"
              defaultValue={pct(cfg.txnFeeDefault)}
              onBlur={(e) => patch((p) => ({ ...p, txnFeeDefault: toFraction(e.currentTarget.value) }))}
            />
            <DefaultHint show={defaults != null && defaults.txnFeeDefault !== cfg.txnFeeDefault} text={defaults ? `default ${pct(defaults.txnFeeDefault)}%` : ""} />
          </Field>
          <Field label="Reservation deposit">
            <CentsField cents={cfg.depositCents} onChange={(c) => patch((p) => ({ ...p, depositCents: c }))} />
            <DefaultHint show={defaults != null && defaults.depositCents !== cfg.depositCents} text={defaults ? `default $${dollars(defaults.depositCents)}` : ""} />
          </Field>
          <Field label="Premium threshold (manual wire ≥)">
            <CentsField cents={cfg.premiumThresholdCents} onChange={(c) => patch((p) => ({ ...p, premiumThresholdCents: c }))} />
            <DefaultHint show={defaults != null && defaults.premiumThresholdCents !== cfg.premiumThresholdCents} text={defaults ? `default $${dollars(defaults.premiumThresholdCents)}` : ""} />
          </Field>
          <Field label="Default pickup fee">
            <CentsField cents={cfg.pickupFeeDefaultCents} onChange={(c) => patch((p) => ({ ...p, pickupFeeDefaultCents: c }))} />
            <DefaultHint show={defaults != null && defaults.pickupFeeDefaultCents !== cfg.pickupFeeDefaultCents} text={defaults ? `default $${dollars(defaults.pickupFeeDefaultCents)}` : ""} />
          </Field>
        </div>
      </div>

      {/* Delivery tiers */}
      <div style={sx(CARD)}>
        <h2 style={sx(HEAD, "font-size:16px;margin-bottom:12px")}>Delivery tiers</h2>
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px")}>
          <Field label="Rate 0–100 mi ($/mi)">
            <input style={sx(INPUT)} inputMode="decimal" defaultValue={String(cfg.deliveryTiers.rateLe100)}
              onBlur={(e) => patch((p) => ({ ...p, deliveryTiers: { ...p.deliveryTiers, rateLe100: num(e.currentTarget.value) } }))} />
          </Field>
          <Field label="Rate 100–200 mi ($/mi)">
            <input style={sx(INPUT)} inputMode="decimal" defaultValue={String(cfg.deliveryTiers.rateGt100)}
              onBlur={(e) => patch((p) => ({ ...p, deliveryTiers: { ...p.deliveryTiers, rateGt100: num(e.currentTarget.value) } }))} />
          </Field>
          <Field label="Rate 200+ mi ($/mi)">
            <input style={sx(INPUT)} inputMode="decimal" defaultValue={String(cfg.deliveryTiers.rateGt200)}
              onBlur={(e) => patch((p) => ({ ...p, deliveryTiers: { ...p.deliveryTiers, rateGt200: num(e.currentTarget.value) } }))} />
          </Field>
          <Field label="Catalog flat delivery">
            <CentsField cents={cfg.deliveryTiers.catalogDeliveryCents} onChange={(c) => patch((p) => ({ ...p, deliveryTiers: { ...p.deliveryTiers, catalogDeliveryCents: c } }))} />
          </Field>
          <Field label="Default category base rate">
            <CentsField cents={cfg.deliveryTiers.defaultBaseRateCents} onChange={(c) => patch((p) => ({ ...p, deliveryTiers: { ...p.deliveryTiers, defaultBaseRateCents: c } }))} />
          </Field>
        </div>
      </div>

      {/* Per-category pickup fees */}
      <div style={sx(CARD)}>
        <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-bottom:12px")}>
          <h2 style={sx(HEAD, "font-size:16px")}>Per-category pickup fees</h2>
          <AddRow onAdd={(slug) => patch((p) => ({ ...p, pickupFeesCents: { ...p.pickupFeesCents, [slug]: p.pickupFeeDefaultCents } }))} />
        </div>
        <div style={sx("overflow-x:auto")}>
          <table style={sx("width:100%;border-collapse:collapse")}>
            <thead>
              <tr>
                <th style={sx(TH)}>Category slug</th>
                <th style={sx(TH)}>Pickup fee</th>
                <th style={sx(TH)}></th>
              </tr>
            </thead>
            <tbody>
              {pickupRows.map(([slug, cents]) => (
                <tr key={slug}>
                  <td style={sx(TD, "font-family:monospace;font-size:13px")}>{slug}</td>
                  <td style={sx(TD)}>
                    <CentsField cents={cents} onChange={(c) => patch((p) => ({ ...p, pickupFeesCents: { ...p.pickupFeesCents, [slug]: c } }))} />
                  </td>
                  <td style={sx(TD)}>
                    <button style={sx(linkBtn)} onClick={() => patch((p) => { const next = { ...p.pickupFeesCents }; delete next[slug]; return { ...p, pickupFeesCents: next }; })}>
                      remove
                    </button>
                  </td>
                </tr>
              ))}
              {pickupRows.length === 0 && (
                <tr><td style={sx(TD, "color:var(--muted)")} colSpan={3}>No per-category pickup fees.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-category transaction-fee overrides */}
      <div style={sx(CARD)}>
        <div style={sx("display:flex;align-items:center;justify-content:space-between;margin-bottom:12px")}>
          <h2 style={sx(HEAD, "font-size:16px")}>Per-category transaction overrides</h2>
          <AddRow onAdd={(slug) => patch((p) => ({ ...p, txnFeeOverrides: { ...p.txnFeeOverrides, [slug]: p.txnFeeDefault } }))} />
        </div>
        <div style={sx("overflow-x:auto")}>
          <table style={sx("width:100%;border-collapse:collapse")}>
            <thead>
              <tr>
                <th style={sx(TH)}>Category slug</th>
                <th style={sx(TH)}>Fee (%)</th>
                <th style={sx(TH)}></th>
              </tr>
            </thead>
            <tbody>
              {txnRows.map(([slug, frac]) => (
                <tr key={slug}>
                  <td style={sx(TD, "font-family:monospace;font-size:13px")}>{slug}</td>
                  <td style={sx(TD)}>
                    <input style={sx(INPUT, "width:80px")} inputMode="decimal" defaultValue={pct(frac)}
                      onBlur={(e) => patch((p) => ({ ...p, txnFeeOverrides: { ...p.txnFeeOverrides, [slug]: toFraction(e.currentTarget.value) } }))} />
                  </td>
                  <td style={sx(TD)}>
                    <button style={sx(linkBtn)} onClick={() => patch((p) => { const next = { ...p.txnFeeOverrides }; delete next[slug]; return { ...p, txnFeeOverrides: next }; })}>
                      remove
                    </button>
                  </td>
                </tr>
              ))}
              {txnRows.length === 0 && (
                <tr><td style={sx(TD, "color:var(--muted)")} colSpan={3}>No overrides — all categories use the default rate.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- small parts ------------------------------- */

const btnStyle =
  "background:var(--maroon);color:var(--cream);border:none;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer;font-weight:600";
const btnGhost =
  "background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 14px;font-size:14px;cursor:pointer";
const linkBtn =
  "background:none;border:none;color:var(--maroon);cursor:pointer;font-size:13px;text-decoration:underline;padding:0";

function num(s: string): number {
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:6px")}>
      <span style={sx(LABEL)}>{props.label}</span>
      <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>{props.children}</div>
    </div>
  );
}

function DefaultHint(props: { show: boolean; text: string }) {
  if (!props.show || !props.text) return null;
  return <span style={sx("font-size:11px;color:var(--muted)")}>{props.text}</span>;
}

function Banner(props: { banner: { kind: "err" | "ok"; text: string } }) {
  const { kind, text } = props.banner;
  return (
    <div
      style={sx(
        "border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:14px",
        kind === "err"
          ? css("background:color-mix(in srgb,var(--maroon) 10%,transparent);color:var(--maroon);border:1px solid var(--maroon)")
          : css("background:color-mix(in srgb,var(--green) 12%,transparent);color:var(--green);border:1px solid var(--green)"),
      )}
    >
      {text}
    </div>
  );
}

function AddRow(props: { onAdd: (slug: string) => void }) {
  const [slug, setSlug] = useState("");
  return (
    <div style={sx("display:flex;gap:6px;align-items:center")}>
      <input
        style={sx(INPUT, "width:150px")}
        placeholder="new-category-slug"
        value={slug}
        onChange={(e) => setSlug(e.currentTarget.value)}
      />
      <button
        style={sx(btnGhost, "padding:6px 12px")}
        onClick={() => {
          const s = slug.trim().toLowerCase().replace(/\s+/g, "-");
          if (s) {
            props.onAdd(s);
            setSlug("");
          }
        }}
      >
        + add
      </button>
    </div>
  );
}

export { FeesAdmin };

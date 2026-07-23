"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { CAT_GROUPS, CONDITIONS } from "@/components/marketplace/data";
import { resolveSellSpec, type Field } from "@/components/marketplace/sellSchema";
import { submitListing, previewPayout } from "@/lib/createListing";

/**
 * SellPage — the standalone "sell" page, ported from the live trycommonplace.com
 * /sell/ view (separate page, NOT a modal). Three surfaces:
 *   - start:  AI concierge banner + "What are you selling today?" hero + product
 *             name input + Sell Now + in-progress Draft Listings (progress rings).
 *   - margot: the rebuilt conversational AI listing concierge (chat + photo) — a
 *             Jack-style agent that gathers details and hands them to the form.
 *   - form:   the easy sell form (generic-first, real per-category ACF fields,
 *             photo upload with AI photo→details, live payout preview).
 *
 * Everything is fail-soft and self-contained. Drafts persist to localStorage so
 * a half-finished listing survives a refresh.
 */

const PLUM = "#630E3D";
const FIELD =
  "width:100%;border:1px solid var(--line);background:var(--paper);border-radius:10px;padding:12px 13px;font-size:14.5px;color:var(--ink);outline:none;font-family:inherit;box-sizing:border-box";

const ALL_CATS = CAT_GROUPS.flatMap((g) => g.items);
const DRAFT_KEY = "cp_sell_drafts_v1";

/* ------------------------------------------------------------------ */
/* Auto-categorization                                                */
/* ------------------------------------------------------------------ */
/**
 * Map a free-typed product name to a category slug. High-confidence rules
 * (brand/keyword) come first; a full category-name match is also high
 * confidence. Anything weaker is returned as a low-confidence guess so we ask
 * the seller to confirm rather than guessing wrong.
 */
const CAT_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/peloton\b.*(bike ?\+|bike ?plus|\bplus\b)/i, "peloton-bike-plus"],
  [/peloton\b.*(tread ?\+|tread ?plus)/i, "peloton-tread-plus"],
  [/peloton\b.*(3rd|third)\b/i, "peloton-bike-3rd-gen"],
  [/peloton\b.*tread/i, "peloton-tread"],
  [/peloton\b.*row/i, "peloton-row"],
  [/peloton/i, "peloton-bike-2nd-gen"],
  [/nordic ?track/i, "nordictrack-treadmill"],
  [/pro ?form/i, "proform-treadmill"],
  [/bow ?flex/i, "bowflex"],
  [/hydrow/i, "hydrow-pro-rowing-machine"],
  [/(assault|air) ?bike/i, "assault-fitness-bike"],
  [/spin ?bike/i, "spin-bike"],
  [/indoor (cycling )?bike/i, "indoor-bikes"],
  [/(rower|rowing machine|rowing)/i, "rower"],
  [/elliptical/i, "elliptical"],
  [/tread ?mill/i, "treadmills"],
  [/\btonal\b/i, "tonal"],
  [/smith machine/i, "smith-machine"],
  [/(reformer|pilates)/i, "reformer"],
  [/functional trainer|cable (machine|crossover)/i, "functional-trainer"],
  [/home gym|power rack|squat rack/i, "home-gym"],
  [/dumbbell|kettlebell|weight set|barbell/i, "dumbbell"],
  [/swim spa/i, "swim-spa"],
  [/jacuzzi/i, "jacuzzi"],
  [/hot spring/i, "hot-spring"],
  [/(hot ?tub|spa\b)/i, "hot-tub"],
  [/infrared sauna/i, "infrared-sauna"],
  [/sauna/i, "sauna"],
  [/(cold plunge|ice bath|plunge tub)/i, "cold-plunge"],
  [/float ?pod|sensory tank/i, "float-pod"],
  [/massage chair/i, "massage-chair"],
  [/golf ?cart/i, "golf-carts"],
  [/\batv\b|four ?wheeler|quad bike/i, "atv"],
  [/\brv\b|motor ?home|camper|winnebago/i, "rv-motorhome"],
  [/(lawn ?mower|riding mower|zero ?turn)/i, "lawn-mower"],
  [/\b(car|truck|suv|sedan|vehicle|tesla|toyota|honda|ford|jeep|bmw)\b/i, "cars"],
];

function categorizeName(name: string): { slug: string | null; confident: boolean } {
  const n = name.trim().toLowerCase();
  if (!n) return { slug: null, confident: false };

  // 1) High-confidence keyword/brand rules.
  for (const [re, slug] of CAT_RULES) {
    if (re.test(n) && ALL_CATS.some((c) => c.slug === slug)) return { slug, confident: true };
  }

  // 2) Full category-name present in the input → high confidence.
  const direct = ALL_CATS.find((c) => c.name.length > 3 && n.includes(c.name.toLowerCase()));
  if (direct) return { slug: direct.slug, confident: true };

  // 3) Weak token overlap → low-confidence guess (ask to confirm).
  let best: string | null = null;
  let bestScore = 0;
  for (const c of ALL_CATS) {
    const toks = c.name.toLowerCase().split(/[^a-z0-9+]+/).filter((t) => t.length > 2);
    if (!toks.length) continue;
    const hits = toks.filter((t) => n.includes(t)).length;
    const score = hits / toks.length;
    if (score > bestScore) { bestScore = score; best = c.slug; }
  }
  if (best && bestScore >= 0.5) return { slug: best, confident: false };
  return { slug: null, confident: false };
}

/* ------------------------------------------------------------------ */
/* Draft persistence                                                  */
/* ------------------------------------------------------------------ */

interface Draft {
  id: string;
  title: string;
  categorySlug: string;
  categoryName: string;
  condition: string;
  price: string;
  answers: Record<string, string | string[]>;
  pickup: string;
  updatedAt: number;
}

function loadDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const arr = raw ? (JSON.parse(raw) as Draft[]) : [];
    return Array.isArray(arr) ? arr.filter((d) => d && typeof d.id === "string") : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: Draft[]): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts.slice(0, 12)));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

/** Rough completeness 0–100 for the progress ring. */
function draftPct(d: Draft): number {
  const spec = resolveSellSpec(d.categorySlug || undefined);
  const req: Array<boolean> = [
    !!d.title.trim(),
    !!d.categorySlug,
    !!d.condition,
    !!d.price.trim(),
    ...spec.questions.filter((q) => q.required).map((q) => {
      const v = d.answers[q.key];
      return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim());
    }),
  ];
  if (req.length === 0) return 0;
  const done = req.filter(Boolean).length;
  return Math.max(5, Math.round((done / req.length) * 100));
}

/* ------------------------------------------------------------------ */
/* Progress ring                                                      */
/* ------------------------------------------------------------------ */
function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div style={css("position:relative;width:64px;height:64px;flex:0 0 auto")}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#eadfe4" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={PLUM} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 32 32)" />
      </svg>
      <div style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:" + PLUM)}>{pct}%</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Types for the AI field payload                                     */
/* ------------------------------------------------------------------ */
interface MargotFields {
  title?: string;
  category?: string;
  price?: number;
  condition?: string;
  details?: string;
  ready?: boolean;
}
interface ChatMsg { role: "user" | "assistant"; content: string; photo?: string }

/* ================================================================== */
/* Component                                                          */
/* ================================================================== */
export function SellPage({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<"margot" | "form">("form");
  const [catConfident, setCatConfident] = useState(true);
  const [catEditing, setCatEditing] = useState(false);
  const [catTouched, setCatTouched] = useState(false); // user manually chose a category

  // ---- form state ----
  const [draftId, setDraftId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [cond, setCond] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [price, setPrice] = useState("");
  const [origPrice, setOrigPrice] = useState("");
  const [floorPrice, setFloorPrice] = useState("");
  const [pickup, setPickup] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [bannerOpen, setBannerOpen] = useState(true);

  // ---- drafts ----
  const [drafts, setDrafts] = useState<Draft[]>([]);
  useEffect(() => { setDrafts(loadDrafts()); }, []);

  const matched = ALL_CATS.find((c) => c.slug === catSlug);
  const spec = resolveSellSpec(catSlug || undefined);
  const toCents = (s: string) => Math.round((parseFloat(s.replace(/[^0-9.]/g, "")) || 0) * 100);
  const priceCents = toCents(price);
  const payout = priceCents > 0 ? previewPayout(priceCents, matched?.slug) : null;

  const setAns = (key: string, val: string | string[]) => setAnswers((p) => ({ ...p, [key]: val }));
  const toggleChip = (key: string, opt: string) =>
    setAnswers((p) => {
      const cur = Array.isArray(p[key]) ? (p[key] as string[]) : [];
      return { ...p, [key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });

  const visibleFields = spec.questions.filter(
    (f) => !f.showWhen || (Array.isArray(answers[f.showWhen.field]) && (answers[f.showWhen.field] as string[]).includes(f.showWhen.includes)),
  );

  /* ---- draft save/load ---- */
  const persistDraft = useCallback(() => {
    if (!title.trim() && !catSlug && !price.trim()) return;
    const id = draftId || `d_${title.slice(0, 8)}_${JSON.stringify(answers).length}`;
    const d: Draft = { id, title, categorySlug: catSlug, categoryName: matched?.name ?? "", condition: cond, price, answers, pickup, updatedAt: photos.length };
    setDrafts((prev) => {
      const next = [d, ...prev.filter((x) => x.id !== id)];
      saveDrafts(next);
      return next;
    });
    setDraftId(id);
  }, [draftId, title, catSlug, matched, cond, price, answers, pickup, photos.length]);

  function openForm(prefillTitle?: string) {
    if (prefillTitle) setTitle(prefillTitle);
    setMode("form");
  }

  /**
   * As the seller types the item name, auto-assign the category (until they
   * manually override it). Naming the item is what reveals the rest of the
   * form, so this keeps the category in lockstep with the title with zero
   * extra steps.
   */
  function onTitleChange(v: string) {
    setTitle(v);
    if (catTouched) return;
    const { slug, confident } = categorizeName(v);
    setCatSlug(slug ?? "");
    setCatConfident(!!slug && confident);
  }

  function loadDraft(d: Draft) {
    setDraftId(d.id);
    setTitle(d.title);
    setCatSlug(d.categorySlug);
    setCond(d.condition);
    setAnswers(d.answers || {});
    setPrice(d.price);
    setPickup(d.pickup || "");
    setMode("form");
  }

  function deleteDraft(id: string) {
    setDrafts((prev) => { const next = prev.filter((x) => x.id !== id); saveDrafts(next); return next; });
  }

  /* ---- apply AI-extracted fields ---- */
  const applyFields = useCallback((f: MargotFields) => {
    if (f.title) setTitle(f.title);
    if (typeof f.price === "number" && f.price > 0) setPrice(String(f.price));
    if (f.condition) {
      const hit = CONDITIONS.find((c) => c.label.toLowerCase() === String(f.condition).toLowerCase());
      if (hit) setCond(hit.label);
    }
    if (f.category) {
      const hit = ALL_CATS.find((c) => c.name.toLowerCase() === String(f.category).toLowerCase()
        || String(f.category).toLowerCase().includes(c.name.toLowerCase()));
      if (hit) { setCatSlug(hit.slug); setCatConfident(true); setCatTouched(true); }
    }
    if (f.details) setAns("description", f.details);
  }, []);

  /* ---- AI photo → details (the AI photo editor) ---- */
  async function fillFromPhoto(dataUrl: string) {
    setAiBusy(true);
    try {
      const res = await fetch("/api/ai/margot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoDataUrl: dataUrl, messages: [{ role: "user", content: "Identify this item and fill in my listing details." }] }),
      });
      const data = (await res.json()) as { fields?: MargotFields };
      if (data?.fields) applyFields(data.fields);
    } catch {
      /* fail-soft — seller can still fill manually */
    } finally {
      setAiBusy(false);
    }
  }

  function onPhotoPick(files: FileList | null) {
    if (!files) return;
    Array.from(files).slice(0, 8).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || "");
        if (!url.startsWith("data:image/")) return;
        setPhotos((p) => [...p, url].slice(0, 8));
        if (photos.length === 0) void fillFromPhoto(url); // auto-AI on first photo
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await submitListing({
        categorySlug: matched?.slug ?? "",
        categoryName: matched?.name ?? "",
        title: title.trim() || undefined,
        priceCents,
        floorCents: floorPrice ? toCents(floorPrice) : undefined,
        originalCents: origPrice ? toCents(origPrice) : undefined,
        condition: cond || undefined,
        answers: answers as Record<string, string | string[]>,
        photos,
        pickupAddress: pickup.trim() || undefined,
      });
      if (draftId) deleteDraft(draftId);
      setResult(res?.title || title.trim() || "Listing created");
    } catch {
      setResult("Your listing has been saved.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- Success ---------------- */
  if (result) {
    return (
      <div style={css("max-width:640px;margin:60px auto;text-align:center;padding:20px")}>
        <div style={css("width:64px;height:64px;margin:0 auto 18px;border-radius:50%;background:var(--greenBg);display:flex;align-items:center;justify-content:center")}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:30px;font-weight:600;margin-bottom:8px")}>Listing submitted</h1>
        <p style={css("font-size:15px;color:var(--muted);margin-bottom:8px")}>“{result}”</p>
        <p style={css("font-size:14px;color:var(--muted);margin-bottom:22px")}>We&apos;ll review it and reach out to schedule pickup — Commonplace handles delivery, inspection, and payment.</p>
        <Hoverable as="button" onClick={() => { setResult(null); setTitle(""); setCatSlug(""); setCatTouched(false); setCond(""); setAnswers({}); setPrice(""); setPhotos([]); setPickup(""); setDraftId(""); setMode("form"); }}
          styles={`background:${PLUM};color:#fff;border:none;border-radius:30px;padding:13px 28px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;margin-right:10px`} hover="filter:brightness(1.08)">List another item</Hoverable>
        {onDone && <Hoverable as="button" onClick={onDone} styles="background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:30px;padding:13px 24px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit" hover="border-color:#d9b7c2">Back to marketplace</Hoverable>}
      </div>
    );
  }

  /* ---------------- Margot chat ---------------- */
  if (mode === "margot") {
    return <MargotChat onBack={() => setMode("form")} onUse={(f) => { applyFields(f); openForm(f.title); }} />;
  }

  /* ---------------- Form ---------------- */
  /* ---------------- The sell page (form-first; details reveal after naming the item) ---------------- */
  const started = title.trim().length > 0;
  return (
    <div style={css("max-width:720px;margin:0 auto;padding:26px 22px 90px")}>
      {/* Back to marketplace */}
      <Hoverable as="span" onClick={() => { persistDraft(); onDone?.(); }} styles="display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:600;color:var(--muted);cursor:pointer;margin-bottom:16px" hover="color:var(--ink)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>Back
      </Hoverable>

      {/* AI concierge banner */}
      {bannerOpen && (
        <div style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:20px")}>
          <div style={css(`width:38px;height:38px;flex:0 0 auto;border-radius:50%;background:${PLUM};display:flex;align-items:center;justify-content:center`)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" /></svg>
          </div>
          <div style={css("flex:1;min-width:0")}>
            <div style={css("font-size:14.5px;font-weight:700;color:var(--ink)")}>Try our new AI listing concierge.</div>
            <div style={css("font-size:13px;color:var(--muted)")}>Drop a photo and Margot fills in the details — usually faster than the form.</div>
          </div>
          <Hoverable as="button" onClick={() => setMode("margot")} styles={`background:#5C1F37;color:#fff;border:none;border-radius:999px;padding:9px 18px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap`} hover="filter:brightness(1.12)">Try Margot →</Hoverable>
          <span onClick={() => setBannerOpen(false)} style={css("cursor:pointer;color:var(--muted);font-size:18px;line-height:1;padding:0 2px")}>×</span>
        </div>
      )}

      {/* Resume a draft */}
      {drafts.length > 0 && (
        <div style={css("margin-bottom:22px")}>
          <div style={css("font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:9px")}>Resume a draft</div>
          <div style={css("display:flex;flex-direction:column;gap:10px")}>
            {drafts.map((d) => (
              <div key={d.id} style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:12px 16px")}>
                <Ring pct={draftPct(d)} />
                <div style={css("flex:1;min-width:0")}>
                  <div style={css("font-size:14px;font-weight:700;color:" + PLUM)}>Draft{d.price ? `: $${Number(d.price.replace(/[^0-9.]/g, "")).toLocaleString("en-US")}` : ""}</div>
                  <div style={css("font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{d.title || d.categoryName || "Untitled item"}</div>
                </div>
                <span onClick={() => deleteDraft(d.id)} style={css("font-size:12px;color:var(--muted);cursor:pointer;text-decoration:underline")}>Discard</span>
                <Hoverable as="button" onClick={() => loadDraft(d)} styles={`background:${PLUM};color:#fff;border:none;border-radius:999px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit`} hover="filter:brightness(1.08)">Finish</Hoverable>
              </div>
            ))}
          </div>
        </div>
      )}

      <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:32px;font-weight:500;letter-spacing:-.4px;margin-bottom:6px")}>Create your listing</h1>
      <p style={css("font-size:14px;color:var(--muted);margin-bottom:22px")}>List it once — Commonplace handles pickup, inspection, delivery, and payment.</p>

      <div style={css("display:flex;flex-direction:column;gap:18px")}>
        {/* Photos + AI (drop a photo and Margot fills everything in) */}
        <div>
          <FieldLabel label="Photos" help="Add a photo and Margot auto-fills the details for you." />
          <div style={css("display:flex;flex-wrap:wrap;gap:10px;align-items:center")}>
            {photos.map((p, i) => (
              <div key={i} style={css("position:relative;width:78px;height:78px;border-radius:10px;overflow:hidden;border:1px solid var(--line)")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" style={css("width:100%;height:100%;object-fit:cover")} />
                <span onClick={() => setPhotos((prev) => prev.filter((_, x) => x !== i))} style={css("position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer")}>×</span>
              </div>
            ))}
            <label style={sx("width:78px;height:78px;border-radius:10px;border:1.5px dashed var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;color:var(--muted);font-size:11px;text-align:center", "background:var(--paper)")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Add
              <input type="file" accept="image/*" multiple onChange={(e) => onPhotoPick(e.target.files)} style={css("display:none")} />
            </label>
            {aiBusy && <span style={css("font-size:13px;color:" + PLUM + ";font-weight:600")}>✨ Margot is reading your photo…</span>}
          </div>
        </div>

        {/* Item name — reveals the rest of the form */}
        <div>
          <FieldLabel label="What are you selling?" help="A short title — our AI polishes it into a clean, searchable listing." />
          <input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="e.g. Peloton Bike+, Sub-Zero fridge, leather sofa…" style={css(FIELD)} />
        </div>

        {!started && (
          <div style={css("font-size:13.5px;color:var(--muted);display:flex;align-items:center;gap:7px;padding:2px 2px 6px")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
            Name your item above (or drop a photo) and the rest of the form appears.
          </div>
        )}

        {started && (<>{/* ---- details ---- */}

          {/* Category — auto-assigned from the title; confirm/change inline (no extra step) */}
          <div>
            <FieldLabel label="Category" help={!catConfident ? "We guessed this from your title — confirm it or tap Change." : undefined} />
            <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
              <span style={sx("display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:20px;font-size:13.5px;font-weight:700", matched ? { background: "#F4E7EA", color: PLUM } : { background: "var(--putty)", color: "var(--muted)" }, !catConfident && "box-shadow:0 0 0 2px #E9B355")}>
                {matched ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M20 6 9 17l-5-5" /></svg>{matched.name}</>
                ) : "Generic item"}
              </span>
              <Hoverable as="span" onClick={() => setCatEditing((v) => !v)} styles="font-size:13px;font-weight:700;color:var(--blueInk);cursor:pointer" hover="text-decoration:underline">{catEditing ? "Close" : "Change"}</Hoverable>
            </div>
            {catEditing && (
              <div style={css("margin-top:12px;border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--paper);max-height:300px;overflow-y:auto")}>
                {CAT_GROUPS.map((g) => (
                  <div key={g.name} style={css("margin-bottom:12px")}>
                    <div style={css("font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:7px")}>{g.name}</div>
                    <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
                      {g.items.map((it) => {
                        const on = it.slug === catSlug;
                        return (
                          <div key={it.slug} onClick={() => { setCatSlug(it.slug); setCatConfident(true); setCatTouched(true); setCatEditing(false); }}
                            style={sx("padding:7px 12px;border-radius:16px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .14s", on ? { background: PLUM, color: "#fff", border: `1px solid ${PLUM}` } : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" })}>{it.name}</div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div onClick={() => { setCatSlug(""); setCatConfident(true); setCatTouched(true); setCatEditing(false); }} style={css("font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;text-decoration:underline;margin-top:4px")}>Use a generic listing instead</div>
              </div>
            )}
          </div>

          {/* Category-specific ACF fields */}
          {visibleFields.map((f) => (
            <FieldRenderer key={f.key} f={f} val={answers[f.key]} setAns={setAns} toggleChip={toggleChip} />
          ))}

          {/* Condition */}
          <div>
            <FieldLabel label="Condition" />
            <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
              {CONDITIONS.map((c) => {
                const on = cond === c.label;
                return (
                  <div key={c.key} onClick={() => setCond(c.label)} style={sx("padding:8px 14px;border-radius:18px;font-size:13px;font-weight:600;cursor:pointer;transition:all .14s",
                    on ? { background: PLUM, color: "#fff", border: `1px solid ${PLUM}` } : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" })}>{c.label}</div>
                );
              })}
            </div>
          </div>

          {/* Price */}
          <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:14px")}>
            <div>
              <FieldLabel label="Your price" />
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="$" style={css(FIELD)} />
            </div>
            <div>
              <FieldLabel label="Original retail" help="Optional" />
              <input value={origPrice} onChange={(e) => setOrigPrice(e.target.value)} inputMode="decimal" placeholder="$" style={css(FIELD)} />
            </div>
          </div>

          {/* Pickup */}
          <div>
            <FieldLabel label="Pickup address" help="Where we collect the item. Only shared with the delivery team." />
            <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Street, City, State" style={css(FIELD)} />
          </div>

          {/* Payout preview */}
          {payout && (
            <div style={css("background:var(--greenBg);border:1px solid #bfe0cd;border-radius:12px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px")}>
              <div style={css("font-size:13.5px;color:#1f5c3d")}>Your estimated payout</div>
              <div style={css("font-size:20px;font-weight:800;color:var(--green)")}>${(payout.payoutCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          )}

          <Hoverable as="button" onClick={handleSubmit}
            styles={`width:100%;background:${PLUM};color:#fff;border:none;border-radius:30px;padding:15px;font-size:16px;font-weight:600;cursor:${submitting ? "default" : "pointer"};font-family:inherit;opacity:${submitting ? ".7" : "1"}`} hover="filter:brightness(1.08)">
            {submitting ? "Submitting…" : "Submit listing"}
          </Hoverable>
        </>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field helpers                                                      */
/* ------------------------------------------------------------------ */
function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <div style={css("margin-bottom:7px")}>
      <div style={css("font-size:13px;font-weight:700;color:var(--ink)")}>{label}</div>
      {help && <div style={css("font-size:11.5px;color:var(--muted);line-height:1.4;margin-top:2px")}>{help}</div>}
    </div>
  );
}

function FieldRenderer({ f, val, setAns, toggleChip }: {
  f: Field; val: string | string[] | undefined;
  setAns: (k: string, v: string | string[]) => void;
  toggleChip: (k: string, o: string) => void;
}) {
  if (f.type === "textarea") {
    return (<div><FieldLabel label={f.label} help={f.help} /><textarea value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} placeholder={f.placeholder} rows={3} style={sx(FIELD, "resize:vertical;line-height:1.45")} /></div>);
  }
  if (f.type === "select") {
    return (<div><FieldLabel label={f.label} help={f.help} /><select value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} style={sx(FIELD, "cursor:pointer")}><option value="">Select…</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>);
  }
  if (f.type === "radio" || f.type === "chips") {
    const multi = f.type === "chips";
    const selected = multi ? (Array.isArray(val) ? val : []) : val;
    return (
      <div><FieldLabel label={f.label} help={f.help} />
        <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
          {f.options?.map((o) => {
            const on = multi ? (selected as string[]).includes(o) : selected === o;
            return (<div key={o} onClick={() => (multi ? toggleChip(f.key, o) : setAns(f.key, o))} style={sx("padding:8px 13px;border-radius:18px;font-size:13px;font-weight:600;cursor:pointer;transition:all .14s", on ? { background: PLUM, color: "#fff", border: `1px solid ${PLUM}` } : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" })}>{o}</div>);
          })}
        </div>
      </div>
    );
  }
  return (<div><FieldLabel label={f.label} help={f.help} /><input value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} inputMode={f.type === "number" ? "numeric" : undefined} placeholder={f.placeholder} style={css(FIELD)} /></div>);
}

/* ------------------------------------------------------------------ */
/* Margot conversational concierge                                    */
/* ------------------------------------------------------------------ */
function MargotChat({ onBack, onUse }: { onBack: () => void; onUse: (f: MargotFields) => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi, I'm Margot 👋 Tell me what you're selling — or drop a photo — and I'll build the listing with you." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<MargotFields | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  async function send(text: string, photo?: string) {
    if (busy) return;
    if (!text.trim() && !photo) return;
    const userMsg: ChatMsg = { role: "user", content: text.trim() || "(photo)", photo };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/margot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })), photoDataUrl: photo }),
      });
      const data = (await res.json()) as { reply?: string; fields?: MargotFields };
      setMessages((m) => [...m, { role: "assistant", content: data?.reply || "Tell me a little more and I'll put it together." }]);
      if (data?.fields) setFields(data.fields);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "I hit a snag connecting. You can use the quick form instead — hit back and type your item name." }]);
    } finally {
      setBusy(false);
    }
  }

  function pickPhoto(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const url = String(reader.result || ""); if (url.startsWith("data:image/")) void send("Here's a photo of my item.", url); };
    reader.readAsDataURL(file);
  }

  return (
    <div style={css("max-width:640px;margin:0 auto;padding:24px 22px 40px;display:flex;flex-direction:column;height:calc(100dvh - 120px)")}>
      <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:14px")}>
        <Hoverable as="span" onClick={onBack} styles="display:inline-flex;align-items:center;gap:4px;font-size:14px;font-weight:600;color:var(--muted);cursor:pointer" hover="color:var(--ink)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>Back
        </Hoverable>
        <div style={css(`width:30px;height:30px;border-radius:50%;background:${PLUM};display:flex;align-items:center;justify-content:center;margin-left:auto`)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" /></svg>
        </div>
        <div style={css("font-family:'Reckless','Newsreader',serif;font-size:19px;font-weight:600")}>Margot</div>
      </div>

      <div ref={scrollRef} style={css("flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:6px 2px")}>
        {messages.map((m, i) => (
          <div key={i} style={sx("max-width:82%;padding:11px 14px;border-radius:16px;font-size:14px;line-height:1.5",
            m.role === "user" ? { alignSelf: "flex-end", background: PLUM, color: "#fff", borderBottomRightRadius: "5px" } : { alignSelf: "flex-start", background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)", borderBottomLeftRadius: "5px" })}>
            {m.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo} alt="" style={css("width:140px;border-radius:10px;margin-bottom:6px;display:block")} />
            )}
            {m.content}
          </div>
        ))}
        {busy && <div style={css("align-self:flex-start;padding:11px 14px;border-radius:16px;background:var(--paper);border:1px solid var(--line);font-size:14px;color:var(--muted)")}>Margot is typing…</div>}
      </div>

      {fields && (fields.ready || fields.title) && (
        <Hoverable as="button" onClick={() => onUse(fields)} styles={`margin:12px 0 6px;background:var(--green);color:#fff;border:none;border-radius:12px;padding:13px;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit`} hover="filter:brightness(1.06)">
          ✓ Use these details {fields.title ? `— “${fields.title.slice(0, 40)}”` : ""}
        </Hoverable>
      )}

      <div style={css("display:flex;gap:8px;align-items:center;border:1px solid var(--line);background:var(--paper);border-radius:26px;padding:5px 6px 5px 8px;margin-top:10px")}>
        <label style={css("width:36px;height:36px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted)")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15l-5-5L5 21" /><path d="M21 12V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14" /><circle cx="9" cy="9" r="2" /></svg>
          <input type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files)} style={css("display:none")} />
        </label>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(input); }}
          placeholder="Type your item or ask Margot…" style={css("flex:1;border:none;outline:none;background:transparent;font-size:14px;color:var(--ink);padding:8px;font-family:inherit")} />
        <Hoverable as="button" onClick={() => void send(input)} styles={`background:${PLUM};color:#fff;border:none;border-radius:50%;width:38px;height:38px;flex:0 0 auto;cursor:pointer;display:flex;align-items:center;justify-content:center`} hover="filter:brightness(1.1)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </Hoverable>
      </div>
    </div>
  );
}

export default SellPage;

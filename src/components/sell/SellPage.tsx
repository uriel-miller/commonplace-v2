"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { CAT_GROUPS, ALL_CATS, CONDITIONS } from "@/components/marketplace/data";
import { resolveSellSpec, brandOptionsFor, furnitureExtraFields, type Field } from "@/components/marketplace/sellSchema";
import { analytics } from "@/lib/analytics/tracker";
import { submitListing, previewPayout } from "@/lib/createListing";
import { AddressAutocomplete } from "@/components/sell/AddressAutocomplete";
import { fuzzyCategoryMatch } from "@/lib/fuzzy";

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
  "width:100%;border:1.5px solid var(--line);background:#fff;border-radius:12px;padding:13px 15px;font-size:15px;color:var(--ink);outline:none;font-family:inherit;box-sizing:border-box;transition:border-color .15s";

// Lighter, whiter selection chips — soft blue accent instead of solid maroon.
// Sellers never free-type a description (that's how phone numbers leak in) — they
// pick selling-point pills and we generate the full copy from those + the specs.
const DESCRIPTION_PILLS = [
  "Open to offers", "Smoke-free home", "Pet-free home", "Barely used", "Rarely used",
  "Like-new condition", "All original parts included", "Well maintained", "Includes accessories",
];
const CHIP_ON = { background: "var(--blueBg)", color: "var(--blueInk)", border: "1px solid var(--blueInk)" } as const;
const CHIP_OFF = { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" } as const;

const DRAFT_KEY = "cp_sell_drafts_v1";

/* ------------------------------------------------------------------ */
/* Instant local title + description composer                         */
/* ------------------------------------------------------------------ */
/** Collect answer values whose key matches `re` (arrays flattened). */
function pickAnswers(answers: Record<string, string | string[]>, re: RegExp): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(answers)) {
    if (!re.test(k)) continue;
    if (Array.isArray(v)) out.push(...v.map(String));
    else if (v != null && String(v).trim()) out.push(String(v).trim());
  }
  return out;
}
const cleanCond = (c: string) => c.replace(/\s*\(.*?\)\s*/g, "").trim();
const ACC_RE = /accessor|includes|what.?s? ?included/i;

const ISSUE_RE = /issue|damage/i;
const NO_ISSUE_RE = /no damage|no issue|none|works? (perfectly|well)/i;

/** Title-case a lowercased phrase (e.g. "peloton bike" → "Peloton Bike"). */
function titleCase(s: string): string {
  return s.replace(/\b([a-z])(\w*)/g, (_, a, b) => a.toUpperCase() + b);
}
/** "a, b and c" natural-language list. */
function listPhrase(arr: string[]): string {
  const a = arr.filter(Boolean);
  if (a.length <= 1) return a.join("");
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}
function displayName(name: string, categoryName: string): string {
  const base = (name.trim() || categoryName || "This item").trim();
  return /[a-z]/.test(base) && base === base.toLowerCase() ? titleCase(base) : base;
}

/** Instant title, e.g. "2022 Peloton Bike+ - Excellent Condition, Includes Shoes, Mat". */
function composeTitle(name: string, categoryName: string, condition: string, answers: Record<string, string | string[]>): string {
  const base = displayName(name, categoryName);
  if (!base || base === "This item") return "";
  const year = pickAnswers(answers, /year/i).find((y) => /^\d{4}/.test(y)) || "";
  const accs = pickAnswers(answers, ACC_RE).filter((a) => !/^\d+$/.test(a));
  const bits: string[] = [];
  if (condition) bits.push(`${cleanCond(condition)} Condition`);
  if (accs.length) bits.push(`Includes ${accs.slice(0, 3).join(", ")}`);
  let t = [year, base].filter(Boolean).join(" ");
  if (bits.length) t += ` - ${bits.join(", ")}`;
  return t.slice(0, 90);
}

/** Instant, human description reflecting condition + accessories + shoe sizes +
    issues, closing with the Commonplace guarantee. Longer + nicer than a spec dump. */
function composeDesc(name: string, categoryName: string, condition: string, answers: Record<string, string | string[]>): string {
  const item = [pickAnswers(answers, /year/i).find((y) => /^\d{4}/.test(y)) || "", displayName(name, categoryName)].filter(Boolean).join(" ");
  const cond = condition ? cleanCond(condition).toLowerCase() : "";
  const accs = pickAnswers(answers, ACC_RE).filter((a) => !/^\d+$/.test(a)).map((a) => a.toLowerCase());
  const shoeSizes = pickAnswers(answers, /shoe ?size/i).filter((v) => /^\d+/.test(v));
  const issues = pickAnswers(answers, ISSUE_RE);
  const noDamage = issues.some((i) => NO_ISSUE_RE.test(i));
  const realIssues = issues.filter((i) => !NO_ISSUE_RE.test(i)).map((i) => i.toLowerCase());
  const notes = pickAnswers(answers, /description|note|detail/i).join(" ").trim();
  const specs = Object.entries(answers)
    .filter(([k, v]) => !/year|accessor|includes|condition|description|note|detail|issue|damage|smoke|pet|shoe|what/i.test(k) && v && (Array.isArray(v) ? v.length : String(v).trim()))
    .map(([, v]) => (Array.isArray(v) ? v.join(", ") : String(v)).toLowerCase());

  const s: string[] = [];
  s.push(`This ${item || "item"} is${cond ? ` in ${cond} condition` : " ready for a new home"}${noDamage ? " with no damage" : ""}.`);
  const inc: string[] = [];
  if (shoeSizes.length) inc.push(`clip-in shoes in size${shoeSizes.length > 1 ? "s" : ""} ${listPhrase(shoeSizes)}`);
  inc.push(...accs);
  if (inc.length) s.push(`It includes ${listPhrase(inc)}.`);
  if (specs.length) s.push(`Key details include ${listPhrase(specs.slice(0, 5))}.`);
  if (realIssues.length) s.push(`Seller noted: ${listPhrase(realIssues)}.`);
  if (notes) s.push(notes.endsWith(".") ? notes : `${notes}.`);
  s.push("Every Commonplace order is inspected at pickup, delivered white-glove right to your door, and fully backed — you only pay after you've tested it at home. No meetups, no heavy lifting, no risk.");
  return s.join(" ");
}

const money2 = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Format a US phone as (XXX) XXX-XXXX progressively as the user types. */
export function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
/** Basic RFC-ish email validity. */
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/* ------------------------------------------------------------------ */
/* Category-specific photo + video recommendations                    */
/* ------------------------------------------------------------------ */
const PHOTO_RECS: { match: RegExp; shots: string[] }[] = [
  { match: /peloton|spin ?bike|indoor ?bike|exercise ?bike|\bbike\b/i, shots: ["Full side profile", "Screen powered on", "Resistance knob & flywheel", "Serial number plate", "Pedals (and shoes, if included)", "Any scratches or wear"] },
  { match: /tread|treadmill|nordic ?track|pro ?form/i, shots: ["Full side profile", "Console powered on", "Belt & deck close-up", "Incline / motor cover", "Serial number label", "Folded position (if it folds)"] },
  { match: /row|rower|hydrow|ergatta|concept ?2/i, shots: ["Full side view", "Monitor powered on", "Seat & rail", "Foot straps", "Serial / model label", "Any wear"] },
  { match: /tonal|home ?gym|strength|\brack\b|cable|smith|functional ?trainer|dumbbell/i, shots: ["Full front view", "Weight stack / arms", "Cables & attachments", "Mounting or base", "Model label", "Any wear"] },
  { match: /hot ?tub|jacuzzi|swim ?spa|\bspa\b|sauna|cold ?plunge|plunge|massage ?chair/i, shots: ["Full exterior", "Interior seats (drained)", "Control panel", "Jets close-up", "Cabinet corners", "Any cracks or wear"] },
  { match: /golf ?cart|\bcar\b|truck|\bsuv\b|\batv\b|scooter|\brv\b|vehicle|motorcycle|lawn ?mower|moped/i, shots: ["Front 3/4 view", "Rear 3/4 view", "Seats & interior", "Dashboard / controls", "Battery or engine bay", "Tires & undercarriage"] },
  { match: /refrigerator|fridge|washer|dryer|dishwasher|\brange\b|\boven|freezer|stove|appliance|microwave/i, shots: ["Front, doors closed", "Interior, doors open", "Model / serial label", "Controls close-up", "Both sides", "Any dents or scratches"] },
  // Upholstered / seating & beds — cushions matter.
  { match: /sofa|sectional|couch|loveseat|recliner|armchair|ottoman|futon|\bchair\b|\bbed\b|mattress|headboard/i, shots: ["Full front view", "Left & right sides", "Cushions removed", "Legs / base", "Any stains or wear", "Back panel"] },
  // Tables & case goods — no cushions; show surfaces, drawers, joints.
  { match: /dining|coffee ?table|\btable\b|\bdesk\b|dresser|bookshelf|cabinet|nightstand|sideboard|console|shelv|wardrobe|furniture/i, shots: ["Full view", "Top surface close-up", "Legs / base", "Drawers or doors open (if any)", "Any scratches, dents or wear", "Underside / joints"] },
];
const GENERIC_SHOTS = ["Full front view", "Full side view", "Close-up of controls or screen", "Model / serial label", "Any wear or damage", "What's included / accessories"];
function photoRecsFor(slug: string, name: string): string[] {
  const s = `${slug} ${name}`.toLowerCase();
  return PHOTO_RECS.find((p) => p.match.test(s))?.shots ?? GENERIC_SHOTS;
}

/* White question card — each question sits in its own clean white card. */
function SectionCard({ children }: { children: React.ReactNode }) {
  return <div style={css("background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:0 1px 3px rgba(60,10,35,.04)")}>{children}</div>;
}

/* Money input with a persistent "$" prefix (white box on the beige card). */
function MoneyInput({ value, onChange, placeholder = "0", ariaLabel }: { value: string; onChange: (v: string) => void; placeholder?: string; ariaLabel?: string }) {
  return (
    <div style={css("display:flex;align-items:center;gap:2px;width:100%;border:1.5px solid var(--line);background:#fff;border-radius:12px;padding:0 15px;box-sizing:border-box")}>
      <span style={css("color:var(--muted);font-size:15px;font-weight:600;flex:0 0 auto")}>$</span>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder={placeholder} aria-label={ariaLabel}
        style={css("flex:1;min-width:0;border:none;outline:none;background:transparent;padding:13px 0 13px 4px;font-size:15px;color:var(--ink);font-family:inherit")} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Auto-categorization                                                */
/* ------------------------------------------------------------------ */
/**
 * Map a free-typed product name to a category slug. High-confidence rules
 * (brand/keyword) come first; a full category-name match is also high
 * confidence. Anything weaker is returned as a low-confidence guess so we ask
 * the seller to confirm rather than guessing wrong.
 */
// Every slug on the right MUST exist in ALL_CATS (the categorizer guards against
// unknown slugs, so a typo here silently drops the item to "generic"). Order is
// most-specific first. Brand names are included because sellers type the brand,
// not the category ("subzero", "peloton", "sub-zero fridge", "wolf range").
const CAT_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  /* ---------------- Fitness ---------------- */
  [/peloton\b.*(bike ?\+|bike ?plus|\bplus\b)/i, "peloton-bike-plus"],
  [/peloton\b.*(tread ?\+|tread ?plus)/i, "peloton-tread-plus"],
  [/peloton\b.*tread/i, "peloton-tread"],
  [/peloton\b.*row/i, "peloton-row"],
  [/peloton/i, "peloton-bike-2nd-gen"],
  // Treadmill brands categorize as the parent "Treadmills" (the brand is captured
  // in the Brand field) so the listing uses the Treadmills category + its fees.
  [/nordic ?track/i, "treadmills"],
  [/pro ?form/i, "treadmills"],
  [/hydrow/i, "hydrow-pro-rowing-machine"],
  [/concept ?2|concept2/i, "concept2"],
  [/ergatta/i, "ergatta"],
  [/(assault|air) ?bike/i, "air-bike"],
  [/spin ?bike|indoor (cycling )?bike/i, "spin-bike"],
  [/recumbent/i, "recumbent-bike"],
  [/stair ?(climber|master|mill)/i, "stair-climber"],
  [/(rower|rowing machine|rowing)/i, "rower"],
  [/elliptical/i, "elliptical"],
  [/tread ?mill/i, "treadmills"],
  [/\btonal\b/i, "tonal"],
  [/smith machine/i, "smith-machine"],
  [/functional trainer|cable (machine|crossover)/i, "functional-trainer"],
  [/power rack/i, "power-rack"],
  [/squat rack/i, "squat-rack"],
  [/home gym|bow ?flex|total gym/i, "home-gym"],
  [/dumbbell|kettlebell|weight set|barbell|bumper plate/i, "adjustable-dumbbells"],
  /* ---------------- Wellness ---------------- */
  [/swim ?spa/i, "swim-spa"],
  [/(hot ?tub|jacuzzi|hot ?spring|\bspa\b(?! ?bike))/i, "hot-tubs"],
  [/sauna/i, "sauna"],
  [/(cold ?plunge|ice ?bath|plunge tub|chiller)/i, "cold-plunge"],
  [/massage chair/i, "massage-chair"],
  /* ---------------- Appliances (brand + keyword) ---------------- */
  // Sub-Zero only makes refrigeration → safe as a standalone brand.
  [/sub[ -]?zero/i, "refrigerators"],
  [/(refrigerator|fridge|freezer|ice ?maker|french ?door|side[ -]?by[ -]?side)/i, "refrigerators"],
  [/(washer|washing machine)/i, "washer"],
  [/\bdryer\b/i, "dryer"],
  [/dish ?washer/i, "dishwasher"],
  [/(range\b|oven|stove|cook ?top|wall oven|\bwolf\b|thermador|viking range)/i, "electric-range"],
  /* ---------------- Furniture ---------------- */
  [/sectional/i, "sectionals"],
  [/(sofa|couch|loveseat|settee)/i, "sofas"],
  [/(dining|kitchen) table/i, "dining-tables"],
  [/coffee table/i, "coffee-tables"],
  [/(standing |writing |computer )?desk/i, "desks"],
  [/(dresser|chest of drawers|bureau)/i, "dressers"],
  [/(book ?shelf|book ?case|shelving unit)/i, "bookshelves"],
  [/\blamp\b|floor lamp|table lamp/i, "lamps"],
  /* ---------------- Vehicles ---------------- */
  [/golf ?cart/i, "golf-carts"],
  [/(scooter|moped|vespa)/i, "scooters"],
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

  // 4) Typo-tolerant fallback (e.g. "ploton" → Peloton) — low confidence.
  const fz = fuzzyCategoryMatch(n);
  if (fz) return { slug: fz.cat.slug, confident: false };
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

/** Open "add photos from your phone" handoff session (see /api/sell/photo-session). */
interface PhonePhotoSession { code: string; token: string; link: string; qrSvg: string | null; smsSent: boolean }

/** Max photos a listing can carry (matches the phone upload cap). */
const MAX_PHOTOS = 12;

/* ================================================================== */
/* Component                                                          */
/* ================================================================== */
export function SellPage({ onDone, authed = true, onRequireAuth }: { onDone?: () => void; authed?: boolean; onRequireAuth?: (after: () => void) => void }) {
  const [mode, setMode] = useState<"margot" | "form">("form");
  const [catConfident, setCatConfident] = useState(true);
  const [catEditing, setCatEditing] = useState(false);
  const [catTouched, setCatTouched] = useState(false); // user manually chose a category
  const [catSearch, setCatSearch] = useState(""); // search box inside the Confirm-category popup
  const [catBrowseGroup, setCatBrowseGroup] = useState<string | null>(null); // drill-down: chosen department
  const [catBrowseParent, setCatBrowseParent] = useState<string | null>(null); // drill-down: chosen parent category (level 3)
  const [showExtras, setShowExtras] = useState(false); // reveal optional accessory/issue fields

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
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  // ---- "add photos from your phone" handoff (QR + link + live poll) ----
  const [puSession, setPuSession] = useState<PhonePhotoSession | null>(null);
  const [puBusy, setPuBusy] = useState(false);
  const [puError, setPuError] = useState<string | null>(null);
  const [puReceived, setPuReceived] = useState(0);
  const [puCopied, setPuCopied] = useState(false);
  const puImportedRef = useRef<Set<string>>(new Set());
  const aiFromPhotoRan = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [bannerOpen, setBannerOpen] = useState(true);

  // ---- live preview ----
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [aiTitle, setAiTitle] = useState("");
  const [aiDesc, setAiDesc] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ---- drafts ----
  const [drafts, setDrafts] = useState<Draft[]>([]);
  useEffect(() => { setDrafts(loadDrafts()); }, []);

  // Seller-funnel analytics — track where sellers reach / drop off in the flow.
  const firedSteps = useRef<Set<string>>(new Set());
  const fireStep = (step: string) => { if (!firedSteps.current.has(step)) { firedSteps.current.add(step); try { analytics.funnel("sell", step); } catch { /* ignore */ } } };
  useEffect(() => { try { analytics.funnel("sell", "opened"); } catch { /* ignore */ } }, []);
  useEffect(() => { if (title.trim().length >= 3) fireStep("named"); }, [title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the seller finishes typing what they're selling, pop the category
  // picker so they land in the right category (only when we can't confidently
  // guess it, and only once per distinct title).
  const autoOpenedFor = useRef<string>("");
  useEffect(() => {
    if (catTouched) return;
    const q = title.trim();
    if (q.length < 3 || autoOpenedFor.current === q) return;
    const t = setTimeout(() => {
      const { slug, confident } = categorizeName(q);
      if (!slug || !confident) { autoOpenedFor.current = q; setCatEditing(true); }
    }, 700);
    return () => clearTimeout(t);
  }, [title, catTouched]);

  const matched = ALL_CATS.find((c) => c.slug === catSlug);
  const spec = resolveSellSpec(catSlug || undefined);
  const toCents = (s: string) => Math.round((parseFloat(s.replace(/[^0-9.]/g, "")) || 0) * 100);
  const priceCents = toCents(price);
  const payout = priceCents > 0 ? previewPayout(priceCents, matched?.slug) : null;

  // Instant, always-current preview copy (AI upgrades it when it returns).
  const effectiveCond = cond || (typeof answers["condition"] === "string" ? (answers["condition"] as string) : "");
  const localTitle = composeTitle(title, matched?.name ?? "", effectiveCond, answers);
  const localDesc = composeDesc(title, matched?.name ?? "", effectiveCond, answers);
  const fileRef = useRef<HTMLInputElement>(null);
  const addPhoto = () => fileRef.current?.click();

  // Make the seller confirm the auto-guessed category: once they've named the
  // item and a category is guessed (but not yet confirmed), pop the confirm
  // modal shortly after they stop typing.
  const catPrompted = useRef(false);
  useEffect(() => {
    if (catPrompted.current) return;
    if (title.trim().length < 3 || !catSlug || catTouched) return;
    const t = setTimeout(() => { catPrompted.current = true; setCatEditing(true); }, 900);
    return () => clearTimeout(t);
  }, [title, catSlug, catTouched]);

  // Live AI title + description for the preview. Debounced, aborted on change,
  // and fully fail-soft — the preview always shows the typed name meanwhile.
  const answersKey = JSON.stringify(answers);
  useEffect(() => {
    // Instant: drop any prior AI copy so the preview falls back to the local
    // composer immediately (reflecting the just-changed condition/accessories),
    // then the AI upgrade lands ~1s later.
    setAiTitle(""); setAiDesc("");
    const name = title.trim();
    if (name.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: matched?.name || undefined,
            listingTitle: name,
            fields: { ...answers, condition: cond || undefined },
            location: pickup || undefined,
          }),
          signal: ctrl.signal,
        });
        const j = (await res.json()) as { title?: string; description?: string; error?: string };
        if (j?.title) setAiTitle(j.title);
        if (j?.description) setAiDesc(j.description);
      } catch {
        /* aborted or offline — preview falls back to the typed name */
      }
    }, 900);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, catSlug, cond, answersKey, pickup]);

  const setAns = (key: string, val: string | string[]) => setAnswers((p) => ({ ...p, [key]: val }));
  const toggleChip = (key: string, opt: string) =>
    setAnswers((p) => {
      const cur = Array.isArray(p[key]) ? (p[key] as string[]) : [];
      return { ...p, [key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });

  // Furniture (sofas, sectionals, chairs, …) also asks Material + Color as pills.
  const questions = (() => {
    const qs = [...spec.questions];
    const has = (k: string) => qs.some((q) => q.key === k);
    const inject = furnitureExtraFields(catSlug, matched?.name).filter((f) => !has(f.key));
    if (inject.length) {
      const idx = qs.findIndex((q) => /brand|maker/i.test(q.key) || /brand|maker/i.test(q.label));
      qs.splice(idx >= 0 ? idx + 1 : 0, 0, ...inject);
    }
    return qs;
  })();
  const visibleFields = questions.filter(
    (f) => (!f.showWhen || (Array.isArray(answers[f.showWhen.field]) && (answers[f.showWhen.field] as string[]).includes(f.showWhen.includes)))
      && !/serial/i.test(f.label) && !/serial/i.test(f.key), // drop serial-number clutter
  );
  // The generic Condition chips are hidden when the category already asks its own condition question.
  const hasOwnCondition = visibleFields.some((f) => /\bcondition\b|rides/i.test(f.label) || f.key === "condition");
  // Issues are MANDATORY, so they always stay in the primary section.
  const isIssueField = (f: Field) => /issue|damage/i.test(f.label) || f.key === "issues";
  // Progressive disclosure: tuck long optional lists (accessories, shoe size,
  // home environment) behind a "More details" toggle — but never the issues.
  const isExtraField = (f: Field) =>
    !isIssueField(f) &&
    (/accessor|shoe ?size|smoke|\bpet|dogs|cats|includes|what'?s included/i.test(f.label) ||
      (f.type === "chips" && (f.options?.length ?? 0) > 5));
  const primaryFields = visibleFields.filter((f) => !isExtraField(f));
  const extraFields = visibleFields.filter((f) => isExtraField(f));

  // Give plain "Brand / maker" fields popular brand pills + type-to-add.
  const augmentField = (f: Field): Field => {
    // Description → selling-point pills only (no free typing / no phone numbers).
    if (f.key === "description" || (f.type === "textarea" && /describe/i.test(f.label))) {
      return { ...f, label: "Selling points", type: "chips", options: DESCRIPTION_PILLS, allowCustom: false, required: false, help: "Pick any that apply — we write the full description for you." };
    }
    const isBrand = /brand|maker/i.test(f.key) || /brand|maker/i.test(f.label);
    if (isBrand && !f.brandModels && (!f.options || f.options.length === 0)) {
      const opts = brandOptionsFor(catSlug, matched?.name);
      if (opts.length) return { ...f, type: "radio", allowCustom: true, options: opts, help: f.help ?? "Pick a brand, or add your own." };
    }
    return f;
  };
  const issueField = visibleFields.find(isIssueField);
  const fieldAnswered = (f: Field) => {
    const v = answers[f.key];
    return Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim());
  };
  const issuesAnswered = !issueField || fieldAnswered(issueField);
  // Every primary field must be answered, except ones augmentField marks optional
  // (the pills-only "Selling points" description — we generate the copy).
  const missingPrimary = primaryFields.map(augmentField).filter((f) => f.required !== false && !fieldAnswered(f));
  const emailValid = isValidEmail(sellerEmail);
  const phoneValid = sellerPhone.replace(/\D/g, "").length === 10;

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
    Array.from(files).slice(0, MAX_PHOTOS).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || "");
        if (!url.startsWith("data:image/")) return;
        setPhotos((p) => (p.includes(url) ? p : [...p, url].slice(0, MAX_PHOTOS)));
        if (!aiFromPhotoRan.current && photos.length === 0) { aiFromPhotoRan.current = true; void fillFromPhoto(url); } // auto-AI on first photo
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---- "add photos from your phone" handoff ---- */
  async function openPhoneUpload() {
    if (puBusy || puSession) return;
    setPuBusy(true);
    setPuError(null);
    setPuCopied(false);
    try {
      const digits = sellerPhone.replace(/\D/g, "");
      const res = await fetch("/api/sell/photo-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(digits.length >= 10 ? { phone: digits } : {}),
      });
      if (!res.ok) { setPuError("Phone uploads are unavailable right now — please add photos here."); return; }
      const data = (await res.json()) as PhonePhotoSession & { ok?: boolean };
      if (!data?.code || !data?.token) { setPuError("Could not start a phone upload — please add photos here."); return; }
      setPuReceived(0);
      setPuSession({ code: data.code, token: data.token, link: data.link, qrSvg: data.qrSvg ?? null, smsSent: !!data.smsSent });
    } catch {
      setPuError("Could not start a phone upload — please add photos here.");
    } finally {
      setPuBusy(false);
    }
  }

  function closePhoneUpload() {
    setPuSession(null);
    setPuBusy(false);
    setPuCopied(false);
  }

  async function copyPhoneLink() {
    if (!puSession) return;
    try { await navigator.clipboard.writeText(puSession.link); setPuCopied(true); setTimeout(() => setPuCopied(false), 2000); } catch { /* ignore */ }
  }

  // Poll the handoff session for photos the phone uploads, merging them into the form.
  useEffect(() => {
    if (!puSession) return;
    let alive = true;
    const token = puSession.token;
    const tick = async () => {
      try {
        const res = await fetch(`/api/sell/photo-session?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as { photos?: unknown };
        if (!alive) return;
        const incoming = Array.isArray(data.photos) ? data.photos.filter((u): u is string => typeof u === "string") : [];
        const fresh = incoming.filter((u) => !puImportedRef.current.has(u));
        if (fresh.length === 0) return;
        let aiTarget: string | null = null;
        setPhotos((prev) => {
          const wasEmpty = prev.length === 0;
          const merged = [...prev];
          for (const u of fresh) {
            if (merged.length >= MAX_PHOTOS) break;
            if (!merged.includes(u)) { merged.push(u); puImportedRef.current.add(u); }
          }
          if (wasEmpty && merged.length > prev.length && !aiFromPhotoRan.current) aiTarget = merged[prev.length];
          return merged;
        });
        setPuReceived((n) => n + fresh.length);
        if (aiTarget) { aiFromPhotoRan.current = true; void fillFromPhoto(aiTarget); }
      } catch {
        /* transient — keep polling */
      }
    };
    void tick();
    const id = setInterval(tick, 2000);
    const stop = setTimeout(() => clearInterval(id), 5 * 60 * 1000); // match live: stop after 5 min
    return () => { alive = false; clearInterval(id); clearTimeout(stop); };
  }, [puSession]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    if (submitting) return;
    // Mandatory: confirmed category, every shown field, price, contact.
    if (!matched) { setFormError("Search and select a category for your item before submitting."); setCatEditing(true); return; }
    if (catSlug && !catTouched) { setFormError("Please confirm your category before submitting."); setCatEditing(true); return; }
    if (photos.length === 0) { setFormError("Add at least one photo of your item — photos are required to publish a listing."); return; }
    if (missingPrimary.length > 0) { setFormError(`Please complete: ${missingPrimary.map((f) => f.label).join(", ")}.`); return; }
    if (!hasOwnCondition && !cond) { setFormError("Please select the item's condition."); return; }
    if (priceCents <= 0) { setFormError("Add your asking price."); return; }
    if (!pickup.trim()) { setFormError("Add your pickup address so we can schedule collection."); return; }
    if (!phoneValid) { setFormError("Enter a valid 10-digit phone number so we can schedule pickup."); return; }
    if (!emailValid) { setFormError("Enter a valid email for your listing updates."); return; }
    setFormError(null);
    // Creating a listing requires an account — prompt sign-in/up at the very end,
    // then finish the submission automatically once they're authed.
    fireStep("submit");
    if (!authed && onRequireAuth) { onRequireAuth(() => { void doSubmit(); }); return; }
    void doSubmit();
  }

  async function doSubmit() {
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
        sellerContext: `Seller contact — phone: ${sellerPhone.trim()}, email: ${sellerEmail.trim()}`,
      });
      if (draftId) deleteDraft(draftId);
      setResult(res?.title || title.trim() || "Listing created");
      try { analytics.funnel("sell", "completed", { categorySlug: matched?.slug }); } catch { /* ignore */ }
    } catch {
      setResult("Your listing has been saved.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------------- Success ---------------- */
  if (result) {
    return (
      <div style={css("max-width:600px;margin:40px auto;padding:20px")}>
        <div style={css("text-align:center;margin-bottom:26px")}>
          <div style={css("width:64px;height:64px;margin:0 auto 18px;border-radius:50%;background:var(--greenBg);display:flex;align-items:center;justify-content:center")}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:30px;font-weight:600;margin-bottom:8px")}>Listing submitted</h1>
          <p style={css("font-size:15px;color:var(--muted)")}>&ldquo;{result}&rdquo;</p>
        </div>

        {/* How payment works */}
        <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:16px")}>
          <div style={css("display:flex;align-items:center;gap:8px;margin-bottom:8px")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--maroon)" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
            <div style={css("font-size:15px;font-weight:800")}>How you get paid</div>
          </div>
          <p style={css("font-size:13.5px;color:var(--muted);line-height:1.55")}>
            Once your item sells we schedule pickup. Upon inspection by our movers at pickup, we send you a payment link where you can accept payment by your choice of <b style={css("color:var(--ink)")}>bank transfer, Venmo, Cash App, or PayPal</b>.
          </p>
        </div>

        {/* Promote your listing (featured upsell) */}
        <div style={css("background:var(--yellowBg);border:1px solid #ecd9a3;border-radius:16px;padding:18px 20px;margin-bottom:16px")}>
          <div style={css("display:flex;align-items:center;gap:8px;margin-bottom:6px")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--gold)"><path d="M12 2l2.9 6.3L22 9l-5 4.6L18.2 22 12 18.3 5.8 22 7 13.6 2 9l7.1-.7L12 2z" /></svg>
            <div style={css("font-size:15px;font-weight:800")}>Promote your listing</div>
          </div>
          <p style={css("font-size:13.5px;color:#7a5a12;line-height:1.5;margin-bottom:12px")}>Feature it at the top of search and category pages to get <b>up to 3× more views</b> and sell faster.</p>
          <Hoverable as="button" onClick={() => { setResult(null); onDone?.(); }} styles={`background:var(--gold);color:#fff;border:none;border-radius:24px;padding:11px 22px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit`} hover="filter:brightness(1.06)">Feature this listing →</Hoverable>
        </div>

        {/* Estimated payout + fee breakdown (last) */}
        {payout && (
          <div style={css("background:var(--greenBg);border:1px solid #bfe0cd;border-radius:16px;padding:18px 20px;margin-bottom:24px")}>
            <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px")}>
              <div style={css("font-size:14px;color:#1f5c3d;font-weight:700")}>Your estimated payout</div>
              <div style={css("font-size:26px;font-weight:800;color:var(--green)")}>{money2(payout.payoutCents)}</div>
            </div>
            <div style={css("display:flex;flex-direction:column;gap:7px;font-size:13px;color:#1f5c3d;padding-top:12px;border-top:1px solid #bfe0cd")}>
              <div style={css("display:flex;justify-content:space-between")}><span>Sale price</span><span>{money2(payout.priceCents)}</span></div>
              <div style={css("display:flex;justify-content:space-between")}><span>Marketplace fee ({Math.round((payout.txnFeeCents / Math.max(1, payout.priceCents)) * 100)}%)</span><span>−{money2(payout.txnFeeCents)}</span></div>
              <div style={css("display:flex;justify-content:space-between")}><span>Pickup fee</span><span>{payout.pickupFeeCents > 0 ? `−${money2(payout.pickupFeeCents)}` : "FREE"}</span></div>
              <div style={css("display:flex;justify-content:space-between;font-weight:800;padding-top:7px;border-top:1px solid #bfe0cd")}><span>You receive</span><span>{money2(payout.payoutCents)}</span></div>
            </div>
          </div>
        )}

        <div style={css("display:flex;gap:10px;flex-wrap:wrap")}>
          <Hoverable as="button" onClick={() => { setResult(null); setTitle(""); setCatSlug(""); setCatTouched(false); setCond(""); setAnswers({}); setPrice(""); setOrigPrice(""); setFloorPrice(""); setPhotos([]); setPickup(""); setSellerPhone(""); setSellerEmail(""); setDraftId(""); setShowBreakdown(false); closePhoneUpload(); puImportedRef.current = new Set(); aiFromPhotoRan.current = false; setPuReceived(0); setPuError(null); setMode("form"); }}
            styles={`background:${PLUM};color:#fff;border:none;border-radius:30px;padding:13px 28px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit`} hover="filter:brightness(1.08)">List another item</Hoverable>
          {onDone && <Hoverable as="button" onClick={onDone} styles="background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:30px;padding:13px 24px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit" hover="border:1px solid #d9b7c2">Back to marketplace</Hoverable>}
        </div>
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
    <div style={css("max-width:1200px;margin:0 auto;padding:22px 22px 90px")}>
      {/* Back to marketplace */}
      <Hoverable as="span" onClick={() => { persistDraft(); onDone?.(); }} styles="display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:600;color:var(--muted);cursor:pointer;margin-bottom:16px" hover="color:var(--ink)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>Back
      </Hoverable>

      <div data-sell-grid style={css("display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:30px;align-items:start")}>
        {/* ==================== LEFT: the form ==================== */}
        <div style={css("min-width:0")}>

      {/* AI concierge banner */}
      {bannerOpen && (
        <div style={css("display:flex;align-items:center;gap:14px;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:20px")}>
          <div style={css(`width:38px;height:38px;flex:0 0 auto;border-radius:50%;background:${PLUM};display:flex;align-items:center;justify-content:center`)}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" /></svg>
          </div>
          <div style={css("flex:1;min-width:0")}>
            <div style={css("font-size:14.5px;font-weight:700;color:var(--ink)")}>Try our new AI listing concierge.</div>
            <div style={css("font-size:13px;color:var(--muted)")}>Describe your item and Margot builds the whole listing with you.</div>
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
        {/* Item name — reveals the rest of the form */}
        <SectionCard>
          <FieldLabel label="What are you selling?" help="Just name the item — our AI writes the polished title and description for your listing." />
          <input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="e.g. Peloton Bike+, Sub-Zero fridge, leather sofa…" style={css(FIELD)} />
        </SectionCard>

        {!started && (
          <div style={css("font-size:13.5px;color:var(--muted);display:flex;align-items:center;gap:7px;padding:2px 2px 6px")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
            Name your item above and the rest of the form appears.
          </div>
        )}

        {started && (<>{/* ---- details ---- */}

          {/* Photos — add early; also clickable from the live preview */}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => { onPhotoPick(e.target.files); e.currentTarget.value = ""; }} style={css("display:none")} />
          <SectionCard>
            <FieldLabel label="Photos" required help="Required — add a few clear photos, or grab a link to upload straight from your phone." />
            <div style={css("display:flex;gap:10px;flex-wrap:wrap")}>
              {photos.map((p, i) => (
                <div key={i} style={css("position:relative;width:84px;height:84px;border-radius:12px;overflow:hidden;border:1px solid var(--line);flex:0 0 auto")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" style={css("width:100%;height:100%;object-fit:cover")} />
                  <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove photo"
                    style={css("position:absolute;top:3px;right:3px;width:20px;height:20px;border:none;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:13px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center")}>×</button>
                </div>
              ))}
              <Hoverable as="button" onClick={addPhoto} styles="width:84px;height:84px;flex:0 0 auto;border:1.5px dashed var(--line);border-radius:12px;background:var(--paper);color:var(--blueInk);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:700" hover="border:1.5px dashed var(--blueInk);background:var(--blueBg)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add
              </Hoverable>
              {aiBusy && <span style={css("align-self:center;font-size:12px;color:var(--muted)")}>Reading photo…</span>}
            </div>

            {/* Phone-upload handoff trigger */}
            <Hoverable as="button" onClick={openPhoneUpload} styles="margin-top:12px;display:inline-flex;align-items:center;gap:7px;background:none;border:none;padding:0;color:var(--blueInk);font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer" hover="text-decoration:underline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.4" /><path d="M11 18h2" /></svg>
              {puBusy ? "Preparing your link…" : "Get a link to upload from your phone"}
            </Hoverable>
            {puError && <div style={css("margin-top:8px;font-size:12.5px;color:var(--red)")}>{puError}</div>}

            {/* Phone-upload modal */}
            {puSession && (
              <div onClick={closePhoneUpload} style={css("position:fixed;inset:0;z-index:60;background:rgba(20,15,18,.55);display:flex;align-items:center;justify-content:center;padding:20px")}>
                <div onClick={(e) => e.stopPropagation()} style={css("background:var(--cream);border-radius:20px;max-width:420px;width:100%;padding:26px 24px 22px;box-shadow:0 24px 60px rgba(0,0,0,.35);max-height:90vh;overflow-y:auto")}>
                  <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:4px")}>
                    <h3 style={css("font-family:'Reckless','Newsreader',serif;font-size:21px;font-weight:600;margin:0")}>Upload from your phone</h3>
                    <button type="button" onClick={closePhoneUpload} aria-label="Close" style={css("width:30px;height:30px;border:none;border-radius:50%;background:var(--putty);color:var(--ink);font-size:17px;line-height:1;cursor:pointer")}>×</button>
                  </div>

                  {puReceived === 0 ? (
                    <>
                      <p style={css("font-size:13.5px;color:var(--muted);line-height:1.5;margin:4px 0 16px")}>Scan this QR code with your phone to continue uploading photos:</p>
                      {puSession.qrSvg && (
                        <div style={css("display:flex;justify-content:center;margin-bottom:16px")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={puSession.qrSvg} alt="QR code to upload photos" style={css("width:190px;height:190px;border-radius:14px;border:1px solid var(--line);background:#fff;padding:8px")} />
                        </div>
                      )}
                      <div style={css("font-size:12.5px;color:var(--muted);margin-bottom:6px")}>Or open this link on your phone:</div>
                      <div style={css("display:flex;gap:8px;margin-bottom:14px")}>
                        <input readOnly value={puSession.link} onFocus={(e) => e.currentTarget.select()} style={css("flex:1;min-width:0;border:1px solid var(--line);border-radius:10px;padding:9px 11px;font-size:12.5px;font-family:inherit;background:var(--paper);color:var(--ink)")} />
                        <Hoverable as="button" onClick={copyPhoneLink} styles={`flex:0 0 auto;border:1px solid var(--line);border-radius:10px;padding:9px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;background:var(--paper);color:${PLUM}`} hover="border-color:#d9b7c2">{puCopied ? "Copied ✓" : "Copy"}</Hoverable>
                      </div>
                      {puSession.smsSent
                        ? <div style={css("font-size:12.5px;color:var(--green);font-weight:600;margin-bottom:16px")}>✓ We also texted the link to your phone.</div>
                        : <div style={css("font-size:12px;color:var(--muted);margin-bottom:16px")}>Tip: add your phone number below and reopen this to have the link texted to you.</div>}
                      <div style={css("display:flex;align-items:center;gap:9px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:13px")}>
                        <span style={css("width:15px;height:15px;border:2px solid var(--line);border-top-color:var(--maroon);border-radius:50%;display:inline-block;animation:spin 0.8s linear infinite")} />
                        Waiting for photos from your phone…
                      </div>
                    </>
                  ) : (
                    <div style={css("text-align:center;padding:14px 0 6px")}>
                      <div style={css("width:52px;height:52px;margin:0 auto 12px;border-radius:50%;background:var(--greenBg);display:flex;align-items:center;justify-content:center")}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </div>
                      <div style={css("font-size:16px;font-weight:800;margin-bottom:4px")}>{puReceived} photo{puReceived === 1 ? "" : "s"} received</div>
                      <p style={css("font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:18px")}>They&rsquo;ve been added to your listing. Keep uploading from your phone, or tap Done.</p>
                      <Hoverable as="button" onClick={closePhoneUpload} styles={`background:${PLUM};color:#fff;border:none;border-radius:26px;padding:11px 30px;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit`} hover="filter:brightness(1.08)">Done</Hoverable>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Category-specific recommended shots + how-to video */}
            {matched && (() => {
              const shots = photoRecsFor(catSlug, matched.name);
              return (
                <div style={css("margin-top:16px;padding-top:14px;border-top:1px solid var(--line)")}>
                  <div style={css("font-size:11.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:10px")}>Recommended shots for {matched.name} <span style={css("color:var(--blueInk)")}>({shots.length})</span></div>
                  <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:9px")}>
                    {shots.map((shot, i) => {
                      const done = photos.length > i;
                      return (
                        <div key={shot} style={css("display:flex;align-items:center;gap:8px")}>
                          <span style={sx("width:26px;height:26px;flex:0 0 auto;border-radius:7px;display:flex;align-items:center;justify-content:center", done ? { background: "var(--greenBg)", color: "var(--green)" } : { background: "var(--putty)", color: "var(--muted)" })}>
                            {done
                              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>}
                          </span>
                          <span style={css("font-size:12.5px;color:var(--ink)")}>{shot}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </SectionCard>

          {/* Category — auto-assigned from the title; confirm/change via popup */}
          <SectionCard>
            <FieldLabel label="Category" required={!matched} help={!matched ? "Required — search and pick the category that fits your item." : !catConfident ? "We guessed this from your title — confirm it or tap Change." : undefined} />
            <div style={css("display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
              <span onClick={() => !matched && setCatEditing(true)} style={sx("display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:20px;font-size:13.5px;font-weight:700", matched ? { background: "#F4E7EA", color: PLUM } : { background: "#FBEAE7", color: "var(--red)", cursor: "pointer" }, !catConfident && matched && "box-shadow:0 0 0 2px #E9B355")}>
                {matched ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M20 6 9 17l-5-5" /></svg>{matched.name}</>
                ) : "No category yet — tap to choose"}
              </span>
              <Hoverable as="span" onClick={() => setCatEditing((v) => !v)} styles="font-size:13px;font-weight:700;color:var(--blueInk);cursor:pointer" hover="text-decoration:underline">{catEditing ? "Close" : matched ? "Change" : "Search categories"}</Hoverable>
            </div>
            {catEditing && (() => {
              const q = catSearch.trim().toLowerCase();
              const t = title.toLowerCase();
              const words = t.split(/[^a-z0-9+]+/).filter((w) => w.length > 2);
              // Parent groupings / brand subcategories that shouldn't be picked as a sell
              // category (roll up to the real parent, e.g. NordicTrack → Treadmills).
              const EXCLUDE = new Set(["peloton", "nordictrack-treadmill", "proform-treadmill"]);
              const sellable = (c: { slug: string }) => !EXCLUDE.has(c.slug);
              const dedupe = (arr: typeof ALL_CATS) => arr.filter((c, i, a) => a.findIndex((x) => x.slug === c.slug) === i);
              // Brand/keyword mapping first (e.g. "subzero" → Refrigerators), then title-word matches.
              const guessedSlug = categorizeName(title).slug;
              const guessed = guessedSlug ? ALL_CATS.find((c) => c.slug === guessedSlug) : undefined;
              const suggestions = dedupe([
                ...(guessed && sellable(guessed) ? [guessed] : []),
                ...ALL_CATS.filter((c) => {
                  if (!sellable(c)) return false;
                  const cn = c.name.toLowerCase();
                  return words.some((w) => cn.includes(w)) || cn.split(/\s+/).some((cw) => cw.length > 2 && t.includes(cw));
                }),
              ]);
              let searchList: typeof ALL_CATS = [];
              if (q) {
                searchList = ALL_CATS.filter((c) => sellable(c) && c.name.toLowerCase().includes(q));
                if (searchList.length === 0) { const fz = fuzzyCategoryMatch(q); if (fz && sellable(fz.cat)) searchList = [fz.cat]; }
                searchList = dedupe(searchList);
              }
              const close = () => { setCatEditing(false); setCatSearch(""); setCatBrowseGroup(null); setCatBrowseParent(null); };
              const pick = (slug: string) => { setCatSlug(slug); setCatConfident(true); setCatTouched(true); close(); fireStep("category"); };
              // Browse hierarchy mirrors the browse page: department → category → subcategory.
              const group = catBrowseGroup ? CAT_GROUPS.find((g) => g.name === catBrowseGroup) : null;
              const level2 = group ? group.items : [];
              const parentItem = group && catBrowseParent ? (group.items.find((i) => i.slug === catBrowseParent) ?? null) : null;
              const level3 = parentItem ? dedupe([...(sellable(parentItem) ? [parentItem] : []), ...((parentItem.children ?? []).filter(sellable))]) : [];
              const chip = (it: { slug: string; name: string }) => (
                <div key={it.slug} onClick={() => pick(it.slug)}
                  style={sx("padding:9px 15px;border-radius:18px;font-size:13.5px;font-weight:600;cursor:pointer;transition:all .14s", it.slug === catSlug ? CHIP_ON : CHIP_OFF)}>{it.name}</div>
              );
              return (
                <div onClick={close} style={css("position:fixed;inset:0;background:rgba(30,10,25,.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px")}>
                  <div onClick={(e) => e.stopPropagation()} style={css("background:#fff;border-radius:18px;padding:22px 24px;max-width:480px;width:100%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 30px 70px rgba(60,10,35,.3)")}>
                    <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:4px")}>
                      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:21px;font-weight:600")}>Choose a category</div>
                      <span onClick={close} style={css("cursor:pointer;color:var(--muted);font-size:24px;line-height:1")}>×</span>
                    </div>
                    <p style={css("font-size:13px;color:var(--muted);margin-bottom:14px")}>Search, or browse by department, and pick the closest match so we price and inspect it correctly.</p>
                    <div style={css("display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:14px")}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                      <input autoFocus value={catSearch} onChange={(e) => { setCatSearch(e.target.value); setCatBrowseGroup(null); }} placeholder="Search categories…" style={css("flex:1;border:none;outline:none;font-size:14px;color:var(--ink);background:transparent;font-family:inherit")} />
                    </div>

                    {q ? (
                      /* --- Search results --- */
                      <div style={css("overflow-y:auto;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start")}>
                        {searchList.length > 0 ? searchList.map(chip)
                          : <div style={css("font-size:13px;color:var(--muted);padding:8px 2px")}>No category matches &ldquo;{catSearch}&rdquo;. Try a different word, or browse by department below.</div>}
                      </div>
                    ) : parentItem ? (
                      /* --- Level 3: subcategories of the chosen category (pills) --- */
                      <div style={css("overflow-y:auto")}>
                        <div onClick={() => setCatBrowseParent(null)} style={css("display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:var(--blueInk);cursor:pointer;margin-bottom:12px")}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>{group?.name}
                        </div>
                        <div style={css("font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:8px")}>{parentItem.name}</div>
                        <div style={css("display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start")}>{level3.map(chip)}</div>
                      </div>
                    ) : catBrowseGroup ? (
                      /* --- Level 2: categories in the department (parents drill, leaves pick) --- */
                      <div style={css("overflow-y:auto")}>
                        <div onClick={() => setCatBrowseGroup(null)} style={css("display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:var(--blueInk);cursor:pointer;margin-bottom:12px")}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>All departments
                        </div>
                        <div style={css("font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:8px")}>{catBrowseGroup}</div>
                        <div style={css("display:flex;flex-direction:column;gap:8px")}>
                          {level2.map((it) => {
                            const hasKids = !!it.children?.length;
                            const on = it.slug === catSlug;
                            return (
                              <div key={it.slug} onClick={() => (hasKids ? setCatBrowseParent(it.slug) : pick(it.slug))}
                                style={sx("display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 14px;border-radius:12px;cursor:pointer;transition:all .14s", on ? { border: "1px solid var(--maroon)", background: "#F4E7EA" } : { border: "1px solid var(--line)", background: "var(--paper)" })}>
                                <span style={css("font-size:14px;font-weight:600;color:var(--ink)")}>{it.name}</span>
                                {hasKids && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* --- Default: suggestions (if any) + browse-by-department --- */
                      <div style={css("overflow-y:auto")}>
                        {suggestions.length > 0 && (
                          <>
                            <div style={css("font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:8px")}>Suggested</div>
                            <div style={css("display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px")}>{suggestions.map(chip)}</div>
                          </>
                        )}
                        <div style={css("font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:8px")}>Browse by department</div>
                        <div style={css("display:flex;flex-direction:column;gap:8px")}>
                          {CAT_GROUPS.map((g) => (
                            <div key={g.name} onClick={() => setCatBrowseGroup(g.name)}
                              style={css("display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;cursor:pointer;transition:all .14s")}>
                              <span style={css("display:flex;align-items:center;gap:10px")}>
                                <span style={sx("width:30px;height:30px;flex:0 0 auto;border-radius:8px;display:flex;align-items:center;justify-content:center", { background: g.bg, color: g.fg })}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d={g.iconPath} /></svg>
                                </span>
                                <span style={css("font-size:14px;font-weight:700;color:var(--ink)")}>{g.name}</span>
                              </span>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </SectionCard>

          {/* Category-specific ACF fields — each in its own card; nothing shown is optional */}
          {primaryFields.map((f) => (
            <SectionCard key={f.key}>
              {isIssueField(f)
                ? <IssuesField f={f} val={answers[f.key]} setAns={setAns} />
                : <FieldRenderer f={augmentField(f)} val={answers[f.key]} setAns={setAns} toggleChip={toggleChip} answers={answers} required />}
            </SectionCard>
          ))}
          {extraFields.length > 0 && (
            <SectionCard>
              <Hoverable as="button" onClick={() => setShowExtras((v) => !v)} styles="display:flex;align-items:center;gap:8px;background:transparent;border:none;color:var(--maroon);font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;padding:2px 0" hover="filter:brightness(1.12)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" style={sx("transition:transform .2s", { transform: showExtras ? "rotate(45deg)" : "none" })}><path d="M12 5v14M5 12h14" /></svg>
                {showExtras ? "Hide extra details" : "Add accessories & condition notes (optional)"}
              </Hoverable>
              {showExtras && (
                <div style={css("display:flex;flex-direction:column;gap:18px;margin-top:16px;padding-top:16px;border-top:1px solid var(--line)")}>
                  {extraFields.map((f) => (
                    <FieldRenderer key={f.key} f={augmentField(f)} val={answers[f.key]} setAns={setAns} toggleChip={toggleChip} answers={answers} />
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* Condition — only when the category doesn't already ask its own */}
          {!hasOwnCondition && (
            <SectionCard>
              <FieldLabel label="Condition" />
              <div style={css("display:flex;flex-wrap:wrap;gap:7px")}>
                {CONDITIONS.map((c) => {
                  const on = cond === c.label;
                  return (
                    <div key={c.key} onClick={() => setCond(c.label)} style={sx("padding:8px 14px;border-radius:18px;font-size:13px;font-weight:600;cursor:pointer;transition:all .14s", on ? CHIP_ON : CHIP_OFF)}>{c.label}</div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Price — Your price + Floor price paired; Original retail below (swapped) */}
          <SectionCard>
            <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start")}>
              {/* Left: Your price → Original retail */}
              <div style={css("display:flex;flex-direction:column;gap:16px")}>
                <div>
                  <FieldLabel label="Your price" />
                  <MoneyInput value={price} onChange={setPrice} ariaLabel="Your price" />
                </div>
                <div>
                  <div style={css("margin-bottom:7px")}>
                    <span style={css("font-size:13px;font-weight:700;color:var(--ink)")}>Original retail </span>
                    <span style={css("font-size:12px;font-weight:500;color:var(--muted)")}>(optional)</span>
                  </div>
                  <MoneyInput value={origPrice} onChange={setOrigPrice} ariaLabel="Original retail" />
                </div>
              </div>
              {/* Right: Floor price + description */}
              <div>
                <div style={css("margin-bottom:7px")}>
                  <span style={css("font-size:13px;font-weight:700;color:var(--ink)")}>Floor price </span>
                  <span style={css("font-size:12px;font-weight:500;color:var(--muted)")}>(private)</span>
                </div>
                <MoneyInput value={floorPrice} onChange={setFloorPrice} ariaLabel="Floor price" />
                <div style={css("font-size:12.5px;color:#5A504A;line-height:1.45;margin-top:8px")}>The lowest you&apos;ll accept — <b style={css("color:var(--ink)")}>never shown to buyers</b>. Offers at or above it can auto-accept.</div>
              </div>
            </div>

            {/* Payout + fee breakdown */}
            {payout && (
              <div style={css("margin-top:14px;background:var(--greenBg);border:1px solid #bfe0cd;border-radius:12px;padding:13px 15px")}>
                <div style={css("display:flex;align-items:center;justify-content:space-between;gap:12px")}>
                  <div style={css("font-size:13.5px;color:#1f5c3d;font-weight:700")}>Your estimated payout</div>
                  <div style={css("font-size:20px;font-weight:800;color:var(--green)")}>{money2(payout.payoutCents)}</div>
                </div>
                <button type="button" onClick={() => setShowBreakdown((v) => !v)} style={css("background:none;border:none;color:#1f5c3d;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;padding:7px 0 0;display:inline-flex;align-items:center;gap:5px")}>
                  {showBreakdown ? "Hide" : "See"} fee breakdown
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} style={sx("transition:transform .2s", { transform: showBreakdown ? "rotate(180deg)" : "none" })}><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {showBreakdown && (
                  <div style={css("margin-top:10px;padding-top:10px;border-top:1px solid #bfe0cd;display:flex;flex-direction:column;gap:7px;font-size:12.5px;color:#1f5c3d")}>
                    <div style={css("display:flex;justify-content:space-between")}><span>Sale price</span><span>{money2(payout.priceCents)}</span></div>
                    <div style={css("display:flex;justify-content:space-between")}><span>Marketplace fee ({Math.round((payout.txnFeeCents / Math.max(1, payout.priceCents)) * 100)}%)</span><span>−{money2(payout.txnFeeCents)}</span></div>
                    <div style={css("display:flex;justify-content:space-between")}><span>Pickup fee</span><span>{payout.pickupFeeCents > 0 ? `−${money2(payout.pickupFeeCents)}` : "FREE"}</span></div>
                    <div style={css("display:flex;justify-content:space-between;font-weight:800;padding-top:6px;border-top:1px solid #bfe0cd")}><span>You receive</span><span>{money2(payout.payoutCents)}</span></div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Pickup */}
          <SectionCard>
            <FieldLabel label="Pickup address" help="Where we collect the item. Only shared with the delivery team." required />
            <AddressAutocomplete value={pickup} onChange={setPickup} onSelect={(sel) => setPickup(sel.formatted)} placeholder="Start typing your address…" />
          </SectionCard>

          {/* Contact — required so we can schedule pickup and send the payment link */}
          <SectionCard>
            <FieldLabel label="Your contact" help="Required — how we reach you to schedule pickup and send your payment link. Never shown to buyers." required />
            <div style={css("display:grid;grid-template-columns:1fr 1fr;gap:12px")}>
              <div>
                <input value={sellerPhone} onChange={(e) => setSellerPhone(formatPhone(e.target.value))} inputMode="tel" placeholder="(555) 555-5555" aria-label="Phone number"
                  style={sx("width:100%;box-sizing:border-box;background:#fff;border-radius:12px;padding:13px 15px;font-size:15px;color:var(--ink);outline:none;font-family:inherit", { border: `1.5px solid ${sellerPhone && !phoneValid ? "var(--red)" : "var(--line)"}` })} />
                {sellerPhone && !phoneValid && <div style={css("font-size:11px;color:var(--red);margin-top:4px")}>Enter a 10-digit number</div>}
              </div>
              <div style={css("position:relative")}>
                <input value={sellerEmail} onChange={(e) => setSellerEmail(e.target.value)} inputMode="email" placeholder="Email address" aria-label="Email address"
                  style={sx("width:100%;box-sizing:border-box;background:#fff;border-radius:12px;padding:13px 34px 13px 15px;font-size:15px;color:var(--ink);outline:none;font-family:inherit", { border: `1.5px solid ${sellerEmail && !emailValid ? "var(--red)" : emailValid ? "var(--green)" : "var(--line)"}` })} />
                {emailValid && <span style={css("position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--green)")}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>}
                {sellerEmail && !emailValid && <div style={css("font-size:11px;color:var(--red);margin-top:4px")}>Enter a valid email</div>}
              </div>
            </div>
          </SectionCard>

          {formError && (
            <div style={css("background:#fbeae7;border:1px solid #e7b5ab;color:#a33b28;border-radius:12px;padding:12px 15px;font-size:13.5px;font-weight:600")}>{formError}</div>
          )}

          <Hoverable as="button" onClick={handleSubmit}
            styles={`width:100%;background:${PLUM};color:#fff;border:none;border-radius:30px;padding:15px;font-size:16px;font-weight:600;cursor:${submitting ? "default" : "pointer"};font-family:inherit;opacity:${submitting ? ".7" : "1"}`} hover="filter:brightness(1.08)">
            {submitting ? "Submitting…" : "Submit listing"}
          </Hoverable>
        </>)}
      </div>
        </div>{/* ==================== end LEFT ==================== */}

        {/* ==================== RIGHT: live listing preview ==================== */}
        <div data-sell-preview style={css("position:sticky;top:16px;min-width:0")}>
          <div style={css("display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px")}>
            <div style={css("font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)")}>Live preview</div>
            <div style={css("display:inline-flex;background:var(--putty);border:1px solid var(--line);border-radius:999px;padding:3px")}>
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setPreviewDevice(d)}
                  style={sx("display:inline-flex;align-items:center;gap:5px;border:none;border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;text-transform:capitalize",
                    previewDevice === d ? { background: PLUM, color: "#fff" } : { background: "transparent", color: "var(--muted)" })}>
                  {d === "desktop"
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></svg>}
                  {d}
                </button>
              ))}
            </div>
          </div>
          <ListingPreview
            device={previewDevice}
            title={aiTitle || localTitle}
            priceCents={priceCents}
            retailCents={origPrice ? toCents(origPrice) : 0}
            condition={effectiveCond}
            categoryName={matched?.name ?? "Marketplace"}
            location={pickup}
            description={aiDesc || localDesc}
            photo={photos[0]}
            onAddPhoto={addPhoto}
          />
          {aiTitle && (
            <div style={css("display:flex;align-items:center;gap:6px;justify-content:center;margin-top:10px;font-size:11.5px;color:var(--muted)")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={PLUM}><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" /></svg>
              Title &amp; description polished by AI
            </div>
          )}
        </div>
      </div>{/* ==================== end grid ==================== */}

      <style>{"@media(max-width:900px){[data-sell-grid]{grid-template-columns:1fr!important}[data-sell-preview]{position:static!important;margin-top:8px}}"}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field helpers                                                      */
/* ------------------------------------------------------------------ */
function FieldLabel({ label, help, required }: { label: string; help?: string; required?: boolean }) {
  return (
    <div style={css("margin-bottom:7px")}>
      <div style={css("font-size:13px;font-weight:700;color:var(--ink)")}>{label}{required && <span style={css("color:var(--red);margin-left:3px")}>*</span>}</div>
      {help && <div style={css("font-size:11.5px;color:var(--muted);line-height:1.4;margin-top:2px")}>{help}</div>}
    </div>
  );
}

function FieldRenderer({ f, val, setAns, toggleChip, required, answers }: {
  f: Field; val: string | string[] | undefined;
  setAns: (k: string, v: string | string[]) => void;
  toggleChip: (k: string, o: string) => void;
  required?: boolean;
  answers?: Record<string, string | string[]>;
}) {
  if (f.type === "textarea") {
    return (<div><FieldLabel label={f.label} help={f.help} required={required} /><textarea value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} placeholder={f.placeholder} rows={3} style={sx(FIELD, "resize:vertical;line-height:1.45")} /></div>);
  }
  if (f.type === "dimensions") {
    return <DimensionsField f={f} val={val as string | undefined} setAns={setAns} required={required} />;
  }
  if (f.type === "select") {
    return (<div><FieldLabel label={f.label} help={f.help} required={required} /><select value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} style={sx(FIELD, "cursor:pointer")}><option value="">Select…</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>);
  }
  if (f.type === "radio" || f.type === "chips") {
    return <PillField f={f} val={val} setAns={setAns} toggleChip={toggleChip} required={required} answers={answers} />;
  }
  return (<div><FieldLabel label={f.label} help={f.help} required={required} /><input value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} inputMode={f.type === "number" ? "numeric" : undefined} placeholder={f.placeholder} style={css(FIELD)} /></div>);
}

/* Pill picker with optional "Other…" free-text entry and brand→model options. */
function PillField({ f, val, setAns, toggleChip, required, answers }: {
  f: Field; val: string | string[] | undefined;
  setAns: (k: string, v: string | string[]) => void;
  toggleChip: (k: string, o: string) => void;
  required?: boolean;
  answers?: Record<string, string | string[]>;
}) {
  const multi = f.type === "chips";
  const selected = multi ? (Array.isArray(val) ? val : []) : (val as string | undefined);

  // Model-from-brand: options come from the selected brand's model list.
  let options = f.options ?? [];
  let noBrand = false;
  if (f.brandModels) {
    const brand = (answers?.[f.brandKey ?? "brand"] as string) || "";
    options = brand ? (f.brandModels[brand] ?? []) : [];
    noBrand = !brand;
  }

  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  // Custom (typed) values not in the option list — shown as removable chips.
  const customVals = multi
    ? (selected as string[]).filter((v) => !options.includes(v))
    : (typeof selected === "string" && !!selected && !options.includes(selected) ? [selected] : []);

  if (noBrand) {
    return (
      <div><FieldLabel label={f.label} help={f.help ?? "Pick the brand first to see models."} required={required} />
        <input value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} placeholder="Model" style={css(FIELD)} />
      </div>
    );
  }

  const count = multi ? (selected as string[]).length : 0;
  const help = f.help ?? (multi ? "Select all that apply." : f.allowCustom ? "Pick one, or add your own." : undefined);
  const commitCustom = () => {
    const v = customText.trim();
    if (!v) { setCustomOpen(false); return; }
    if (multi) { const arr = selected as string[]; if (!arr.includes(v)) setAns(f.key, [...arr, v]); }
    else setAns(f.key, v);
    setCustomOpen(false); setCustomText("");
  };

  return (
    <div><FieldLabel label={multi && count > 0 ? `${f.label} · ${count} selected` : f.label} help={help} required={required} />
      <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
        {options.map((o) => {
          const on = multi ? (selected as string[]).includes(o) : selected === o;
          return (
            <Hoverable as="div" key={o} onClick={() => (multi ? toggleChip(f.key, o) : setAns(f.key, o))}
              styles={sx("display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:20px;font-size:13.5px;font-weight:600;cursor:pointer;transition:all .14s;user-select:none", on ? CHIP_ON : CHIP_OFF)}
              hover={on ? "filter:brightness(1.03)" : "background:var(--putty)"}>
              {multi && (
                <span style={sx("width:16px;height:16px;flex:0 0 auto;border-radius:5px;display:flex;align-items:center;justify-content:center;transition:all .14s", on ? { background: "var(--blueInk)", border: "1px solid var(--blueInk)" } : { background: "var(--paper)", border: "1.5px solid var(--line)" })}>
                  {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                </span>
              )}
              {o}
            </Hoverable>
          );
        })}
        {/* Custom (typed) values shown as removable selected pills. */}
        {customVals.map((cv) => (
          <Hoverable as="div" key={cv} onClick={() => (multi ? toggleChip(f.key, cv) : setAns(f.key, ""))} styles={sx("display:inline-flex;align-items:center;gap:6px;padding:9px 15px;border-radius:20px;font-size:13.5px;font-weight:600;cursor:pointer", CHIP_ON)} hover="filter:brightness(1.03)">
            {cv}
            <span style={css("opacity:.7")}>×</span>
          </Hoverable>
        ))}
        {/* "Other…" reveal */}
        {f.allowCustom && !customOpen && (
          <Hoverable as="div" onClick={() => setCustomOpen(true)} styles={sx("padding:9px 15px;border-radius:20px;font-size:13.5px;font-weight:600;cursor:pointer;border:1px dashed var(--line);background:var(--paper);color:var(--muted)")} hover="border-color:var(--blueInk);color:var(--blueInk)">+ Other</Hoverable>
        )}
      </div>
      {f.allowCustom && customOpen && (
        <div style={css("display:flex;gap:8px;margin-top:8px")}>
          <input autoFocus value={customText} onChange={(e) => setCustomText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitCustom(); } if (e.key === "Escape") setCustomOpen(false); }} placeholder={`Add ${f.label.toLowerCase()}…`} style={sx(FIELD, "flex:1")} />
          <Hoverable as="button" type="button" onClick={commitCustom} styles={sx("border:none;border-radius:12px;padding:0 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:#fff", { background: PLUM })} hover="filter:brightness(1.08)">Add</Hoverable>
        </div>
      )}
    </div>
  );
}

/* Dimensions & weight as four separate type-in metrics (Length / Height / Width /
   Weight). The four values are combined into one "L × W × H in, W lb" answer. */
function DimensionsField({ f, val, setAns, required }: { f: Field; val: string | undefined; setAns: (k: string, v: string | string[]) => void; required?: boolean }) {
  const parse = (v: string | undefined) => {
    const m = (v ?? "").match(/([\d.]+)\s*[×x]\s*([\d.]+)\s*[×x]\s*([\d.]+)/i);
    const wt = (v ?? "").match(/([\d.]+)\s*lb/i);
    return { l: m?.[1] ?? "", h: m?.[2] ?? "", w: m?.[3] ?? "", wt: wt?.[1] ?? "" };
  };
  const [d, setD] = useState(() => parse(val));
  const update = (k: "l" | "h" | "w" | "wt", raw: string) => {
    const next = { ...d, [k]: raw.replace(/[^0-9.]/g, "") };
    setD(next);
    const parts: string[] = [];
    if (next.l || next.h || next.w) parts.push(`${next.l || "?"} × ${next.w || "?"} × ${next.h || "?"} in`);
    if (next.wt) parts.push(`${next.wt} lb`);
    setAns(f.key, parts.join(", "));
  };
  const cells: [("l" | "h" | "w" | "wt"), string, string][] = [
    ["l", "Length", "in"], ["h", "Height", "in"], ["w", "Width", "in"], ["wt", "Weight", "lb"],
  ];
  return (
    <div>
      <FieldLabel label={f.label} help={f.help ?? "Rough is fine — it helps us plan the crew and delivery."} required={required} />
      <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:10px")}>
        {cells.map(([k, label, unit]) => (
          <div key={k}>
            <label style={css("display:block;font-size:11.5px;font-weight:600;color:var(--muted);margin-bottom:5px")}>{label} <span style={css("opacity:.7")}>({unit})</span></label>
            <input value={d[k]} onChange={(e) => update(k, e.target.value)} inputMode="decimal" placeholder="0" style={css(FIELD)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Cleaner, less-cluttered "issues" field: a prominent "No damage" toggle plus a
   "Report an issue" reveal for the long list — instead of a wall of chips. */
const ISSUE_CHIP = "padding:8px 14px;border-radius:18px;font-size:13px;font-weight:600;cursor:pointer;transition:all .14s";
function IssuesField({ f, val, setAns }: { f: Field; val: string | string[] | undefined; setAns: (k: string, v: string | string[]) => void }) {
  const selected = Array.isArray(val) ? val : (typeof val === "string" && val ? [val] : []);
  const opts = f.options ?? [];
  const noDamage = opts.find((o) => /no damage|no issue|none/i.test(o)) ?? "No Damage";
  const issueOpts = opts.filter((o) => o !== noDamage);
  const hasNoDamage = selected.includes(noDamage);
  const activeIssues = selected.filter((s) => s !== noDamage);
  const [expanded, setExpanded] = useState(activeIssues.length > 0);

  const setNoDamage = () => { setAns(f.key, [noDamage]); setExpanded(false); };
  const toggleIssue = (o: string) => {
    const cur = selected.filter((s) => s !== noDamage); // reporting an issue clears "no damage"
    setAns(f.key, cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]);
  };

  return (
    <div>
      <FieldLabel label="Any damage or issues?" help="Required — buyers see this. Be upfront so we can inspect and price it fairly." required />
      <div style={css("display:flex;gap:8px;flex-wrap:wrap")}>
        <div onClick={setNoDamage} style={sx(ISSUE_CHIP, hasNoDamage ? CHIP_ON : CHIP_OFF)}>
          {hasNoDamage ? "✓ " : ""}No damage — works perfectly
        </div>
        <div onClick={() => setExpanded(true)} style={sx(ISSUE_CHIP, (expanded || activeIssues.length > 0) ? CHIP_ON : CHIP_OFF)}>
          Report an issue{activeIssues.length > 0 ? ` (${activeIssues.length})` : ""}
        </div>
      </div>
      {(expanded || activeIssues.length > 0) && (
        <div style={css("display:flex;flex-wrap:wrap;gap:7px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)")}>
          {issueOpts.map((o) => (
            <div key={o} onClick={() => toggleIssue(o)} style={sx(ISSUE_CHIP, activeIssues.includes(o) ? CHIP_ON : CHIP_OFF)}>{o}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live listing preview (Facebook-style, desktop + mobile)            */
/* ------------------------------------------------------------------ */
/** Pull a "City, ST" (or the first chunk) out of a full address for the preview. */
function cityFromAddress(addr: string): string {
  if (!addr) return "";
  const m = addr.match(/([A-Za-z .'-]+),\s*([A-Z]{2})\b/);
  if (m) return `${m[1].trim()}, ${m[2]}`;
  return addr.split(",")[0]?.trim() ?? "";
}

interface PreviewProps {
  device: "desktop" | "mobile";
  title: string;
  priceCents: number;
  retailCents: number;
  condition: string;
  categoryName: string;
  location: string;
  description: string;
  photo?: string;
  onAddPhoto?: () => void;
}

function ListingPreview(p: PreviewProps) {
  const money = (c: number) => `$${(c / 100).toLocaleString("en-US")}`;
  const price = p.priceCents > 0 ? money(p.priceCents) : "$—";
  const showRetail = p.retailCents > p.priceCents && p.priceCents > 0;
  const retail = showRetail ? money(p.retailCents) : "";
  const savings = showRetail ? Math.round(((p.retailCents - p.priceCents) / p.retailCents) * 100) : 0;
  const city = cityFromAddress(p.location);
  const displayTitle = p.title.trim() || "Your item title";
  const descParas = p.description ? p.description.split(/\n\n+/).map((s) => s.trim()).filter(Boolean) : [];

  const card = (mobile: boolean) => (
    <div style={css(`background:var(--paper);border:1px solid var(--line);border-radius:${mobile ? "14px" : "12px"};overflow:hidden`)}>
      {/* image — the seller's first photo, or a clickable "add photo" placeholder */}
      <div onClick={p.onAddPhoto} style={sx("position:relative;aspect-ratio:4/3;overflow:hidden", p.onAddPhoto ? "cursor:pointer" : "", p.photo ? { background: "#f2ede6" } : { background: "repeating-linear-gradient(135deg,#EDE4D6 0 15px,#E5DACA 15px 30px)" })}>
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo} alt="" style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />
        ) : (
          <div style={css("position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--blueInk)")}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
            <span style={css("font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700")}>{p.onAddPhoto ? "Click to add photos" : "Photo preview"}</span>
          </div>
        )}
        {p.condition && <div style={css("position:absolute;top:9px;left:9px;background:rgba(255,255,255,.95);color:var(--ink);padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700")}>{p.condition}</div>}
        {savings > 0 && <div style={css("position:absolute;top:9px;right:9px;background:var(--green);color:#fff;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:800")}>Save {savings}%</div>}
      </div>
      <div style={css(mobile ? "padding:15px 16px 17px" : "padding:13px 14px 15px")}>
        <div style={css(`font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;font-size:${mobile ? "11.5px" : "10.5px"}`)}>{p.categoryName}</div>
        <div style={css(`font-family:'Reckless','Newsreader',serif;font-weight:500;line-height:1.25;color:var(--ink);font-size:${mobile ? "18px" : "17px"}`)}>{displayTitle}</div>
        <div style={css("display:flex;align-items:baseline;gap:8px;margin-top:9px")}>
          <span style={css(`font-weight:800;letter-spacing:-.3px;font-size:${mobile ? "23px" : "20px"}`)}>{price}</span>
          {retail && <span style={css("font-size:12.5px;color:var(--muted);text-decoration:line-through")}>{retail}</span>}
        </div>
        {city && (
          <div style={css("display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--muted);margin-top:6px")}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            {city}
          </div>
        )}
        {descParas.length > 0 ? (
          <div style={css("margin-top:11px;display:flex;flex-direction:column;gap:6px")}>
            {descParas.slice(0, 2).map((para, i) => (
              <p key={i} style={css(`line-height:1.5;color:var(--ink);opacity:.85;font-size:${mobile ? "14px" : "12.5px"}`)}>{para}</p>
            ))}
          </div>
        ) : (
          <p style={css(`margin-top:11px;line-height:1.5;color:var(--muted);font-size:${mobile ? "14px" : "12.5px"}`)}>Your polished description will appear here as you add details.</p>
        )}
        <div style={css(`margin-top:14px;background:${PLUM};color:#fff;border-radius:999px;text-align:center;font-weight:700;padding:${mobile ? "13px" : "11px"};font-size:${mobile ? "15px" : "13.5px"}`)}>Add to cart</div>
      </div>
    </div>
  );

  if (p.device === "mobile") {
    return (
      <div style={css("display:flex;justify-content:center;padding:6px 0")}>
        <div style={css("width:400px;max-width:100%;background:#141414;border-radius:40px;padding:7px;box-shadow:0 22px 55px rgba(60,10,35,.24)")}>
          <div style={css("background:var(--cream);border-radius:34px;overflow:hidden;padding:16px 14px")}>
            <div style={css("width:46px;height:5px;border-radius:3px;background:#00000026;margin:0 auto 14px")} />
            {card(true)}
          </div>
        </div>
      </div>
    );
  }

  // desktop — a browser-window chrome around the card
  return (
    <div style={css("border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 14px 40px rgba(60,10,35,.10);background:var(--paper)")}>
      <div style={css("display:flex;align-items:center;gap:6px;padding:9px 12px;background:var(--putty);border-bottom:1px solid var(--line)")}>
        <span style={css("width:9px;height:9px;border-radius:50%;background:#e26d5c")} />
        <span style={css("width:9px;height:9px;border-radius:50%;background:#e7c24b")} />
        <span style={css("width:9px;height:9px;border-radius:50%;background:#3b7a57")} />
        <span style={css("flex:1;margin-left:8px;background:var(--paper);border:1px solid var(--line);border-radius:8px;font-size:11px;color:var(--muted);padding:4px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>commonplace.com/product</span>
      </div>
      <div style={css("padding:16px;background:var(--cream)")}>
        {card(false)}
      </div>
    </div>
  );
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

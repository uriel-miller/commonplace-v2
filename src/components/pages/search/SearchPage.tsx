"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { Search } from "@/components/marketplace/icons";
import { CAT_GROUPS, CONDITIONS } from "@/components/marketplace/data";
import { fetchListings } from "@/lib/clientApi";
import { type Listing } from "@/lib/listing";
import { SearchResultCard, SearchCardSkeleton } from "./SearchResultCard";
import { fuzzyCategoryMatch } from "@/lib/fuzzy";

const PER_PAGE = 24;
const DEBOUNCE_MS = 320;

const GRID = "display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px";

const SORTS: { value: string; label: string }[] = [
  { value: "recommended", label: "Best match" },
  { value: "price", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "date", label: "Newest first" },
  { value: "rating", label: "Top rated" },
];

/** Top-level groups (Fitness, Wellness, Appliances, Furniture, Vehicles) — the
    same pills as the browse page & left sidebar. */
const GROUPS = CAT_GROUPS.map((g) => g.name);

/* Keyword matchers to bucket a real (messy) listing into a top-level group —
   robust to the many long/irregular slugs the catalog actually contains. */
const GROUP_MATCHERS: { name: string; re: RegExp }[] = [
  { name: "Fitness", re: /peloton|tread|\brow|\bbike|elliptical|tonal|strength|dumbbell|barbell|home ?gym|\brack\b|cable|smith|spin|fitness|cardio|weight|stair|hydrow|nordictrack|proform|bowflex|assault|rower|concept2|ergatta|reformer|pilates/i },
  { name: "Wellness", re: /hot ?tub|swim ?spa|\bspa\b|sauna|cold ?plunge|plunge|massage|jacuzzi|wellness|float ?pod|hot ?spring/i },
  { name: "Appliances", re: /refrigerator|fridge|washer|dryer|dishwasher|\brange\b|\boven|freezer|stove|appliance|microwave|cooktop/i },
  { name: "Furniture", re: /sofa|sectional|couch|dining|coffee ?table|\btable\b|\bdesk\b|dresser|bookshelf|furniture|recliner|\blamp\b|\bbed\b|cabinet|wardrobe|nightstand/i },
  { name: "Vehicles", re: /\bcar\b|truck|\bsuv\b|golf ?cart|scooter|\batv\b|\brv\b|motor ?home|lawn ?mower|vehicle|motorcycle|moped|jet ?ski|sea-?doo|vespa|camper|dirt ?bike|boat/i },
];

function groupOf(it: { categoryName?: string | null; categorySlug?: string | null; title?: string }): string | null {
  const hay = `${it.categorySlug ?? ""} ${it.categoryName ?? ""} ${it.title ?? ""}`;
  for (const g of GROUP_MATCHERS) if (g.re.test(hay)) return g.name;
  return null;
}

/* ---- Typo tolerance: correct obvious misspellings against a domain vocabulary. */
const VOCAB = Array.from(new Set(
  CAT_GROUPS
    .flatMap((g) => [g.name, ...g.items.flatMap((it) => [it.name, ...(it.children?.map((c) => c.name) ?? [])])])
    .flatMap((n) => n.toLowerCase().split(/[^a-z0-9+]+/))
    .filter((w) => w.length >= 3)
    .concat(["golf", "cart", "carts", "peloton", "treadmill", "elliptical", "rowing", "sauna", "jacuzzi", "fridge", "sofa", "dresser", "scooter", "mower", "recumbent", "dumbbell", "kettlebell", "massage"]),
));

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const prev = Array.from({ length: n + 1 }, (_, j) => j);
  const cur = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

/** Pull a "N person / N seater / seats N" count out of a query, else null. */
function seatCountFromQuery(q: string): number | null {
  const m = q.match(/(\d+)\s*(?:-?\s*(?:person|people|seat(?:er|s)?|passenger)|pax)\b/i)
    ?? q.match(/(?:seats?|sleeps|holds)\s*(\d+)/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** True if a listing title states the requested seat/person count. */
function titleHasSeatCount(title: string, n: number): boolean {
  const t = title.toLowerCase();
  return new RegExp(`\\b${n}[ -]?(?:person|people|seat|seater|passenger)`).test(t)
    || new RegExp(`(?:seats?|sleeps|holds|passenger)[ -]?${n}\\b`).test(t);
}

/** Token-by-token spelling correction; returns the fixed string or null. */
function correctQuery(q: string): string | null {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  let changed = false;
  const out = tokens.map((tok) => {
    if (tok.length < 3 || VOCAB.includes(tok)) return tok;
    const tol = tok.length <= 4 ? 1 : 2;
    let best = tok, bestD = tol + 1;
    for (const w of VOCAB) {
      if (Math.abs(w.length - tok.length) > tol) continue;
      const d = editDistance(tok, w);
      if (d > 0 && d < bestD) { bestD = d; best = w; }
    }
    if (best !== tok) changed = true;
    return best;
  });
  return changed ? out.join(" ") : null;
}

type Phase = "idle" | "loading" | "ready" | "error";

export function SearchPage({
  initialQuery = "",
  onOpenProduct,
  onOpenCategory,
}: {
  initialQuery?: string;
  onOpenProduct: (l: Listing) => void;
  onOpenCategory?: (slug: string, name: string, prefill?: { seats?: number }) => void;
}) {
  // ---- input + filter state ----
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery.trim());
  // Keep the search box in sync when the header search drives initialQuery.
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  const [category, setCategory] = useState<string>("");
  const [sort, setSort] = useState<string>("recommended");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [conds, setConds] = useState<Set<string>>(new Set());

  // ---- result state ----
  const [items, setItems] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  // The spelling we actually searched on, when it differs from what was typed.
  const [corrected, setCorrected] = useState<string | null>(null);
  // When the raw query finds nothing but maps to a category, we show that
  // category's listings instead of an empty page.
  const [catFallback, setCatFallback] = useState<{ name: string; slug: string; seats: number | null } | null>(null);
  // The query for which the category pop-up was dismissed (so it doesn't
  // re-open until the shopper types something new).
  const [catModalDismissedQ, setCatModalDismissedQ] = useState<string | null>(null);
  // Drill-down: which parent department is expanded inside the pop-up.
  const [catBrowseGroup, setCatBrowseGroup] = useState<string | null>(null);

  // Monotonic generation guard — stale async responses are discarded.
  const genRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the raw query into the value we actually search on.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Focus the field on mount so a search page is immediately usable.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fresh search whenever the query, category, or sort changes.
  useEffect(() => {
    const gen = ++genRef.current;
    setPhase("loading");
    setPage(1);
    setCorrected(null);
    setCatFallback(null);
    setCatBrowseGroup(null);
    fetchListings({ search: debounced || undefined, orderby: sort, page: 1, perPage: PER_PAGE })
      .then(async (d) => {
        if (genRef.current !== gen) return;
        // Typo tolerance: if nothing matched, retry with a corrected spelling.
        if (d.total === 0 && debounced) {
          const fix = correctQuery(debounced);
          if (fix && fix !== debounced.toLowerCase()) {
            const d2 = await fetchListings({ search: fix, orderby: sort, page: 1, perPage: PER_PAGE }).catch(() => null);
            if (genRef.current !== gen) return;
            if (d2 && d2.total > 0) {
              setCorrected(fix);
              setItems(d2.items); setTotal(d2.total); setTotalPages(d2.totalPages); setPhase("ready");
              return;
            }
          }
          // Still nothing → if the query maps to a category (e.g. "6 seater golf
          // cart" → Golf Carts), route the shopper THROUGH that category's
          // filters: show the category, narrowed to the requested seat count.
          const m = fuzzyCategoryMatch(debounced);
          if (m) {
            // Pull a big page so client-side seat-narrowing has the whole category to work with.
            const d3 = await fetchListings({ category: m.cat.slug, orderby: sort, page: 1, perPage: 100 }).catch(() => null);
            if (genRef.current !== gen) return;
            if (d3 && d3.items.length > 0) {
              const seats = seatCountFromQuery(debounced);
              const narrowed = seats != null ? d3.items.filter((it) => titleHasSeatCount(it.title ?? "", seats)) : d3.items;
              const useSeat = seats != null && narrowed.length > 0;
              const shown = useSeat ? narrowed : d3.items;
              setCatFallback({ name: m.cat.name, slug: m.cat.slug, seats: useSeat ? seats : null });
              setItems(shown);
              setTotal(useSeat ? shown.length : d3.total);
              setTotalPages(1); // the whole (large) page is already loaded — no incremental paging
              setPhase("ready");
              return;
            }
          }
        }
        setItems(d.items);
        setTotal(d.total);
        setTotalPages(d.totalPages);
        setPhase("ready");
      })
      .catch(() => {
        if (genRef.current !== gen) return;
        setPhase("error");
      });
  }, [debounced, sort, reloadNonce]);

  const loadMore = useCallback(() => {
    if (loadingMore || phase === "loading") return;
    const gen = genRef.current;
    const next = page + 1;
    setLoadingMore(true);
    fetchListings(
      catFallback
        ? { category: catFallback.slug, orderby: sort, page: next, perPage: PER_PAGE }
        : { search: (corrected ?? debounced) || undefined, orderby: sort, page: next, perPage: PER_PAGE },
    )
      .then((d) => {
        if (genRef.current !== gen) return;
        setItems((prev) => [...prev, ...d.items]);
        setPage(next);
        setTotal(d.total);
        setTotalPages(d.totalPages);
        setLoadingMore(false);
      })
      .catch(() => {
        if (genRef.current !== gen) return;
        setLoadingMore(false);
      });
  }, [loadingMore, phase, page, debounced, corrected, sort, catFallback]);

  // ---- client-side refinement (the API doesn't take price/condition) ----
  const minCents = useMemo(() => dollarsToCents(priceMin), [priceMin]);
  const maxCents = useMemo(() => dollarsToCents(priceMax), [priceMax]);
  const priceActive = minCents !== null || maxCents !== null;
  const condActive = conds.size > 0;

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (category && groupOf(it) !== category) return false;
      if (minCents !== null && it.priceCents < minCents) return false;
      if (maxCents !== null && it.priceCents > maxCents) return false;
      if (condActive) {
        const c = (it.condition ?? "").toLowerCase();
        // match against selected condition labels loosely (e.g. "Like new")
        const hit = [...conds].some((key) => {
          const label = CONDITIONS.find((x) => x.key === key)?.label.toLowerCase() ?? key;
          return c === label || c === key || c.includes(label);
        });
        if (!hit) return false;
      }
      return true;
    });
  }, [items, category, minCents, maxCents, condActive, conds]);

  const hasMorePages = page < totalPages;
  const anyFilter = priceActive || condActive || !!category;
  const trimmed = debounced;
  // "Did you mean …?" — a fuzzy category match to jump to the dedicated category
  // page (with its category-specific filters). Skips when the query already IS
  // that category's name (no point suggesting what they typed).
  const catSuggestion = useMemo(() => {
    if (!trimmed || !onOpenCategory) return null;
    const m = fuzzyCategoryMatch(trimmed);
    if (!m) return null;
    // (Even when the query IS the category name we keep the suggestion — the
    // pop-up always shows now, so the exact match is the best quick-pick.)
    // Pull a "N person / N seater / seats N" count out of the query so the
    // category opens with its matching capacity chip pre-selected.
    const cap = trimmed.match(/(\d+)\s*(?:-?\s*(?:person|people|seat(?:er|s)?|passenger)|pax)\b/i)
      ?? trimmed.match(/(?:seats?|sleeps|holds)\s*(\d+)/i);
    const seats = cap ? Number(cap[1]) : undefined;
    return { ...m, seats: Number.isFinite(seats) ? seats : undefined };
  }, [trimmed, onOpenCategory]);

  function toggleCond(key: string) {
    setConds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearRefinements() {
    setPriceMin("");
    setPriceMax("");
    setConds(new Set());
    setCategory("");
  }

  // No-results category tap: clear the (misspelled) query and browse the group.
  const pickGroup = (name: string) => { setQuery(""); setCategory(name); };

  function clearAll() {
    setQuery("");
    setCategory("");
    setSort("recommended");
    clearRefinements();
    inputRef.current?.focus();
  }

  // Count line: server total is authoritative unless a client filter is active.
  const countLabel = phase === "loading"
    ? "Searching…"
    : phase === "error"
      ? "Couldn't load results"
      : anyFilter
      ? `${filtered.length.toLocaleString()} matching`
      : `${total.toLocaleString()} result${total === 1 ? "" : "s"}`;

  return (
    <div style={css("max-width:1180px;margin:0 auto;padding:6px 4px 60px")}>
      {/* ============================ HEADER ROW ============================ */}
      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px")}>
        <div>
          <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:26px;font-weight:500;letter-spacing:-.4px;line-height:1.1")}>
            {trimmed ? <>Results for <span style={css("color:var(--maroon)")}>&ldquo;{trimmed}&rdquo;</span></> : "Search inventory"}
          </h1>
          <p style={css("color:var(--muted);font-size:13px;margin-top:3px")} aria-live="polite">
            {countLabel}
            {corrected && phase === "ready" && (
              <span style={css("color:var(--ink)")}> · showing <b style={css("color:var(--maroon)")}>“{corrected}”</b> (corrected)</span>
            )}
            {anyFilter && phase === "ready" && (
              <span style={css("color:var(--muted)")}> · filtered from {items.length.toLocaleString()} loaded</span>
            )}
          </p>
        </div>
        <label style={css("display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13.5px")}>
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={css("border:1px solid var(--line);background:var(--putty);border-radius:10px;padding:8px 12px;font-size:13.5px;font-weight:600;color:var(--ink);cursor:pointer;font-family:inherit")}
          >
            {SORTS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
        </label>
      </div>

      {/* ============= Category pop-up — ALWAYS shown on a search so the shopper
           lands in the right category (suggested pick + parent→sub drill-down). ============= */}
      {onOpenCategory && phase === "ready" && trimmed && catModalDismissedQ !== trimmed && (() => {
        const dismiss = () => setCatModalDismissedQ(trimmed);
        const go = (slug: string, name: string, withSeats: boolean) =>
          onOpenCategory(slug, name, withSeats && catSuggestion?.seats != null ? { seats: catSuggestion.seats } : undefined);
        const grp = catBrowseGroup ? CAT_GROUPS.find((g) => g.name === catBrowseGroup) : null;
        const subItems = grp
          ? grp.items.flatMap((it) => (it.children?.length ? [it, ...it.children] : [it])).filter((c, i, a) => a.findIndex((x) => x.slug === c.slug) === i)
          : [];
        const chipStyle = "padding:9px 15px;border-radius:18px;font-size:13.5px;font-weight:600;cursor:pointer;transition:all .14s;border:1px solid var(--line);background:var(--paper);color:var(--ink)";
        return (
          <div role="presentation" onClick={dismiss}
            style={css("position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(25,12,18,.55);animation:fade .15s ease both")}>
            <div role="dialog" aria-modal="true" aria-label="Choose a category" onClick={(e) => e.stopPropagation()}
              style={css("width:460px;max-width:92vw;max-height:82vh;display:flex;flex-direction:column;background:var(--paper);border-radius:20px;box-shadow:0 30px 70px rgba(0,0,0,.4);padding:24px;animation:pop .2s ease both")}>
              <div style={css("display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px")}>
                <div style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;font-weight:600;line-height:1.15")}>Find the right category</div>
                <button aria-label="Close" onClick={dismiss}
                  style={css("flex:0 0 auto;width:30px;height:30px;border:0;border-radius:50%;background:#F0EDE8;color:#555;cursor:pointer;font-size:16px;line-height:1")}>×</button>
              </div>
              <p style={css("font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:16px")}>Pick a department, then the exact category for &ldquo;{trimmed}&rdquo; — you&apos;ll land on its listings with the right filters.</p>

              {/* Suggested quick-pick when we recognize the query. */}
              {catSuggestion && !catBrowseGroup && (
                <Hoverable as="button" onClick={() => go(catSuggestion.cat.slug, catSuggestion.cat.name, true)}
                  styles="width:100%;text-align:left;font-family:inherit;background:var(--blueBg);color:var(--blueInk);border:1px solid #cfe0f2;border-radius:14px;padding:13px 15px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:16px"
                  hover="filter:brightness(1.02)">
                  Did you mean {catSuggestion.cat.name}{catSuggestion.seats != null ? ` · ${catSuggestion.seats}-seater` : ""}? →
                </Hoverable>
              )}

              {grp ? (
                /* Drill-down: subcategories of the chosen department. */
                <div style={css("overflow-y:auto")}>
                  <div onClick={() => setCatBrowseGroup(null)} style={css("display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:var(--blueInk);cursor:pointer;margin-bottom:12px")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>All departments
                  </div>
                  <div style={css("font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:8px")}>{grp.name}</div>
                  <div style={css("display:flex;flex-wrap:wrap;gap:8px")}>
                    {subItems.map((it) => (
                      <Hoverable key={it.slug} as="div" onClick={() => go(it.slug, it.name, it.slug === catSuggestion?.cat.slug)}
                        styles={chipStyle} hover="border-color:var(--blueInk);background:var(--blueBg)">{it.name}</Hoverable>
                    ))}
                  </div>
                </div>
              ) : (
                /* Department list. */
                <div style={css("overflow-y:auto")}>
                  <div style={css("font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:8px")}>Browse by department</div>
                  <div style={css("display:flex;flex-direction:column;gap:8px")}>
                    {CAT_GROUPS.map((g) => (
                      <div key={g.name} onClick={() => setCatBrowseGroup(g.name)}
                        style={css("display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;cursor:pointer")}>
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
                  <div onClick={dismiss} style={css("text-align:center;margin-top:16px;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;text-decoration:underline")}>Keep browsing results</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* No exact text match, but the query mapped to a category — showing it,
          narrowed to the requested seat count when we could parse one. */}
      {catFallback && (
        <div style={css("font-size:13.5px;color:var(--muted);margin-bottom:12px")}>
          No exact matches for &ldquo;{trimmed}&rdquo; — showing{" "}
          {catFallback.seats != null ? <b style={css("color:var(--ink)")}>{catFallback.seats}-seater {catFallback.name}</b> : <>all <b style={css("color:var(--ink)")}>{catFallback.name}</b></>}.
        </div>
      )}

      {/* ============================ CATEGORY CHIPS (sidebar groups) ============================ */}
      <div style={css("display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px")}>
        {["All", ...GROUPS].map((label) => {
          const value = label === "All" ? "" : label;
          const active = category === value;
          return (
            <Hoverable
              key={label}
              as="button"
              onClick={() => setCategory(value)}
              styles={sx(
                "font-family:inherit;transition:box-shadow .16s ease;padding:8px 15px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer",
                active
                  ? { border: "1px solid var(--blueInk)", background: "var(--blueInk)", color: "#fff" }
                  : { border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" },
              )}
              hover="box-shadow:0 6px 16px rgba(60,10,35,.13)"
            >
              {label}
            </Hoverable>
          );
        })}
      </div>

      {/* ============================ REFINEMENTS ============================ */}
      <div style={css("display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:11px 14px;margin-bottom:20px")}>
        <div style={css("display:flex;align-items:center;gap:8px")}>
          <span style={css("font-size:12px;font-weight:700;color:var(--muted)")}>Price</span>
          <div style={css("display:flex;align-items:center;gap:2px;width:90px;border:1px solid var(--line);border-radius:9px;padding:0 10px;background:#fff;box-sizing:border-box")}>
            <span style={css("color:var(--muted);font-size:13px")}>$</span>
            <input value={priceMin} onChange={(e) => setPriceMin(sanitizeNum(e.target.value))} inputMode="numeric" placeholder="Min" aria-label="Minimum price"
              style={css("width:100%;min-width:0;border:none;outline:none;background:transparent;padding:7px 0 7px 3px;font-size:13px;font-family:inherit;color:var(--ink)")} />
          </div>
          <span style={css("color:var(--muted);font-size:13px")}>–</span>
          <div style={css("display:flex;align-items:center;gap:2px;width:90px;border:1px solid var(--line);border-radius:9px;padding:0 10px;background:#fff;box-sizing:border-box")}>
            <span style={css("color:var(--muted);font-size:13px")}>$</span>
            <input value={priceMax} onChange={(e) => setPriceMax(sanitizeNum(e.target.value))} inputMode="numeric" placeholder="Max" aria-label="Maximum price"
              style={css("width:100%;min-width:0;border:none;outline:none;background:transparent;padding:7px 0 7px 3px;font-size:13px;font-family:inherit;color:var(--ink)")} />
          </div>
        </div>
        <div style={css("width:1px;height:22px;background:var(--line)")} />
        <div style={css("display:flex;align-items:center;gap:6px;flex-wrap:wrap")}>
          {CONDITIONS.map((c) => {
            const on = conds.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCond(c.key)}
                style={sx(
                  "font-family:inherit;padding:6px 11px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;transition:all .14s",
                  on
                    ? { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" }
                    : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" },
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {(anyFilter || category || sort !== "recommended") && (
          <button
            onClick={clearRefinements}
            style={css("margin-left:auto;background:none;border:none;color:var(--blueInk);font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit")}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ============================ RESULTS ============================ */}
      {phase === "loading" ? (
        <div style={css(GRID)}>
          {Array.from({ length: 10 }).map((_, i) => (<SearchCardSkeleton key={i} />))}
        </div>
      ) : phase === "error" ? (
        <ErrorState onRetry={() => setReloadNonce((n) => n + 1)} />
      ) : filtered.length > 0 ? (
        <>
          <div style={css(GRID)}>
            {filtered.map((it) => (
              <SearchResultCard key={it.id} item={it} onClick={() => onOpenProduct(it)} />
            ))}
          </div>

          {/* Load more — driven by the server's page count. */}
          {hasMorePages && (
            <div style={css("display:flex;justify-content:center;margin-top:26px")}>
              <Hoverable
                as="button"
                onClick={loadMore}
                styles={sx(
                  "font-family:inherit;min-width:220px;padding:13px 26px;border-radius:24px;border:1px solid var(--maroon);background:var(--paper);color:var(--maroon);font-size:14px;font-weight:700;cursor:pointer;transition:box-shadow .16s ease",
                  loadingMore ? { opacity: 0.7, cursor: "wait" } : {},
                )}
                hover="box-shadow:0 8px 20px rgba(60,10,35,.16)"
              >
                {loadingMore ? "Loading…" : `Load more · ${Math.max(total - items.length, 0).toLocaleString()} left`}
              </Hoverable>
            </div>
          )}
          {!hasMorePages && items.length > 0 && (
            <div style={css("text-align:center;margin-top:26px;color:var(--muted);font-size:12.5px")}>
              That&apos;s everything{trimmed ? <> for &ldquo;{trimmed}&rdquo;</> : ""} — {filtered.length.toLocaleString()} shown.
            </div>
          )}
        </>
      ) : anyFilter ? (
        // Server had results but client filters removed them all.
        <FilteredEmpty onClear={clearRefinements} />
      ) : (
        <NoResults query={trimmed} onClearAll={clearAll} onPick={pickGroup} />
      )}
    </div>
  );
}

/* ------------------------------- Empty / error states ------------------------------- */

function NoResults({ query, onClearAll, onPick }: { query: string; onClearAll: () => void; onPick: (group: string) => void }) {
  return (
    <div style={css("text-align:center;padding:64px 20px 40px;max-width:560px;margin:0 auto")}>
      <div style={css("width:60px;height:60px;margin:0 auto 16px;border-radius:50%;background:var(--tint);color:var(--maroon);display:flex;align-items:center;justify-content:center")}>
        <Search size={26} stroke="currentColor" />
      </div>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:24px;color:var(--ink);margin-bottom:8px")}>
        {query ? <>No results for &ldquo;{query}&rdquo;</> : "Nothing matched"}
      </div>
      <p style={css("font-size:14px;color:var(--muted);line-height:1.5;margin-bottom:22px")}>
        Check the spelling, use fewer or more general words, or start from a popular category below. Every item on Commonplace is inspected, delivered, and pay-on-delivery.
      </p>
      <div style={css("display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:24px")}>
        {GROUPS.map((name) => (
          <Hoverable
            key={name}
            as="button"
            onClick={() => onPick(name)}
            styles="font-family:inherit;padding:9px 16px;border-radius:20px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:13px;font-weight:700;cursor:pointer;transition:box-shadow .16s ease"
            hover="box-shadow:0 6px 16px rgba(60,10,35,.13)"
          >
            {name}
          </Hoverable>
        ))}
      </div>
      <button
        onClick={onClearAll}
        style={css("background:var(--maroon);color:#fff;border:none;border-radius:22px;padding:12px 26px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit")}
      >
        Reset search
      </button>
    </div>
  );
}

function FilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div style={css("text-align:center;padding:56px 20px;color:var(--muted)")}>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;color:var(--ink);margin-bottom:6px")}>No items in that range</div>
      <p style={css("font-size:14px;margin-bottom:20px")}>Your price or condition filters are hiding every match. Try widening them.</p>
      <button
        onClick={onClear}
        style={css("background:var(--paper);color:var(--maroon);border:1px solid var(--maroon);border-radius:22px;padding:11px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit")}
      >
        Clear filters
      </button>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={css("text-align:center;padding:56px 20px;color:var(--muted)")}>
      <div style={css("font-family:'Reckless','Newsreader',serif;font-size:22px;color:var(--ink);margin-bottom:6px")}>Something went wrong</div>
      <p style={css("font-size:14px;margin-bottom:20px")}>We couldn&apos;t load results just now. Please try again.</p>
      <button
        onClick={onRetry}
        style={css("background:var(--maroon);color:#fff;border:none;border-radius:22px;padding:11px 24px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit")}
      >
        Retry
      </button>
    </div>
  );
}

/* ------------------------------- helpers ------------------------------- */

/** Keep only digits (prices are whole dollars in the filter inputs). */
function sanitizeNum(v: string): string {
  return v.replace(/[^\d]/g, "").slice(0, 9);
}

/** Parse a whole-dollar string into cents, or null when blank/invalid. */
function dollarsToCents(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

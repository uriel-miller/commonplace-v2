"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { Search, Close } from "@/components/marketplace/icons";
import { BROWSE_CHIPS, CONDITIONS } from "@/components/marketplace/data";
import { fetchListings } from "@/lib/clientApi";
import { type Listing } from "@/lib/listing";
import { SearchResultCard, SearchCardSkeleton } from "./SearchResultCard";

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

/** Suggestion chips shown in the empty state — drawn from live taxonomy. */
const SUGGESTIONS = BROWSE_CHIPS.filter((c) => c.slug !== "");

type Phase = "idle" | "loading" | "ready" | "error";

export function SearchPage({
  initialQuery = "",
  onOpenProduct,
}: {
  initialQuery?: string;
  onOpenProduct: (l: Listing) => void;
}) {
  // ---- input + filter state ----
  const [query, setQuery] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery.trim());
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
    fetchListings({
      search: debounced || undefined,
      category: category || undefined,
      orderby: sort,
      page: 1,
      perPage: PER_PAGE,
    })
      .then((d) => {
        if (genRef.current !== gen) return;
        setItems(d.items);
        setTotal(d.total);
        setTotalPages(d.totalPages);
        setPhase("ready");
      })
      .catch(() => {
        if (genRef.current !== gen) return;
        setPhase("error");
      });
  }, [debounced, category, sort, reloadNonce]);

  const loadMore = useCallback(() => {
    if (loadingMore || phase === "loading") return;
    const gen = genRef.current;
    const next = page + 1;
    setLoadingMore(true);
    fetchListings({
      search: debounced || undefined,
      category: category || undefined,
      orderby: sort,
      page: next,
      perPage: PER_PAGE,
    })
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
  }, [loadingMore, phase, page, debounced, category, sort]);

  // ---- client-side refinement (the API doesn't take price/condition) ----
  const minCents = useMemo(() => dollarsToCents(priceMin), [priceMin]);
  const maxCents = useMemo(() => dollarsToCents(priceMax), [priceMax]);
  const priceActive = minCents !== null || maxCents !== null;
  const condActive = conds.size > 0;

  const filtered = useMemo(() => {
    return items.filter((it) => {
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
  }, [items, minCents, maxCents, condActive, conds]);

  const hasMorePages = page < totalPages;
  const anyFilter = priceActive || condActive;
  const trimmed = debounced;

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
  }

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
      {/* ============================ SEARCH BAR ============================ */}
      <div style={css("position:relative;margin-bottom:16px")}>
        <span style={css("position:absolute;left:18px;top:50%;transform:translateY(-50%);color:var(--muted);display:flex")}>
          <Search size={19} />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape" && query) { e.preventDefault(); setQuery(""); } }}
          placeholder="Search Commonplace — Peloton, hot tub, treadmill…"
          aria-label="Search listings"
          style={css("width:100%;box-sizing:border-box;border:1px solid var(--line);background:var(--paper);border-radius:26px;padding:15px 46px 15px 46px;font-family:inherit;font-size:16px;color:var(--ink);outline:none;box-shadow:0 3px 12px rgba(60,10,35,.05)")}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            aria-label="Clear search"
            style={css("position:absolute;right:12px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:none;background:var(--putty);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0")}
          >
            <Close size={14} />
          </button>
        )}
      </div>

      {/* ============================ HEADER ROW ============================ */}
      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px")}>
        <div>
          <h1 style={css("font-family:'Newsreader',serif;font-size:26px;font-weight:500;letter-spacing:-.4px;line-height:1.1")}>
            {trimmed ? <>Results for <span style={css("color:var(--maroon)")}>&ldquo;{trimmed}&rdquo;</span></> : "Search inventory"}
          </h1>
          <p style={css("color:var(--muted);font-size:13px;margin-top:3px")} aria-live="polite">
            {countLabel}
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

      {/* ============================ CATEGORY CHIPS ============================ */}
      <div style={css("display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px")}>
        {BROWSE_CHIPS.map((c) => {
          const active = category === c.slug;
          return (
            <Hoverable
              key={c.label}
              as="button"
              onClick={() => setCategory(c.slug)}
              styles={sx(
                "font-family:inherit;transition:box-shadow .16s ease;padding:8px 15px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer",
                active
                  ? { border: "1px solid var(--maroon)", background: "var(--maroon)", color: "#fff" }
                  : { border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" },
              )}
              hover="box-shadow:0 6px 16px rgba(60,10,35,.13)"
            >
              {c.label}
            </Hoverable>
          );
        })}
      </div>

      {/* ============================ REFINEMENTS ============================ */}
      <div style={css("display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:11px 14px;margin-bottom:20px")}>
        <div style={css("display:flex;align-items:center;gap:8px")}>
          <span style={css("font-size:12px;font-weight:700;color:var(--muted)")}>Price</span>
          <input
            value={priceMin}
            onChange={(e) => setPriceMin(sanitizeNum(e.target.value))}
            inputMode="numeric"
            placeholder="Min $"
            aria-label="Minimum price"
            style={css("width:84px;border:1px solid var(--line);border-radius:9px;padding:7px 10px;font-size:13px;outline:none;background:#fff;font-family:inherit")}
          />
          <span style={css("color:var(--muted);font-size:13px")}>–</span>
          <input
            value={priceMax}
            onChange={(e) => setPriceMax(sanitizeNum(e.target.value))}
            inputMode="numeric"
            placeholder="Max $"
            aria-label="Maximum price"
            style={css("width:84px;border:1px solid var(--line);border-radius:9px;padding:7px 10px;font-size:13px;outline:none;background:#fff;font-family:inherit")}
          />
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
        <NoResults query={trimmed} onClearAll={clearAll} onPick={setCategory} />
      )}
    </div>
  );
}

/* ------------------------------- Empty / error states ------------------------------- */

function NoResults({ query, onClearAll, onPick }: { query: string; onClearAll: () => void; onPick: (slug: string) => void }) {
  return (
    <div style={css("text-align:center;padding:64px 20px 40px;max-width:560px;margin:0 auto")}>
      <div style={css("width:60px;height:60px;margin:0 auto 16px;border-radius:50%;background:var(--tint);color:var(--maroon);display:flex;align-items:center;justify-content:center")}>
        <Search size={26} stroke="currentColor" />
      </div>
      <div style={css("font-family:'Newsreader',serif;font-size:24px;color:var(--ink);margin-bottom:8px")}>
        {query ? <>No results for &ldquo;{query}&rdquo;</> : "Nothing matched"}
      </div>
      <p style={css("font-size:14px;color:var(--muted);line-height:1.5;margin-bottom:22px")}>
        Check the spelling, use fewer or more general words, or start from a popular category below. Every item on Commonplace is inspected, delivered, and pay-on-delivery.
      </p>
      <div style={css("display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:24px")}>
        {SUGGESTIONS.map((s) => (
          <Hoverable
            key={s.slug}
            as="button"
            onClick={() => onPick(s.slug)}
            styles="font-family:inherit;padding:9px 16px;border-radius:20px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font-size:13px;font-weight:700;cursor:pointer;transition:box-shadow .16s ease"
            hover="box-shadow:0 6px 16px rgba(60,10,35,.13)"
          >
            {s.label}
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
      <div style={css("font-family:'Newsreader',serif;font-size:22px;color:var(--ink);margin-bottom:6px")}>No items in that range</div>
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
      <div style={css("font-family:'Newsreader',serif;font-size:22px;color:var(--ink);margin-bottom:6px")}>Something went wrong</div>
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

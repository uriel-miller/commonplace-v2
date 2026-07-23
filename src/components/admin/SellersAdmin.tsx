"use client";

/**
 * SellersAdmin — an operator roster of sellers derived from live listings.
 *
 * The listing model has no first-class seller identity, so we group listings by
 * their parsed `location` ("City, ST") as a stable seller proxy. For each group
 * we show the listing count, total list value, and estimated seller payout
 * (Σ computeSellerPayout per listing). Reads from /api/admin/listings when
 * available, falling back to the public /api/products feed.
 *
 * Fails soft: any fetch/parse error shows an inline empty state, never a crash.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { sx } from "@/lib/design/css";
import { computeSellerPayout } from "@/lib/fees";
import { formatPrice, type Listing } from "@/lib/listing";

/* --------------------------------- styles ---------------------------------- */

const HEAD = "font-family:'Reckless','Newsreader',serif;color:var(--ink);margin:0";
const TH =
  "text-align:left;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;border-bottom:1px solid var(--line);cursor:pointer;white-space:nowrap";
const TD = "padding:9px 12px;border-bottom:1px solid var(--line);font-size:14px;color:var(--ink)";
const NUM = "text-align:right;font-variant-numeric:tabular-nums";

/* --------------------------------- types ----------------------------------- */

interface SellerRow {
  seller: string;
  listings: number;
  listValueCents: number;
  payoutCents: number;
}

type SortKey = "seller" | "listings" | "listValueCents" | "payoutCents";

interface ListResponse {
  items?: unknown;
  total?: unknown;
  totalPages?: unknown;
}

/* -------------------------------- data load -------------------------------- */

const PER_PAGE = 100;
const MAX_PAGES = 6; // cap the roster build so we never hammer the source.

function asListingArray(v: unknown): Listing[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Listing => !!x && typeof x === "object" && "id" in x && "priceCents" in x);
}

/** Fetch one page from admin endpoint, falling back to the public feed. */
async function fetchPage(page: number): Promise<{ items: Listing[]; totalPages: number }> {
  const tryUrls = [
    `/api/admin/listings?page=${page}&per_page=${PER_PAGE}`,
    `/api/products?page=${page}&per_page=${PER_PAGE}`,
  ];
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = (await res.json()) as ListResponse;
      const items = asListingArray(data.items);
      const totalPages = typeof data.totalPages === "number" && data.totalPages > 0 ? data.totalPages : 1;
      return { items, totalPages };
    } catch {
      // try next url
    }
  }
  return { items: [], totalPages: 1 };
}

/* ------------------------------- aggregation ------------------------------- */

function buildRoster(listings: Listing[]): SellerRow[] {
  const map = new Map<string, SellerRow>();
  for (const l of listings) {
    const seller = (l.location && l.location.trim()) || "Unknown location";
    const payout = computeSellerPayout({ priceCents: l.priceCents, categorySlug: l.categorySlug });
    const row =
      map.get(seller) ?? { seller, listings: 0, listValueCents: 0, payoutCents: 0 };
    row.listings += 1;
    row.listValueCents += Math.max(0, l.priceCents);
    row.payoutCents += payout.payoutCents;
    map.set(seller, row);
  }
  return [...map.values()];
}

/* -------------------------------- component -------------------------------- */

export default function SellersAdmin() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("listings");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all: Listing[] = [];
      const first = await fetchPage(1);
      all.push(...first.items);
      const pages = Math.min(MAX_PAGES, Math.max(1, first.totalPages));
      for (let p = 2; p <= pages; p++) {
        const next = await fetchPage(p);
        all.push(...next.items);
        if (next.items.length === 0) break;
      }
      setListings(all);
      if (all.length === 0) setError("No listings available to build a seller roster.");
    } catch (err) {
      setError(`Failed to load listings: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roster = useMemo(() => buildRoster(listings), [listings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? roster.filter((r) => r.seller.toLowerCase().includes(q)) : roster;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortKey === "seller") return a.seller.localeCompare(b.seller) * dir;
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [roster, query, sortKey, sortDir]);

  const totals = useMemo(
    () =>
      roster.reduce(
        (acc, r) => {
          acc.sellers += 1;
          acc.listings += r.listings;
          acc.listValueCents += r.listValueCents;
          acc.payoutCents += r.payoutCents;
          return acc;
        },
        { sellers: 0, listings: 0, listValueCents: 0, payoutCents: 0 },
      ),
    [roster],
  );

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "seller" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  const arrow = (key: SortKey) => (key === sortKey ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div style={sx("padding:20px 24px;max-width:960px")}>
      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px")}>
        <h1 style={sx(HEAD, "font-size:24px")}>Sellers</h1>
        <div style={sx("display:flex;gap:8px;align-items:center")}>
          <input
            style={sx("border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-size:14px;color:var(--ink);background:var(--cream);width:200px")}
            placeholder="Search seller / location…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <button
            style={sx("background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:7px 12px;font-size:14px;cursor:pointer")}
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* summary tiles */}
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px")}>
        <Tile label="Sellers" value={totals.sellers.toLocaleString()} />
        <Tile label="Listings" value={totals.listings.toLocaleString()} />
        <Tile label="List value" value={formatPrice(totals.listValueCents)} />
        <Tile label="Est. payouts" value={formatPrice(totals.payoutCents)} />
      </div>

      {error && (
        <div style={sx("border:1px solid var(--maroon);color:var(--maroon);background:color-mix(in srgb,var(--maroon) 8%,transparent);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:14px")}>
          {error}
        </div>
      )}

      <div style={sx("background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden")}>
        <div style={sx("overflow-x:auto")}>
          <table style={sx("width:100%;border-collapse:collapse")}>
            <thead>
              <tr>
                <th style={sx(TH)} onClick={() => toggleSort("seller")}>Seller / location{arrow("seller")}</th>
                <th style={sx(TH, NUM)} onClick={() => toggleSort("listings")}>Listings{arrow("listings")}</th>
                <th style={sx(TH, NUM)} onClick={() => toggleSort("listValueCents")}>List value{arrow("listValueCents")}</th>
                <th style={sx(TH, NUM)} onClick={() => toggleSort("payoutCents")}>Est. payout{arrow("payoutCents")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.seller}>
                  <td style={sx(TD)}>{r.seller}</td>
                  <td style={sx(TD, NUM)}>{r.listings.toLocaleString()}</td>
                  <td style={sx(TD, NUM)}>{formatPrice(r.listValueCents)}</td>
                  <td style={sx(TD, NUM, "color:var(--green);font-weight:600")}>{formatPrice(r.payoutCents)}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td style={sx(TD, "color:var(--muted)")} colSpan={4}>
                    {query ? "No sellers match your search." : "No sellers to display."}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td style={sx(TD, "color:var(--muted)")} colSpan={4}>Loading roster…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={sx("font-size:12px;color:var(--muted);margin-top:10px")}>
        Sellers are grouped by parsed listing location as a proxy for seller identity. Estimated
        payout = list price − transaction fee − pickup fee, per <code style={sx("font-family:monospace")}>computeSellerPayout</code>.
      </p>
    </div>
  );
}

/* --------------------------------- tile ------------------------------------ */

function Tile(props: { label: string; value: string }) {
  return (
    <div style={sx("background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:12px 14px")}>
      <div style={sx("font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em")}>{props.label}</div>
      <div style={sx(HEAD, "font-size:22px;margin-top:4px")}>{props.value}</div>
    </div>
  );
}

export { SellersAdmin };

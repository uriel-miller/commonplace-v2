// Explore/Browse ranking algorithm. Pure and deterministic so it's testable
// and identical on server and client. Produces a composite relevance score per
// listing from signals we actually have, then sorts descending.

import type { Listing } from "./listing";

export interface RankOpts {
  /** Free-text query — dominates the score when present. */
  query?: string;
  /** Viewer city/area, e.g. "Austin, TX" — boosts nearby listings. */
  city?: string;
}

// Higher = better condition. Unknown conditions land mid-pack.
const CONDITION_RANK: Record<string, number> = {
  "brand new": 1.0, new: 0.95, "like new": 0.9, "open box": 0.72,
  excellent: 0.8, "very good": 0.72, good: 0.6, refurbished: 0.62,
  fair: 0.4, used: 0.5,
};

export interface ScoredListing {
  listing: Listing;
  score: number;
}

export function scoreListing(it: Listing, opts: RankOpts, maxId: number): number {
  let s = 0;
  const q = (opts.query ?? "").toLowerCase().trim();
  const city = (opts.city ?? "").toLowerCase().trim();

  // 1) Search relevance — dominant signal when the user is searching.
  if (q) {
    const t = it.title.toLowerCase();
    if (t.includes(q)) s += t.startsWith(q) ? 5 : 3;
    for (const w of q.split(/\s+/)) if (w.length > 1 && t.includes(w)) s += 0.6;
    if (it.categoryName.toLowerCase().includes(q)) s += 1;
  }

  // 2) Value — bigger verified discount ranks higher.
  if (it.savingsPct) s += (Math.min(it.savingsPct, 80) / 80) * 1.6;

  // 3) Social proof — rating + volume (log-damped).
  s += (it.rating / 5) * 1.2 + Math.log10(1 + it.reviewCount) * 0.4;

  // 4) Condition quality.
  s += (CONDITION_RANK[(it.condition ?? "").toLowerCase()] ?? 0.5) * 1.0;

  // 5) Media quality — listings with photos convert; a little more is better.
  s += it.images.length > 0 ? 0.8 + Math.min(it.images.length, 4) * 0.05 : 0;

  // 6) Recency proxy — higher product id ≈ newer (Store API omits dates).
  s += (it.id / Math.max(1, maxId)) * 1.0;

  // 7) Proximity — same city/state as the viewer.
  if (city && it.location && it.location.toLowerCase().includes(city)) s += 1.2;

  return s;
}

export function rankListings(items: Listing[], opts: RankOpts = {}): Listing[] {
  const maxId = items.reduce((m, i) => Math.max(m, i.id), 1);
  return items
    .map((listing) => ({ listing, score: scoreListing(listing, opts, maxId) }))
    .sort((a, b) => b.score - a.score || b.listing.id - a.listing.id)
    .map((x) => x.listing);
}

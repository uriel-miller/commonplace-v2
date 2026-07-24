// Shared typo-tolerant matching used by the header search, the sell category
// picker, and the search page. Pure + dependency-free; every export is fail-soft.

import { CAT_GROUPS, ALL_CATS, type CatItem } from "@/components/marketplace/data";

/** Domain vocabulary for spelling correction (category words + common terms). */
export const VOCAB: string[] = Array.from(new Set(
  CAT_GROUPS
    .flatMap((g) => [g.name, ...g.items.flatMap((it) => [it.name, ...(it.children?.map((c) => c.name) ?? [])])])
    .flatMap((n) => n.toLowerCase().split(/[^a-z0-9+]+/))
    .filter((w) => w.length >= 3)
    .concat(["golf", "cart", "carts", "peloton", "treadmill", "elliptical", "rowing", "rower", "sauna", "jacuzzi", "fridge", "sofa", "sofas", "dresser", "scooter", "mower", "recumbent", "dumbbell", "kettlebell", "massage", "hottub", "spa", "bike", "tread", "tonal"]),
));

/** Levenshtein edit distance (iterative, O(n) memory). */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
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

/** Correct a token against the vocabulary, or return it unchanged. */
function correctToken(tok: string): string {
  if (tok.length < 3 || VOCAB.includes(tok)) return tok;
  const tol = tok.length <= 4 ? 1 : 2;
  let best = tok, bestD = tol + 1;
  for (const w of VOCAB) {
    if (Math.abs(w.length - tok.length) > tol) continue;
    const d = editDistance(tok, w);
    if (d > 0 && d < bestD) { bestD = d; best = w; }
  }
  return best;
}

/** Token-by-token spelling correction; returns the fixed string or null. */
export function correctQuery(q: string): string | null {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  let changed = false;
  const out = tokens.map((tok) => {
    const fixed = correctToken(tok);
    if (fixed !== tok) changed = true;
    return fixed;
  });
  return changed ? out.join(" ") : null;
}

/**
 * Best category for a possibly-misspelled query. Tries exact substring first,
 * then a spelling-corrected substring, then token edit-distance. Returns the
 * matched CatItem plus whether a correction was applied and the corrected text.
 */
export function fuzzyCategoryMatch(q: string): { cat: CatItem; corrected: string | null } | null {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return null;

  // 1) Exact substring either direction.
  for (const c of ALL_CATS) {
    const n = c.name.toLowerCase();
    if (n.includes(query) || (n.length > 3 && query.includes(n))) return { cat: c, corrected: null };
  }

  // 2) Spelling-corrected substring.
  const fixed = correctQuery(query);
  if (fixed && fixed !== query) {
    for (const c of ALL_CATS) {
      const n = c.name.toLowerCase();
      if (n.includes(fixed) || fixed.split(/\s+/).some((w) => w.length > 2 && n.includes(w))) return { cat: c, corrected: fixed };
    }
  }

  // 3) Token edit-distance against each category's name tokens.
  const qToks = query.split(/\s+/).filter((t) => t.length >= 3);
  let best: CatItem | null = null, bestScore = 0;
  for (const c of ALL_CATS) {
    const cToks = c.name.toLowerCase().split(/[^a-z0-9+]+/).filter((t) => t.length >= 3);
    if (!cToks.length) continue;
    let hits = 0;
    for (const qt of qToks) {
      if (cToks.some((ct) => editDistance(qt, ct) <= (qt.length <= 4 ? 1 : 2))) hits++;
    }
    const score = hits / Math.max(1, cToks.length);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (best && bestScore >= 0.5) return { cat: best, corrected: fixed && fixed !== query ? fixed : null };
  return null;
}

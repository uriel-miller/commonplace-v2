// Reusable resilience primitives — the "layered fallback" toolkit that API routes
// and data-layer helpers adopt so a single flaky call never surfaces an error to
// millions of users. Zero dependencies, strict TS, server- or edge-safe.
//
//   withRetry(fn, opts)      — retry an async fn with exponential backoff + jitter
//   withTimeout(promise, ms) — reject if a promise takes too long (bounded latency)
//   safeJson(fn, fallback)   — run an async fn, swallow any error, return a fallback
//
// These compose: e.g. safeJson(() => withRetry(() => withTimeout(fetchX(), 3000)), []).

/* --------------------------------- withRetry -------------------------------- */

export interface RetryOptions {
  /** Number of RETRIES after the first attempt (so total attempts = retries + 1). */
  retries?: number;
  /** Base backoff in ms for the first retry; doubles each subsequent retry. */
  backoffMs?: number;
  /** Upper bound on any single backoff delay (default 5000ms). */
  maxBackoffMs?: number;
  /** Add random jitter (0–100% of the delay) to avoid thundering herds. Default true. */
  jitter?: boolean;
  /** Return false to stop retrying a given error (e.g. a 4xx). Default: always retry. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Optional hook fired before each backoff sleep. */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn`, retrying on rejection with exponential backoff. Resolves with the first
 * successful result; rejects with the LAST error once retries are exhausted (or when
 * `shouldRetry` returns false). Never throws synchronously.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = Math.max(0, Math.floor(opts.retries ?? 3));
  const base = Math.max(0, opts.backoffMs ?? 200);
  const maxBackoff = Math.max(base, opts.maxBackoffMs ?? 5000);
  const jitter = opts.jitter ?? true;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // No attempts left, or caller vetoed a retry for this error.
      if (attempt === retries || !shouldRetry(err, attempt)) break;
      const exp = Math.min(maxBackoff, base * Math.pow(2, attempt));
      const delay = jitter ? Math.round(exp * (0.5 + Math.random() * 0.5)) : exp;
      opts.onRetry?.(err, attempt + 1, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/* -------------------------------- withTimeout ------------------------------- */

/** Error thrown when {@link withTimeout} elapses before its promise settles. */
export class TimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number, label?: string) {
    super(`${label ? label + " " : ""}timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Reject with a {@link TimeoutError} if `promise` hasn't settled within `ms`.
 * The underlying promise is NOT cancelled (JS can't) — it's simply abandoned.
 * The timer is always cleared so a fast promise never leaks a pending timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
  const timeoutMs = Math.max(0, ms);
  if (timeoutMs === 0) return promise; // 0/negative disables the timeout.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(timeoutMs, label)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/* --------------------------------- safeJson --------------------------------- */

/**
 * Run `fn` and return its result; on ANY thrown/rejected error, log a warning and
 * return `fallback` (or the result of a fallback factory). The "never let one bad
 * call break the response" primitive — ideal for read paths that can degrade to an
 * empty/default shape. `fn` may be sync or async; the return is always a Promise.
 */
export async function safeJson<T>(
  fn: () => T | Promise<T>,
  fallback: T | (() => T),
  label?: string,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (label) console.warn(`[resilience] ${label} failed; using fallback.`, err);
    return typeof fallback === "function" ? (fallback as () => T)() : fallback;
  }
}

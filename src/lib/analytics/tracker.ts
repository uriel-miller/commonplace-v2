"use client";

/*
 * Lightweight, resilient product-analytics client. Captures screens, clicks,
 * listing views, funnel steps, etc., and ships them to /api/track in batches.
 *
 * Design goals (Clarity++ foundation):
 *   - Never throw, never block the UI. Everything is wrapped + best-effort.
 *   - Stable `anonId` (localStorage) across sessions + a `sessionId`
 *     (sessionStorage) that resets after 30 minutes idle.
 *   - Batch events and flush on an interval, on tab hide, and on pagehide via
 *     navigator.sendBeacon so nothing is lost on navigation/close.
 *   - Tiny surface: track(), screen(), and helpers. Auto-captures [data-track].
 */

const ANON_KEY = "cp_anon_id";
const SESSION_KEY = "cp_session";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE = 200;

type Props = Record<string, unknown>;

interface QueuedEvent {
  anonId: string; sessionId: string; userId?: string | null;
  type: string; name: string; screen?: string | null; path?: string | null;
  listingId?: number | null; categorySlug?: string | null; props?: Props | null;
  referrer?: string | null; viewportW?: number | null; viewportH?: number | null; ts: number;
}

const isBrowser = () => typeof window !== "undefined";

function uid(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readLS(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function writeLS(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* ignore */ } }

function getAnonId(): string {
  let id = readLS(ANON_KEY);
  if (!id) { id = uid(); writeLS(ANON_KEY, id); }
  return id;
}

function getSessionId(): string {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; last: number };
      if (parsed?.id && now - parsed.last < SESSION_IDLE_MS) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: parsed.id, last: now }));
        return parsed.id;
      }
    }
    const id = uid();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, last: now }));
    return id;
  } catch {
    return getAnonId(); // fall back so events still group
  }
}

class Tracker {
  private queue: QueuedEvent[] = [];
  private screen: string | null = null;
  private userId: string | null = null;
  private started = false;

  init() {
    if (!isBrowser() || this.started) return;
    this.started = true;
    try {
      window.setInterval(() => this.flush(false), FLUSH_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") this.flush(true); });
      window.addEventListener("pagehide", () => this.flush(true));
      // Delegated click capture for elements marked data-track="name".
      document.addEventListener("click", (e) => this.onClick(e), { capture: true });
    } catch { /* ignore */ }
  }

  setUser(userId: string | null) { this.userId = userId; }
  setScreen(screen: string | null, props?: Props) {
    this.screen = screen;
    this.track("view", `screen:${screen ?? "unknown"}`, props);
  }

  track(type: string, name: string, props?: Props) {
    if (!isBrowser()) return;
    try {
      const ev: QueuedEvent = {
        anonId: getAnonId(),
        sessionId: getSessionId(),
        userId: this.userId,
        type, name,
        screen: this.screen,
        path: (() => { try { return location.pathname + location.search; } catch { return null; } })(),
        listingId: typeof props?.listingId === "number" ? props.listingId : null,
        categorySlug: typeof props?.categorySlug === "string" ? props.categorySlug : null,
        props: props ?? null,
        referrer: (() => { try { return document.referrer || null; } catch { return null; } })(),
        viewportW: (() => { try { return window.innerWidth; } catch { return null; } })(),
        viewportH: (() => { try { return window.innerHeight; } catch { return null; } })(),
        ts: Date.now(),
      };
      this.queue.push(ev);
      if (this.queue.length >= MAX_QUEUE) this.flush(false);
    } catch { /* never throw */ }
  }

  // Convenience helpers.
  screenView(screen: string, props?: Props) { this.setScreen(screen, props); }
  listingView(listingId: number, categorySlug?: string, props?: Props) { this.track("view", "listing:view", { listingId, categorySlug, ...props }); }
  click(name: string, props?: Props) { this.track("click", `click:${name}`, props); }
  funnel(flow: string, step: string, props?: Props) { this.track("funnel", `${flow}:${step}`, { flow, step, ...props }); }
  search(query: string, resultCount?: number) { this.track("search", "search:submit", { query, resultCount }); }

  private onClick(e: Event) {
    try {
      let el = e.target as HTMLElement | null;
      for (let i = 0; el && i < 6; i++, el = el.parentElement) {
        const name = el.getAttribute?.("data-track");
        if (name) {
          const props: Props = {};
          for (const attr of Array.from(el.attributes)) {
            if (attr.name.startsWith("data-track-")) props[attr.name.slice("data-track-".length)] = attr.value;
          }
          this.click(name, props);
          return;
        }
      }
    } catch { /* ignore */ }
  }

  flush(useBeacon: boolean) {
    if (!isBrowser() || this.queue.length === 0) return;
    const events = this.queue;
    this.queue = [];
    try {
      const payload = JSON.stringify({ events });
      if (useBeacon && navigator.sendBeacon) {
        const ok = navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
        if (!ok) this.queue.unshift(...events); // requeue on failure
        return;
      }
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true })
        .catch(() => { this.queue.unshift(...events); });
    } catch {
      this.queue.unshift(...events);
    }
  }
}

export const analytics = new Tracker();

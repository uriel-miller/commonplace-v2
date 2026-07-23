/**
 * grok.ts — typed xAI Grok chat-completions client.
 *
 * Faithful port of the HTTP layer in the production WordPress plugin
 * `auto-ai-product-generator` (AAPG) → `class-aapg-core.php::call_grok()`.
 * Same endpoint, auth header, timeout (45s) and retry policy (up to 3
 * attempts total with a fixed 2s backoff between tries, on network error,
 * non-2xx response, or unparseable JSON).
 *
 * The API key is read from the environment (XAI_API_KEY) — never hardcoded,
 * mirroring the plugin's `aapg_settings['api_key']` option.
 */

export type GrokRole = "system" | "user" | "assistant";

export interface GrokMessage {
  role: GrokRole;
  content: string;
}

export interface GrokCallOptions {
  /** Model id, e.g. "grok-3-latest" (AAPG production default). */
  model: string;
  /** Upper bound on generated tokens. AAPG uses 900. */
  maxTokens: number;
  /** Sampling temperature. AAPG uses 0.4. */
  temperature: number;
  /** Per-attempt HTTP timeout in ms. Default 45_000 (AAPG's 45s). */
  timeoutMs?: number;
  /** Max total attempts (including the first). Default 3 (AAPG). */
  maxAttempts?: number;
  /** Fixed backoff between attempts in ms. Default 2_000 (AAPG's sleep(2)). */
  backoffMs?: number;
}

export interface GrokResult {
  /** The assistant message text (first choice). */
  content: string;
  /** The raw parsed response body, for callers that need more. */
  raw: unknown;
}

const XAI_ENDPOINT = "https://api.x.ai/v1/chat/completions";

/** Thrown when Grok cannot be reached / returns an unusable response after all retries. */
export class GrokError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GrokError";
  }
}

interface XaiChoice {
  message?: { content?: unknown };
}
interface XaiResponse {
  choices?: XaiChoice[];
}

function extractContent(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const choices = (body as XaiResponse).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const content = choices[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** A multimodal content part (OpenAI/xAI shape) — text or an image URL/data-URI. */
export type GrokPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** A message whose content may be plain text OR an array of multimodal parts. */
export interface GrokPartsMessage {
  role: GrokRole;
  content: string | GrokPart[];
}

/**
 * Multimodal sibling of {@link callGrok} — accepts messages whose content can be
 * an array of text/image parts (for vision models like grok-2-vision). Same
 * endpoint, auth, timeout and retry policy. Kept separate so the text-only port
 * above stays byte-for-byte faithful to AAPG.
 */
export async function callGrokParts(
  messages: GrokPartsMessage[],
  opts: GrokCallOptions,
): Promise<GrokResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new GrokError("XAI_API_KEY is not configured in the environment.");

  const {
    model,
    maxTokens,
    temperature,
    timeoutMs = 45_000,
    maxAttempts = 3,
    backoffMs = 2_000,
  } = opts;

  const payload = JSON.stringify({ model, messages, max_tokens: maxTokens, temperature });
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(XAI_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        lastError = new GrokError(`xAI responded ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 500)}` : ""}`);
      } else {
        const body: unknown = await res.json().catch(() => null);
        const content = extractContent(body);
        if (content !== null) return { content, raw: body };
        lastError = new GrokError("xAI response missing choices[0].message.content.");
      }
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < maxAttempts) await sleep(backoffMs);
  }

  throw new GrokError(
    `Grok call failed after ${maxAttempts} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    lastError,
  );
}

/**
 * Call xAI Grok chat-completions with a single, typed message list.
 * Retries on transient failures; throws GrokError once all attempts are spent.
 */
export async function callGrok(
  messages: GrokMessage[],
  opts: GrokCallOptions,
): Promise<GrokResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new GrokError("XAI_API_KEY is not configured in the environment.");
  }

  const {
    model,
    maxTokens,
    temperature,
    timeoutMs = 45_000,
    maxAttempts = 3,
    backoffMs = 2_000,
  } = opts;

  const payload = JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(XAI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: payload,
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        // Non-2xx → treat as retryable (matches AAPG's non-200 retry).
        const detail = await res.text().catch(() => "");
        lastError = new GrokError(
          `xAI responded ${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 500)}` : ""}`,
        );
      } else {
        const body: unknown = await res.json().catch(() => null);
        const content = extractContent(body);
        if (content !== null) {
          return { content, raw: body };
        }
        // Unparseable / shape mismatch → retryable (matches AAPG).
        lastError = new GrokError("xAI response missing choices[0].message.content.");
      }
    } catch (err) {
      // Network error or timeout (AbortError) → retryable.
      lastError = err;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < maxAttempts) {
      await sleep(backoffMs);
    }
  }

  throw new GrokError(
    `Grok call failed after ${maxAttempts} attempt(s): ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
    lastError,
  );
}

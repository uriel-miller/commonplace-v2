/**
 * POST /api/ai/title — AI product title + description rewriter.
 *
 * Faithful 1:1 port of the production WordPress plugin
 * `auto-ai-product-generator` (AAPG) → `includes/class-aapg-core.php`:
 *   prepare_data() → build_prompt() → call_grok() → parse_ai_response() → finalize_title().
 *
 * The default AAPG prompt is reproduced VERBATIM below (the live DB option
 * `aapg_settings['prompt']` is empty in production, so the hardcoded default is
 * what actually runs). Model, params and parsing match production exactly:
 *   model=grok-3-latest, max_tokens=900, temperature=0.4, single user message,
 *   45s timeout, up to 3 retries. `location` is NEVER sent to the model — it is
 *   appended to the finalized title as " - City, ST" afterward.
 *
 * Fails soft: always returns 200 with a clear error field on failure — never crashes.
 */

import type { NextRequest } from "next/server";
import { callGrok, type GrokMessage } from "@/lib/grok";

export const dynamic = "force-dynamic";

const MODEL = "grok-3-latest";
const MAX_TOKENS = 900;
const TEMPERATURE = 0.4;

/** VERBATIM AAPG default prompt template (class-aapg-core.php::build_prompt). */
const PROMPT_TEMPLATE = `You are writing product listings for Commonplace — a trusted, delivery-enabled marketplace for buying and selling bulky items locally (think Pelotons, pianos, sofas, gym equipment, appliances).

Your job is to write a product title and description that helps a buyer understand exactly what they're looking at and feel confident about it.

PRODUCT CATEGORY:
{{category_name}}
{{seller_title_block}}{{seller_desc_block}}
PRODUCT DETAILS (all fields submitted by the seller):
{{field_list}}

---

TONE & VOICE:
- Warm, human, and confident — like a knowledgeable friend describing the item, not a spec sheet
- Short sentences. Active voice. No jargon unless it's genuinely useful to the buyer.
- Lead with what matters most: condition, key specs, what's included
- The description should make the buyer feel informed and reassured — not overwhelmed
- Do NOT sound robotic, do NOT use filler phrases like "This item is perfect for..."
- Do NOT include: contact info, pickup/delivery/location details, pricing, or anything about the seller

TITLE RULES (max 90 characters, no punctuation at end):
- Clear, specific, and searchable
- Include: year (if known), brand, model, condition, and 1-2 key specs
- Example format: "2021 Peloton Bike+ – Good Condition, Includes Shoes & Mat"
- Do NOT be creative with the title — buyers search for real words

DESCRIPTION RULES (2–3 paragraphs, separated by \\n\\n):

Paragraph 1 — The item itself:
- What it is, its condition, how it's been used, what's included
- Draw from BOTH the seller's description and the product details above
- Be specific — mention model, year, notable features that matter to a buyer

Paragraph 2 — Specs & details:
- Key technical specs, dimensions, or capabilities relevant to this type of item
- Anything a buyer would need to know before committing to purchase

Paragraph 3 (only if genuinely needed):
- Any additional notable features, accessories, or context
- Skip this paragraph entirely if paragraphs 1 and 2 already cover everything

---

Respond with ONLY valid JSON. No markdown, no explanation, no extra text:
{"title": "Your Title Here", "description": "Paragraph 1\\n\\nParagraph 2"}`;

/** Injected verbatim only when the seller supplied a title. */
const SELLER_TITLE_BLOCK = `
SELLER'S INTENDED TITLE (use as your primary signal for what this product is — improve it, don't just copy it):
{{listing_title}}
`;

/** Injected verbatim only when the seller supplied a description. */
const SELLER_DESC_BLOCK = `
SELLER'S DESCRIPTION (use for context — do NOT include contact info, pickup/delivery details, location, or pricing in your output):
{{seller_context}}
`;

// ── Request contract ────────────────────────────────────────────────────────

/** A single seller field: an ACF label + its value (arrays imploded with ", "). */
interface FieldEntry {
  label: string;
  value: string | number | Array<string | number>;
}

type FieldsInput =
  | string
  | FieldEntry[]
  | Record<string, string | number | Array<string | number>>;

interface LocationInput {
  city?: string;
  state?: string;
}

interface RewriteRequest {
  category?: string;
  listingTitle?: string;
  sellerContext?: string;
  fields?: FieldsInput;
  /** NOT sent to the model — used only to append " - City, ST" to the title. */
  location?: string | LocationInput;
}

interface RewriteResponse {
  title: string;
  description: string;
  error?: string;
}

// ── Field-list assembly (mirrors prepare_data field_list) ────────────────────

function implode(value: string | number | Array<string | number>): string {
  return Array.isArray(value) ? value.map((v) => String(v)).join(", ") : String(value);
}

function buildFieldList(fields: FieldsInput | undefined): string {
  if (fields == null) return "";
  if (typeof fields === "string") return fields.trim();

  const lines: string[] = [];
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (!f || typeof f.label !== "string") continue;
      const val = implode(f.value);
      if (val.trim() === "") continue;
      lines.push(`${f.label}: ${val}`);
    }
  } else {
    for (const [label, value] of Object.entries(fields)) {
      const val = implode(value);
      if (val.trim() === "") continue;
      lines.push(`${label}: ${val}`);
    }
  }
  return lines.join("\n");
}

// ── Prompt build (mirrors build_prompt str_replace) ──────────────────────────

function buildPrompt(req: RewriteRequest): string {
  const category = (req.category ?? "").trim() || "Item";
  const listingTitle = (req.listingTitle ?? "").trim();
  const sellerContext = (req.sellerContext ?? "").trim();
  const fieldList = buildFieldList(req.fields);

  const titleBlock = listingTitle
    ? SELLER_TITLE_BLOCK.replace("{{listing_title}}", listingTitle)
    : "";
  const descBlock = sellerContext
    ? SELLER_DESC_BLOCK.replace("{{seller_context}}", sellerContext)
    : "";

  return PROMPT_TEMPLATE.replace("{{category_name}}", category)
    .replace("{{seller_title_block}}", titleBlock)
    .replace("{{seller_desc_block}}", descBlock)
    .replace("{{field_list}}", fieldList);
}

// ── Response parse (mirrors parse_ai_response) ────────────────────────────────

interface ParsedAi {
  title: string;
  description: string;
}

function parseAiResponse(raw: string): ParsedAi | null {
  let text = raw.trim();
  // Strip ```json / ``` code fences.
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const tryDecode = (s: string): ParsedAi | null => {
    try {
      const obj = JSON.parse(s) as unknown;
      if (
        obj &&
        typeof obj === "object" &&
        typeof (obj as Record<string, unknown>).title === "string" &&
        typeof (obj as Record<string, unknown>).description === "string"
      ) {
        const o = obj as { title: string; description: string };
        return { title: o.title, description: o.description };
      }
    } catch {
      /* fall through to regex extraction */
    }
    return null;
  };

  const direct = tryDecode(text);
  if (direct) return direct;

  // Fallback: regex-extract the first {...} object (dotall).
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    const extracted = tryDecode(match[0]);
    if (extracted) return extracted;
  }
  return null;
}

// ── Title finalization (mirrors finalize_title) ──────────────────────────────

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", "district of columbia": "DC",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY",
};

function abbrevState(state: string): string {
  const s = state.trim();
  if (s === "") return "";
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const key = s.toLowerCase();
  return US_STATES[key] ?? s;
}

/** Resolve { city, state(abbrev) } from the request location, or null if unusable. */
function resolveCityState(location: RewriteRequest["location"]): { city: string; state: string } | null {
  if (!location) return null;

  if (typeof location === "object") {
    const city = (location.city ?? "").trim();
    const state = abbrevState(location.state ?? "");
    if (city && state) return { city, state };
    return null;
  }

  // String: parse "City, ST" / "..., City, State ZIP" style addresses from the tail.
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p !== "");
  if (parts.length < 2) return null;

  // Last non-empty segment may be "State" or "State ZIP".
  const tail = parts[parts.length - 1].replace(/\b\d{5}(?:-\d{4})?\b/, "").trim();
  const stateAbbrev = abbrevState(tail);
  const city = parts[parts.length - 2];
  if (city && stateAbbrev) return { city, state: stateAbbrev };
  return null;
}

function finalizeTitle(modelTitle: string, location: RewriteRequest["location"]): string {
  // Strip trailing .!? and collapse whitespace.
  let title = modelTitle.replace(/[.!?]+\s*$/g, "");
  title = title.replace(/\s+/g, " ").trim();

  const loc = resolveCityState(location);
  if (loc) {
    title = `${title} - ${loc.city}, ${loc.state}`;
  }
  return title;
}

// ── Handler ──────────────────────────────────────────────────────────────────

function softError(message: string): Response {
  const body: RewriteResponse = { title: "", description: "", error: message };
  return Response.json(body, { status: 200 });
}

export async function POST(req: NextRequest): Promise<Response> {
  let payload: RewriteRequest;
  try {
    payload = (await req.json()) as RewriteRequest;
  } catch {
    return softError("Invalid JSON body.");
  }

  if (!payload || typeof payload !== "object") {
    return softError("Request body must be a JSON object.");
  }

  try {
    const prompt = buildPrompt(payload);
    const messages: GrokMessage[] = [{ role: "user", content: prompt }];

    const { content } = await callGrok(messages, {
      model: MODEL,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });

    const parsed = parseAiResponse(content);
    if (!parsed) {
      return softError("Could not parse a {title, description} object from the AI response.");
    }

    const title = finalizeTitle(parsed.title, payload.location);
    const description = parsed.description.trim();

    if (title === "" || description === "") {
      return softError("AI returned an empty title or description.");
    }

    const body: RewriteResponse = { title, description };
    return Response.json(body, { status: 200 });
  } catch (err) {
    return softError(err instanceof Error ? err.message : String(err));
  }
}

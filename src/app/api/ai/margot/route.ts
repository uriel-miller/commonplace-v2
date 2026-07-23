/**
 * POST /api/ai/margot — "Margot", Commonplace's AI listing concierge.
 *
 * A conversational, Jack-style assistant (Jack is the outbound voice agent; this
 * is its listing-creation sibling). The seller chats — or drops a photo — and
 * Margot gathers what's needed to create a listing, then emits a structured
 * field block the client uses to prefill/submit the sell form.
 *
 * Multimodal: when a photo (data-URI) is supplied, we use a vision model so
 * Margot can identify the item from the picture ("drop a photo and Margot fills
 * in the details"). Text-only turns use the standard chat model.
 *
 * Fails soft: ALWAYS returns 200. On any error (missing key, Grok down, bad
 * JSON) it returns a friendly reply that routes the seller to the quick form,
 * so the concierge can never hard-break the sell page.
 */

import type { NextRequest } from "next/server";
import { callGrok, callGrokParts, type GrokMessage, type GrokPartsMessage } from "@/lib/grok";

export const dynamic = "force-dynamic";

const TEXT_MODEL = "grok-3-latest";
const VISION_MODEL = "grok-2-vision-1212";
const MAX_TOKENS = 700;
const TEMPERATURE = 0.5;

/** Category vocabulary Margot maps items onto (mirrors the sell form groups). */
const CATEGORIES =
  "Fitness (Peloton Bike, Peloton Bike+, Peloton Tread, Treadmill, Spin/Exercise Bike, Rowing Machine, Elliptical, Tonal, Home Gym, Functional Trainer), " +
  "Wellness (Hot Tub, Sauna, Cold Plunge, Swim Spa, Massage Chair), " +
  "Vehicles (Car/Truck, Golf Cart, ATV, RV/Motorhome), " +
  "or a generic item (furniture, appliances, etc.).";

const SYSTEM_PROMPT = `You are Margot, the friendly AI listing concierge for Commonplace — a delivery-enabled marketplace for big, bulky items. You help sellers create a listing the easy way, like a warm, efficient phone agent.

Style: short, friendly, one question at a time. Never dump a form. Sound human.

Goal: gather enough to draft a great listing — what the item is (brand/model/year if known), its condition, roughly what they want for it, and 1–2 key details. Map it to one of: ${CATEGORIES}

When you have enough to draft the listing (or the seller says just go), append a fenced JSON block to your reply EXACTLY in this shape (no extra keys), and set "ready" true:
\`\`\`json
{"title":"clear searchable title","category":"best matching category name","price":1234,"condition":"New|Like new|Excellent|Good|Fair","brand":"","year":"","details":"one short paragraph a buyer would want","ready":true}
\`\`\`
Before you have enough, still include the block with "ready":false and your best partial guesses. Keep the conversational reply ABOVE the JSON block and never mention the JSON to the seller.`;

interface MargotField {
  title?: string;
  category?: string;
  price?: number;
  condition?: string;
  brand?: string;
  year?: string;
  details?: string;
  ready?: boolean;
}

interface MargotResponse {
  reply: string;
  fields: MargotField | null;
  error?: string;
}

interface MargotRequest {
  messages?: Array<{ role?: string; content?: string }>;
  photoDataUrl?: string;
}

/** Split the assistant text into a human reply + parsed JSON field block. */
function splitReply(raw: string): { reply: string; fields: MargotField | null } {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let fields: MargotField | null = null;
  let reply = raw;

  if (fence) {
    reply = raw.replace(fence[0], "").trim();
    try {
      fields = JSON.parse(fence[1].trim()) as MargotField;
    } catch {
      fields = null;
    }
  }
  if (!fields) {
    // Last-ditch: try a bare {...} object anywhere in the text.
    const bare = raw.match(/\{[\s\S]*"ready"[\s\S]*\}/);
    if (bare) {
      try {
        fields = JSON.parse(bare[0]) as MargotField;
        reply = raw.replace(bare[0], "").trim();
      } catch {
        /* ignore */
      }
    }
  }
  // Never show a stray fence to the user.
  reply = reply.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  if (!reply) reply = "Got it — tell me a bit more and I'll put your listing together.";
  return { reply, fields };
}

function softReply(message: string): Response {
  const body: MargotResponse = {
    reply: message,
    fields: null,
    error: "fallback",
  };
  return Response.json(body, { status: 200 });
}

const FALLBACK =
  "I'm having a little trouble connecting right now — no worries. You can type your item name below and hit Sell Now, and I'll help polish the details.";

export async function POST(req: NextRequest): Promise<Response> {
  let payload: MargotRequest;
  try {
    payload = (await req.json()) as MargotRequest;
  } catch {
    return softReply(FALLBACK);
  }

  const history = Array.isArray(payload?.messages) ? payload.messages : [];
  const clean = history
    .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 4000) }));

  const photo = typeof payload?.photoDataUrl === "string" && payload.photoDataUrl.startsWith("data:image/")
    ? payload.photoDataUrl
    : null;

  try {
    if (photo) {
      // Vision turn — attach the image to the latest user message.
      const lastText = clean.length && clean[clean.length - 1].role === "user"
        ? clean[clean.length - 1].content
        : "Here's a photo of my item — identify it and start my listing.";
      const priorText = clean.slice(0, clean.length && clean[clean.length - 1].role === "user" ? -1 : undefined);

      const messages: GrokPartsMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...priorText.map((m) => ({ role: m.role, content: m.content })),
        {
          role: "user",
          content: [
            { type: "text", text: lastText },
            { type: "image_url", image_url: { url: photo } },
          ],
        },
      ];
      const { content } = await callGrokParts(messages, {
        model: VISION_MODEL,
        maxTokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      });
      const { reply, fields } = splitReply(content);
      return Response.json({ reply, fields } satisfies MargotResponse, { status: 200 });
    }

    // Text-only turn.
    const messages: GrokMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(clean.length ? clean : [{ role: "user" as const, content: "Hi, I want to sell something." }]),
    ];
    const { content } = await callGrok(messages, {
      model: TEXT_MODEL,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    });
    const { reply, fields } = splitReply(content);
    return Response.json({ reply, fields } satisfies MargotResponse, { status: 200 });
  } catch {
    return softReply(FALLBACK);
  }
}

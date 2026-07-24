// Minimal, fail-soft SMS sender. Commonplace sends texts through Quo (the
// rebranded OpenPhone) whose REST API is compatible with the OpenPhone one.
//
// This never throws. When no provider is configured (no QUO_API_KEY /
// QUO_FROM_NUMBER) it returns { sent:false } so callers can degrade to
// showing the seller an on-screen code + link instead of a text.

export interface SendSmsResult {
  sent: boolean;
  /** Present when the send failed or was skipped — for logs, never shown raw to users. */
  reason?: string;
}

/** Normalize a US 10-digit (or +1) number to E.164 (+1XXXXXXXXXX). Null if unusable. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

/**
 * Send an SMS. Bounded by an AbortController timeout; any failure resolves to
 * { sent:false } rather than throwing.
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const apiKey = process.env.QUO_API_KEY ?? process.env.OPENPHONE_API_KEY;
  const from = process.env.QUO_FROM_NUMBER ?? process.env.OPENPHONE_FROM_NUMBER;
  const e164 = toE164(to);

  if (!apiKey || !from) return { sent: false, reason: "no-provider" };
  if (!e164) return { sent: false, reason: "bad-number" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ from, to: [e164], content: body }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { sent: false, reason: `provider-${res.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

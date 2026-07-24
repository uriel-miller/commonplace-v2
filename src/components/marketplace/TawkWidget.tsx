"use client";

import { useEffect, useRef, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";

/**
 * Commonplace "Customer Support" chat widget — a self-contained replica of the
 * live tawk-configured chat (maroon header, welcome greeting, quick-reply
 * buttons, message input). Replaces the raw tawk widget so there is a single
 * launcher (no duplicate-icon glitch) and the exact configured look.
 *
 * Quick replies route into the app (sell / search / track); free-text replies
 * get a friendly hand-off message. Everything is fail-soft and keyboard-safe.
 */

const PLUM = "#5B1A38";

interface Msg { role: "assistant" | "user"; text: string; actionLabel?: string; action?: () => void }

export function TawkWidget({ onSell, onSearch, onTrack }: { onSell?: () => void; onSearch?: () => void; onTrack?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "👋 Hi! Welcome to Commonplace. How can we help?" },
  ]);
  const [input, setInput] = useState("");
  const [showQuick, setShowQuick] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const QUICK: { emoji: string; label: string; reply: string; action?: () => void; actionLabel?: string }[] = [
    { emoji: "🏷️", label: "I want to be a seller", reply: "Awesome! Listing is completely free — tell us what you're selling and we handle pickup, white-glove delivery, and payment. Ready to start?", action: onSell, actionLabel: "Create a listing →" },
    { emoji: "🔍", label: "I'm looking for a specific item", reply: "Happy to help you find it! Search from the bar up top, or browse by category — everything is inspected and delivered.", action: onSearch, actionLabel: "Search listings →" },
    { emoji: "💬", label: "I have a question about an order", reply: "No problem — you can track your order any time with your order number, or ask me right here.", action: onTrack, actionLabel: "Track my order →" },
  ];

  function pushAssistant(text: string, action?: () => void, actionLabel?: string) {
    setMessages((m) => [...m, { role: "assistant", text, action, actionLabel }]);
  }
  function pickQuick(q: (typeof QUICK)[number]) {
    setMessages((m) => [...m, { role: "user", text: q.label }]);
    setShowQuick(false);
    setTimeout(() => pushAssistant(q.reply, q.action, q.actionLabel), 250);
  }
  function send() {
    const t = input.trim();
    if (!t) return;
    setMessages((m) => [...m, { role: "user", text: t }]);
    setInput("");
    setShowQuick(false);
    setTimeout(() => pushAssistant("Thanks! A Commonplace teammate will jump in shortly. Meanwhile you can browse listings, start selling, or track an order any time."), 300);
  }

  return (
    <>
      {/* Launcher bubble (single icon — no tawk duplicate) */}
      {!open && (
        <Hoverable as="button" onClick={() => setOpen(true)} aria-label="Chat with support"
          styles={`position:fixed;right:20px;bottom:20px;z-index:500;width:46px;height:46px;border-radius:50%;background:${PLUM};color:#fff;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 18px rgba(91,26,46,.42);transition:transform .15s`}
          hover="transform:scale(1.07)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 20l1.4-4.6a8.5 8.5 0 0 1-.9-3.9 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 9 8.5Z" /></svg>
        </Hoverable>
      )}

      {/* Chat panel */}
      {open && (
        <div style={css("position:fixed;right:20px;bottom:20px;z-index:500;width:360px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100dvh - 40px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(30,10,25,.28);display:flex;flex-direction:column")}>
          {/* Header */}
          <div style={css(`background:${PLUM};color:#fff;display:flex;align-items:center;gap:10px;padding:16px 18px`)}>
            <button onClick={() => setOpen(false)} aria-label="Close chat" style={css("background:none;border:none;color:#fff;cursor:pointer;display:flex;padding:0")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span style={css("font-size:18px;font-weight:700;flex:1")}>Customer Support</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={css("flex:1;overflow-y:auto;padding:18px 16px;display:flex;flex-direction:column;gap:12px;background:#fff")}>
            {messages.map((m, i) => (
              m.role === "assistant" ? (
                <div key={i} style={css("display:flex;flex-direction:column;gap:6px")}>
                  {i === 0 && <div style={css("font-size:12.5px;color:var(--muted);margin-bottom:2px")}>Customer Support</div>}
                  <div style={css("display:flex;align-items:flex-start;gap:9px")}>
                    <span style={css(`width:36px;height:36px;flex:0 0 auto;border-radius:50%;background:#e9e2e6;display:flex;align-items:center;justify-content:center;overflow:hidden`)}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#8a7683"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7Z" /></svg>
                    </span>
                    <div style={css(`background:${PLUM};color:#fff;border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.5;max-width:78%`)}>{m.text}</div>
                  </div>
                  {m.action && m.actionLabel && (
                    <Hoverable as="button" onClick={() => { m.action?.(); setOpen(false); }} styles={`align-self:flex-start;margin-left:45px;background:#fff;color:${PLUM};border:1.5px solid ${PLUM};border-radius:22px;padding:9px 16px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit`} hover="background:#fbf3f7">{m.actionLabel}</Hoverable>
                  )}
                </div>
              ) : (
                <div key={i} style={css("align-self:flex-end;background:var(--putty);color:var(--ink);border-radius:14px;padding:10px 14px;font-size:14px;line-height:1.45;max-width:80%")}>{m.text}</div>
              )
            ))}

            {/* Quick replies */}
            {showQuick && (
              <div style={css("display:flex;flex-direction:column;gap:9px;align-items:flex-end;margin-top:2px")}>
                {QUICK.map((q) => (
                  <Hoverable key={q.label} as="button" onClick={() => pickQuick(q)}
                    styles={`background:#fff;color:${PLUM};border:1.5px solid ${PLUM};border-radius:12px;padding:11px 15px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left`}
                    hover="background:#fbf3f7">
                    {q.emoji} {q.label}
                  </Hoverable>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={css("border-top:1px solid var(--line);padding:12px 14px;display:flex;align-items:center;gap:8px")}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Type here and press enter.." style={css("flex:1;min-width:0;border:none;outline:none;background:transparent;font-size:14px;color:var(--ink);font-family:inherit")} />
            <button onClick={send} aria-label="Send" style={css("background:none;border:none;cursor:pointer;color:var(--muted);display:flex")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21.4 11.1 3.5 3.2a.5.5 0 0 0-.7.6l2.2 6.9a1 1 0 0 0 .8.7l8.2 1.1a.3.3 0 0 1 0 .6l-8.2 1.1a1 1 0 0 0-.8.7l-2.2 6.9a.5.5 0 0 0 .7.6l17.9-7.9a1 1 0 0 0 0-1.8Z" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default TawkWidget;

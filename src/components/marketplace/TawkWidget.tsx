"use client";

import { useEffect } from "react";
import { Hoverable } from "@/lib/design/css";

/**
 * Loads the live tawk.to chat (real Commonplace support), but suppresses tawk's
 * own auto-popup launcher and proactive "We Are Here" greeting — we hide tawk's
 * widget on load and provide our own bubble that opens the chat ONLY on click.
 * Fail-soft: any error is swallowed so the app never breaks.
 */
const TAWK_SRC = "https://embed.tawk.to/6997309073d8cb1c357e60ef/1jhr9bdfl";

type TawkApi = {
  onLoad?: () => void;
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  onChatMinimized?: () => void;
};

export function TawkWidget() {
  useEffect(() => {
    try {
      const w = window as unknown as { Tawk_API?: TawkApi; Tawk_LoadStart?: Date };
      w.Tawk_API = w.Tawk_API || {};
      w.Tawk_LoadStart = new Date();
      // On load, hide tawk's default launcher + any proactive greeting.
      w.Tawk_API.onLoad = function () { try { w.Tawk_API?.hideWidget?.(); } catch { /* ignore */ } };
      // When the visitor closes the chat, hide the launcher again so the
      // proactive bubble never reappears on its own.
      w.Tawk_API.onChatMinimized = function () { try { w.Tawk_API?.hideWidget?.(); } catch { /* ignore */ } };

      if (document.getElementById("tawk-embed-script")) return;
      const s = document.createElement("script");
      s.id = "tawk-embed-script";
      s.async = true;
      s.src = TAWK_SRC;
      s.charset = "UTF-8";
      s.setAttribute("crossorigin", "*");
      document.body.appendChild(s);
    } catch {
      /* tawk unavailable — non-fatal */
    }
  }, []);

  function openChat() {
    try {
      const w = window as unknown as { Tawk_API?: TawkApi };
      w.Tawk_API?.showWidget?.();
      w.Tawk_API?.maximize?.();
    } catch {
      /* ignore */
    }
  }

  return (
    <Hoverable
      as="button"
      onClick={openChat}
      aria-label="Chat with support"
      styles="position:fixed;right:22px;bottom:22px;z-index:500;width:54px;height:54px;border-radius:50%;background:var(--maroon);color:#fff;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 22px rgba(91,26,46,.45);transition:transform .15s"
      hover="transform:scale(1.07)"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 20l1.4-4.6a8.5 8.5 0 0 1-.9-3.9 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 9 8.5Z" />
      </svg>
    </Hoverable>
  );
}

export default TawkWidget;

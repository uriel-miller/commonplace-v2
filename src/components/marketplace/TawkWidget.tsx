"use client";

import { useEffect } from "react";

/**
 * Injects the live tawk.to chat widget (the real Commonplace support chatbot).
 * Property/widget IDs match trycommonplace.com. Fail-soft: any injection error
 * is swallowed so the app never breaks if tawk is unreachable.
 */
const TAWK_SRC = "https://embed.tawk.to/6997309073d8cb1c357e60ef/1jhr9bdfl";

export function TawkWidget() {
  useEffect(() => {
    try {
      if (document.getElementById("tawk-embed-script")) return;
      // tawk's own globals
      (window as unknown as { Tawk_API?: unknown }).Tawk_API =
        (window as unknown as { Tawk_API?: unknown }).Tawk_API || {};
      (window as unknown as { Tawk_LoadStart?: Date }).Tawk_LoadStart = new Date();

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

  return null;
}

export default TawkWidget;

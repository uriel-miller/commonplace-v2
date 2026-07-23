import { type ReactNode } from "react";
import { css } from "@/lib/design/css";

/**
 * Shared layout frame for every info/marketing page: warm cream canvas with a
 * centered, readable prose column (~760px). Server-friendly — no client runtime.
 */
export function InfoPageShell({ children }: { children: ReactNode }) {
  return (
    <div style={css("background:var(--cream);min-height:100%;width:100%")}>
      <div
        style={css(
          "max-width:760px;margin:0 auto;padding:56px 22px 96px;color:var(--ink)",
        )}
      >
        {children}
      </div>
    </div>
  );
}

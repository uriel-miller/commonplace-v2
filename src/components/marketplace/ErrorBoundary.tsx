"use client";

import { Component, type ReactNode } from "react";
import { css } from "@/lib/design/css";

/**
 * Guardrail: catches render/runtime errors in any view so a single bad screen
 * degrades to a friendly fallback instead of white-screening the whole app.
 * Ships to millions — no uncaught view crash should take down the shell.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[Commonplace] view error:", error);
  }

  reset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={css("padding:70px 20px;text-align:center;color:var(--muted)")}>
          <div style={css("font-family:'Newsreader',serif;font-size:22px;color:var(--ink);margin-bottom:6px")}>Something went wrong loading this view</div>
          <div style={css("font-size:14px;margin-bottom:16px")}>It&apos;s not you — try again or head back to browsing.</div>
          <button onClick={this.reset} style={css("background:var(--maroon);color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit")}>Back to Browse</button>
        </div>
      );
    }
    return this.props.children;
  }
}

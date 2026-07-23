"use client";

import { useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import { Close } from "@/components/marketplace/icons";

/* ---------------------------------------------------------------------------
   Media sections — "Why Commonplace" learn videos + Google reviews link.
   Data ported verbatim from the live site's `section.v2__why` markup.
--------------------------------------------------------------------------- */

/** Authoritative Google Business Profile place URL (CID form). */
export const GOOGLE_REVIEWS_URL = "https://maps.google.com/?cid=9028775858360845466";

type VideoKey = "why" | "delivery" | "offers" | "pickup";

interface LearnVideo {
  key: VideoKey;
  title: string;
  youtubeId: string;
  blurb: string;
  /** Poster gradient stops (design-system tokens). */
  from: string;
  to: string;
}

const VIDEOS: LearnVideo[] = [
  {
    key: "why",
    title: "What is Commonplace",
    youtubeId: "QZAyLOrvRBk",
    blurb: "Nethaniel from Commonplace explains our process, from start to finish.",
    from: "var(--maroon)",
    to: "var(--maroon2)",
  },
  {
    key: "delivery",
    title: "How Delivery Works",
    youtubeId: "6wDf6DM1Qxs",
    blurb: "Naomi from Commonplace walks you through our delivery process.",
    from: "var(--blueInk)",
    to: "var(--blue)",
  },
  {
    key: "offers",
    title: "How Offers Work",
    youtubeId: "GECSvwp3u10",
    blurb: 'Ari from Commonplace explains how the "make an offer" feature works.',
    from: "var(--gold)",
    to: "#E0A94A",
  },
  {
    key: "pickup",
    title: "How Pickup Works",
    youtubeId: "pL03sBZGS34",
    blurb: "Ari from Commonplace shares how pickup works from inspection to payment.",
    from: "var(--red)",
    to: "#D47A66",
  },
];

/* ------------------------------- Play icon ------------------------------- */
function PlayIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.5-6.86a1 1 0 0 0 0-1.7L9.52 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

/* ------------------------------- Video modal ------------------------------- */
function VideoModal({ video, onClose }: { video: LearnVideo; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={css(
        "position:fixed;inset:0;background:rgba(25,12,18,.72);display:flex;align-items:center;justify-content:center;z-index:300;padding:20px;animation:fade .15s ease both",
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={css(
          "width:900px;max-width:94vw;background:#000;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55);animation:pop .2s ease both;position:relative",
        )}
      >
        <div
          onClick={onClose}
          role="button"
          aria-label="Close video"
          style={css(
            "position:absolute;top:12px;right:12px;z-index:2;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;cursor:pointer",
          )}
        >
          <Close />
        </div>
        <div style={css("position:relative;width:100%;aspect-ratio:16/9;background:#000")}>
          <iframe
            src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={css("position:absolute;inset:0;width:100%;height:100%;border:none")}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Poster card ------------------------------- */
function VideoCard({ video, onOpen }: { video: LearnVideo; onOpen: () => void }) {
  return (
    <Hoverable
      as="button"
      onClick={onOpen}
      styles="text-align:left;padding:0;border:none;cursor:pointer;background:var(--paper);border-radius:14px;overflow:hidden;box-shadow:0 3px 10px rgba(60,10,35,.06);transition:box-shadow .2s ease,transform .2s ease;display:flex;flex-direction:column;animation:pop .3s ease both"
      hover="box-shadow:0 18px 40px rgba(60,10,35,.2);transform:translateY(-2px)"
    >
      <div
        style={sx("position:relative;aspect-ratio:16/10;display:flex;align-items:center;justify-content:center", {
          background: `linear-gradient(135deg,${video.from} 0%,${video.to} 100%)`,
        })}
      >
        <div
          style={css(
            "width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.18);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.25)",
          )}
        >
          <div
            style={css(
              "width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center",
            )}
          >
            <PlayIcon />
          </div>
        </div>
      </div>
      <div style={css("padding:13px 14px 15px")}>
        <div style={css("font-family:'Newsreader',serif;font-size:16px;font-weight:600;line-height:1.25;color:var(--ink)")}>
          {video.title}
        </div>
        <div style={css("font-size:12px;color:var(--muted);line-height:1.45;margin-top:6px")}>{video.blurb}</div>
      </div>
    </Hoverable>
  );
}

/* ------------------------------- Learn videos ------------------------------- */
export function LearnVideos() {
  const [active, setActive] = useState<LearnVideo | null>(null);

  return (
    <section style={css("margin:0 auto;padding:8px 0")}>
      <div style={css("margin-bottom:16px")}>
        <div style={css("font-family:'Newsreader',serif;font-size:26px;font-weight:600;letter-spacing:-.3px;color:var(--ink)")}>
          Why Commonplace?
        </div>
        <div style={css("font-size:13px;color:var(--muted);margin-top:4px")}>
          Short walkthroughs of how buying, offers, delivery, and pickup work.
        </div>
      </div>
      <div style={css("display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px")}>
        {VIDEOS.map((v) => (
          <VideoCard key={v.key} video={v} onOpen={() => setActive(v)} />
        ))}
      </div>
      {active && <VideoModal video={active} onClose={() => setActive(null)} />}
    </section>
  );
}

/* ------------------------------- See all reviews ------------------------------- */
export function SeeAllReviews() {
  return (
    <Hoverable
      as="a"
      href={GOOGLE_REVIEWS_URL}
      target="_blank"
      rel="noopener noreferrer"
      styles="display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:var(--maroon);text-decoration:none;padding:8px 14px;border:1px solid var(--line);border-radius:10px;background:var(--paper);transition:border-color .2s ease,background .2s ease"
      hover="border-color:#d9b7c2;background:var(--tint)"
    >
      See all reviews on Google
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </svg>
    </Hoverable>
  );
}

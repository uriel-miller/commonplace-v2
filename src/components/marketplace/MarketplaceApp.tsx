"use client";

import { useEffect, useState } from "react";
import { css, sx, Hoverable } from "@/lib/design/css";
import {
  CAT_GROUPS,
  REVIEWS,
  ARTICLES,
  CONDITIONS,
  BROWSE_CHIPS,
  ALL_CATEGORY_NAMES,
  type CatItem,
} from "./data";
import { resolveSellSpec, type Field } from "./sellSchema";
import { fetchListings } from "@/lib/clientApi";
import { formatPrice, type Listing } from "@/lib/listing";
import { Chevron, ChevronRight, ChevronLeft, Pin, Plus, Close, Search } from "./icons";
import { useCart } from "@/components/cart/CartProvider";
import { CartPage } from "@/components/cart/CartPage";
import { AccountPage } from "@/components/pages/account/AccountPage";
import { SearchPage } from "@/components/pages/search/SearchPage";
import { resolveInfoPage } from "@/components/pages/info";
import { ProductPage } from "@/components/product/ProductPage";
import { AddressAutocomplete } from "@/components/sell/AddressAutocomplete";
import { GOOGLE_REVIEWS_URL } from "./mediaSections";
import { ErrorBoundary } from "./ErrorBoundary";

const LEARN_VIDEOS = [
  { title: "What is Commonplace", blurb: "The whole process, start to finish.", id: "QZAyLOrvRBk", accent: "var(--maroon)", g1: "#efe4d5", g2: "#e6dac9" },
  { title: "How Delivery Works", blurb: "Pickup, transport, and setup.", id: "6wDf6DM1Qxs", accent: "var(--blue)", g1: "#e3ebf5", g2: "#d7e2f0" },
  { title: "How Offers Work", blurb: "Make an offer and bidding.", id: "GECSvwp3u10", accent: "var(--gold)", g1: "#f3ead2", g2: "#ece0c4" },
  { title: "How Pickup Works", blurb: "Inspection to payment.", id: "pL03sBZGS34", accent: "var(--red)", g1: "#f3e0da", g2: "#ecd3cb" },
];

const LOGO = "/design-assets/805cd68e-4bc0-474c-9062-282704b82b24.svg";

type View = "browse" | "category" | "buying" | "selling" | "product" | "account" | "search" | "cart" | "info";

// Root CSS custom properties, ported verbatim from the design wrapper (the
// canvas-scaling hacks — zoom/125vw/125vh — are dropped so it renders 1:1).
const ROOT_VARS =
  "--cream:#FAF5EE;--paper:#ffffff;--ink:#231A1D;--muted:#7C7069;--line:#ECE4D8;--maroon:#5B1A2E;--maroon2:#7A2740;--tint:#F4E7EA;--putty:#f6f1ea;--gold:#C98A22;--blue:#7FA8D9;--purple:#9C88D6;--yellow:#E7C24B;--red:#C15540;--green:#3B7A57;--greenBg:#E1F0E7;--blueBg:#E4EDF8;--blueInk:#2C5B8A;--fbblue:#1877F2;--fbbtn:#E7F3FF;--yellowBg:#F7EDCE";

export function MarketplaceApp() {
  const [view, setView] = useState<View>("browse");
  const [category, setCategory] = useState<CatItem | null>(null);
  const [product, setProduct] = useState<Listing | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [infoSlug, setInfoSlug] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const cart = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [locCity, setLocCity] = useState("Austin, TX");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ "Fitness equipment": true });
  const [conds, setConds] = useState<Set<string>>(new Set());
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  const notCategory = view !== "category";
  const isCategory = view === "category";

  function openCategory(item: CatItem) {
    setCategory(item);
    setView("category");
  }
  function openProduct(item: Listing) {
    setProduct(item);
    setView("product");
  }
  function goBrowse() {
    setView("browse");
    setCategory(null);
    setProduct(null);
    setInfoSlug(null);
  }
  function openInfo(slug: string) {
    setInfoSlug(slug);
    setView("info");
  }
  const showSidebar = view !== "account" && view !== "cart" && view !== "info";
  function toggleCond(key: string) {
    setConds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div
      style={sx(
        ROOT_VARS,
        "font-family:'Inter Tight',system-ui,-apple-system,'Helvetica Neue',sans-serif;color:var(--ink);height:100dvh;width:100%;display:flex;flex-direction:column;background:var(--cream);overflow:hidden",
      )}
    >
      {/* ============================ HEADER ============================ */}
      <header style={css("flex:0 0 auto;height:62px;background:var(--paper);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:16px;padding:0 18px;z-index:20")}>
        <div onClick={goBrowse} style={css("display:flex;align-items:center;flex:0 0 auto;cursor:pointer;padding-right:6px")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Commonplace" style={css("height:26px;width:auto;display:block")} />
        </div>
        <div onClick={() => { setSearchQuery(""); setView("search"); }} style={css("flex:0 1 380px;display:flex;align-items:center;gap:8px;background:#F1EBE1;border-radius:22px;padding:10px 16px;color:var(--muted);cursor:pointer")}>
          <Search />
          <span style={css("font-size:14px")}>Search Commonplace</span>
        </div>
        <div style={css("display:flex;align-items:center;gap:20px;font-size:13px;font-weight:600;color:var(--muted);flex:0 0 auto;white-space:nowrap")}>
          <Hoverable onClick={() => openInfo("about")} styles="cursor:pointer" hover="color:var(--ink)">About Us</Hoverable>
          <Hoverable onClick={() => openInfo("refer")} styles="cursor:pointer" hover="color:var(--ink)">Refer</Hoverable>
          <Hoverable onClick={() => openInfo("contact")} styles="cursor:pointer" hover="color:var(--ink)">Contact Us</Hoverable>
          <Hoverable onClick={() => window.open(GOOGLE_REVIEWS_URL, "_blank", "noopener")} styles="cursor:pointer" hover="color:var(--ink)">Reviews</Hoverable>
          <div style={css("position:relative")}>
            <div onClick={() => setMenuOpen((v) => !v)} style={css("display:flex;align-items:center;gap:5px;cursor:pointer;color:var(--ink);font-weight:700")}>
              Terms &amp; Conditions
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} style={sx("transition:transform .2s", { transform: menuOpen ? "rotate(180deg)" : "none" })}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            {menuOpen && (
              <div style={css("position:absolute;top:calc(100% + 12px);right:0;background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 16px 40px rgba(60,10,35,.16);padding:6px;min-width:214px;z-index:60;animation:fade .15s ease")}>
                {[
                  ["Terms & Conditions", "terms"],
                  ["Warranty", "warranty"],
                  ["Return Policy", "return-policy"],
                  ["Privacy Policy", "privacy"],
                ].map(([label, slug]) => (
                  <Hoverable key={slug} onClick={() => { setMenuOpen(false); openInfo(slug); }} styles="display:block;padding:9px 12px;border-radius:8px;font-size:13.5px;font-weight:600;color:var(--ink);cursor:pointer" hover="background:var(--putty)">
                    {label}
                  </Hoverable>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={css("flex:1")} />
        <div onClick={() => setView("selling")} style={css("font-size:14px;font-weight:700;color:var(--maroon);cursor:pointer;padding:0 6px;white-space:nowrap;flex:0 0 auto")}>Sell an item</div>
        <Hoverable title="Cart" onClick={() => setView("cart")} styles="position:relative;width:40px;height:40px;flex:0 0 auto;border-radius:50%;background:var(--blueBg);display:flex;align-items:center;justify-content:center;cursor:pointer" hover="filter:brightness(.96)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blueInk)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1.4" />
            <circle cx="18" cy="21" r="1.4" />
            <path d="M1 1h3l2.6 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 6H6" />
          </svg>
          {cart.count > 0 && (
            <span style={css("position:absolute;top:-2px;right:-2px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:var(--maroon);color:#fff;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid var(--paper)")}>{cart.count}</span>
          )}
        </Hoverable>
        <div title="Your account" onClick={() => setView("account")} style={css("display:flex;align-items:center;gap:9px;background:var(--blueBg);border-radius:22px;padding:4px 14px 4px 4px;cursor:pointer")}>
          <span style={css("width:32px;height:32px;border-radius:50%;background:var(--blueInk);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:14px")}>A</span>
          <span style={css("font-size:13.5px;font-weight:700;color:var(--blueInk)")}>Account</span>
        </div>
      </header>

      {/* ======================= SHELL: SIDEBAR + MAIN ======================= */}
      <div style={css("flex:1;display:flex;min-height:0")}>
        {showSidebar && (
        <aside style={css("flex:0 0 289px;background:var(--cream);border-right:1px solid var(--line);overflow-y:auto;padding:12px 10px 36px")}>
          {/* Nav card */}
          <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:10px")}>
            <NavRow active={view === "browse"} onClick={goBrowse} label="Browse all"
              icon={<><path d="M4 9h16l-1-4.5H5L4 9Z" /><path d="M5 9v10.5h14V9" /><path d="M9.5 19.5V14h5v5.5" /></>} />
            <NavRow active={view === "buying"} onClick={() => setView("buying")} label="Buying" chevron border
              icon={<><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>} />
            <NavRow active={view === "selling"} onClick={() => setView("selling")} label="Selling" chevron border
              icon={<><path d="M3 12 12 3h8v8l-9 9-8-8Z" /><circle cx="16" cy="8" r="1.4" /></>} />
            <a href="https://trycommonplace.com/track" target="_blank" style={css("display:flex;align-items:center;gap:10px;padding:9px 11px;cursor:pointer;border-top:1px solid var(--line)")}>
              <span style={css("width:29px;height:29px;border-radius:8px;flex:0 0 auto;background:#F1EBE1;display:flex;align-items:center;justify-content:center")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
              </span>
              <span style={css("font-size:15px;font-weight:600")}>Track order</span>
            </a>
            <div onClick={() => setLocOpen(true)} style={css("display:flex;align-items:center;gap:10px;padding:9px 11px;cursor:pointer;border-top:1px solid var(--line)")}>
              <span style={css("width:29px;height:29px;border-radius:8px;flex:0 0 auto;background:var(--tint);color:var(--maroon);display:flex;align-items:center;justify-content:center")}><Pin /></span>
              <div style={css("flex:1;min-width:0")}>
                <div style={css("font-size:12.5px;color:var(--muted);font-weight:600;line-height:1")}>Deliver to</div>
                <div style={css("font-size:15px;font-weight:700;color:var(--maroon);margin-top:2px")}>{locCity}</div>
              </div>
              <Chevron />
            </div>
          </div>

          {/* Create listing */}
          <button onClick={() => setCreateOpen(true)} style={css("width:100%;background:var(--fbbtn);color:var(--fbblue);border:none;border-radius:8px;padding:12px;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px")}>
            <Plus />Create new listing
          </button>

          {notCategory && (
            <>
              {/* Categories accordion */}
              <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:10px")}>
                <div style={css("font-size:15px;font-weight:700;padding:12px 13px 10px")}>Categories</div>
                {CAT_GROUPS.map((g) => {
                  const open = !!openGroups[g.name];
                  return (
                    <div key={g.name} style={css("border-top:1px solid var(--line)")}>
                      <Hoverable onClick={() => setOpenGroups((p) => ({ ...p, [g.name]: !p[g.name] }))} styles="display:flex;align-items:center;gap:11px;padding:10px 12px;cursor:pointer;transition:background .14s" hover="background:var(--putty)">
                        <span style={sx("width:30px;height:30px;flex:0 0 auto;border-radius:8px;display:flex;align-items:center;justify-content:center", { background: g.bg, color: g.fg })}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d={g.iconPath} /></svg>
                        </span>
                        <span style={css("flex:1;font-size:15px;font-weight:600")}>{g.name}</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2.2} style={sx("transition:transform .2s", { transform: open ? "rotate(180deg)" : "none" })}><path d="m6 9 6 6 6-6" /></svg>
                      </Hoverable>
                      {open && (
                        <div style={css("padding:0 10px 9px;display:flex;flex-direction:column;gap:1px")}>
                          {g.items.map((it) => (
                            <Hoverable key={it.slug} onClick={() => openCategory(it)} styles="display:flex;align-items:center;padding:7px 10px 7px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;transition:background .14s" hover="background:var(--putty)">
                              {it.name}
                            </Hoverable>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Filters */}
              <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 13px;margin-bottom:10px")}>
                <div style={css("font-size:15px;font-weight:700;margin-bottom:10px")}>Filters</div>
                <div style={css("font-size:12px;font-weight:700;color:var(--muted);margin-bottom:7px")}>Price</div>
                <div style={css("display:flex;align-items:center;gap:8px;margin-bottom:13px")}>
                  <input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} inputMode="numeric" placeholder="Min $" style={css("width:100%;min-width:0;flex:1;border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:13px;outline:none;background:#fff")} />
                  <span style={css("color:var(--muted);font-size:13px")}>–</span>
                  <input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} inputMode="numeric" placeholder="Max $" style={css("width:100%;min-width:0;flex:1;border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:13px;outline:none;background:#fff")} />
                </div>
                <div style={css("font-size:12px;font-weight:700;color:var(--muted);margin-bottom:7px")}>Condition</div>
                <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
                  {CONDITIONS.map((c) => {
                    const on = conds.has(c.key);
                    return (
                      <div key={c.key} onClick={() => toggleCond(c.key)} style={sx(
                        "padding:6px 11px;border-radius:16px;font-size:12px;font-weight:600;cursor:pointer;transition:all .14s",
                        on
                          ? { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" }
                          : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" },
                      )}>
                        {c.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Learn */}
              <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 13px;margin-bottom:10px")}>
                <div style={css("font-size:15px;font-weight:800;margin-bottom:9px")}>Learn about Commonplace</div>
                <div style={css("display:flex;flex-direction:column;gap:7px")}>
                  {LEARN_VIDEOS.map((v) => (
                    <Hoverable key={v.title} onClick={() => setVideoId(v.id)} styles={`display:flex;gap:10px;align-items:center;padding:7px;border:1px solid var(--line);border-left:4px solid ${v.accent};border-radius:10px;cursor:pointer;transition:box-shadow .15s`} hover="box-shadow:0 6px 16px rgba(60,10,35,.1)">
                      <div style={sx("width:42px;height:42px;flex:0 0 auto;border-radius:7px;display:flex;align-items:center;justify-content:center", { background: `repeating-linear-gradient(135deg,${v.g1} 0 8px,${v.g2} 8px 16px)` })}>
                        <span style={css("width:21px;height:21px;border-radius:50%;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center")}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill={v.accent}><path d="M8 5v14l11-7z" /></svg>
                        </span>
                      </div>
                      <div style={css("min-width:0")}>
                        <div style={css("font-size:12.5px;font-weight:700;font-family:'Newsreader',serif")}>{v.title}</div>
                        <div style={css("font-size:11px;color:var(--muted);line-height:1.35")}>{v.blurb}</div>
                      </div>
                    </Hoverable>
                  ))}
                </div>
              </div>

              {/* Reviews */}
              <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 13px;margin-bottom:10px")}>
                <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:9px")}>
                  <div style={css("font-size:15px;font-weight:800")}>Reviews</div>
                  <div style={css("display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--muted)")}>
                    <b style={css("font-size:15px;color:var(--ink)")}>5.0</b>
                    <span style={css("color:var(--gold);letter-spacing:1px")}>★★★★★</span> Google
                  </div>
                </div>
                <div style={css("display:flex;flex-direction:column;gap:7px")}>
                  {REVIEWS.map((r) => (
                    <Hoverable key={r.name} styles="padding:9px 11px;border:1px solid var(--line);border-radius:10px;cursor:pointer;transition:box-shadow .15s" hover="box-shadow:0 6px 16px rgba(60,10,35,.08)">
                      <div style={css("display:flex;align-items:center;gap:8px;margin-bottom:5px")}>
                        <span style={sx("width:26px;height:26px;flex:0 0 auto;border-radius:50%;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center", { background: r.avBg })}>{r.initial}</span>
                        <div style={css("min-width:0;flex:1")}>
                          <div style={css("font-size:12.5px;font-weight:700")}>{r.name}</div>
                          <div style={css("font-size:10px;color:var(--gold);letter-spacing:1px")}>★★★★★</div>
                        </div>
                      </div>
                      <div style={css("font-size:11.5px;color:var(--muted);line-height:1.4")}>{r.text}</div>
                    </Hoverable>
                  ))}
                </div>
                <div onClick={() => window.open(GOOGLE_REVIEWS_URL, "_blank", "noopener")} style={css("text-align:center;margin-top:9px;font-size:12px;font-weight:700;color:var(--blueInk);cursor:pointer")}>See all reviews →</div>
              </div>

              {/* As featured in */}
              <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 13px")}>
                <div style={css("font-size:15px;font-weight:800")}>As featured in</div>
                <p style={css("font-size:12px;color:var(--muted);line-height:1.5;margin:2px 0 9px")}>The press on Commonplace.</p>
                <div style={css("display:flex;flex-direction:column;gap:6px")}>
                  {ARTICLES.map((a) => (
                    <Hoverable key={a.name} as="a" href={a.url} target="_blank" styles="display:flex;align-items:center;gap:11px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;cursor:pointer;transition:box-shadow .15s" hover="box-shadow:0 6px 16px rgba(60,10,35,.1)">
                      <span style={css("min-width:0;flex:1")}>
                        <span style={sx("display:block;font-size:13.5px;font-weight:800;line-height:1.15;letter-spacing:-.2px", { fontFamily: a.font })}>{a.name}</span>
                        <span style={css("display:block;font-size:11px;color:var(--muted);line-height:1.3;margin-top:2px")}>{a.quote}</span>
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2} style={css("flex:0 0 auto")}><path d="M7 17 17 7M9 7h8v8" /></svg>
                    </Hoverable>
                  ))}
                </div>
              </div>
            </>
          )}

          {isCategory && category && (
            <>
              <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:10px")}>
                <div onClick={goBrowse} style={css("display:flex;align-items:center;gap:6px;padding:11px 13px;color:var(--blueInk);font-weight:700;font-size:13.5px;cursor:pointer;border-bottom:1px solid var(--line)")}>
                  <ChevronLeft stroke="currentColor" />All categories
                </div>
                <div style={css("padding:13px 14px")}>
                  <div style={css("font-family:'Newsreader',serif;font-size:19px;font-weight:500;line-height:1.15")}>{category.name}</div>
                  <div style={css("font-size:12.5px;color:var(--muted);margin-top:3px")}>Browsing live Commonplace inventory</div>
                  <div style={css("height:6px;background:#eee4d8;border-radius:9px;margin-top:10px;overflow:hidden")}>
                    <i style={css("display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--blueInk),var(--gold));transition:width .35s ease")} />
                  </div>
                </div>
              </div>
              <div onClick={() => { setConds(new Set()); setPriceMin(""); setPriceMax(""); }} style={css("text-align:center;padding:10px;color:var(--muted);font-size:12.5px;cursor:pointer;margin-bottom:6px")}>Clear all filters</div>
            </>
          )}
        </aside>
        )}

        {/* ============================ MAIN ============================ */}
        <main style={css(showSidebar ? "flex:1;overflow-y:auto;padding:20px 22px 56px 7px" : "flex:1;overflow-y:auto;padding:0")}>
          <ErrorBoundary onReset={goBrowse}>
            {view === "browse" && <BrowseView locCity={locCity} onOpenProduct={openProduct} />}
            {view === "category" && category && <CategoryView catName={category.name} categorySlug={category.slug} onOpenProduct={openProduct} />}
            {view === "buying" && <BuyingView onBrowse={goBrowse} />}
            {view === "selling" && <SellingView onBrowse={goBrowse} onNew={() => setCreateOpen(true)} />}
            {view === "product" && product && <ProductPage item={product} onBack={goBrowse} onOpenCategory={(slug, name) => openCategory({ name, slug })} onMakeOffer={() => setCreateOpen(true)} />}
            {view === "search" && <SearchPage initialQuery={searchQuery} onOpenProduct={openProduct} />}
            {view === "account" && <AccountPage onBack={goBrowse} />}
            {view === "cart" && <CartPage onBrowse={goBrowse} onCheckout={() => {}} onOpenProduct={openProduct} />}
            {view === "info" && infoSlug && <InfoView slug={infoSlug} />}
          </ErrorBoundary>
        </main>
      </div>

      {/* ============================ MODALS ============================ */}
      {locOpen && <LocationModal city={locCity} onCity={setLocCity} onClose={() => setLocOpen(false)} />}
      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} />}
      {videoId && <VideoLightbox id={videoId} onClose={() => setVideoId(null)} />}
      <ConciergeChat open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
    </div>
  );
}

/* ------------------------------- Sidebar nav row ------------------------------- */
function NavRow({ active, onClick, label, icon, chevron, border }: {
  active?: boolean; onClick: () => void; label: string; icon: React.ReactNode; chevron?: boolean; border?: boolean;
}) {
  const bg = active ? "var(--tint)" : "transparent";
  const icoBg = active ? "var(--maroon)" : "#F1EBE1";
  const icoFg = active ? "#fff" : "var(--ink)";
  const txt = active ? "var(--maroon)" : "var(--ink)";
  return (
    <div onClick={onClick} style={sx("display:flex;align-items:center;gap:10px;padding:9px 11px;cursor:pointer", border ? "border-top:1px solid var(--line)" : "", { background: bg })}>
      <span style={sx("width:29px;height:29px;border-radius:8px;flex:0 0 auto;display:flex;align-items:center;justify-content:center", { background: icoBg, color: icoFg })}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>{icon}</svg>
      </span>
      <span style={sx("font-size:15px;font-weight:600;flex:1", { color: txt })}>{label}</span>
      {chevron && <ChevronRight />}
    </div>
  );
}

/* ------------------------------- Product card ------------------------------- */
function ProductCard({ it, tint = "#EDE4D6", tint2 = "#E5DACA" }: { it: Listing; tint?: string; tint2?: string }) {
  const img = it.images[0];
  return (
    <Hoverable styles="transition:box-shadow .2s ease,border-color .2s ease;background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden;cursor:pointer;animation:pop .3s ease both;box-shadow:0 3px 10px rgba(60,10,35,.05)" hover="box-shadow:0 18px 38px rgba(60,10,35,.22);border-color:#d9b7c2">
      <div style={sx("position:relative;aspect-ratio:4/3;overflow:hidden", { background: `repeating-linear-gradient(135deg,${tint} 0 15px,${tint2} 15px 30px)` })}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={it.title} loading="lazy" style={css("position:absolute;inset:0;width:100%;height:100%;object-fit:cover")} />
        ) : (
          <div style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px")}>
            <span style={css("font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:11px;letter-spacing:.12em;color:#9a8c78;text-align:center;text-transform:uppercase")}>{it.categoryName}</span>
          </div>
        )}
        {it.condition && (
          <div style={css("position:absolute;top:9px;left:9px;background:rgba(255,255,255,.95);color:var(--ink);padding:3px 8px;border-radius:20px;font-size:10px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.1)")}>{it.condition}</div>
        )}
        {it.savingsPct ? (
          <div style={css("position:absolute;top:9px;right:9px;background:var(--green);color:#fff;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:800;box-shadow:0 1px 4px rgba(0,0,0,.12)")}>Save {it.savingsPct}%</div>
        ) : null}
      </div>
      <div style={css("padding:10px 11px 11px")}>
        <div style={css("font-family:'Newsreader',serif;font-size:13px;font-weight:500;line-height:1.28;height:33px;overflow:hidden;text-wrap:pretty")}>{it.title}</div>
        {it.location && (
          <div style={css("display:flex;align-items:center;gap:4px;font-size:10.5px;color:var(--muted);margin-top:5px")}>
            <Pin size={12} />{it.location}
          </div>
        )}
        <div style={css("display:flex;align-items:baseline;gap:7px;margin-top:5px")}>
          <span style={css("font-size:15px;font-weight:800;letter-spacing:-.3px")}>{formatPrice(it.priceCents)}</span>
          {it.retailCents ? <span style={css("font-size:11px;color:var(--muted);text-decoration:line-through")}>{formatPrice(it.retailCents)}</span> : null}
        </div>
      </div>
    </Hoverable>
  );
}

/* ------------------------------- Loading skeleton ------------------------------- */
function CardSkeleton() {
  return (
    <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden")}>
      <div style={css("aspect-ratio:4/3;background:repeating-linear-gradient(135deg,#EDE4D6 0 15px,#E5DACA 15px 30px);opacity:.55")} />
      <div style={css("padding:11px")}>
        <div style={css("height:11px;border-radius:5px;background:var(--putty);margin-bottom:7px")} />
        <div style={css("height:11px;width:60%;border-radius:5px;background:var(--putty);margin-bottom:10px")} />
        <div style={css("height:14px;width:40%;border-radius:5px;background:var(--line)")} />
      </div>
    </div>
  );
}

const GRID = "display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px";

/* ------------------------------- Sort select ------------------------------- */
function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label style={css("display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13.5px")}>Sort
      <select value={value} onChange={(e) => onChange(e.target.value)} style={css("border:1px solid var(--line);background:var(--putty);border-radius:10px;padding:8px 12px;font-size:13.5px;font-weight:600;color:var(--ink);cursor:pointer")}>
        <option value="recommended">Recommended</option>
        <option value="price">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="date">Newest first</option>
        <option value="rating">Top rated</option>
      </select>
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={css("text-align:center;padding:70px 20px;color:var(--muted)")}>
      <div style={css("font-family:'Newsreader',serif;font-size:20px;color:var(--ink);margin-bottom:6px")}>Nothing here yet</div>
      <div style={css("font-size:14px")}>{text}</div>
    </div>
  );
}

/* ------------------------------- Browse view ------------------------------- */
function BrowseView({ locCity, onOpenProduct }: { locCity: string; onOpenProduct: (it: Listing) => void }) {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [chip, setChip] = useState("");
  const [sort, setSort] = useState("recommended");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchListings({ perPage: 20, category: chip || undefined, orderby: sort, city: locCity }).then((d) => {
      if (alive) {
        setItems(d.items);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [chip, sort, locCity]);

  return (
    <div>
      <div style={css("display:flex;align-items:center;gap:13px;background:#F9AEB7;border:1px solid #f2939e;border-radius:12px;padding:12px 16px;margin-bottom:18px")}>
        <span style={css("width:36px;height:36px;flex:0 0 auto;border-radius:50%;background:var(--maroon);color:#fff;display:flex;align-items:center;justify-content:center")}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="1" y="6" width="14" height="10" rx="1.5" /><path d="M15 9h4l3 3.5V16h-7z" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="18" cy="17.5" r="1.8" /></svg>
        </span>
        <div style={css("font-size:13.5px;line-height:1.45")}>
          <b>Free delivery within 100 miles.</b> Every item is inspected at pickup, delivered white-glove, and you pay only after testing it at home — no meetups, no back-and-forth messaging.
        </div>
      </div>
      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px")}>
        <div>
          <h2 style={css("font-family:'Newsreader',serif;font-size:23px;font-weight:500;letter-spacing:-.4px")}>Today&apos;s picks</h2>
          <p style={css("color:var(--muted);font-size:12.5px;margin-top:1px")}>Verified, inspected, and delivered to {locCity}</p>
        </div>
        <SortSelect value={sort} onChange={setSort} />
      </div>
      <div style={css("display:flex;gap:9px;flex-wrap:wrap;margin-bottom:22px")}>
        {BROWSE_CHIPS.map((c) => {
          const active = chip === c.slug;
          return (
            <Hoverable key={c.label} onClick={() => setChip(c.slug)}
              styles={sx("transition:box-shadow .16s ease;padding:9px 16px;border-radius:20px;font-size:13.5px;font-weight:700;cursor:pointer",
                active ? { border: "1px solid var(--maroon)", background: "var(--maroon)", color: "#fff" } : { border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink)" })}
              hover="box-shadow:0 6px 16px rgba(60,10,35,.13)">
              {c.label}
            </Hoverable>
          );
        })}
      </div>
      {loading ? (
        <div style={css(GRID)}>{Array.from({ length: 15 }).map((_, i) => (<CardSkeleton key={i} />))}</div>
      ) : items.length > 0 ? (
        <div style={css(GRID)}>
          {items.map((it) => (
            <div key={it.id} onClick={() => onOpenProduct(it)}><ProductCard it={it} /></div>
          ))}
        </div>
      ) : (
        <EmptyState text="We couldn't load inventory just now — try another filter." />
      )}
    </div>
  );
}

/* ------------------------------- Category view ------------------------------- */
function CategoryView({ catName, categorySlug, onOpenProduct }: { catName: string; categorySlug: string; onOpenProduct: (it: Listing) => void }) {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState("recommended");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchListings({ category: categorySlug, perPage: 24, orderby: sort }).then((d) => {
      if (alive) {
        setItems(d.items);
        setTotal(d.total);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [categorySlug, sort]);

  return (
    <div>
      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:16px")}>
        <div>
          <div style={css("font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--blueInk);font-weight:700")}>{catName}</div>
          <h2 style={css("font-family:'Newsreader',serif;font-size:34px;font-weight:500;letter-spacing:-.4px;line-height:1.1")}>Every {catName} we have</h2>
        </div>
        <div style={css("display:flex;align-items:center;gap:16px")}>
          <div style={css("font-size:15px;color:var(--muted)")}>
            <b style={css("color:var(--blueInk);font-size:24px;font-family:'Newsreader',serif;font-weight:600")}>{loading ? "…" : items.length}</b> of {total.toLocaleString()} match
          </div>
          <SortSelect value={sort} onChange={setSort} />
        </div>
      </div>
      {loading ? (
        <div style={css(GRID)}>{Array.from({ length: 15 }).map((_, i) => (<CardSkeleton key={i} />))}</div>
      ) : items.length > 0 ? (
        <div style={css(GRID)}>
          {items.map((it) => (
            <div key={it.id} onClick={() => onOpenProduct(it)}><ProductCard it={it} tint="#efe7dc" tint2="#e7dccc" /></div>
          ))}
        </div>
      ) : (
        <EmptyState text={`No ${catName.toLowerCase()} in stock right now — check back soon.`} />
      )}
    </div>
  );
}

/* ------------------------------- Buying view ------------------------------- */
const BUYING_OFFERS = [
  { title: "Peloton Bike+ with Shoes", offer: "$1,150", list: "$1,295", when: "2h ago", status: "Countered", action: "View counter", actionable: true, stBg: "var(--yellowBg)", stColor: "var(--gold)" },
  { title: "Sole E95 Elliptical Trainer", offer: "$700", list: "$749", when: "1d ago", status: "Accepted", action: "", actionable: false, stBg: "var(--greenBg)", stColor: "var(--green)" },
  { title: "Yamaha U1 Upright Piano", offer: "$3,500", list: "$3,799", when: "3d ago", status: "Pending", action: "", actionable: false, stBg: "var(--blueBg)", stColor: "var(--blueInk)" },
  { title: "West Elm Harmony Sofa", offer: "$820", list: "$899", when: "5d ago", status: "Declined", action: "", actionable: false, stBg: "#F1E7E4", stColor: "var(--red)" },
];
function BuyingView({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div style={css("max-width:960px")}>
      <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:4px")}>
        <a onClick={onBrowse} style={css("color:var(--blueInk);font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px")}><ChevronLeft stroke="currentColor" />Browse</a>
        <span style={css("color:var(--muted);font-size:14px")}>/ Buying</span>
      </div>
      <h2 style={css("font-family:'Newsreader',serif;font-size:30px;font-weight:500;letter-spacing:-.4px;margin-bottom:2px")}>Your buying activity</h2>
      <p style={css("color:var(--muted);font-size:14px;margin-bottom:22px")}>Offers you&apos;ve placed, questions you&apos;ve asked, and items on the way.</p>
      <div style={css("display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:26px")}>
        {[["4", "Active offers", "var(--ink)"], ["1", "Accepted", "var(--green)"], ["2", "Arriving soon", "var(--ink)"]].map(([n, l, c]) => (
          <div key={l} style={css("background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px")}>
            <div style={sx("font-size:28px;font-weight:800;letter-spacing:-.5px", { color: c })}>{n}</div>
            <div style={css("font-size:13px;color:var(--muted)")}>{l}</div>
          </div>
        ))}
      </div>
      <h3 style={css("font-size:19px;font-weight:800;margin-bottom:12px")}>Your offers</h3>
      <div style={css("display:flex;flex-direction:column;gap:11px;margin-bottom:30px")}>
        {BUYING_OFFERS.map((o) => (
          <div key={o.title} style={css("display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px")}>
            <div style={css("width:60px;height:60px;flex:0 0 auto;border-radius:9px;background:repeating-linear-gradient(135deg,#EDE4D6 0 10px,#E5DACA 10px 20px)")} />
            <div style={css("flex:1;min-width:0")}>
              <div style={css("font-size:14.5px;font-weight:600;line-height:1.3")}>{o.title}</div>
              <div style={css("font-size:12.5px;color:var(--muted);margin-top:2px")}>Your offer <b style={css("color:var(--ink)")}>{o.offer}</b> · list {o.list} · {o.when}</div>
            </div>
            <div style={css("display:flex;flex-direction:column;align-items:flex-end;gap:6px")}>
              <span style={sx("font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px", { background: o.stBg, color: o.stColor })}>{o.status}</span>
              {o.actionable && <span style={css("font-size:12px;font-weight:700;color:var(--blueInk);cursor:pointer")}>{o.action}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Selling view ------------------------------- */
const SELLING_OFFERS = [
  { initial: "R", avBg: "var(--maroon)", buyer: "Ryan M.", offer: "$1,150", item: "Peloton Bike+", list: "$1,295", when: "2h ago", pending: true },
  { initial: "T", avBg: "var(--blueInk)", buyer: "Tara S.", offer: "$820", item: "West Elm Sofa", list: "$899", when: "6h ago", pending: true },
  { initial: "K", avBg: "var(--green)", buyer: "Kevin D.", offer: "$700", item: "Sole E95", list: "$749", when: "1d ago", pending: false, status: "Accepted", stBg: "var(--greenBg)", stColor: "var(--green)" },
];
function SellingView({ onBrowse, onNew }: { onBrowse: () => void; onNew: () => void }) {
  return (
    <div style={css("max-width:960px")}>
      <div style={css("display:flex;align-items:center;gap:10px;margin-bottom:4px")}>
        <a onClick={onBrowse} style={css("color:var(--blueInk);font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px")}><ChevronLeft stroke="currentColor" />Browse</a>
        <span style={css("color:var(--muted);font-size:14px")}>/ Selling</span>
      </div>
      <div style={css("display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:22px")}>
        <div>
          <h2 style={css("font-family:'Newsreader',serif;font-size:30px;font-weight:500;letter-spacing:-.4px;margin-bottom:2px")}>Your seller dashboard</h2>
          <p style={css("color:var(--muted);font-size:14px")}>Manage listings, review offers, track orders, and answer buyer questions.</p>
        </div>
        <button onClick={onNew} style={css("background:var(--blueInk);color:#fff;border:none;border-radius:9px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:7px")}>
          <Plus size={16} />New listing
        </button>
      </div>
      <div style={css("display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:26px")}>
        {[["3", "Active listings", "var(--ink)"], ["4", "New offers", "var(--blueInk)"], ["680", "Total views", "var(--ink)"], ["$1,092", "Paid out", "var(--green)"]].map(([n, l, c]) => (
          <div key={l} style={css("background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px")}>
            <div style={sx("font-size:26px;font-weight:800;letter-spacing:-.5px", { color: c })}>{n}</div>
            <div style={css("font-size:12.5px;color:var(--muted)")}>{l}</div>
          </div>
        ))}
      </div>
      <h3 style={css("font-size:19px;font-weight:800;margin-bottom:2px")}>Offers on your listings</h3>
      <p style={css("color:var(--muted);font-size:13px;margin-bottom:12px")}>You have 24 hours to accept, counter, or decline each offer.</p>
      <div style={css("display:flex;flex-direction:column;gap:11px")}>
        {SELLING_OFFERS.map((o) => (
          <div key={o.buyer} style={css("display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px")}>
            <div style={sx("width:44px;height:44px;flex:0 0 auto;border-radius:50%;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:15px", { background: o.avBg })}>{o.initial}</div>
            <div style={css("flex:1;min-width:0")}>
              <div style={css("font-size:14px;line-height:1.3")}><b>{o.buyer}</b> offered <b style={css("color:var(--blueInk)")}>{o.offer}</b></div>
              <div style={css("font-size:12.5px;color:var(--muted);margin-top:2px")}>{o.item} · list {o.list} · {o.when}</div>
            </div>
            {o.pending ? (
              <div style={css("display:flex;gap:7px")}>
                <button style={css("border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:8px;padding:8px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit")}>Decline</button>
                <button style={css("border:1px solid var(--blueInk);background:#fff;color:var(--blueInk);border-radius:8px;padding:8px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit")}>Counter</button>
                <button style={css("border:none;background:var(--blueInk);color:#fff;border-radius:8px;padding:8px 15px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit")}>Accept</button>
              </div>
            ) : (
              <span style={sx("font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px", { background: o.stBg, color: o.stColor })}>{o.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


/* ------------------------------- Info page view ------------------------------- */
function InfoView({ slug }: { slug: string }) {
  const entry = resolveInfoPage(slug);
  if (!entry) return <EmptyState text="That page isn't available." />;
  const C = entry.Component;
  return <C />;
}

/* ------------------------------- Video lightbox ------------------------------- */
function VideoLightbox({ id, onClose }: { id: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={css("position:fixed;inset:0;background:rgba(15,8,11,.8);display:flex;align-items:center;justify-content:center;z-index:400;padding:24px;animation:fade .15s ease both")}>
      <div onClick={(e) => e.stopPropagation()} style={css("width:min(880px,94vw);aspect-ratio:16/9;background:#000;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);position:relative")}>
        <iframe src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`} title="Commonplace" allow="autoplay; encrypted-media; fullscreen" allowFullScreen style={css("position:absolute;inset:0;width:100%;height:100%;border:0")} />
      </div>
      <div onClick={onClose} style={css("position:absolute;top:18px;right:22px;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer")}><Close stroke="#fff" strokeWidth={2.4} /></div>
    </div>
  );
}

/* ------------------------------- Location modal ------------------------------- */
function LocationModal({ city, onCity, onClose }: { city: string; onCity: (v: string) => void; onClose: () => void }) {
  return (
    <div style={css("position:fixed;inset:0;background:rgba(25,12,18,.55);display:flex;align-items:center;justify-content:center;z-index:200;animation:fade .15s ease both")}>
      <div style={css("width:440px;max-width:92vw;background:var(--cream);border-radius:20px;box-shadow:0 30px 70px rgba(0,0,0,.4);padding:26px;animation:pop .2s ease both")}>
        <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:18px")}>
          <div style={css("font-family:'Newsreader',serif;font-size:24px;font-weight:600")}>Select your location</div>
          <div onClick={onClose} style={css("width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.05);display:flex;align-items:center;justify-content:center;cursor:pointer")}><Close /></div>
        </div>
        <div style={css("display:flex;align-items:center;gap:10px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:11px")}>
          <Pin size={18} stroke="var(--maroon)" />
          <input value={city} onChange={(e) => onCity(e.target.value)} placeholder="City, state" style={css("flex:1;border:none;outline:none;font-size:15px;font-weight:600;color:var(--ink);background:transparent")} />
        </div>
        <div onClick={onClose} style={css("text-align:center;background:var(--maroon);color:#fff;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer")}>Update</div>
      </div>
    </div>
  );
}

/* ------------------------------- Create / sell modal -------------------------------
   Type-to-find the category. Known categories render their specific questions
   AND photo recommendations; anything else falls back to the generic form. */
const FIELD_INPUT = "width:100%;border:1px solid var(--line);background:var(--paper);border-radius:10px;padding:11px 12px;font-size:14px;color:var(--ink);outline:none";

function CreateModal({ onClose }: { onClose: () => void }) {
  const [catName, setCatName] = useState("");
  const [cond, setCond] = useState<string>("");
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [origPrice, setOrigPrice] = useState("");
  const [floorPrice, setFloorPrice] = useState("");
  const [pickup, setPickup] = useState("");

  const matched = CAT_GROUPS.flatMap((g) => g.items).find(
    (i) => i.name.toLowerCase() === catName.trim().toLowerCase(),
  );
  const spec = resolveSellSpec(matched?.slug);
  const isKnown = !!matched && !spec.generic;

  const setAns = (key: string, val: string | string[]) => setAnswers((p) => ({ ...p, [key]: val }));
  const toggleChip = (key: string, opt: string) =>
    setAnswers((p) => {
      const cur = Array.isArray(p[key]) ? (p[key] as string[]) : [];
      return { ...p, [key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });

  const label = (f: Field) => (
    <div style={css("margin-bottom:6px")}>
      <div style={css("font-size:12.5px;font-weight:700")}>{f.label}{f.required && <span style={css("color:var(--red)")}> *</span>}</div>
      {f.help && <div style={css("font-size:11px;color:var(--muted);line-height:1.4;margin-top:3px")}>{f.help}</div>}
    </div>
  );

  function renderField(f: Field) {
    const val = answers[f.key];
    if (f.type === "textarea") {
      return (
        <div key={f.key}>{label(f)}
          <textarea value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} placeholder={f.placeholder} rows={3} style={sx(FIELD_INPUT, "resize:vertical;line-height:1.4")} />
        </div>
      );
    }
    if (f.type === "select") {
      return (
        <div key={f.key}>{label(f)}
          <select value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} style={sx(FIELD_INPUT, "cursor:pointer")}>
            <option value="">Select…</option>
            {f.options?.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
        </div>
      );
    }
    if (f.type === "radio" || f.type === "chips") {
      const multi = f.type === "chips";
      const selected = multi ? (Array.isArray(val) ? val : []) : val;
      return (
        <div key={f.key}>{label(f)}
          <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
            {f.options?.map((o) => {
              const on = multi ? (selected as string[]).includes(o) : selected === o;
              return (
                <div key={o} onClick={() => (multi ? toggleChip(f.key, o) : setAns(f.key, o))}
                  style={sx("padding:8px 12px;border-radius:16px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .14s",
                    on ? { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" } : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" })}>
                  {o}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div key={f.key}>{label(f)}
        <input value={(val as string) ?? ""} onChange={(e) => setAns(f.key, e.target.value)} inputMode={f.type === "number" ? "numeric" : undefined} placeholder={f.placeholder} style={css(FIELD_INPUT)} />
      </div>
    );
  }

  return (
    <div style={css("position:fixed;inset:0;background:rgba(25,12,18,.55);display:flex;align-items:center;justify-content:center;z-index:200;animation:fade .15s ease both")}>
      <div style={css("width:540px;max-width:94vw;max-height:90vh;overflow-y:auto;background:var(--cream);border-radius:20px;box-shadow:0 30px 70px rgba(0,0,0,.4);padding:26px")}>
        <div style={css("display:flex;align-items:center;justify-content:space-between;margin-bottom:6px")}>
          <div style={css("font-family:'Newsreader',serif;font-size:24px;font-weight:600")}>Create a listing</div>
          <div onClick={onClose} style={css("width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.05);display:flex;align-items:center;justify-content:center;cursor:pointer")}><Close /></div>
        </div>
        <p style={css("font-size:13px;color:var(--muted);margin-bottom:18px")}>List it once — Commonplace handles pickup, inspection, delivery, and payment.</p>
        <div style={css("display:flex;flex-direction:column;gap:14px")}>
          {/* Category — type to find */}
          <div>
            <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>What are you selling?</div>
            <input list="cp-cats" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Type a category — e.g. Hot Tub, Peloton Bike+, Golf Cart" style={css(FIELD_INPUT)} />
            <datalist id="cp-cats">{ALL_CATEGORY_NAMES.map((n) => (<option key={n} value={n} />))}</datalist>
            {catName.trim().length > 0 && (
              <div style={sx("display:flex;align-items:center;gap:7px;margin-top:8px;font-size:12px;font-weight:600", { color: isKnown ? "var(--green)" : "var(--muted)" })}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M20 6 9 17l-5-5" /></svg>
                {isKnown ? `A few ${spec.title} details help us price and inspect it right.` : "We'll ask a couple of general details."}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>Title</div>
            <input placeholder="e.g. 2022 Peloton Bike+ – Like New" style={css(FIELD_INPUT)} />
          </div>

          {/* Category-specific questions */}
          {spec.questions.map((f) => renderField(f))}

          {/* Price + condition */}
          <div style={css("display:flex;gap:12px")}>
            <div style={css("flex:0 0 150px")}>
              <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>Asking price</div>
              <input inputMode="numeric" placeholder="$0" style={css(FIELD_INPUT)} />
            </div>
            <div style={css("flex:1")}>
              <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>Condition</div>
              <div style={css("display:flex;flex-wrap:wrap;gap:6px")}>
                {CONDITIONS.map((c) => {
                  const on = cond === c.key;
                  return (
                    <div key={c.key} onClick={() => setCond(c.key)} style={sx("padding:8px 12px;border-radius:16px;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .14s",
                      on ? { background: "var(--maroon)", color: "#fff", border: "1px solid var(--maroon)" } : { background: "var(--paper)", color: "var(--ink)", border: "1px solid var(--line)" })}>{c.label}</div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pricing strategy — original + floor (private) */}
          <div style={css("display:flex;gap:12px")}>
            <div style={css("flex:1")}>
              <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>What you originally paid <span style={css("color:var(--muted);font-weight:500")}>(optional)</span></div>
              <input value={origPrice} onChange={(e) => setOrigPrice(e.target.value)} inputMode="numeric" placeholder="$0" style={css(FIELD_INPUT)} />
            </div>
            <div style={css("flex:1")}>
              <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>Floor price <span style={css("color:var(--muted);font-weight:500")}>(private)</span></div>
              <input value={floorPrice} onChange={(e) => setFloorPrice(e.target.value)} inputMode="numeric" placeholder="Lowest you'll accept" style={css(FIELD_INPUT)} />
            </div>
          </div>
          <div style={css("font-size:11px;color:var(--muted);line-height:1.4;margin-top:-6px")}>Only Commonplace sees your floor price — we negotiate up from there on your behalf. Buyers never see it.</div>

          {/* Pickup address (Google Maps) */}
          <div>
            <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>Pickup address <span style={css("color:var(--red)")}>*</span></div>
            <AddressAutocomplete value={pickup} onChange={setPickup} onSelect={(sel) => setPickup(sel.formatted)} placeholder="Start typing your address…" />
            <div style={css("font-size:11px;color:var(--muted);line-height:1.4;margin-top:4px")}>Where we pick up. Autocomplete uses Google Maps Places when configured.</div>
          </div>

          {/* Photos + category-specific recommendations */}
          <div>
            <div style={css("font-size:12.5px;font-weight:700;margin-bottom:6px")}>Photos</div>
            <div style={css("border:2px dashed var(--line);border-radius:12px;padding:22px;text-align:center;color:var(--muted);background:var(--paper)")}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={css("margin-bottom:6px")}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m3 17 5-4 4 3 3-3 6 5" /></svg>
              <div style={css("font-size:13px;font-weight:600")}>Drag photos here or tap to upload</div>
              <div style={css("font-size:11.5px;margin-top:2px")}>A few phone photos is plenty — our team re-shoots on pickup.</div>
            </div>
            <div style={css("margin-top:10px;background:var(--blueBg);border:1px solid #cfe0f2;border-radius:12px;padding:12px 14px")}>
              <div style={css("font-size:12px;font-weight:800;color:var(--blueInk);margin-bottom:7px;display:flex;align-items:center;gap:6px")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m3 17 5-4 4 3 3-3 6 5" /></svg>
                {isKnown ? `Recommended photos for ${spec.title}` : "Recommended photos"}
              </div>
              <div style={css("display:flex;flex-direction:column;gap:5px")}>
                {spec.photoTips.map((t, i) => (
                  <div key={i} style={css("display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--ink);line-height:1.35")}>
                    <span style={css("width:15px;height:15px;flex:0 0 auto;border-radius:50%;background:var(--paper);border:1px solid #cfe0f2;color:var(--blueInk);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;margin-top:1px")}>{i + 1}</span>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={css("display:flex;align-items:center;gap:9px;background:var(--yellowBg);border:1px solid #e8dcae;border-radius:12px;padding:11px 13px;font-size:12.5px;line-height:1.4")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--maroon)" strokeWidth={2} style={css("flex:0 0 auto")}><path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.6 4-1.3 7-5.2 7-9.6V6l-7-3Z" /></svg>
            <span>We suggest a price from recent comparable sales{isKnown ? ` of ${spec.title.toLowerCase()}s` : ""}.</span>
          </div>
        </div>
        <div onClick={onClose} style={css("text-align:center;background:var(--maroon);color:#fff;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;margin-top:20px")}>List my item</div>
      </div>
    </div>
  );
}

/* ------------------------------- Concierge chat ------------------------------- */
function ConciergeChat({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div style={css("position:fixed;right:22px;bottom:22px;z-index:500;display:flex;flex-direction:column;align-items:flex-end;gap:12px")}>
      {open && (
        <div style={css("width:330px;height:430px;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 60px rgba(60,10,35,.28);display:flex;flex-direction:column;overflow:hidden;animation:pop .18s ease both")}>
          <div style={css("background:var(--maroon);color:#fff;padding:13px 15px;display:flex;align-items:center;gap:10px")}>
            <span style={css("width:32px;height:32px;flex:0 0 auto;border-radius:50%;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center")}>
              <svg width="18" height="18" viewBox="0 0 30 16" fill="none" stroke="#fff" strokeWidth={2.4}><circle cx="8" cy="8" r="5.4" /><circle cx="20" cy="8" r="5.4" /></svg>
            </span>
            <div style={css("flex:1;min-width:0")}>
              <div style={css("font-size:14px;font-weight:700")}>Commonplace Concierge</div>
              <div style={css("font-size:11px;opacity:.82")}>We handle the whole deal for you</div>
            </div>
            <div onClick={onToggle} style={css("cursor:pointer;opacity:.9")}><Close stroke="#fff" strokeWidth={2.4} /></div>
          </div>
          <div style={css("flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px;background:var(--cream)")}>
            <div style={css("align-self:flex-start;max-width:82%")}>
              <div style={css("background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.4")}>Hi! I&apos;m your Commonplace concierge. Looking to buy or sell something big?</div>
            </div>
          </div>
          <div style={css("border-top:1px solid var(--line);padding:10px;display:flex;gap:8px;align-items:center;background:var(--paper)")}>
            <input placeholder="Ask us anything…" style={css("flex:1;min-width:0;border:1px solid var(--line);border-radius:20px;padding:9px 14px;font-size:13px;outline:none;background:var(--cream);color:var(--ink)")} />
            <div style={css("width:36px;height:36px;flex:0 0 auto;border-radius:50%;background:var(--maroon);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" /></svg>
            </div>
          </div>
        </div>
      )}
      <Hoverable onClick={onToggle} styles="width:50px;height:50px;border-radius:50%;background:var(--maroon);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 22px rgba(91,26,46,.45);transition:transform .15s" hover="transform:scale(1.07)">
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M6 6l12 12M18 6 6 18" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 20l1.4-4.6a8.5 8.5 0 0 1-.9-3.9 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 9 8.5Z" /></svg>
        )}
      </Hoverable>
    </div>
  );
}

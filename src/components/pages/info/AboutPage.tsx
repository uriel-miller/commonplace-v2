import { css } from "@/lib/design/css";
import { AboutGuides } from "./AboutGuides";

/**
 * About Us — the live trycommonplace.com About page content (verbatim), given a
 * designed layout: hero intro, prose sections, and icon-card grids for the two
 * feature lists ("What Sets Us Apart" and "Our Services").
 */

const APART: readonly [string, string][] = [
  ["Nationwide Delivery Network", "Over 2,000 trained drivers with dollies and trucks, ready to make bulky deliveries seamless across the U.S."],
  ["Inspections on Pickup", "Our team checks every item in person with a detailed checklist."],
  ["White Glove Delivery & Assembly", "We lift, deliver, and set up — anywhere in the U.S., or even globally with our palletizing service."],
  ["Warranty Protection", "Buy with confidence, backed by our guarantee."],
  ["Unbeatable Prices", "Deals that leave you stunned, every time."],
];

const SERVICES: readonly [string, string][] = [
  ["Free Listings", "Sellers list at no cost — always."],
  ["Hassle-Free Pickup & Delivery", "With our vast network, we pay on pickup and deliver fast — often same-day or next-day when schedules allow — anywhere in the U.S."],
  ["Global Reach", "Need it shipped overseas? Our palletizing service has you covered."],
  ["Secure Transactions", "No scams, no strangers — just trust."],
  ["Pre-Pickup Assurance", "Buyers can request photos and videos from our movers to confirm the item matches the listing."],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={css("margin-top:40px")}>
      <h2 style={css("font-family:'Reckless','Newsreader',serif;font-size:24px;font-weight:600;letter-spacing:-.3px;margin-bottom:12px")}>{title}</h2>
      {children}
    </section>
  );
}
function Para({ children }: { children: React.ReactNode }) {
  return <p style={css("font-size:15.5px;line-height:1.65;color:var(--ink);margin-bottom:14px")}>{children}</p>;
}
function BulletList({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <ul style={css("list-style:none;padding:0;margin:6px 0 0;display:flex;flex-direction:column;gap:12px")}>
      {items.map(([t, d]) => (
        <li key={t} style={css("display:flex;gap:12px;align-items:flex-start")}>
          <span style={css("width:22px;height:22px;flex:0 0 auto;border-radius:50%;background:var(--greenBg);color:var(--green);display:flex;align-items:center;justify-content:center;margin-top:2px")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <div style={css("font-size:15.5px;line-height:1.6;color:var(--ink)")}><b>{t}:</b> {d}</div>
        </li>
      ))}
    </ul>
  );
}

export function AboutPage() {
  return (
    <div style={css("background:var(--cream);min-height:100%;width:100%")}>
      <div style={css("max-width:820px;margin:0 auto;padding:52px 22px 96px;color:var(--ink)")}>
        {/* Heading — matches the live page's "About Us" heading */}
        <h1 style={css("font-family:'Reckless','Newsreader',serif;font-size:clamp(30px,4.4vw,42px);font-weight:500;letter-spacing:-.5px;line-height:1.05;margin-bottom:20px")}>
          About Us
        </h1>
        <p style={css("font-size:16px;line-height:1.7;color:var(--ink);margin-bottom:14px")}>
          At Commonplace, we&apos;re revolutionizing how you buy and sell pre-loved goods, starting with gym equipment and soon expanding to more. Our journey kicked off with a nerve-wracking moment: buying a used Peloton from a stranger, cash in hand, only to haul it into a cab and find broken bottle holders and a wonky calibration. That hassle lit a fire — there had to be a better way. Unlike the chaos of Craigslist or Facebook, we&apos;re here to make scoring amazing deals safe, simple, and satisfying.
        </p>

        <Section title="Our Mission">
          <Para>We&apos;re on a mission to make pre-loved goods easily accessible. Picture snagging a thousand-dollar item for a few hundred, all with the ease of a button click. Real savings, zero stress — that&apos;s what we deliver.</Para>
        </Section>

        <Section title="Who We Serve">
          <Para>Whether you&apos;re a fitness buff eyeing a treadmill deal, a homeowner upgrading your gym, or anyone who loves saving money without the headache, Commonplace is built for you. We connect budget-savvy buyers and sellers ready to trade quality gear.</Para>
        </Section>

        <Section title="What Sets Us Apart">
          <Para>Say goodbye to risky marketplaces. Commonplace stands out with:</Para>
          <BulletList items={APART} />
        </Section>

        <Section title="Our Services">
          <BulletList items={SERVICES} />
        </Section>

        <Section title="Trust & Satisfaction">
          <Para>Our nationwide team of over 2,000 trained drivers ensures every pickup is verified with an in-person inspection, following a rigorous checklist. Buyers can opt for real-time updates from the pickup site, guaranteeing what you see is what you get. We&apos;re all about win-win-wins: happy sellers, thrilled buyers, and meaningful work for our local drivers.</Para>
        </Section>

        <Section title="Where We Are">
          <Para>Commonplace is a fully online marketplace with a massive reach. Based in the U.S., our network of drivers and trucks spans the nation, picking up and delivering anywhere you need. From coast to coast or across borders with our global shipping, we&apos;ve got you covered.</Para>
        </Section>

        <Section title="Why We Do It">
          <Para>We&apos;re proud to offer a marketplace where every deal feels like a victory. With same-day and next-day delivery options (when possible), buyers can test their items on arrival, ensuring everything works as promised. It&apos;s satisfaction, delivered — literally.</Para>
        </Section>

        <Section title="Looking Ahead">
          <Para>Our vision is bold yet simple: to help people buy and sell all used items with safety and ease. From gym gear to future categories, we&apos;re growing a community where great deals meet flawless experiences, backed by our unmatched delivery network.</Para>
          <Para>Welcome to Commonplace — where smart trades and seamless service come together.</Para>
        </Section>

        <AboutGuides />
        {/* The "Sell on Commonplace" section + category directory is the shared
            site footer, which renders below this content on every page. */}
      </div>
    </div>
  );
}

import { InfoPageShell } from "./InfoPageShell";
import { Markdown } from "./Markdown";

const SOURCE = `# About Us

At Commonplace, we're revolutionizing how you buy and sell pre-loved goods, starting with gym equipment and soon expanding to more. Our journey kicked off with a nerve-wracking moment: buying a used Peloton from a stranger, cash in hand, only to haul it into a cab and find broken bottle holders and a wonky calibration. That hassle lit a fire—there had to be a better way. Unlike the chaos of Craigslist or Facebook, we're here to make scoring amazing deals safe, simple, and satisfying.

## Our Mission

We're on a mission to make pre-loved goods easily accessible. Picture snagging a thousand-dollar item for a few hundred, all with the ease of a button click. Real savings, zero stress—that's what we deliver.

## Who We Serve

Whether you're a fitness buff eyeing a treadmill deal, a homeowner upgrading your gym, or anyone who loves saving money without the headache, Commonplace is built for you. We connect budget-savvy buyers and sellers ready to trade quality gear.

## What Sets Us Apart

Say goodbye to risky marketplaces. Commonplace stands out with:

- **Nationwide Delivery Network:** Over 2,000 trained drivers with dollies and trucks, ready to make bulky deliveries seamless across the U.S.
- **Inspections on Pickup:** Our team checks every item in person with a detailed checklist.
- **White Glove Delivery & Assembly:** We lift, deliver, and set up—anywhere in the U.S., or even globally with our palletizing service.
- **Warranty Protection:** Buy with confidence, backed by our guarantee.
- **Unbeatable Prices:** Deals that leave you stunned, every time.

## Our Services

- **Free Listings:** Sellers list at no cost—always.
- **Hassle-Free Pickup & Delivery:** With our vast network, we pay on pickup and deliver fast—often same-day or next-day when schedules allow—anywhere in the U.S.
- **Global Reach:** Need it shipped overseas? Our palletizing service has you covered.
- **Secure Transactions:** No scams, no strangers—just trust.
- **Pre-Pickup Assurance:** Buyers can request photos and videos from our movers to confirm the item matches the listing.

## Trust & Satisfaction

Our nationwide team of over 2,000 trained drivers ensures every pickup is verified with an in-person inspection, following a rigorous checklist. Buyers can opt for real-time updates from the pickup site, guaranteeing what you see is what you get. We're all about win-win-wins: happy sellers, thrilled buyers, and meaningful work for our local drivers.

## Where We Are

Commonplace is a fully online marketplace with a massive reach. Based in the U.S., our network of drivers and trucks spans the nation, picking up and delivering anywhere you need. From coast to coast or across borders with our global shipping, we've got you covered.

## Why We Do It

We're proud to offer a marketplace where every deal feels like a victory. With same-day and next-day delivery options (when possible), buyers can test their items on arrival, ensuring everything works as promised. It's satisfaction, delivered—literally.

## Looking Ahead

Our vision is bold yet simple: to help people buy and sell all used items with safety and ease. From gym gear to future categories, we're growing a community where great deals meet flawless experiences, backed by our unmatched delivery network.

Welcome to Commonplace—where smart trades and seamless service come together.`;

export function AboutPage() {
  return (
    <InfoPageShell>
      <Markdown source={SOURCE} />
    </InfoPageShell>
  );
}

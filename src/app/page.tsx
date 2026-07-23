import Link from "next/link";
import { CategoryRail } from "@/components/category-rail";
import { ProductCard } from "@/components/product-card";
import { PRODUCTS } from "@/lib/catalog";

const LEARN = [
  { href: "/how-it-works", title: "What is Commonplace", blurb: "The whole process, start to finish." },
  { href: "/how-it-works/delivery", title: "How Delivery Works", blurb: "Pickup, transport, and setup." },
  { href: "/how-it-works/offers", title: "How Offers Work", blurb: "Make an offer and bidding." },
  { href: "/how-it-works/pickup", title: "How Pickup Works", blurb: "Inspection to payment." },
];

export default function HomePage() {
  const city = "Austin";

  return (
    <>
      <CategoryRail />

      {/* Promo band */}
      <section className="border-b border-line bg-gradient-to-b from-tint/50 to-cream">
        <div className="mx-auto max-w-[1240px] px-4 py-10">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-bg px-3 py-1 text-[12px] font-medium text-green">
            Free delivery within 100 miles
          </p>
          <h1 className="max-w-3xl font-serif text-[38px] leading-[1.1] text-ink md:text-[46px]">
            Big items, delivered. Buy and sell treadmills, hot tubs, and more —
            verified and inspected.
          </h1>
        </div>
      </section>

      {/* Today's picks */}
      <section className="mx-auto max-w-[1240px] px-4 py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-[26px] text-ink">Today&apos;s picks</h2>
            <p className="text-[14px] text-muted">
              Verified, inspected, and delivered to {city}
            </p>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Sort
            <select className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] text-ink focus:border-maroon focus:outline-none">
              <option>Recommended</option>
              <option>Price: low to high</option>
              <option>Price: high to low</option>
              <option>Newest first</option>
              <option>Condition: best first</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Learn about Commonplace */}
      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-[1240px] px-4 py-10">
          <h2 className="mb-5 font-serif text-[22px] text-ink">
            Learn about Commonplace
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LEARN.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-2xl border border-line bg-cream p-5 transition-colors hover:border-maroon"
              >
                <h3 className="font-serif text-[17px] text-ink">{l.title}</h3>
                <p className="mt-1 text-[13px] text-muted">{l.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

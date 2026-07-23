import Link from "next/link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Marketplace",
    links: [
      { href: "/categories", label: "Browse all" },
      { href: "/sell", label: "Sell an item" },
      { href: "/buying", label: "Buying" },
      { href: "/selling", label: "Selling" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/how-it-works", label: "What is Commonplace" },
      { href: "/how-it-works/delivery", label: "How Delivery Works" },
      { href: "/how-it-works/offers", label: "How Offers Work" },
      { href: "/how-it-works/pickup", label: "How Pickup Works" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/reviews", label: "Reviews" },
      { href: "/contact", label: "Contact Us" },
      { href: "/refer", label: "Refer" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/warranty", label: "Warranty" },
      { href: "/returns", label: "Return Policy" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-paper">
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 text-[13px] font-semibold text-ink">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[13px] text-muted hover:text-maroon">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 text-[12px] text-muted">
          <span className="font-serif text-[15px] text-maroon">Commonplace</span>
          <span>Free delivery within 100 miles · © {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}

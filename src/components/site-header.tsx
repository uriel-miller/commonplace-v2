import Link from "next/link";

const UTILITY_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/refer", label: "Refer" },
  { href: "/contact", label: "Contact Us" },
  { href: "/reviews", label: "Reviews" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
      {/* Utility strip */}
      <div className="hidden border-b border-line/70 md:block">
        <div className="mx-auto flex max-w-[1240px] items-center justify-end gap-5 px-4 py-1.5 text-[12px] text-muted">
          {UTILITY_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-baseline gap-0.5">
          <span className="font-serif text-[22px] font-semibold tracking-tight text-maroon">
            Commonplace
          </span>
        </Link>

        {/* Search */}
        <div className="relative hidden flex-1 sm:block">
          <input
            type="search"
            placeholder="Search Commonplace"
            className="w-full rounded-full border border-line bg-paper px-4 py-2 text-[14px] text-ink placeholder:text-muted focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/15"
          />
        </div>

        <nav className="flex items-center gap-2">
          <Link
            href="/buying"
            className="hidden rounded-full px-3 py-2 text-[13px] font-medium text-ink hover:bg-putty md:block"
          >
            Buying
          </Link>
          <Link
            href="/selling"
            className="hidden rounded-full px-3 py-2 text-[13px] font-medium text-ink hover:bg-putty md:block"
          >
            Selling
          </Link>
          <Link
            href="/sell"
            className="rounded-full bg-maroon px-4 py-2 text-[13px] font-semibold text-cream hover:bg-maroon2"
          >
            Sell an item
          </Link>
          <Link
            href="/account"
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper text-[13px] font-semibold text-ink hover:border-maroon"
            aria-label="Account"
          >
            A
          </Link>
        </nav>
      </div>
    </header>
  );
}

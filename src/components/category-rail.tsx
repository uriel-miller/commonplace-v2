import Link from "next/link";
import { CATEGORIES } from "@/lib/catalog";
import { tintAccent } from "@/lib/tint";

export function CategoryRail() {
  return (
    <nav aria-label="Categories" className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[1240px] gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/categories"
          className="shrink-0 rounded-full border border-line bg-cream px-3.5 py-1.5 text-[13px] font-medium text-ink hover:border-maroon hover:text-maroon"
        >
          Browse all
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/c/${c.slug}`}
            className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[13px] text-ink transition-colors hover:border-maroon hover:text-maroon"
          >
            <span style={tintAccent(c.tint)} className="mr-1.5 font-semibold">
              •
            </span>
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

import Link from "next/link";
import type { Product } from "@/lib/types";
import { CONDITION_LABELS, formatPrice } from "@/lib/types";
import { tintSurface } from "@/lib/tint";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/item/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-paper transition-shadow hover:shadow-[0_8px_28px_-12px_rgba(35,26,29,0.25)]"
    >
      {/* Image placeholder — swapped for real media once storage is wired. */}
      <div
        className="relative flex aspect-[4/3] items-center justify-center"
        style={tintSurface(product.tint)}
      >
        <span className="font-serif text-lg italic opacity-60">Commonplace</span>
        <span className="absolute left-3 top-3 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm">
          {CONDITION_LABELS[product.condition]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink group-hover:text-maroon">
          {product.title}
        </h3>
        <p className="text-[13px] text-muted">
          {product.location} · {product.distanceMi} mi
        </p>
        <p className="mt-1 text-[17px] font-semibold text-ink">
          {formatPrice(product.priceCents)}
        </p>
      </div>
    </Link>
  );
}

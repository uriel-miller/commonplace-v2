import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, getCategory } from "@/lib/catalog";
import { CONDITION_LABELS, formatPrice } from "@/lib/types";
import { tintSurface } from "@/lib/tint";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/item/[slug]">) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  return { title: product ? product.title : "Item" };
}

export default async function ItemPage({ params }: PageProps<"/item/[slug]">) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();

  const category = getCategory(product.categorySlug);

  return (
    <section className="mx-auto max-w-[1240px] px-4 py-8">
      <div className="mb-4 text-[13px] text-muted">
        <Link href="/" className="hover:text-maroon">
          Browse
        </Link>
        {category && (
          <>
            {" / "}
            <Link href={`/c/${category.slug}`} className="hover:text-maroon">
              {category.name}
            </Link>
          </>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Media */}
        <div
          className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-line"
          style={tintSurface(product.tint)}
        >
          <span className="font-serif text-2xl italic opacity-60">Commonplace</span>
        </div>

        {/* Detail */}
        <div>
          <span className="inline-block rounded-full bg-putty px-2.5 py-1 text-[12px] font-medium text-ink">
            {CONDITION_LABELS[product.condition]}
          </span>
          <h1 className="mt-3 font-serif text-[30px] leading-tight text-ink">
            {product.title}
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            {product.location} · {product.distanceMi} mi away
          </p>
          <p className="mt-4 text-[28px] font-semibold text-ink">
            {formatPrice(product.priceCents)}
          </p>
          <p className="mt-1 text-[13px] text-green">Free delivery within 100 miles</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button className="flex-1 rounded-full bg-maroon px-6 py-3 text-[15px] font-semibold text-cream hover:bg-maroon2">
              Reserve &amp; buy
            </button>
            <button className="flex-1 rounded-full border border-maroon px-6 py-3 text-[15px] font-semibold text-maroon hover:bg-tint">
              Make an offer
            </button>
          </div>

          <p className="mt-4 text-[13px] text-muted">
            Every item is inspected before delivery. Questions? Ask the seller —
            answered before you commit.
          </p>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryRail } from "@/components/category-rail";
import { ProductCard } from "@/components/product-card";
import { CATEGORIES, getCategory, productsByCategory } from "@/lib/catalog";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const category = getCategory(slug);
  return { title: category ? category.name : "Category" };
}

export default async function CategoryPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const products = productsByCategory(slug);

  return (
    <>
      <CategoryRail />
      <section className="mx-auto max-w-[1240px] px-4 py-8">
        <Link href="/categories" className="text-[13px] text-muted hover:text-maroon">
          ← All categories
        </Link>
        <div className="mb-6 mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[30px] text-ink">{category.name}</h1>
            <p className="text-[14px] text-muted">
              Every {category.name.toLowerCase()} we have · {category.count} in stock
            </p>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Sort
            <select className="rounded-full border border-line bg-paper px-3 py-1.5 text-[13px] text-ink focus:border-maroon focus:outline-none">
              <option>Recommended</option>
              <option>Price: low to high</option>
              <option>Price: high to low</option>
              <option>Newest first</option>
            </select>
          </label>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-paper p-12 text-center">
            <p className="font-serif text-[18px] text-ink">
              No exact matches in this sample
            </p>
            <p className="mt-1 text-[14px] text-muted">
              We have {category.count} {category.name.toLowerCase()} in stock —
              live inventory connects when the database is wired.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

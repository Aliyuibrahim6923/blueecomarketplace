import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { listCategories } from "@/features/products/queries";

export const metadata: Metadata = { title: "Product categories" };

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <div className="container-page py-8">
      <PageHeader title="Product categories" description="Browse fish, seafood and other approved marine products by category." />
      {categories.length === 0 ? (
        <EmptyState title="No categories yet" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/categories/${c.slug}`} className="block h-full rounded-lg border border-border bg-white p-5 hover:border-ocean-300 hover:shadow-sm">
                <h2 className="font-semibold text-ocean-900">{c.name}</h2>
                {c.description ? <p className="mt-1 text-sm text-muted-foreground">{c.description}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

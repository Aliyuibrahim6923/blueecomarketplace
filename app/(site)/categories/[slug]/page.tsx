import { redirect } from "next/navigation";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const safe = /^[a-z0-9-]{1,80}$/.test(slug) ? slug : "";
  redirect(safe ? `/marketplace?category=${safe}` : "/categories");
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "@/lib/constants";
import type { Category, SearchResult } from "@/types/domain";

export type SearchFilters = {
  q?: string;
  category?: string;
  state?: string;
  productState?: string;
  minPrice?: number;
  maxPrice?: number;
  verifiedOnly?: boolean;
  delivery?: string;
  fixedOnly?: boolean;
  sort?: "relevance" | "newest" | "price_asc" | "price_desc";
  page?: number;
  pageSize?: number;
};

export async function searchProducts(filters: SearchFilters): Promise<{ results: SearchResult[]; total: number; error: boolean }> {
  const supabase = await createClient();
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, filters.page ?? 1);
  const { data, error } = await supabase.rpc("search_products", {
    p_query: filters.q ?? null,
    p_category_slug: filters.category ?? null,
    p_state: filters.state ?? null,
    p_product_state: filters.productState ?? null,
    p_min_price_minor: filters.minPrice ?? null,
    p_max_price_minor: filters.maxPrice ?? null,
    p_verified_only: filters.verifiedOnly ?? false,
    p_delivery_option: filters.delivery ?? null,
    p_fixed_price_only: filters.fixedOnly ?? false,
    p_sort: filters.sort ?? (filters.q ? "relevance" : "newest"),
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) {
    console.error("search_products failed", error.code);
    return { results: [], total: 0, error: true };
  }
  const results = (data ?? []) as SearchResult[];
  return { results, total: results[0]?.total_count ? Number(results[0].total_count) : 0, error: false };
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, slug, name, description, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as Category[];
}

export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("key, value").eq("is_public", true);
  return Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as unknown]));
}

export function settingNumber(settings: Record<string, unknown>, key: string, fallback: number): number {
  const v = settings[key];
  return typeof v === "number" ? v : fallback;
}

export function settingBool(settings: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = settings[key];
  return typeof v === "boolean" ? v : fallback;
}

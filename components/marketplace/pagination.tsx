import Link from "next/link";
import { cn } from "@/lib/utils";

/** Server-rendered pagination that keeps the current query string. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    else sp.delete("page");
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const link = "inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-border bg-white px-3 text-sm font-medium";
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(link, "hover:bg-ocean-50")} rel="prev">
          Previous
        </Link>
      ) : null}
      <span className="px-2 text-sm text-muted-foreground" aria-current="page">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={cn(link, "hover:bg-ocean-50")} rel="next">
          Next
        </Link>
      ) : null}
    </nav>
  );
}

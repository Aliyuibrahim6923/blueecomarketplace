import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { MapPinIcon } from "@/components/icons";
import { formatMinor } from "@/lib/money";
import { stateName } from "@/lib/constants";
import { formatQuantity, humanize, timeAgo } from "@/lib/utils";
import type { SearchResult } from "@/types/domain";
import { ProductImage } from "./product-image";
import { VerificationBadge } from "./badges";

export function Price({ priceMinor, currency, unit, pricingType }: { priceMinor: number | null; currency: string; unit: string; pricingType: string }) {
  if (pricingType === "quote_required" || priceMinor === null) {
    return <span className="font-semibold text-ocean-800">Price on request</span>;
  }
  return (
    <span>
      <span className="text-lg font-bold text-ocean-950">{formatMinor(priceMinor, currency)}</span>
      <span className="text-sm text-muted-foreground"> / {unit}</span>
    </span>
  );
}

export function ProductCard({ product, hrefBase = "/products" }: { product: SearchResult; hrefBase?: string }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xs transition hover:shadow-md">
      <Link href={`${hrefBase}/${product.id}`} className="flex flex-1 flex-col focus:outline-none">
        <ProductImage path={product.cover_image_path} alt={product.name} />
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="info">{humanize(product.product_state)}</Badge>
            <Badge tone="neutral">{product.category_name}</Badge>
          </div>
          <h3 className="line-clamp-2 font-semibold text-ocean-950 group-hover:underline">{product.name}</h3>
          <Price priceMinor={product.price_minor} currency={product.currency} unit={product.unit} pricingType={product.pricing_type} />
          <p className="text-sm text-muted-foreground">
            {formatQuantity(product.available_quantity, product.unit)} available · min {formatQuantity(product.min_order_quantity, product.unit)}
          </p>
          <div className="mt-auto space-y-1.5 pt-2 text-sm">
            <p className="flex items-center gap-1 text-muted-foreground">
              <MapPinIcon width={14} height={14} />
              {[product.location_city, stateName(product.location_state)].filter(Boolean).join(", ")}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="truncate font-medium text-ocean-800">{product.business_name}</span>
              <VerificationBadge status={product.business_verification} />
            </div>
            <p className="text-xs text-muted-foreground">Updated {timeAgo(product.published_at)}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}

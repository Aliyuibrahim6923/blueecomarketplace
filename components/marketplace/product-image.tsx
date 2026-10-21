import Image from "next/image";
import { FishIcon } from "@/components/icons";
import { publicEnv } from "@/lib/env";
import { cn, productImageUrl } from "@/lib/utils";

/** Product photo from the public bucket, or a neutral placeholder (no stock imagery). */
export function ProductImage({
  path,
  alt,
  className,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  priority = false,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const src = productImageUrl(publicEnv().supabaseUrl, path);
  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden bg-ocean-50", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" priority={priority} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ocean-300">
          <FishIcon width={40} height={40} />
          <span className="text-xs">No photo yet</span>
        </div>
      )}
    </div>
  );
}

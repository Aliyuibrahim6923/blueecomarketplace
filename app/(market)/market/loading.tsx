import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="container-page py-8" aria-busy="true" aria-label="Loading listings">
      <Skeleton className="h-10 w-72" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    </div>
  );
}

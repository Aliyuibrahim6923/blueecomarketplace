import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export default function ProductNotFound() {
  return (
    <div className="container-page py-16">
      <EmptyState
        title="Listing not found"
        description="It may have been sold out, archived or removed."
        action={
          <Button asChild>
            <Link href="/marketplace">Back to the marketplace</Link>
          </Button>
        }
      />
    </div>
  );
}

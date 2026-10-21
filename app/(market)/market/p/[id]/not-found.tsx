import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

export default function PublicListingNotFound() {
  return (
    <div className="container-page py-16">
      <EmptyState
        title="This listing is no longer available"
        description="It may have sold out or expired."
        action={
          <Button asChild>
            <Link href="/market">Browse other listings</Link>
          </Button>
        }
      />
    </div>
  );
}

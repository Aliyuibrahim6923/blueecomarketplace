"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addToCart, type CartItem } from "@/features/cart/store";

/** Puts the previous order's items (at today's listed prices) back in the cart. */
export function ReorderButton({ items }: { items: CartItem[] }) {
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        items.forEach(addToCart);
        router.push("/cart");
      }}
    >
      Order again
    </Button>
  );
}

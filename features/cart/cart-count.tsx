"use client";

import { useCart } from "./store";

export function CartCount() {
  const items = useCart();
  if (items.length === 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-500 px-1 text-[11px] font-bold text-white">
      <span className="sr-only">Items in cart: </span>
      {items.length}
    </span>
  );
}

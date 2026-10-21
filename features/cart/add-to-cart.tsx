"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { addToCart, useCart, type CartItem } from "./store";

export function AddToCart({ item, availableQuantity }: { item: Omit<CartItem, "quantity">; availableQuantity: number }) {
  const cart = useCart();
  const inCart = cart.find((i) => i.productId === item.productId);
  const [quantity, setQuantity] = React.useState(inCart?.quantity ?? String(item.minOrderQuantity));
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState(false);
  const id = React.useId();

  function onAdd() {
    if (!/^\d{1,10}(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) {
      setError("Enter a quantity, up to 3 decimals.");
      return;
    }
    if (Number(quantity) < item.minOrderQuantity) {
      setError(`Minimum order is ${item.minOrderQuantity} ${item.unit}.`);
      return;
    }
    if (Number(quantity) > availableQuantity) {
      setError(`Only ${availableQuantity} ${item.unit} listed as available.`);
      return;
    }
    setError(null);
    addToCart({ ...item, quantity });
    setAdded(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="w-36">
          <Label htmlFor={id}>Quantity ({item.unit})</Label>
          <Input
            id={id}
            inputMode="decimal"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value.trim());
              setAdded(false);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
          />
        </div>
        <Button type="button" variant="teal" onClick={onAdd}>
          {inCart ? "Update cart" : "Add to cart"}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      {added ? (
        <p className="text-sm text-teal-700" role="status">
          Added. <Link href="/cart" className="font-semibold underline">Go to cart</Link>
        </p>
      ) : null}
    </div>
  );
}

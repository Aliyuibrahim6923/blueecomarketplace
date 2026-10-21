"use client";

import { useSyncExternalStore } from "react";

/**
 * Client-side cart kept in localStorage. It is a convenience only: the server
 * re-reads every product, price and availability when the order is created.
 */
export type CartItem = {
  productId: string;
  businessId: string;
  businessName: string;
  name: string;
  unit: string;
  unitPriceMinor: number;
  currency: string;
  quantity: string;
  minOrderQuantity: number;
  deliveryOptions: string[];
};

const KEY = "bluemarket.cart.v1";
const listeners = new Set<() => void>();
let cache: CartItem[] | null = null;
const EMPTY: CartItem[] = [];

function read(): CartItem[] {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed) ? (parsed as CartItem[]).filter((i) => typeof i?.productId === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: CartItem[]) {
  cache = items;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage may be full or disabled; the cart still works for this page view.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function addToCart(item: CartItem) {
  const items = read();
  const existing = items.find((i) => i.productId === item.productId);
  if (existing) {
    write(items.map((i) => (i.productId === item.productId ? { ...item } : i)));
  } else {
    write([...items, item]);
  }
}

export function updateQuantity(productId: string, quantity: string) {
  write(read().map((i) => (i.productId === productId ? { ...i, quantity } : i)));
}

export function removeFromCart(productId: string) {
  write(read().filter((i) => i.productId !== productId));
}

export function removeSupplierItems(businessId: string) {
  write(read().filter((i) => i.businessId !== businessId));
}

export function groupBySupplier(items: CartItem[]) {
  const groups = new Map<string, { businessId: string; businessName: string; items: CartItem[] }>();
  for (const item of items) {
    const g = groups.get(item.businessId) ?? { businessId: item.businessId, businessName: item.businessName, items: [] };
    g.items.push(item);
    groups.set(item.businessId, g);
  }
  return [...groups.values()];
}

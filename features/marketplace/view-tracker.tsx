"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Counts one anonymous view per product per browser session (no personal data). */
export function ViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    const key = `bm.viewed.${productId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private mode — still fine to record.
    }
    void createClient().rpc("record_product_view", { p_product_id: productId });
  }, [productId]);
  return null;
}

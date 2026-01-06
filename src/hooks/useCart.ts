import { useEffect, useMemo, useState } from "react";
import { hydrateBySkus, type HydratedSkuItem } from "../api/catalogApi";

export type CartItem = { sku: string; qty: number };

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState<Record<string, HydratedSkuItem>>({});
  const [loading, setLoading] = useState(false);

  const skus = useMemo(() => cart.map((c) => c.sku), [cart]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (skus.length === 0) {
        setHydrated({});
        return;
      }
      setLoading(true);
      try {
        const { items } = await hydrateBySkus(skus);
        if (cancelled) return;
        const map: Record<string, HydratedSkuItem> = {};
        for (const it of items) map[it.sku] = it;
        setHydrated(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [skus.join("|")]); // stable trigger

  function addSku(sku: string) {
    setCart((prev) => {
      const existing = prev.find((p) => p.sku === sku);
      if (existing) return prev.map((p) => (p.sku === sku ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { sku, qty: 1 }];
    });
  }

  function setQty(sku: string, qty: number) {
    setCart((prev) => {
      const nextQty = Math.max(0, Math.floor(qty));
      if (nextQty === 0) return prev.filter((p) => p.sku !== sku);
      return prev.map((p) => (p.sku === sku ? { ...p, qty: nextQty } : p));
    });
  }

  function removeSku(sku: string) {
    setCart((prev) => prev.filter((p) => p.sku !== sku));
  }

  return { cart, hydrated, loading, addSku, setQty, removeSku };
}

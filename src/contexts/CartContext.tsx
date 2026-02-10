import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { hydrateBySkus } from "../api/catalogApi";
import type { HydratedSkuItem } from "../api/catalogApi";
import { selectDealerName } from "../store/slices/filterSlice";
import { resolveStoreForDealer } from "../utils/storeRouting";

export type CartItem = { sku: string; qty: number; qty_recommended?: number };

// Store cart items per dealer: Record<dealerName, CartItem[]>
type CartByDealer = Record<string, CartItem[]>;

interface CartContextType {
  cart: CartItem[];
  hydrated: Record<string, HydratedSkuItem>;
  loading: boolean;
  addSku: (sku: string, initialQty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  removeSku: (sku: string) => void;
  toggleSku: (sku: string, initialQty?: number) => void;
  isInCart: (sku: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'b2b-cart';

function normalizeSku(value: unknown): string {
  return String(value ?? '').trim();
}

// Load cart from localStorage
function loadCartFromStorage(): CartByDealer {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CartByDealer;
      // Validate structure
      if (typeof parsed === 'object' && parsed !== null) {
        const normalized: CartByDealer = {};
        Object.entries(parsed).forEach(([dealer, items]) => {
          if (!Array.isArray(items)) return;
          const bySku = new Map<string, CartItem>();
          items.forEach((item) => {
            const sku = normalizeSku(item?.sku);
            const qty = Math.max(0, Math.floor(Number(item?.qty ?? 0)));
            if (!sku || qty <= 0) return;
            const existing = bySku.get(sku);
            if (existing) {
              existing.qty += qty;
              if (existing.qty_recommended === undefined && item?.qty_recommended !== undefined) {
                existing.qty_recommended = Number(item.qty_recommended);
              }
            } else {
              const qtyRecommended = item?.qty_recommended !== undefined
                ? Math.max(1, Math.floor(Number(item.qty_recommended)))
                : undefined;
              bySku.set(sku, { sku, qty, qty_recommended: qtyRecommended });
            }
          });
          normalized[dealer] = Array.from(bySku.values());
        });
        return normalized;
      }
    }
  } catch (error) {
    console.error('Error loading cart from localStorage:', error);
  }
  return {};
}

// Save cart to localStorage
function saveCartToStorage(cartByDealer: CartByDealer) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartByDealer));
  } catch (error) {
    console.error('Error saving cart to localStorage:', error);
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const dealerName = useSelector(selectDealerName);
  // Store cart items per dealer - initialize from localStorage
  const [cartByDealer, setCartByDealer] = useState<CartByDealer>(() => loadCartFromStorage());
  const [hydrated, setHydrated] = useState<Record<string, HydratedSkuItem>>({});
  const [loading, setLoading] = useState(false);

  // Get cart items for current dealer
  const cart = useMemo(() => {
    if (!dealerName) return [];
    return cartByDealer[dealerName] || [];
  }, [cartByDealer, dealerName]);

  const storeCode = useMemo(() => resolveStoreForDealer(dealerName), [dealerName]);

  const skus = useMemo(() => cart.map((c) => c.sku), [cart]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    saveCartToStorage(cartByDealer);
  }, [cartByDealer]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (skus.length === 0) {
        return;
      }
      
      setLoading(true);
      try {
        const { items } = await hydrateBySkus(skus, storeCode);
        if (cancelled) return;
        
        setHydrated(prev => {
            const map: Record<string, HydratedSkuItem> = { ...prev };
            for (const it of items) map[it.sku] = it;
            return map;
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    
    return () => {
      cancelled = true;
    };
  }, [skus.join("|"), storeCode]);

  function addSku(sku: string, initialQty: number = 1) {
    if (!dealerName) return; // Can't add items without a dealer selected
    const normalizedSku = normalizeSku(sku);
    if (!normalizedSku) return;
    
    setCartByDealer((prev) => {
      const dealerCart = prev[dealerName] || [];
      const existing = dealerCart.find((p) => normalizeSku(p.sku) === normalizedSku);
      const updatedCart = existing 
        ? dealerCart.map((p) => (normalizeSku(p.sku) === normalizedSku ? { ...p, sku: normalizedSku, qty: p.qty + 1, qty_recommended: p.qty_recommended ?? p.qty } : p))
        : [...dealerCart, { sku: normalizedSku, qty: Math.max(1, initialQty), qty_recommended: Math.max(1, initialQty) }];
      
      const updated = {
        ...prev,
        [dealerName]: updatedCart
      };
      
      return updated;
    });
  }

  function setQty(sku: string, qty: number) {
    if (!dealerName) return; // Can't modify items without a dealer selected
    const normalizedSku = normalizeSku(sku);
    if (!normalizedSku) return;
    
    setCartByDealer((prev) => {
      const dealerCart = prev[dealerName] || [];
      const nextQty = Math.max(0, Math.floor(qty));
      const updatedCart = nextQty === 0 
        ? dealerCart.filter((p) => normalizeSku(p.sku) !== normalizedSku)
        : dealerCart.map((p) => (normalizeSku(p.sku) === normalizedSku ? { ...p, sku: normalizedSku, qty: nextQty } : p));
      
      return {
        ...prev,
        [dealerName]: updatedCart
      };
    });
  }

  function removeSku(sku: string) {
    if (!dealerName) return; // Can't remove items without a dealer selected
    const normalizedSku = normalizeSku(sku);
    if (!normalizedSku) return;
    
    setCartByDealer((prev) => {
      const dealerCart = prev[dealerName] || [];
      return {
        ...prev,
        [dealerName]: dealerCart.filter((p) => normalizeSku(p.sku) !== normalizedSku)
      };
    });
  }
  
  function isInCart(sku: string) {
      const normalizedSku = normalizeSku(sku);
      if (!normalizedSku) return false;
      return cart.some(item => normalizeSku(item.sku) === normalizedSku);
  }

  function toggleSku(sku: string, initialQty: number = 1) {
      if (isInCart(sku)) {
          removeSku(sku);
      } else {
          addSku(sku, initialQty);
      }
  }

  return (
    <CartContext.Provider value={{ cart, hydrated, loading, addSku, setQty, removeSku, toggleSku, isInCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

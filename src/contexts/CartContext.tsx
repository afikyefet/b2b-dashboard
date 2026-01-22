import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { hydrateBySkus } from "../api/catalogApi";
import type { HydratedSkuItem } from "../api/catalogApi";
import { getCartCache, updateCartCache } from "../api/cacheApi";
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

// Debounce delay for saving cart to Redis (ms)
const SAVE_DEBOUNCE_MS = 500;

export function CartProvider({ children }: { children: ReactNode }) {
  const dealerName = useSelector(selectDealerName);
  // Store cart items per dealer - initialize empty, load from Redis
  const [cartByDealer, setCartByDealer] = useState<CartByDealer>({});
  const [hydrated, setHydrated] = useState<Record<string, HydratedSkuItem>>({});
  const [loading, setLoading] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);

  // Track pending saves per dealer for debouncing
  const pendingSaveRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Get cart items for current dealer
  const cart = useMemo(() => {
    if (!dealerName) return [];
    return cartByDealer[dealerName] || [];
  }, [cartByDealer, dealerName]);

  const storeCode = useMemo(() => resolveStoreForDealer(dealerName), [dealerName]);

  const skus = useMemo(() => cart.map((c) => c.sku), [cart]);

  // Load cart from Redis on mount
  useEffect(() => {
    let cancelled = false;

    async function loadCart() {
      try {
        const cached = await getCartCache();
        if (cancelled) return;
        if (cached && typeof cached === 'object') {
          setCartByDealer(cached);
        }
      } catch (error) {
        console.error('Error loading cart from Redis:', error);
      } finally {
        if (!cancelled) setCartLoaded(true);
      }
    }

    loadCart();
    return () => { cancelled = true; };
  }, []);

  // Debounced save function for a specific dealer
  const saveCartForDealer = useCallback((dealer: string, items: CartItem[]) => {
    // Clear any pending save for this dealer
    if (pendingSaveRef.current[dealer]) {
      clearTimeout(pendingSaveRef.current[dealer]);
    }

    // Schedule a new debounced save
    pendingSaveRef.current[dealer] = setTimeout(() => {
      updateCartCache(dealer, items).catch((error) => {
        console.error('Error saving cart to Redis:', error);
      });
      delete pendingSaveRef.current[dealer];
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Save cart to Redis when it changes (debounced, per dealer)
  useEffect(() => {
    if (!cartLoaded || !dealerName) return;

    const items = cartByDealer[dealerName] || [];
    saveCartForDealer(dealerName, items);
  }, [cartByDealer, dealerName, cartLoaded, saveCartForDealer]);

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
    
    setCartByDealer((prev) => {
      const dealerCart = prev[dealerName] || [];
      const existing = dealerCart.find((p) => p.sku === sku);
      const updatedCart = existing 
        ? dealerCart.map((p) => (p.sku === sku ? { ...p, qty: p.qty + 1, qty_recommended: p.qty_recommended ?? p.qty } : p))
        : [...dealerCart, { sku, qty: Math.max(1, initialQty), qty_recommended: Math.max(1, initialQty) }];
      
      const updated = {
        ...prev,
        [dealerName]: updatedCart
      };
      
      return updated;
    });
  }

  function setQty(sku: string, qty: number) {
    if (!dealerName) return; // Can't modify items without a dealer selected
    
    setCartByDealer((prev) => {
      const dealerCart = prev[dealerName] || [];
      const nextQty = Math.max(0, Math.floor(qty));
      const updatedCart = nextQty === 0 
        ? dealerCart.filter((p) => p.sku !== sku)
        : dealerCart.map((p) => (p.sku === sku ? { ...p, qty: nextQty } : p));
      
      return {
        ...prev,
        [dealerName]: updatedCart
      };
    });
  }

  function removeSku(sku: string) {
    if (!dealerName) return; // Can't remove items without a dealer selected
    
    setCartByDealer((prev) => {
      const dealerCart = prev[dealerName] || [];
      return {
        ...prev,
        [dealerName]: dealerCart.filter((p) => p.sku !== sku)
      };
    });
  }
  
  function isInCart(sku: string) {
      return cart.some(item => item.sku === sku);
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

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useSelector } from "react-redux";
import { hydrateBySkus } from "../api/catalogApi";
import type { HydratedSkuItem } from "../api/catalogApi";
import { selectDealerName } from "../store/slices/filterSlice";

export type CartItem = { sku: string; qty: number };

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

// Load cart from localStorage
function loadCartFromStorage(): CartByDealer {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CartByDealer;
      // Validate structure
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
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
        const { items } = await hydrateBySkus(skus);
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
  }, [skus.join("|")]);

  function addSku(sku: string, initialQty: number = 1) {
    if (!dealerName) return; // Can't add items without a dealer selected
    
    setCartByDealer((prev) => {
      const dealerCart = prev[dealerName] || [];
      const existing = dealerCart.find((p) => p.sku === sku);
      const updatedCart = existing 
        ? dealerCart.map((p) => (p.sku === sku ? { ...p, qty: p.qty + 1 } : p))
        : [...dealerCart, { sku, qty: Math.max(1, initialQty) }];
      
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


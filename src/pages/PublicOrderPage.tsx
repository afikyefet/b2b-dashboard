import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { hydrateBySkus, type HydratedSkuItem } from '../api/catalogApi';
import { type Order, type OrderItem } from '../api/orders';
import { getPublicCatalog, getPublicOrder, patchPublicOrder } from '../api/publicOrders';
import { AddProductModal } from '../cmps/AddProductModal';
import { OrderStatusBadge } from '../cmps/OrderStatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { useDirtyState } from '../hooks/useDirtyState';
import { matchStoreForDealer, normalizeStore, type StoreCode } from '../utils/storeRouting';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';

const STORE_DOMAINS: Record<string, string | undefined> = {
  US: import.meta.env.VITE_SHOPIFY_STORE_DOMAIN_US,
  EU: import.meta.env.VITE_SHOPIFY_STORE_DOMAIN_EU,
};

type CartBuildResult = {
  url: string;
  missingSkus: string[];
  reason?: 'missing-domain' | 'empty';
};

function normalizeDomain(domain?: string) {
  if (!domain) return '';
  const trimmed = domain.trim();
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
  const base = withoutProtocol.split(/[/?#]/)[0];
  return base.replace(/\/$/, '').toLowerCase();
}

function normalizeCartDomain(domain?: string) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return '';
  if (normalized === 'checkout.shopify.com' || normalized === 'shopify.com') return '';

  if (normalized.startsWith('checkout.')) {
    const candidate = normalized.replace(/^checkout\./, '');
    const knownDomains = [
      normalizeDomain(STORE_DOMAINS.US),
      normalizeDomain(STORE_DOMAINS.EU),
    ].filter(Boolean);
    if (candidate.endsWith('.myshopify.com') || knownDomains.includes(candidate)) {
      return candidate;
    }
  }

  return normalized;
}

function getStoreSlug(domain?: string) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return '';
  return normalized.split('.')[0] || '';
}

function detectStoreByIdentifier(identifier?: string): StoreCode | null {
  if (!identifier) return null;
  const normalized = normalizeStore(identifier);
  if (normalized) return normalized;

  const domain = normalizeDomain(identifier);
  const usDomain = normalizeDomain(STORE_DOMAINS.US);
  const euDomain = normalizeDomain(STORE_DOMAINS.EU);

  if (domain && usDomain && domain === usDomain) return 'US';
  if (domain && euDomain && domain === euDomain) return 'EU';

  const usSlug = getStoreSlug(STORE_DOMAINS.US);
  const euSlug = getStoreSlug(STORE_DOMAINS.EU);

  if (domain && usSlug && domain === usSlug) return 'US';
  if (domain && euSlug && domain === euSlug) return 'EU';

  const raw = identifier.trim().toLowerCase();
  if (/\beu\b/.test(raw) || raw.includes('-eu') || raw.includes('_eu')) return 'EU';
  if (/\bus\b/.test(raw) || raw.includes('-us') || raw.includes('_us')) return 'US';

  return null;
}

function resolveOrderStore(order: Order | null): StoreCode {
  const storeFromField = detectStoreByIdentifier(order?.shopify_store);
  if (storeFromField) return storeFromField;

  const storeFromCheckout = detectStoreByIdentifier(order?.shopify_checkout_url);
  if (storeFromCheckout) return storeFromCheckout;

  const dealerMatch = matchStoreForDealer(order?.dealer_company || order?.dealer_name);
  if (dealerMatch) return dealerMatch;

  const currency = (order?.currency || '').trim().toUpperCase();
  if (currency.startsWith('EUR')) return 'EU';
  if (currency.startsWith('USD')) return 'US';
  return 'US';
}

function resolveCartDomain(order: Order | null, fallbackDomain?: string) {
  const fromStore = normalizeCartDomain(order?.shopify_store);
  if (fromStore && fromStore.includes('.')) return fromStore;

  const fromCheckout = normalizeCartDomain(order?.shopify_checkout_url);
  if (fromCheckout) return fromCheckout;

  return normalizeCartDomain(fallbackDomain);
}

function splitTitle(title: string) {
  const trimmed = (title || '').trim();
  if (!trimmed) return { product: '', variant: '' };
  const idx = trimmed.lastIndexOf(' - ');
  if (idx === -1) return { product: trimmed, variant: '' };
  return {
    product: trimmed.slice(0, idx).trim(),
    variant: trimmed.slice(idx + 3).trim(),
  };
}

function parseVariantMeta(variantTitle: string) {
  const parts = variantTitle
    .split(' / ')
    .map(part => part.trim())
    .filter(Boolean);
  return {
    color: parts[0] || '',
    size: parts[1] || '',
    extra: parts.length > 2 ? parts.slice(2).join(' / ') : '',
  };
}

function serializeItems(items: OrderItem[]) {
  return JSON.stringify(
    items.map(item => ({
      sku: item.sku,
      qty: item.qty,
      variant_id: item.variant_id,
      qty_recommended: item.qty_recommended ?? null,
    }))
  );
}

function formatTime(value: Date | null) {
  if (!value) return '';
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildCartUrl(
  items: OrderItem[],
  detailsBySku: Record<string, HydratedSkuItem>,
  storeDomain?: string,
  options?: { returnTo?: string }
): CartBuildResult {
  const domain = normalizeCartDomain(storeDomain);
  if (!domain) {
    return { url: '', missingSkus: [], reason: 'missing-domain' };
  }

  const lineItems: string[] = [];
  const missingSkus: string[] = [];

  for (const item of items) {
    if (item.qty <= 0) continue;
    let variantId = item.variant_id;
    if (!variantId) {
      const hydratedVariantId = detailsBySku[item.sku]?.variant_id;
      if (hydratedVariantId) {
        const parsed = parseInt(String(hydratedVariantId), 10);
        if (!Number.isNaN(parsed)) {
          variantId = parsed;
        }
      }
    }

    if (!variantId) {
      if (item.sku) missingSkus.push(item.sku);
      continue;
    }
    lineItems.push(`${variantId}:${item.qty}`);
  }

  if (lineItems.length === 0) {
    return { url: '', missingSkus, reason: 'empty' };
  }

  const returnTo = options?.returnTo?.trim();
  const returnToParam = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : '';
  return { url: `https://${domain}/cart/${lineItems.join(',')}${returnToParam}`, missingSkus };
}

export default function PublicOrderPage() {
  const { token } = useParams<{ token: string }>();
  const isValidToken = token && token !== 'undefined';
  const { isAuthenticated } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadVersion, setLoadVersion] = useState(0);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<Date | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [skuDetails, setSkuDetails] = useState<Record<string, HydratedSkuItem>>({});
  const [hydrating, setHydrating] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const [cartCopied, setCartCopied] = useState(false);
  const [isCartLinkExpanded, setIsCartLinkExpanded] = useState(false);
  const [isCartLinkOverflowing, setIsCartLinkOverflowing] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSaveRef = useRef<((delay?: number) => void) | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const itemsRef = useRef<OrderItem[]>([]);
  const orderRef = useRef<Order | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const cartUrlRef = useRef<HTMLDivElement | null>(null);
  const [heroOffset, setHeroOffset] = useState(0);

  const resetKey = isValidToken ? `${token}-${loadVersion}` : '';
  const itemsDirty = useDirtyState(items, resetKey);
  const storeCode = resolveOrderStore(order);
  const storeDomain = STORE_DOMAINS[storeCode];
  const cartDomain = resolveCartDomain(order, storeDomain);

  const loadOrder = useCallback(async () => {
    if (!isValidToken) return;
    setLoading(true);
    try {
      const data = await getPublicOrder(token!);
      setOrder(data);
      setItems(data.items);
      setAutoSaveState('idle');
      setLastAutoSaveAt(null);
      setLoadVersion(prev => prev + 1);
    } catch (err) {
      console.error(err);
      alert('Error loading order');
    } finally {
      setLoading(false);
    }
  }, [token, isValidToken]);

  useEffect(() => {
    if (!isValidToken) return;
    loadOrder();
  }, [isValidToken, loadOrder]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const updateOffset = () => {
      setHeroOffset(hero.getBoundingClientRect().height + 16);
    };

    updateOffset();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateOffset);
      observer.observe(hero);
    }
    window.addEventListener('resize', updateOffset);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateOffset);
    };
  }, []);

  useEffect(() => {
    if (!order) return;
    const skus = items.map(item => item.sku).filter(Boolean);
    if (skus.length === 0) {
      setSkuDetails({});
      return;
    }

    let isActive = true;
    setHydrating(true);
    setHydrateError(null);
    const hydratePromise = isAuthenticated
      ? hydrateBySkus(skus, storeCode)
      : getPublicCatalog(token!);

    hydratePromise.then(result => {
        if (!isActive) return;
        const map: Record<string, HydratedSkuItem> = {};
        result.items.forEach(item => {
          if (item.sku) map[item.sku] = item;
        });
        setSkuDetails(map);
      }).catch(err => {
        console.error(err);
        if (!isActive) return;
        setHydrateError('Unable to load product details.');
      })
      .finally(() => {
        if (!isActive) return;
        setHydrating(false);
      });

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, items, order, storeCode, token]);
  const isCompleted = order?.status === 'COMPLETED';
  const isEditable =
    order?.status === 'DRAFT' ||
    order?.status === 'SENT' ||
    order?.status === 'OPENED' ||
    order?.status === 'CHECKOUT_CREATED';
  const readOnly = !isEditable;
  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  const cartInfo = useMemo(
    () => buildCartUrl(items, skuDetails, cartDomain, { returnTo: '/cart' }),
    [items, skuDetails, cartDomain]
  );

  useEffect(() => {
    if (!cartInfo.url) {
      setIsCartLinkExpanded(false);
      setIsCartLinkOverflowing(false);
      return;
    }
    if (isCartLinkExpanded) return;
    const el = cartUrlRef.current;
    if (!el) return;

    const updateOverflow = () => {
      setIsCartLinkOverflowing(el.scrollHeight > el.clientHeight + 1);
    };

    updateOverflow();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateOverflow);
      observer.observe(el);
    }
    window.addEventListener('resize', updateOverflow);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateOverflow);
    };
  }, [cartInfo.url, isCartLinkExpanded]);

  const cartLinkClampStyles: CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };
  const showCartLinkToggle = isCartLinkOverflowing || isCartLinkExpanded;

  const saveOrder = useCallback(async (options?: { silent?: boolean; source?: 'auto' | 'manual' }) => {
    const currentOrder = orderRef.current;
    if (!currentOrder) return false;

    const editable =
      currentOrder.status === 'DRAFT' ||
      currentOrder.status === 'SENT' ||
      currentOrder.status === 'OPENED' ||
      currentOrder.status === 'CHECKOUT_CREATED';
    if (!editable) {
      if (!options?.silent) {
        alert('Order cannot be modified in current status.');
      }
      return false;
    }

    if (savingRef.current) {
      pendingSaveRef.current = true;
      return false;
    }

    const snapshot = itemsRef.current;
    const snapshotSig = serializeItems(snapshot);

    savingRef.current = true;
    pendingSaveRef.current = false;
    if (options?.source === 'auto') {
      setAutoSaveState('saving');
    }

    let savedOk = false;
    try {
      const updatedOrder = await patchPublicOrder(token!, {
        expected_version: currentOrder.version,
        items: snapshot.map(item => ({
          sku: item.sku,
          qty: item.qty,
          variant_id: item.variant_id,
          qty_recommended: item.qty_recommended ?? null,
        })),
      });

      setOrder(updatedOrder);

      const currentSig = serializeItems(itemsRef.current);
      if (currentSig === snapshotSig) {
        itemsDirty.markClean();
        if (options?.source === 'auto') {
          setAutoSaveState('saved');
          setLastAutoSaveAt(new Date());
        } else if (!options?.silent) {
          alert('Cart updated!');
        }
        savedOk = true;
      } else {
        pendingSaveRef.current = true;
        if (options?.source === 'auto') {
          setAutoSaveState('pending');
        }
        savedOk = true;
      }
      return true;
    } catch (err: unknown) {
      console.error(err);
      const error = err as { message?: string };
      if (options?.source === 'auto') {
        setAutoSaveState('error');
        if (error.message && error.message.includes('conflict')) {
          loadOrder();
        }
      } else {
        if (error.message && error.message.includes('conflict')) {
          alert('Order was updated by someone else. Reloading...');
          loadOrder();
        } else {
          alert('Error saving changes');
        }
      }
      return false;
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current && savedOk && options?.source === 'auto') {
        pendingSaveRef.current = false;
        if (scheduleAutoSaveRef.current) {
          scheduleAutoSaveRef.current(300);
        }
      }
    }
  }, [itemsDirty, loadOrder, token]);

  const scheduleAutoSave = useCallback((delay = 900) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveOrder({ silent: true, source: 'auto' });
    }, delay);
  }, [saveOrder]);

  useEffect(() => {
    scheduleAutoSaveRef.current = scheduleAutoSave;
    return () => {
      scheduleAutoSaveRef.current = null;
    };
  }, [scheduleAutoSave]);

  useEffect(() => {
    if (!order || readOnly) return;
    if (!itemsDirty.isDirty) {
      setAutoSaveState(prev => (prev === 'pending' ? 'idle' : prev));
      return;
    }

    setAutoSaveState(prev => (prev === 'saving' ? prev : 'pending'));
    scheduleAutoSave(900);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [items, itemsDirty.isDirty, order, readOnly, scheduleAutoSave]);

  const alertBase = "rounded-lg border px-4 py-3 text-sm font-semibold";
  const alertSuccess = `${alertBase} bg-[#e3f1df] text-[#007a5c] border-[#c4e0c0]`;
  const alertWarning = `${alertBase} bg-[#fff4e5] text-[#7a4b00] border-[#f5d5a6]`;
  const alertInfo = `${alertBase} bg-[#eef2ff] text-[#3730a3] border-[#c7d2fe]`;

  const autoSaveStatus = useMemo(() => {
    if (readOnly) return null;
    if (autoSaveState === 'idle' && !lastAutoSaveAt) return null;

    if (autoSaveState === 'pending') {
      return { text: 'Changes detected. Auto-saving soon...', className: alertInfo };
    }
    if (autoSaveState === 'saving') {
      return { text: 'Auto-saving changes...', className: alertInfo };
    }
    if (autoSaveState === 'error') {
      return { text: 'Auto-save failed. Please check your connection.', className: alertWarning };
    }
    const timeLabel = formatTime(lastAutoSaveAt);
    return {
      text: timeLabel
        ? `All changes saved at ${timeLabel}. Cart link updated.`
        : 'All changes saved. Cart link updated.',
      className: alertSuccess,
    };
  }, [autoSaveState, lastAutoSaveAt, readOnly, alertInfo, alertSuccess, alertWarning]);

  const handleCreateCart = async () => {
    if (!readOnly && itemsDirty.isDirty) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      await saveOrder({ silent: true, source: 'auto' });
    }

    const latestCartInfo = buildCartUrl(items, skuDetails, cartDomain, { returnTo: '/cart' });
    if (latestCartInfo.reason === 'missing-domain') {
      alert('Missing Shopify store domain. Please configure store domains for this environment.');
      return;
    }
    if (latestCartInfo.reason === 'empty') {
      alert('Cart is empty. Add at least one item to continue.');
      return;
    }
    if (latestCartInfo.missingSkus.length > 0) {
      alert(`Missing variant IDs for: ${latestCartInfo.missingSkus.join(', ')}`);
      return;
    }

    setCartLoading(true);
    window.open(latestCartInfo.url, '_blank', 'noopener,noreferrer');
    setTimeout(() => setCartLoading(false), 300);
  };

  const handleCopyCart = async () => {
    if (!cartInfo.url) return;
    try {
      await navigator.clipboard.writeText(cartInfo.url);
      setCartCopied(true);
      setTimeout(() => setCartCopied(false), 2000);
    } catch (err) {
      console.error(err);
      alert('Unable to copy cart link.');
    }
  };

  const handleQtyChange = (index: number, newQty: number) => {
    if (newQty < 0) return;
    const nextItems = [...items];
    if (newQty === 0) {
      nextItems.splice(index, 1);
    } else {
      nextItems[index] = { ...nextItems[index], qty: newQty };
    }
    setItems(nextItems);
  };

  const handleQtyStep = (index: number, delta: number) => {
    const nextQty = Math.max(0, items[index].qty + delta);
    handleQtyChange(index, nextQty);
  };

  const handleRemove = (index: number) => {
    const nextItems = [...items];
    nextItems.splice(index, 1);
    setItems(nextItems);
  };

  const handleAddItem = (newItem: { sku: string; variant_id: number; title: string; price: string; qty: number }) => {
    const existingIndex = items.findIndex(item => item.variant_id === newItem.variant_id);
    const nextItems = [...items];
    if (existingIndex >= 0) {
      nextItems[existingIndex] = {
        ...nextItems[existingIndex],
        qty: nextItems[existingIndex].qty + newItem.qty,
      };
    } else {
      nextItems.push({
        ...newItem,
        qty_recommended: newItem.qty,
      });
    }
    setItems(nextItems);
  };

  if (!isValidToken) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Invalid token</div>;
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading Order...</div>;
  if (!order) return <div className="py-10 text-center text-sm text-muted-foreground">Order not found</div>;

  const pageStyle: CSSProperties =
    heroOffset > 0 ? { ['--public-hero-offset' as string]: `${heroOffset}px` } : {};

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 pb-16 pt-8" style={pageStyle}>
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-gradient-to-br from-muted to-background p-6 shadow-sm" ref={heroRef}>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Order Review</div>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            {order.dealer_company || order.dealer_name || 'Dealer Order'}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{totalItems} items</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
            <span>{storeCode} store</span>
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      {isCompleted ? (
        <div className={alertSuccess}>This order has been completed.</div>
      ) : !isEditable ? (
        <div className={alertWarning}>This order can no longer be modified.</div>
      ) : (
        <div className={alertInfo}>
          Changes auto-save after a short pause, and the cart link updates automatically.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Items</h2>
              <p className="text-sm text-muted-foreground">
                {hydrating ? 'Loading product details...' : 'Verify sizes, colors, and quantities before sending to Shopify.'}
              </p>
              {hydrateError && <span className="text-xs text-destructive">{hydrateError}</span>}
            </div>
            {!readOnly && (
              <Button variant="outline" onClick={() => setShowAddModal(true)}>
                + Add Product
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {items.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="space-y-2 p-8 text-center">
                  <h3 className="text-lg font-semibold">No items yet</h3>
                  <p className="text-sm text-muted-foreground">Add products to build your cart.</p>
                </CardContent>
              </Card>
            )}

            {items.map((item, idx) => {
              const details = skuDetails[item.sku];
              const titleSplit = splitTitle(item.title);
              const productTitle = details?.product_title || titleSplit.product || item.title;
              const variantTitle = details?.variant_title || titleSplit.variant || item.title;
              const meta = parseVariantMeta(variantTitle);
              const imageUrl = details?.variant_image_url || null;

              return (
                <Card key={`${item.variant_id}-${idx}`} className="overflow-hidden">
                  <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                    <div className="flex min-h-[140px] items-center justify-center bg-gradient-to-b from-muted to-background">
                      {imageUrl ? (
                        <img src={imageUrl} alt={productTitle} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">No image</div>
                      )}
                    </div>
                    <CardContent className="space-y-3 p-4">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{productTitle || 'Untitled Product'}</h3>
                        {variantTitle && <p className="text-xs text-muted-foreground">{variantTitle}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>SKU: {item.sku || 'N/A'}</span>
                        {meta.color && <Badge variant="secondary" className="text-[10px]">Color: {meta.color}</Badge>}
                        {meta.size && <Badge variant="secondary" className="text-[10px]">Size: {meta.size}</Badge>}
                        {meta.extra && <Badge variant="secondary" className="text-[10px]">Option: {meta.extra}</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        {readOnly ? (
                          <div className="text-sm font-medium text-foreground">Qty: {item.qty}</div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleQtyStep(idx, -1)}
                              aria-label="Decrease quantity"
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                              className="h-8 w-20 text-center"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleQtyStep(idx, 1)}
                              aria-label="Increase quantity"
                            >
                              +
                            </Button>
                          </div>
                        )}
                        {!readOnly && (
                          <Button variant="ghost" className="text-destructive" onClick={() => handleRemove(idx)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-[var(--public-hero-offset)]">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Items</span>
                  <strong className="text-foreground">{totalItems}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Store</span>
                  <strong className="text-foreground">{storeCode}</strong>
                </div>
              </div>

              {autoSaveStatus && (
                <div className={autoSaveStatus.className}>
                  {autoSaveStatus.text}
                </div>
              )}

              <div className="space-y-3 border-t border-border pt-4">
                <h4 className="text-sm font-semibold text-foreground">Cart Link</h4>
                {cartInfo.reason === 'missing-domain' ? (
                  <p className="text-sm text-muted-foreground">Add store domains to enable cart links.</p>
                ) : cartInfo.reason === 'empty' ? (
                  <p className="text-sm text-muted-foreground">Add items to generate a cart link.</p>
                ) : cartInfo.missingSkus.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Missing variant IDs for: {cartInfo.missingSkus.join(', ')}
                  </p>
                ) : (
                  <>
                    <div
                      ref={cartUrlRef}
                      className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground break-all"
                      style={isCartLinkExpanded ? undefined : cartLinkClampStyles}
                    >
                      {cartInfo.url}
                    </div>
                    {showCartLinkToggle && (
                      <Button
                        variant="link"
                        className="mt-1 h-auto justify-start p-0 text-xs font-semibold"
                        onClick={() => setIsCartLinkExpanded(prev => !prev)}
                        aria-expanded={isCartLinkExpanded}
                      >
                        {isCartLinkExpanded ? 'Show less' : 'Show more'}
                      </Button>
                    )}
                    <div className="grid gap-2">
                      <Button variant="outline" onClick={handleCopyCart}>
                        {cartCopied ? 'Copied' : 'Copy Link'}
                      </Button>
                      <Button
                        onClick={handleCreateCart}
                        disabled={cartLoading}
                        className="bg-[#008060] text-white hover:bg-[#006f55]"
                      >
                        {cartLoading ? 'Opening Cart...' : 'Open Cart'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddItem}
        store={storeCode}
        publicToken={token || undefined}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { hydrateBySkus, type HydratedSkuItem } from '../api/catalogApi';
import { type Order, type OrderItem } from '../api/orders';
import { getPublicCatalog, getPublicOrder, patchPublicOrder } from '../api/publicOrders';
import { AddProductModal } from '../cmps/AddProductModal';
import { OrderStatusBadge } from '../cmps/OrderStatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { useDirtyState } from '../hooks/useDirtyState';
import '../styles/PublicOrderPage.scss';

const STORE_DOMAINS: Record<string, string | undefined> = {
  US: import.meta.env.VITE_SHOPIFY_STORE_DOMAIN_US,
  EU: import.meta.env.VITE_SHOPIFY_STORE_DOMAIN_EU,
};

type CartBuildResult = {
  url: string;
  missingSkus: string[];
  reason?: 'missing-domain' | 'empty';
};

function normalizeStore(store?: string) {
  const normalized = (store || '').trim().toUpperCase();
  if (['US', 'USA', 'UNITED STATES', 'UNITED_STATES'].includes(normalized)) return 'US';
  if (['EU', 'EUR', 'EUROPE'].includes(normalized)) return 'EU';
  return 'US';
}

function normalizeDomain(domain?: string) {
  if (!domain) return '';
  return domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
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
  storeDomain?: string
): CartBuildResult {
  const domain = normalizeDomain(storeDomain);
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

  return { url: `https://${domain}/cart/${lineItems.join(',')}`, missingSkus };
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
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleAutoSaveRef = useRef<((delay?: number) => void) | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const itemsRef = useRef<OrderItem[]>([]);
  const orderRef = useRef<Order | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const [heroOffset, setHeroOffset] = useState(0);

  const resetKey = isValidToken ? `${token}-${loadVersion}` : '';
  const itemsDirty = useDirtyState(items, resetKey);

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
      ? hydrateBySkus(skus, order.shopify_store)
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
  }, [isAuthenticated, items, order, token]);

  const storeCode = normalizeStore(order?.shopify_store);
  const storeDomain = STORE_DOMAINS[storeCode];
  const isCompleted = order?.status === 'COMPLETED';
  const isEditable =
    order?.status === 'DRAFT' ||
    order?.status === 'SENT' ||
    order?.status === 'OPENED' ||
    order?.status === 'CHECKOUT_CREATED';
  const readOnly = !isEditable;
  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  const cartInfo = useMemo(
    () => buildCartUrl(items, skuDetails, storeDomain),
    [items, skuDetails, storeDomain]
  );

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

  const autoSaveStatus = useMemo(() => {
    if (readOnly) return null;
    if (autoSaveState === 'idle' && !lastAutoSaveAt) return null;

    if (autoSaveState === 'pending') {
      return { text: 'Changes detected. Auto-saving soon...', className: 'public-order-alert public-order-alert--info' };
    }
    if (autoSaveState === 'saving') {
      return { text: 'Auto-saving changes...', className: 'public-order-alert public-order-alert--info' };
    }
    if (autoSaveState === 'error') {
      return { text: 'Auto-save failed. Please check your connection.', className: 'public-order-alert public-order-alert--warning' };
    }
    const timeLabel = formatTime(lastAutoSaveAt);
    return {
      text: timeLabel
        ? `All changes saved at ${timeLabel}. Cart link updated.`
        : 'All changes saved. Cart link updated.',
      className: 'public-order-alert public-order-alert--success',
    };
  }, [autoSaveState, lastAutoSaveAt, readOnly]);

  const handleCreateCart = async () => {
    if (!readOnly && itemsDirty.isDirty) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      await saveOrder({ silent: true, source: 'auto' });
    }

    const latestCartInfo = buildCartUrl(items, skuDetails, storeDomain);
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
        qty_sales: newItem.qty,
      });
    }
    setItems(nextItems);
  };

  if (!isValidToken) {
    return <div className="public-order-empty">Invalid token</div>;
  }

  if (loading) return <div className="public-order-empty">Loading Order...</div>;
  if (!order) return <div className="public-order-empty">Order not found</div>;

  const pageStyle: CSSProperties =
    heroOffset > 0 ? { ['--public-hero-offset' as string]: `${heroOffset}px` } : {};

  return (
    <div className="public-order-page" style={pageStyle}>
      <header className="public-order-hero" ref={heroRef}>
        <div className="public-order-hero__main">
          <div className="public-order-hero__eyebrow">Order Review</div>
          <h1>{order.dealer_company || order.dealer_name || 'Dealer Order'}</h1>
          <div className="public-order-hero__meta">
            <span>{totalItems} items</span>
            <span className="public-order-hero__dot" />
            <span>{storeCode} store</span>
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      {isCompleted ? (
        <div className="public-order-alert public-order-alert--success">
          This order has been completed.
        </div>
      ) : !isEditable ? (
        <div className="public-order-alert public-order-alert--warning">
          This order can no longer be modified.
        </div>
      ) : (
        <div className="public-order-alert public-order-alert--info">
          Changes auto-save after a short pause, and the cart link updates automatically.
        </div>
      )}

      <div className="public-order-layout">
        <section className="public-order-items">
          <div className="public-order-items__header">
            <div>
              <h2>Items</h2>
              <p className="public-order-items__hint">
                {hydrating ? 'Loading product details...' : 'Verify sizes, colors, and quantities before sending to Shopify.'}
              </p>
              {hydrateError && <span className="public-order-error">{hydrateError}</span>}
            </div>
            {!readOnly && (
              <button className="btn btn-secondary" onClick={() => setShowAddModal(true)}>
                + Add Product
              </button>
            )}
          </div>

          <div className="public-order-grid">
            {items.length === 0 && (
              <div className="public-order-empty-card">
                <h3>No items yet</h3>
                <p>Add products to build your cart.</p>
              </div>
            )}

            {items.map((item, idx) => {
              const details = skuDetails[item.sku];
              const titleSplit = splitTitle(item.title);
              const productTitle = details?.product_title || titleSplit.product || item.title;
              const variantTitle = details?.variant_title || titleSplit.variant || item.title;
              const meta = parseVariantMeta(variantTitle);
              const imageUrl = details?.variant_image_url || null;

              return (
                <article key={`${item.variant_id}-${idx}`} className="public-order-card">
                  <div className="public-order-card__media">
                    {imageUrl ? (
                      <img src={imageUrl} alt={productTitle} />
                    ) : (
                      <div className="public-order-card__placeholder">No image</div>
                    )}
                  </div>
                  <div className="public-order-card__body">
                    <div className="public-order-card__titles">
                      <h3>{productTitle || 'Untitled Product'}</h3>
                      {variantTitle && <p>{variantTitle}</p>}
                    </div>
                    <div className="public-order-card__meta">
                      <span>SKU: {item.sku || 'N/A'}</span>
                      {meta.color && <span className="public-order-chip">Color: {meta.color}</span>}
                      {meta.size && <span className="public-order-chip">Size: {meta.size}</span>}
                      {meta.extra && <span className="public-order-chip">Option: {meta.extra}</span>}
                    </div>
                    <div className="public-order-card__footer">
                      {readOnly ? (
                        <div className="public-order-qty-readonly">Qty: {item.qty}</div>
                      ) : (
                        <div className="public-order-qty">
                          <button
                            className="public-order-qty__btn"
                            onClick={() => handleQtyStep(idx, -1)}
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.qty}
                            onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                          />
                          <button
                            className="public-order-qty__btn"
                            onClick={() => handleQtyStep(idx, 1)}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      )}
                      {!readOnly && (
                        <button className="public-order-remove" onClick={() => handleRemove(idx)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="public-order-sidebar">
          <div className="public-order-panel">
            <h3>Summary</h3>
            <div className="public-order-summary">
              <div>
                <span>Items</span>
                <strong>{totalItems}</strong>
              </div>
              <div>
                <span>Store</span>
                <strong>{storeCode}</strong>
              </div>
            </div>

            {autoSaveStatus && (
              <div className={autoSaveStatus.className}>
                {autoSaveStatus.text}
              </div>
            )}

            <div className="public-order-cart">
              <h4>Cart Link</h4>
              {cartInfo.reason === 'missing-domain' ? (
                <p>Add store domains to enable cart links.</p>
              ) : cartInfo.reason === 'empty' ? (
                <p>Add items to generate a cart link.</p>
              ) : cartInfo.missingSkus.length > 0 ? (
                <p>Missing variant IDs for: {cartInfo.missingSkus.join(', ')}</p>
              ) : (
                <>
                  <p className="public-order-cart__url">{cartInfo.url}</p>
                  <div className="public-order-cart__actions">
                    <button className="btn btn-secondary" onClick={handleCopyCart}>
                      {cartCopied ? 'Copied' : 'Copy Link'}
                    </button>
                    <button className="btn btn-primary" onClick={handleCreateCart} disabled={cartLoading}>
                      {cartLoading ? 'Opening Cart...' : 'Open Cart'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddItem}
        store={order?.shopify_store}
        publicToken={token || undefined}
      />
    </div>
  );
}

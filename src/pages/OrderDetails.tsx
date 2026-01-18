import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder, patchOrder, sendOrder, deleteOrder, type Order, type OrderItem } from '../api/orders';
import { OrderStatusBadge } from '../cmps/OrderStatusBadge';
import { EditableItemsTable } from '../cmps/EditableItemsTable';
import { hydrateBySkus, type HydratedSkuItem } from '../api/catalogApi';
import { useDirtyState } from '../hooks/useDirtyState';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { normalizeStore, resolveStoreForDealer } from '../utils/storeRouting';

export default function OrderDetails() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  // Check for invalid orderId: undefined, empty, or the string "undefined"
  const isValidOrderId = orderId && orderId !== 'undefined';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [dealerName, setDealerName] = useState('');
  const [dealerEmail, setDealerEmail] = useState('');
  const [dealerCompany, setDealerCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [skuDetails, setSkuDetails] = useState<Record<string, HydratedSkuItem>>({});

  // Track which order we've already reset the baseline for
  const resetBaselineForOrderId = useRef<string | null>(null);

  // Track dirty state for each field - use valid orderId or empty string as resetKey
  const resetKey = isValidOrderId ? orderId : '';
  const dealerNameDirty = useDirtyState(dealerName, resetKey);
  const dealerEmailDirty = useDirtyState(dealerEmail, resetKey);
  const dealerCompanyDirty = useDirtyState(dealerCompany, resetKey);
  const notesDirty = useDirtyState(notes, resetKey);
  const itemsDirty = useDirtyState(items, resetKey);

  const loadOrder = useCallback(async () => {
    if (!orderId || orderId === 'undefined') return;
    setLoading(true);
    try {
      const data = await getOrder(orderId);
      setOrder(data);

      // Set all form values
      setDealerName(data.dealer_name);
      setDealerEmail(data.dealer_email);
      setDealerCompany(data.dealer_company);
      setNotes(data.notes || '');
      setItems(data.items);
    } catch (err) {
      console.error(err);
      alert('Error loading order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!isValidOrderId) return;
    loadOrder();
    // Reset the baseline tracking when orderId changes
    resetBaselineForOrderId.current = null;
  }, [isValidOrderId, loadOrder]);

  // Reset dirty state after order is loaded and form values are set
  // This ensures the baseline matches the loaded values, not the initial empty values
  // We only reset once per orderId to avoid resetting during user edits
  useEffect(() => {
    if (!loading && order && orderId && orderId !== resetBaselineForOrderId.current) {
      // Only reset if we haven't already reset for this order
      resetBaselineForOrderId.current = orderId;
      // Use setTimeout to ensure state updates have been processed
      setTimeout(() => {
        dealerNameDirty.resetToClean();
        dealerEmailDirty.resetToClean();
        dealerCompanyDirty.resetToClean();
        notesDirty.resetToClean();
        itemsDirty.resetToClean();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, order, orderId]);

  const hasUnsavedChanges =
    dealerNameDirty.isDirty ||
    dealerEmailDirty.isDirty ||
    dealerCompanyDirty.isDirty ||
    notesDirty.isDirty ||
    itemsDirty.isDirty;

  const storeCode = useMemo(() => {
    if (!order) return undefined;
    return (
      normalizeStore(order.shopify_store) ??
      resolveStoreForDealer(order.dealer_company || order.dealer_name)
    );
  }, [order]);

  useEffect(() => {
    if (!order) return;
    const skus = items.map(item => item.sku).filter(Boolean);
    if (skus.length === 0) {
      setSkuDetails({});
      return;
    }

    let isActive = true;
    hydrateBySkus(skus, storeCode)
      .then(({ items: hydrated }) => {
        if (!isActive) return;
        const map: Record<string, HydratedSkuItem> = {};
        hydrated.forEach(item => {
          if (item.sku) map[item.sku] = item;
        });
        setSkuDetails(map);
      })
      .catch(err => {
        console.error('[OrderDetails] failed to hydrate items', err);
        if (!isActive) return;
        setSkuDetails({});
      });

    return () => {
      isActive = false;
    };
  }, [items, order, storeCode]);

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const syncQtyToSales = ['DRAFT', 'SENT', 'OPENED', 'CHECKOUT_CREATED'].includes(order.status);
      const updatedOrder = await patchOrder(orderId!, {
        expected_version: order.version,
        dealer_name: dealerNameDirty.isDirty ? dealerName : undefined,
        dealer_email: dealerEmailDirty.isDirty ? dealerEmail : undefined,
        dealer_company: dealerCompanyDirty.isDirty ? dealerCompany : undefined,
        notes: notesDirty.isDirty ? notes : undefined,
        items: itemsDirty.isDirty ? items.map(i => ({
          sku: i.sku,
          qty: syncQtyToSales ? (i.qty_sales ?? i.qty) : i.qty,
          variant_id: i.variant_id,
          qty_recommended: i.qty_recommended ?? null,
          qty_sales: i.qty_sales ?? i.qty
        })) : undefined,
      });

      setOrder(updatedOrder);
      // Update form values and mark clean
      setDealerName(updatedOrder.dealer_name);
      setDealerEmail(updatedOrder.dealer_email);
      setDealerCompany(updatedOrder.dealer_company);
      setNotes(updatedOrder.notes || '');
      setItems(updatedOrder.items);

      dealerNameDirty.markClean();
      dealerEmailDirty.markClean();
      dealerCompanyDirty.markClean();
      notesDirty.markClean();
      itemsDirty.markClean();

      alert('Changes saved!');
    } catch (err: unknown) {
      console.error(err);
      const error = err as { message?: string };
      if (error.message && error.message.includes('conflict')) {
        alert('Order was updated by someone else. Reloading...');
        loadOrder();
      } else {
        alert('Error saving changes');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (hasUnsavedChanges) {
      alert('Please save changes before sending.');
      return;
    }
    if (!confirm('Mark order as SENT?')) return;
    try {
      const updated = await sendOrder(orderId!);
      setOrder(updated);
      alert('Order marked as SENT');
    } catch (err) {
      console.error(err);
      alert('Error sending order');
    }
  };

  const canDelete = (status: string) => {
    return status === 'DRAFT' || status === 'SENT' || status === 'OPENED';
  };

  const handleDelete = async () => {
    if (!order) return;
    if (!canDelete(order.status)) {
      alert('Order cannot be deleted in current status.');
      return;
    }
    if (!confirm('Delete this order? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteOrder(order.order_id);
      navigate('/orders');
    } catch (err) {
      console.error(err);
      alert('Error deleting order');
    } finally {
      setDeleting(false);
    }
  };

  const copyLink = () => {
    if (!order?.share_token) return;
    const url = `${window.location.origin}/public/order/${order.share_token}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  // Early return for invalid orderId (after all hooks)
  if (!isValidOrderId) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Invalid order ID</div>;
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading Order...</div>;
  if (!order) return <div className="py-10 text-center text-sm text-muted-foreground">Order not found</div>;

  const publicLink = `${window.location.origin}/public/order/${order.share_token}`;

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 pb-20 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
            Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Order #{order.order_id.substring(0, 8)}...
            </h1>
            <p className="text-xs text-muted-foreground">
              Updated: {new Date(order.updated_at).toLocaleString()}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={!canDelete(order.status) || deleting}
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dealer Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="dealer-name">Name</Label>
                <Input
                  id="dealer-name"
                  type="text"
                  value={dealerName}
                  onChange={e => setDealerName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dealer-company">Company</Label>
                <Input
                  id="dealer-company"
                  type="text"
                  value={dealerCompany}
                  onChange={e => setDealerCompany(e.target.value)}
                />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="dealer-email">Email</Label>
                <Input
                  id="dealer-email"
                  type="email"
                  value={dealerEmail}
                  onChange={e => setDealerEmail(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <EditableItemsTable
                items={items}
                onChange={setItems}
                store={order?.shopify_store}
                skuDetails={skuDetails}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder="Add notes..."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Share</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.share_token ? (
                <>
                  <div className="break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {publicLink}
                  </div>
                  <Button variant="outline" onClick={copyLink} className="w-full">
                    Copy Link
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={order.status !== 'DRAFT'}
                    className={cn(
                      "w-full",
                      order.status === 'DRAFT'
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {order.status === 'DRAFT' ? 'Mark as Sent' : `Status: ${order.status}`}
                  </Button>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No share token available.</div>
              )}
            </CardContent>
          </Card>

          {order.shopify_checkout_url && (
            <Card>
              <CardHeader>
                <CardTitle>Checkout</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <a href={order.shopify_checkout_url} target="_blank" rel="noreferrer">
                    View Checkout
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 px-4 py-4 shadow-lg">
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-end gap-3">
            <span className="text-sm font-semibold text-destructive">Unsaved Changes</span>
            <Button variant="outline" onClick={() => loadOrder()}>
              Discard
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

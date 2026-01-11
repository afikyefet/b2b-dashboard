import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicOrder, patchPublicOrder, createCheckout } from '../api/publicOrders';
import { type Order, type OrderItem } from '../api/orders';
import { OrderStatusBadge } from '../cmps/OrderStatusBadge';
import { EditableItemsTable } from '../cmps/EditableItemsTable';
import { useDirtyState } from '../hooks/useDirtyState';

export default function PublicOrderPage() {
  const { token } = useParams<{ token: string }>();
  const isValidToken = token && token !== 'undefined';
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  const [items, setItems] = useState<OrderItem[]>([]);
  const resetKey = isValidToken ? token : '';
  const itemsDirty = useDirtyState(items, resetKey);

  const loadOrder = useCallback(async () => {
    if (!isValidToken) return;
    setLoading(true);
    try {
      const data = await getPublicOrder(token!);
      setOrder(data);
      setItems(data.items);
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

  const handleSave = async () => {
    if (!order) return;
    if (!isEditable) {
      alert('Order cannot be modified in current status.');
      return;
    }
    setSaving(true);
    try {
      const updatedOrder = await patchPublicOrder(token!, {
        expected_version: order.version,
        items: items.map(i => ({ 
            sku: i.sku, 
            qty: i.qty, 
            variant_id: i.variant_id,
            qty_recommended: i.qty_recommended ?? null
        })),
      });
      
      setOrder(updatedOrder);
      setItems(updatedOrder.items);
      itemsDirty.markClean();
      alert('Cart updated!');
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

  const handleCheckout = async () => {
    if (itemsDirty.isDirty) {
        if (!confirm('You have unsaved changes. Save and proceed to checkout?')) return;
        await handleSave();
    }
    
    setCheckoutLoading(true);
    try {
        const { checkoutUrl } = await createCheckout(token!);
        window.location.href = checkoutUrl;
    } catch(err) {
        console.error(err);
        alert('Error creating checkout');
        setCheckoutLoading(false);
    }
  };

  // Early return for invalid token (after all hooks)
  if (!isValidToken) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Invalid token</div>;
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Order...</div>;
  if (!order) return <div style={{ padding: '40px', textAlign: 'center' }}>Order not found</div>;

  const isCompleted = order.status === 'COMPLETED';
  const isEditable = order.status === 'DRAFT' || order.status === 'SENT' || order.status === 'OPENED';
  const readOnly = !isEditable;

  return (
    <div className="public-order-page" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <div>
            <h1 style={{ margin: 0, marginBottom: '8px' }}>Order Review</h1>
            <div style={{ color: '#666' }}>{order.dealer_company || order.dealer_name}</div>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      {isCompleted ? (
        <div style={{ padding: '20px', background: '#e3f1df', borderRadius: '8px', color: '#007a5c', marginBottom: '20px', fontWeight: 'bold' }}>
            This order has been completed.
        </div>
      ) : !isEditable ? (
        <div style={{ padding: '16px', background: '#fff4e5', borderRadius: '8px', marginBottom: '20px', color: '#7a4b00', fontWeight: 'bold' }}>
            This order can no longer be modified.
        </div>
      ) : (
        <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '20px', color: '#444' }}>
            Please review your items below. You can update quantities or add products before checking out.
        </div>
      )}

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0 }}>Items</h3>
        <EditableItemsTable 
            items={items} 
            onChange={setItems} 
            readOnly={readOnly}
            store={order?.shopify_store}
        />
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', alignItems: 'center' }}>
            {itemsDirty.isDirty && (
                <div style={{ color: '#d72c2c', fontWeight: 'bold', marginRight: 'auto' }}>
                    Unsaved changes
                </div>
            )}
            
            <button
                onClick={handleSave}
                disabled={saving || !itemsDirty.isDirty}
                style={{
                    padding: '12px 24px',
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: (saving || !itemsDirty.isDirty) ? 'default' : 'pointer',
                    opacity: (saving || !itemsDirty.isDirty) ? 0.6 : 1,
                    fontWeight: '600'
                }}
            >
                {saving ? 'Saving...' : 'Save Changes'}
            </button>

            <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                style={{
                    padding: '12px 32px',
                    background: '#008060',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: checkoutLoading ? 'wait' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1.1em',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
            >
                {checkoutLoading ? 'Redirecting...' : 'Checkout in Shopify'}
            </button>
        </div>
      )}
      
      {order.shopify_checkout_url && !isCompleted && (
          <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <a href={order.shopify_checkout_url} style={{ color: '#008060', textDecoration: 'underline' }}>
                  Continue existing checkout
              </a>
          </div>
      )}
    </div>
  );
}


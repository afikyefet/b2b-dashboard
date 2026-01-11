import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrder, patchOrder, sendOrder, deleteOrder, type Order, type OrderItem } from '../api/orders';
import { OrderStatusBadge } from '../cmps/OrderStatusBadge';
import { EditableItemsTable } from '../cmps/EditableItemsTable';
import { useDirtyState } from '../hooks/useDirtyState';

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

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const updatedOrder = await patchOrder(orderId!, {
        expected_version: order.version,
        dealer_name: dealerNameDirty.isDirty ? dealerName : undefined,
        dealer_email: dealerEmailDirty.isDirty ? dealerEmail : undefined,
        dealer_company: dealerCompanyDirty.isDirty ? dealerCompany : undefined,
        notes: notesDirty.isDirty ? notes : undefined,
        items: itemsDirty.isDirty ? items.map(i => ({ 
            sku: i.sku, 
            qty: i.qty, 
            variant_id: i.variant_id,
            qty_recommended: i.qty_recommended ?? null
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
    } catch(err) {
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
    return <div style={{ padding: '40px', textAlign: 'center' }}>Invalid order ID</div>;
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Order...</div>;
  if (!order) return <div style={{ padding: '40px', textAlign: 'center' }}>Order not found</div>;

  const publicLink = `${window.location.origin}/public/order/${order.share_token}`;

  return (
    <div className="order-details-page" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/orders')} style={{ padding: '6px 12px', cursor: 'pointer' }}>&larr; Back</button>
          <h1 style={{ margin: 0, fontSize: '1.5em' }}>Order #{order.order_id.substring(0,8)}...</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '0.85em', color: '#666' }}>
            Updated: {new Date(order.updated_at).toLocaleString()}
          </div>
          <button
            onClick={handleDelete}
            disabled={!canDelete(order.status) || deleting}
            style={{
              padding: '6px 12px',
              background: 'white',
              border: '1px solid #fca5a5',
              borderRadius: '4px',
              color: '#b91c1c',
              cursor: (!canDelete(order.status) || deleting) ? 'not-allowed' : 'pointer',
              opacity: (!canDelete(order.status) || deleting) ? 0.5 : 1
            }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
          {/* Dealer Info */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0 }}>Dealer Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#666' }}>Name</label>
                    <input 
                        type="text" value={dealerName} onChange={e => setDealerName(e.target.value)} 
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#666' }}>Company</label>
                    <input 
                        type="text" value={dealerCompany} onChange={e => setDealerCompany(e.target.value)} 
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85em', color: '#666' }}>Email</label>
                    <input 
                        type="email" value={dealerEmail} onChange={e => setDealerEmail(e.target.value)} 
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    />
                </div>
            </div>
          </div>

          {/* Items */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0 }}>Items</h3>
            <EditableItemsTable 
                items={items} 
                onChange={setItems} 
                store={order?.shopify_store}
            />
          </div>

          {/* Notes */}
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0 }}>Notes</h3>
            <textarea 
                value={notes} onChange={e => setNotes(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                placeholder="Add notes..."
            />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Share Card */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginTop: 0 }}>Share</h3>
                {order.share_token ? (
                    <>
                        <div style={{ marginBottom: '10px', fontSize: '0.85em', background: '#f5f5f5', padding: '8px', borderRadius: '4px', wordBreak: 'break-all' }}>
                            {publicLink}
                        </div>
                        <button 
                            onClick={copyLink}
                            style={{ width: '100%', marginBottom: '10px', padding: '8px', background: 'white', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Copy Link
                        </button>
                        <button 
                            onClick={handleSend}
                            disabled={order.status !== 'DRAFT'}
                            style={{ 
                                width: '100%', padding: '8px', 
                                background: order.status === 'DRAFT' ? '#008060' : '#ccc', 
                                color: 'white', border: 'none', borderRadius: '4px', cursor: order.status === 'DRAFT' ? 'pointer' : 'not-allowed' 
                            }}
                        >
                            {order.status === 'DRAFT' ? 'Mark as Sent' : `Status: ${order.status}`}
                        </button>
                    </>
                ) : (
                    <div>No share token available.</div>
                )}
            </div>

            {/* Checkout Info */}
            {order.shopify_checkout_url && (
                <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ marginTop: 0 }}>Checkout</h3>
                    <a 
                        href={order.shopify_checkout_url} target="_blank" rel="noreferrer"
                        style={{ display: 'block', textAlign: 'center', padding: '10px', background: '#008060', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}
                    >
                        View Checkout
                    </a>
                </div>
            )}
        </div>
      </div>

      {/* Save Bar */}
      {hasUnsavedChanges && (
        <div style={{ 
            position: 'fixed', bottom: 0, left: 0, right: 0, 
            background: 'white', padding: '15px 20px', 
            borderTop: '1px solid #ddd', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px',
            zIndex: 1000
        }}>
            <span style={{ fontWeight: 'bold', color: '#d72c2c' }}>Unsaved Changes</span>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                    onClick={() => loadOrder()} // simple reset by reload
                    style={{ padding: '8px 16px', background: 'white', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Discard
                </button>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    style={{ padding: '8px 24px', background: '#008060', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'wait' : 'pointer' }}
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
      )}
    </div>
  );
}


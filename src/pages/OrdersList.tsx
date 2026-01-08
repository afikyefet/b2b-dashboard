import React, { useEffect, useMemo, useState } from 'react';
import { listOrders, deleteOrder, type Order } from '../api/orders';
import { OrderStatusBadge } from '../cmps/OrderStatusBadge';

export default function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const ordersCacheKey = 'orders_cache_v2';
  const readCachedOrders = () => {
    try {
      const raw = localStorage.getItem(ordersCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { orders: Order[] };
      if (!parsed || !Array.isArray(parsed.orders)) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const writeCachedOrders = (items: Order[]) => {
    try {
      localStorage.setItem(ordersCacheKey, JSON.stringify({ orders: items }));
    } catch {
      // Ignore cache write failures (e.g. quota).
    }
  };

  const loadOrders = async (options?: { useCache?: boolean }) => {
    if (options?.useCache) {
      const cached = readCachedOrders();
      if (cached?.orders.length > 0) {
        setOrders(cached.orders);
      }
    }
    setLoading(true);
    try {
      const res = await listOrders();
      setOrders(res);
      writeCachedOrders(res);
    } catch (err) {
      console.error(err);
      alert('Error loading orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders({ useCache: true });
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const visibleOrders = useMemo(() => {
    const status = statusFilter.trim();
    const query = search.trim().toLowerCase();

    return orders.filter(order => {
      if (status && order.status !== status) return false;
      if (!query) return true;

      const haystack = [
        order.order_id,
        order.dealer_name,
        order.dealer_company,
        order.dealer_email
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [orders, statusFilter, search]);

  const canDelete = (status: string) => {
    return status === 'DRAFT' || status === 'SENT' || status === 'OPENED';
  };

  const handleDelete = async (orderId: string, status: string) => {
    if (!canDelete(status)) {
      alert('Order cannot be deleted in current status.');
      return;
    }
    if (!confirm('Delete this order? This cannot be undone.')) return;
    setDeletingOrderId(orderId);
    try {
      await deleteOrder(orderId);
      setOrders(prev => prev.filter(o => o.order_id !== orderId));
    } catch (err) {
      console.error(err);
      alert('Error deleting order');
    } finally {
      setDeletingOrderId(null);
    }
  };

  return (
    <div className="orders-list-page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Orders</h1>
        <button 
          onClick={() => loadOrders()} 
          style={{ padding: '8px 16px', background: 'white', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
        >
          Refresh
        </button>
      </header>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="OPENED">Opened</option>
          <option value="CHECKOUT_CREATED">Checkout Created</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Search dealer, email..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '250px' }}
          />
          <button type="submit" style={{ padding: '8px 16px', background: '#008060', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Search</button>
        </form>
      </div>

      <div style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontSize: '0.85em', color: '#6b7280' }}>Order ID</th>
              <th style={{ padding: '12px 16px', fontSize: '0.85em', color: '#6b7280' }}>Status</th>
              <th style={{ padding: '12px 16px', fontSize: '0.85em', color: '#6b7280' }}>Dealer</th>
              <th style={{ padding: '12px 16px', fontSize: '0.85em', color: '#6b7280' }}>Updated</th>
              <th style={{ padding: '12px 16px', fontSize: '0.85em', color: '#6b7280' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && orders.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center' }}>Loading...</td></tr>
            ) : visibleOrders.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No orders found.</td></tr>
            ) : (
              visibleOrders.map(order => (
                <tr key={order.order_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{order.order_id.substring(0, 8)}...</td>
                  <td style={{ padding: '12px 16px' }}><OrderStatusBadge status={order.status} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: '500' }}>{order.dealer_name}</div>
                    <div style={{ fontSize: '0.85em', color: '#6b7280' }}>{order.dealer_company}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.9em' }}>{new Date(order.updated_at).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <a 
                      href={`/orders/${order.order_id}`}
                      style={{ 
                        display: 'inline-block',
                        padding: '6px 12px',
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        color: '#374151',
                        fontSize: '0.9em'
                      }}
                    >
                      Open
                    </a>
                    <button
                      onClick={() => handleDelete(order.order_id, order.status)}
                      disabled={!canDelete(order.status) || deletingOrderId === order.order_id}
                      style={{
                        marginLeft: '8px',
                        padding: '6px 12px',
                        background: 'white',
                        border: '1px solid #fca5a5',
                        borderRadius: '4px',
                        color: '#b91c1c',
                        fontSize: '0.9em',
                        cursor: (!canDelete(order.status) || deletingOrderId === order.order_id) ? 'not-allowed' : 'pointer',
                        opacity: (!canDelete(order.status) || deletingOrderId === order.order_id) ? 0.5 : 1
                      }}
                    >
                      {deletingOrderId === order.order_id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


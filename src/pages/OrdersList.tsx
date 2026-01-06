import React, { useEffect, useState } from 'react';
import { listOrders, type Order } from '../api/orders';
import { OrderStatusBadge } from '../cmps/OrderStatusBadge';

export default function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await listOrders({ 
        status: statusFilter || undefined, 
        q: search || undefined 
      });
      setOrders(res);
    } catch (err) {
      console.error(err);
      alert('Error loading orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
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
              <th style={{ padding: '12px 16px', fontSize: '0.85em', color: '#6b7280' }}>Total</th>
              <th style={{ padding: '12px 16px', fontSize: '0.85em', color: '#6b7280' }}>Updated</th>
              <th style={{ padding: '12px 16px', fontSize: '0.85em', color: '#6b7280' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center' }}>Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No orders found.</td></tr>
            ) : (
              orders.map(order => (
                <tr key={order.order_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{order.order_id.substring(0, 8)}...</td>
                  <td style={{ padding: '12px 16px' }}><OrderStatusBadge status={order.status} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: '500' }}>{order.dealer_name}</div>
                    <div style={{ fontSize: '0.85em', color: '#6b7280' }}>{order.dealer_company}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>${Number(order.subtotal).toFixed(2)}</td>
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


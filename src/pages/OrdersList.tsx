import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOrders, deleteOrder, type Order } from '../api/orders';
import { OrderStatusBadge } from '../cmps/OrderStatusBadge';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

type OrdersViewMode = 'table' | 'aggregate';

type DealerOrdersAggregate = {
  key: string;
  dealerName: string;
  dealerCompany: string;
  totalOrders: number;
  openOrders: number;
  lastUpdatedAt: string;
  recentOrders: Order[];
};

function isOpenOrderStatus(status: string) {
  return status !== 'COMPLETED' && status !== 'CANCELLED';
}

function summarizeOrderItems(order: Order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const nonZeroItems = items.filter(item => (item.qty ?? 0) > 0);
  const totalQty = nonZeroItems.reduce((acc, item) => acc + (item.qty || 0), 0);
  const preview = nonZeroItems
    .slice(0, 4)
    .map(item => `${item.sku} x${item.qty}`)
    .join(', ');
  const extra = nonZeroItems.length > 4 ? ` +${nonZeroItems.length - 4} more` : '';
  return {
    totalItems: nonZeroItems.length,
    totalQty,
    preview: preview + extra,
  };
}

export default function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<OrdersViewMode>('table');

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
      if (cached && cached.orders && cached.orders.length > 0) {
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

  const aggregatedOrders = useMemo(() => {
    const byDealer = new Map<string, DealerOrdersAggregate>();
    const sorted = [...visibleOrders].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    sorted.forEach((order) => {
      const dealerCompany = (order.dealer_company || '').trim();
      const dealerName = (order.dealer_name || '').trim();
      const key = dealerCompany || dealerName || order.dealer_email || order.order_id;
      const existing = byDealer.get(key);

      if (!existing) {
        byDealer.set(key, {
          key,
          dealerName: dealerName || 'Unknown Dealer',
          dealerCompany: dealerCompany || dealerName || 'Unknown Company',
          totalOrders: 1,
          openOrders: isOpenOrderStatus(order.status) ? 1 : 0,
          lastUpdatedAt: order.updated_at,
          recentOrders: [order],
        });
        return;
      }

      existing.totalOrders += 1;
      if (isOpenOrderStatus(order.status)) {
        existing.openOrders += 1;
      }
      if (new Date(order.updated_at).getTime() > new Date(existing.lastUpdatedAt).getTime()) {
        existing.lastUpdatedAt = order.updated_at;
      }
      existing.recentOrders.push(order);
    });

    return Array.from(byDealer.values()).sort(
      (a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
    );
  }, [visibleOrders]);

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

  const allStatusesValue = '__all__';

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 pb-12 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
            type="button"
          >
            Table View
          </Button>
          <Button
            variant={viewMode === 'aggregate' ? 'default' : 'outline'}
            onClick={() => setViewMode('aggregate')}
            type="button"
          >
            Aggregate View
          </Button>
          <Button variant="outline" onClick={() => loadOrders()} type="button">
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="w-48">
            <Select
              value={statusFilter || allStatusesValue}
              onValueChange={(value) =>
                setStatusFilter(value === allStatusesValue ? '' : value)
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allStatusesValue}>All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="OPENED">Opened</SelectItem>
                <SelectItem value="CHECKOUT_CREATED">Checkout Created</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <Input
              type="text"
              placeholder="Search dealer, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
            <Button type="submit" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {viewMode === 'table' ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : visibleOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleOrders.map(order => (
                    <TableRow key={order.order_id}>
                      <TableCell className="font-mono text-xs">
                        {order.order_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{order.dealer_name}</div>
                        <div className="text-xs text-muted-foreground">{order.dealer_company}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(order.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/orders/${order.order_id}`}>Open</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(order.order_id, order.status)}
                          disabled={!canDelete(order.status) || deletingOrderId === order.order_id}
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          {deletingOrderId === order.order_id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {loading && orders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : aggregatedOrders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No orders found.
              </CardContent>
            </Card>
          ) : (
            aggregatedOrders.map(group => (
              <Card key={group.key}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{group.dealerCompany}</div>
                      <div className="text-xs text-muted-foreground">{group.dealerName}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Orders: {group.totalOrders}</Badge>
                      <Badge variant="secondary">Open: {group.openOrders}</Badge>
                      <Badge variant="secondary">
                        Last Update: {new Date(group.lastUpdatedAt).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {group.recentOrders.slice(0, 3).map(order => {
                      const summary = summarizeOrderItems(order);
                      return (
                        <div
                          key={order.order_id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs">{order.order_id.substring(0, 8)}...</span>
                              <OrderStatusBadge status={order.status} />
                              <span className="text-xs text-muted-foreground">
                                {new Date(order.updated_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {summary.totalItems} items, qty {summary.totalQty}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {summary.preview || 'No items'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/orders/${order.order_id}`}>Open</Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(order.order_id, order.status)}
                              disabled={!canDelete(order.status) || deletingOrderId === order.order_id}
                              className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            >
                              {deletingOrderId === order.order_id ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { type OrderStatus } from '../api/orders';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const STATUS_STYLES: Record<OrderStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-primary/10 text-primary',
  OPENED: 'bg-warning/15 text-warning',
  CHECKOUT_CREATED: 'bg-success/10 text-success',
  COMPLETED: 'bg-primary text-primary-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const className = STATUS_STYLES[status] || STATUS_STYLES.DRAFT;
  return (
    <Badge className={cn('rounded-md px-2 py-1 text-[10px] font-semibold uppercase', className)}>
      {status.replace('_', ' ')}
    </Badge>
  );
};

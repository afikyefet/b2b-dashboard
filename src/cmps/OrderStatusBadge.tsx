import React from 'react';
import { type OrderStatus } from '../api/orders';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const STATUS_STYLES: Record<OrderStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-[#c0e0ff] text-[#005bd3]',
  OPENED: 'bg-[#fff7cc] text-[#8a6116]',
  CHECKOUT_CREATED: 'bg-[#e3f1df] text-[#007a5c]',
  COMPLETED: 'bg-[#008060] text-white',
  CANCELLED: 'bg-[#ffc9c9] text-[#d72c2c]',
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const className = STATUS_STYLES[status] || STATUS_STYLES.DRAFT;
  return (
    <Badge className={cn('rounded-md px-2 py-1 text-[10px] font-semibold uppercase', className)}>
      {status.replace('_', ' ')}
    </Badge>
  );
};

import React from 'react';
import { type OrderStatus } from '../api/orders';

const STATUS_COLORS: Record<OrderStatus, { bg: string; color: string }> = {
  DRAFT: { bg: '#e4e5e7', color: '#4a4a4a' },
  SENT: { bg: '#c0e0ff', color: '#005bd3' },
  OPENED: { bg: '#fff7cc', color: '#8a6116' },
  CHECKOUT_CREATED: { bg: '#e3f1df', color: '#007a5c' },
  COMPLETED: { bg: '#008060', color: '#ffffff' },
  CANCELLED: { bg: '#ffc9c9', color: '#d72c2c' },
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const style = STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: style.bg,
        color: style.color,
        fontSize: '0.85em',
        fontWeight: 600,
        textTransform: 'uppercase',
      }}
    >
      {status.replace('_', ' ')}
    </span>
  );
};


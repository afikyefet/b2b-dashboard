import React, { useState } from 'react';
import { type OrderItem } from '../api/orders';
import { AddProductModal } from './AddProductModal';

type EditableItemsTableProps = {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
  readOnly?: boolean;
};

export const EditableItemsTable: React.FC<EditableItemsTableProps> = ({ items, onChange, readOnly }) => {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleQtyChange = (index: number, newQty: number) => {
    if (newQty < 0) return;
    const newItems = [...items];
    if (newQty === 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index] = { ...newItems[index], qty: newQty };
    }
    onChange(newItems);
  };

  const handleRemove = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  const handleAddItem = (newItem: { sku: string; variant_id: number; title: string; price: string; qty: number }) => {
    // Check if exists
    const existingIndex = items.findIndex(i => i.variant_id === newItem.variant_id);
    const newItems = [...items];
    if (existingIndex >= 0) {
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        qty: newItems[existingIndex].qty + newItem.qty
      };
    } else {
      newItems.push(newItem);
    }
    onChange(newItems);
  };

  return (
    <div className="editable-items-table">
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Product</th>
            <th style={{ padding: '8px' }}>Qty</th>
            {!readOnly && <th style={{ padding: '8px' }}></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={`${item.variant_id}-${idx}`} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>
                <div style={{ fontWeight: '500' }}>{item.title}</div>
                <div style={{ fontSize: '0.8em', color: '#666' }}>SKU: {item.sku}</div>
              </td>
              <td style={{ padding: '8px' }}>
                {readOnly ? item.qty : (
                  <input
                    type="number"
                    min="0"
                    value={item.qty}
                    onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                    style={{ width: '60px', padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                )}
              </td>
              {!readOnly && (
                <td style={{ padding: '8px' }}>
                  <button
                    onClick={() => handleRemove(idx)}
                    style={{ border: 'none', background: 'none', color: '#d72c2c', cursor: 'pointer', fontSize: '1.2em' }}
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={readOnly ? 2 : 3} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                No items in order.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!readOnly && (
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: 'white',
            border: '1px solid #008060',
            color: '#008060',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          + Add Product
        </button>
      )}

      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddItem}
      />
    </div>
  );
};


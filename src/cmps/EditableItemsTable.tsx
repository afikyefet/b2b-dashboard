import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { type OrderItem } from '../api/orders';
import { AddProductModal } from './AddProductModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

type EditableItemsTableProps = {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
  readOnly?: boolean;
  store?: string;
};

export const EditableItemsTable: React.FC<EditableItemsTableProps> = ({
  items,
  onChange,
  readOnly,
  store,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);

  const getDisplayQty = (item: OrderItem) => item.qty_sales ?? item.qty;

  const handleQtyChange = (index: number, newQty: number) => {
    if (newQty < 0) return;
    const newItems = [...items];
    if (newQty === 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index] = { ...newItems[index], qty_sales: newQty };
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
      newItems.push({
        ...newItem,
        qty_recommended: newItem.qty,
        qty_sales: newItem.qty
      });
    }
    onChange(newItems);
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead className="w-[120px]">Qty</TableHead>
            {!readOnly && <TableHead className="w-[80px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => (
            <TableRow key={`${item.variant_id}-${idx}`}>
              <TableCell>
                <div className="font-medium text-foreground">{item.title}</div>
                <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>
              </TableCell>
              <TableCell>
                {readOnly ? (
                  getDisplayQty(item)
                ) : (
                  <Input
                    type="number"
                    min="0"
                    value={getDisplayQty(item)}
                    onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                    className="h-8 w-24"
                  />
                )}
              </TableCell>
              {!readOnly && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(idx)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={readOnly ? 2 : 3}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No items in order.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {!readOnly && (
        <Button
          onClick={() => setShowAddModal(true)}
          variant="outline"
          className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      )}

      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddItem}
        store={store}
      />
    </div>
  );
};

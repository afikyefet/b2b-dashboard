import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { type OrderItem } from '../api/orders';
import type { HydratedSkuItem } from '../api/catalogApi';
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
  skuDetails?: Record<string, HydratedSkuItem>;
};

export const EditableItemsTable: React.FC<EditableItemsTableProps> = ({
  items,
  onChange,
  readOnly,
  store,
  skuDetails,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);

  const getDisplayQty = (item: OrderItem) => item.qty_sales ?? item.qty;

  const handleQtyChange = (index: number, newQty: number) => {
    if (newQty < 0) return;
    const newItems = [...items];
    if (newQty === 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index] = { ...newItems[index], qty: newQty, qty_sales: newQty };
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
        qty: newItems[existingIndex].qty + newItem.qty,
        qty_sales: (newItems[existingIndex].qty_sales ?? newItems[existingIndex].qty) + newItem.qty,
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
          {items.map((item, idx) => {
            const details = skuDetails?.[item.sku];
            const imageUrl =
              details?.variant_image_url || details?.product_featured_image_url || null;
            const productTitle = details?.product_title || item.title || 'Untitled Product';
            const variantTitle =
              details?.variant_title && details?.variant_title !== productTitle
                ? details.variant_title
                : null;
            return (
              <TableRow key={`${item.variant_id}-${idx}`}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 overflow-hidden rounded-md border border-border bg-muted">
                      {imageUrl ? (
                        <img src={imageUrl} alt={productTitle} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{productTitle}</div>
                      {variantTitle && (
                        <div className="text-xs text-muted-foreground">{variantTitle}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        SKU: {item.sku || 'N/A'}
                        {item.qty_recommended ? ` · Rec: ${item.qty_recommended}` : ''}
                      </div>
                    </div>
                  </div>
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
            )
          })}
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

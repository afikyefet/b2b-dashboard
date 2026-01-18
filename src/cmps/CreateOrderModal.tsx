import React, { useState, useEffect } from 'react';
import { createOrder } from '../api/orders';
import { resolveStoreForDealer } from '../utils/storeRouting';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

type CreateOrderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  cartItems: { sku: string; qty: number; variant_id?: number; qty_recommended?: number | null }[];
  defaultCompany?: string;
  onOrderCreated: (orderId: string) => void;
};

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  defaultCompany,
  onOrderCreated,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dealer_name: '',
    dealer_email: '',
    dealer_company: '',
    notes: '',
    currency: 'USD',
  });

  const getCurrencyForDealer = (dealerCompany: string, dealerName: string) => {
    const resolvedStore = resolveStoreForDealer(dealerCompany || dealerName);
    return resolvedStore === 'EU' ? 'EUR' : 'USD';
  };

  // Auto-fill company name when modal opens or defaultCompany changes
  useEffect(() => {
    if (!isOpen) return;
    setFormData((prev) => ({
      ...prev,
      dealer_company: prev.dealer_company || defaultCompany || prev.dealer_company,
      currency: getCurrencyForDealer(prev.dealer_company || defaultCompany || '', prev.dealer_name),
    }));
  }, [isOpen, defaultCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const order = await createOrder({
        ...formData,
        items: cartItems,
      });
      // Reset loading state before navigation to prevent loading loop
      setLoading(false);
      // Call onOrderCreated which will close modal and navigate
      onOrderCreated(order.order_id);
    } catch (err) {
      console.error(err);
      alert('Error creating order');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Order</DialogTitle>
          <DialogDescription>Enter the dealer details and submit the order.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dealer-name">Dealer Name *</Label>
            <Input
              id="dealer-name"
              required
              type="text"
              value={formData.dealer_name}
              onChange={(e) => {
                const dealerName = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  dealer_name: dealerName,
                  currency: getCurrencyForDealer(prev.dealer_company, dealerName),
                }));
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dealer-email">Dealer Email *</Label>
            <Input
              id="dealer-email"
              required
              type="email"
              value={formData.dealer_email}
              onChange={(e) =>
                setFormData({ ...formData, dealer_email: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dealer-company">Company</Label>
            <Input
              id="dealer-company"
              type="text"
              value={formData.dealer_company}
              onChange={(e) => {
                const dealerCompany = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  dealer_company: dealerCompany,
                  currency: getCurrencyForDealer(dealerCompany, prev.dealer_name),
                }));
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dealer-notes">Notes</Label>
            <Textarea
              id="dealer-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#008060] text-white hover:bg-[#006f55]">
              {loading ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

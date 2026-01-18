import React, { useMemo, useState, useEffect } from 'react';
import { createOrder } from '../api/orders';
import { getCompanyContacts, type CompanyContact } from '../api/shopifyCompanyContacts';
import { resolveStoreForDealer, type StoreCode } from '../utils/storeRouting';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';

type CreateOrderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  cartItems: { sku: string; qty: number; variant_id?: number; qty_recommended?: number | null }[];
  defaultCompany?: string;
  store?: StoreCode;
  onOrderCreated: (orderId: string) => void;
};

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  defaultCompany,
  store,
  onOrderCreated,
}) => {
  const [loading, setLoading] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<{ id: string; name: string } | null>(null);
  const [customerResults, setCustomerResults] = useState<CompanyContact[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    dealer_name: '',
    dealer_email: '',
    dealer_company: '',
    notes: '',
    currency: 'USD',
  });

  const dealerKey = useMemo(() => {
    return (formData.dealer_company || defaultCompany || '').trim();
  }, [formData.dealer_company, defaultCompany]);

  const storeForLookup = useMemo(() => {
    if (store) return store;
    if (!dealerKey) return null;
    return resolveStoreForDealer(dealerKey);
  }, [store, dealerKey]);

  const getStoreForDealer = (dealerCompany: string, dealerName: string) => {
    if (store) return store;
    return resolveStoreForDealer(dealerCompany || dealerName);
  };

  const getCurrencyForDealer = (dealerCompany: string, dealerName: string) => {
    const resolvedStore = getStoreForDealer(dealerCompany, dealerName);
    return resolvedStore === 'EU' ? 'EUR' : 'USD';
  };

  // Sync dealer company with header changes while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const nextCompany = (defaultCompany || '').trim();
    if (!nextCompany) return;
    if (nextCompany === formData.dealer_company.trim()) return;
    setFormData((prev) => ({
      ...prev,
      dealer_company: nextCompany,
      dealer_name: '',
      dealer_email: '',
      currency: getCurrencyForDealer(nextCompany, ''),
    }));
    setSelectedCustomerId('');
    setCompanyInfo(null);
    setCustomerResults([]);
    setCustomerError(null);
  }, [isOpen, defaultCompany, formData.dealer_company]);

  useEffect(() => {
    if (!isOpen) {
      setCompanyInfo(null);
      setCustomerResults([]);
      setSelectedCustomerId('');
      setCustomerLoading(false);
      setCustomerError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!dealerKey) {
      setCompanyInfo(null);
      setCustomerResults([]);
      setSelectedCustomerId('');
      setCustomerLoading(false);
      setCustomerError(null);
      return;
    }

    setCustomerLoading(true);
    setCustomerError(null);
    setSelectedCustomerId('');
    setCompanyInfo(null);
    setCustomerResults([]);
    getCompanyContacts(dealerKey, {
      store: storeForLookup ?? undefined,
      limit: 250,
    })
      .then((data) => {
        setCompanyInfo({ id: data.company_id, name: data.company_name });
        setCustomerResults(data.items);
        if (!formData.dealer_company && data.company_name) {
          setFormData((prev) => ({
            ...prev,
            dealer_company: data.company_name,
            currency: getCurrencyForDealer(data.company_name, prev.dealer_name),
          }));
        }
      })
      .catch((err) => {
        console.error(err);
        setCustomerError('Unable to load Shopify customers.');
      })
      .finally(() => {
        setCustomerLoading(false);
      });
  }, [isOpen, dealerKey, storeForLookup, formData.dealer_company]);

  const handleCustomerSelect = (customer: CompanyContact) => {
    const displayName = customer.name || customer.email;
    setFormData((prev) => ({
      ...prev,
      dealer_name: displayName,
      dealer_email: customer.email || prev.dealer_email,
      dealer_company: prev.dealer_company || companyInfo?.name || prev.dealer_company,
      currency: getCurrencyForDealer(prev.dealer_company || companyInfo?.name || '', displayName),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const shopifyStore = getStoreForDealer(formData.dealer_company, formData.dealer_name);
      const order = await createOrder({
        ...formData,
        shopify_store: shopifyStore,
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
            <Label htmlFor="shopify-customer">Shopify Customer</Label>
            <Select
              value={selectedCustomerId}
              onValueChange={(value) => {
                setSelectedCustomerId(value);
                const selected = customerResults.find((customer) => customer.id === value);
                if (selected) {
                  handleCustomerSelect(selected);
                }
              }}
              disabled={!dealerKey || customerLoading}
            >
              <SelectTrigger id="shopify-customer">
                <SelectValue
                  placeholder={
                    !dealerKey
                      ? 'Enter dealer company to load customers'
                      : customerLoading
                        ? 'Loading customers...'
                        : 'Select a customer'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {customerResults.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    No customers found
                  </SelectItem>
                ) : (
                  customerResults.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name || customer.email}
                      {customer.email ? ` — ${customer.email}` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {companyInfo?.name && (
              <span className="text-xs text-muted-foreground">
                Company: {companyInfo.name}
              </span>
            )}
            {customerError && (
              <span className="text-xs text-destructive">{customerError}</span>
            )}
          </div>
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

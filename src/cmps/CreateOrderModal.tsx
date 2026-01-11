import React, { useState, useEffect } from 'react';
import { createOrder } from '../api/orders';
import { resolveStoreForDealer, type StoreCode } from '../utils/storeRouting';

type CreateOrderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  cartItems: { sku: string; qty: number; variant_id?: number; qty_recommended?: number | null }[];
  defaultCompany?: string;
  onOrderCreated: (orderId: string) => void;
};

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ isOpen, onClose, cartItems, defaultCompany, onOrderCreated }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dealer_name: '',
    dealer_email: '',
    dealer_company: '',
    notes: '',
    currency: 'USD',
    shopify_store: 'US' as StoreCode
  });

  // Auto-fill company name when modal opens or defaultCompany changes
  useEffect(() => {
    if (!isOpen) return;
    const resolvedStore = resolveStoreForDealer(defaultCompany);
    const currency = resolvedStore === 'EU' ? 'EUR' : 'USD';
    setFormData(prev => ({
      ...prev,
      dealer_company: prev.dealer_company || defaultCompany || prev.dealer_company,
      shopify_store: resolvedStore,
      currency
    }));
  }, [isOpen, defaultCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const order = await createOrder({
        ...formData,
        items: cartItems
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
    <div 
        style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200
        }}
        onClick={onClose}
    >
        <div 
            style={{ 
                backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px', 
                padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' 
            }}
            onClick={e => e.stopPropagation()}
        >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Create Order</h2>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Dealer Name *</label>
                    <input 
                        required
                        type="text" 
                        value={formData.dealer_name}
                        onChange={e => setFormData({...formData, dealer_name: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Dealer Email *</label>
                    <input 
                        required
                        type="email" 
                        value={formData.dealer_email}
                        onChange={e => setFormData({...formData, dealer_email: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Company</label>
                    <input 
                        type="text" 
                        value={formData.dealer_company}
                        onChange={e => setFormData({...formData, dealer_company: e.target.value})}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Store</label>
                    <select
                        value={formData.shopify_store}
                        onChange={e => {
                            const nextStore = e.target.value as StoreCode;
                            setFormData(prev => ({
                                ...prev,
                                shopify_store: nextStore,
                                currency: nextStore === 'EU' ? 'EUR' : 'USD'
                            }));
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', background: 'white' }}
                    >
                        <option value="US">US Shopify</option>
                        <option value="EU">EU Shopify</option>
                    </select>
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Notes</label>
                    <textarea 
                        value={formData.notes}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        rows={3}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                    <button 
                        type="button" 
                        onClick={onClose}
                        style={{ padding: '8px 16px', background: 'white', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{ 
                            padding: '8px 24px', background: '#008060', color: 'white', border: 'none', 
                            borderRadius: '4px', cursor: loading ? 'wait' : 'pointer', fontWeight: '600'
                        }}
                    >
                        {loading ? 'Creating...' : 'Create Order'}
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};


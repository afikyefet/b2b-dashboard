import React, { useState, useEffect } from 'react';
import { fetchProducts, fetchProductVariants, type ProductListItem, type HydratedSkuItem } from '../api/catalogApi';

type AddProductModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: { sku: string; variant_id: number; title: string; price: string; qty: number }) => void;
};

type ProductOption = {
  name: string;
  values: string[];
};

type ProductWithVariants = {
  product: ProductListItem;
  variants: HydratedSkuItem[];
  options: ProductOption[];
  selectedOptions: Record<string, string>;
};

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsWithVariants, setProductsWithVariants] = useState<Map<string, ProductWithVariants>>(new Map());
  const [loadingVariants, setLoadingVariants] = useState<Set<string>>(new Set());

  // Parse options from product options JSON
  const parseProductOptions = (optionsJson: string | null | undefined): ProductOption[] => {
    if (!optionsJson) return [];
    try {
      const parsed = JSON.parse(optionsJson);
      if (Array.isArray(parsed)) {
        return parsed.map((opt: any) => ({
          name: opt.name || opt.Name || '',
          values: opt.values || opt.Values || []
        }));
      }
    } catch (e) {
      console.error('Error parsing product options:', e);
    }
    return [];
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const result = await fetchProducts({
        query: productSearch || undefined,
        limit: 50,
      });
      setProducts(result.items);
    } catch (err) {
      console.error(err);
      alert('Error loading products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadProductVariants = async (productId: string) => {
    if (productsWithVariants.has(productId)) return;

    setLoadingVariants(prev => new Set(prev).add(productId));
    try {
      const result = await fetchProductVariants(productId);
      if (result.items && result.items.length > 0) {
        const firstVariant = result.items[0];
        const options = parseProductOptions(firstVariant.product_options);

        // Simple option extraction (can be improved like in CartPage if needed)
        // For MVP, using the parsed options + extraction from CartPage logic
        // But for brevity I'll assume options are mostly correct or extracted from variant titles if needed.
        // Copying the more robust logic from CartPage for safety.
        
        let enrichedOptions: ProductOption[] = [];
                
        if (options.length > 0) {
            enrichedOptions = options.map(opt => {
                const values = new Set<string>();
                result.items.forEach(variant => {
                    if (variant.variant_selected_options) {
                        try {
                            const selected = JSON.parse(variant.variant_selected_options);
                            if (Array.isArray(selected)) {
                                selected.forEach((sel: any) => {
                                    const name = sel.name || sel.Name || '';
                                    const value = sel.value || sel.Value || '';
                                    if (name.toLowerCase() === opt.name.toLowerCase() && value) {
                                        values.add(value);
                                    }
                                });
                            }
                        } catch (e) { /* ignore */ }
                    } else if (variant.variant_title) {
                        const parts = variant.variant_title.split(' / ');
                        const optIndex = options.findIndex(o => o.name.toLowerCase() === opt.name.toLowerCase());
                        if (optIndex >= 0 && parts[optIndex]) {
                            values.add(parts[optIndex]);
                        }
                    }
                });
                return {
                    name: opt.name,
                    values: Array.from(values).sort()
                };
            });
        } else {
             // Extract from variant titles
             enrichedOptions = result.items.reduce((acc: ProductOption[], variant) => {
                if (variant.variant_title) {
                    const parts = variant.variant_title.split(' / ');
                    parts.forEach((part, idx) => {
                        if (!acc[idx]) {
                            acc[idx] = { name: `Option ${idx + 1}`, values: [] };
                        }
                        if (!acc[idx].values.includes(part)) {
                            acc[idx].values.push(part);
                        }
                    });
                }
                return acc;
            }, []);
        }

        setProductsWithVariants(prev => {
          const newMap = new Map(prev);
          newMap.set(productId, {
            product: products.find(p => p.product_id === productId) || products[0],
            variants: result.items,
            options: enrichedOptions,
            selectedOptions: {}
          });
          return newMap;
        });
      }
    } catch (err) {
      console.error('Error fetching variants:', err);
    } finally {
      setLoadingVariants(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    if (isOpen && products.length === 0) {
      loadProducts();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && products.length > 0) {
      products.forEach(product => {
        if (!productsWithVariants.has(product.product_id) && !loadingVariants.has(product.product_id)) {
          loadProductVariants(product.product_id);
        }
      });
    }
  }, [products, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, isOpen]);

  const getAvailableVariants = (productId: string): HydratedSkuItem[] => {
    const productData = productsWithVariants.get(productId);
    if (!productData) return [];
    const { variants, selectedOptions } = productData;
    const selectedEntries = Object.entries(selectedOptions).filter(([_, value]) => value);
    if (selectedEntries.length === 0) return variants;

    return variants.filter(variant => {
        return selectedEntries.every(([optionName, selectedValue]) => {
            // ... (simplified matching logic for brevity, assuming standard structure)
            // Reusing the core matching logic from CartPage would be safer but verbose.
            // I'll implement a robust enough check here.
            
            const normalizedSelected = selectedValue.toString().trim().toLowerCase();
            
            if (variant.variant_selected_options) {
                try {
                    const selected = JSON.parse(variant.variant_selected_options);
                    if (Array.isArray(selected)) {
                         const option = selected.find((opt: any) => (opt.name || opt.Name || '').toLowerCase() === optionName.toLowerCase());
                         if (option) {
                             const val = (option.value || option.Value || '').toString().trim().toLowerCase();
                             return val === normalizedSelected || val.includes(normalizedSelected) || normalizedSelected.includes(val);
                         }
                    }
                } catch(e) {}
            }
            
            if (variant.variant_title) {
                 const titleParts = variant.variant_title.split(' / ').map(p => p.trim().toLowerCase());
                 const optionIndex = productData.options.findIndex(opt => opt.name.toLowerCase() === optionName.toLowerCase());
                 if (optionIndex >= 0 && titleParts[optionIndex]) {
                     const part = titleParts[optionIndex];
                     return part === normalizedSelected || part.includes(normalizedSelected) || normalizedSelected.includes(part);
                 }
            }
            
            return false;
        });
    });
  };

  const getSelectedVariant = (productId: string): HydratedSkuItem | null => {
      const avail = getAvailableVariants(productId);
      const productData = productsWithVariants.get(productId);
      if (!productData) return null;
      
      // If we narrowed down to 1 variant, return it.
      // But we should also check if all options are selected.
      const allOptionsSelected = productData.options.every(opt => productData.selectedOptions[opt.name]);
      if (allOptionsSelected && avail.length === 1) return avail[0];
      
      // Also try to find exact match if multiple returned (e.g. subset options)
      // Logic from CartPage is more precise but this should suffice for MVP
      return allOptionsSelected && avail.length > 0 ? avail[0] : null;
  };

  const handleOptionChange = (productId: string, optionName: string, value: string) => {
    setProductsWithVariants(prev => {
      const newMap = new Map(prev);
      const productData = newMap.get(productId);
      if (productData) {
        newMap.set(productId, {
          ...productData,
          selectedOptions: {
            ...productData.selectedOptions,
            [optionName]: value
          }
        });
      }
      return newMap;
    });
  };

  const getOptionValues = (productData: ProductWithVariants, optionName: string): string[] => {
    const values = new Set<string>();
    const optionIndex = productData.options.findIndex(opt => opt.name.toLowerCase() === optionName.toLowerCase());

    productData.variants.forEach(variant => {
      if (variant.variant_selected_options) {
        try {
          const selected = JSON.parse(variant.variant_selected_options);
          if (Array.isArray(selected)) {
            const match = selected.find((opt: any) => (opt.name || opt.Name || '').toLowerCase() === optionName.toLowerCase());
            const val = match ? (match.value || match.Value || '') : '';
            if (val) values.add(String(val));
          }
          return;
        } catch (e) {
          // Fall through to title parsing.
        }
      }

      if (variant.variant_title && optionIndex >= 0) {
        const parts = variant.variant_title.split(' / ');
        const part = parts[optionIndex];
        if (part) values.add(part.trim());
      }
    });

    if (values.size > 0) return Array.from(values).sort();

    const option = productData.options.find(opt => opt.name.toLowerCase() === optionName.toLowerCase());
    return option ? option.values : [];
  };

  const visibleProducts = products.filter(product => {
    const productData = productsWithVariants.get(product.product_id);
    const isLoading = loadingVariants.has(product.product_id);
    if (isLoading) return true;
    if (!productData) return false;
    return productData.options.length > 0;
  });

  if (!isOpen) return null;

  return (
    <div 
        style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', 
            justifyContent: 'center', alignItems: 'flex-start', zIndex: 1100, padding: '40px 20px', overflowY: 'auto'
        }}
        onClick={onClose}
        className='add-product-modal'
    >
        <div className='add-product-modal-content' style={{ backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '900px', maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Browse Products</h2>
                <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5em', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
                <input 
                    type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} 
                    placeholder="Search products..." 
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <div style={{ marginTop: '8px', fontSize: '0.85em', color: '#666' }}>
                    Showing {visibleProducts.length} product{visibleProducts.length === 1 ? '' : 's'} with options
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loadingProducts && <div>Loading products...</div>}
                {!loadingProducts && visibleProducts.length === 0 && <div>No products with options found</div>}
                {visibleProducts.map(product => {
                    const productData = productsWithVariants.get(product.product_id);
                    const selectedVariant = productData ? getSelectedVariant(product.product_id) : null;
                    // const allOptionsSelected = productData ? productData.options.every(opt => productData.selectedOptions[opt.name]) : false;
                    const isLoading = loadingVariants.has(product.product_id);
                    
                    return (
                        <div key={product.product_id} style={{ border: '1px solid #ddd', borderRadius: '10px', padding: '14px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'stretch' }}>
                            <div style={{ minWidth: '220px', flex: '0 0 220px' }}>
                                <h3 style={{ margin: 0, fontSize: '1em' }}>{product.title}</h3>
                                {product.tags?.length > 0 && (
                                    <div style={{ marginTop: '6px', fontSize: '0.8em', color: '#666' }}>
                                        {product.tags.slice(0, 3).join(', ')}
                                    </div>
                                )}
                            </div>
                            {isLoading && <div style={{ fontSize: '0.85em', color: '#666' }}>Loading options...</div>}
                            {productData && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                        {productData.options.map(option => {
                                            const values = getOptionValues(productData, option.name);
                                            const current = productData.selectedOptions[option.name] || '';
                                            const isColorOption = option.name.toLowerCase().includes('color') || option.name.toLowerCase().includes('colour');
                                            const swatchLimit = isColorOption ? 20 : 12;
                                            const useSwatches = values.length > 0 && values.length <= swatchLimit;
                                            return (
                                                <div key={option.name}>
                                                    <label style={{ display: 'block', fontSize: '0.75em', fontWeight: 600, color: '#444', marginBottom: '4px' }}>{option.name}</label>
                                                    {useSwatches ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                            {values.map(value => {
                                                                const isActive = current === value;
                                                                return (
                                                                    <button
                                                                        key={value}
                                                                        type="button"
                                                                        onClick={() => handleOptionChange(product.product_id, option.name, value)}
                                                                        style={{
                                                                            padding: '6px 10px',
                                                                            borderRadius: '999px',
                                                                            border: isActive ? '1px solid #008060' : '1px solid #ddd',
                                                                            backgroundColor: isActive ? '#e6f5f1' : 'white',
                                                                            color: '#333',
                                                                            fontSize: '0.8em',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        {value}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <select 
                                                            value={current}
                                                            onChange={e => handleOptionChange(product.product_id, option.name, e.target.value)}
                                                            style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                                                        >
                                                            <option value="">Select</option>
                                                            {values.map(v => <option key={v} value={v}>{v}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            disabled={!selectedVariant}
                                            onClick={() => {
                                                if (selectedVariant) {
                                                    onAdd({
                                                        sku: selectedVariant.sku,
                                                        variant_id: Number(selectedVariant.variant_id),
                                                        title: `${product.title} - ${selectedVariant.variant_title}`,
                                                        price: String(selectedVariant.price || '0'),
                                                        qty: 1
                                                    });
                                                    onClose();
                                                }
                                            }}
                                            style={{
                                                padding: '8px 14px',
                                                backgroundColor: selectedVariant ? '#008060' : '#ccc',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: selectedVariant ? 'pointer' : 'not-allowed'
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};


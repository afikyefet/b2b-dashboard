import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCart } from '../contexts/CartContext';
import { hydrateBySkus, fetchProducts, fetchProductVariants } from '../api/catalogApi';
import type { ProductListItem, HydratedSkuItem } from '../api/catalogApi';
import { CreateOrderModal } from '../cmps/CreateOrderModal';
import { selectDealerName } from '../store/slices/filterSlice';
import '../styles/App.scss';

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

export default function CartPage() {
    const navigate = useNavigate();
    const { cart, hydrated, setQty, removeSku, addSku } = useCart();
    const dealerName = useSelector(selectDealerName);
    const [skuInput, setSkuInput] = useState('');
    const [loadingSku, setLoadingSku] = useState(false);
    
    // Modal state
    const [showProductModal, setShowProductModal] = useState(false);
    const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
    
    const [products, setProducts] = useState<ProductListItem[]>([]);
    const [productSearch, setProductSearch] = useState('');
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productsWithVariants, setProductsWithVariants] = useState<Map<string, ProductWithVariants>>(new Map());
    const [loadingVariants, setLoadingVariants] = useState<Set<string>>(new Set());

    const handleAddSku = async () => {
        if (!skuInput.trim()) return;
        const sku = skuInput.trim();
        setLoadingSku(true);
        try {
            const { items } = await hydrateBySkus([sku]);
            if (items.length > 0) {
                addSku(sku, 1);
                setSkuInput('');
            } else {
                alert('SKU not found');
            }
        } catch (err) {
            console.error(err);
            alert('Error adding SKU');
        } finally {
            setLoadingSku(false);
        }
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => {
            const details = hydrated[item.sku];
            const price = details?.price ?? 0;
            return total + (price * item.qty);
        }, 0);
    };

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

    // Load products
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

    // Load variants for a product
    const loadProductVariants = async (productId: string) => {
        if (productsWithVariants.has(productId)) return;
        
        setLoadingVariants(prev => new Set(prev).add(productId));
        try {
            const result = await fetchProductVariants(productId);
            if (result.items && result.items.length > 0) {
                const firstVariant = result.items[0];
                const options = parseProductOptions(firstVariant.product_options);
                
                // Extract option values from variants if options not in product_options
                let enrichedOptions: ProductOption[] = [];
                
                if (options.length > 0) {
                    // Use product options and extract unique values from variants
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
                                } catch (e) {
                                    // Fallback to variant_title parsing
                                    if (variant.variant_title) {
                                        const parts = variant.variant_title.split(' / ');
                                        const optIndex = options.findIndex(o => o.name.toLowerCase() === opt.name.toLowerCase());
                                        if (optIndex >= 0 && parts[optIndex]) {
                                            values.add(parts[optIndex]);
                                        }
                                    }
                                }
                            } else if (variant.variant_title) {
                                // Fallback: parse from variant title
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

    // Load products when modal opens
    useEffect(() => {
        if (showProductModal && products.length === 0) {
            loadProducts();
        }
    }, [showProductModal]);

    // Auto-load variants for products when they're loaded
    useEffect(() => {
        if (showProductModal && products.length > 0) {
            products.forEach(product => {
                if (!productsWithVariants.has(product.product_id) && !loadingVariants.has(product.product_id)) {
                    loadProductVariants(product.product_id);
                }
            });
        }
    }, [products, showProductModal]);

    // Load products when search changes (debounced)
    useEffect(() => {
        if (!showProductModal) return;
        
        const timer = setTimeout(() => {
            loadProducts();
        }, 300);

        return () => clearTimeout(timer);
    }, [productSearch, showProductModal]);

    // Get available variants based on current option selections (partial matching)
    const getAvailableVariants = (productId: string): HydratedSkuItem[] => {
        const productData = productsWithVariants.get(productId);
        if (!productData) return [];

        const { variants, selectedOptions } = productData;
        const selectedEntries = Object.entries(selectedOptions).filter(([_, value]) => value);

        // If no options selected, return all variants
        if (selectedEntries.length === 0) return variants;

        return variants.filter(variant => {
            // Check if variant matches all selected options
            return selectedEntries.every(([optionName, selectedValue]) => {
                if (variant.variant_selected_options) {
                    try {
                        const selected = JSON.parse(variant.variant_selected_options);
                        if (Array.isArray(selected)) {
                            const option = selected.find((opt: any) => {
                                const name = (opt.name || opt.Name || '').toLowerCase();
                                return name === optionName.toLowerCase();
                            });
                            if (option) {
                                const value = (option.value || option.Value || '').toString().trim().toLowerCase();
                                const normalizedSelected = selectedValue.toString().trim().toLowerCase();
                                return value === normalizedSelected || 
                                       value.includes(normalizedSelected) || 
                                       normalizedSelected.includes(value);
                            }
                        }
                    } catch (e) {
                        // Fallback to variant_title matching
                        if (variant.variant_title) {
                            const titleParts = variant.variant_title.split(' / ').map(p => p.trim());
                            const optionIndex = productData.options.findIndex(opt => 
                                opt.name.toLowerCase() === optionName.toLowerCase()
                            );
                            if (optionIndex >= 0 && titleParts[optionIndex]) {
                                const partValue = titleParts[optionIndex].toLowerCase();
                                const normalizedSelected = selectedValue.toString().trim().toLowerCase();
                                return partValue === normalizedSelected || 
                                       partValue.includes(normalizedSelected) || 
                                       normalizedSelected.includes(partValue);
                            }
                        }
                    }
                } else if (variant.variant_title) {
                    // Fallback: match by variant title
                    const titleParts = variant.variant_title.split(' / ').map(p => p.trim());
                    const optionIndex = productData.options.findIndex(opt => 
                        opt.name.toLowerCase() === optionName.toLowerCase()
                    );
                    if (optionIndex >= 0 && titleParts[optionIndex]) {
                        const partValue = titleParts[optionIndex].toLowerCase();
                        const normalizedSelected = selectedValue.toString().trim().toLowerCase();
                        return partValue === normalizedSelected || 
                               partValue.includes(normalizedSelected) || 
                               normalizedSelected.includes(partValue);
                    }
                }
                return false;
            });
        });
    };

    // Get available values for an option based on current selections
    const getAvailableOptionValues = (productId: string, optionName: string): string[] => {
        const productData = productsWithVariants.get(productId);
        if (!productData) return [];

        const availableVariants = getAvailableVariants(productId);
        const values = new Set<string>();

        availableVariants.forEach(variant => {
            if (variant.variant_selected_options) {
                try {
                    const selected = JSON.parse(variant.variant_selected_options);
                    if (Array.isArray(selected)) {
                        const option = selected.find((opt: any) => {
                            const name = (opt.name || opt.Name || '').toLowerCase();
                            return name === optionName.toLowerCase();
                        });
                        if (option) {
                            const value = (option.value || option.Value || '').toString().trim();
                            if (value) values.add(value);
                        }
                    }
                } catch (e) {
                    // Fallback to variant_title parsing
                    if (variant.variant_title) {
                        const parts = variant.variant_title.split(' / ');
                        const optionIndex = productData.options.findIndex(opt => 
                            opt.name.toLowerCase() === optionName.toLowerCase()
                        );
                        if (optionIndex >= 0 && parts[optionIndex]) {
                            values.add(parts[optionIndex].trim());
                        }
                    }
                }
            } else if (variant.variant_title) {
                const parts = variant.variant_title.split(' / ');
                const optionIndex = productData.options.findIndex(opt => 
                    opt.name.toLowerCase() === optionName.toLowerCase()
                );
                if (optionIndex >= 0 && parts[optionIndex]) {
                    values.add(parts[optionIndex].trim());
                }
            }
        });

        return Array.from(values).sort();
    };

    // Get selected variant based on selected options
    const getSelectedVariant = (productId: string): HydratedSkuItem | null => {
        const productData = productsWithVariants.get(productId);
        if (!productData) return null;

        const { variants, selectedOptions } = productData;
        const selectedValues = Object.values(selectedOptions).filter(Boolean);
        
        // If no options selected, return null
        if (selectedValues.length === 0) return null;

        // Try to find matching variant
        const matchedVariant = variants.find(variant => {
            if (variant.variant_selected_options) {
                try {
                    const selected = JSON.parse(variant.variant_selected_options);
                    if (Array.isArray(selected)) {
                        const variantValues = selected.map((opt: any) => {
                            const val = opt.value || opt.Value || '';
                            return val.toString().trim();
                        }).filter(Boolean);
                        
                        const normalizedSelected = selectedValues.map(v => v.toString().trim());
                        
                        // Check if all selected values match variant values (order independent)
                        if (variantValues.length === normalizedSelected.length) {
                            return normalizedSelected.every(val => 
                                variantValues.some(vVal => 
                                    vVal.toLowerCase() === val.toLowerCase() || 
                                    vVal.includes(val) || 
                                    val.includes(vVal)
                                )
                            );
                        }
                    }
                } catch (e) {
                    // Fallback to variant_title matching
                    if (variant.variant_title) {
                        const titleParts = variant.variant_title.split(' / ').map(p => p.trim());
                        return selectedValues.every(val => {
                            const normalizedVal = val.toString().trim().toLowerCase();
                            return titleParts.some(part => 
                                part.toLowerCase() === normalizedVal || 
                                part.toLowerCase().includes(normalizedVal) ||
                                normalizedVal.includes(part.toLowerCase())
                            );
                        });
                    }
                }
            } else if (variant.variant_title) {
                // Fallback: match by variant title
                const titleParts = variant.variant_title.split(' / ').map(p => p.trim());
                if (titleParts.length === selectedValues.length) {
                    return selectedValues.every(val => {
                        const normalizedVal = val.toString().trim().toLowerCase();
                        return titleParts.some(part => 
                            part.toLowerCase() === normalizedVal || 
                            part.toLowerCase().includes(normalizedVal) ||
                            normalizedVal.includes(part.toLowerCase())
                        );
                    });
                }
            }
            return false;
        });

        return matchedVariant || null;
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

    const cartItemsForOrder = useMemo(() => {
        return cart.map(item => {
            const details = hydrated[item.sku];
            return {
                sku: item.sku,
                qty: item.qty,
                variant_id: details?.variant_id ? Number(details.variant_id) : undefined
            };
        });
    }, [cart, hydrated]);

    return (
        <div className="cart-page" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', zIndex: 100 }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h1>Cart ({cart.length} items)</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={() => navigate('/')} 
                        className="btn-reset-all" 
                        style={{ backgroundColor: '#666', borderColor: '#666' }}
                    >
                        Back to Dashboard
                    </button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px' }}>
                <div className="cart-list">
                    {cart.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', background: '#f9f9f9', borderRadius: '8px', marginBottom: '20px' }}>
                            <h2>Your cart is empty</h2>
                            <p>Click "Browse Products" below to add items.</p>
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                    <th style={{ padding: '12px' }}>Product</th>
                                    <th style={{ padding: '12px' }}>Price</th>
                                    <th style={{ padding: '12px' }}>Quantity</th>
                                    <th style={{ padding: '12px' }}>Total</th>
                                    <th style={{ padding: '12px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.map((item) => {
                                    const details = hydrated[item.sku];
                                    const price = details?.price ?? 0;
                                    const rowTotal = price * item.qty;

                                    return (
                                        <tr key={item.sku} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '12px' }}>
                                                {details ? (
                                                    <div>
                                                        <div style={{ fontWeight: 'bold' }}>{details.product_title}</div>
                                                        <div style={{ fontSize: '0.85em', color: '#666' }}>{details.variant_title}</div>
                                                        <div style={{ fontSize: '0.8em', color: '#999' }}>SKU: {item.sku}</div>
                                                    </div>
                                                ) : (
                                                    <span>Loading {item.sku}...</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {details?.price ? `$${price.toFixed(2)}` : '-'}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={item.qty}
                                                    onChange={(e) => setQty(item.sku, Number(e.target.value))}
                                                    style={{ width: '60px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                                                />
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                ${rowTotal.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <button 
                                                    onClick={() => removeSku(item.sku)}
                                                    style={{ border: 'none', background: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '1.2em' }}
                                                    title="Remove item"
                                                >
                                                    ×
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    
                    <button
                        onClick={() => setShowProductModal(true)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#008060',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1em',
                            fontWeight: 'bold'
                        }}
                    >
                        + Browse Products
                    </button>
                </div>

                <div className="cart-sidebar">
                    <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                        <h3 style={{ marginTop: 0 }}>Summary</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '1.2em', fontWeight: 'bold' }}>
                            <span>Total</span>
                            <span>${calculateTotal().toFixed(2)}</span>
                        </div>
                        
                        <button
                            onClick={() => setShowCreateOrderModal(true)}
                            disabled={cart.length === 0}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: cart.length === 0 ? '#ccc' : '#008060',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                                fontSize: '1em',
                                fontWeight: 'bold'
                            }}
                        >
                            Create Order
                        </button>
                    </div>

                    <div style={{ background: 'white', border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Quick Add by SKU</h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="text" 
                                value={skuInput}
                                onChange={(e) => setSkuInput(e.target.value)}
                                placeholder="Enter SKU"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddSku()}
                                style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                            <button 
                                onClick={handleAddSku}
                                disabled={loadingSku}
                                style={{ 
                                    padding: '8px 16px', 
                                    background: '#008060', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px',
                                    cursor: loadingSku ? 'not-allowed' : 'pointer',
                                    opacity: loadingSku ? 0.7 : 1
                                }}
                            >
                                {loadingSku ? '...' : 'Add'}
                            </button>
                        </div>
                        <p style={{ fontSize: '0.8em', color: '#666', marginTop: '8px' }}>
                            Enter a valid variant SKU to add it directly to the cart.
                        </p>
                    </div>
                </div>
            </div>

            {/* Product Modal */}
            {showProductModal && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        zIndex: 1100,
                        padding: '80px 20px 20px 20px',
                        overflowY: 'auto'
                    }}
                    onClick={() => setShowProductModal(false)}
                >
                    <div 
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            width: '100%',
                            maxWidth: '900px',
                            maxHeight: 'calc(100vh - 60px)',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Sticky header */}
                        <div style={{ 
                            padding: '16px 20px',
                            borderBottom: '1px solid #eee',
                            backgroundColor: 'white',
                            flexShrink: 0
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h2 style={{ margin: 0 }}>Browse Products</h2>
                                <button
                                    onClick={() => setShowProductModal(false)}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        fontSize: '1.5em',
                                        cursor: 'pointer',
                                        color: '#666'
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            <input
                                type="text"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Search products..."
                                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* Scrollable product list */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                            {loadingProducts ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}>Loading products...</div>
                            ) : products.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No products found</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {products.map((product) => {
                                    const productData = productsWithVariants.get(product.product_id);
                                    const isLoading = loadingVariants.has(product.product_id);
                                    const selectedVariant = productData ? getSelectedVariant(product.product_id) : null;
                                    const allOptionsSelected = productData ? 
                                        productData.options.every(opt => productData.selectedOptions[opt.name]) : false;

                                    return (
                                        <div
                                            key={product.product_id}
                                            style={{
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                padding: '12px 14px',
                                                background: 'white',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '10px'
                                            }}
                                        >
                                            <h3 style={{ margin: 0, fontSize: '1em', fontWeight: '600' }}>{product.title}</h3>
                                            
                                            {isLoading && (
                                                <div style={{ textAlign: 'center', padding: '10px', color: '#666', fontSize: '0.9em' }}>Loading options...</div>
                                            )}

                                            {productData && (
                                                <>
                                                    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '10px' }}>
                                                        {productData.options.map((option) => {
                                                            const availableValues = getAvailableOptionValues(product.product_id, option.name);
                                                            const displayValues = availableValues.length > 0 ? availableValues : option.values;
                                                            
                                                            return (
                                                                <div key={option.name} style={{ flex: '1 1 140px', minWidth: '120px' }}>
                                                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.8em', fontWeight: '600', color: '#555' }}>
                                                                        {option.name}
                                                                        {availableValues.length > 0 && availableValues.length < option.values.length && (
                                                                            <span style={{ fontSize: '0.85em', fontWeight: 'normal', color: '#888', marginLeft: '4px' }}>
                                                                                ({availableValues.length})
                                                                            </span>
                                                                        )}
                                                                    </label>
                                                                    <select
                                                                        value={productData.selectedOptions[option.name] || ''}
                                                                        onChange={(e) => handleOptionChange(product.product_id, option.name, e.target.value)}
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '6px 8px',
                                                                            border: '1px solid #ddd',
                                                                            borderRadius: '4px',
                                                                            fontSize: '0.9em',
                                                                            backgroundColor: 'white',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <option value="">Select</option>
                                                                        {displayValues.map((value) => (
                                                                            <option key={value} value={value}>
                                                                                {value}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Show available variants based on current selections */}
                                                    {(() => {
                                                        const availableVariants = getAvailableVariants(product.product_id);
                                                        const hasSelections = Object.values(productData.selectedOptions).some(v => v);
                                                        
                                                        if (hasSelections && availableVariants.length > 0) {
                                                            return (
                                                                <div style={{ 
                                                                    padding: '10px', 
                                                                    background: '#f9f9f9', 
                                                                    border: '1px solid #ddd',
                                                                    borderRadius: '4px'
                                                                }}>
                                                                    <div style={{ fontSize: '0.8em', fontWeight: '600', marginBottom: '6px', color: '#555' }}>
                                                                        Available ({availableVariants.length}):
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                                                                        {availableVariants.map((variant) => {
                                                                            const isSelected = selectedVariant?.sku === variant.sku;
                                                                            return (
                                                                                <div
                                                                                    key={variant.sku}
                                                                                    onClick={() => {
                                                                                        if (variant.sku) {
                                                                                            addSku(variant.sku, 1);
                                                                                            setShowProductModal(false);
                                                                                        }
                                                                                    }}
                                                                                    style={{
                                                                                        padding: '6px 8px',
                                                                                        border: isSelected ? '2px solid #008060' : '1px solid #ddd',
                                                                                        borderRadius: '4px',
                                                                                        background: isSelected ? '#f0f9ff' : 'white',
                                                                                        cursor: 'pointer',
                                                                                        transition: 'all 0.15s',
                                                                                        display: 'flex',
                                                                                        justifyContent: 'space-between',
                                                                                        alignItems: 'center',
                                                                                        fontSize: '0.85em'
                                                                                    }}
                                                                                    onMouseEnter={(e) => {
                                                                                        if (!isSelected) {
                                                                                            e.currentTarget.style.background = '#f5f5f5';
                                                                                            e.currentTarget.style.borderColor = '#008060';
                                                                                        }
                                                                                    }}
                                                                                    onMouseLeave={(e) => {
                                                                                        if (!isSelected) {
                                                                                            e.currentTarget.style.background = 'white';
                                                                                            e.currentTarget.style.borderColor = '#ddd';
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <span style={{ fontWeight: isSelected ? '600' : 'normal' }}>
                                                                                        {variant.variant_title}
                                                                                    </span>
                                                                                    <span style={{ fontWeight: '600', color: '#008060' }}>
                                                                                        {variant.price ? `$${variant.price.toFixed(2)}` : 'N/A'}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}

                                                    {selectedVariant && allOptionsSelected && (
                                                        <div style={{ 
                                                            padding: '8px 10px', 
                                                            background: '#f0f9ff', 
                                                            border: '1px solid #008060',
                                                            borderRadius: '4px',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            fontSize: '0.85em'
                                                        }}>
                                                            <span><strong>Selected:</strong> {selectedVariant.variant_title}</span>
                                                            <span style={{ fontWeight: '600', color: '#008060' }}>
                                                                {selectedVariant.price ? `$${selectedVariant.price.toFixed(2)}` : 'N/A'}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {productData.options.length > 0 && !allOptionsSelected && selectedVariant && (
                                                        <div style={{ 
                                                            padding: '6px 10px', 
                                                            background: '#fff3cd', 
                                                            border: '1px solid #ffc107',
                                                            borderRadius: '4px',
                                                            fontSize: '0.8em',
                                                            color: '#856404'
                                                        }}>
                                                            Select all options to see exact variant
                                                        </div>
                                                    )}

                                                    {productData.options.length === 0 && productData.variants.length > 0 && (
                                                        <div style={{ 
                                                            padding: '8px 10px', 
                                                            background: '#f0f9ff', 
                                                            border: '1px solid #008060',
                                                            borderRadius: '4px',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            fontSize: '0.85em'
                                                        }}>
                                                            <span style={{ color: '#666' }}>SKU: {productData.variants[0].sku}</span>
                                                            <span style={{ fontWeight: '600', color: '#008060' }}>
                                                                {productData.variants[0].price ? `$${productData.variants[0].price.toFixed(2)}` : 'N/A'}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            // If all options are selected, try to find matching variant
                                                            if (allOptionsSelected) {
                                                                const variant = getSelectedVariant(product.product_id);
                                                                if (variant && variant.sku) {
                                                                    addSku(variant.sku, 1);
                                                                    setShowProductModal(false);
                                                                } else {
                                                                    // If no exact match found but all options selected, try to add first variant or show helpful message
                                                                    if (productData.variants.length > 0) {
                                                                        // Try to find closest match or use first variant
                                                                        const firstVariant = productData.variants[0];
                                                                        if (firstVariant.sku) {
                                                                            addSku(firstVariant.sku, 1);
                                                                            setShowProductModal(false);
                                                                        } else {
                                                                            alert('Unable to find matching variant. Please check your selections.');
                                                                        }
                                                                    } else {
                                                                        alert('No variants available for this product.');
                                                                    }
                                                                }
                                                            } else if (productData.options.length === 0 && productData.variants.length > 0) {
                                                                // If no options, add first variant
                                                                addSku(productData.variants[0].sku, 1);
                                                                setShowProductModal(false);
                                                            } else {
                                                                alert('Please select all options before adding to cart');
                                                            }
                                                        }}
                                                        disabled={productData.options.length > 0 && !allOptionsSelected}
                                                        style={{
                                                            width: '100%',
                                                            padding: '8px',
                                                            background: (productData.options.length > 0 && !allOptionsSelected) ? '#ccc' : '#008060',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: (productData.options.length > 0 && !allOptionsSelected) ? 'not-allowed' : 'pointer',
                                                            fontWeight: '600',
                                                            fontSize: '0.9em',
                                                            opacity: (productData.options.length > 0 && !allOptionsSelected) ? 0.6 : 1
                                                        }}
                                                    >
                                                        Add to Cart
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            )}
            
            <CreateOrderModal 
                isOpen={showCreateOrderModal} 
                onClose={() => setShowCreateOrderModal(false)}
                cartItems={cartItemsForOrder}
                defaultCompany={dealerName || undefined}
                onOrderCreated={(orderId) => {
                    setShowCreateOrderModal(false);
                    navigate(`/orders/${orderId}`);
                }}
            />
        </div>
    );
}

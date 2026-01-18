import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Trash2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { hydrateBySkus, fetchProducts, fetchProductVariants } from '../api/catalogApi';
import type { ProductListItem, HydratedSkuItem } from '../api/catalogApi';
import { CreateOrderModal } from '../cmps/CreateOrderModal';
import { selectDealerName } from '../store/slices/filterSlice';
import { resolveStoreForDealer } from '../utils/storeRouting';
import { getNoOrderNoteBySku } from '../utils/cartOrderNotes';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';

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
    const storeCode = useMemo(() => resolveStoreForDealer(dealerName), [dealerName]);
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
    const storeTag = storeCode.toLowerCase();
    const productsCacheKey = `cart_browse_products_cache_v1_${storeTag}`;
    const variantsCacheKey = `cart_browse_product_variants_cache_v1_${storeTag}`;
    const noOrderNoteBySku = useMemo(() => getNoOrderNoteBySku(dealerName), [dealerName]);

    const handleAddSku = async () => {
        if (!skuInput.trim()) return;
        const sku = skuInput.trim();
        setLoadingSku(true);
        try {
            const { items } = await hydrateBySkus([sku], storeCode);
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
    const buildProductsCacheKey = (query: string) => `store=${storeTag}|q=${query || ''}`;

    const readProductsCache = () => {
        try {
            const raw = localStorage.getItem(productsCacheKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as { key: string; items: ProductListItem[] };
            if (!parsed || typeof parsed.key !== 'string' || !Array.isArray(parsed.items)) return null;
            return parsed;
        } catch {
            return null;
        }
    };

    const writeProductsCache = (key: string, items: ProductListItem[]) => {
        try {
            localStorage.setItem(productsCacheKey, JSON.stringify({ key, items }));
        } catch {
            // Ignore cache write failures (e.g. quota).
        }
    };

    const readVariantsCache = () => {
        try {
            const raw = localStorage.getItem(variantsCacheKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as Record<string, {
                product: ProductListItem;
                variants: HydratedSkuItem[];
                options: ProductOption[];
            }>;
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
        } catch {
            return null;
        }
    };

    const writeVariantCache = (productId: string, data: { product: ProductListItem; variants: HydratedSkuItem[]; options: ProductOption[] }) => {
        try {
            const existing = readVariantsCache() || {};
            const next = { ...existing, [productId]: data };
            localStorage.setItem(variantsCacheKey, JSON.stringify(next));
        } catch {
            // Ignore cache write failures.
        }
    };

    const loadProducts = async (options?: { useCache?: boolean }) => {
        const cacheKey = buildProductsCacheKey(productSearch);
        if (options?.useCache) {
            const cached = readProductsCache();
            if (cached?.key === cacheKey && cached.items.length > 0) {
                setProducts(cached.items);
            }
        }
        setLoadingProducts(true);
        try {
            const result = await fetchProducts({
                query: productSearch || undefined,
                limit: 50,
                store: storeCode,
            });
            setProducts(result.items);
            writeProductsCache(cacheKey, result.items);
        } catch (err) {
            console.error(err);
            alert('Error loading products');
        } finally {
            setLoadingProducts(false);
        }
    };

    // Filter out products where ALL variants are unavailable
    const filterUnavailableProducts = (products: ProductListItem[]): ProductListItem[] => {
        return products.filter(product => {
            const productData = productsWithVariants.get(product.product_id);

            if (loadingVariants.has(product.product_id)) return true;
            if (!productData || productData.variants.length === 0) return false;

            const hasOptions = productData.options.length > 0;
            const hasAvailableVariant = productData.variants.some(v => v.available_for_sale);
            return hasOptions || hasAvailableVariant;
        });
    };

    // Get image URL with fallback chain: variant → product featured → null
    const getProductImageUrl = (productId: string): string | null => {
        const productData = productsWithVariants.get(productId);
        if (!productData) return null;

        // Try variant image first
        const variantWithImage = productData.variants.find(v => v.variant_image_url);
        if (variantWithImage?.variant_image_url) {
            return variantWithImage.variant_image_url;
        }

        // Fallback to product featured image
        const firstVariant = productData.variants[0];
        if (firstVariant?.product_featured_image_url) {
            return firstVariant.product_featured_image_url;
        }

        return null;
    };

    // Load variants for a product
    const loadProductVariants = async (productId: string, options?: { useCache?: boolean }) => {
        if (productsWithVariants.has(productId)) return;

        if (options?.useCache) {
            const cachedVariants = readVariantsCache();
            const cached = cachedVariants ? cachedVariants[productId] : undefined;
            if (cached && cached.variants.length > 0) {
                setProductsWithVariants(prev => {
                    const newMap = new Map(prev);
                    newMap.set(productId, {
                        product: cached.product,
                        variants: cached.variants,
                        options: cached.options,
                        selectedOptions: {}
                    });
                    return newMap;
                });
            }
        }
        
        setLoadingVariants(prev => new Set(prev).add(productId));
        try {
            const result = await fetchProductVariants(productId, storeCode);
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

                const productRecord = products.find(p => p.product_id === productId) || products[0];
                setProductsWithVariants(prev => {
                    const newMap = new Map(prev);
                    newMap.set(productId, {
                        product: productRecord,
                        variants: result.items,
                        options: enrichedOptions,
                        selectedOptions: {}
                    });
                    return newMap;
                });
                if (productRecord) {
                    writeVariantCache(productId, {
                        product: productRecord,
                        variants: result.items,
                        options: enrichedOptions
                    });
                }
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
            loadProducts({ useCache: true });
        }
    }, [showProductModal, storeCode]);

    // Auto-load variants for products when they're loaded
    useEffect(() => {
        if (showProductModal && products.length > 0) {
            products.forEach(product => {
                if (!productsWithVariants.has(product.product_id) && !loadingVariants.has(product.product_id)) {
                    loadProductVariants(product.product_id, { useCache: true });
                }
            });
        }
    }, [products, showProductModal, storeCode]);

    useEffect(() => {
        if (!showProductModal) return;
        setProducts([]);
        setProductsWithVariants(new Map());
        setLoadingVariants(new Set());
        loadProducts({ useCache: true });
    }, [storeCode, showProductModal]);

    // Load products when search changes (debounced)
    useEffect(() => {
        if (!showProductModal) return;
        
        const timer = setTimeout(() => {
            loadProducts({ useCache: true });
        }, 300);

        return () => clearTimeout(timer);
    }, [productSearch, showProductModal, storeCode]);

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
                // Fallback: match by variant title (more lenient matching)
                const titleParts = variant.variant_title.split(' / ').map(p => p.trim());
                // Check if all selected values appear somewhere in the variant title
                return selectedValues.every(val => {
                    const normalizedVal = val.toString().trim().toLowerCase();
                    return titleParts.some(part =>
                        part.toLowerCase() === normalizedVal ||
                        part.toLowerCase().includes(normalizedVal) ||
                        normalizedVal.includes(part.toLowerCase())
                    );
                });
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
                qty_recommended: item.qty_recommended ?? item.qty,
                variant_id: details?.variant_id ? Number(details.variant_id) : undefined
            };
        });
    }, [cart, hydrated]);

    const sortedCart = useMemo(() => {
        const items = [...cart];
        items.sort((a, b) => {
            const aTitle = (hydrated[a.sku]?.product_title || '').trim();
            const bTitle = (hydrated[b.sku]?.product_title || '').trim();
            const aKey = aTitle || a.sku;
            const bKey = bTitle || b.sku;
            const primary = aKey.localeCompare(bKey, undefined, { sensitivity: 'base' });
            if (primary !== 0) return primary;
            return a.sku.localeCompare(b.sku, undefined, { sensitivity: 'base' });
        });
        return items;
    }, [cart, hydrated]);

    return (
        <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 pb-12 pt-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">Cart</h1>
                    <p className="text-sm text-muted-foreground">{cart.length} items</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => navigate('/')}
                    type="button"
                >
                    Back to Dashboard
                </Button>
            </header>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-4">
                    {cart.length === 0 ? (
                        <Card className="border-dashed bg-muted/40">
                            <CardContent className="space-y-2 p-8 text-center">
                                <h2 className="text-lg font-semibold">Your cart is empty</h2>
                                <p className="text-sm text-muted-foreground">
                                    Click "Browse Products" below to add items.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="overflow-hidden">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product</TableHead>
                                            <TableHead className="w-28">Quantity</TableHead>
                                            <TableHead className="w-14" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedCart.map((item) => {
                                            const details = hydrated[item.sku];
                                            const showNoOrderNote = noOrderNoteBySku[item.sku];

                                            return (
                                                <TableRow key={item.sku}>
                                                    <TableCell>
                                                        {details ? (
                                                            <div className="space-y-1">
                                                                <div className="font-semibold text-foreground">
                                                                    {details.product_title}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {details.variant_title}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    SKU: {item.sku}
                                                                </div>
                                                                {showNoOrderNote && (
                                                                    <div className="text-xs text-warning">
                                                                        wasnt ordered in the past year
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                <span className="text-sm text-muted-foreground">
                                                                    Loading {item.sku}...
                                                                </span>
                                                                {showNoOrderNote && (
                                                                    <div className="text-xs text-warning">
                                                                        wasnt ordered in the past year
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={item.qty}
                                                            onChange={(e) => setQty(item.sku, Number(e.target.value))}
                                                            className="h-8 w-20"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeSku(item.sku)}
                                                            type="button"
                                                            title="Remove item"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    <Button
                        onClick={() => setShowProductModal(true)}
                        className="w-full bg-[#008060] text-white hover:bg-[#006f55]"
                        type="button"
                    >
                        + Browse Products
                    </Button>
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={() => setShowCreateOrderModal(true)}
                                disabled={cart.length === 0}
                                className={cn(
                                    "w-full",
                                    cart.length === 0
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-[#008060] text-white hover:bg-[#006f55]"
                                )}
                                type="button"
                            >
                                Create Order
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Add by SKU</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex gap-2">
                                <Input
                                    type="text"
                                    value={skuInput}
                                    onChange={(e) => setSkuInput(e.target.value)}
                                    placeholder="Enter SKU"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSku()}
                                />
                                <Button
                                    onClick={handleAddSku}
                                    disabled={loadingSku}
                                    className="bg-[#008060] text-white hover:bg-[#006f55]"
                                    type="button"
                                >
                                    {loadingSku ? '...' : 'Add'}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Enter a valid variant SKU to add it directly to the cart.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
                <DialogContent className="max-w-4xl p-0">
                    <div className="border-b border-border p-6">
                        <DialogHeader>
                            <DialogTitle>Browse Products</DialogTitle>
                            <DialogDescription>Choose variants and add them to the cart.</DialogDescription>
                        </DialogHeader>
                        <div className="mt-4">
                            <Input
                                type="text"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Search products..."
                            />
                        </div>
                    </div>

                    <ScrollArea className="max-h-[70vh]">
                        <div className="space-y-4 p-6">
                            {loadingProducts && products.length === 0 ? (
                                <div className="py-10 text-center text-sm text-muted-foreground">
                                    Loading products...
                                </div>
                            ) : products.length === 0 ? (
                                <div className="py-10 text-center text-sm text-muted-foreground">
                                    No products found
                                </div>
                            ) : (
                                filterUnavailableProducts(products).map((product) => {
                                    const productData = productsWithVariants.get(product.product_id);
                                    const isLoading = loadingVariants.has(product.product_id);
                                    const allOptionsSelected = productData ?
                                        productData.options.every(opt => productData.selectedOptions[opt.name]) : false;

                                    return (
                                        <div
                                            key={product.product_id}
                                            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row"
                                        >
                                            <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                                                {(() => {
                                                    const imageUrl = getProductImageUrl(product.product_id);
                                                    if (imageUrl) {
                                                        return (
                                                            <img
                                                                src={imageUrl}
                                                                alt={product.title}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        );
                                                    }
                                                    return (
                                                        <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wide text-muted-foreground">
                                                            No Image
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            <div className="flex flex-1 flex-col gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-foreground">{product.title}</h3>
                                                    {product.tags && product.tags.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {product.tags.slice(0, 2).map((tag) => (
                                                                <Badge key={tag} variant="secondary" className="text-xs">
                                                                    {tag}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {isLoading && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Loading options...
                                                    </div>
                                                )}

                                                {productData && (
                                                    <div className="space-y-3">
                                                        {productData.options.map((option) => {
                                                            const availableValues = getAvailableOptionValues(product.product_id, option.name);
                                                            const displayValues = availableValues.length > 0 ? availableValues : option.values;
                                                            const selectedValue = productData.selectedOptions[option.name];

                                                            return (
                                                                <div key={option.name}>
                                                                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                                                                        <span>{option.name}</span>
                                                                        {selectedValue && (
                                                                            <span className="text-primary">{selectedValue}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {displayValues.map((value) => {
                                                                            const isSelected = selectedValue === value;
                                                                            return (
                                                                                <Button
                                                                                    key={value}
                                                                                    type="button"
                                                                                    variant={isSelected ? "default" : "outline"}
                                                                                    className={cn(
                                                                                        "h-8 px-3 text-xs",
                                                                                        isSelected
                                                                                            ? "bg-[#008060] text-white hover:bg-[#006f55]"
                                                                                            : "border-border"
                                                                                    )}
                                                                                    onClick={() => handleOptionChange(product.product_id, option.name, value)}
                                                                                >
                                                                                    {value}
                                                                                </Button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {productData && (
                                                <div className="flex items-center">
                                                    <Button
                                                        onClick={() => {
                                                            if (allOptionsSelected) {
                                                                const variant = getSelectedVariant(product.product_id);
                                                                if (variant && variant.sku) {
                                                                    addSku(variant.sku, 1);
                                                                    setShowProductModal(false);
                                                                } else {
                                                                    const variantWithSku = productData.variants.find(v => v.sku);
                                                                    if (variantWithSku) {
                                                                        addSku(variantWithSku.sku, 1);
                                                                        setShowProductModal(false);
                                                                    } else {
                                                                        alert('Unable to find matching variant.');
                                                                    }
                                                                }
                                                            } else if (productData.options.length === 0 && productData.variants.length > 0) {
                                                                const variantWithSku = productData.variants.find(v => v.sku);
                                                                if (variantWithSku) {
                                                                    addSku(variantWithSku.sku, 1);
                                                                    setShowProductModal(false);
                                                                }
                                                            } else {
                                                                alert('Please select all options');
                                                            }
                                                        }}
                                                        disabled={productData.options.length > 0 && !allOptionsSelected}
                                                        className={cn(
                                                            "h-10 px-6",
                                                            productData.options.length > 0 && !allOptionsSelected
                                                                ? "bg-muted text-muted-foreground"
                                                                : "bg-[#008060] text-white hover:bg-[#006f55]"
                                                        )}
                                                        type="button"
                                                    >
                                                        Add to Cart
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

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

import React, { useState, useEffect } from 'react';
import { fetchProducts, fetchProductVariants, type ProductListItem, type HydratedSkuItem } from '../api/catalogApi';
import { getPublicProducts, getPublicProductVariants } from '../api/publicOrders';
import { getProductsCache, setProductsCache, getVariantsCache, setVariantsCache } from '../api/cacheApi';
import { cn } from '../lib/utils';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';

type AddProductModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: { sku: string; variant_id: number; title: string; price: string; qty: number }) => void;
  store?: string;
  publicToken?: string;
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

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onAdd, store, publicToken }) => {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsWithVariants, setProductsWithVariants] = useState<Map<string, ProductWithVariants>>(new Map());
  const [loadingVariants, setLoadingVariants] = useState<Set<string>>(new Set());
  const storeTag = (store || 'US').toLowerCase();

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

  const loadProducts = async (options?: { useCache?: boolean }) => {
    // Try Redis cache first (only for authenticated users, not public tokens)
    if (options?.useCache && !publicToken) {
      try {
        const cached = await getProductsCache<ProductListItem>(storeTag, productSearch || '');
        if (cached && cached.length > 0) {
          setProducts(cached);
        }
      } catch (err) {
        console.error('Error loading products cache from Redis:', err);
      }
    }

    setLoadingProducts(true);
    try {
      const result = publicToken
        ? await getPublicProducts(publicToken, { query: productSearch || undefined, limit: 50 })
        : await fetchProducts({
            query: productSearch || undefined,
            limit: 50,
            store,
          });
      setProducts(result.items);

      // Write to Redis cache (only for authenticated users)
      if (!publicToken) {
        setProductsCache(storeTag, productSearch || '', result.items).catch((err) => {
          console.error('Error saving products cache to Redis:', err);
        });
      }
    } catch (err) {
      console.error(err);
      alert('Error loading products');
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadProductVariants = async (productId: string, options?: { useCache?: boolean; revalidate?: boolean }) => {
    const hasInState = productsWithVariants.has(productId);
    if (hasInState && !options?.revalidate) return;
    if (loadingVariants.has(productId)) return;

    // Try Redis cache first (only for authenticated users)
    if (options?.useCache && !hasInState && !publicToken) {
      try {
        const cached = await getVariantsCache<ProductListItem, HydratedSkuItem, ProductOption>(storeTag, productId);
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
      } catch (err) {
        console.error('Error loading variants cache from Redis:', err);
      }
    }

    setLoadingVariants(prev => new Set(prev).add(productId));
    try {
      const result = publicToken
        ? await getPublicProductVariants(publicToken, productId)
        : await fetchProductVariants(productId, store);
      if (result.items && result.items.length > 0) {
        const firstVariant = result.items[0];
        const options = parseProductOptions(firstVariant.product_options);

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
                } catch (e) {
                  if (variant.variant_title) {
                    const parts = variant.variant_title.split(' / ');
                    const optIndex = options.findIndex(o => o.name.toLowerCase() === opt.name.toLowerCase());
                    if (optIndex >= 0 && parts[optIndex]) {
                      values.add(parts[optIndex]);
                    }
                  }
                }
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

        // Write to Redis cache (only for authenticated users)
        if (productRecord && !publicToken) {
          setVariantsCache(storeTag, productId, {
            product: productRecord,
            variants: result.items,
            options: enrichedOptions
          }).catch((err) => {
            console.error('Error saving variants cache to Redis:', err);
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

  useEffect(() => {
    if (!isOpen) return;
    setProducts([]);
    setProductsWithVariants(new Map());
    setLoadingVariants(new Set());
    loadProducts({ useCache: true });
  }, [isOpen, storeTag]);

  useEffect(() => {
    if (isOpen && products.length > 0) {
      products.forEach(product => {
        if (!loadingVariants.has(product.product_id)) {
          loadProductVariants(product.product_id, { useCache: true, revalidate: true });
        }
      });
    }
  }, [products, isOpen, storeTag]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadProducts({ useCache: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, isOpen, storeTag]);

  const filterUnavailableProducts = (items: ProductListItem[]): ProductListItem[] => {
    return items.filter(product => {
      const productData = productsWithVariants.get(product.product_id);

      if (loadingVariants.has(product.product_id)) return true;
      if (!productData || productData.variants.length === 0) return false;

      const hasOptions = productData.options.length > 0;
      const hasAvailableVariant = productData.variants.some(v => v.available_for_sale);
      return hasOptions || hasAvailableVariant;
    });
  };

  const getProductImageUrl = (productId: string): string | null => {
    const productData = productsWithVariants.get(productId);
    if (!productData) return null;

    const variantWithImage = productData.variants.find(v => v.variant_image_url);
    if (variantWithImage?.variant_image_url) {
      return variantWithImage.variant_image_url;
    }

    const firstVariant = productData.variants[0];
    if (firstVariant?.product_featured_image_url) {
      return firstVariant.product_featured_image_url;
    }

    return null;
  };

  const getAvailableVariants = (productId: string): HydratedSkuItem[] => {
    const productData = productsWithVariants.get(productId);
    if (!productData) return [];

    const { variants, selectedOptions } = productData;
    const selectedEntries = Object.entries(selectedOptions).filter(([_, value]) => value);
    const availableVariants = variants.filter(variant => variant.available_for_sale);

    if (selectedEntries.length === 0) return availableVariants;

    return availableVariants.filter(variant => {
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

  const getSelectedVariant = (productId: string): HydratedSkuItem | null => {
    const productData = productsWithVariants.get(productId);
    if (!productData) return null;

    const { variants, selectedOptions } = productData;
    const selectedValues = Object.values(selectedOptions).filter(Boolean);

    if (selectedValues.length === 0) return null;

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
      return false;
    });

    if (!matchedVariant || !matchedVariant.available_for_sale) return null;
    return matchedVariant;
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

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-4xl p-0">
        <div className="border-b border-border p-6">
          <DialogHeader>
            <DialogTitle>Browse Products</DialogTitle>
            <DialogDescription>Search and select variants to add to the order.</DialogDescription>
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

        <ScrollArea className="max-h-[65vh]">
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
                const selectedVariant = productData ? getSelectedVariant(product.product_id) : null;
                const allOptionsSelected = productData ?
                  productData.options.every(opt => productData.selectedOptions[opt.name]) : false;
                const hasOptions = productData ? productData.options.length > 0 : false;
                const canAdd = productData ? (hasOptions ? allOptionsSelected && !!selectedVariant : !!productData.variants.find(v => v.available_for_sale)) : false;

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
                                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                            : "border-border"
                                        )}
                                        onClick={() => handleOptionChange(product.product_id, option.name, value)}
                                      >
                                        {value}
                                      </Button>
                                    );
                                  })}
                                </div>
                                {hasOptions && allOptionsSelected && !selectedVariant && (
                                  <div className="mt-2 text-xs text-destructive">
                                    Selected combination is unavailable.
                                  </div>
                                )}
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
                            if (!productData) return;
                            if (hasOptions) {
                              if (!allOptionsSelected) {
                                alert('Please select all options');
                                return;
                              }
                              if (!selectedVariant) {
                                alert('Selected combination is unavailable.');
                                return;
                              }
                              onAdd({
                                sku: selectedVariant.sku,
                                variant_id: Number(selectedVariant.variant_id),
                                title: `${product.title} - ${selectedVariant.variant_title}`,
                                price: String(selectedVariant.price || '0'),
                                qty: 1
                              });
                              onClose();
                              return;
                            }

                            const availableVariant = productData.variants.find(v => v.available_for_sale);
                            if (!availableVariant) {
                              alert('This product is currently unavailable.');
                              return;
                            }
                            onAdd({
                              sku: availableVariant.sku,
                              variant_id: Number(availableVariant.variant_id),
                              title: `${product.title} - ${availableVariant.variant_title}`,
                              price: String(availableVariant.price || '0'),
                              qty: 1
                            });
                            onClose();
                          }}
                          disabled={!canAdd}
                          className={cn(
                            "h-10 px-6",
                            !canAdd
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          )}
                          type="button"
                        >
                          Add
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
  );
};

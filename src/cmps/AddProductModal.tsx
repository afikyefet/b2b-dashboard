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

  const filterUnavailableProducts = (items: ProductListItem[]): ProductListItem[] => {
    return items.filter(product => {
      const productData = productsWithVariants.get(product.product_id);

      if (loadingVariants.has(product.product_id)) return true;
      if (!productData || productData.variants.length === 0) return true;

      return productData.variants.some(v => v.available_for_sale);
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '900px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.3em', color: '#333' }}>Browse Products</h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5em',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              A-
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loadingProducts ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading products...</div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No products found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filterUnavailableProducts(products).map((product) => {
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
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      background: 'white',
                      display: 'flex',
                      flexDirection: 'row',
                      overflow: 'hidden',
                      transition: 'box-shadow 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      width: '120px',
                      height: '120px',
                      flexShrink: 0,
                      position: 'relative',
                      backgroundColor: '#f5f5f5',
                      overflow: 'hidden'
                    }}>
                      {(() => {
                        const imageUrl = getProductImageUrl(product.product_id);
                        if (imageUrl) {
                          return (
                            <img
                              src={imageUrl}
                              alt={product.title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          );
                        }
                        return (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#e5e5e5',
                            color: '#999',
                            fontSize: '0.75em'
                          }}>
                            No Image
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <h3 style={{
                          margin: 0,
                          fontSize: '1em',
                          fontWeight: '600',
                          lineHeight: '1.3',
                          color: '#333'
                        }}>
                          {product.title}
                        </h3>
                        {product.tags && product.tags.length > 0 && (
                          <div style={{ fontSize: '0.75em', color: '#666', marginTop: '2px' }}>
                            {product.tags.slice(0, 2).join(', ')}
                          </div>
                        )}
                      </div>

                      {isLoading && (
                        <div style={{ color: '#666', fontSize: '0.85em' }}>
                          Loading options...
                        </div>
                      )}

                      {productData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {productData.options.map((option) => {
                            const availableValues = getAvailableOptionValues(product.product_id, option.name);
                            const displayValues = availableValues.length > 0 ? availableValues : option.values;
                            const selectedValue = productData.selectedOptions[option.name];

                            return (
                              <div key={option.name}>
                                <label style={{
                                  display: 'block',
                                  marginBottom: '6px',
                                  fontSize: '0.8em',
                                  fontWeight: '600',
                                  color: '#555'
                                }}>
                                  {option.name}: {selectedValue && <span style={{ color: '#008060' }}>{selectedValue}</span>}
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {displayValues.map((value) => {
                                    const isSelected = selectedValue === value;
                                    return (
                                      <button
                                        key={value}
                                        onClick={() => handleOptionChange(product.product_id, option.name, value)}
                                        style={{
                                          padding: '6px 12px',
                                          border: isSelected ? '2px solid #008060' : '1px solid #ddd',
                                          borderRadius: '4px',
                                          background: isSelected ? '#e8f5f2' : 'white',
                                          color: isSelected ? '#008060' : '#333',
                                          fontSize: '0.8em',
                                          fontWeight: isSelected ? '600' : '400',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s',
                                          minWidth: '40px',
                                          textAlign: 'center'
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isSelected) {
                                            e.currentTarget.style.borderColor = '#999';
                                            e.currentTarget.style.background = '#f9f9f9';
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isSelected) {
                                            e.currentTarget.style.borderColor = '#ddd';
                                            e.currentTarget.style.background = 'white';
                                          }
                                        }}
                                      >
                                        {value}
                                      </button>
                                    );
                                  })}
                                </div>
                                {hasOptions && allOptionsSelected && !selectedVariant && (
                                  <div style={{ color: '#d72c2c', fontSize: '0.8em', marginTop: '6px' }}>
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
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        paddingRight: '12px',
                        paddingLeft: '12px'
                      }}>
                        <button
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
                          style={{
                            padding: '10px 20px',
                            background: !canAdd ? '#ccc' : '#008060',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: !canAdd ? 'not-allowed' : 'pointer',
                            fontWeight: '600',
                            fontSize: '0.9em',
                            whiteSpace: 'nowrap',
                            minWidth: '100px'
                          }}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

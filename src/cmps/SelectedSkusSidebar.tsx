import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useDrawer } from '../contexts/DrawerContext';
import { useCart } from '../contexts/CartContext';
import { selectDealerName } from '../store/slices/filterSlice';
import { getNoOrderNoteBySku } from '../utils/cartOrderNotes';
import '../styles/SelectedSkusSidebar.scss';

// Prop interface kept for compatibility if needed, but props are unused
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface SelectedSkusSidebarProps {
    filteredData?: unknown[];
}

function SelectedSkusSidebar({}: SelectedSkusSidebarProps) {
    const navigate = useNavigate();
    const { isOpen, toggleDrawer } = useDrawer();
    const { cart, hydrated, setQty, removeSku } = useCart();
    const dealerName = useSelector(selectDealerName);
    const noOrderNoteBySku = useMemo(() => getNoOrderNoteBySku(dealerName), [dealerName]);

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

    const handleGoToCart = () => {
        navigate('/cart');
        if (isOpen) toggleDrawer();
    };

    return (
        <>
            {/* Overlay when drawer is open */}
            {isOpen && (
                <div 
                    className="drawer-overlay" 
                    onClick={toggleDrawer}
                    aria-hidden="true"
                />
            )}
            
            {/* Drawer */}
            <div className={`selected-skus-drawer ${isOpen ? 'open' : 'closed'}`}>
                <div className="drawer-content">
                    <div className="sidebar-header">
                        <div className="header-left">
                            <h3>Cart</h3>
                            <span className="sku-count">{cart.length}</span>
                        </div>
                        <button 
                            className="toggle-button"
                            onClick={toggleDrawer}
                            type="button"
                            aria-label="Close drawer"
                        >
                            ✕
                        </button>
                    </div>
                    
                    {isOpen && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                                    <div className="sidebar-actions" style={{ marginBottom: '10px' }}>
                                        <button 
                                            className="copy-button" // Reuse class for style
                                            onClick={handleGoToCart}
                                            type="button"
                                            style={{ width: '100%', textAlign: 'center', justifyContent: 'center' }}
                                        >
                                            View Full Cart
                                        </button>
                                    </div>
                            {cart.length > 0 ? (
                                <>
                                    
                                    <div className="sku-list" style={{ flex: 1, overflowY: 'auto' }}>
                                        {sortedCart.map((item) => {
                                            const details = hydrated[item.sku];
                                            const showNoOrderNote = noOrderNoteBySku[item.sku];
                                            return (
                                                <div key={item.sku} className="sku-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                        <span style={{ fontWeight: 'bold' }}>
                                                            {details ? details.product_title : item.sku}
                                                        </span>
                                                        <button 
                                                            onClick={() => removeSku(item.sku)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '0 5px' }}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                    
                                                    {details && (
                                                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                                                            {details.variant_title}
                                                        </div>
                                                    )}
                                                    
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '5px', alignItems: 'center' }}>
                                                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                                                            SKU: {item.sku}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <label style={{ fontSize: '0.8em' }}>Qty:</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.qty}
                                                                onChange={(e) => setQty(item.sku, Number(e.target.value))}
                                                                style={{ width: '40px', padding: '2px' }}
                                                            />
                                                        </div>
                                                    </div>
                                                    {showNoOrderNote && (
                                                        <div style={{ fontSize: '0.75em', color: '#b45309' }}>
                                                            wasnt ordered in the past year
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state">
                                    <p>Your cart is empty</p>
                                    <p className="hint">Select items from the dashboard to add them.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default SelectedSkusSidebar;

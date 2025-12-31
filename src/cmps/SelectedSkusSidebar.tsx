import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectSelectedRowIds, getSelectedSkusFromData } from '../store/slices/selectionSlice';
import type { DashboardDataRow } from '../types/dashboard.types';
import '../styles/SelectedSkusSidebar.scss';

interface SelectedSkusSidebarProps {
    filteredData: DashboardDataRow[];
}

function SelectedSkusSidebar({ filteredData }: SelectedSkusSidebarProps) {
    const [isOpen, setIsOpen] = useState(true);
    const selectedRowIds = useSelector(selectSelectedRowIds);
    const selectedSkus = getSelectedSkusFromData(selectedRowIds, filteredData);

    const handleCopyToClipboard = () => {
        const skusText = selectedSkus.join('\n');
        navigator.clipboard.writeText(skusText).then(() => {
            // Optional: Show a toast notification
            alert(`Copied ${selectedSkus.length} SKUs to clipboard`);
        }).catch((err) => {
            console.error('Failed to copy SKUs to clipboard:', err);
        });
    };

    const handleCopyAsArray = () => {
        const skusArrayText = JSON.stringify(selectedSkus, null, 2);
        navigator.clipboard.writeText(skusArrayText).then(() => {
            alert(`Copied SKUs array to clipboard`);
        }).catch((err) => {
            console.error('Failed to copy SKUs array to clipboard:', err);
        });
    };

    const toggleDrawer = () => {
        setIsOpen(!isOpen);
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
                            <h3>Selected SKUs</h3>
                            <span className="sku-count">{selectedSkus.length}</span>
                        </div>
                        <button 
                            className="toggle-button"
                            onClick={toggleDrawer}
                            type="button"
                            aria-label={isOpen ? 'Minimize drawer' : 'Open drawer'}
                        >
                            {isOpen ? '✕' : '☰'}
                        </button>
                    </div>
                    
                    {isOpen && (
                        <>
                            {selectedSkus.length > 0 ? (
                                <>
                                    <div className="sidebar-actions">
                                        <button 
                                            className="copy-button" 
                                            onClick={handleCopyToClipboard}
                                            type="button"
                                        >
                                            Copy List
                                        </button>
                                        <button 
                                            className="copy-button" 
                                            onClick={handleCopyAsArray}
                                            type="button"
                                        >
                                            Copy Array
                                        </button>
                                    </div>
                                    <div className="sku-list">
                                        {selectedSkus.map((sku, index) => (
                                            <div key={`${sku}-${index}`} className="sku-item">
                                                {sku}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state">
                                    <p>No rows selected</p>
                                    <p className="hint">Select rows to see their SKUs here</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            
            {/* Toggle button - always visible */}
            <button 
                className={`drawer-toggle-button ${!isOpen ? 'minimized' : ''}`}
                onClick={toggleDrawer}
                type="button"
                title={isOpen ? 'Minimize drawer' : 'Open SKU drawer'}
            >
                <span className="toggle-icon">{isOpen ? '✕' : '☰'}</span>
                {!isOpen && selectedSkus.length > 0 && (
                    <span className="minimized-count">{selectedSkus.length}</span>
                )}
            </button>
            </div>
        </>
    );
}

export default SelectedSkusSidebar;


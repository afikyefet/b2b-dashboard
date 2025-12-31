import type { DashboardDataRow } from '../types/dashboard.types';

/**
 * Generate a unique row ID from row data
 * Uses combination of key fields to create stable identifier
 * Includes Vendor and url to ensure uniqueness when multiple rows share same product/variant
 */
export function getRowId(row: DashboardDataRow): string {
  const customer = String(row.customer_company || '').trim();
  const sku = String(row.variant_sku || '').trim();
  const product = String(row.product_name || '').trim();
  const vendor = String(row.Vendor || '').trim();
  const url = String(row.url || '').trim();
  
  // Create composite key with all available identifying fields
  const parts = [customer, sku, product, vendor, url].filter(part => part !== '');
  
  // If all parts are empty, use a hash of the entire row as fallback
  if (parts.length === 0) {
    // Create a simple hash from the row data
    const rowStr = JSON.stringify(row);
    let hash = 0;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `row_${Math.abs(hash)}`;
  }
  
  // Join parts with a separator that's unlikely to appear in the data
  return parts.join('|');
}


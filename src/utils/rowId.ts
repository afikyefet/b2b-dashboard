import type { DashboardDataRow } from '../types/dashboard.types';

/**
 * Generate a unique row ID from row data
 * Uses combination of key fields to create stable identifier
 */
export function getRowId(row: DashboardDataRow): string {
  const customer = String(row.customer_company || '').trim();
  const sku = String(row.variant_sku || '').trim();
  const product = String(row.product_name || '').trim();
  
  // Create composite key, handle empty values
  const parts = [customer, sku, product].filter(part => part !== '');
  
  // If all parts are empty, use a fallback (shouldn't happen in real data)
  if (parts.length === 0) {
    return `row_${JSON.stringify(row).slice(0, 50)}`;
  }
  
  return parts.join('_');
}


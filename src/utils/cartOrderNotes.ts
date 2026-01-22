import type { DashboardDataResponse, DashboardDataRow } from '../types/dashboard.types';

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const num = parseFloat(String(value));
  return Number.isNaN(num) ? null : num;
}

function shouldShowNoOrderNote(row: DashboardDataRow): boolean {
  const orderCount = parseNumber(row.order_count_year);
  const lastDays = parseNumber(row['1_last_days_from_last_sale_created_at']);
  const missingOrderCount = orderCount === null;
  const noOrders = orderCount === 0;
  const missingLastDays = lastDays === null;
  const oldLastOrder = lastDays !== null && lastDays > 365;
  return missingOrderCount || noOrders || missingLastDays || oldLastOrder;
}

/**
 * Get "no order" notes by SKU from dashboard data.
 * Pass the dashboard data directly instead of reading from cache.
 * Returns empty object if no data is provided.
 */
export function getNoOrderNoteBySku(
  dealerName: string | null,
  dashboardData?: DashboardDataResponse | null
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (!dealerName) return result;
  if (!dashboardData || !Array.isArray(dashboardData)) return result;

  const normalizedDealer = String(dealerName).trim();
  if (!normalizedDealer) return result;

  dashboardData.forEach((row) => {
    const rowDealer = String(row.customer_company || '').trim();
    if (rowDealer !== normalizedDealer) return;

    const sku = String(row.variant_sku_real || '').trim();
    if (!sku) return;

    result[sku] = shouldShowNoOrderNote(row);
  });

  return result;
}

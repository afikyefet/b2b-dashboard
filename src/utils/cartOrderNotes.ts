import type { DashboardDataResponse, DashboardDataRow } from '../types/dashboard.types';

const DASHBOARD_CACHE_KEY = 'dashboard_table_cache_v1';

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const num = parseFloat(String(value));
  return Number.isNaN(num) ? null : num;
}

function readDashboardCache(): DashboardDataResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: DashboardDataResponse };
    if (!parsed || !Array.isArray(parsed.data)) return null;
    return parsed.data;
  } catch {
    return null;
  }
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

export function getNoOrderNoteBySku(dealerName: string | null): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  if (!dealerName) return result;
  const data = readDashboardCache();
  if (!data) return result;
  const normalizedDealer = String(dealerName).trim();
  if (!normalizedDealer) return result;

  data.forEach((row) => {
    const rowDealer = String(row.customer_company || '').trim();
    if (rowDealer !== normalizedDealer) return;

    const sku = String(row.variant_sku_real || '').trim();
    if (!sku) return;

    result[sku] = shouldShowNoOrderNote(row);
  });

  return result;
}

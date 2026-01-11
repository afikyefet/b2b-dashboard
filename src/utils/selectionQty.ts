import type { DashboardDataRow } from "../types/dashboard.types";

export function getSelectionQty(row: DashboardDataRow, days: number): number {
  const normalizedDays = Number.isFinite(days) && days > 0 ? days : 30;

  if (normalizedDays !== 30) {
    const sellRate = parseFloat(String(row.sell_rate ?? ""));
    if (!isNaN(sellRate) && sellRate > 0) {
      return Math.max(1, Math.round(normalizedDays * sellRate));
    }
  }

  const sellNow = parseFloat(String(row.how_much_to_sell_now ?? ""));
  if (!isNaN(sellNow) && sellNow > 0) {
    return Math.max(1, Math.round(sellNow));
  }

  return 1;
}

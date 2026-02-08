import type { OrderItem } from '../api/orders';
import type { HydratedSkuItem } from '../api/catalogApi';

function escapeCsvField(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function splitTitle(title: string): { product: string; variant: string } {
  const trimmed = (title || '').trim();
  if (!trimmed) return { product: '', variant: '' };
  const idx = trimmed.lastIndexOf(' - ');
  if (idx === -1) return { product: trimmed, variant: '' };
  return {
    product: trimmed.slice(0, idx).trim(),
    variant: trimmed.slice(idx + 3).trim(),
  };
}

function parseVariantOptions(variantTitle: string): { color: string; size: string } {
  const parts = variantTitle
    .split(' / ')
    .map(part => part.trim())
    .filter(Boolean);
  return {
    color: parts[0] || '',
    size: parts[1] || '',
  };
}

function resolveOptions(
  item: OrderItem,
  details: HydratedSkuItem | undefined,
): { productName: string; color: string; size: string } {
  const titleSplit = splitTitle(item.title);
  const productName = details?.product_title || titleSplit.product || item.title || '';
  const variantTitle = details?.variant_title || titleSplit.variant || '';

  let color = '';
  let size = '';

  if (details?.variant_selected_options) {
    try {
      const options = JSON.parse(details.variant_selected_options) as Array<{ name: string; value: string }>;
      for (const opt of options) {
        const name = opt.name.toLowerCase();
        if (name === 'color' || name === 'colour') {
          color = opt.value;
        } else if (name === 'size') {
          size = opt.value;
        }
      }
    } catch {
      // fall through to variant title parsing
    }
  }

  if (!color && !size) {
    const meta = parseVariantOptions(variantTitle);
    color = meta.color;
    size = meta.size;
  }

  return { productName, color, size };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').substring(0, 60);
}

export function exportOrderCsv(
  items: OrderItem[],
  skuDetails: Record<string, HydratedSkuItem>,
  dealerLabel?: string,
) {
  const headers = ['Product Name', 'SKU', 'Color', 'Size', 'Qty'];
  const rows: string[][] = [];

  for (const item of items) {
    if (item.qty <= 0) continue;
    const details = skuDetails[item.sku];
    const { productName, color, size } = resolveOptions(item, details);
    rows.push([productName, item.sku || '', color, size, String(item.qty)]);
  }

  // UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF';
  const csvContent = bom + [
    headers.map(escapeCsvField).join(','),
    ...rows.map(row => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const date = new Date().toISOString().slice(0, 10);
  const label = dealerLabel ? sanitizeFilename(dealerLabel) : 'order';
  const filename = `${label}-${date}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

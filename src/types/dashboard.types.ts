// Dashboard Header Types
export type DashboardCategory = 
  | 'dealer' 
  | 'product' 
  | 'variant' 
  | 'inventory' 
  | 'sales';

// Sorting Types
export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

// Filtering Types
export interface FilterConfig {
  generalSearch?: string;
  dealerName?: string;
  productCategory?: string[];
  productName?: string[];
  variantSku?: string[];
  variantSize?: string[];
  variantColor?: string[];
}

// Dropdown Options
export interface FilterOptions {
  dealerNames: string[];
  productCategories: string[];
  productNames: string[];
  variantSkus: string[];
  variantSizes: string[];
  variantColors: string[];
}

export interface DashboardHeader {
  id: string;
  field: string;
  displayName: string;
  category: DashboardCategory;
}

export interface DashboardHeadersResponse {
  headers: DashboardHeader[];
  categories: Record<DashboardCategory, string>;
}

// Dashboard Data Row Types
export interface DashboardDataRow {
  // Dealer Information
  customer_company: string | null;
  
  // Product Information
  product_category_name: string | null;
  product_name: string | null;
  
  // Variant Details
  variant_sku_real: string | null;
  variant_color: string | null;
  variant_size: string | null;
  
  // Inventory Management
  last_stock: string | number | null;
  
  // Sales Strategy
  how_much_to_sell_now: string | number | null;
  when_to_sell: string | null;
  how_much_to_sell_on_schedule: string | number | null;
  sell_rate: string | number | null;
  
  // Additional fields that may exist in the data
  Vendor?: string;
  url?: string;
  currency?: string;
  price_sale?: string | number;
  price_regular?: string | number;
  days_in_stock?: string | number;
  total_sold?: string | number;
  last_snapshot?: string;
  first_stock?: string | number;
  first_snapshot?: string;
  days_in_stock_binary?: string | number;
  total_sold_binary?: string | number;
  last_stock_binary?: string | number;
  binary_code?: string;
  product_sell_type?: string;
  quantity_year?: string | number;
  quantity_avg_month?: string | number;
  quantity_avg_order?: string | number;
  order_count_year?: string | number;
  binary_code_k?: string;
  '1_last_sale_created_at'?: string;
  '1_last_days_from_last_sale_created_at'?: string | number;
  [key: string]: unknown; // Allow for additional dynamic fields
}

// Service Response Types
export type DashboardDataResponse = DashboardDataRow[];
export type DashboardHeadersDataResponse = DashboardHeader[];

// Component Props Types
export interface DashboardHeadersProps {
  headers?: DashboardHeader[];
}

export interface DashboardTableProps {
  data?: DashboardDataRow[];
  headers?: DashboardHeader[];
}

export interface DashboardRowProps {
  row: DashboardDataRow;
  headers: DashboardHeader[];
}


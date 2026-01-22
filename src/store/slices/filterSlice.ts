import { createSlice, createSelector, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction, Middleware } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { RangeFilter } from '../../types/dashboard.types';
import { getFiltersCache, updateFiltersCache } from '../../api/cacheApi';

interface FilterState {
  dealerName: string | null;
  productCategory: string[];
  productName: string[];
  variantSku: string[];
  variantSize: string[];
  variantColor: string[];
  generalSearch: string;
  productSellType: string[];
  whenToSellRange: RangeFilter;
  howMuchToSellNowRange: RangeFilter;
  sellRateRange: RangeFilter;
  lastStockRange: RangeFilter;
  _filtersLoaded: boolean;
}

// Async thunk to load filters from Redis
export const loadFiltersFromRedis = createAsyncThunk(
  'filter/loadFromRedis',
  async () => {
    try {
      const cached = await getFiltersCache();
      return { dealerName: cached.dealerName };
    } catch (error) {
      console.error('Error loading filters from Redis:', error);
      return { dealerName: null };
    }
  }
);

// Middleware to sync filter changes to Redis
export const filterPersistMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);

  // Only sync dealerName changes to Redis
  if (action.type === 'filter/setDealerName') {
    const state = store.getState() as RootState;
    updateFiltersCache({ dealerName: state.filter.dealerName }).catch((error) => {
      console.error('Error saving filters to Redis:', error);
    });
  }

  return result;
};

const initialState: FilterState = {
  dealerName: null,
  productCategory: [],
  productName: [],
  variantSku: [],
  variantSize: [],
  variantColor: [],
  generalSearch: '',
  productSellType: [],
  whenToSellRange: { min: null, max: null },
  howMuchToSellNowRange: { min: null, max: null },
  sellRateRange: { min: null, max: null },
  lastStockRange: { min: null, max: null },
  _filtersLoaded: false,
};

const filterSlice = createSlice({
  name: 'filter',
  initialState,
  reducers: {
    setDealerName: (state, action: PayloadAction<string | null>) => {
      state.dealerName = action.payload;
      // Redis sync is handled by filterPersistMiddleware
    },
    setGeneralSearch: (state, action: PayloadAction<string>) => {
      state.generalSearch = action.payload;
    },
    toggleProductCategory: (state, action: PayloadAction<string>) => {
      const index = state.productCategory.indexOf(action.payload);
      if (index === -1) {
        state.productCategory.push(action.payload);
      } else {
        state.productCategory.splice(index, 1);
      }
    },
    toggleProductName: (state, action: PayloadAction<string>) => {
      const index = state.productName.indexOf(action.payload);
      if (index === -1) {
        state.productName.push(action.payload);
      } else {
        state.productName.splice(index, 1);
      }
    },
    toggleVariantSku: (state, action: PayloadAction<string>) => {
      const index = state.variantSku.indexOf(action.payload);
      if (index === -1) {
        state.variantSku.push(action.payload);
      } else {
        state.variantSku.splice(index, 1);
      }
    },
    toggleVariantSize: (state, action: PayloadAction<string>) => {
      const index = state.variantSize.indexOf(action.payload);
      if (index === -1) {
        state.variantSize.push(action.payload);
      } else {
        state.variantSize.splice(index, 1);
      }
    },
    toggleVariantColor: (state, action: PayloadAction<string>) => {
      const index = state.variantColor.indexOf(action.payload);
      if (index === -1) {
        state.variantColor.push(action.payload);
      } else {
        state.variantColor.splice(index, 1);
      }
    },
    toggleProductSellType: (state, action: PayloadAction<string>) => {
      const index = state.productSellType.indexOf(action.payload);
      if (index === -1) {
        state.productSellType.push(action.payload);
      } else {
        state.productSellType.splice(index, 1);
      }
    },
    setWhenToSellRange: (state, action: PayloadAction<RangeFilter>) => {
      state.whenToSellRange = action.payload;
    },
    setHowMuchToSellNowRange: (state, action: PayloadAction<RangeFilter>) => {
      state.howMuchToSellNowRange = action.payload;
    },
    setSellRateRange: (state, action: PayloadAction<RangeFilter>) => {
      state.sellRateRange = action.payload;
    },
    setLastStockRange: (state, action: PayloadAction<RangeFilter>) => {
      state.lastStockRange = action.payload;
    },
    resetRangeFilters: (state) => {
      state.whenToSellRange = { min: null, max: null };
      state.howMuchToSellNowRange = { min: null, max: null };
      state.sellRateRange = { min: null, max: null };
      state.lastStockRange = { min: null, max: null };
    },
    resetFilters: (state) => {
      // Reset all except dealer name
      state.productCategory = [];
      state.productName = [];
      state.variantSku = [];
      state.variantSize = [];
      state.variantColor = [];
      state.generalSearch = '';
      state.productSellType = [];
      state.whenToSellRange = { min: null, max: null };
      state.howMuchToSellNowRange = { min: null, max: null };
      state.sellRateRange = { min: null, max: null };
      state.lastStockRange = { min: null, max: null };
    },
    resetAllFilters: () => {
      return initialState;
    },
    initializeFilters: (state, action: PayloadAction<Partial<FilterState>>) => {
      return { ...state, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadFiltersFromRedis.fulfilled, (state, action) => {
      state.dealerName = action.payload.dealerName;
      state._filtersLoaded = true;
    });
    builder.addCase(loadFiltersFromRedis.rejected, (state) => {
      state._filtersLoaded = true;
    });
  },
});

export const {
  setDealerName,
  setGeneralSearch,
  toggleProductCategory,
  toggleProductName,
  toggleVariantSku,
  toggleVariantSize,
  toggleVariantColor,
  toggleProductSellType,
  setWhenToSellRange,
  setHowMuchToSellNowRange,
  setSellRateRange,
  setLastStockRange,
  resetRangeFilters,
  resetFilters,
  resetAllFilters,
  initializeFilters,
} = filterSlice.actions;

// Selectors
const selectFilterState = (state: RootState) => state.filter;

export const selectFilters = createSelector(
  [selectFilterState],
  (filterState) => ({
    dealerName: filterState.dealerName,
    productCategory: filterState.productCategory.length > 0 ? filterState.productCategory : undefined,
    productName: filterState.productName.length > 0 ? filterState.productName : undefined,
    variantSku: filterState.variantSku.length > 0 ? filterState.variantSku : undefined,
    variantSize: filterState.variantSize.length > 0 ? filterState.variantSize : undefined,
    variantColor: filterState.variantColor.length > 0 ? filterState.variantColor : undefined,
    generalSearch: filterState.generalSearch || undefined,
    productSellType: filterState.productSellType.length > 0 ? filterState.productSellType : undefined,
    whenToSellRange: (filterState.whenToSellRange.min !== null || filterState.whenToSellRange.max !== null) ? filterState.whenToSellRange : undefined,
    howMuchToSellNowRange: (filterState.howMuchToSellNowRange.min !== null || filterState.howMuchToSellNowRange.max !== null) ? filterState.howMuchToSellNowRange : undefined,
    sellRateRange: (filterState.sellRateRange.min !== null || filterState.sellRateRange.max !== null) ? filterState.sellRateRange : undefined,
    lastStockRange: (filterState.lastStockRange.min !== null || filterState.lastStockRange.max !== null) ? filterState.lastStockRange : undefined,
  })
);

export const selectDealerName = (state: RootState) => state.filter.dealerName;

export const selectHasActiveFilters = (state: RootState) => {
  const {
    dealerName,
    productCategory,
    productName,
    variantSku,
    variantSize,
    variantColor,
    generalSearch,
    productSellType,
    whenToSellRange,
    howMuchToSellNowRange,
    sellRateRange,
    lastStockRange
  } = state.filter;

  const hasRangeFilter =
    whenToSellRange.min !== null || whenToSellRange.max !== null ||
    howMuchToSellNowRange.min !== null || howMuchToSellNowRange.max !== null ||
    sellRateRange.min !== null || sellRateRange.max !== null ||
    lastStockRange.min !== null || lastStockRange.max !== null;

  return !!(
    dealerName ||
    productCategory.length > 0 ||
    productName.length > 0 ||
    variantSku.length > 0 ||
    variantSize.length > 0 ||
    variantColor.length > 0 ||
    generalSearch.trim() ||
    productSellType.length > 0 ||
    hasRangeFilter
  );
};

export default filterSlice.reducer;

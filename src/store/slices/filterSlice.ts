import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

interface FilterState {
  dealerName: string | null;
  productCategory: string[];
  productName: string[];
  variantSku: string[];
  variantSize: string[];
  variantColor: string[];
  generalSearch: string;
}

const initialState: FilterState = {
  dealerName: null,
  productCategory: [],
  productName: [],
  variantSku: [],
  variantSize: [],
  variantColor: [],
  generalSearch: '',
};

const filterSlice = createSlice({
  name: 'filter',
  initialState,
  reducers: {
    setDealerName: (state, action: PayloadAction<string | null>) => {
      state.dealerName = action.payload;
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
    resetFilters: (state) => {
      // Reset all except dealer name
      state.productCategory = [];
      state.productName = [];
      state.variantSku = [];
      state.variantSize = [];
      state.variantColor = [];
      state.generalSearch = '';
    },
    resetAllFilters: () => {
      return initialState;
    },
    initializeFilters: (state, action: PayloadAction<Partial<FilterState>>) => {
      return { ...state, ...action.payload };
    },
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
  })
);

export const selectDealerName = (state: RootState) => state.filter.dealerName;

export const selectHasActiveFilters = (state: RootState) => {
  const { dealerName, productCategory, productName, variantSku, variantSize, variantColor, generalSearch } = state.filter;
  return !!(
    dealerName ||
    productCategory.length > 0 ||
    productName.length > 0 ||
    variantSku.length > 0 ||
    variantSize.length > 0 ||
    variantColor.length > 0 ||
    generalSearch.trim()
  );
};

export default filterSlice.reducer;

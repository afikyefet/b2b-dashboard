import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { DashboardDataRow } from '../../types/dashboard.types';
import { getRowId } from '../../utils/rowId';

interface SelectionState {
  selectedRowIds: string[];
}

const initialState: SelectionState = {
  selectedRowIds: [],
};

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    toggleRowSelection: (state, action: PayloadAction<string>) => {
      const rowId = action.payload;
      const index = state.selectedRowIds.indexOf(rowId);
      
      if (index === -1) {
        // Add to selection
        state.selectedRowIds.push(rowId);
      } else {
        // Remove from selection
        state.selectedRowIds.splice(index, 1);
      }
    },
    selectAllRows: (state, action: PayloadAction<string[]>) => {
      state.selectedRowIds = [...action.payload];
    },
    deselectAllRows: (state) => {
      state.selectedRowIds = [];
    },
    clearSelection: (state) => {
      state.selectedRowIds = [];
    },
  },
});

export const { toggleRowSelection, selectAllRows, deselectAllRows, clearSelection } = selectionSlice.actions;

// Selectors
export const selectSelectedRowIds = (state: { selection: SelectionState }) => state.selection.selectedRowIds;

export const isRowSelected = (rowId: string) => (state: { selection: SelectionState }) => 
  state.selection.selectedRowIds.includes(rowId);

// Selector factory to get selected SKUs from data
export const createSelectSelectedSkus = (data: DashboardDataRow[]) => {
  return createSelector(
    [selectSelectedRowIds],
    (selectedRowIds: string[]) => {
      const skus: string[] = [];
      const seenSkus = new Set<string>();
      
      data.forEach((row) => {
        const rowId = getRowId(row);
        if (selectedRowIds.includes(rowId)) {
          const sku = row.variant_sku_real;
          if (sku && !seenSkus.has(sku)) {
            seenSkus.add(sku);
            skus.push(String(sku));
          }
        }
      });
      
      return skus;
    }
  );
};

// Utility function to compute selected SKUs from row IDs and data
export const getSelectedSkusFromData = (selectedRowIds: string[], data: DashboardDataRow[]): string[] => {
  const skus: string[] = [];
  const seenSkus = new Set<string>();
  
  data.forEach((row) => {
    const rowId = getRowId(row);
    if (selectedRowIds.includes(rowId)) {
      const sku = row.variant_sku_real;
      if (sku && !seenSkus.has(sku)) {
        seenSkus.add(sku);
        skus.push(String(sku));
      }
    }
  });
  
  return skus;
};

export default selectionSlice.reducer;


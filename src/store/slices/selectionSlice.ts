import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

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

export default selectionSlice.reducer;


import { configureStore } from '@reduxjs/toolkit';
import selectionReducer from './slices/selectionSlice';
import filterReducer from './slices/filterSlice';

export const store = configureStore({
  reducer: {
    selection: selectionReducer,
    filter: filterReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


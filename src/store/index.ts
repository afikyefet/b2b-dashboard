import { configureStore } from '@reduxjs/toolkit';
import selectionReducer from './slices/selectionSlice';
import filterReducer, { filterPersistMiddleware } from './slices/filterSlice';

export const store = configureStore({
  reducer: {
    selection: selectionReducer,
    filter: filterReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(filterPersistMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Dashboard from './cmps/Dashboard'
import CartPage from './pages/CartPage';
import OrdersList from './pages/OrdersList';
import OrderDetails from './pages/OrderDetails';
import PublicOrderPage from './pages/PublicOrderPage';
import AppHeader from './cmps/AppHeader';
import SelectedSkusSidebar from './cmps/SelectedSkusSidebar';
import LoginPage from './pages/LoginPage';
import { useAuth } from './contexts/AuthContext';
import { loadFiltersFromRedis } from './store/slices/filterSlice';
import type { AppDispatch } from './store';

function AppShell() {
  return (
    <>
      <AppHeader />
      <Outlet />
      <SelectedSkusSidebar />
    </>
  );
}

function RequireAuth() {
  const { status, authDisabled, token } = useAuth();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();

  // Load filters from Redis when authenticated
  useEffect(() => {
    if (authDisabled || token) {
      dispatch(loadFiltersFromRedis());
    }
  }, [authDisabled, token, dispatch]);

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (authDisabled || token) {
    return <Outlet />;
  }

  return <Navigate to="/login" state={{ from: location }} replace />;
}

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/public/order/:token" element={<PublicOrderPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/orders" element={<OrdersList />} />
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App

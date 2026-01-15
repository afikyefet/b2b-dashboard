import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import './styles/App.scss'
import Dashboard from './cmps/Dashboard'
import CartPage from './pages/CartPage';
import OrdersList from './pages/OrdersList';
import OrderDetails from './pages/OrderDetails';
import PublicOrderPage from './pages/PublicOrderPage';
import AppHeader from './cmps/AppHeader';
import LoginPage from './pages/LoginPage';
import { useAuth } from './contexts/AuthContext';

function AppShell() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}

function RequireAuth() {
  const { status, authDisabled, token } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return <div className="auth-loading">Loading...</div>;
  }

  if (authDisabled || token) {
    return <Outlet />;
  }

  return <Navigate to="/login" state={{ from: location }} replace />;
}

function AppLayout() {
  return (
    <div className="app">
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

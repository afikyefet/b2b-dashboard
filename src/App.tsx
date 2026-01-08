import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './styles/App.scss'
import Dashboard from './cmps/Dashboard'
import CartPage from './pages/CartPage';
import OrdersList from './pages/OrdersList';
import OrderDetails from './pages/OrderDetails';
import PublicOrderPage from './pages/PublicOrderPage';
import AppHeader from './cmps/AppHeader';

function AppLayout() {
  const location = useLocation();
  const hideHeader = location.pathname.startsWith('/public/order/');

  return (
    <div className="app">
      {!hideHeader && <AppHeader />}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/orders" element={<OrdersList />} />
        <Route path="/orders/:orderId" element={<OrderDetails />} />
        <Route path="/public/order/:token" element={<PublicOrderPage />} />
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

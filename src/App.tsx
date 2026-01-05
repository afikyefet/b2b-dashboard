import { useState, useEffect } from 'react';
import './styles/App.scss'
import Dashboard from './cmps/Dashboard'
import CartPage from './pages/CartPage';

function App() {
  const [view, setView] = useState<'dashboard' | 'cart'>('dashboard');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#cart') {
        setView('cart');
      } else {
        setView('dashboard');
      }
    };

    // Initial check
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="app">
      {view === 'dashboard' ? (
        <Dashboard />
      ) : (
        <CartPage onBack={() => window.location.hash = ''} />
      )}
    </div>
  )
}

export default App

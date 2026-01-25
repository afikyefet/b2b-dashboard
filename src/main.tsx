import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import { DrawerProvider } from './contexts/DrawerContext'
import { CartProvider } from './contexts/CartContext'
import { AuthProvider } from './contexts/AuthContext'
import { initializeDealerConfig } from './services/dealerConfig.service'
import { initializeStoreCache } from './utils/storeRouting'
import './styles/globals.css'
import App from './App.tsx'

// Initialize dealer configuration early in app lifecycle
Promise.all([
  initializeDealerConfig(),
  initializeStoreCache(),
]).catch((error) => {
  console.error('[main] Failed to initialize dealer config:', error)
  // Continue app initialization even if config fails to load
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <CartProvider>
          <DrawerProvider>
            <App />
          </DrawerProvider>
        </CartProvider>
      </AuthProvider>
    </Provider>
  </StrictMode>,
)

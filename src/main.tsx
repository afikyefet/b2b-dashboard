import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import { DrawerProvider } from './contexts/DrawerContext'
import { CartProvider } from './contexts/CartContext'
import './styles/index.scss'
import App from './App.tsx'
import AppHeader from './cmps/AppHeader.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <CartProvider>
        <DrawerProvider>
          <AppHeader />
          <App />
        </DrawerProvider>
      </CartProvider>
    </Provider>
  </StrictMode>,
)

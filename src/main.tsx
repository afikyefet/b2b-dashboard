import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.scss'
import App from './App.tsx'
import AppHeader from './cmps/AppHeader.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppHeader />
    <App />
  </StrictMode>,
)

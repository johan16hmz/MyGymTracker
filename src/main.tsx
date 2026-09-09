import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './ui.css'

try { document.documentElement.dataset.theme = localStorage.getItem('mygymtracker-theme') === 'dark' ? 'dark' : 'light'; } catch { /* Use the default theme. */ }

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/App.tsx'

// Suppress the default browser context menu globally.
// Components that need a custom menu (e.g. SongRow) render their own via React state.
document.addEventListener("contextmenu", (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/App.tsx'

// Suppress the default browser context menu globally in production builds.
// Exempt editable targets so right-click → paste works in inputs/textareas.
// Components that need a custom menu (e.g. SongRow) render their own via React state.
if (import.meta.env.PROD) {
  document.addEventListener("contextmenu", (e) => {
    const tag = (e.target as HTMLElement).tagName
    const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable
    if (!isEditable) {
      e.preventDefault()
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

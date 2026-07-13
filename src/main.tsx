import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/config'
import App from './App.tsx'
import './styles/tokens.css'
import './styles/group-pill.css'
import './styles/global.css'
import './styles/layout.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../i18n/config'
import { AdminApp } from '../apps/admin/AdminApp'
import '../styles/tokens.css'
import '../styles/card.css'
import '../styles/data-table.css'
import '../styles/form-fields.css'
import '../styles/global.css'
import '../styles/layout.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../i18n/config'
import { CustomerApp } from '../apps/customer/CustomerApp'
import '../styles/tokens.css'
import '../styles/group-pill.css'
import '../styles/card.css'
import '../styles/data-table.css'
import '../styles/form-fields.css'
import '../styles/global.css'
import '../styles/panel-chrome.css'
import '../styles/support-rail.css'
import '../styles/layout.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomerApp />
  </StrictMode>,
)

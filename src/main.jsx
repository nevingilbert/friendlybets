// First import on purpose: it reads any OAuth error out of the redirect URL
// before the router or supabase-js rewrites it.
import './lib/authError'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

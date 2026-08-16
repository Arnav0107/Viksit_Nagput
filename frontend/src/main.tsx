import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ComplaintForm } from './components/ComplaintForm.tsx'

const pathname = window.location.pathname.toLowerCase();
const isComplaintRoute = pathname === '/complaint' || pathname === '/complaint/' || pathname.startsWith('/complaint/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isComplaintRoute ? <ComplaintForm /> : <App />}
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { VibeCheckDevtools } from './VibeCheckDevtools'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <VibeCheckDevtools />
  </StrictMode>,
)

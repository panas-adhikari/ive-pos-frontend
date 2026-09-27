import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthBoundary } from './auth'
import { queryClient } from './api-cache'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthBoundary><App /></AuthBoundary>
    </QueryClientProvider>
  </StrictMode>,
)

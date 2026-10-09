import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import PublicEntry from './public/PublicEntry'
import { queryClient } from './api-cache'

export default function ApplicationEntry() {
  return <QueryClientProvider client={queryClient}><PublicEntry><App /></PublicEntry></QueryClientProvider>
}

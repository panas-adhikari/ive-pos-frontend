import { QueryClient } from '@tanstack/react-query'

export const cacheTime = {
  identity: 60_000,
  data: 5 * 60_000,
  capabilities: 30 * 60_000,
  inactive: 60 * 60_000,
} as const

// React Query is the application's shared API state store. Data remains fresh until its
// stale time expires; explicit refetches and mutation invalidations bypass that window.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: cacheTime.data,
      refetchInterval: cacheTime.data,
      gcTime: cacheTime.inactive,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: false,
    },
  },
})

queryClient.setQueryDefaults(['identity'], {
  staleTime: cacheTime.identity,
  refetchInterval: cacheTime.identity,
})
queryClient.setQueryDefaults(['auth-capabilities'], {
  staleTime: cacheTime.capabilities,
  refetchInterval: cacheTime.capabilities,
})

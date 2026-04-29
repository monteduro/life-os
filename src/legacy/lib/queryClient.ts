import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,         // 5 minuti: dati "freschi" senza refetch
      gcTime: 10 * 60 * 1000,           // 10 minuti: dati in cache dopo unmount
      refetchOnWindowFocus: false,      // Non refetch al focus finestra
      retry: 1,                         // Un solo retry in caso di errore
    },
    mutations: {
      retry: 0,
    },
  },
})

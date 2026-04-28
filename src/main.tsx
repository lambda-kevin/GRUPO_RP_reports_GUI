import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Consider data fresh for 5 min — avoids refetch on tab focus / navigation
      staleTime: 5 * 60 * 1000,
      // Keep unused data in memory for 15 min (faster back-navigation)
      gcTime: 15 * 60 * 1000,
      // Show previous data while new data loads — no spinner on filter changes
      placeholderData: keepPreviousData,
    },
  },
})

export { queryClient }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)

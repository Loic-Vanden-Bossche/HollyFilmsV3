import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { completeGoogleRedirect } from './account-api.ts'
import { ArtworkHeroProvider } from './ui/ArtworkHero.tsx'

const queryClient = new QueryClient()
const googleReturn = completeGoogleRedirect()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ArtworkHeroProvider>
        <App googleReturn={googleReturn} />
      </ArtworkHeroProvider>
    </QueryClientProvider>
  </StrictMode>,
)

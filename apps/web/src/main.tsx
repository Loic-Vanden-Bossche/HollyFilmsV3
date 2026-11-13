import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { completeGoogleRedirect } from './account-api.ts'
import { ArtworkHeroProvider } from './ui/ArtworkHero.tsx'
import { TooltipProvider } from './ui/Tooltip.tsx'
import { I18nProvider } from './i18n/I18nProvider.tsx'

const queryClient = new QueryClient()
const googleReturn = completeGoogleRedirect()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ArtworkHeroProvider>
        <TooltipProvider>
          <I18nProvider>
            <App googleReturn={googleReturn} />
          </I18nProvider>
        </TooltipProvider>
      </ArtworkHeroProvider>
    </QueryClientProvider>
  </StrictMode>,
)

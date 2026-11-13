import { useI18n } from '../i18n/I18nProvider.tsx'
import { motion, useReducedMotion } from 'motion/react'
import { Search, RotateCcw } from 'lucide-react'
import type { ComponentProps } from 'react'
import { VirtualMediaGrid, CatalogueLoadTrigger } from './VirtualMediaGrid.tsx'

export type SearchPageData = {
  items: ComponentProps<typeof VirtualMediaGrid>['items']
  total: number
  state: 'loading' | 'ready' | 'error'
  hasMore?: boolean
  loadingMore?: boolean
  loadMoreError?: boolean
  onLoadMore: () => void
  onRetry: () => void
}

export function SearchResults({
  query,
  results,
  paused,
  ...tileProps
}: Omit<ComponentProps<typeof VirtualMediaGrid>, 'items' | 'total'> & {
  query: string
  results: SearchPageData
  paused: boolean
}) {
  const { t } = useI18n()
  const reduced = useReducedMotion()
  const {
    items,
    state,
    total,
    hasMore,
    loadingMore,
    loadMoreError,
    onLoadMore,
    onRetry,
  } = results
  const searching = Boolean(query.trim())
  return (
    <section
      id="home-search-results"
      className="home-content home-search-view"
      aria-label={t('Résultats de recherche')}
      aria-busy={state === 'loading'}
    >
      <motion.div
        className="home-section-header"
        initial={{ opacity: 0, y: reduced ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.3 }}
      >
        <div>
          <p className="home-section-kicker">
            {searching ? t('DANS VOTRE BIBLIOTHÈQUE') : t('À EXPLORER')}
          </p>
          <h2>
            {searching ? t('Résultats') : t('Les ajouts récents')}
            {state === 'ready' && searching && <span>{total}</span>}
          </h2>
        </div>
        <p className="home-sort" role="status" aria-live="polite">
          {state === 'loading'
            ? t('Recherche en cours…')
            : state === 'error'
              ? ''
              : searching
                ? t(total === 1 ? '{count} titre' : '{count} titres', {
                    count: total,
                  })
                : t('Un titre vous tente ?')}
        </p>
      </motion.div>
      <motion.div
        key={query.trim() + ':' + state}
        initial={{ opacity: reduced ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.22 }}
      >
        {state === 'loading' ? (
          <div className="home-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="home-skeleton" />
            ))}
          </div>
        ) : state === 'error' ? (
          <div className="home-empty" role="alert">
            <Search size={28} />
            <h3>{t('La recherche est indisponible.')}</h3>
            <p>{t('Réessayez dans un instant.')}</p>
            <button className="home-primary" onClick={onRetry}>
              {t('Réessayer')}
              <RotateCcw size={16} />
            </button>
          </div>
        ) : items.length ? (
          <>
            <VirtualMediaGrid {...tileProps} items={items} total={total} />
            {searching && (
              <CatalogueLoadTrigger
                count={items.length}
                hasMore={hasMore}
                loading={loadingMore}
                error={loadMoreError}
                paused={paused}
                onLoadMore={onLoadMore}
              />
            )}
            {loadMoreError && (
              <p className="home-inline-error" role="alert">
                {t('La suite des résultats n’a pas pu être chargée.')}
              </p>
            )}
            {searching && hasMore && (
              <button
                className="home-more glass-control"
                onClick={onLoadMore}
                disabled={loadingMore}
              >
                {loadingMore
                  ? t('Chargement…')
                  : loadMoreError
                    ? t('Réessayer')
                    : t('Afficher plus de résultats')}
              </button>
            )}
          </>
        ) : (
          <div className="search-idle">
            <Search size={30} />
            <h2>
              {searching
                ? t('Aucun titre trouvé.')
                : t('Quel film ou quelle série ?')}
            </h2>
            <p>
              {searching
                ? t('Essayez un autre titre ou quelques mots plus courts.')
                : t('Saisissez un titre pour parcourir votre bibliothèque.')}
            </p>
          </div>
        )}
      </motion.div>
    </section>
  )
}

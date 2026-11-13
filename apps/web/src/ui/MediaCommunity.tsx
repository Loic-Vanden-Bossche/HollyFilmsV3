import { localizeError } from '../i18n/api-messages.ts'
import { localizeText } from '../i18n/messages.ts'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from './Tooltip.tsx'
import { Select } from './Select.tsx'
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ChevronDown,
  ExternalLink,
  MessageSquarePlus,
  Search,
  Settings2,
  Star,
  Trash2,
} from 'lucide-react'
import type {
  ReviewPage,
  WatchProviders,
  MediaReview,
} from '@hollyfilms/shared/media-details'
import { safeExternalUrl } from '@hollyfilms/shared/media-details'
import { MediaRail } from './MediaRail.tsx'

export type MediaCommunityProps = {
  providers?: WatchProviders
  providerLoading?: boolean
  providerError?: boolean
  onRetryProviders?: () => void
  reviews?: ReviewPage
  reviewsLoading?: boolean
  reviewsError?: boolean
  onRetryReviews?: () => void
  region: string
  onRegion: (region: string) => void
  page: number
  onPage: (page: number) => void
  onSave?: (content: string, rating: number | null) => Promise<void>
  onDelete?: () => Promise<void>
}
export function MediaCommunity({
  providers,
  providerLoading,
  providerError,
  onRetryProviders,
  reviews,
  reviewsLoading,
  reviewsError,
  onRetryReviews,
  region,
  onRegion,
  page,
  onPage,
  onSave,
  onDelete,
}: MediaCommunityProps) {
  const { t, locale } = useI18n()
  const reduced = useReducedMotion()
  const [settings, setSettings] = useState(false),
    [searching, setSearching] = useState(false),
    [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false),
    [editing, setEditing] = useState(false),
    [content, setContent] = useState(''),
    [rating, setRating] = useState('')
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<Error>(),
    [saved, setSaved] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false)
  const countries = new Intl.DisplayNames(locale, { type: 'region' })
  const regionName = countries.of(region) ?? region
  const openEditor = () => {
    setContent(reviews?.own?.content ?? '')
    setRating(reviews?.own?.rating?.toString() ?? '')
    setEditing(true)
    setSaved('')
    setError(undefined)
  }
  async function save(remove = false) {
    setSaving(true)
    setError(undefined)
    try {
      if (remove) await onDelete?.()
      else await onSave?.(content, rating === '' ? null : Number(rating))
      setEditing(false)
      setConfirmDelete(false)
      setSaved(
        remove ? 'Ton avis a été supprimé.' : 'Ton avis a été enregistré.',
      )
    } catch (e) {
      setError(e instanceof Error ? e : new Error())
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <section
        id="detail-providers"
        className="detail-provider-panel"
        aria-labelledby="detail-provider-title"
      >
        <div className="detail-section-heading">
          <div>
            <p className="home-eyebrow">{t('Ailleurs aussi')}</p>
            <h3 id="detail-provider-title">
              {t('Disponible en {region}', { region: regionName })}
            </h3>
          </div>
          <div className="detail-rail-controls">
            <Tooltip>
              <button
                className="glass-control"
                aria-label={t('Rechercher une plateforme')}
                aria-expanded={searching}
                onClick={() => setSearching(!searching)}
              >
                <Search size={18} />
              </button>
            </Tooltip>
            <Tooltip>
              <button
                className="glass-control"
                aria-label={t('Paramètres des disponibilités')}
                aria-expanded={settings}
                onClick={() => setSettings(!settings)}
              >
                <Settings2 size={18} />
              </button>
            </Tooltip>
          </div>
        </div>
        {settings && (
          <label className="detail-field">
            {t('Pays des disponibilités')}
            <Select
              aria-label={t('Pays des disponibilités')}
              value={region}
              onValueChange={(value) => onRegion(value)}
            >
              {[
                ...new Set([
                  'FR',
                  'CH',
                  'BE',
                  'CA',
                  'US',
                  'GB',
                  ...(providers?.regions ?? []),
                ]),
              ]
                .sort((a, b) =>
                  (countries.of(a) ?? a).localeCompare(
                    countries.of(b) ?? b,
                    'fr',
                  ),
                )
                .map((code) => (
                  <option key={code} value={code}>
                    {countries.of(code)}
                  </option>
                ))}
            </Select>
          </label>
        )}
        {searching && (
          <label className="detail-field">
            {t('Rechercher une plateforme')}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Netflix, Prime Video…')}
            />
          </label>
        )}
        {providerLoading ? (
          <p className="detail-status" role="status">
            {t('Recherche des disponibilités…')}
          </p>
        ) : providerError ? (
          <p className="detail-status" role="alert">
            {t('Impossible de charger les plateformes.')}{' '}
            <button onClick={onRetryProviders}>{t('Réessayer')}</button>
          </p>
        ) : providers?.status === 'unconfigured' ? (
          <p className="detail-status">
            {t(
              'Les disponibilités seront accessibles après l’activation de TMDB par l’administrateur.',
            )}
          </p>
        ) : providers?.status === 'unmatched' ? (
          <p className="detail-status">
            {t('Aucune correspondance TMDB n’est renseignée pour ce titre.')}
          </p>
        ) : (
          <>
            <div className="detail-providers">
              {providers?.providers
                .filter(
                  (p) =>
                    !searching ||
                    p.name
                      .toLocaleLowerCase()
                      .includes(search.toLocaleLowerCase()),
                )
                .map((p) => (
                  <a
                    key={p.id}
                    className="detail-provider"
                    href={safeExternalUrl(providers.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.logo ? (
                      <img src={p.logo} alt="" loading="lazy" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="detail-provider-placeholder"
                      >
                        {p.name.slice(0, 1)}
                      </span>
                    )}
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.offers.join(' · ')}</small>
                    </span>
                    <ExternalLink size={13} />
                  </a>
                ))}
            </div>
            {!providers?.providers.length && (
              <p className="detail-status">
                {t('Aucune offre renseignée dans ce pays.')}
              </p>
            )}
            {searching &&
              !!providers?.providers.length &&
              !providers.providers.some((p) =>
                p.name.toLowerCase().includes(search.toLowerCase()),
              ) && (
                <p className="detail-status">
                  {t('Aucune plateforme ne correspond à cette recherche.')}
                </p>
              )}
          </>
        )}
        <p className="detail-attribution">
          {t('Disponibilités :')}{' '}
          <a
            href="https://www.justwatch.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            JustWatch
          </a>{' '}
          {t('via')}{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            TMDB
          </a>
          {t('. Les liens ouvrent les offres du titre, selon le pays.')}
        </p>
      </section>
      <section
        id="detail-reviews"
        className="detail-reviews"
        aria-labelledby="detail-reviews-title"
      >
        <div className="detail-section-heading">
          <h3 id="detail-reviews-title">
            {t('Critiques')} <span>{reviews?.total ?? '—'}</span>
          </h3>
          <Tooltip>
            <button
              className="glass-control"
              aria-label={
                collapsed
                  ? t('Afficher les critiques')
                  : t('Replier les critiques')
              }
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronDown
                size={18}
                style={{
                  transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                }}
              />
            </button>
          </Tooltip>
        </div>
        {!collapsed && (
          <>
            {onSave && (
              <button
                className="detail-write glass-control"
                onClick={openEditor}
              >
                <MessageSquarePlus size={17} />
                {reviews?.own
                  ? t('Modifier ma critique')
                  : t('Écrire une critique')}
              </button>
            )}
            <AnimatePresence initial={false}>
              {editing && (
                <motion.form
                  className="detail-review-editor"
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onSubmit={(e) => {
                    e.preventDefault()
                    void save()
                  }}
                >
                  <label className="detail-field">
                    {t('Ta note sur 10')}
                    <Select
                      aria-label={t('Ta note sur 10')}
                      value={rating}
                      onValueChange={(value) => setRating(value)}
                      disabled={saving}
                    >
                      <option value="">{t('Sans note')}</option>
                      {Array.from({ length: 21 }, (_, i) => i / 2).map((n) => (
                        <option key={n} value={n}>
                          {n} / 10
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="detail-field">
                    {t('Ta critique')}
                    <textarea
                      rows={5}
                      maxLength={10000}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      disabled={saving}
                      placeholder={t('Ton avis sur ce titre…')}
                    />
                  </label>
                  <p className="detail-status">
                    {content.length.toLocaleString(locale)}{' '}
                    {t(
                      '/ 10 000 caractères · Visible par les membres ayant accès à ce titre.',
                    )}
                  </p>
                  <div className="detail-editor-actions">
                    <button
                      type="submit"
                      className="home-primary"
                      disabled={saving || (!content.trim() && rating === '')}
                    >
                      {saving ? t('Enregistrement…') : t('Enregistrer')}
                    </button>
                    <button
                      type="button"
                      className="glass-control"
                      disabled={saving}
                      onClick={() => setEditing(false)}
                    >
                      {t('Annuler')}
                    </button>
                    {reviews?.own && onDelete && (
                      <button
                        type="button"
                        className="glass-control"
                        disabled={saving}
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 size={15} />
                        {t('Supprimer mon avis')}
                      </button>
                    )}
                  </div>
                  {confirmDelete && (
                    <div className="detail-delete-confirm">
                      <p>{t('Supprimer définitivement ton avis ?')}</p>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void save(true)}
                      >
                        {t('Oui, supprimer')}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setConfirmDelete(false)}
                      >
                        {t('Conserver')}
                      </button>
                    </div>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
            {error && (
              <p role="alert" className="detail-error">
                {localizeError(
                  t,
                  error,
                  'Impossible d’enregistrer ton avis. Réessaie.',
                )}
              </p>
            )}
            {saved && (
              <p role="status" className="detail-success">
                {localizeText(t, saved)}
              </p>
            )}
            {reviewsLoading ? (
              <p className="detail-status" role="status">
                {t('Chargement des critiques…')}
              </p>
            ) : reviewsError ? (
              <p role="alert" className="detail-status">
                {t('Impossible de charger les critiques.')}{' '}
                <button onClick={onRetryReviews}>{t('Réessayer')}</button>
              </p>
            ) : (
              <>
                {!!reviews?.items.length && (
                  <MediaRail title={t('Les avis')} kind="review">
                    {reviews.items.map((review) => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                  </MediaRail>
                )}
                {!reviews?.items.length && (
                  <p className="detail-status">
                    {t('Aucune critique pour le moment.')}
                  </p>
                )}
                {reviews?.external === 'unavailable' && (
                  <p role="status" className="detail-status">
                    {t('Les critiques TMDB sont momentanément indisponibles.')}{' '}
                    <button onClick={onRetryReviews}>{t('Réessayer')}</button>
                  </p>
                )}
                {reviews?.external === 'unconfigured' && (
                  <p className="detail-status">
                    {t(
                      'Les avis des membres sont disponibles. L’ajout des critiques TMDB nécessite l’activation du service par l’administrateur.',
                    )}
                  </p>
                )}
                {(page > 1 || reviews?.hasMore) && (
                  <div className="detail-review-pagination">
                    <button
                      className="glass-control"
                      disabled={page === 1}
                      onClick={() => onPage(page - 1)}
                    >
                      {t('Précédent')}
                    </button>
                    <span>{t('Page {page}', { page })}</span>
                    <button
                      className="glass-control"
                      disabled={!reviews?.hasMore}
                      onClick={() => onPage(page + 1)}
                    >
                      {t('Suivant')}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>
    </>
  )
}
function ReviewCard({ review }: { review: MediaReview }) {
  const { t, locale } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const date = new Date(review.date)
  return (
    <article className="detail-review-card">
      <header>
        <strong>
          {review.author}
          {review.own && <small>{t('Ton avis')}</small>}
        </strong>
        {review.rating != null && (
          <span className="detail-review-rating">
            <Star size={17} fill="currentColor" />
            {review.rating}
            <small>/10</small>
          </span>
        )}
      </header>
      <p className="detail-review-source">
        {!Number.isNaN(date.getTime()) &&
          date.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}{' '}
        ·{' '}
        {safeExternalUrl(review.url) ? (
          <a href={review.url} target="_blank" rel="noopener noreferrer">
            {review.source}
            <ExternalLink size={12} />
          </a>
        ) : (
          review.source
        )}
      </p>
      <p className="detail-review-content">
        {expanded ? review.content : review.content.slice(0, 440)}
        {!expanded && review.content.length > 440 ? '…' : ''}
      </p>
      {review.content.length > 440 && (
        <button
          className="detail-text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t('Réduire') : t('Lire la suite')}
        </button>
      )}
    </article>
  )
}

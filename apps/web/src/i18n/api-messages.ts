import { localizeText, type Message, type Translate } from './messages.ts'

export const apiMessages = {
  AUTH_REQUIRED: 'Reconnecte-toi pour continuer.',
  ACCESS_DENIED: 'Tu n’as pas accès à cette ressource.',
  PREFERENCES_DISABLED:
    'La modification du profil est désactivée par l’administrateur.',
  INVALID_PROFILE:
    'Vérifie les informations du profil et le mot de passe actuel.',
  PROFILE_UNAVAILABLE: 'Impossible de charger le profil.',
  INVALID_IMAGE: 'Choisis une image JPG, PNG ou WebP de moins de 2 Mo.',
  GOOGLE_PASSWORD: 'Le mot de passe de ce compte est géré par Google.',
  PASSWORD_REQUIRED: 'Un compte administrateur doit conserver un mot de passe.',
  TMDB_UNAVAILABLE: 'TMDB est temporairement indisponible.',
  MEDIA_NOT_FOUND: 'Ce média est indisponible ou tu n’y as pas accès.',
  POSTER_NOT_FOUND: 'Affiche indisponible.',
  JELLYFIN_UNAVAILABLE: 'Impossible de joindre le serveur.',
  EMPTY_REVIEW: 'Ajoute un texte ou une note.',
  INVALID_ORIGIN: 'Origine de requête invalide.',
  INVALID_INPUT: 'Vérifie les informations saisies.',
  INVALID_REQUEST: 'La requête est invalide.',
  RATE_LIMIT: 'Trop de tentatives. Réessaie dans un instant.',
  UNAVAILABLE:
    'HollyFilms est temporairement indisponible. Réessaie dans un instant.',
  ADMIN_REQUIRED: 'Un compte administrateur est requis.',
  INVALID_CREDENTIALS: 'Vérifie ton nom d’utilisateur et ton mot de passe.',
  USERNAME_UNAVAILABLE: 'Ce nom d’utilisateur est indisponible.',
  IN_PROGRESS: 'Une opération est déjà en cours. Réessaie dans un instant.',
  NOT_FOUND: 'Demande introuvable.',
  GOOGLE_DISABLED: 'La connexion Google est indisponible.',
  GOOGLE_EXPIRED: 'La connexion Google a expiré. Réessaie.',
  ALREADY_REJECTED: 'Cette demande a déjà été refusée.',
  PROVISIONING_FAILED: 'La création du compte a échoué. Réessaie.',
  ALREADY_APPROVED: 'La création du compte a déjà commencé.',
} satisfies Record<string, Message>

export function apiMessage(code: unknown): Message | undefined {
  return typeof code === 'string' && Object.hasOwn(apiMessages, code)
    ? apiMessages[code as keyof typeof apiMessages]
    : undefined
}

export function localizeError(t: Translate, error: unknown, fallback: Message) {
  if (!(error instanceof Error)) return t(fallback)
  const message = apiMessage(error.cause)
  return message ? t(message) : localizeText(t, error.message, fallback)
}

import type { HomeShelf } from './home-shelves.ts'
import { localizeText, type Translate } from './i18n/messages.ts'

export function homeShelfTitle(t: Translate, shelf: HomeShelf) {
  if (shelf.genre)
    return t(shelf.title, { genre: localizeText(t, shelf.genre) })
  if (shelf.decade !== undefined)
    return t(shelf.title, { decade: String(shelf.decade) })
  return t(shelf.title)
}

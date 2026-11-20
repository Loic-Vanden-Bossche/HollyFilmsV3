import { createContext, useContext } from 'react'
import type { LibraryImage } from '@hollyfilms/shared/library'

import { holdRouteRender } from '../use-app-route.ts'

export const ArtworkRoutes = createContext(false)
export const artworkActivated = 'hollyfilms:artwork-activate'
export const restoringArtworkFocus = new WeakSet<Element>()
export type ArtworkNavigation = (
  control: HTMLElement,
  destination: 'details' | 'player',
  update: () => void,
) => void

type ArtworkRegistry = {
  navigate: (
    control: HTMLElement,
    destination: 'details' | 'player',
    update: () => void,
    begin?: () => () => void,
  ) => void
  returnToOrigin: (dialog: HTMLDialogElement, update: () => void) => void
}

export const ArtworkHeroContext = createContext<ArtworkRegistry | null>(null)

export function useArtworkNavigation(): ArtworkNavigation {
  const hero = useContext(ArtworkHeroContext)
  const routed = useContext(ArtworkRoutes)
  return (control, destination, update) => {
    const activate = () => {
      control.dispatchEvent(new Event(artworkActivated, { bubbles: true }))
      update()
    }
    if (hero && routed) {
      hero.navigate(
        control,
        destination,
        () =>
          control.dispatchEvent(new Event(artworkActivated, { bubbles: true })),
        () => holdRouteRender(update),
      )
    } else if (hero) hero.navigate(control, destination, activate)
    else activate()
  }
}

export function artworkIdentity(source?: LibraryImage | string) {
  return typeof source === 'string'
    ? source
    : source
      ? `${source.itemId}/${source.type}/${source.tag}${source.index == null ? '' : '/' + source.index}`
      : undefined
}

import { createContext, useContext, useLayoutEffect } from 'react'
import type { RefObject } from 'react'
import type { LibraryImage } from '@hollyfilms/shared/library'

export type ArtworkEntry = { key: string; element: HTMLElement; blob?: Blob }
export type ArtworkRegistry = {
  add: (entry: ArtworkEntry) => () => void
  update: (element: HTMLElement, blob?: Blob) => void
}
export const ArtworkHeroContext = createContext<ArtworkRegistry | null>(null)

// The server asset is stable across thumbnail sizes and authenticated blob URLs.
export function artworkIdentity(source?: LibraryImage | string) {
  return typeof source === 'string'
    ? source
    : source
      ? `${source.itemId}/${source.type}/${source.tag}${source.index == null ? '' : '/' + source.index}`
      : undefined
}

export function useArtworkHero(
  ref: RefObject<HTMLDivElement | null>,
  source: LibraryImage | string | undefined,
  blob?: Blob,
) {
  const registry = useContext(ArtworkHeroContext)
  const key = artworkIdentity(source)
  useLayoutEffect(() => {
    if (!key || !ref.current || !registry) return
    return registry.add({ key, element: ref.current })
  }, [registry, key, ref])
  useLayoutEffect(() => {
    if (ref.current) registry?.update(ref.current, blob)
  }, [registry, ref, blob])
}

import { useId, type ReactNode } from 'react'

/** Both the tile and its detail content render into this movable DOM node.
 * The slot stays in the rail while the native dialog owns the frame. */
export function ArtworkCardFrame({ children }: { children: ReactNode }) {
  const id = useId()
  return (
    <div className="artwork-card-slot">
      <div className="artwork-card-frame" id={id}>
        {children}
      </div>
    </div>
  )
}

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type { LibraryImage } from '@hollyfilms/shared/library'
import { MediaArtwork } from './MediaArtwork.tsx'
import '../player.css'

export function PlayerArtwork({
  source,
  session,
  visible,
}: {
  source?: LibraryImage | string
  session?: JellyfinSession
  visible: boolean
}) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="player-artwork-hero"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0.12 : 0.45 } }}
          transition={{ duration: reduced ? 0 : 0.35 }}
        >
          <div className="player-artwork-camera">
            <MediaArtwork
              source={source}
              session={session}
              width={3840}
              eager
              className="player-artwork"
            />
          </div>
          <div className="player-artwork-shade" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

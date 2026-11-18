import { AnimatePresence, motion } from 'motion/react'
import { useMotionPolicy } from '../components/reactbits/policy.ts'
import { duration, ease } from '../motion/tokens.ts'
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
  const { reduced, pageVisible } = useMotionPolicy()
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="player-artwork-hero"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: reduced ? 0 : duration.press },
          }}
          transition={{
            duration: reduced ? 0 : duration.micro,
            ease: ease.out,
          }}
        >
          <div
            className="player-artwork-camera"
            data-motion={reduced ? 'reduced' : 'full'}
            style={{ animationPlayState: pageVisible ? 'running' : 'paused' }}
          >
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

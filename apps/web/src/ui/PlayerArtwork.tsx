import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useMotionPolicy } from '../components/reactbits/policy.ts'
import { duration, ease } from '../motion/tokens.ts'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type { LibraryImage } from '@hollyfilms/shared/library'
import { MediaArtwork } from './MediaArtwork.tsx'
import { PlayerProjectionSurface } from './PlayerProjectionSurface.tsx'
import { useBackdropWidth } from './use-backdrop-width.ts'
import '../player.css'

export function PlayerArtwork({
  source,
  session,
  visible,
  remote = false,
}: {
  source?: LibraryImage | string
  session?: JellyfinSession
  visible: boolean
  remote?: boolean
}) {
  const { reduced, pageVisible } = useMotionPolicy()
  const width = useBackdropWidth()
  const [sharedEntrance] = useState(
    () => document.documentElement.dataset.artworkDestination === 'player',
  )
  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="player-artwork-hero"
            aria-hidden="true"
            initial={sharedEntrance ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: {
                duration: reduced || sharedEntrance ? 0 : duration.press,
              },
            }}
            transition={{
              duration: reduced ? 0 : duration.micro,
              ease: ease.out,
            }}
          >
            <div
              className="player-artwork-camera"
              data-motion={reduced || sharedEntrance ? 'reduced' : 'full'}
              style={{ animationPlayState: pageVisible ? 'running' : 'paused' }}
            >
              <MediaArtwork
                source={source}
                session={session}
                width={width}
                reveal="shared"
                eager
                className="player-artwork"
              />
            </div>
            <div className="player-artwork-shade" />
          </motion.div>
        )}
      </AnimatePresence>
      <PlayerProjectionSurface cancelled={remote} />
    </>
  )
}

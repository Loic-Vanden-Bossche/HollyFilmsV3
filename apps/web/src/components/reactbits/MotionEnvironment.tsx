import { useContext, type ReactNode } from 'react'
import { Paused } from './policy.ts'
export function MotionEnvironment({
  paused,
  children,
}: {
  paused: boolean
  children: ReactNode
}) {
  const inherited = useContext(Paused)
  return <Paused value={inherited || paused}>{children}</Paused>
}

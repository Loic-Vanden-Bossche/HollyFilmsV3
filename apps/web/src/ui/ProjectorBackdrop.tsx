import './projector-backdrop.css'
import { Atmosphere } from '../components/reactbits/Atmosphere.tsx'
export function ProjectorBackdrop({
  paused = false,
  enabled = true,
}: {
  paused?: boolean
  enabled?: boolean
}) {
  return (
    <div className="projector-backdrop" aria-hidden="true">
      <Atmosphere kind="rays" paused={paused || !enabled} />
    </div>
  )
}

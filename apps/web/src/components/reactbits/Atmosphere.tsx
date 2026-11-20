import { lazy, Suspense } from 'react'
import { cinemaMotion, useEffectActivity } from './policy.ts'
import './effects.css'
const Aurora = lazy(() => import('./Aurora.tsx'))
const LightRays = lazy(() => import('./LightRays.tsx'))
export function Atmosphere({
  kind,
  paused = false,
}: {
  kind: 'aurora' | 'rays'
  paused?: boolean
}) {
  const { ref, running, fine, profile } = useEffectActivity(paused)
  const rendering = running && profile.shaders
  return (
    <div
      ref={ref}
      className={`rb-atmosphere rb-atmosphere-${kind}`}
      data-motion={rendering ? 'running' : 'paused'}
      aria-hidden="true"
    >
      <div className="rb-atmosphere-fallback" />
      {rendering && (
        <Suspense fallback={null}>
          {kind === 'aurora' ? (
            <Aurora
              colorStops={cinemaMotion.atmosphereColors}
              speed={0.28}
              amplitude={0.8}
              height={0.45}
              brightness={0.65}
              glow={0.25}
              opacity={0.55}
              intro={false}
              dpr={profile.dpr}
              mouseInteraction={fine}
            />
          ) : (
            <LightRays
              raysOrigin="top-right"
              raysColor="#7dded8"
              raysSpeed={0.35}
              lightSpread={0.65}
              rayLength={1.8}
              intensity={0.85}
              haze={0.3}
              glow={0.25}
              followMouse={fine}
              mouseInfluence={0.08}
              cursorShadow={false}
              clickPulse={false}
              intro={false}
              maxDevicePixelRatio={profile.dpr}
            />
          )}
        </Suspense>
      )}
    </div>
  )
}

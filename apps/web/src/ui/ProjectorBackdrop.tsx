import { useEffect, useRef } from 'react'
import type { ShaderMount } from '@paper-design/shaders'
import './projector-backdrop.css'

// God Rays palette matches the navy / green-400 / blue-500 theme.
const rayColors = ['#4ade80', '#7dded8', '#3b82f6']

export function ProjectorBackdrop({
  paused = false,
  enabled = true,
}: {
  paused?: boolean
  enabled?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const shader = useRef<ShaderMount | null>(null)
  const stopped = useRef(paused)

  useEffect(() => {
    stopped.current = paused
    shader.current?.setSpeed(paused ? 0 : 0.28)
  }, [paused])

  useEffect(() => {
    const element = host.current!
    let cancelled = false
    element.dataset.renderer = 'fallback'
    if (!enabled) return

    const dispose = () => {
      shader.current?.dispose()
      shader.current = null
      element.replaceChildren()
      element.dataset.renderer = 'fallback'
    }
    const lost = (event: Event) => {
      event.preventDefault()
      dispose()
    }
    element.addEventListener('webglcontextlost', lost, true)

    async function mount() {
      try {
        const {
          ShaderMount,
          godRaysFragmentShader,
          getShaderColorFromString,
          getShaderNoiseTexture,
        } = await import('@paper-design/shaders')
        const noise = getShaderNoiseTexture()
        if (noise) await noise.decode()
        if (cancelled) return
        shader.current = new ShaderMount(
          element,
          godRaysFragmentShader,
          {
            u_colorBack: getShaderColorFromString('#080f1b'),
            u_colorBloom: getShaderColorFromString('#3b82f6'),
            u_colors: rayColors.map(getShaderColorFromString),
            u_colorsCount: rayColors.length,
            u_noiseTexture: noise,
            u_density: 0.24,
            u_spotty: 0.18,
            u_midIntensity: 0.12,
            u_midSize: 0.18,
            u_intensity: 0.65,
            u_bloom: 0.12,
            u_fit: 2,
            u_scale: 1,
            u_rotation: -18,
            u_offsetX: -0.62,
            u_offsetY: -0.65,
            u_originX: 0.5,
            u_originY: 0.5,
            u_worldWidth: 0,
            u_worldHeight: 0,
          },
          { alpha: false, powerPreference: 'low-power' },
          stopped.current ? 0 : 0.28,
          12000,
          1,
          1_500_000,
        )
        element.dataset.renderer = 'webgl'
      } catch {
        // Keep the static beam if the GPU, texture decoding or shader chunk is unavailable.
        if (!cancelled) dispose()
      }
    }
    void mount()
    return () => {
      cancelled = true
      element.removeEventListener('webglcontextlost', lost, true)
      dispose()
    }
  }, [enabled])

  return (
    <div className="projector-backdrop" aria-hidden="true">
      <div ref={host} className="projector-shader" />
      <div className="projector-shade" />
    </div>
  )
}

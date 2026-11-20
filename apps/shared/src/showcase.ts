export const showcasePosterWidths = [160, 240, 320, 400] as const

export type ShowcaseItem = {
  id: string
  title: string
  year: number | null
  kind: 'Film' | 'Série'
  poster: string | null
}

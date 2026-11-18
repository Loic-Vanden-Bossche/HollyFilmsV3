export type SubtitleRequestStatus =
  'PENDING' | 'DOWNLOADING' | 'DOWNLOADED' | 'REJECTED' | 'FAILED'
export type SubtitleLanguage = { code: string; name: string; iso2?: string }
export type InstalledSubtitle = {
  index: number
  title: string
  language?: string
  codec?: string
  external: boolean
}
export type SubtitleVersion = {
  id: string
  name: string
  tracks: InstalledSubtitle[]
}
export type SubtitleRequest = {
  id: string
  itemId: string
  sourceId: string
  itemName: string
  sourceName: string
  language: string
  status: SubtitleRequestStatus
  createdAt: string
  decidedAt?: string
  lastError?: string
  requester?: string
  decidedBy?: string
}
export type SubtitleLibrary = {
  administrator: boolean
  languages: SubtitleLanguage[]
  versions: SubtitleVersion[]
  requests: SubtitleRequest[]
}
export type SubtitleCandidate = {
  id: string
  name: string
  provider: string
  language?: string
  format?: string
  author?: string
  rating?: number
  downloads?: number
  hashMatch: boolean
  forced: boolean
  hearingImpaired: boolean
  machineTranslated: boolean
}
export type SubtitleRequestPage = {
  items: SubtitleRequest[]
  page: number
  pages: number
  total: number
}

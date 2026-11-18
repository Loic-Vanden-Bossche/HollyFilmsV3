export type RequestMediaType = 'movie' | 'tv'
export type RequestFilter =
  'all' | 'pending' | 'approved' | 'processing' | 'available' | 'failed'
export type DiscoveryTitle = {
  id: number
  type: RequestMediaType
  title: string
  overview: string
  year?: string
  poster?: string
  rating?: number
  mediaStatus: number
  requested: boolean
  requestId?: number
}
export type DiscoveryPage = {
  items: DiscoveryTitle[]
  page: number
  pages: number
}
export type MediaDownload = {
  progress: number | null
  status: string
  remaining?: string
  title?: string
}
export type MediaRequestItem = {
  id: number
  title: DiscoveryTitle
  status: number
  createdAt: string
  updatedAt: string
  is4k: boolean
  seasons: number[]
  downloads: MediaDownload[]
  admin?: {
    requestedBy: string
    modifiedBy?: string
    serverId?: number
    profileId?: number
    profileName?: string
    rootFolder?: string
    externalId?: number
    serviceUrl?: string
  }
}
export type RequestsPageData = {
  items: MediaRequestItem[]
  page: number
  pages: number
  total: number
  serviceErrors: string[]
}
export type RequestServices = {
  enabled: boolean
  movies: boolean
  series: boolean
  seerrUrl?: string
  services?: {
    id: number
    name: string
    type: RequestMediaType
    isDefault: boolean
    is4k: boolean
  }[]
  counts?: Record<string, number>
}

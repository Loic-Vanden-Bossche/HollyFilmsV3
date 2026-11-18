export type InboxItem = {
  id: string
  title: string
  body: string
  url: string
  createdAt: string
  readAt: string | null
}

export type NotificationInbox = {
  items: InboxItem[]
  unread: number
  nextCursor: string | null
}

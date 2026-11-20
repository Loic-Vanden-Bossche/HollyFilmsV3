import { useEffect, type RefObject } from 'react'

const prefix = '#home-shelf-'

function visibleShelf(root: HTMLElement, followingLink: boolean) {
  const rows = root.querySelectorAll<HTMLElement>(':scope > [data-home-shelf]')
  if (!rows.length || window.scrollY <= 1) return ''

  // Use the upper quarter of the viewport: a short row can be fully readable
  // even when the next two are already visible below it.
  const line = Math.min(window.innerHeight / 4, 180)
  const footer = root.querySelector('footer')
  if (footer && footer.getBoundingClientRect().top <= line) return ''

  const atEnd =
    window.scrollY + window.innerHeight >=
    document.documentElement.scrollHeight - 2
  if (followingLink && location.hash.startsWith(prefix)) {
    // Several links can land at the same scroll limit on a tall screen.
    const target = document.getElementById(location.hash.slice(1))
    if (target && root.contains(target)) {
      const top = target.getBoundingClientRect().top
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0
      if (
        Math.abs(top - margin) <= 2 ||
        (atEnd && top >= margin && top < window.innerHeight)
      )
        return location.hash
    }
  }

  let current: HTMLElement | undefined
  if (atEnd) {
    current = rows[rows.length - 1]
  } else {
    for (const row of rows) {
      if (row.getBoundingClientRect().top > line) break
      current = row
    }
  }
  const id = current?.getAttribute('aria-labelledby')
  return id?.startsWith('home-shelf-') ? '#' + id : ''
}

export function useHomeShelfLocation(
  container: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  entryShelf: RefObject<string>,
) {
  useEffect(() => {
    const root = container.current
    if (!enabled || !root) return
    let timer = 0
    let followingLink = location.hash.startsWith(prefix)
    const sync = () => {
      timer = 0
      if (
        entryShelf.current.startsWith(prefix) ||
        (location.hash && !location.hash.startsWith(prefix))
      )
        return
      const next = visibleShelf(root, followingLink)
      followingLink = false
      if (location.hash !== next)
        history.replaceState(
          history.state,
          '',
          location.pathname + location.search + next,
        )
    }
    function schedule() {
      // A link owns its fragment for the whole smooth scroll. Ordinary
      // scrolling samples at most ten times a second, without rendering React.
      if (followingLink) window.clearTimeout(timer)
      if (followingLink || !timer) timer = window.setTimeout(sync, 100)
    }
    function followLink() {
      window.clearTimeout(timer)
      timer = 0
      followingLink = true
    }
    const listeners = new AbortController()
    const options = { signal: listeners.signal, passive: true }
    window.addEventListener('scroll', schedule, options)
    window.addEventListener('resize', schedule, options)
    window.addEventListener('hashchange', followLink, options)
    window.addEventListener('popstate', followLink, options)
    root.addEventListener(
      'click',
      (event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('a[href^="#home-shelf-"]')
        )
          followLink()
      },
      options,
    )
    return () => {
      listeners.abort()
      window.clearTimeout(timer)
    }
  }, [container, enabled, entryShelf])
}

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { animate, stagger } from 'motion/react'
import { X } from 'lucide-react'
import type { JellyfinSession } from '@hollyfilms/shared/accounts'
import type { LibraryImage } from '@hollyfilms/shared/library'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { usePerformanceReducedMotion } from '../performance/PerformanceProvider.tsx'
import { distance, duration, ease } from '../motion/tokens.ts'
import { MediaArtwork } from './MediaArtwork.tsx'
import {
  artworkActivated,
  restoringArtworkFocus,
  useArtworkNavigation,
} from './artwork-hero-context.ts'
import { useArtworkMorph } from './use-artwork-morph.ts'
import './artwork-preview.css'

const previewOpened = 'hollyfilms:artwork-preview'
const gutter = 8
const hoverGrowth = 1.15
const dockWidth = 288
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

type Presentation = 'cinema' | 'landscape' | 'ranked'

function placement(
  anchor: HTMLElement,
  cinematic: boolean,
  presentation?: Presentation,
) {
  const rect = anchor.getBoundingClientRect()
  const viewport = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  const minWidth = Math.min(viewport, rect.width * hoverGrowth)
  const minHeight = Math.min(viewportHeight, rect.height * hoverGrowth)
  const insetX = Math.min(gutter, (viewport - minWidth) / 2)
  const insetY = Math.min(gutter, (viewportHeight - minHeight) / 2)
  const track = anchor.closest(
    '.horizontal-rail-track, .home-resume-rail, .library-episode-rail, .detail-rail-track, .home-grid, .collection-gallery, .discovery-grid',
  )
  const row = track?.getBoundingClientRect()
  const rail = track?.closest('.horizontal-rail')
  const previous = rail
    ?.querySelector(':scope > .horizontal-rail-arrow--previous:enabled')
    ?.getBoundingClientRect()
  const next = rail
    ?.querySelector(':scope > .horizontal-rail-arrow--next:enabled')
    ?.getBoundingClientRect()
  let leftLimit = Math.max(insetX, row?.left ?? 0, previous?.right ?? 0)
  let rightLimit = Math.min(
    viewport - insetX,
    row?.right ?? viewport,
    next?.left ?? viewport,
  )
  let preferredWidth = clamp(rect.width * 1.55, 300, Math.max(600, rect.width))
  if (presentation === 'ranked') {
    preferredWidth = clamp(rect.width * 1.5, 360, 480)
  } else if (cinematic) {
    preferredWidth = Math.min(
      900,
      Math.max(rect.width * 2, clamp(viewport / 2, 560, 760)),
      ((viewportHeight - gutter * 2) * 16) / 9,
    )
  }
  // Use the rail's clear space first. On tight rails keep the next arrow
  // reachable if possible, then use the full viewport if growth needs it.
  if (rightLimit - leftLimit < minWidth) {
    if (next && rightLimit - insetX >= minWidth) leftLimit = insetX
    else if (previous && viewport - insetX - leftLimit >= minWidth)
      rightLimit = viewport - insetX
    else {
      leftLimit = insetX
      rightLimit = viewport - insetX
    }
  }
  if (presentation === 'cinema')
    preferredWidth = Math.max(preferredWidth, (minHeight * 16) / 9)
  if (presentation === 'landscape')
    preferredWidth = Math.max(preferredWidth, minWidth + dockWidth)
  const availableWidth = rail ? rightLimit - leftLimit : viewport - insetX * 2
  const width = Math.min(Math.max(preferredWidth, minWidth), availableWidth)
  // A side dock needs space in addition to the enlarged picture. Otherwise
  // put it below the picture, even on a desktop with a narrow rail.
  const split =
    presentation === 'landscape' &&
    width >= Math.max(2 * dockWidth, minWidth + dockWidth)
  const pictureWidth = split ? Math.max(width / 2, minWidth) : width
  // Grow a ranked tile away from its numeral while space permits.
  const origin =
    presentation === 'ranked' ? rect.left : rect.left + (rect.width - width) / 2
  const left =
    rightLimit - leftLimit >= width
      ? clamp(origin, leftLimit, rightLimit - width)
      : clamp(origin, insetX, viewport - width - insetX)
  return {
    left,
    width,
    minHeight,
    pictureWidth,
    split,
    insetY,
    maxHeight: viewportHeight - 2 * insetY,
    slotHeight: rect.height,
    centerY: rect.top + rect.height / 2,
  }
}

function previewImageWidth(panelWidth: number, compactWidth: number) {
  const { connection } = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }
  if (
    panelWidth <= 480 ||
    connection?.saveData ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === 'slow-2g'
  )
    return compactWidth
  const pixels = panelWidth * Math.max(1, window.devicePixelRatio || 1)
  if (pixels <= compactWidth) return compactWidth
  return [640, 960, 1280].find((width) => width >= pixels) ?? 1600
}

export function ArtworkPreview({
  title,
  wide = false,
  presentation,
  cinematic = Boolean(presentation),
  titleLogo,
  headingLevel = 3,
  session,
  artwork,
  previewArtwork,
  previewImage,
  hoverVideo,
  onSelect,
  selectLabel,
  className = '',
  triggerClassName = '',
  triggerOverlay,
  watermark,
  mediaId,
  children,
}: {
  title: string
  wide?: boolean
  cinematic?: boolean
  presentation?: Presentation
  titleLogo?: LibraryImage | string
  headingLevel?: 2 | 3 | 4
  session?: JellyfinSession
  artwork: ReactNode
  previewArtwork?: ReactNode
  previewImage?: {
    source?: LibraryImage | string
    compactWidth: number
    matchesCover?: boolean
    includesTitle?: boolean
    onUnavailable?: () => void
  }
  hoverVideo?: ReactNode
  onSelect?: () => void
  selectLabel?: string
  className?: string
  triggerClassName?: string
  triggerOverlay?: ReactNode
  watermark?: ReactNode
  mediaId?: string
  children: ReactNode
}) {
  const { t } = useI18n()
  const navigateArtwork = useArtworkNavigation()
  const reduced = usePerformanceReducedMotion()
  const id = useId()
  const root = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const videoTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [hoveringVideo, setHoveringVideo] = useState(false)
  const touch = useRef(false)
  const restoringFocus = useRef(false)
  const [frame, setFrame] = useState<
    ReturnType<typeof placement> & { fromHover: boolean }
  >()
  const [retracting, setRetracting] = useState(false)
  const open = Boolean(frame)
  const staged = Boolean(cinematic && frame?.fromHover && !reduced)
  const imageWidth =
    frame && previewImage
      ? previewImageWidth(frame.pictureWidth, previewImage.compactWidth)
      : 0
  const alternateImage =
    previewImage?.source &&
    (!previewImage.matchesCover ||
      (typeof previewImage.source !== 'string' &&
        imageWidth > previewImage.compactWidth))
  const Heading = `h${headingLevel}` as const
  const titleOnImage = presentation === 'landscape' || presentation === 'ranked'
  const previewTitle = frame && cinematic && (
    <Heading className="artwork-preview-title" aria-label={title}>
      {titleLogo ? (
        <MediaArtwork
          className="artwork-preview-logo"
          reveal="logo"
          source={titleLogo}
          session={session}
          width={640}
          eager={!previewImage?.includesTitle}
          fallback={<span>{title}</span>}
        />
      ) : (
        title
      )}
    </Heading>
  )

  function show(fromHover = false) {
    clearTimeout(timer.current)
    setRetracting(false)
    const anchor = root.current
    if (!anchor || !trigger.current || open) return
    anchor.style.setProperty(
      '--preview-origin-radius',
      getComputedStyle(trigger.current).borderTopLeftRadius,
    )
    anchor.ownerDocument.dispatchEvent(new Event(previewOpened))
    setFrame({ ...placement(anchor, cinematic, presentation), fromHover })
  }
  function hide() {
    clearTimeout(timer.current)
    clearTimeout(videoTimer.current)
    setHoveringVideo(false)
    setRetracting(false)
    setFrame(undefined)
  }
  function restoreFocus() {
    restoringFocus.current = true
    trigger.current?.focus({ preventScroll: true })
    restoringFocus.current = false
  }
  function restoreThenHide() {
    restoreFocus()
    hide()
  }
  function dismiss() {
    restoreFocus()
    if (reduced) hide()
    else setRetracting(true)
  }
  function select(control: HTMLButtonElement) {
    if (!onSelect) return
    if (mediaId) {
      navigateArtwork(control, 'details', () => {
        if (!open) restoreFocus()
        onSelect()
      })
    } else {
      restoreThenHide()
      onSelect()
    }
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      clearTimeout(videoTimer.current)
    },
    [],
  )
  useLayoutEffect(() => {
    const surface = panel.current
    const anchor = root.current
    const button = trigger.current
    if (!frame || !surface || !anchor || !button) return
    // Lift the existing card out of the rail's clipping area. Its slot stays
    // in flow and remains the reference for all viewport measurements.
    surface.showPopover?.()
    const position = () => {
      const current = placement(anchor, cinematic, presentation)
      const slot = anchor.getBoundingClientRect()
      surface.style.setProperty('--preview-origin-width', slot.width + 'px')
      surface.style.setProperty('--preview-origin-height', slot.height + 'px')
      surface.style.left = current.left + 'px'
      surface.style.width = current.width + 'px'
      surface.style.setProperty(
        '--preview-min-height',
        current.minHeight + 'px',
      )
      surface.style.setProperty(
        '--preview-max-height',
        current.maxHeight + 'px',
      )
      surface.style.setProperty(
        '--preview-picture-width',
        current.pictureWidth + 'px',
      )
      surface.toggleAttribute('data-split', current.split)
      const top = clamp(
        current.centerY -
          (wide && presentation !== 'landscape'
            ? (current.width * 9) / 16
            : surface.offsetHeight) /
            2,
        current.insetY,
        document.documentElement.clientHeight -
          surface.offsetHeight -
          current.insetY,
      )
      surface.style.top = top + 'px'
    }
    position()
    const observer = new ResizeObserver(position)
    observer.observe(surface)
    observer.observe(anchor)
    const outside = (event: Event) => {
      if (event.target instanceof Node && !anchor.contains(event.target)) hide()
    }
    const dialog = anchor.closest('dialog[open]')
    const content = surface.firstElementChild!
    const canScrollPreview = (deltaY: number) =>
      deltaY < 0
        ? content.scrollTop > 0
        : content.scrollHeight - content.clientHeight - content.scrollTop > 1
    const scrollDialog = (event: WheelEvent) => {
      const mode = event.deltaMode
      if (
        !dialog ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        canScrollPreview(event.deltaY)
      )
        return
      // A fixed top-layer popover chains to the document, skipping its modal.
      // Let a tall preview scroll normally until it reaches its own boundary.
      event.preventDefault()
      const unit =
        mode === WheelEvent.DOM_DELTA_PAGE
          ? dialog.clientHeight
          : mode === WheelEvent.DOM_DELTA_LINE
            ? parseFloat(getComputedStyle(content).lineHeight) || 16
            : 1
      dialog.scrollBy({ top: event.deltaY * unit, behavior: 'instant' })
    }
    let lastTouch: Touch | undefined
    let panningDialog = false
    const startPan = (event: TouchEvent) => {
      lastTouch = event.touches.length === 1 ? event.touches[0] : undefined
      if (!lastTouch && panningDialog) {
        panningDialog = false
        surface.style.visibility = ''
      }
    }
    const panDialog = (event: TouchEvent) => {
      if (!dialog || !lastTouch || !event.cancelable) return
      const touch = event.touches[0]
      const dy = lastTouch.clientY - touch.clientY
      if (!panningDialog) {
        const dx = Math.abs(lastTouch.clientX - touch.clientX)
        if (Math.max(dx, Math.abs(dy)) < 8) return
        if (dx >= Math.abs(dy) || canScrollPreview(dy)) {
          lastTouch = undefined
          return
        }
        // Touch targets stay latched until release, even if the popover closes.
        // Keep its target mounted for this drag while the dialog moves beneath it.
        panningDialog = true
        surface.style.visibility = 'hidden'
      }
      event.preventDefault()
      dialog.scrollBy({ top: dy, behavior: 'instant' })
      lastTouch = touch
    }
    const endPan = () => {
      lastTouch = undefined
      if (panningDialog) hide()
    }
    const scroll = (event: Event) => {
      if (panningDialog) return
      // Only scrolling an ancestor can move this card. A neighboring rail
      // settling into its snap position must not dismiss an active preview.
      if (event.target instanceof Node && !event.target.contains(anchor)) return
      const rect = anchor.getBoundingClientRect()
      if (
        anchor.contains(document.activeElement) &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth
      )
        position()
      else hide()
    }
    const escapeOutside = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        event.target instanceof Node &&
        !anchor.contains(event.target)
      ) {
        event.preventDefault()
        event.stopPropagation()
        setRetracting(true)
      }
    }
    if (dialog) {
      surface.addEventListener('wheel', scrollDialog, { passive: false })
      surface.addEventListener('touchstart', startPan, { passive: true })
      surface.addEventListener('touchmove', panDialog, { passive: false })
      surface.addEventListener('touchend', endPan)
      surface.addEventListener('touchcancel', endPan)
    }
    // Navigation sends this after the browser has captured the visible card,
    // before the next screen records its focus-return target.
    anchor.addEventListener(artworkActivated, restoreThenHide)
    document.addEventListener(previewOpened, hide)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside, true)
    document.addEventListener('scroll', scroll, true)
    document.addEventListener('visibilitychange', hide)
    document.addEventListener('keydown', escapeOutside, true)
    window.addEventListener('resize', hide)
    window.addEventListener('blur', hide)
    return () => {
      observer.disconnect()
      // React returns this same element to normal flow on close. Inline
      // viewport positioning and a partially scrolled surface are transient.
      surface.removeAttribute('data-split')
      surface.style.removeProperty('left')
      surface.style.removeProperty('top')
      surface.style.removeProperty('width')
      surface.style.removeProperty('visibility')
      content.scrollTo({ top: 0, behavior: 'instant' })
      surface.removeEventListener('wheel', scrollDialog)
      surface.removeEventListener('touchstart', startPan)
      surface.removeEventListener('touchmove', panDialog)
      surface.removeEventListener('touchend', endPan)
      surface.removeEventListener('touchcancel', endPan)
      anchor.removeEventListener(artworkActivated, restoreThenHide)
      document.removeEventListener(previewOpened, hide)
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', outside, true)
      document.removeEventListener('scroll', scroll, true)
      document.removeEventListener('visibilitychange', hide)
      document.removeEventListener('keydown', escapeOutside, true)
      window.removeEventListener('resize', hide)
      window.removeEventListener('blur', hide)
    }
  }, [frame, wide, cinematic, presentation])

  useArtworkMorph({
    slot: root,
    panel,
    trigger,
    open,
    retracting,
    reduced,
    onRetracted: hide,
  })

  useLayoutEffect(() => {
    const surface = panel.current
    if (!staged || !surface) return
    // The title has its own entrance tied to image decoding. The controls
    // and synopsis can appear even while the logo is still in flight.
    const rows = Array.from(
      surface.querySelectorAll<HTMLElement>(
        '.artwork-preview-content > :not(.artwork-preview-title)',
      ),
    )
    if (!rows.length) return
    const direction = presentation === 'landscape' ? 'translateX' : 'translateY'
    const reveal = animate(
      rows,
      {
        opacity: [0, 1],
        transform: [`${direction}(${distance.panel}px)`, `${direction}(0px)`],
      },
      {
        duration: duration.panel,
        delay: stagger(duration.stagger, { startDelay: duration.micro }),
        ease: ease.out,
      },
    )
    const finishOnKeyboardFocus = (event: FocusEvent) => {
      if (
        event.target instanceof Element &&
        event.target.matches(':focus-visible')
      )
        reveal.complete()
    }
    surface.addEventListener('focusin', finishOnKeyboardFocus)
    return () => {
      surface.removeEventListener('focusin', finishOnKeyboardFocus)
      reveal.complete()
    }
  }, [staged, presentation])

  return (
    <article
      ref={root}
      className={'artwork-preview ' + className}
      data-wide={wide}
      data-presentation={presentation}
      data-media-id={mediaId}
      data-active={open}
      style={frame ? { height: frame.slotHeight } : undefined}
      aria-label={title}
      onPointerEnter={(event) => {
        touch.current = event.pointerType !== 'mouse'
        if (touch.current) return
        clearTimeout(timer.current)
        if (retracting) setRetracting(false)
        if (!open) timer.current = setTimeout(() => show(true), 220)
        if (hoverVideo && !reduced) {
          clearTimeout(videoTimer.current)
          videoTimer.current = setTimeout(() => {
            const { connection } = navigator as Navigator & {
              connection?: { saveData?: boolean }
            }
            if (
              !document.hidden &&
              !connection?.saveData &&
              !root.current?.closest('[inert]')
            )
              setHoveringVideo(true)
          }, 650)
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return
        clearTimeout(timer.current)
        clearTimeout(videoTimer.current)
        if (root.current?.matches(':has(:focus-visible)'))
          setHoveringVideo(false)
        else if (open)
          timer.current = setTimeout(() => {
            if (reduced) hide()
            else setRetracting(true)
          }, 120)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open || event.defaultPrevented) return
        event.preventDefault()
        event.stopPropagation()
        const menu =
          panel.current?.querySelector<HTMLDetailsElement>('details[open]')
        if (menu) {
          menu.open = false
          menu.querySelector('summary')?.focus()
        } else dismiss()
      }}
    >
      <div
        ref={panel}
        popover={open ? 'manual' : undefined}
        role={open ? 'group' : undefined}
        aria-label={open ? title : undefined}
        className={
          open
            ? 'artwork-preview-shell artwork-preview-panel'
            : 'artwork-preview-shell'
        }
        data-presentation={presentation}
        data-branded={watermark ? true : undefined}
        data-retracting={retracting || undefined}
        data-reduced-motion={reduced || undefined}
        onClickCapture={(event) => {
          if (
            !open ||
            !(event.target instanceof Element) ||
            trigger.current?.contains(event.target)
          )
            return
          if (event.target.closest('[data-preview-select]')) restoreFocus()
        }}
        onClick={(event) => {
          if (
            !open ||
            !(event.target instanceof Element) ||
            trigger.current?.contains(event.target)
          )
            return
          if (event.target.closest('[data-preview-select]')) hide()
        }}
      >
        <div className="artwork-preview-surface">
          <div
            className={
              'artwork-preview-layout' +
              (open
                ? cinematic
                  ? ' artwork-preview-stage'
                  : ' artwork-preview-stack'
                : '')
            }
          >
            <div
              className="artwork-preview-hero"
              data-titled-image={previewImage?.includesTitle || undefined}
              data-contain={
                (open &&
                  !cinematic &&
                  !wide &&
                  !previewArtwork &&
                  !previewImage?.source) ||
                undefined
              }
            >
              <div className="artwork-preview-cover">
                <button
                  ref={trigger}
                  type="button"
                  className={'artwork-preview-trigger ' + triggerClassName}
                  aria-label={selectLabel ?? title}
                  aria-expanded={open}
                  aria-controls={open ? id : undefined}
                  data-artwork-open={mediaId ? 'details' : undefined}
                  onPointerDown={(event) => {
                    touch.current = event.pointerType !== 'mouse'
                  }}
                  onFocus={(event) => {
                    // Restoring focus from a dialog must leave the returning
                    // card at the same size as its destination snapshot.
                    if (
                      !restoringFocus.current &&
                      !touch.current &&
                      !restoringArtworkFocus.has(event.currentTarget) &&
                      event.target.matches(':focus-visible')
                    )
                      show()
                  }}
                  onKeyDown={() => {
                    touch.current = false
                  }}
                  onClick={(event) => {
                    // When a shelf mounts under an active finger, the browser
                    // can deliver the click here after pointerdown hit its slot.
                    const pointerType =
                      'pointerType' in event.nativeEvent &&
                      event.nativeEvent.pointerType
                    const tapped =
                      event.detail !== 0 &&
                      (touch.current ||
                        pointerType === 'touch' ||
                        pointerType === 'pen')
                    touch.current = false
                    if (!open && (tapped || !onSelect)) show()
                    else if (onSelect) select(event.currentTarget)
                    else if (open) restoreThenHide()
                  }}
                >
                  {artwork}
                </button>
                {triggerOverlay && (
                  <div aria-hidden={open || undefined}>{triggerOverlay}</div>
                )}
              </div>
              {frame && (
                <>
                  {(alternateImage || previewArtwork) && (
                    <div
                      className="artwork-preview-backdrop"
                      data-ready={previewArtwork ? true : undefined}
                    >
                      {alternateImage && previewImage ? (
                        <MediaArtwork
                          source={previewImage.source}
                          onUnavailable={previewImage.onUnavailable}
                          session={session}
                          width={imageWidth}
                          eager
                        />
                      ) : (
                        previewArtwork
                      )}
                    </div>
                  )}
                  {hoveringVideo && !reduced && hoverVideo}
                  {cinematic && (
                    <div aria-hidden="true" className="artwork-preview-scrim" />
                  )}
                  {onSelect && (
                    <button
                      type="button"
                      tabIndex={-1}
                      className="artwork-preview-open"
                      aria-label={t('Ouvrir {title}', { title })}
                      data-artwork-open={mediaId ? 'details' : undefined}
                      onClick={(event) => select(event.currentTarget)}
                    />
                  )}
                  {titleOnImage &&
                    (!previewImage?.includesTitle || hoveringVideo) &&
                    previewTitle}
                  {watermark}
                </>
              )}
            </div>
            {open && (
              <div id={id} className="artwork-preview-content">
                {!titleOnImage && previewTitle}
                {children}
              </div>
            )}
          </div>
          {open && (
            <button
              type="button"
              className="artwork-preview-close"
              aria-label={t('Fermer l’aperçu')}
              onClick={dismiss}
            >
              <X aria-hidden="true" size={18} />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

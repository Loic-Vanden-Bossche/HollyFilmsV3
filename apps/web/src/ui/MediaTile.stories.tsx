import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, spyOn, waitFor } from 'storybook/test'
import type { MediaItem } from '@hollyfilms/shared/library'
import { MediaTile } from './MediaTile.tsx'
import { HorizontalRail } from './HorizontalRail.tsx'
import { homeItems, homeResume } from '../home-fixtures.ts'
const meta = {
  title: 'UI/Affiche média',
  component: MediaTile,
  args: { item: homeItems[0], onSelect: fn() },
  decorators: [
    (Story, { parameters }) => {
      const [client] = useState(() => new QueryClient())
      return (
        <QueryClientProvider client={client}>
          <div
            style={{
              width:
                parameters.cardWidth ??
                (parameters.cardGrid ? 'min(1100px, 100%)' : 270),
              maxWidth: '100%',
              padding: 12,
            }}
          >
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /Voir la fiche de/ }),
    )
    await expect(args.onSelect).toHaveBeenCalledWith(args.item)
  },
  render: function Render(args) {
    const [item, setItem] = useState(args.item)
    return (
      <MediaTile
        {...args}
        item={item}
        onFavorite={
          args.onFavorite &&
          (async (_item, favorite) => {
            const value = await args.onFavorite!(_item, favorite)
            setItem((item) => ({ ...item, favorite: value }))
            return value
          })
        }
        onWatched={
          args.onWatched &&
          (async (_item, watched) => {
            const value = await args.onWatched!(_item, watched)
            setItem((item) => ({ ...item, watched: value }))
            return value
          })
        }
      />
    )
  },
} satisfies Meta<typeof MediaTile>
export default meta
type Story = StoryObj<typeof meta>
export const Poster: Story = {}
export const InProgress: Story = {
  name: 'Reprise — image paysage et progression',
  args: { item: homeResume[0], wide: true },
  play: async ({ canvas, args }) => {
    const card = canvas.getByRole('article')
    await expect(card).toHaveAttribute('data-active', 'false')
    await waitFor(() =>
      expect(
        card.querySelector('.artwork-preview-trigger img'),
      ).toHaveAttribute('src', args.item.thumb),
    )
    await expect(canvas.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '24',
    )
    await expect(card.querySelector('.media-card-cover-title')).toBeNull()
    await expect(card.querySelectorAll('img')).toHaveLength(1)
  },
}
export const CoverProgressContrast: Story = {
  name: 'Progression sur visuels clair et sombre',
  parameters: { cardWidth: 'min(100%, 920px)' },
  args: {
    wide: true,
    item: {
      ...homeResume[0],
      progress: 0.04,
      remainingMinutes: 114,
      thumb:
        'data:image/svg+xml,' +
        encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
          <rect width="640" height="360" fill="#f0e0b9"/>
          <circle cx="456" cy="120" r="63" fill="#fff4d4"/>
          <path d="M0 250Q210 140 365 224T640 178V360H0Z" fill="#c99868"/>
          <path d="M0 282Q200 328 407 250T640 237V360H0Z" fill="#e9cc99"/>
          <text x="34" y="286" fill="#532f26" font-family="sans-serif" font-size="52" font-weight="bold" letter-spacing="3">SIGNAL</text>
        </svg>`),
    },
  },
  render: (args) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))',
        gap: 16,
      }}
    >
      <MediaTile {...args} />
      <MediaTile
        {...args}
        item={{ ...homeResume[1], progress: 0.78, remainingMinutes: 26 }}
      />
    </div>
  ),
  play: async ({ canvas }) => {
    for (const now of [4, 78]) {
      await expect(
        canvas.getByRole('progressbar', { value: { now } }),
      ).toBeVisible()
    }
    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument()
  },
}
export const WithoutLandscapeThumbnail: Story = {
  name: 'Reprise sans image paysage',
  args: { item: { ...homeResume[0], thumb: undefined }, wide: true },
  play: async ({ canvas, args }) => {
    const card = canvas.getByRole('article')
    await expect(canvas.getByText(args.item.title)).toBeVisible()
    await expect(canvas.getByRole('progressbar')).toBeVisible()
    await waitFor(() =>
      expect(
        card.querySelector('.artwork-preview-trigger img'),
      ).toHaveAttribute('src', args.item.backdrop),
    )
  },
}
export const PosterInProgress: Story = {
  name: 'Affiche en cours de lecture',
  args: { item: homeResume[0] },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('progressbar')).toBeVisible()
    await expect(canvas.queryByText(args.item.title)).not.toBeInTheDocument()
    await waitFor(() =>
      expect(canvas.getByRole('article').querySelector('img')).toHaveAttribute(
        'src',
        args.item.poster,
      ),
    )
  },
}
export const WithoutArtwork: Story = {
  args: { item: { ...homeItems[0], poster: undefined, backdrop: undefined } },
}
export const WithoutPortraitPoster: Story = {
  name: 'Affiche indisponible — décor et titre',
  args: { item: { ...homeItems[0], poster: 'data:image/png;base64,AAAA' } },
  play: async ({ canvas, args }) => {
    const card = canvas.getByRole('article', { name: args.item.title })
    await expect(await canvas.findByText(args.item.title)).toBeVisible()
    await waitFor(() =>
      expect(
        card.querySelector('.artwork-preview-trigger img'),
      ).toHaveAttribute('src', args.item.backdrop),
    )
    await expect(card).toHaveAttribute('data-wide', 'false')
  },
}
export const Actions: Story = {
  args: {
    onFavorite: fn<(item: MediaItem, value: boolean) => Promise<boolean>>(
      async (_item, value) => value,
    ),
    onWatched: fn<(item: MediaItem, value: boolean) => Promise<boolean>>(
      async (_item, value) => value,
    ),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Ajouter aux favoris' }),
    )
    await expect(args.onFavorite).toHaveBeenCalledWith(args.item, true)
    await expect(
      canvas.getByRole('button', { name: 'Retirer des favoris' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(
      canvas.getByRole('button', { name: 'Marquer comme vu' }),
    )
    await expect(await canvas.findByLabelText('Déjà vu')).toBeVisible()
    await expect(args.onWatched).toHaveBeenCalledWith(
      expect.objectContaining({ id: args.item.id }),
      true,
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Marquer comme non vu' }),
    )
    await waitFor(() =>
      expect(canvas.queryByLabelText('Déjà vu')).not.toBeInTheDocument(),
    )
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}
export const Watched: Story = {
  args: {
    ...Actions.args,
    item: { ...homeItems[0], watched: true, favorite: true },
  },
}
export const SaveFailure: Story = {
  args: {
    onFavorite: fn(async () => {
      throw new Error('Offline')
    }),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Ajouter aux favoris' }),
    )
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Modification impossible',
    )
    await expect(args.onFavorite).toHaveBeenCalled()
    await expect(
      canvas.getByRole('button', { name: 'Ajouter aux favoris' }),
    ).toHaveAttribute('aria-pressed', 'false')
  },
}
export const MissingMetadata: Story = {
  args: {
    item: {
      ...homeItems[0],
      rating: undefined,
      genres: [],
      overview: '',
      minutes: undefined,
      classification: undefined,
      year: undefined,
      quality: undefined,
      criticRating: undefined,
      audioLanguages: [],
      editions: [],
    },
  },
}
export const Keyboard: Story = {
  args: Actions.args,
  name: 'Navigation clavier',
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab()
    const trigger = canvas.getByRole('button', { name: /Voir la fiche de/ })
    await expect(trigger).toHaveFocus()
    const favorite = await canvas.findByRole('button', {
      name: 'Ajouter aux favoris',
    })
    await userEvent.tab()
    await expect(favorite).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onFavorite).toHaveBeenCalledWith(args.item, true)
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}
export const HoverPlay: Story = {
  name: 'Lire au survol',
  args: { ...Actions.args, item: homeItems[1], onPlay: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Lire ' + args.item.title }),
    )
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
    await expect(args.onSelect).not.toHaveBeenCalled()
    await expect(args.onFavorite).not.toHaveBeenCalled()
    await expect(args.onWatched).not.toHaveBeenCalled()
  },
}
export const ResumePlay: Story = {
  name: 'Paysage — reprise et commandes',
  args: { ...HoverPlay.args, item: homeResume[0], wide: true },
  play: async ({ canvas, userEvent, args }) => {
    await expect(canvas.getByRole('progressbar')).toBeVisible()
    await userEvent.hover(canvas.getByRole('article'))
    await waitFor(() => expect(canvas.getByText('Encore 1 h 16')).toBeVisible())
    await expect(canvas.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '24',
    )
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reprendre ' + args.item.title }),
    )
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
    const trigger = canvas.getByRole('button', { name: /Voir la fiche de/ })
    await userEvent.pointer([{ keys: '[TouchA]', target: trigger }])
    const panel = await canvas.findByRole('group', { name: args.item.title })
    await expect(panel).toHaveAttribute('data-presentation', 'landscape')
    const image = panel.querySelector('.artwork-preview-hero')!
    const play = canvas.getByRole('button', { name: /^Reprendre / })
    const logo = panel.querySelector<HTMLImageElement>(
      '.artwork-preview-title img',
    )!
    await waitFor(() => {
      const art = image.getBoundingClientRect()
      const action = play.getBoundingClientRect()
      const title = logo.getBoundingClientRect()
      expect(logo.naturalWidth).toBeGreaterThan(0)
      expect(title.width).toBeGreaterThan(44)
      expect(title.height).toBeGreaterThan(0)
      expect(title.left).toBeGreaterThanOrEqual(art.left - 1)
      expect(title.right).toBeLessThanOrEqual(art.right + 1)
      expect(title.top).toBeGreaterThanOrEqual(art.top - 1)
      expect(title.bottom).toBeLessThanOrEqual(art.bottom + 1)
      // The dock sits beside the image on desktop and below it on a phone.
      expect(action.left >= art.right - 1 || action.top >= art.bottom - 1).toBe(
        true,
      )
    })
    await expect(panel.querySelector('.artwork-watermark')).toBeNull()
  },
}
export const CompactEpisode: Story = {
  name: 'Reprise compacte — épisode et titre long',
  args: {
    ...ResumePlay.args,
    item: {
      ...homeResume[0],
      kind: 'Épisode',
      thumb: 'data:image/png;base64,broken',
      title: 'Signal : les dernières transmissions de la station abandonnée',
      episode: 'S02 · E04 — Une dernière transmission',
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    const card = canvas.getByRole('article')
    const { width, height } = card.getBoundingClientRect()
    expect(width / height).toBeCloseTo(16 / 9, 1)
    await waitFor(() =>
      expect(
        card.querySelector('.artwork-preview-trigger img'),
      ).toHaveAttribute('src', args.item.backdrop),
    )
    await expect(canvas.getByText(args.item.title)).toBeVisible()
    await expect(canvas.queryByText(args.item.episode!)).not.toBeInTheDocument()
    await userEvent.hover(card)
    await waitFor(() => {
      expect(canvas.getByText(args.item.episode!)).toBeVisible()
      expect(canvas.getByText('Encore 1 h 16')).toBeVisible()
    })
    await userEvent.click(canvas.getByRole('button', { name: /^Reprendre / }))
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
  },
}
export const KeyboardPlay: Story = {
  name: 'Lecture au clavier',
  args: HoverPlay.args,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab()
    const play = await canvas.findByRole('button', {
      name: 'Lire ' + args.item.title,
    })
    await userEvent.tab()
    await expect(play).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
  },
}
export const ExpandedDetails: Story = {
  name: 'Affiche — aperçu panoramique et filigrane',
  args: { ...HoverPlay.args, item: homeItems[0] },
  play: async ({ canvas, userEvent, args }) => {
    const card = canvas.getByRole('article')
    await expect(card.querySelector('.artwork-watermark')).toBeNull()
    await expect(canvas.queryByText(args.item.title)).not.toBeInTheDocument()
    await userEvent.hover(card)
    const heading = await canvas.findByRole('heading', {
      name: args.item.title,
    })
    await waitFor(() => {
      const logo = heading.querySelector('img')
      expect(logo).toHaveAttribute('src', args.item.logo)
      expect(logo?.naturalWidth).toBeGreaterThan(0)
      expect(logo).toBeVisible()
    })
    const hero = card.querySelector('.artwork-preview-hero')!
    const panel = canvas.getByRole('group', { name: args.item.title })
    await expect(panel).toHaveAttribute('data-presentation', 'cinema')
    const watermark = hero.querySelector('.artwork-watermark')!
    await expect(watermark).toBeVisible()
    await expect(watermark.closest('[aria-hidden="true"]')).not.toBeNull()
    await expect(hero.querySelector('img')).toHaveAttribute(
      'src',
      args.item.backdrop,
    )
    const play = canvas.getByRole('button', { name: 'Lire ' + args.item.title })
    const artBounds = hero.getBoundingClientRect()
    for (const overlay of [heading, play, watermark]) {
      const bounds = overlay.getBoundingClientRect()
      expect(bounds.top).toBeGreaterThanOrEqual(artBounds.top - 1)
      expect(bounds.bottom).toBeLessThanOrEqual(artBounds.bottom + 1)
    }
    await waitFor(() => {
      expect(canvas.getByText('1 h 58')).toBeVisible()
      expect(canvas.getByText('Version longue')).toBeVisible()
      expect(canvas.getByText(args.item.overview)).toBeVisible()
      expect(canvas.getByLabelText(/Langues audio/)).toBeVisible()
    })
  },
}
export const DelayedLogo: Story = {
  name: 'Logo en cours de décodage au survol',
  args: ExpandedDetails.args,
  play: async ({ canvas, userEvent, args }) => {
    let releaseLogo!: () => void
    const pendingLogo = new Promise<void>((resolve) => {
      releaseLogo = resolve
    })
    const decode = HTMLImageElement.prototype.decode
    const delayedDecode = spyOn(
      HTMLImageElement.prototype,
      'decode',
    ).mockImplementation(async function (this: HTMLImageElement) {
      if (this.getAttribute('src') === args.item.logo) await pendingLogo
      return decode.call(this)
    })
    try {
      await userEvent.hover(canvas.getByRole('article'))
      const heading = await canvas.findByRole('heading', {
        name: args.item.title,
      })
      const image = heading.querySelector('img')
      await waitFor(() => expect(image?.naturalWidth).toBeGreaterThan(0))
      await waitFor(() => {
        expect(
          canvas.getByRole('button', { name: 'Lire ' + args.item.title }),
        ).toBeVisible()
        expect(canvas.getByText(args.item.overview)).toBeVisible()
      })
      await expect(heading).toHaveTextContent(/^$/)
      await expect(heading.querySelector('.media-artwork-fallback')).toBeNull()
      await expect(image).not.toBeVisible()
      releaseLogo()
      await waitFor(() => expect(image).toHaveStyle({ opacity: '1' }))
      await expect(image).toBeVisible()
      await expect(heading).toHaveTextContent(/^$/)
    } finally {
      releaseLogo()
      delayedDecode.mockRestore()
    }
  },
}
export const LongTitle: Story = {
  name: 'Titre long et plusieurs éditions',
  args: {
    ...HoverPlay.args,
    item: {
      ...homeItems[0],
      title: 'Orbital : les dernières transmissions de la station abandonnée',
      logo: undefined,
      editions: ['Version longue restaurée', 'Version cinéma'],
    },
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.tab()
    const heading = await canvas.findByRole('heading', {
      name: args.item.title,
    })
    await expect(heading).toHaveTextContent(args.item.title)
    await expect(heading.querySelector('img')).toBeNull()
    await userEvent.keyboard('{Enter}')
    await expect(args.onSelect).toHaveBeenCalledWith(args.item)
  },
}
export const UnavailableLogo: Story = {
  name: 'Titre de remplacement si le logo est illisible',
  args: {
    ...HoverPlay.args,
    item: { ...homeResume[0], logo: 'data:image/png;base64,broken' },
    wide: true,
  },
  play: async ({ canvas, userEvent, args }) => {
    const trigger = canvas.getByRole('button', { name: /Voir la fiche de/ })
    await waitFor(() =>
      expect(trigger.querySelector('img')).toHaveAttribute(
        'src',
        args.item.thumb,
      ),
    )
    await expect(canvas.getByRole('progressbar')).toBeVisible()
    await userEvent.pointer([{ keys: '[TouchA]', target: trigger }])
    const heading = await canvas.findByRole('heading', {
      name: args.item.title,
    })
    await waitFor(() => expect(heading).toHaveTextContent(args.item.title))
    await expect(heading.querySelector('img')).toBeNull()
    await expect(
      canvas.getByRole('button', { name: 'Reprendre ' + args.item.title }),
    ).toBeEnabled()
    await expect(args.onSelect).not.toHaveBeenCalled()
  },
}
export const CatalogueGrid: Story = {
  name: 'Grille stable au survol',
  parameters: { cardGrid: true },
  args: { onPlay: fn() },
  render: (args) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        alignItems: 'start',
        gap: 16,
      }}
    >
      {homeItems.slice(0, 6).map((item) => (
        <MediaTile key={item.id} {...args} item={item} />
      ))}
    </div>
  ),
  play: async ({ canvas, userEvent, args }) => {
    const cards = canvas.getAllByRole('article')
    const before = cards[0].getBoundingClientRect()
    const neighbor = cards[1].getBoundingClientRect()
    expect(before.width / before.height).toBeCloseTo(2 / 3, 2)
    await userEvent.hover(cards[0])
    const play = await canvas.findByRole('button', {
      name: 'Lire ' + homeItems[0].title,
    })
    const panel = await canvas.findByRole('group', { name: homeItems[0].title })
    const bounds = panel.getBoundingClientRect()
    const viewport = panel.ownerDocument.documentElement
    expect(bounds.width).toBeGreaterThanOrEqual(
      Math.min(560, viewport.clientWidth * 0.85, viewport.clientHeight),
    )
    expect(bounds.left).toBeGreaterThanOrEqual(0)
    expect(bounds.right).toBeLessThanOrEqual(viewport.clientWidth)
    expect(bounds.bottom).toBeLessThanOrEqual(viewport.clientHeight)
    expect(cards[1].getBoundingClientRect().toJSON()).toEqual(neighbor.toJSON())
    expect(cards[0].getBoundingClientRect().height).toBe(before.height)
    await userEvent.click(play)
    await expect(args.onPlay).toHaveBeenCalledWith(homeItems[0], true)
  },
}

export const LargeCoverPreviews: Story = {
  name: 'Agrandissement des grandes affiches et vignettes',
  parameters: { layout: 'fullscreen', cardWidth: '100%' },
  args: { onPlay: fn() },
  render: (args) => (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 32 }}>
      <div style={{ width: 'min(430px, 60vw, 52vh)' }}>
        <MediaTile {...args} item={homeItems[0]} />
      </div>
      <div style={{ width: 'min(1000px, 82vw, 105vh)' }}>
        <MediaTile {...args} item={homeResume[0]} wide />
      </div>
      <div style={{ width: 'min(620px, 72vw, 90vh)' }}>
        <MediaTile {...args} item={homeItems[2]} ranked />
      </div>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const cards = canvas.getAllByRole('article')
    for (const card of cards) {
      const trigger = card.querySelector<HTMLButtonElement>(
        '.artwork-preview-trigger',
      )!
      trigger.scrollIntoView({ block: 'center', behavior: 'instant' })
      const resting = trigger.getBoundingClientRect()
      await userEvent.hover(trigger)
      const panel = await canvas.findByRole('group', {
        name: card.getAttribute('aria-label')!,
      })
      const surface = panel.querySelector<HTMLElement>(
        '.artwork-preview-surface',
      )!
      await waitFor(() => {
        const expanded = surface.getBoundingClientRect()
        // These fixtures leave room for a visible enlargement on both axes.
        expect(expanded.width).toBeGreaterThanOrEqual(resting.width * 1.1)
        expect(expanded.height).toBeGreaterThanOrEqual(resting.height * 1.1)
        expect(expanded.left).toBeGreaterThanOrEqual(0)
        expect(expanded.top).toBeGreaterThanOrEqual(0)
        expect(expanded.right).toBeLessThanOrEqual(
          document.documentElement.clientWidth + 1,
        )
        expect(expanded.bottom).toBeLessThanOrEqual(
          document.documentElement.clientHeight + 1,
        )
        if (card.dataset.wide === 'true') {
          const image = panel
            .querySelector('.artwork-preview-hero')!
            .getBoundingClientRect()
          expect(image.width).toBeGreaterThanOrEqual(resting.width * 1.1)
          expect(image.height).toBeGreaterThanOrEqual(resting.height * 1.1)
        }
      })
      await userEvent.keyboard('{Escape}')
      await waitFor(() =>
        expect(trigger).toHaveAttribute('aria-expanded', 'false'),
      )
    }
  },
}

export const ExpandedLandscapeRail: Story = {
  name: 'Grand aperçu paysage en bord de rangée',
  parameters: { cardGrid: true },
  args: { onPlay: fn() },
  render: (args) => (
    <HorizontalRail
      trackClassName="home-resume-rail"
      previousLabel="Titres précédents"
      nextLabel="Titres suivants"
    >
      {homeItems.map((item) => (
        <MediaTile key={item.id} {...args} item={item} wide />
      ))}
    </HorizontalRail>
  ),
  play: async ({ canvas, userEvent }) => {
    const next = await canvas.findByRole('button', { name: 'Titres suivants' })
    const track = next.ownerDocument.getElementById(
      next.getAttribute('aria-controls')!,
    )!
    const viewport = next.ownerDocument.documentElement
    const compact = viewport.clientWidth < 800
    if (compact) {
      // Both edge arrows take space after the first page.
      track.scrollTo({ left: track.clientWidth, behavior: 'instant' })
      await waitFor(() =>
        expect(
          canvas.getByRole('button', { name: 'Titres précédents' }),
        ).toBeEnabled(),
      )
    }
    const pageStart = track.scrollLeft
    const arrow = next.getBoundingClientRect()
    const edgeCard = canvas
      .getAllByRole('article')
      .filter((card) => card.getBoundingClientRect().left < arrow.left)
      .at(-1)!
    const resting = edgeCard.getBoundingClientRect()
    await userEvent.hover(edgeCard)
    const panel = await canvas.findByRole('group', {
      name: edgeCard.getAttribute('aria-label')!,
    })
    const bounds = panel.getBoundingClientRect()
    const available = arrow.left - track.getBoundingClientRect().left
    expect(bounds.width).toBeGreaterThanOrEqual(
      Math.min(640, available * 0.85, viewport.clientHeight),
    )
    await waitFor(() => {
      const hero = panel
        .querySelector('.artwork-preview-hero')!
        .getBoundingClientRect()
      expect(hero.width).toBeGreaterThan(resting.width)
      expect(hero.height).toBeGreaterThan(resting.height)
      expect(bounds.left).toBeGreaterThanOrEqual(0)
      expect(bounds.right).toBeLessThanOrEqual(viewport.clientWidth + 1)
    })
    if (compact) {
      await userEvent.keyboard('{Escape}')
    } else {
      expect(bounds.right).toBeLessThanOrEqual(arrow.left + 1)
      const hit = next.ownerDocument.elementFromPoint(
        arrow.x + arrow.width / 2,
        arrow.y + arrow.height / 2,
      )
      expect(next.contains(hit)).toBe(true)
    }
    await userEvent.click(next)
    await waitFor(() => expect(track.scrollLeft).toBeGreaterThan(pageStart))
  },
}
export const QuietCard: Story = {
  name: 'Carte au repos',
  args: HoverPlay.args,
  play: async ({ canvas, args }) => {
    const article = canvas.getByRole('article', { name: args.item.title })
    await expect(article.textContent).toBe('')
    await expect(
      canvas.getByRole('button', {
        name: 'Voir la fiche de ' + args.item.title,
      }),
    ).toBeVisible()
    await expect(canvas.queryByRole('heading')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('group')).not.toBeInTheDocument()
  },
}
export const BalancedActions: Story = {
  name: 'Commandes alignées — lecture et actions secondaires',
  args: HoverPlay.args,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    const play = await canvas.findByRole('button', {
      name: 'Lire ' + args.item.title,
    })
    const favorite = canvas.getByRole('button', { name: 'Ajouter aux favoris' })
    expect(play.getBoundingClientRect().right).toBeLessThan(
      favorite.getBoundingClientRect().left,
    )
    await userEvent.click(favorite)
    await expect(args.onFavorite).toHaveBeenCalledWith(args.item, true)
  },
}
export const NarrowActions: Story = {
  name: 'Carte étroite — commandes sans chevauchement',
  parameters: { cardWidth: 169 },
  args: HoverPlay.args,
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.hover(canvas.getByRole('article'))
    const play = await canvas.findByRole('button', {
      name: 'Lire ' + args.item.title,
    })
    const favorite = canvas.getByRole('button', { name: 'Ajouter aux favoris' })
    await waitFor(() =>
      expect(favorite.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        44,
      ),
    )
    expect(play.getBoundingClientRect().right).toBeLessThan(
      favorite.getBoundingClientRect().left,
    )
    await userEvent.click(play)
    await expect(args.onPlay).toHaveBeenCalledWith(args.item, true)
  },
}

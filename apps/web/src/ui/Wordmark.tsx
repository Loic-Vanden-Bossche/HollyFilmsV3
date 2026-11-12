import logo from '../assets/logos/logo.svg'

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-baseline gap-2 font-logo leading-none font-normal ${compact ? 'text-2xl' : 'text-5xl sm:text-6xl'}`}
    >
      <img
        src={logo}
        alt=""
        width={40}
        height={32}
        className="h-[1cap] w-auto shrink-0"
      />
      <span className="bg-brand-gradient bg-clip-text text-transparent forced-colors:bg-none forced-colors:text-[CanvasText]">
        HollyFilms
      </span>
    </span>
  )
}

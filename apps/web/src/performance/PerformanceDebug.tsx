import { lazy, Suspense, useRef, useState, useSyncExternalStore } from 'react'
import { Activity } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider.tsx'
import { Tooltip } from '../ui/Tooltip.tsx'
import { usePerformanceController } from './PerformanceProvider.tsx'

const Panel = lazy(() => import('./PerformancePanel.tsx'))
export function PerformanceDebug() {
  const controller = usePerformanceController()
  const settings = useSyncExternalStore(
    controller.subscribeSettings,
    controller.getSettings,
    controller.getSettings,
  )
  return settings.admin ? <PerformanceDebugButton /> : null
}
function PerformanceDebugButton() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }
  return (
    <>
      <Tooltip>
        <button
          ref={trigger}
          type="button"
          className="performance-launch glass-control"
          aria-label={t('Débogage des performances')}
          onClick={() => setOpen(true)}
        >
          <Activity size={18} />
          <span>{t('Performances')}</span>
        </button>
      </Tooltip>
      {open && (
        <Suspense fallback={null}>
          <Panel onClose={close} />
        </Suspense>
      )}
    </>
  )
}

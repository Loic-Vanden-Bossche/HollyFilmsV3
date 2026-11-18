import { lazy, Suspense, useState, useSyncExternalStore } from 'react'
import { AnimatePresence } from 'motion/react'
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
  return (
    <>
      <Tooltip>
        <button
          type="button"
          className="performance-launch glass-control"
          aria-label={t('Débogage des performances')}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Activity size={18} />
          <span>{t('Performances')}</span>
        </button>
      </Tooltip>
      <Suspense fallback={null}>
        <AnimatePresence>
          {open && <Panel onClose={() => setOpen(false)} />}
        </AnimatePresence>
      </Suspense>
    </>
  )
}

import { useId } from 'react'
import { useI18n } from '../i18n/I18nProvider.tsx'
import {
  usePerformanceController,
  usePerformanceProfile,
} from './PerformanceProvider.tsx'
import { performanceProfiles } from './profiles.ts'

export function PerformancePreference() {
  const { t } = useI18n()
  const group = useId()
  const controller = usePerformanceController()
  const active = usePerformanceProfile()

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">
        {t('Mode de performance')}
      </legend>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-2">
        {performanceProfiles.map((profile) => {
          const id = group + profile.id
          return (
            <label
              key={profile.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-glass-edge bg-glass-control p-3 hover:border-link/50 has-checked:border-link has-checked:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            >
              <input
                type="radio"
                name={group}
                value={profile.id}
                checked={active.id === profile.id}
                onChange={() =>
                  controller.select(profile.id, performance.now())
                }
                aria-labelledby={id}
                aria-describedby={id + '-description'}
                className="mt-1 size-4 shrink-0 accent-link"
              />
              <span>
                <strong id={id} className="block text-sm font-semibold">
                  {t(profile.label)}
                </strong>
                <span
                  id={id + '-description'}
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  {t(
                    profile.id === 'light'
                      ? 'Mouvements réduits et affiches fixes.'
                      : 'Animations cinématiques et aperçus vidéo.',
                  )}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

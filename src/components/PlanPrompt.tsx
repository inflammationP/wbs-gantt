import { useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { useStore } from '../store/useStore'
import { planOn, plannedIds, promptDue } from '../lib/schedule'
import { useT } from '../lib/useT'
import { PlanDialog } from './PlanDialog'

/**
 * The start-of-day question, and the corner mark that survives "later".
 *
 * Opened once, on mount: a cold start is the app's morning. It is not reopened
 * when the date rolls over while the app keeps running — the tag is enough
 * then, and a modal arriving at midnight would be a modal arriving while
 * somebody is reading.
 *
 * The tag sits above the page and below the side panels (z-30 against their
 * z-40), so a task panel opening over it hides it without either part knowing
 * about the other.
 */
export function PlanPrompt() {
  const t = useT()
  const today = useStore((s) => s.today)
  const dayPlans = useStore((s) => s.dayPlans)
  const skipTodayPlan = useStore((s) => s.skipTodayPlan)
  const [open, setOpen] = useState(() => {
    const s = useStore.getState()
    return promptDue(planOn(s.dayPlans, s.today), s.planSkippedOn, s.today)
  })

  const unplanned = plannedIds(planOn(dayPlans, today)) === undefined

  return (
    <>
      {unplanned && !open && (
        <button
          onClick={() => setOpen(true)}
          title={t('plan.promptTag')}
          aria-label={t('plan.promptTag')}
          className="group fixed right-0 top-14 z-30 inline-flex items-center h-9 pl-3 pr-2 rounded-l-xl bg-accent text-on-accent text-[13px] font-medium shadow-[0_4px_18px_rgb(var(--c-accent)/0.45)] hover:brightness-110"
        >
          <CircleAlert size={15} className="shrink-0" />
          <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-200 group-hover:max-w-[7rem] group-hover:opacity-100 group-hover:ml-2 group-hover:mr-1">
            {t('plan.promptTab')}
          </span>
        </button>
      )}
      {open && (
        <PlanDialog
          day={today}
          prompt
          onClose={() => {
            // Closing without a plan is what "later" means; closing after
            // starting the day is not, and must not leave a skip behind.
            const s = useStore.getState()
            if (plannedIds(planOn(s.dayPlans, s.today)) === undefined) skipTodayPlan()
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

import { useMemo } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { choresTouching } from '../lib/chores'
import { diffDays, toDate } from '../lib/dates'
import { formatLongDate, formatRelativeDay } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { DayBoard } from './DayBoard'

/**
 * One day, opened from the Gantt's timeline header or a Calendar cell.
 *
 * The panel is now only the frame — the date it is showing, and the way out.
 * What a day contains moved to `DayBoard`, which the Today page renders too, so
 * that the two cannot come to different conclusions about the same day.
 */
export function DayDetailPanel({ day }: { day: string }) {
  const t = useT()
  const lang = useLang()
  const chores = useStore((s) => s.chores)
  const setSelectedDay = useStore((s) => s.setSelectedDay)

  // Subscribed but never read: the heading's relative label is built from the
  // clock, so it needs this component to re-render when `today` rolls over at
  // midnight, and nothing else here would.
  useStore((s) => s.today)

  // A record of the day: what was put on it, and what was finished on it. Not
  // the same question the Today page asks — see `DayBoard`'s `dayChores`.
  const dayChores = useMemo(() => choresTouching(chores, day), [chores, day])

  return (
    <aside className="w-[320px] shrink-0 border-l border-border bg-panel flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-fg">{formatRelativeDay(lang, diffDays(new Date(), toDate(day)))}</div>
            <div className="font-mono text-[11px] text-muted mt-0.5">{formatLongDate(lang, toDate(day))}</div>
          </div>
          <button
            onClick={() => setSelectedDay(null)}
            className="text-dim hover:text-fg shrink-0 mt-0.5"
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <DayBoard day={day} dayChores={dayChores} layout="stack" />
    </aside>
  )
}

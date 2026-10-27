import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { addDays, startOfWeek, toDate, toISO } from '../lib/dates'
import { plannedFor, todaysChores } from '../lib/chores'
import { formatShortDate, weekdayName } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { DayBoard } from '../components/DayBoard'
import { Timetable } from '../components/Timetable'
import { Segmented } from '../components/ui'

type TodayView = 'today' | 'tomorrow' | 'week'

/**
 * Three views of the same question: what is on, and when.
 *
 * Today and Tomorrow pair the day's list with a single-column timetable; This
 * week is the timetable alone, seven columns wide, for the macro read. The old
 * side-by-side Today/Tomorrow pair is gone — it made each day half a screen
 * when what a day needed was its own timetable beside it.
 */
export function TodayPage() {
  const t = useT()
  const lang = useLang()
  const today = useStore((s) => s.today)
  const [view, setView] = useState<TodayView>('today')
  const tomorrow = toISO(addDays(toDate(today), 1))
  const weekDays = useMemo(() => {
    const start = startOfWeek(toDate(today))
    return Array.from({ length: 7 }, (_, i) => toISO(addDays(start, i)))
  }, [today])

  const activeDate = view === 'today' ? today : tomorrow
  const heading =
    view === 'week' ? t('time.thisWeek') : weekdayName(lang, toDate(activeDate).getDay())
  const subheading =
    view === 'week'
      ? `${formatShortDate(lang, toDate(weekDays[0]))} – ${formatShortDate(lang, toDate(weekDays[6]))}`
      : formatShortDate(lang, toDate(activeDate))

  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at 18% -12%, rgb(var(--c-accent) / 0.07), transparent 52%), radial-gradient(rgb(var(--c-fg) / 0.045) 1px, transparent 1px)',
        backgroundSize: 'auto, 22px 22px',
      }}
    >
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold text-fg">{heading}</div>
          <div className="mt-0.5 font-mono text-[11px] text-dim">{subheading}</div>
        </div>
        <Segmented<TodayView>
          pill
          value={view}
          onChange={setView}
          options={[
            { value: 'today', label: t('time.today') },
            { value: 'tomorrow', label: t('time.tomorrow') },
            { value: 'week', label: t('time.thisWeek') },
          ]}
        />
      </div>

      {view === 'week' ? (
        <div className="flex-1 min-h-0 px-3 pb-3">
          <div className="h-full rounded-2xl border border-border/70 bg-panel shadow-sm overflow-hidden">
            <Timetable days={weekDays} className="h-full" />
          </div>
        </div>
      ) : (
        <DayView date={activeDate} editable={view === 'today'} />
      )}
    </div>
  )
}

function DayView({ date, editable }: { date: string; editable: boolean }) {
  const chores = useStore((s) => s.chores)
  const habits = useStore((s) => s.habits)
  const today = useStore((s) => s.today)
  const addChore = useStore((s) => s.addChore)
  const toggleHabit = useStore((s) => s.toggleHabit)

  // Which question is being asked of the chores depends on which day this is:
  // today carries slipped work forward and keeps what was finished as the day's
  // tally; tomorrow is a plain plan. Chosen here rather than guessed inside
  // `DayBoard`, the same split the old Today/Tomorrow columns made.
  const dayChores = useMemo(
    () => (date <= today ? todaysChores(chores, today) : plannedFor(chores, date)),
    [chores, today, date],
  )

  return (
    <div className="flex-1 min-h-0 flex gap-3 px-3 pb-3">
      <div className="flex-1 min-w-0 flex flex-col rounded-2xl border border-border/70 bg-panel shadow-sm overflow-hidden">
        <DayBoard
          day={date}
          dayChores={dayChores}
          habits={habits}
          // Tasks on the left, routines and chores in their own pane on the
          // right — the arrangement the old Today page had. The timetable is
          // the next column over, not a replacement for either.
          layout="side"
          onAddChore={(title, slot) => addChore(title, date, slot)}
          habitsEditable={editable}
          onToggleHabit={editable ? toggleHabit : undefined}
          plannable
        />
      </div>
      <div className="w-[clamp(320px,32%,440px)] shrink-0 rounded-2xl border border-border/70 bg-panel shadow-sm overflow-hidden flex flex-col">
        <Timetable days={[date]} className="flex-1 min-h-0" />
      </div>
    </div>
  )
}

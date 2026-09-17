import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { addDays, toDate, toISO } from '../lib/dates'
import { plannedFor, todaysChores } from '../lib/chores'
import { useT } from '../lib/useT'
import { DayBoard } from '../components/DayBoard'

/**
 * Today and tomorrow, side by side.
 *
 * Two columns rather than two pages because the honest question at the end of a
 * day is "does anything belong to tomorrow", and answering it should not mean
 * navigating away from what is still open today. The focused column is both
 * wider and at full strength; the other is narrowed and dimmed rather than
 * hidden, so it stays readable without competing.
 *
 * Each column carries the whole day — the same thing the day panel shows, down
 * to the log-writing button — because the point of the page is to run the day
 * from one place rather than to be a second, thinner view of it.
 *
 * No `<h1>`: the two column headings already say Today and Tomorrow, and a page
 * title above them would be the third time.
 */
export function TodayPage() {
  const t = useT()
  const today = useStore((s) => s.today)
  const [focused, setFocused] = useState<'today' | 'tomorrow'>('today')

  const tomorrow = toISO(addDays(toDate(today), 1))

  return (
    <div className="flex-1 min-h-0 flex">
      <Column
        title={t('time.today')}
        date={today}
        focused={focused === 'today'}
        onFocus={() => setFocused('today')}
        divider
      />
      <Column
        title={t('time.tomorrow')}
        date={tomorrow}
        focused={focused === 'tomorrow'}
        onFocus={() => setFocused('tomorrow')}
      />
    </div>
  )
}

function Column({
  title,
  date,
  focused,
  onFocus,
  divider,
}: {
  title: string
  /** The day this column is, and the day a chore typed into it is filed under. */
  date: string
  focused: boolean
  onFocus: () => void
  divider?: boolean
}) {
  const chores = useStore((s) => s.chores)
  const today = useStore((s) => s.today)
  const addChore = useStore((s) => s.addChore)

  // Which day this is decides which question is being asked of the chores, and
  // the two have opposite shapes: today's column carries slipped work forward
  // and keeps what was finished as the day's tally, tomorrow's is a plain plan
  // and holds nothing already done. Chosen here rather than guessed at inside
  // `DayBoard`.
  const dayChores = useMemo(
    () => (date <= today ? todaysChores(chores, today) : plannedFor(chores, date)),
    [chores, today, date],
  )

  return (
    // `onMouseDown` rather than `onClick`: a click on a control in the *other*
    // column has to widen that column on the way to the control, not after it.
    <section
      onMouseDown={onFocus}
      className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ease-out ${
        divider ? 'border-r border-border' : ''
      } ${focused ? 'opacity-100' : 'opacity-45 hover:opacity-75'}`}
      style={{ flexGrow: focused ? 1.5 : 1 }}
    >
      <div className="shrink-0 flex items-baseline gap-2 px-4 py-3 border-b border-border">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      </div>

      <DayBoard day={date} dayChores={dayChores} layout="side" onAddChore={(title) => addChore(title, date)} />
    </section>
  )
}

import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { addDays, startOfWeek, toDate, toISO } from '../lib/dates'
import { DayTally, boardDayTallies, branchDayTallies } from '../lib/heatmap'
import { sig, sigAlpha } from '../lib/ui'
import { formatDayMonthYear, monthAbbr, weekdayLabels } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'

// GitHub's own geometry: a square, a gutter, seven days to a column.
const CELL = 10
const GAP = 2
const PITCH = CELL + GAP
const ROWS = 7
// How many weeks the task panel fits at that cell size: about five months, with
// room to spare for the scrollbar. Manage's overview is a page wide and asks for
// a full year.
const PANEL_WEEKS = 20
export const YEAR_WEEKS = 53
const MONTH_ROW = 13
const RAIL_W = 24

/** An empty square: nothing was finished that day. */
const OFF = sigAlpha('not-started', 0.28)
/** A filled square: the day was done. */
const ON = sig('completed')
/**
 * The board's ramp — one hue, four steps, by how much a day got finished.
 * GitHub's breakpoints, because a board's day and a profile's day are the same
 * size of number: one thing, a couple, a handful, or a real day's work.
 */
const LEVELS = [0.3, 0.5, 0.72, 1].map((a) => sigAlpha('completed', a))
const level = (done: number) => (done >= 10 ? 4 : done >= 4 ? 3 : done >= 2 ? 2 : 1)

interface Props {
  /** The branch to read, or null for the whole board (Manage's overview). */
  taskId: string | null
  /** The subject's own first and last day, for the tooltip's "nothing scheduled"
   *  case. The board has no such window, so both are null there. */
  start: string | null
  end: string | null
  weeks?: number
  /** Heading above the grid, where the page does not supply one of its own. */
  title?: string
}

/**
 * Days as a grid of squares — a week to a column, a weekday to a row.
 *
 * Two states and no ramp: a day is either done or it isn't, and a shade in
 * between would claim a resolution the underlying fact does not have. Which days
 * count is `branchDoneDays` / `boardDoneDays`, the one place that rule is
 * written.
 */
export function CompletionHeatmap({ taskId, start, end, weeks = PANEL_WEEKS, title }: Props) {
  const t = useT()
  const lang = useLang()
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const chores = useStore((s) => s.chores)
  const today = useStore((s) => s.today)

  const grid = useMemo(() => {
    // The window ends where the subject does; for the board that is today, which
    // is where done days stop anyway. A task that has not begun yet anchors on
    // its start instead, or the grid would show the weeks before it and nothing
    // of the task.
    const last = toISO(toDate(end ?? today))
    const anchor = start != null && start > last ? start : last
    const lastMonday = startOfWeek(toDate(anchor))
    const first = toISO(addDays(lastMonday, -(weeks - 1) * 7))
    const days = Array.from({ length: weeks * ROWS }, (_, i) => addDays(toDate(first), i))
    const isos = days.map(toISO)
    // Chores go to the board and not to a branch: they belong to no task.
    const tallies = taskId == null
      ? boardDayTallies(tasks, logs, chores, today, isos)
      : branchDayTallies(tasks, logs, today, taskId, isos)
    return { last, days, tallies }
  }, [start, end, taskId, weeks, tasks, logs, chores, today])

  const { last, days, tallies } = grid
  const weeksDr = days.length / ROWS
  // The board is shaded by how much a day got done; a task is not. One task's day
  // is clean or it isn't, and a shade between the two would claim a resolution
  // the fact does not have.
  const isBoard = taskId == null

  const shade = (tally: DayTally) => {
    if (tally.done === 0) return OFF
    if (isBoard) return LEVELS[level(tally.done) - 1]
    return tally.done === tally.total ? ON : OFF
  }

  const cellTitle = (iso: string) => {
    const date = formatDayMonthYear(lang, toDate(iso))
    const tally = tallies.get(iso)
    if (tally && tally.done > 0) {
      return `${date} · ${isBoard ? t('task.heat.count', { count: tally.done }) : t('task.heat.done')}`
    }
    // Nothing was scheduled, which is a different fact from "scheduled and not
    // done" — but only a task has a window to be outside of.
    if (start != null && (iso < start || iso > last)) return `${date} · ${t('task.heat.none')}`
    return `${date} · ${t('task.heat.pending')}`
  }

  // A month is named on the column it first appears in, the way GitHub does it.
  const months: { left: number; text: string }[] = []
  let prevMonth = -1
  for (let c = 0; c < weeksDr; c++) {
    const m = days[c * ROWS].getMonth()
    if (m === prevMonth) continue
    prevMonth = m
    months.push({ left: c * PITCH, text: monthAbbr(lang, m) })
  }

  return (
    <div>
      {title && <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{title}</div>}
      <div className="flex gap-1">
        {/* Weekday rail, three names like GitHub's: enough to read the rows
            without a label on every one. */}
        <div className="shrink-0 flex flex-col" style={{ width: RAIL_W, paddingTop: MONTH_ROW, gap: GAP }}>
          {weekdayLabels(lang).map((w, i) => (
            <div key={w} className="text-[9px] leading-none text-dim flex items-center" style={{ height: CELL }}>
              {i % 2 === 0 && i < 6 ? w : ''}
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <div className="relative" style={{ height: MONTH_ROW }}>
            {months.map((m) => (
              <span key={m.left} className="absolute top-0 text-[9px] leading-none text-dim" style={{ left: m.left }}>
                {m.text}
              </span>
            ))}
          </div>
          {/* Squares placed by arithmetic rather than by `grid-auto-flow`.
              Column-major flow with no row template defined puts every square in
              a single row, and the whole block hangs on that one property
              holding. Two multiplications cannot collapse. */}
          <div className="relative" style={{ width: weeksDr * PITCH - GAP, height: ROWS * PITCH - GAP }}>
            {days.map((d, i) => {
              const iso = toISO(d)
              return (
                <div
                  key={iso}
                  title={cellTitle(iso)}
                  className="absolute rounded-[1px]"
                  style={{
                    left: Math.floor(i / ROWS) * PITCH,
                    top: (i % ROWS) * PITCH,
                    width: CELL,
                    height: CELL,
                    background: shade(tallies.get(iso) ?? { total: 0, done: 0 }),
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-1.5 text-[9px] text-dim">
        <span>{isBoard ? t('task.heat.less') : t('task.heat.pending')}</span>
        {(isBoard ? [OFF, ...LEVELS] : [OFF, ON]).map((bg) => (
          <span key={bg} className="w-2.5 h-2.5 rounded-[1px]" style={{ background: bg }} />
        ))}
        <span>{isBoard ? t('task.heat.more') : t('task.heat.done')}</span>
      </div>
    </div>
  )
}

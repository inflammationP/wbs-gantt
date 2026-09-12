import { Task, ViewMode } from '../types'
import {
  Unit, toDate, toISO, addUnit, addMonths, addDays, addHours, startOfDay, startOfWeek, startOfMonth,
  startOfQuarter, startOfYear, diffDays, diffMonths, daysInMonth, isWeekend, isoWeekNumber,
  MONTHS, MONTHS_SHORT,
} from './dates'

export interface TimelineCell {
  key: string
  start: Date
  end: Date
  label: string
  weekend: boolean
  today: boolean
}
export interface TimelineGroup {
  key: string
  label: string
  cells: number
  today?: boolean
}
export interface Timeline {
  mode: ViewMode
  unit: Unit
  colWidth: number
  start: Date
  end: Date
  cells: TimelineCell[]
  groups: TimelineGroup[]
  totalWidth: number
}

// The selected granularity is the unit of each column. Each column is grouped
// by the next-larger calendar unit (except Year, which has no larger unit).
const CONFIG: Record<ViewMode, { unit: Unit; colWidth: number; groupUnit: Unit | null }> = {
  day: { unit: 'day', colWidth: 40, groupUnit: 'week' },
  week: { unit: 'week', colWidth: 56, groupUnit: 'month' },
  month: { unit: 'month', colWidth: 90, groupUnit: 'quarter' },
  quarter: { unit: 'quarter', colWidth: 80, groupUnit: 'year' },
  year: { unit: 'year', colWidth: 200, groupUnit: null },
}

// Fixed horizontal offset (px) from the left task panel's right edge to the
// focused date. Used when the view scrolls back to today.
export const FOCUS_OFFSET_PX = 160

// How much history the axis always reaches back over. Past days have to stay
// reachable — the day panel and the log ring live there — but not forever.
const HISTORY_DAYS = 30

// The span is never narrower than this, so `today ± 30 days` is always there
// even when the data is empty or clustered.
const MIN_SPAN_DAYS = 60

// How far past the last deadline the axis runs, so the final bar is not flush
// against the right edge.
const TAIL_DAYS = 10

// Slack, in columns, added to each side of the coarse-zoom floor below, so
// today never sits pinned to the very edge of the axis.
const SIDE_SLACK = 5

export interface DateRange {
  start: Date
  /** Exclusive. */
  end: Date
}

/** Round a date down to the start of its `unit`. */
function snapDown(unit: Unit, d: Date): Date {
  switch (unit) {
    case 'week': return startOfWeek(d)
    case 'month': return startOfMonth(d)
    case 'quarter': return startOfQuarter(d)
    case 'year': return startOfYear(d)
    default: return startOfDay(d)
  }
}

/** How many whole `unit` steps fit between `start` and the exclusive `end`. */
function unitSteps(unit: Unit, start: Date, end: Date): number {
  let n = 0
  let d = start
  // Bounded so a bad range can never spin here.
  while (d < end && n < 20000) {
    d = addUnit(d, unit, 1)
    n++
  }
  return n
}

/**
 * The stretch of time the axis covers, given the tasks in view.
 *
 * Three inputs, in order: the data itself, a symmetric floor for the coarse
 * zooms, and a floor on the total span.
 */
export function timelineRange(mode: ViewMode, tasks: Task[], todayISO: string, canvasWidth: number): DateRange {
  const { unit, colWidth } = CONFIG[mode]
  const today = startOfDay(toDate(todayISO))

  // 1. The data. Long-term goals have no deadline and to-dos have no dates, so
  //    neither can extend the axis.
  let rawStart = addDays(today, -HISTORY_DAYS)
  let rawEnd = addDays(today, MIN_SPAN_DAYS - HISTORY_DAYS)
  let lastEnd: Date | null = null
  for (const t of tasks) {
    if (t.isTodo || t.type === 'long-term' || t.endDate == null) continue
    const e = toDate(t.endDate)
    if (lastEnd == null || e > lastEnd) lastEnd = e
  }
  if (lastEnd != null) {
    const withTail = addDays(lastEnd, TAIL_DAYS)
    if (withTail > rawEnd) rawEnd = withTail
  }

  // 2. A symmetric floor around today for everything but `day`. Day columns are
  //    narrow enough that the data alone overfills the canvas; the wider units
  //    are not — a quarter column is 80px, so a 130-day span would come to two
  //    columns and leave the axis as a sliver at the left of the window.
  const fillColumns = Math.max(1, Math.ceil(canvasWidth / colWidth))
  if (mode !== 'day') {
    const side = Math.ceil(fillColumns / 2) + SIDE_SLACK
    const lo = addUnit(today, unit, -side)
    const hi = addUnit(today, unit, side)
    if (lo < rawStart) rawStart = lo
    if (hi > rawEnd) rawEnd = hi
  }

  // 3. Never let the axis be narrower than the window. Mostly this is the `day`
  //    case on an ultra-wide monitor, where 60 days is not 60 columns' worth.
  const start = snapDown(unit, rawStart)
  let end = addUnit(snapDown(unit, rawEnd), unit, 1)
  const have = unitSteps(unit, start, end)
  if (have < fillColumns) end = addUnit(end, unit, fillColumns - have)

  return { start, end }
}

function cellLabel(unit: Unit, d: Date): string {
  switch (unit) {
    case 'day': return String(d.getDate())
    case 'week': return `W${isoWeekNumber(d)}`
    case 'month': return MONTHS_SHORT[d.getMonth()]
    case 'quarter': return `Q${Math.floor(d.getMonth() / 3) + 1}`
    case 'year': return String(d.getFullYear())
    case 'hour': return String(d.getHours())
  }
}

function groupKeyFor(unit: Unit, d: Date): string {
  switch (unit) {
    case 'week': return toISO(startOfWeek(d))
    case 'month': return `${d.getFullYear()}-${d.getMonth()}`
    case 'quarter': return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3)}`
    case 'year': return `${d.getFullYear()}`
    default: return ''
  }
}

function groupLabelFor(unit: Unit, d: Date): string {
  switch (unit) {
    case 'week': {
      const monday = startOfWeek(d)
      const sunday = addDays(monday, 6)
      if (monday.getFullYear() !== sunday.getFullYear()) {
        return `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()}, ${monday.getFullYear()} – ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`
      }
      return `${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()} – ${MONTHS_SHORT[sunday.getMonth()]} ${sunday.getDate()}`
    }
    case 'month': return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    case 'quarter': return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
    case 'year': return `${d.getFullYear()}`
    default: return ''
  }
}

export function buildTimeline(mode: ViewMode, range: DateRange): Timeline {
  const { unit, colWidth, groupUnit } = CONFIG[mode]
  // `range` is already snapped out to whole units, so this counts exactly.
  const start = range.start
  const count = Math.max(1, unitSteps(unit, start, range.end))
  const end = addUnit(start, unit, count)

  const cells: TimelineCell[] = []
  const today = startOfDay(new Date())
  for (let i = 0; i < count; i++) {
    const d = addUnit(start, unit, i)
    const next = addUnit(d, unit, 1)
    cells.push({
      key: `${toISO(d)}#${i}`,
      start: d,
      end: next,
      label: cellLabel(unit, d),
      weekend: unit === 'day' && isWeekend(d),
      today: today >= d && today < next,
    })
  }

  let groups: TimelineGroup[]
  if (groupUnit == null) {
    const startYear = start.getFullYear()
    const endYear = addDays(end, -1).getFullYear()
    groups = [{ key: 'range', label: `${startYear} – ${endYear}`, cells: cells.length, today: true }]
  } else {
    groups = []
    for (const c of cells) {
      const k = groupKeyFor(groupUnit, c.start)
      const last = groups[groups.length - 1]
      if (last && last.key === k) {
        last.cells++
        if (c.today) last.today = true
      } else {
        groups.push({ key: k, label: groupLabelFor(groupUnit, c.start), cells: 1, today: c.today })
      }
    }
  }

  return {
    mode, unit, colWidth, start, end,
    cells, groups,
    totalWidth: cells.length * colWidth,
  }
}

export function dateToX(date: Date, tl: Timeline): number {
  const { unit, colWidth, start } = tl
  const fracMonth = (d: Date) => (d.getDate() - 1) / daysInMonth(d.getFullYear(), d.getMonth())
  switch (unit) {
    case 'day': return diffDays(start, date) * colWidth
    case 'week': return (diffDays(start, date) / 7) * colWidth
    case 'month': return (diffMonths(start, date) + fracMonth(date)) * colWidth
    case 'quarter': return ((diffMonths(start, date) + fracMonth(date)) / 3) * colWidth
    case 'year': return ((diffMonths(start, date) + fracMonth(date)) / 12) * colWidth
    case 'hour': return ((date.getTime() - start.getTime()) / 3600000) * colWidth
  }
}

/**
 * The date at a pixel offset — the inverse of `dateToX`, at day granularity.
 *
 * Deliberately not "which column is this": at week/month/quarter/year zoom one
 * column spans many days, and only the pointer's x knows which day inside it
 * was meant. This is what makes every date the timeline shows reachable.
 */
export function xToDate(x: number, tl: Timeline): Date {
  const { unit, colWidth, start } = tl
  const units = x / colWidth
  // `start` is always the 1st (or a Monday) in the month-family modes, so
  // stepping whole months from it lands on a 1st too.
  // `dateToX` feeds back a value that has been divided by the column count and
  // re-multiplied, so exact boundaries arrive a hair low — a month start can
  // read as 0.9999999999999998 and `7/31 * 31` as 6.999999999999999. Both the
  // month index and the in-month fraction need the nudge; at these magnitudes it
  // is ~1e-7 of a day, far below anything a pointer could express.
  const EPS = 1e-9
  const monthAt = (months: number) => {
    const whole = Math.floor(months + EPS)
    const frac = Math.min(1, Math.max(0, months - whole))
    const base = addMonths(start, whole)
    const dim = daysInMonth(base.getFullYear(), base.getMonth())
    const day = Math.min(dim, Math.max(1, Math.floor(frac * dim + EPS) + 1))
    return new Date(base.getFullYear(), base.getMonth(), day)
  }
  switch (unit) {
    case 'day': return addDays(start, Math.floor(units))
    case 'week': return addDays(start, Math.floor(units) * 7)
    case 'month': return monthAt(units)
    case 'quarter': return monthAt(units * 3)
    case 'year': return monthAt(units * 12)
    case 'hour': return addHours(start, Math.floor(units))
  }
}

/** Short label for the stretch of time the axis covers, e.g. `Aug 13 – Dec 21`. */
export function rangeLabel(range: DateRange): string {
  const s = range.start
  const e = addDays(range.end, -1) // `end` is exclusive
  const left = `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}`
  const right = `${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
  return s.getFullYear() === e.getFullYear() ? `${left} – ${right}` : `${left}, ${s.getFullYear()} – ${right}`
}

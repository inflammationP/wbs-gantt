import { ViewMode } from '../types'
import {
  Unit, toDate, toISO, addUnit, addMonths, addDays, startOfDay, startOfWeek, startOfMonth,
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

// Range start: center the anchor's current period and span `count` columns.
function rangeStart(mode: ViewMode, anchor: Date, count: number): Date {
  const half = Math.floor(count / 2)
  switch (mode) {
    case 'day': return addDays(startOfDay(anchor), -half)
    case 'week': return addDays(startOfWeek(anchor), -half * 7)
    case 'month': return addMonths(startOfMonth(anchor), -half)
    case 'quarter': return addMonths(startOfQuarter(anchor), -half * 3)
    case 'year': return addMonths(startOfYear(anchor), -half * 12)
  }
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

export function buildTimeline(mode: ViewMode, anchorISO: string, canvasWidth: number): Timeline {
  const anchor = toDate(anchorISO)
  const { unit, colWidth, groupUnit } = CONFIG[mode]
  // Integer number of columns that fills the visible canvas.
  const count = Math.max(1, Math.ceil(canvasWidth / colWidth))
  const start = rangeStart(mode, anchor, count)
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

export function shiftAnchor(mode: ViewMode, anchorISO: string, dir: 1 | -1): string {
  const a = toDate(anchorISO)
  const unit = CONFIG[mode].groupUnit ?? 'year'
  return toISO(addUnit(a, unit, dir))
}

export function periodLabel(mode: ViewMode, anchorISO: string): string {
  const a = toDate(anchorISO)
  switch (mode) {
    case 'day': {
      const monday = startOfWeek(a)
      return `Week of ${MONTHS_SHORT[monday.getMonth()]} ${monday.getDate()}, ${monday.getFullYear()}`
    }
    case 'week': return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`
    case 'month': return `Q${Math.floor(a.getMonth() / 3) + 1} ${a.getFullYear()}`
    case 'quarter':
    case 'year': return String(a.getFullYear())
  }
}

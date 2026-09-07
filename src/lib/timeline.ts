import { ViewMode } from '../types'
import {
  Unit, toDate, toISO, addUnit, addMonths, startOfDay, startOfWeek, startOfMonth,
  startOfQuarter, startOfYear, diffDays, diffMonths, daysInMonth, isWeekend, isToday,
  pad, MONTHS, MONTHS_SHORT, WEEKDAYS, formatLong,
} from './dates'

export interface TimelineCell {
  key: string
  start: Date
  label: string
  weekend: boolean
  today: boolean
}
export interface TimelineGroup {
  key: string
  label: string
  cells: number
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

const CONFIG: Record<ViewMode, { unit: Unit; colWidth: number }> = {
  day: { unit: 'hour', colWidth: 40 },
  week: { unit: 'day', colWidth: 48 },
  month: { unit: 'day', colWidth: 30 },
  quarter: { unit: 'week', colWidth: 40 },
  year: { unit: 'month', colWidth: 90 },
}

function rangeStart(mode: ViewMode, anchor: Date): Date {
  switch (mode) {
    case 'day': return startOfDay(anchor)
    case 'week': return startOfWeek(anchor)
    case 'month': return startOfMonth(anchor)
    case 'quarter': return startOfQuarter(anchor)
    case 'year': return startOfYear(anchor)
  }
}

function cellLabel(unit: Unit, d: Date, i: number): string {
  switch (unit) {
    case 'hour': return pad(d.getHours())
    case 'day': return String(d.getDate())
    case 'week': return `W${i + 1}`
    case 'month': return MONTHS_SHORT[d.getMonth()]
  }
}

function groupKey(mode: ViewMode, d: Date): string {
  switch (mode) {
    case 'day': return toISO(d)
    case 'week':
    case 'month':
    case 'quarter': return `${d.getFullYear()}-${d.getMonth()}`
    case 'year': return `Q${Math.floor(d.getMonth() / 3)}${d.getFullYear()}`
  }
}

function groupLabel(mode: ViewMode, d: Date): string {
  switch (mode) {
    case 'day': return formatLong(d)
    case 'week':
    case 'quarter': return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
    case 'month': return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    case 'year': return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
  }
}

export function buildTimeline(mode: ViewMode, anchorISO: string): Timeline {
  const anchor = toDate(anchorISO)
  const { unit, colWidth } = CONFIG[mode]
  const start = rangeStart(mode, anchor)
  let count: number
  switch (mode) {
    case 'day': count = 24; break
    case 'week': count = 7; break
    case 'month': count = daysInMonth(anchor.getFullYear(), anchor.getMonth()); break
    case 'quarter': count = Math.ceil(diffDays(start, addMonths(start, 3)) / 7); break
    case 'year': count = 12; break
  }
  const cells: TimelineCell[] = []
  for (let i = 0; i < count; i++) {
    const d = addUnit(start, unit, i)
    cells.push({
      key: `${toISO(d)}#${i}`,
      start: d,
      label: cellLabel(unit, d, i),
      weekend: unit === 'day' && isWeekend(d),
      today: isToday(d),
    })
  }
  const groups: TimelineGroup[] = []
  for (const c of cells) {
    const k = groupKey(mode, c.start)
    const last = groups[groups.length - 1]
    if (last && last.key === k) last.cells++
    else groups.push({ key: k, label: groupLabel(mode, c.start), cells: 1 })
  }
  return {
    mode, unit, colWidth, start,
    end: addUnit(start, unit, count),
    cells, groups, totalWidth: count * colWidth,
  }
}

export function dateToX(date: Date, tl: Timeline): number {
  const { unit, colWidth, start } = tl
  switch (unit) {
    case 'hour': return ((date.getTime() - start.getTime()) / 3600000) * colWidth
    case 'day': return diffDays(start, date) * colWidth
    case 'week': return (diffDays(start, date) / 7) * colWidth
    case 'month': {
      const m = diffMonths(start, date)
      const frac = (date.getDate() - 1) / daysInMonth(date.getFullYear(), date.getMonth())
      return (m + frac) * colWidth
    }
  }
}

export function shiftAnchor(mode: ViewMode, anchorISO: string, dir: 1 | -1): string {
  const a = toDate(anchorISO)
  switch (mode) {
    case 'day': return toISO(addUnit(a, 'day', dir))
    case 'week': return toISO(addUnit(a, 'week', dir))
    case 'month': return toISO(addMonths(a, dir))
    case 'quarter': return toISO(addMonths(a, dir * 3))
    case 'year': return toISO(addMonths(a, dir * 12))
  }
}

export function periodLabel(mode: ViewMode, anchorISO: string): string {
  const a = toDate(anchorISO)
  switch (mode) {
    case 'day': return formatLong(a)
    case 'week': {
      const s = startOfWeek(a)
      const e = addUnit(s, 'day', 6)
      return `${MONTHS_SHORT[s.getMonth()]} ${s.getDate()} – ${MONTHS_SHORT[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`
    }
    case 'month': return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`
    case 'quarter': return `Q${Math.floor(a.getMonth() / 3) + 1} ${a.getFullYear()}`
    case 'year': return String(a.getFullYear())
  }
}

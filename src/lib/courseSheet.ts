import { CourseSession } from '../types'
import { addDays, diffDays, pad, toDate, toISO, weekdayIndex } from './dates'
import { minutesOf } from './schedule'

/**
 * Reading the school's weekly timetable sheets.
 *
 * The two shapes the exporter produces are one layout with an optional extra
 * time column: a week sheet (`S7`, `S11`, …) holds one row per teaching period,
 * one merged column range per day, and one course per cell. The per-week sheets
 * are already resolved — a course that does not run that week is not in them —
 * so the week range printed inside a cell is not parsed. That text stays in the
 * note; the sheet name is the week.
 *
 * Everything here is pure: the caller turns a workbook into `SheetGrid`s (see
 * `lib/xlsx.ts`), and the checks feed it grids directly.
 */

export type SheetCellValue = string | number

export interface SheetGrid {
  /** The sheet name, which is where `S11`'s week number comes from. */
  name: string
  /** A1 → value, as stored. Text stays text; numeric date cells stay numbers. */
  cells: Map<string, SheetCellValue>
  /** Merged ranges, e.g. `D4:G4`, exactly as the file spells them. */
  merges: string[]
}

export interface ParsedCourseSheet {
  week: number
  /** The Monday of that sheet's week, `yyyy-MM-dd`. */
  monday: string
  sessions: CourseSession[]
}

interface Range {
  c1: number
  r1: number
  c2: number
  r2: number
}

const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
}

/** Accents and case are noise in a month name; `février` and `Fevrier` agree. */
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const key = (c: number, r: number) => `${c},${r}`

function parseRef(ref: string): { c: number; r: number } | null {
  const m = ref.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  let c = 0
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64
  return { c, r: Number(m[2]) }
}

function parseRange(ref: string): Range | null {
  const [a, b = a] = ref.split(':')
  const from = parseRef(a)
  const to = parseRef(b)
  if (!from || !to) return null
  return {
    c1: Math.min(from.c, to.c),
    r1: Math.min(from.r, to.r),
    c2: Math.max(from.c, to.c),
    r2: Math.max(from.r, to.r),
  }
}

/** `S11` in any casing; `ORI` and anything else is not a week sheet. */
export function parseSheetWeek(name: string): number | null {
  const m = name.trim().match(/^S\s*(\d{1,3})$/i)
  return m ? Number(m[1]) : null
}

/** The first year in the workbook's `2026-2027-1` label. */
export function parseSemesterStartYear(text: string | null | undefined): number | null {
  const m = text?.match(/(20\d{2})\s*[-–/]\s*(20\d{2})/)
  return m ? Number(m[1]) : null
}

/**
 * A date cell as `yyyy-MM-dd`.
 *
 * Two spellings occur: a real Excel serial (a number, used by the sheets whose
 * dates are formatted) and the exporter's own `2 novembre` text. The text has
 * no year, so the workbook's academic label supplies the start year: August to
 * December is its first year, January to July its second.
 */
export function parseSheetDate(value: SheetCellValue, startYear: number | null): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 20000 || value > 80000) return null
    // Excel's day 1 is 1900-01-01, with its deliberate 1900 leap-year quirk;
    // 1899-12-30 is the epoch that accounts for it.
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  const text = fold(String(value))
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const m = text.match(/^(\d{1,2})\s+([a-z]+)/)
  if (!m || startYear == null) return null
  const day = Number(m[1])
  const month = MONTHS[m[2]]
  if (!month || day < 1 || day > 31) return null
  const year = month >= 8 ? startYear : startYear + 1
  return `${year}-${pad(month)}-${pad(day)}`
}

/** A row label like `Séance 1 8H00-8H45` or `Séance 11-13 19H00-21H30`. */
export function parseSheetTime(text: string): { start: string; end: string } | null {
  const pairs = [...text.matchAll(/(\d{1,2})\s*[Hh]\s*(\d{2})/g)]
  if (pairs.length < 2) return null
  const norm = (h: string, m: string) => {
    const hours = Number(h)
    const minutes = Number(m)
    return hours < 24 && minutes < 60 ? `${pad(hours)}:${m}` : null
  }
  const start = norm(pairs[0][1], pairs[0][2])
  const end = norm(pairs[pairs.length - 1][1], pairs[pairs.length - 1][2])
  if (!start || !end || (minutesOf(end) ?? 0) <= (minutesOf(start) ?? 0)) return null
  return { start, end }
}

/** Whether a cell could be a day date, before the year has been worked out. */
function looksLikeDate(value: SheetCellValue | undefined): boolean {
  if (value === undefined) return false
  if (typeof value === 'number') return value >= 20000 && value <= 80000
  const text = fold(value)
  return /^\d{1,2}\s+[a-z]+/.test(text) || /^\d{4}-\d{2}-\d{2}$/.test(text)
}

/**
 * The title, room and remaining lines of one course cell.
 *
 * The courses come in two house styles — Chinese ones carry a teacher in
 * brackets and a `（weeks(学时)周[periods]）` line, French ones carry a module
 * code and `CM 格物C302` — so the first useful line is the title and a line
 * that looks like a room is the room. Everything else (teacher, group) is kept
 * as the note for the block's tooltip. The week/period line is dropped: the
 * sheet has already been filtered by week, and the cell's own span says when.
 */
export function parseCourseText(text: string): { title: string; location: string; note: string } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const meta = (line: string) => /周\s*\[/.test(line) || /学时/.test(line)
  const codeOnly = (line: string) => /^\d{5,}[A-Za-z0-9]*$/.test(line)
  const cleaned = lines.filter((line) => !meta(line) && !codeOnly(line))
  if (cleaned.length === 0) return { title: '', location: '', note: '' }

  const title = cleaned[0]
  let location = ''
  const notes: string[] = []
  for (const line of cleaned.slice(1)) {
    const prefixed = line.match(/^(?:CM|TD|TP)\s+(.+)$/i)
    const body = prefixed ? prefixed[1].trim() : line
    const isRoom =
      /教室|楼|中心|场|馆|实验室|跑道|校区|^江阴|^格物|^致远|^致理|^工训/.test(body) ||
      /[A-Za-z]\d{3,4}\b/.test(body)
    if (!location && (isRoom || prefixed)) location = body
    else notes.push(line)
  }
  return { title, location, note: notes.join(' · ') }
}

/**
 * One week sheet.
 *
 * The date row supplies both the day columns (each date is merged across its
 * day) and the sheet's Monday; the time column supplies the row span. A course
 * cell then becomes one session at the intersection, with merged cells spanning
 * the periods they occupy. Returns null for anything that is not a week sheet
 * or does not have the layout.
 */
export function parseCourseSheet(
  sheet: SheetGrid,
  startYear: number | null,
): ParsedCourseSheet | null {
  const week = parseSheetWeek(sheet.name)
  if (week == null) return null

  // Two views of the same cells: one by A1 for the walk below, one by numeric
  // column/row for the date and time grids.
  const byRef = new Map<string, SheetCellValue>()
  const byPos = new Map<string, SheetCellValue>()
  for (const [ref, value] of sheet.cells) {
    const pos = parseRef(ref)
    if (!pos) continue
    byRef.set(ref.toUpperCase(), value)
    byPos.set(key(pos.c, pos.r), value)
  }

  const anchor = new Map<string, Range>()
  const covered = new Set<string>()
  for (const raw of sheet.merges) {
    const range = parseRange(raw)
    if (!range) continue
    anchor.set(key(range.c1, range.r1), range)
    for (let r = range.r1; r <= range.r2; r++) {
      for (let c = range.c1; c <= range.c2; c++) {
        if (r !== range.r1 || c !== range.c1) covered.add(key(c, r))
      }
    }
  }

  // The date row is the one with the most date-like cells. Header rows above it
  // carry the semester label, and no other row has a run of dates.
  let dateRow = -1
  let bestDates = 0
  for (let r = 1; r <= 12; r++) {
    let n = 0
    for (let c = 1; c <= 40; c++) if (looksLikeDate(byPos.get(key(c, r)))) n++
    if (n > bestDates) {
      bestDates = n
      dateRow = r
    }
  }
  if (dateRow < 0 || bestDates < 5) return null

  // Text dates have no year; the first numeric date, when there is one, gives
  // it. Otherwise the caller's workbook label does.
  let year = startYear
  if (year == null) {
    for (let c = 1; c <= 40; c++) {
      const value = byPos.get(key(c, dateRow))
      if (typeof value !== 'number') continue
      const iso = parseSheetDate(value, null)
      if (iso) {
        year = Number(iso.slice(0, 4))
        break
      }
    }
  }

  const days: { weekday: number; from: number; to: number; date: string }[] = []
  for (let c = 1; c <= 40; c++) {
    const value = byPos.get(key(c, dateRow))
    if (!looksLikeDate(value)) continue
    const date = parseSheetDate(value!, year)
    if (!date) continue
    const range = anchor.get(key(c, dateRow))
    days.push({ weekday: 0, from: range ? range.c1 : c, to: range ? range.c2 : c, date })
  }
  if (days.length < 5) return null
  days.sort((a, b) => a.from - b.from)
  days.forEach((day, i) => {
    day.weekday = i
  })
  const monday = days[0].date

  // The first column with several time labels is the teaching-period column.
  // The sheets that carry a second, French-time column put it to the right.
  let timeCol = 2
  let bestTimes = 0
  for (let c = 1; c <= 5; c++) {
    let n = 0
    for (let r = dateRow + 1; r <= dateRow + 30; r++) {
      const value = byPos.get(key(c, r))
      if (typeof value === 'string' && parseSheetTime(value)) n++
    }
    if (n > bestTimes) {
      bestTimes = n
      timeCol = c
    }
  }
  if (bestTimes < 5) return null

  const times = new Map<number, { start: string; end: string }>()
  for (let r = dateRow + 1; r <= dateRow + 30; r++) {
    const value = byPos.get(key(timeCol, r))
    if (typeof value !== 'string') continue
    const time = parseSheetTime(value)
    if (time) times.set(r, time)
  }
  if (times.size === 0) return null

  const firstDay = days[0].from
  const lastDay = days[days.length - 1].to
  const sessions: CourseSession[] = []
  const seen = new Set<string>()

  for (const [ref, value] of byRef) {
    if (typeof value !== 'string' || value.trim() === '') continue
    const pos = parseRef(ref)
    if (!pos || pos.r <= dateRow) continue
    if (pos.c < firstDay || pos.c > lastDay) continue
    if (covered.has(key(pos.c, pos.r))) continue
    const day = days.find((d) => pos.c >= d.from && pos.c <= d.to)
    if (!day) continue

    const range = anchor.get(key(pos.c, pos.r)) ?? { c1: pos.c, r1: pos.r, c2: pos.c, r2: pos.r }
    const rowTimes: { start: string; end: string }[] = []
    for (let r = range.r1; r <= range.r2; r++) {
      const time = times.get(r)
      if (time) rowTimes.push(time)
    }
    if (rowTimes.length === 0) continue
    const start = rowTimes[0].start
    const end = rowTimes[rowTimes.length - 1].end
    const { title, location, note } = parseCourseText(value)
    if (!title) continue

    const dedupe = `${week}|${day.weekday}|${start}|${end}|${title}|${location}|${note}`
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    sessions.push({ week, weekday: day.weekday, start, end, title, location, note })
  }

  if (sessions.length === 0) return null
  sessions.sort(
    (a, b) =>
      a.weekday - b.weekday ||
      a.start.localeCompare(b.start) ||
      a.title.localeCompare(b.title),
  )
  return { week, monday, sessions }
}

/**
 * The student group a cell belongs to, when it names one.
 *
 * The exported sheets cover the whole cohort, so the same slot can hold the
 * `Groupe T`, `Groupe M` and `Groupe S` variants of a course. A note is where
 * that is written (`Groupe S · WILLIG`, `Groupe M · TD2`); a common lecture has
 * no group and belongs to everyone.
 */
export function courseGroup(note: string): 'T' | 'M' | 'S' | null {
  const match = note.match(/\b(?:Groupe|Gr)\s*([TMS])\b/i)
  return match ? (match[1].toUpperCase() as 'T' | 'M' | 'S') : null
}

/** The Monday of week 1, given any week's Monday and its week number. */
export function courseSemesterStart(monday: string, week: number): string {
  return toISO(addDays(toDate(monday), -(week - 1) * 7))
}

/** Which semester week `day` falls in, or null before week 1. */
export function courseWeekOf(day: string, semesterStart: string | null): number | null {
  if (!semesterStart) return null
  const days = diffDays(toDate(semesterStart), toDate(day))
  return days < 0 ? null : Math.floor(days / 7) + 1
}

/** The classes on one day, in start order. The timetable's background layer. */
export function coursesOn(
  courses: CourseSession[],
  day: string,
  semesterStart: string | null,
): CourseSession[] {
  const week = courseWeekOf(day, semesterStart)
  if (week == null) return []
  const weekday = weekdayIndex(toDate(day))
  return courses
    .filter((course) => course.week === week && course.weekday === weekday)
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
}

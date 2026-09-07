export type Unit = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Parse a 'yyyy-MM-dd' string into a local-midnight Date. */
export function toDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}

export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7)
}

export function addHours(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + n)
}

export function startOfWeek(d: Date): Date {
  const s = startOfDay(d)
  const dow = (s.getDay() + 6) % 7 // Monday = 0
  return addDays(s, -dow)
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function startOfQuarter(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1)
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000)
}

export function diffMonths(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}

export function isWeekend(d: Date): boolean {
  const w = d.getDay()
  return w === 0 || w === 6
}

export function isToday(d: Date): boolean {
  return diffDays(d, new Date()) === 0
}

/** ISO-8601 week number (Monday = day 1, week 1 contains Jan 4). */
export function isoWeekNumber(d: Date): number {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayNum = ((target.getDay() + 6) % 7) + 1 // 1=Mon .. 7=Sun
  target.setDate(target.getDate() + 4 - dayNum) // Thursday of this week
  const yearStart = new Date(target.getFullYear(), 0, 1)
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function addUnit(d: Date, unit: Unit, n: number): Date {
  switch (unit) {
    case 'hour':
      return addHours(d, n)
    case 'day':
      return addDays(d, n)
    case 'week':
      return addWeeks(d, n)
    case 'month':
      return addMonths(d, n)
    case 'quarter':
      return addMonths(d, n * 3)
    case 'year':
      return addMonths(d, n * 12)
  }
}

export function addUnitISO(iso: string, unit: Unit, n: number): string {
  return toISO(addUnit(toDate(iso), unit, n))
}

export function formatShort(iso: string): string {
  const d = toDate(iso)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
}

export function formatLong(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

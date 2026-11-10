import { CourseSession } from '../types'
import { TFunc } from './useT'
import { parseCourseSheet, parseSheetWeek, courseSemesterStart, SheetGrid } from './courseSheet'
import { readWorkbook, XlsxError } from './xlsx'

/** An .xlsx timetable is a few hundred KB; anything of this size is not one. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export interface CourseDraft {
  sessions: CourseSession[]
  semesterStart: string
  weeks: number[]
  /** Weeks supplied by more than one file; the later file wins. */
  conflicts: number[]
}

export interface CourseSource {
  file: string
  startYear: number | null
  sheets: SheetGrid[]
}

export interface CourseFailure {
  file: string
  sheet: string
  reason: 'layout'
}

export interface CourseRead {
  sources: CourseSource[]
  local: CourseDraft | null
  failures: CourseFailure[]
}

export interface LocalDraft {
  draft: CourseDraft | null
  failures: CourseFailure[]
}

/**
 * The local parser's fast path over already-read workbooks.
 *
 * A week sheet that `parseCourseSheet` does not recognise is recorded instead
 * of being silently skipped: that record is what tells the UI a different
 * layout exists and offers the AI fallback.
 */
export function buildLocalDraft(sources: CourseSource[]): LocalDraft {
  const byWeek = new Map<number, CourseSession[]>()
  const seen = new Set<number>()
  const conflicts = new Set<number>()
  const starts: string[] = []
  const failures: CourseFailure[] = []

  for (const source of sources) {
    for (const sheet of source.sheets) {
      const week = parseSheetWeek(sheet.name)
      if (week == null) continue
      const parsed = parseCourseSheet(sheet, source.startYear)
      if (!parsed) {
        failures.push({ file: source.file, sheet: sheet.name, reason: 'layout' })
        continue
      }
      if (seen.has(parsed.week)) conflicts.add(parsed.week)
      seen.add(parsed.week)
      // A week both files carry takes the later file's version.
      byWeek.set(parsed.week, parsed.sessions)
      starts.push(courseSemesterStart(parsed.monday, parsed.week))
    }
  }

  if (byWeek.size === 0) return { draft: null, failures }

  const counts = new Map<string, number>()
  for (const start of starts) counts.set(start, (counts.get(start) ?? 0) + 1)
  const semesterStart = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]

  return {
    draft: {
      sessions: [...byWeek.values()].flat(),
      semesterStart,
      weeks: [...byWeek.keys()].sort((a, b) => a - b),
      conflicts: [...conflicts].sort((a, b) => a - b),
    },
    failures,
  }
}

/** Read the files and run the local parser, keeping the sheets for the fallback. */
export async function readCourseFiles(files: File[], t: TFunc): Promise<CourseRead> {
  const sources: CourseSource[] = []
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new Error(t('course.tooBig'))
    try {
      const { sheets, startYear } = await readWorkbook(await file.arrayBuffer())
      sources.push({ file: file.name, startYear, sheets })
    } catch (err) {
      if (err instanceof XlsxError) throw new Error(t('course.badFile'))
      throw err
    }
  }
  const { draft, failures } = buildLocalDraft(sources)
  return { sources, local: draft, failures }
}

/**
 * Put an AI result beside the local one. Local weeks stay unless the AI was
 * explicitly asked to read the same week; the local semester start wins because
 * it came from the file's own dates.
 */
export function mergeCourseDrafts(local: CourseDraft | null, ai: CourseDraft | null): CourseDraft | null {
  if (!ai) return local
  if (!local) return ai
  if (ai.sessions.length === 0) return local
  const aiWeeks = new Set(ai.sessions.map((session) => session.week))
  const replaced = local.weeks.filter((week) => aiWeeks.has(week))
  const sessions = [...local.sessions.filter((session) => !aiWeeks.has(session.week)), ...ai.sessions]
  const weeks = [...new Set(sessions.map((session) => session.week))].sort((a, b) => a - b)
  const conflicts = [...new Set([...local.conflicts, ...replaced])].sort((a, b) => a - b)
  return {
    sessions,
    semesterStart: local.semesterStart || ai.semesterStart,
    weeks,
    conflicts,
  }
}

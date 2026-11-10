import { CourseSession } from '../../types'
import { readCourses } from '../../store/storage'
import { CourseDraft, CourseSource } from '../courseImport'
import { parseSheetWeek } from '../courseSheet'
import { toDate, toISO, weekdayIndex } from '../dates'
import { AiError, AiProvider, AiToolSpec } from './types'

/**
 * The AI fallback for timetable layouts the local parser does not recognise.
 *
 * The app sends only the failed week sheets, as coordinates plus merges, and
 * asks the model to fill the same CourseSession shape. The result is filtered
 * through `readCourses` — the same sanitizer storage uses — before it can reach
 * the preview. The model never writes anything.
 */

const MAX_SHEETS = 30
const MAX_ROWS = 80
const MAX_COLS = 40
const MAX_PAYLOAD_CHARS = 120_000

const TOOL: AiToolSpec = {
  type: 'function',
  function: {
    name: 'submit_sessions',
    description: 'Return the classes read from the timetable sheets. Call this once with every class found.',
    parameters: {
      type: 'object',
      properties: {
        semesterStart: {
          type: 'string',
          description: 'Monday of semester week 1, yyyy-MM-dd, if the sheets carry dates; otherwise omit.',
        },
        periods: {
          type: 'array',
          description:
            'Every period number the sheet labels, with its clock times when the sheet states them. Empty when the sheet uses clock times directly.',
          items: {
            type: 'object',
            properties: {
              period: { type: 'integer', minimum: 1, maximum: 60 },
              start: { type: 'string', description: 'HH:MM written in the sheet' },
              end: { type: 'string', description: 'HH:MM written in the sheet' },
            },
            required: ['period'],
            additionalProperties: false,
          },
        },
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              week: { type: 'integer', minimum: 1, maximum: 60, description: 'Week number, from the sheet name or the cell.' },
              weeks: {
                type: 'array',
                items: { type: 'integer', minimum: 1, maximum: 60 },
                description: 'Use instead of week when one row carries a week range.',
              },
              weekday: { type: 'integer', minimum: 0, maximum: 6, description: '0 = Monday … 6 = Sunday.' },
              start: { type: 'string', description: 'HH:MM, only if the sheet states a clock time' },
              end: { type: 'string', description: 'HH:MM, only if the sheet states a clock time' },
              periodStart: { type: 'integer', minimum: 1, maximum: 60, description: 'First period, when the sheet labels rows by period number.' },
              periodEnd: { type: 'integer', minimum: 1, maximum: 60, description: 'Last period of the span.' },
              title: { type: 'string' },
              location: { type: 'string' },
              note: {
                type: 'string',
                description: 'Teacher, group/division and any other text, verbatim.',
              },
              sheet: { type: 'string', description: 'The sheet the row came from.' },
            },
            required: ['weekday', 'title'],
            additionalProperties: false,
          },
        },
      },
      required: ['sessions'],
      additionalProperties: false,
    },
  },
}

const SYSTEM = `You read one school timetable exported as .xlsx and call submit_sessions with the classes.
Rules:
- Layouts differ per school: headers, column order, merged spans, week and time formats all vary. Read what the cells say; do not impose a fixed template.
- Weekday is 0=Monday … 6=Sunday, following the day columns left to right.
- Times: use only the clock times written in the sheet (a period/time column or the cell itself). Never invent a standard schedule and never assume a period length. If the sheet labels rows only by period number, leave start/end empty and set periodStart/periodEnd instead, and list the periods (with times only where the sheet states them).
- When clock times are stated, start/end are HH:MM and start must be before end.
- Merged cells show the span a class occupies; do not invent classes that are not in a cell.
- The first useful line in a cell is the title; a room-like line is the location; teacher/group/other lines go into note. Preserve group or division text verbatim.
- A sheet name may carry the week number (for example S11); use it only when it really is a week number. If a single sheet carries week ranges, return one session per week with weeks[]. If neither the sheet name nor the cells state a week, do not guess — leave those sessions out.
- If a semesterStart is given in the input and the cells carry dates but no week number, compute each date's week from it.
- semesterStart is the Monday of week 1, only if the sheets carry dates. Never guess it.
- Ignore summary columns outside the weekday columns.
- Call submit_sessions in this turn. If you cannot call tools, reply with only the JSON object {"sessions":[...]} and nothing else. Do not answer in prose.`

function cellInRange(ref: string): boolean {
  const match = ref.match(/^([A-Z]+)(\d+)$/)
  if (!match) return false
  let col = 0
  for (const ch of match[1]) col = col * 26 + ch.charCodeAt(0) - 64
  return col <= MAX_COLS && Number(match[2]) <= MAX_ROWS
}

function payloadFor(
  sources: CourseSource[],
  weeks: number[],
  semesterStart?: string,
): { payload: string; sheetCount: number } {
  const wanted = new Set(weeks)
  const sheets = []
  for (const source of sources) {
    for (const sheet of source.sheets) {
      if (sheet.cells.size === 0) continue
      const week = parseSheetWeek(sheet.name)
      // A sheet whose name is not S<n> may be the master grid of a different
      // school; send it when the scope is "all" or when the local parser had
      // nothing to say about it. The model is told not to guess a missing week.
      const include = wanted.size === 0 || week == null || wanted.has(week)
      if (!include) continue
      const cells = [...sheet.cells.entries()].filter(([ref]) => cellInRange(ref))
      sheets.push({
        file: source.file,
        name: sheet.name,
        startYear: source.startYear,
        cells,
        merges: sheet.merges.filter((ref) => ref.split(':').every((part) => cellInRange(part))),
      })
      if (sheets.length >= MAX_SHEETS) break
    }
    if (sheets.length >= MAX_SHEETS) break
  }
  const payload = JSON.stringify({ semesterStart: semesterStart ?? null, sheets })
  if (payload.length > MAX_PAYLOAD_CHARS) {
    throw new AiError('bad_response', 'This timetable is too large for AI parsing; split the file or use a smaller range.')
  }
  return { payload, sheetCount: sheets.length }
}

/**
 * Thinking models may ignore tools and answer with the JSON in prose. Take the
 * first object (or bare array of sessions) out of the reply.
 */
function jsonFromText(text: string | null): Record<string, unknown> | null {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const arrayStart = body.indexOf('[')
  const useArray = start < 0 || (arrayStart >= 0 && arrayStart < start)
  const open = useArray ? arrayStart : start
  const close = useArray ? body.lastIndexOf(']') : body.lastIndexOf('}')
  if (open < 0 || close <= open) return null
  try {
    const value = JSON.parse(body.slice(open, close + 1)) as unknown
    if (Array.isArray(value)) return { sessions: value }
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Tool arguments from a thinking model are not always clean JSON: they can be
 * double-encoded, fenced, or cut off. Try the strict parse first, then the
 * text scrape; the caller falls back to the message content as a last resort.
 */
function parseStructure(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const first = JSON.parse(value) as unknown
    const object = typeof first === 'string' ? (JSON.parse(first) as unknown) : first
    if (Array.isArray(object)) return { sessions: object }
    return object && typeof object === 'object' ? (object as Record<string, unknown>) : null
  } catch {
    return jsonFromText(value)
  }
}

function rawSessions(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
    : []
}

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/

function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_OF_DAY.test(value)
}

function validMonday(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = toDate(value)
  return toISO(date) === value && weekdayIndex(date) === 0 ? value : null
}

/** A period number with the clock times the sheet stated for it, if any. */
export interface PeriodTime {
  period: number
  start: string
  end: string
}

/** A class the sheet placed by period number only; the preview asks for times. */
export interface PendingSession {
  week: number
  weekday: number
  periodStart: number
  periodEnd: number
  title: string
  location: string
  note: string
}

export interface AiCourseResult {
  draft: CourseDraft
  /** Classes whose times are still unknown; the preview fills them in. */
  pending: PendingSession[]
  /** Times the model found in the sheet, keyed by period. */
  periods: PeriodTime[]
  warnings: { dropped: number; outOfScope: number }
}

export type AiCourseStage = 'thinking' | 'correcting' | 'validating'

export async function parseCoursesWithAi({
  provider,
  sources,
  weeks,
  knownSemesterStart,
  signal,
  onProgress,
}: {
  provider: AiProvider
  sources: CourseSource[]
  /** Failed weeks; empty means every week sheet. */
  weeks: number[]
  knownSemesterStart?: string
  signal?: AbortSignal
  onProgress?: (stage: AiCourseStage) => void
}): Promise<AiCourseResult> {
  const { payload, sheetCount } = payloadFor(sources, weeks, knownSemesterStart)
  if (sheetCount === 0) throw new AiError('bad_response', 'No week sheets were available for AI parsing.')

  const messages = [
    { role: 'system' as const, content: SYSTEM },
    { role: 'user' as const, content: payload },
  ]
  const request = {
    messages,
    tools: [TOOL],
    // Thinking-mode models reject a forced tool choice; `auto` plus the
    // correction turn below gets the call either way.
    toolChoice: 'auto' as const,
    signal,
    // A whole timetable is a lot of JSON, and a thinking model spends part of
    // this budget on its own turn; 4096 ran out before the tool call.
    maxTokens: 8192,
  }

  onProgress?.('thinking')
  let response = await provider.chat(request)
  let call = response.tool_calls?.find((candidate) => candidate.function.name === 'submit_sessions')
  if (!call && !jsonFromText(response.content)) {
    // One correction turn: the model neither called the tool nor wrote JSON.
    onProgress?.('correcting')
    response = await provider.chat({
      ...request,
      messages: [
        ...messages,
        {
          role: 'user',
          content:
            'Call submit_sessions now, or reply with only the JSON object {"sessions":[...]}; no prose.',
        },
      ],
    })
    call = response.tool_calls?.find((candidate) => candidate.function.name === 'submit_sessions')
  }

  const parsed =
    (call ? parseStructure(call.function.arguments) : null) ?? jsonFromText(response.content)
  if (!parsed) {
    throw new AiError(
      'bad_response',
      response.finish_reason === 'length'
        ? 'The model output was cut off before the timetable was complete. Import fewer weeks at a time.'
        : call
          ? 'The model returned tool arguments that were not valid JSON.'
          : 'The model did not return the timetable structure.',
    )
  }

  // Times the sheet itself stated, per period. Anything the model guessed is
  // not here: `periods` only carries clock times written in the file.
  const periodMap = new Map<number, { start: string; end: string }>()
  for (const row of rawSessions(parsed.periods)) {
    const period = row.period
    if (typeof period !== 'number' || !Number.isInteger(period) || period < 1 || period > 60) continue
    const start = isTime(row.start) ? row.start : ''
    const end = isTime(row.end) ? row.end : ''
    if (!start && !end) continue
    periodMap.set(period, { start, end })
  }

  const wanted = new Set(weeks)
  const rows: Record<string, unknown>[] = []
  const pending: PendingSession[] = []
  let outOfScope = 0
  let invalid = 0
  for (const session of rawSessions(parsed.sessions)) {
    const weekFromSheet = typeof session.sheet === 'string' ? parseSheetWeek(session.sheet) : null
    const weekList = Array.isArray(session.weeks)
      ? session.weeks.filter((week): week is number => typeof week === 'number' && Number.isInteger(week))
      : typeof session.week === 'number'
        ? [session.week]
        : weekFromSheet != null
          ? [weekFromSheet]
          : []
    if (weekList.length === 0) {
      outOfScope++
      continue
    }
    const weekday =
      typeof session.weekday === 'number' &&
      Number.isInteger(session.weekday) &&
      session.weekday >= 0 &&
      session.weekday <= 6
        ? session.weekday
        : null
    const title = typeof session.title === 'string' ? session.title.trim() : ''
    const start = isTime(session.start) ? session.start : null
    const end = start && isTime(session.end) && session.end > start ? session.end : null
    const pStart =
      typeof session.periodStart === 'number'
        ? session.periodStart
        : typeof session.period === 'number'
          ? session.period
          : null
    const pEnd = typeof session.periodEnd === 'number' ? session.periodEnd : pStart
    const location = typeof session.location === 'string' ? session.location : ''
    const note = typeof session.note === 'string' ? session.note : ''

    for (const week of weekList) {
      if (wanted.size > 0 && !wanted.has(week)) {
        outOfScope++
        continue
      }
      if (weekday == null || !title) {
        invalid++
        continue
      }
      if (start && end) {
        rows.push({ week, weekday, start, end, title, location, note })
        continue
      }
      if (
        pStart == null ||
        pEnd == null ||
        !Number.isInteger(pStart) ||
        !Number.isInteger(pEnd) ||
        pStart < 1 ||
        pEnd < 1 ||
        pStart > 60 ||
        pEnd > 60 ||
        pEnd < pStart
      ) {
        invalid++
        continue
      }
      const first = periodMap.get(pStart)
      const last = periodMap.get(pEnd)
      if (first?.start && last?.end && first.start < last.end) {
        rows.push({ week, weekday, start: first.start, end: last.end, title, location, note })
      } else {
        pending.push({ week, weekday, periodStart: pStart, periodEnd: pEnd, title, location, note })
      }
    }
  }

  onProgress?.('validating')
  const valid = readCourses(rows)
  const dropped = invalid + (rows.length - valid.length)
  if (valid.length === 0 && pending.length === 0) {
    throw new AiError('bad_response', 'No valid classes were returned by the model.')
  }

  const aiStart = validMonday(parsed.semesterStart)
  const semesterStart = knownSemesterStart || aiStart || ''
  const weeksOut = [...new Set(valid.map((session) => session.week))].sort((a, b) => a - b)
  const periodsOut = [...periodMap.entries()]
    .map(([period, times]) => ({ period, ...times }))
    .sort((a, b) => a.period - b.period)
  return {
    draft: { sessions: valid, semesterStart, weeks: weeksOut, conflicts: [] },
    pending,
    periods: periodsOut,
    warnings: { dropped, outOfScope },
  }
}

export type { CourseSession }

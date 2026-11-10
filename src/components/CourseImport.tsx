import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { CourseSession } from '../types'
import { courseGroup, parseSheetWeek } from '../lib/courseSheet'
import {
  CourseDraft,
  CourseRead,
  mergeCourseDrafts,
  readCourseFiles,
} from '../lib/courseImport'
import { parseCoursesWithAi } from '../lib/ai/courseParse'
import type { AiCourseStage, PendingSession, PeriodTime } from '../lib/ai/courseParse'
import { createDeepSeekProvider } from '../lib/ai/deepseek'
import { aiErrorMessage } from '../lib/ai/errors'
import { TFunc, useLang, useT } from '../lib/useT'
import { weekdayLabels } from '../lib/i18n'
import { useDialogs } from './dialogs'
import { Field, Modal, Segmented, inputCls } from './ui'

const timeCls =
  'h-7 w-[86px] px-1 bg-panel2 border border-border rounded-[3px] text-[11px] text-fg focus:outline-none focus:border-accent'

const AI_STAGE_KEY = {
  thinking: 'course.aiStageThinking',
  correcting: 'course.aiStageCorrecting',
  validating: 'course.aiStageValidating',
} as const

/** `第 7–12 周 · 第 14–16 周`, collapsing only runs that are really contiguous. */
function weekLabel(weeks: number[], t: TFunc): string {
  if (weeks.length === 0) return ''
  const runs: [number, number][] = []
  for (const week of [...weeks].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1]
    if (last && week === last[1] + 1) last[1] = week
    else runs.push([week, week])
  }
  return runs
    .map(([from, to]) => (from === to ? t('course.week', { week: from }) : t('course.weeks', { from, to })))
    .join(' · ')
}

/**
 * The timetable section on the Settings page: import, a one-line summary, and
 * the way to clear it. The classes themselves are drawn by `Timetable`.
 */
export function CourseSection() {
  const t = useT()
  const courses = useStore((s) => s.courses)
  const semesterStart = useStore((s) => s.semesterStart)
  const importCourses = useStore((s) => s.importCourses)
  const clearCourses = useStore((s) => s.clearCourses)
  const { ask, element: dialogs } = useDialogs()

  const inputRef = useRef<HTMLInputElement>(null)
  const [read, setRead] = useState<CourseRead | null>(null)
  const [draft, setDraft] = useState<CourseDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiWarnings, setAiWarnings] = useState<{ dropped: number; outOfScope: number } | null>(null)
  const [aiStage, setAiStage] = useState<AiCourseStage>('thinking')
  const [aiSeconds, setAiSeconds] = useState(0)
  const [aiPending, setAiPending] = useState<PendingSession[]>([])
  const [aiPeriods, setAiPeriods] = useState<PeriodTime[]>([])

  useEffect(() => {
    if (!aiBusy) return
    setAiSeconds(0)
    const id = setInterval(() => setAiSeconds((seconds) => seconds + 1), 1000)
    return () => clearInterval(id)
  }, [aiBusy])

  const weeks = [...new Set(courses.map((course) => course.week))].sort((a, b) => a - b)

  const load = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    setAiError(null)
    setAiWarnings(null)
    setAiPending([])
    setAiPeriods([])
    setDraft(null)
    setRead(null)
    try {
      const next = await readCourseFiles([...files], t)
      setRead(next)
      setDraft(next.local)
      if (!next.local) setError(t('course.noWeeks'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('course.readError'))
    } finally {
      setBusy(false)
      // Selecting the same file twice must fire again.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const runAi = async (scope: 'failed' | 'all') => {
    if (!read) return
    const state = useStore.getState()
    if (!state.aiApiKey.trim()) {
      setAiError(t('ai.error.noKey'))
      return
    }
    setAiBusy(true)
    setAiStage('thinking')
    setAiError(null)
    setError(null)
    setAiPending([])
    setAiPeriods([])
    try {
      const weeksToRead =
        scope === 'all'
          ? []
          : read.failures
              .map((failure) => parseSheetWeek(failure.sheet))
              .filter((week): week is number => week != null)
      const provider = createDeepSeekProvider({ apiKey: state.aiApiKey, model: state.aiModel })
      const result = await parseCoursesWithAi({
        provider,
        sources: read.sources,
        weeks: weeksToRead,
        knownSemesterStart: read.local?.semesterStart || semesterStart || undefined,
        onProgress: setAiStage,
      })
      const merged = mergeCourseDrafts(read.local, result.draft)
      if (!merged) throw new Error(t('course.aiEmpty'))
      setRead((current) => (current ? { ...current, local: merged } : current))
      setDraft(merged)
      setAiWarnings(result.warnings)
      setAiPending(result.pending)
      setAiPeriods(result.periods)
      setError(null)
    } catch (err) {
      setAiError(`${t('course.aiFailed')} ${aiErrorMessage(t, err)}`)
    } finally {
      setAiBusy(false)
    }
  }

  const sheetCount = read
    ? read.sources.reduce(
        (count, source) => count + source.sheets.filter((sheet) => sheet.cells.size > 0).length,
        0,
      )
    : 0
  const aiProgress = aiBusy
    ? t('course.aiProgress', {
        sheets: sheetCount,
        stage: t(AI_STAGE_KEY[aiStage]),
        seconds: aiSeconds,
      })
    : null

  return (
    <section>
      <h2 className="text-[14px] font-semibold text-fg mb-1">{t('course.section')}</h2>
      <p className="text-[12px] text-muted mb-3">{t('course.hint')}</p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="h-8 px-3 text-[12px] text-fg border border-border rounded-[3px] hover:bg-panel2 disabled:opacity-40"
        >
          {busy ? t('course.reading') : t('course.import')}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.xls,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          multiple
          className="hidden"
          onChange={(e) => void load(e.currentTarget.files)}
        />
        {courses.length > 0 && (
          <button
            onClick={() => ask(t('course.clearAsk'), clearCourses)}
            className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]"
          >
            {t('course.clear')}
          </button>
        )}
        {read && read.sources.some((source) => source.sheets.length > 0) && (
          <button
            onClick={() =>
              ask(t('course.aiSendAsk'), () => void runAi(read.failures.length > 0 ? 'failed' : 'all'))
            }
            disabled={busy || aiBusy}
            className="h-8 px-3 text-[12px] text-accent border border-accent/40 rounded-[3px] hover:bg-accent/10 disabled:opacity-40"
          >
            {aiBusy ? t('course.aiReading') : t('course.aiRead')}
          </button>
        )}
      </div>

      {aiProgress && <p className="mt-2 text-[12px] text-muted">{aiProgress}</p>}

      <p className={`mt-2 text-[12px] ${courses.length > 0 ? 'text-muted' : 'text-dim'}`}>
        {courses.length > 0
          ? t('course.summary', {
              count: courses.length,
              weeks: weekLabel(weeks, t),
              date: semesterStart ?? '',
            })
          : t('course.empty')}
      </p>
      {(aiError || error) && (
        <p className="mt-2 text-[12px] text-delayed">{aiError ?? error}</p>
      )}

      {draft && read && (
        <CourseImportDialog
          draft={draft}
          existingWeeks={new Set(weeks)}
          failedCount={read.failures.length}
          aiBusy={aiBusy}
          aiProgress={aiProgress}
          aiWarnings={aiWarnings}
          aiError={aiError}
          pending={aiPending}
          periods={aiPeriods}
          onAiRead={(scope) => ask(t('course.aiSendAsk'), () => void runAi(scope))}
          onClose={() => setDraft(null)}
          onImport={(sessions, semesterStart) => {
            importCourses(sessions, semesterStart)
            setDraft(null)
            setRead(null)
            setAiWarnings(null)
            setAiPending([])
            setAiPeriods([])
            setAiError(null)
          }}
        />
      )}
      {dialogs}
    </section>
  )
}

/**
 * What was read, before anything is written.
 *
 * The parser's room/title split is a guess about a school's layout, so the
 * whole result is laid out first: a file that parsed badly should be visible
 * here, not discovered on the timetable. Weeks already stored are called out
 * because importing replaces them.
 */
function CourseImportDialog({
  draft,
  existingWeeks,
  failedCount,
  aiBusy,
  aiProgress,
  aiWarnings,
  aiError,
  pending,
  periods,
  onAiRead,
  onClose,
  onImport,
}: {
  draft: CourseDraft
  existingWeeks: Set<number>
  failedCount: number
  aiBusy: boolean
  aiProgress: string | null
  aiWarnings: { dropped: number; outOfScope: number } | null
  aiError: string | null
  pending: PendingSession[]
  periods: PeriodTime[]
  onAiRead: (scope: 'failed' | 'all') => void
  onClose: () => void
  onImport: (sessions: CourseSession[], semesterStart: string) => void
}) {
  const t = useT()
  const lang = useLang()
  const [start, setStart] = useState(draft.semesterStart)
  useEffect(() => setStart(draft.semesterStart), [draft.semesterStart])
  // Times the sheet itself stated, per period; the user fills the rest.
  const [grid, setGrid] = useState<Record<number, { start: string; end: string }>>({})
  useEffect(() => {
    const next: Record<number, { start: string; end: string }> = {}
    for (const time of periods) next[time.period] = { start: time.start, end: time.end }
    setGrid(next)
  }, [periods])

  const needed = [
    ...new Set(
      pending.flatMap((session) => {
        const list: number[] = []
        for (let period = session.periodStart; period <= session.periodEnd; period++) list.push(period)
        return list
      }),
    ),
  ].sort((a, b) => a - b)
  const resolved: CourseSession[] = pending.flatMap((session) => {
    const first = grid[session.periodStart]
    const last = grid[session.periodEnd]
    if (!first?.start || !last?.end || first.start >= last.end) return []
    return [
      {
        week: session.week,
        weekday: session.weekday,
        start: first.start,
        end: last.end,
        title: session.title,
        location: session.location,
        note: session.note,
      },
    ]
  })
  const allResolved = resolved.length === pending.length
  const base = [...draft.sessions, ...resolved]

  // The exported sheets cover the whole cohort: some slots hold the T, M and S
  // variants side by side. The student picks their own group; common lectures
  // (no group in the note) are kept for everyone.
  const [group, setGroup] = useState<'all' | 'T' | 'M' | 'S'>('all')
  const hasGroups = base.some((course) => courseGroup(course.note) != null)
  const sessions =
    group === 'all'
      ? base
      : base.filter((course) => {
          const own = courseGroup(course.note)
          return own == null || own === group
        })
  const weeks = [...new Set(sessions.map((course) => course.week))].sort((a, b) => a - b)
  const labels = weekdayLabels(lang)
  const overwritten = weeks.filter((week) => existingWeeks.has(week))
  const conflicts = draft.conflicts.filter((week) => weeks.includes(week))

  return (
    <Modal title={t('course.previewTitle')} onClose={onClose} width={620}>
      <div className="space-y-3">
        <div className="text-[12px] text-muted">
          {t('course.summary', {
            count: sessions.length,
            weeks: weekLabel(weeks, t),
            date: start,
          })}
        </div>
        {!start && (
          <Field label={t('course.aiSemesterStart')}>
            <input
              type="date"
              className={inputCls}
              value={start}
              onChange={(e) => setStart(e.currentTarget.value)}
            />
            <div className="mt-1 text-[10px] leading-relaxed text-today">{t('course.aiSemesterHint')}</div>
          </Field>
        )}
        {pending.length > 0 && (
          <div>
            <div className="text-[11px] leading-relaxed text-today">{t('course.periodTimes')}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {needed.map((period) => {
                const value = grid[period] ?? { start: '', end: '' }
                const update = (patch: Partial<{ start: string; end: string }>) =>
                  setGrid((current) => ({ ...current, [period]: { ...value, ...patch } }))
                return (
                  <div key={period} className="flex items-center gap-1">
                    <span className="text-[10px] text-dim">{t('course.period', { period })}</span>
                    <input
                      type="time"
                      className={timeCls}
                      value={value.start}
                      onChange={(e) => update({ start: e.currentTarget.value })}
                    />
                    <span className="text-[10px] text-dim">–</span>
                    <input
                      type="time"
                      className={timeCls}
                      value={value.end}
                      onChange={(e) => update({ end: e.currentTarget.value })}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {hasGroups && (
          <Field label={t('course.group')}>
            <Segmented<'all' | 'T' | 'M' | 'S'>
              value={group}
              onChange={setGroup}
              options={[
                { value: 'all', label: t('course.groupAll') },
                { value: 'T', label: 'T' },
                { value: 'M', label: 'M' },
                { value: 'S', label: 'S' },
              ]}
            />
          </Field>
        )}
        {overwritten.length > 0 && (
          <div className="text-[11px] text-today">{t('course.overwrites', { weeks: weekLabel(overwritten, t) })}</div>
        )}
        {conflicts.map((week) => (
          <div key={week} className="text-[11px] text-today">
            {t('course.conflict', { week })}
          </div>
        ))}

        <div className="max-h-[55vh] overflow-auto rounded-xl border border-border/70 bg-panel2/25">
          {weeks.map((week) => {
            const list = sessions
              .filter((course) => course.week === week)
              .sort(
                (a, b) =>
                  a.weekday - b.weekday ||
                  a.start.localeCompare(b.start) ||
                  a.title.localeCompare(b.title),
              )
            return (
              <div key={week}>
                <div className="sticky top-0 z-10 bg-panel2 px-2 py-1 text-[10px] uppercase tracking-wider text-dim border-y border-border/60 first:border-t-0">
                  {t('course.week', { week })}
                </div>
                {list.map((course, i) => (
                  <div
                    key={`${course.weekday}-${course.start}-${course.title}-${i}`}
                    title={[course.title, course.location, course.note].filter(Boolean).join(' · ')}
                    className="flex items-center gap-2 px-2 py-1 text-[11px]"
                  >
                    <span className="w-7 shrink-0 text-dim">{labels[course.weekday]}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted">
                      {course.start}–{course.end}
                    </span>
                    <span className="min-w-0 truncate text-fg/90">{course.title}</span>
                    {course.location && (
                      <span className="ml-auto min-w-0 truncate text-dim">{course.location}</span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {aiWarnings && (aiWarnings.dropped > 0 || aiWarnings.outOfScope > 0) && (
          <div className="text-[11px] text-today">
            {t('course.aiWarnings', { dropped: aiWarnings.dropped, out: aiWarnings.outOfScope })}
          </div>
        )}
        {aiProgress && <div className="text-[11px] text-muted">{aiProgress}</div>}
        {aiError && <div className="text-[11px] text-delayed">{aiError}</div>}

        <div className="flex items-center gap-2 pt-1">
          {failedCount > 0 && (
            <button
              onClick={() => onAiRead('failed')}
              disabled={aiBusy}
              className="h-8 px-3 text-[12px] text-accent border border-accent/40 rounded-[3px] hover:bg-accent/10 disabled:opacity-40"
            >
              {aiBusy ? t('course.aiReading') : t('course.aiRead')}
            </button>
          )}
          <button
            onClick={() => onAiRead('all')}
            disabled={aiBusy}
            className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px] disabled:opacity-40"
          >
            {t('course.aiReadAll')}
          </button>
          <span className="mr-auto" />
          <button
            onClick={onClose}
            className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onImport(sessions, start)}
            disabled={sessions.length === 0 || !start || !allResolved}
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]"
          >
            {t('course.importConfirm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

import { useMemo, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { Flag, Play } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Task } from '../types'
import { addMonths, startOfMonth, startOfWeek, addDays, toISO } from '../lib/dates'
import { formatLongDate, monthName, weekdayLabels } from '../lib/i18n'
import { TFunc, useLang, useT } from '../lib/useT'
import { effectiveStates } from '../lib/tree'
import { DayCellState, DayMilestones, StrictLogRate, dayCellState, milestonesOnDay, strictLogRate } from '../lib/dayTasks'

export function CalendarPage() {
  const t = useT()
  const lang = useLang()
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const today = useStore((s) => s.today)
  const selectedDay = useStore((s) => s.selectedDay)
  const setSelected = useStore((s) => s.setSelected)
  const setSelectedDay = useStore((s) => s.setSelectedDay)
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))

  const eff = useMemo(() => effectiveStates(tasks, logs), [tasks, logs])

  // Keyed on the month rather than the Date object, so `days` (and the sweep
  // below) keep a stable identity across renders.
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const days = useMemo(() => {
    const start = startOfWeek(new Date(year, month, 1))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [year, month])

  // One sweep for the whole grid, so a cell can show how much of its strict work
  // has been logged without recomputing 42 times per render.
  const rings = useMemo(() => {
    const m = new Map<string, StrictLogRate>()
    for (const d of days) m.set(toISO(d), strictLogRate(tasks, logs, toISO(d)))
    return m
  }, [days, tasks, logs])

  // Beginnings and deadlines — the cell's contents. Swept the same way, for the
  // same reason.
  const milestones = useMemo(() => {
    const m = new Map<string, DayMilestones>()
    for (const d of days) m.set(toISO(d), milestonesOnDay(tasks, eff, toISO(d)))
    return m
  }, [days, tasks, eff])

  // Which tasks carry a log on each day. One pass over the logs rather than a
  // sweep of the grid — the grid only ever asks whether a given task is in the
  // set, and building 42 sets would be 42 walks of the same array.
  const loggedByDay = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of logs) {
      let s = m.get(l.date)
      if (!s) { s = new Set(); m.set(l.date, s) }
      s.add(l.taskId)
    }
    return m
  }, [logs])

  const onCellKey = (e: KeyboardEvent<HTMLDivElement>, iso: string) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelectedDay(iso)
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[18px] font-semibold">{t('nav.calendar')}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCursor((c) => addMonths(c, -1))}
              title={t('calendar.prevMonth')}
              aria-label={t('calendar.prevMonth')}
              className="px-2.5 h-8 text-[13px] border border-border rounded-[3px] hover:bg-panel2"
            >
              ‹
            </button>
            <button
              onClick={() => { setCursor(startOfMonth(new Date())); setSelectedDay(today) }}
              className="px-2.5 h-8 text-[12px] border border-border rounded-[3px] hover:bg-panel2"
            >
              {t('time.today')}
            </button>
            <button
              onClick={() => setCursor((c) => addMonths(c, 1))}
              title={t('calendar.nextMonth')}
              aria-label={t('calendar.nextMonth')}
              className="px-2.5 h-8 text-[13px] border border-border rounded-[3px] hover:bg-panel2"
            >
              ›
            </button>
            <div className="w-44 text-center font-mono text-[13px]">{monthName(lang, cursor.getMonth())} {cursor.getFullYear()}</div>
          </div>
        </div>
        <div className="bg-panel border border-border rounded-[3px] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {weekdayLabels(lang).map((d) => <div key={d} className="h-8 flex items-center justify-center text-[10px] uppercase tracking-wider text-dim border-r border-line last:border-0">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const iso = toISO(d)
              const inMonth = d.getMonth() === cursor.getMonth()
              const isTodayD = iso === today
              const isSelected = iso === selectedDay
              const rate = rings.get(iso) ?? { done: 0, total: 0, pct: 0 }
              const state = dayCellState(iso, today, rate)
              const ms = milestones.get(iso) ?? { starts: [], due: [] }
              // Deadlines first: what a calendar can show that the Gantt cannot.
              const items: { task: Task; due: boolean }[] = [
                ...ms.due.map((task) => ({ task, due: true })),
                ...ms.starts.map((task) => ({ task, due: false })),
              ]
              const deco = cellDeco(state)
              const label = t('calendar.cellLabel', {
                date: formatLongDate(lang, d),
                due: t('calendar.dueCount', { count: ms.due.length }),
                starting: t('calendar.startingCount', { count: ms.starts.length }),
                coverage: coverageLabel(state, t),
              })
              // Every covered state carries the same pair; `clear` and `future`
              // have no obligation to draw.
              const owed = state.kind === 'owed' || state.kind === 'partial' || state.kind === 'full' ? state : null
              return (
                <div
                  key={iso}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  title={label}
                  onClick={() => setSelectedDay(iso)}
                  onKeyDown={(e) => onCellKey(e, iso)}
                  className={`relative min-h-[96px] border-r border-b border-line cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${
                    inMonth ? '' : 'opacity-30'
                  } ${isSelected ? 'bg-accent/10 ring-1 ring-inset ring-accent' : isTodayD ? 'bg-accent/5' : 'hover:bg-panel2/40'}`}
                >
                  {/* A separate layer rather than a box-shadow on the cell, so it
                      can never clobber the selection ring or the focus ring. */}
                  {deco.overlay && <div className="absolute inset-0 pointer-events-none" style={deco.overlay} />}
                  <div className="relative z-10 p-1">
                    <div className="flex items-center justify-between px-0.5 mb-1">
                      <span className={`text-[11px] font-mono ${isTodayD ? 'text-today font-bold' : 'text-muted'}`}>{d.getDate()}</span>
                      {owed && <ObligationPips done={owed.done} total={owed.total} />}
                    </div>
                    <div className="space-y-0.5">
                      {items.slice(0, 4).map(({ task, due }) => {
                        const logged = loggedByDay.get(iso)?.has(task.id) === true
                        // Strict work is exactly what the corner squares count, so
                        // the one colour left in the cell marks which milestones
                        // carry that obligation. Status is deliberately absent —
                        // the ▶ / ⏹ glyph already says what the row is, and a
                        // status colour had nothing left to add.
                        const strict = task.strictProgress && task.type === 'phase'
                        return (
                          <button
                            key={task.id}
                            onClick={(e) => { e.stopPropagation(); setSelected(task.id) }}
                            title={t('calendar.milestoneTitle', {
                              kind: due ? t('calendar.milestone.due') : t('calendar.milestone.starts'),
                              strict: strict ? t('calendar.milestone.strict') : '',
                              name: task.name,
                              logged: logged ? t('calendar.milestone.logged') : '',
                            })}
                            className={`w-full flex items-center gap-1 px-1 h-4 text-[10px] rounded-[2px] truncate text-left hover:bg-panel2 ${
                              strict ? 'text-today' : logged ? 'text-muted' : 'text-fg/80'
                            } ${logged ? 'line-through' : ''}`}
                          >
                            {due ? <Flag size={9} className="shrink-0" /> : <Play size={9} className="shrink-0" />}
                            <span className="truncate">{task.name}</span>
                          </button>
                        )
                      })}
                      {items.length > 4 && <div className="text-[10px] text-dim px-1">{t('calendar.more', { count: items.length - 4 })}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// An inset ring rather than a border colour: cells only carry `border-r` /
// `border-b` (the grid's own edges), so colouring a border would light up two
// sides and move the layout.
const CLEAR_RING = 'inset 0 0 0 1px rgb(var(--c-completed) / 0.30)'
const GLOW = {
  partial: 'inset 0 0 10px rgb(var(--c-in-progress) / 0.28)',
  full: 'inset 0 0 10px rgb(var(--c-completed) / 0.28)',
}

// Obligation squares. Logged ones fill in green; outstanding ones keep an
// outline — amber while the day still has some progress on it, red once nothing
// at all has been written.
const PIP_DONE = 'rgb(var(--c-completed))'
const PIP_OUTSTANDING = 'rgb(var(--c-in-progress) / 0.85)'
const PIP_MISSED = 'rgb(var(--c-delayed) / 0.85)'

// Past this many, the squares would be wider than the date beside them, so the
// row falls back to the plain count instead.
const MAX_PIPS = 6

/** The same thing in words, for the tooltip and the screen reader. */
function coverageLabel(state: DayCellState, t: TFunc): string {
  switch (state.kind) {
    case 'future': return t('calendar.coverage.future')
    case 'clear': return t('calendar.coverage.clear')
    case 'owed':
    case 'partial': return t('calendar.coverage.partial', { count: state.done, total: state.total })
    case 'full': return t('calendar.coverage.full', { count: state.total })
  }
}

/**
 * One square per strict task that owed a log that day, filled for the ones that
 * got one.
 *
 * Discrete on purpose. With one or two obligations a day, any proportion —
 * a fill height, a bar width — can only ever draw 0%, 50% or 100%, which claims
 * a resolution the data does not have and reads as three crude blocks. Counting
 * squares says exactly as much as the data does, and no more.
 */
function ObligationPips({ done, total }: { done: number; total: number }) {
  if (total > MAX_PIPS) {
    const tone = done === total ? 'text-completed' : done === 0 ? 'text-delayed' : 'text-today'
    return <span className={`font-mono text-[9px] ${tone}`}>{done}/{total}</span>
  }
  // Which particular logs are missing is not known — only how many — so the
  // filled ones lead, as every meter of this kind does.
  const outline = done === 0 ? PIP_MISSED : PIP_OUTSTANDING
  return (
    <span className="flex items-center gap-[2px]" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="w-[5px] h-[5px] rounded-[1px] border"
          style={i < done ? { background: PIP_DONE, borderColor: PIP_DONE } : { borderColor: outline }}
        />
      ))}
    </span>
  )
}

/**
 * The decorative layer of a cell. The state decision itself lives in
 * `dayCellState`; this only turns it into styles.
 */
function cellDeco(state: DayCellState): { overlay?: CSSProperties } {
  switch (state.kind) {
    case 'future':
      // Nothing has been owed yet, so nothing is marked. Not judging a day that
      // has not arrived is the whole reason this state exists.
      return {}
    case 'clear':
      // Nothing was owed and the day is over. A quiet outline and no glow: an
      // empty day must not outshine one that was actually worked.
      return { overlay: { boxShadow: CLEAR_RING } }
    case 'owed':
      // The squares already say "nothing written"; no glow on a day that has
      // nothing to celebrate.
      return {}
    case 'partial':
      return state.pct >= 90 ? { overlay: { boxShadow: GLOW.partial } } : {}
    case 'full':
      return { overlay: { boxShadow: GLOW.full } }
  }
}

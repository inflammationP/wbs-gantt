import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useStore } from '../store/useStore'
import { addMonths, startOfMonth, startOfWeek, addDays, toISO, MONTHS } from '../lib/dates'
import { STATUS_META } from '../lib/ui'
import { effectiveStates } from '../lib/tree'
import { strictLogRate } from '../lib/dayTasks'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarPage() {
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const today = useStore((s) => s.today)
  const selectedDay = useStore((s) => s.selectedDay)
  const setSelected = useStore((s) => s.setSelected)
  const setSelectedDay = useStore((s) => s.setSelectedDay)
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))

  const eff = useMemo(() => effectiveStates(tasks, logs), [tasks, logs])

  const byDay = useMemo(() => {
    const map = new Map<string, typeof tasks>()
    for (const t of tasks) {
      if (t.startDate == null) continue
      const key = t.startDate
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return map
  }, [tasks])

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
    const m = new Map<string, { done: number; total: number }>()
    for (const d of days) m.set(toISO(d), strictLogRate(tasks, logs, toISO(d)))
    return m
  }, [days, tasks, logs])

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
          <h1 className="text-[18px] font-semibold">Calendar</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor((c) => addMonths(c, -1))} className="px-2.5 h-8 text-[13px] border border-border rounded-[3px] hover:bg-panel2">‹</button>
            <button
              onClick={() => { setCursor(startOfMonth(new Date())); setSelectedDay(today) }}
              className="px-2.5 h-8 text-[12px] border border-border rounded-[3px] hover:bg-panel2"
            >
              Today
            </button>
            <button onClick={() => setCursor((c) => addMonths(c, 1))} className="px-2.5 h-8 text-[13px] border border-border rounded-[3px] hover:bg-panel2">›</button>
            <div className="w-44 text-center font-mono text-[13px]">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
          </div>
        </div>
        <div className="bg-panel border border-border rounded-[3px] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAY_LABELS.map((d) => <div key={d} className="h-8 flex items-center justify-center text-[10px] uppercase tracking-wider text-dim border-r border-line last:border-0">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const iso = toISO(d)
              const inMonth = d.getMonth() === cursor.getMonth()
              const dayTasks = byDay.get(iso) ?? []
              const isTodayD = iso === today
              const isSelected = iso === selectedDay
              const ring = rings.get(iso)
              return (
                <div
                  key={iso}
                  role="button"
                  tabIndex={0}
                  aria-label={`Show tasks for ${iso}`}
                  onClick={() => setSelectedDay(iso)}
                  onKeyDown={(e) => onCellKey(e, iso)}
                  className={`min-h-[96px] border-r border-b border-line p-1 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${
                    inMonth ? '' : 'opacity-30'
                  } ${isSelected ? 'bg-accent/10 ring-1 ring-inset ring-accent' : isTodayD ? 'bg-accent/5' : 'hover:bg-panel2/40'}`}
                >
                  <div className="flex items-center justify-between px-0.5 mb-1">
                    <span className={`text-[11px] font-mono ${isTodayD ? 'text-today font-bold' : 'text-muted'}`}>{d.getDate()}</span>
                    {ring && ring.total > 0 && (
                      <span
                        className={`font-mono text-[9px] ${ring.done === ring.total ? 'text-[#3fb950]' : 'text-today'}`}
                        title={`${ring.done} of ${ring.total} strict tasks logged`}
                      >
                        {ring.done}/{ring.total}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 4).map((t) => {
                      const meta = STATUS_META[eff.get(t.id)?.status ?? 'not-started']
                      return (
                        <button
                          key={t.id}
                          onClick={(e) => { e.stopPropagation(); setSelected(t.id) }}
                          className="w-full flex items-center gap-1 px-1 h-4 text-[10px] rounded-[2px] truncate hover:brightness-125"
                          style={{ background: meta.dim, color: meta.text }}
                        >
                          <span className="w-1 h-1 rounded-full shrink-0" style={{ background: meta.color }} />
                          <span className="truncate">{t.name}</span>
                        </button>
                      )
                    })}
                    {dayTasks.length > 4 && <div className="text-[10px] text-dim px-1">+{dayTasks.length - 4} more</div>}
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

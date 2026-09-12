import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { addMonths, startOfMonth, startOfWeek, addDays, toISO, todayISO, isToday, MONTHS } from '../lib/dates'
import { STATUS_META } from '../lib/ui'
import { effectiveStates } from '../lib/tree'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarPage() {
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const today = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))

  const eff = useMemo(() => effectiveStates(tasks, logs), [tasks, logs, today])

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

  const gridStart = startOfWeek(startOfMonth(cursor))
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[18px] font-semibold">Calendar</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor((c) => addMonths(c, -1))} className="px-2.5 h-8 text-[13px] border border-border rounded-[3px] hover:bg-panel2">‹</button>
            <button onClick={() => setCursor(startOfMonth(new Date()))} className="px-2.5 h-8 text-[12px] border border-border rounded-[3px] hover:bg-panel2">Today</button>
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
              const isTodayD = iso === todayISO()
              return (
                <div key={iso} className={`min-h-[96px] border-r border-b border-line p-1 ${inMonth ? '' : 'opacity-30'} ${isTodayD ? 'bg-accent/5' : ''}`}>
                  <div className={`text-[11px] font-mono mb-1 ${isTodayD ? 'text-today font-bold' : 'text-muted'}`}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 4).map((t) => {
                      const meta = STATUS_META[eff.get(t.id)?.status ?? 'not-started']
                      return (
                        <button key={t.id} onClick={() => setSelected(t.id)} className="w-full flex items-center gap-1 px-1 h-4 text-[10px] rounded-[2px] truncate hover:brightness-125" style={{ background: meta.dim, color: meta.text }}>
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

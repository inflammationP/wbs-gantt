import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { computeWbs, effectiveStates } from '../lib/tree'
import { STATUS_META, STATUS_ORDER, priorityMeta } from '../lib/ui'
import { formatShort } from '../lib/dates'
import { TaskStatus } from '../types'

export function TasksPage() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const logs = useStore((s) => s.logs)
  const today = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const setActiveView = useStore((s) => s.setActiveView)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')

  const wbs = useMemo(() => computeWbs(tasks), [tasks])
  const eff = useMemo(() => effectiveStates(tasks, logs), [tasks, logs, today])
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? ''

  const filtered = tasks
    .filter((t) => statusFilter === 'all' || eff.get(t.id)?.status === statusFilter)
    // To-dos last within each project, matching the Gantt's sibling order.
    .sort(
      (a, b) =>
        a.projectId.localeCompare(b.projectId) ||
        (a.isTodo ? 1 : 0) - (b.isTodo ? 1 : 0) ||
        (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
        a.name.localeCompare(b.name),
    )

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[18px] font-semibold">Tasks</h1>
          <select className="h-8 px-2 bg-panel2 border border-border rounded-[3px] text-[12px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}>
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
        <div className="bg-panel border border-border rounded-[3px] overflow-hidden">
          <div className="grid grid-cols-[70px_1fr_120px_120px_90px_90px_130px_100px] px-3 h-9 items-center text-[10px] uppercase tracking-wider text-dim border-b border-border bg-panel2">
            <span>WBS</span><span>Task</span><span>Project</span><span>Start</span><span>End</span><span>Progress</span><span>Status</span><span>Priority</span>
          </div>
          {filtered.map((t) => {
            const meta = STATUS_META[eff.get(t.id)?.status ?? 'not-started']
            const prio = priorityMeta(t.priority)
            return (
              <button key={t.id} onClick={() => setSelected(t.id)} className="grid grid-cols-[70px_1fr_120px_120px_90px_90px_130px_100px] px-3 h-9 items-center text-[12px] border-b border-line last:border-0 hover:bg-panel2 text-left w-full">
                <span className="font-mono text-[11px] text-dim">{wbs.get(t.id) ?? ''}</span>
                <span className="truncate text-fg/90">{t.name}</span>
                <span className="text-muted truncate">{projectName(t.projectId)}</span>
                <span className="font-mono text-[11px] text-muted">{t.startDate ? formatShort(t.startDate) : '—'}</span>
                <span className="font-mono text-[11px] text-muted">{t.endDate ? formatShort(t.endDate) : 'TBD'}</span>
                <span className="font-mono text-[11px] text-fg">{eff.get(t.id)?.progress != null ? `${eff.get(t.id)?.progress}%` : '—'}</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-[2px]" style={{ background: meta.color }} /><span style={{ color: meta.text }}>{meta.label}</span></span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: prio.color }} /><span className="text-muted">{prio.label}</span></span>
              </button>
            )
          })}
        </div>
        <button onClick={() => setActiveView('gantt')} className="mt-3 text-[12px] text-accent hover:text-fg">← Back to Gantt</button>
      </div>
    </div>
  )
}

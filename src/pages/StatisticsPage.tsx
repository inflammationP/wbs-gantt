import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { STATUS_META, STATUS_ORDER } from '../lib/ui'
import { effectiveStates } from '../lib/tree'

export function StatisticsPage() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const logs = useStore((s) => s.logs)
  const today = useStore((s) => s.today)

  const leaves = useMemo(() => tasks.filter((t) => !tasks.some((x) => x.parentId === t.id)), [tasks])
  const eff = useMemo(() => effectiveStates(tasks, logs), [tasks, logs, today])

  const byStatus = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of leaves) {
      const s = eff.get(t.id)?.status ?? 'not-started'
      m.set(s, (m.get(s) ?? 0) + 1)
    }
    return m
  }, [leaves, eff])

  const byProject = useMemo(() => {
    return projects.map((p) => {
      const ptasks = leaves.filter((t) => t.projectId === p.id)
      const ps = ptasks.map((t) => eff.get(t.id)?.progress).filter((x): x is number => x != null)
      const pct = ps.length ? Math.round(ps.reduce((s, x) => s + x, 0) / ps.length) : 0
      return { p, count: ptasks.length, pct }
    })
  }, [projects, leaves, eff])

  const maxStatus = Math.max(1, ...Array.from(byStatus.values()))
  const completion = leaves.length ? Math.round((leaves.filter((t) => eff.get(t.id)?.status === 'completed').length / leaves.length) * 100) : 0

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-[18px] font-semibold">Statistics</h1>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-panel border border-border rounded-[3px] p-4">
            <div className="text-[10px] uppercase tracking-wider text-dim mb-3">Tasks by status</div>
            <div className="space-y-2">
              {STATUS_ORDER.map((s) => {
                const n = byStatus.get(s) ?? 0
                const meta = STATUS_META[s]
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className="w-24 text-[11px] text-muted">{meta.label}</span>
                    <div className="flex-1 h-3 bg-panel2 rounded-[2px] overflow-hidden">
                      <div className="h-full" style={{ width: `${(n / maxStatus) * 100}%`, background: meta.color, opacity: 0.85 }} />
                    </div>
                    <span className="w-6 text-right font-mono text-[11px] text-fg">{n}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-panel border border-border rounded-[3px] p-4">
            <div className="text-[10px] uppercase tracking-wider text-dim mb-3">Progress by project</div>
            <div className="space-y-2">
              {byProject.map(({ p, count, pct }) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="w-24 truncate text-[11px] text-muted">{p.name}</span>
                  <div className="flex-1 h-3 bg-panel2 rounded-[2px] overflow-hidden">
                    <div className="h-full" style={{ width: `${pct}%`, background: p.color }} />
                  </div>
                  <span className="w-10 text-right font-mono text-[11px] text-fg">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-panel border border-border rounded-[3px] p-4">
            <div className="text-[10px] uppercase tracking-wider text-dim">Total tasks</div>
            <div className="text-[26px] font-mono font-semibold mt-1">{tasks.length}</div>
            <div className="text-[11px] text-muted">{leaves.length} leaf tasks</div>
          </div>
          <div className="bg-panel border border-border rounded-[3px] p-4">
            <div className="text-[10px] uppercase tracking-wider text-dim">Completion</div>
            <div className="text-[26px] font-mono font-semibold mt-1">{completion}%</div>
            <div className="text-[11px] text-muted">of leaf tasks completed</div>
          </div>
        </div>
      </div>
    </div>
  )
}

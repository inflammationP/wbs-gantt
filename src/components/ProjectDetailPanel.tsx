import { useMemo } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { averageProgress } from '../lib/progress'
import { effectiveStates } from '../lib/tree'
import { useT } from '../lib/useT'

export function ProjectDetailPanel({ projectId }: { projectId: string }) {
  const t = useT()
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const today = useStore((s) => s.today)
  const setSelectedProject = useStore((s) => s.setSelectedProject)
  const setProjectFilter = useStore((s) => s.setProjectFilter)
  const setActiveView = useStore((s) => s.setActiveView)

  const stats = useMemo(() => {
    const ptasks = tasks.filter((t) => t.projectId === projectId)
    const leaves = ptasks.filter((t) => !tasks.some((x) => x.parentId === t.id))
    const pct = averageProgress(leaves, logs)
    const eff = effectiveStates(ptasks, logs)
    const done = leaves.filter((t) => eff.get(t.id)?.status === 'completed').length
    return { total: ptasks.length, leaves: leaves.length, pct, done }
  }, [tasks, logs, today, projectId])

  if (!project) return null

  return (
    <aside className="w-[320px] shrink-0 border-l border-border bg-panel flex flex-col overflow-hidden">
      {/* header */}
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-dim">{t('project.heading')}</span>
          <button
            onClick={() => setSelectedProject(null)}
            aria-label={t('common.close')}
            title={t('common.close')}
            className="text-dim hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: project.color }} />
          <span className="text-[15px] font-semibold text-fg">{project.name}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* progress */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-dim">{t('common.progress')}</span>
            <span className="font-mono text-[11px] text-fg">{stats.pct}%</span>
          </div>
          <div className="h-2 bg-panel2 rounded-full overflow-hidden">
            <div className="h-full" style={{ width: `${stats.pct}%`, background: project.color }} />
          </div>
        </div>

        {/* stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-panel2 border border-border rounded-[3px] px-2 py-2 text-center">
            <div className="text-[15px] font-mono text-fg">{stats.total}</div>
            <div className="text-[9px] uppercase tracking-wider text-dim">{t('common.tasks')}</div>
          </div>
          <div className="bg-panel2 border border-border rounded-[3px] px-2 py-2 text-center">
            <div className="text-[15px] font-mono text-fg">{stats.done}</div>
            <div className="text-[9px] uppercase tracking-wider text-dim">{t('project.done')}</div>
          </div>
          <div className="bg-panel2 border border-border rounded-[3px] px-2 py-2 text-center">
            <div className="text-[15px] font-mono text-fg">{stats.leaves - stats.done}</div>
            <div className="text-[9px] uppercase tracking-wider text-dim">{t('project.open')}</div>
          </div>
        </div>

        {/* description */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-dim">{t('common.description')}</span>
          <div className="mt-1.5 text-[12px] text-muted leading-relaxed whitespace-pre-wrap">{project.description || t('common.noDescription')}</div>
        </div>
      </div>

      {/* footer */}
      <div className="shrink-0 p-3 border-t border-border">
        <button
          onClick={() => { setProjectFilter(project.id); setActiveView('gantt') }}
          className="w-full h-8 text-[12px] text-accent hover:text-fg border border-border rounded-[3px]"
        >
          {t('manage.openInGantt')}
        </button>
      </div>
    </aside>
  )
}

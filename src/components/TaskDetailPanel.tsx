import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Task } from '../types'
import { useStore } from '../store/useStore'
import { computeWbs, effectiveStates } from '../lib/tree'
import { STATUS_META, PRIORITY_META, TASK_TYPE_LABEL } from '../lib/ui'
import { toDate, MONTHS_SHORT } from '../lib/dates'

function formatDate(iso: string | null): string {
  if (!iso) return 'TBD'
  const d = toDate(iso)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function ReadOnlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{label}</div>
      <div className="h-8 px-2 flex items-center gap-1.5 bg-panel2 border border-border rounded-[3px] text-[12px] text-muted overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export function TaskDetailPanel({ taskId }: { taskId: string }) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const setSelected = useStore((s) => s.setSelected)

  const project = useMemo(() => projects.find((p) => p.id === task?.projectId), [projects, task])

  if (!task || !project) return null

  const subtasks = tasks.filter((t) => t.parentId === task.id)
  const hasKids = subtasks.length > 0
  const projectTasks = tasks.filter((t) => t.projectId === task.projectId)
  const wbs = computeWbs(projectTasks).get(task.id) ?? ''
  const eff = effectiveStates(projectTasks).get(task.id)
  const effProgress = eff?.progress ?? task.progress
  const depTasks = task.dependencies
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as Task[]

  return (
    <aside className="w-[320px] shrink-0 border-l border-border bg-panel flex flex-col overflow-hidden">
      {/* header */}
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[11px] text-dim">WBS {wbs || '—'}</span>
          <button onClick={() => setSelected(null)} className="text-dim hover:text-fg"><X size={16} /></button>
        </div>
        <div className="text-[15px] font-semibold text-fg">{task.name}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
          {project.name}
          {hasKids && <span className="text-dim">· {subtasks.length} subtasks</span>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* type */}
        <ReadOnlyField label="Type">{TASK_TYPE_LABEL[task.type]}</ReadOnlyField>

        {/* status + priority */}
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Status">
            <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: STATUS_META[task.status].color }} />
            <span className="truncate">{STATUS_META[task.status].label}</span>
          </ReadOnlyField>
          <ReadOnlyField label="Priority">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRIORITY_META[task.priority].color }} />
            <span>{PRIORITY_META[task.priority].label}</span>
          </ReadOnlyField>
        </div>

        {/* dates */}
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Start">{task.startDate ? formatDate(task.startDate) : '—'}</ReadOnlyField>
          <ReadOnlyField label="End">{task.type === 'long-term' ? 'TBD' : formatDate(task.endDate)}</ReadOnlyField>
        </div>

        {/* progress (static) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-dim">Progress</span>
            <span className="font-mono text-[11px] text-muted">{effProgress}%</span>
          </div>
          <div className="h-2 bg-panel2 rounded-full overflow-hidden">
            <div className="h-full" style={{ width: `${effProgress}%`, background: STATUS_META[task.status].color, opacity: 0.7 }} />
          </div>
        </div>

        {/* hours */}
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Est. hours">{task.estimatedHours}</ReadOnlyField>
          <ReadOnlyField label="Actual hours">{task.actualHours}</ReadOnlyField>
        </div>

        {/* tags */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Tags</div>
          {task.tags.length ? (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((t) => (
                <span key={t} className="inline-flex items-center px-1.5 h-5 text-[11px] bg-panel2 border border-border rounded-[3px] text-muted">{t}</span>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">—</div>
          )}
        </div>

        {/* dependencies */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Dependencies</div>
          {depTasks.length ? (
            <div className="space-y-1">
              {depTasks.map((d) => (
                <div key={d.id} className="flex items-center px-2 h-7 bg-panel2 border border-border rounded-[3px] text-[11px] text-muted">
                  <span className="truncate">{d.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">—</div>
          )}
        </div>

        {/* subtasks */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Subtasks</div>
          {subtasks.length ? (
            <div className="space-y-1">
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 px-2 h-7 bg-panel2 border border-border rounded-[3px] text-[11px] text-muted">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_META[st.status].color }} />
                  <span className="truncate">{st.name}</span>
                  <span className="ml-auto font-mono text-dim">{st.progress}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">No subtasks.</div>
          )}
        </div>

        {/* description */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Description</div>
          <div className="text-[12px] text-muted leading-relaxed whitespace-pre-wrap">{task.description || 'No description.'}</div>
        </div>
      </div>
    </aside>
  )
}

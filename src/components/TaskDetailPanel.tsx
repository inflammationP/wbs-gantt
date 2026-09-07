import { useMemo, useState } from 'react'
import { X, Trash2, Plus } from 'lucide-react'
import { Task, TaskStatus, TaskPriority, TaskType } from '../types'
import { useStore } from '../store/useStore'
import { computeWbs, collectDescendants, effectiveStates } from '../lib/tree'
import { STATUS_META, PRIORITY_META, STATUS_ORDER, PRIORITY_ORDER, TASK_TYPE_LABEL } from '../lib/ui'
import { inputCls } from './ui'
import { todayISO } from '../lib/dates'

export function TaskDetailPanel({ taskId }: { taskId: string }) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const updateTask = useStore((s) => s.updateTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const setSelected = useStore((s) => s.setSelected)
  const addTask = useStore((s) => s.addTask)
  const [tagInput, setTagInput] = useState('')

  const project = useMemo(() => projects.find((p) => p.id === task?.projectId), [projects, task])

  if (!task || !project) return null

  const up = (patch: Partial<Task>) => updateTask(task.id, patch)
  const subtasks = tasks.filter((t) => t.parentId === task.id)
  const hasKids = subtasks.length > 0
  const isLT = task.type === 'long-term'
  const projectTasks = tasks.filter((t) => t.projectId === task.projectId)
  const wbs = computeWbs(projectTasks).get(task.id) ?? ''
  const eff = effectiveStates(projectTasks).get(task.id)
  const effProgress = eff?.progress ?? task.progress

  const depTasks = task.dependencies
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as Task[]
  const depOptions = tasks.filter(
    (t) => t.id !== task.id && !task.dependencies.includes(t.id) && !collectDescendants(tasks, task.id).includes(t.id),
  )

  const setType = (v: TaskType) => {
    if (v === 'long-term') up({ type: v, startDate: null, endDate: null })
    else up({ type: v, startDate: task.startDate ?? todayISO(), endDate: task.endDate ?? todayISO() })
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    if (!task.tags.includes(t)) up({ tags: [...task.tags, t] })
    setTagInput('')
  }

  const addSubtask = () => {
    const id = addTask({
      name: 'New subtask',
      projectId: task.projectId,
      parentId: task.id,
      startDate: task.startDate ?? todayISO(),
      endDate: task.endDate ?? todayISO(),
    })
    setSelected(id)
  }

  return (
    <aside className="w-[320px] shrink-0 border-l border-border bg-panel flex flex-col overflow-hidden">
      {/* header */}
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[11px] text-dim">WBS {wbs || '—'}</span>
          <button onClick={() => setSelected(null)} className="text-dim hover:text-fg"><X size={16} /></button>
        </div>
        <input className="w-full bg-transparent text-[15px] font-semibold text-fg focus:outline-none" value={task.name} onChange={(e) => up({ name: e.target.value })} />
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
          {project.name}
          {hasKids && <span className="text-dim">· {subtasks.length} subtasks</span>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* type */}
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-dim">Type</span>
          <select className={inputCls + ' mt-1'} value={task.type} onChange={(e) => setType(e.target.value as TaskType)}>
            <option value="phase">{TASK_TYPE_LABEL.phase}</option>
            <option value="long-term">{TASK_TYPE_LABEL['long-term']}</option>
          </select>
        </label>

        {/* status + priority */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-dim">Status</span>
            <select className={inputCls + ' mt-1'} value={task.status} onChange={(e) => up({ status: e.target.value as TaskStatus })}>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-dim">Priority</span>
            <select className={inputCls + ' mt-1'} value={task.priority} onChange={(e) => up({ priority: e.target.value as TaskPriority })}>
              {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          </label>
        </div>

        {/* dates */}
        {isLT ? (
          <div className="text-[11px] text-dim">Long-term goal — no fixed dates.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-dim">Start</span>
                <input type="date" className={inputCls + ' mt-1'} value={task.startDate ?? ''} onChange={(e) => up({ startDate: e.target.value || null })} disabled={hasKids} />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-dim">End</span>
                <input type="date" className={inputCls + ' mt-1'} value={task.endDate ?? ''} onChange={(e) => up({ endDate: e.target.value || null })} disabled={hasKids} />
              </label>
            </div>
            {hasKids && <div className="text-[10px] text-dim -mt-2">Dates & progress derived from subtasks.</div>}
          </>
        )}

        {/* progress */}
        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-dim">Progress</span>
            <span className="font-mono text-[11px] text-fg">{effProgress}%</span>
          </div>
          <input type="range" min={0} max={100} value={effProgress} onChange={(e) => up({ progress: Number(e.target.value) })} disabled={hasKids} className="w-full accent-[#46b8e6] mt-1" />
        </label>

        {/* hours */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-dim">Est. hours</span>
            <input type="number" min={0} className={inputCls + ' mt-1'} value={task.estimatedHours} onChange={(e) => up({ estimatedHours: Number(e.target.value) || 0 })} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-dim">Actual hours</span>
            <input type="number" min={0} className={inputCls + ' mt-1'} value={task.actualHours} onChange={(e) => up({ actualHours: Number(e.target.value) || 0 })} />
          </label>
        </div>

        {/* tags */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-dim">Tags</span>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {task.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-1.5 h-5 text-[11px] bg-panel2 border border-border rounded-[3px] text-muted">
                {t}
                <button onClick={() => up({ tags: task.tags.filter((x) => x !== t) })} className="text-dim hover:text-fg"><X size={10} /></button>
              </span>
            ))}
            <input
              className="w-20 h-5 px-1.5 text-[11px] bg-panel2 border border-border rounded-[3px] focus:outline-none focus:border-accent"
              placeholder="+ tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addTag() }}
            />
          </div>
        </div>

        {/* dependencies */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-dim">Dependencies</span>
          <div className="space-y-1 mt-1.5">
            {depTasks.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-2 h-7 bg-panel2 border border-border rounded-[3px] text-[11px] text-fg/90">
                <span className="truncate">{d.name}</span>
                <button onClick={() => up({ dependencies: task.dependencies.filter((x) => x !== d.id) })} className="text-dim hover:text-fg"><X size={11} /></button>
              </div>
            ))}
            {depOptions.length > 0 && (
              <select className={inputCls} value="" onChange={(e) => { if (e.target.value) up({ dependencies: [...task.dependencies, e.target.value] }) }}>
                <option value="">+ Add dependency…</option>
                {depOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* subtasks */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-dim">Subtasks</span>
            <button onClick={addSubtask} className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-fg"><Plus size={12} /> Add</button>
          </div>
          <div className="mt-1.5 space-y-1">
            {subtasks.map((st) => (
              <button key={st.id} onClick={() => setSelected(st.id)} className="w-full flex items-center gap-2 px-2 h-7 bg-panel2 border border-border rounded-[3px] text-[11px] text-fg/90 hover:border-accent text-left">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_META[st.status].color }} />
                <span className="truncate">{st.name}</span>
                <span className="ml-auto font-mono text-dim">{st.progress}%</span>
              </button>
            ))}
            {subtasks.length === 0 && <div className="text-[11px] text-dim">No subtasks.</div>}
          </div>
        </div>

        {/* description */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-dim">Description</span>
          <textarea className={inputCls + ' h-20 py-1.5 mt-1 resize-none'} value={task.description} onChange={(e) => up({ description: e.target.value })} placeholder="Notes…" />
        </div>
      </div>

      {/* footer */}
      <div className="shrink-0 p-3 border-t border-border">
        <button
          onClick={() => {
            if (confirm(hasKids ? 'Delete task and all its subtasks?' : 'Delete task?')) {
              deleteTask(task.id)
              setSelected(null)
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 h-8 text-[12px] text-[#f85149] border border-[#f85149]/30 hover:bg-[#f85149]/10 rounded-[3px]"
        >
          <Trash2 size={13} /> Delete task
        </button>
      </div>
    </aside>
  )
}

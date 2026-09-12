import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Project, Task, TaskStatus } from '../types'
import { addDays, formatShort, toISO, todayISO } from '../lib/dates'
import { PROJECT_COLORS, STATUS_META, STATUS_ORDER, priorityMeta } from '../lib/ui'
import { computeWbs, effectiveStates } from '../lib/tree'

// Dashboard, Tasks, Projects and Statistics used to be four separate pages that
// each re-derived the same numbers. They are one page now, in three bands:
// overview, projects, tasks. Every figure appears exactly once.
export function ManagePage() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const logs = useStore((s) => s.logs)
  const todayStamp = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const setActiveView = useStore((s) => s.setActiveView)
  const setProjectFilter = useStore((s) => s.setProjectFilter)
  const addProject = useStore((s) => s.addProject)
  const updateProject = useStore((s) => s.updateProject)
  const deleteProject = useStore((s) => s.deleteProject)

  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const today = todayISO()
  const weekISO = toISO(addDays(new Date(), 7))

  const eff = useMemo(() => effectiveStates(tasks, logs), [tasks, logs, todayStamp])
  // Every count on this page is over leaf tasks, matching what the Gantt shows
  // as work.
  const leaves = useMemo(() => tasks.filter((t) => !tasks.some((x) => x.parentId === t.id)), [tasks])

  const overview = useMemo(() => {
    const overdue = leaves.filter((t) => eff.get(t.id)?.status === 'delayed')
    const todayTasks = leaves.filter((t) => t.startDate != null && t.endDate != null && t.startDate <= today && t.endDate >= today)
    const upcoming = leaves.filter((t) => t.startDate != null && t.startDate > today && t.startDate <= weekISO)
    return { overdue, todayTasks, upcoming }
  }, [leaves, eff, today, weekISO])

  const counts = useMemo(() => {
    const byStatus = (s: TaskStatus) => leaves.filter((t) => eff.get(t.id)?.status === s).length
    return {
      inProgress: byStatus('in-progress'),
      completed: byStatus('completed'),
      paused: byStatus('paused'),
      delayed: byStatus('delayed'),
      todo: byStatus('todo'),
      // Work that has not started yet but begins inside the week.
      comingSoon: leaves.filter((t) => t.startDate != null && t.startDate > today && t.startDate <= weekISO).length,
      // Work due inside the week and not yet finished. Kept off its own card —
      // it rides along in the Delayed card's caption instead. The two never
      // overlap: `delayed` requires the end date to be already past.
      dueSoon: leaves.filter(
        (t) => t.endDate != null && t.endDate >= today && t.endDate <= weekISO && eff.get(t.id)?.status !== 'completed',
      ).length,
    }
  }, [leaves, eff, today, weekISO])

  const wbs = useMemo(() => computeWbs(tasks), [tasks])
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

  const statsFor = (pid: string) => {
    const ptasks = tasks.filter((t) => t.projectId === pid)
    const pleaves = ptasks.filter((t) => !tasks.some((x) => x.parentId === t.id))
    const peff = effectiveStates(ptasks, logs)
    const ps = pleaves.map((t) => peff.get(t.id)?.progress).filter((p): p is number => p != null)
    const pct = ps.length ? Math.round(ps.reduce((s, x) => s + x, 0) / ps.length) : 0
    const done = pleaves.filter((t) => peff.get(t.id)?.status === 'completed').length
    return { total: ptasks.length, leaves: pleaves.length, pct, done }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-[18px] font-semibold text-fg">Manage</h1>

        {/* ---- Overall ---- */}
        <div>
          <h2 className="text-[14px] font-semibold text-fg mb-3">Overall</h2>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Projects" value={String(projects.length)} sub="active" />
            <Stat label="Total tasks" value={String(tasks.length)} sub={`${leaves.length} leaf tasks`} />
          </div>

          {/* The bands are nested now, so the parent's `space-y-6` no longer
              separates these two grids — hence the explicit `mt-4`. */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Section title="Today">
              {overview.todayTasks.length === 0 && <Empty />}
              {overview.todayTasks.map((t) => (
                <TaskRow key={t.id} task={t} status={eff.get(t.id)?.status ?? 'not-started'} project={projects.find((p) => p.id === t.projectId)} onClick={() => setSelected(t.id)} />
              ))}
            </Section>
            <Section title="Upcoming (7 days)">
              {overview.upcoming.length === 0 && <Empty />}
              {overview.upcoming.map((t) => (
                <TaskRow key={t.id} task={t} status={eff.get(t.id)?.status ?? 'not-started'} project={projects.find((p) => p.id === t.projectId)} onClick={() => setSelected(t.id)} />
              ))}
            </Section>
            <Section title="Overdue">
              {overview.overdue.length === 0 && <Empty />}
              {overview.overdue.map((t) => (
                <TaskRow key={t.id} task={t} status={eff.get(t.id)?.status ?? 'not-started'} project={projects.find((p) => p.id === t.projectId)} onClick={() => setSelected(t.id)} overdue />
              ))}
            </Section>
          </div>
        </div>

        {/* ---- Projects ---- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-fg">Projects</h2>
            <button
              onClick={() => {
                const name = prompt('Project name')
                if (name?.trim()) addProject(name.trim(), PROJECT_COLORS[projects.length % PROJECT_COLORS.length])
              }}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium bg-accent text-black rounded-[3px] hover:brightness-110"
            >
              <Plus size={14} /> New project
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {projects.map((p) => {
              const s = statsFor(p.id)
              return (
                <div key={p.id} className="bg-panel border border-border rounded-[3px] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                    {editing === p.id ? (
                      <input
                        className="flex-1 h-7 px-2 bg-panel2 border border-border rounded-[3px] text-[13px]"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') { updateProject(p.id, { name: newName.trim() || p.name }); setEditing(null) } }}
                        onBlur={() => { updateProject(p.id, { name: newName.trim() || p.name }); setEditing(null) }}
                      />
                    ) : (
                      <span className="flex-1 text-[14px] font-semibold">{p.name}</span>
                    )}
                    <button onClick={() => { setEditing(p.id); setNewName(p.name) }} className="p-1 text-dim hover:text-fg"><Pencil size={13} /></button>
                    <button onClick={() => { if (confirm(`Delete project "${p.name}" and all its tasks?`)) deleteProject(p.id) }} className="p-1 text-dim hover:text-[#f85149]"><Trash2 size={13} /></button>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-panel2 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${s.pct}%`, background: p.color }} /></div>
                    <span className="font-mono text-[12px] text-fg">{s.pct}%</span>
                  </div>
                  <div className="flex gap-4 text-[11px] text-muted">
                    <span>{s.total} tasks</span>
                    <span>{s.done} completed</span>
                    <span>{s.leaves - s.done} open</span>
                  </div>
                  <button onClick={() => { setProjectFilter(p.id); setActiveView('gantt') }} className="mt-3 text-[11px] text-accent hover:text-fg">Open in Gantt →</button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---- Tasks ---- */}
        <div>
          <h2 className="text-[14px] font-semibold text-fg mb-3">Tasks</h2>

          {/* Counts are not mutually exclusive — one task can be both in progress
              and starting this week — so they do not sum to the total. */}
          <div className="grid grid-cols-6 gap-3 mb-4">
            <Stat label="In progress" value={String(counts.inProgress)} sub="active" />
            <Stat label="Completed" value={String(counts.completed)} sub="done" />
            <Stat label="Paused" value={String(counts.paused)} sub="paused" />
            <Stat label="Coming soon" value={String(counts.comingSoon)} sub="starts in 7 days" />
            <Stat
              label="Delayed"
              value={String(counts.delayed)}
              sub={counts.dueSoon > 0 ? `past due · ${counts.dueSoon} due soon` : 'past due'}
              danger={counts.delayed > 0}
            />
            <Stat label="To-do" value={String(counts.todo)} sub="unscheduled" />
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] text-muted">
              {filtered.length} of {tasks.length} tasks
            </div>
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
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, danger }: { label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <div className="bg-panel border border-border rounded-[3px] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`text-[22px] font-semibold font-mono mt-1 ${danger ? 'text-[#f85149]' : 'text-fg'}`}>{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-panel border border-border rounded-[3px] p-3">
      <div className="text-[10px] uppercase tracking-wider text-dim mb-2">{title}</div>
      {children}
    </div>
  )
}

function Empty() {
  return <div className="text-[12px] text-dim py-2">Nothing here.</div>
}

function TaskRow({ task, status, project, onClick, overdue }: { task: Task; status: TaskStatus; project?: Project; onClick: () => void; overdue?: boolean }) {
  const meta = STATUS_META[status]
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[3px] hover:bg-panel2 text-left">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      <span className={`flex-1 truncate text-[12px] ${overdue ? 'text-[#f85149]' : 'text-fg/90'}`}>{task.name}</span>
      {project && <span className="text-[10px] shrink-0" style={{ color: project.color }}>{project.name}</span>}
    </button>
  )
}

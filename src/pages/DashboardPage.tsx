import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../store/useStore'
import { Project, Task, TaskStatus } from '../types'
import { addDays, toISO, todayISO } from '../lib/dates'
import { STATUS_META } from '../lib/ui'
import { averageProgress } from '../lib/progress'
import { effectiveStates } from '../lib/tree'

export function DashboardPage() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const logs = useStore((s) => s.logs)
  const todayStamp = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const setActiveView = useStore((s) => s.setActiveView)
  const setProjectFilter = useStore((s) => s.setProjectFilter)

  const today = todayISO()
  const weekISO = toISO(addDays(new Date(), 7))

  const eff = useMemo(() => effectiveStates(tasks, logs), [tasks, logs, todayStamp])

  const stats = useMemo(() => {
    const leaves = tasks.filter((t) => !tasks.some((x) => x.parentId === t.id))
    const overdue = leaves.filter((t) => eff.get(t.id)?.status === 'delayed')
    const inProgress = leaves.filter((t) => eff.get(t.id)?.status === 'in-progress')
    const todayTasks = leaves.filter((t) => t.startDate != null && t.endDate != null && t.startDate <= today && t.endDate >= today)
    const upcoming = leaves.filter((t) => t.startDate != null && t.startDate > today && t.startDate <= weekISO)
    const completed = leaves.filter((t) => eff.get(t.id)?.status === 'completed')
    const overall = averageProgress(leaves, logs)
    return { overdue, inProgress, todayTasks, upcoming, completed, overall, leaves }
  }, [tasks, logs, eff, today, weekISO])

  const project = (id: string) => projects.find((p) => p.id === id)

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-[18px] font-semibold text-fg">Dashboard</h1>
          <div className="text-[12px] text-muted mt-0.5">{stats.leaves.length} active tasks · {projects.length} projects</div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          <Stat label="Overall" value={`${stats.overall}%`} sub={`${stats.completed.length} done`} />
          <Stat label="In progress" value={String(stats.inProgress.length)} sub="active" />
          <Stat label="Overdue" value={String(stats.overdue.length)} sub="past due" danger={stats.overdue.length > 0} />
          <Stat label="Due soon" value={String(stats.upcoming.length)} sub="next 7 days" />
          <Stat label="Projects" value={String(projects.length)} sub="active" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Section title="Today">
            {stats.todayTasks.length === 0 && <Empty />}
            {stats.todayTasks.map((t) => <TaskRow key={t.id} task={t} status={eff.get(t.id)?.status ?? 'not-started'} project={project(t.projectId)} onClick={() => setSelected(t.id)} />)}
          </Section>
          <Section title="Upcoming (7 days)">
            {stats.upcoming.length === 0 && <Empty />}
            {stats.upcoming.map((t) => <TaskRow key={t.id} task={t} status={eff.get(t.id)?.status ?? 'not-started'} project={project(t.projectId)} onClick={() => setSelected(t.id)} />)}
          </Section>
          <Section title="Overdue">
            {stats.overdue.length === 0 && <Empty />}
            {stats.overdue.map((t) => <TaskRow key={t.id} task={t} status={eff.get(t.id)?.status ?? 'not-started'} project={project(t.projectId)} onClick={() => setSelected(t.id)} overdue />)}
          </Section>
        </div>

        <Section title="Projects">
          <div className="space-y-2">
            {projects.map((p) => {
              const ptasks = tasks.filter((t) => t.projectId === p.id && !tasks.some((x) => x.parentId === t.id))
              const pct = averageProgress(ptasks, logs)
              return (
                <button key={p.id} onClick={() => { setProjectFilter(p.id); setActiveView('gantt') }} className="w-full flex items-center gap-3 px-3 py-2 bg-panel border border-border rounded-[3px] hover:border-accent text-left">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="w-40 truncate text-[12px] text-fg">{p.name}</span>
                  <div className="flex-1 h-2 bg-panel2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                  </div>
                  <span className="w-10 text-right font-mono text-[11px] text-muted">{pct}%</span>
                  <span className="w-10 text-right font-mono text-[11px] text-dim">{ptasks.length}</span>
                </button>
              )
            })}
          </div>
        </Section>
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

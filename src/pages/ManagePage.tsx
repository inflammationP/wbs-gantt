import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Project, Task, TaskStatus } from '../types'
import { addDays, toDate, toISO, todayISO } from '../lib/dates'
import { PROJECT_COLORS, STATUS_META, STATUS_ORDER, priorityMeta, sig, sigText } from '../lib/ui'
import { formatShortDate } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { computeWbs, effectiveStates } from '../lib/tree'
import { useDialogs } from '../components/dialogs'

// Dashboard, Tasks, Projects and Statistics used to be four separate pages that
// each re-derived the same numbers. They are one page now, in three bands:
// overview, projects, tasks. Every figure appears exactly once.
export function ManagePage() {
  const t = useT()
  const lang = useLang()
  const { ask, askText, element: dialogs } = useDialogs()
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
  const leaves = useMemo(() => tasks.filter((task) => !tasks.some((x) => x.parentId === task.id)), [tasks])

  const overview = useMemo(() => {
    const overdue = leaves.filter((task) => eff.get(task.id)?.status === 'delayed')
    const todayTasks = leaves.filter((task) => task.startDate != null && task.endDate != null && task.startDate <= today && task.endDate >= today)
    const upcoming = leaves.filter((task) => task.startDate != null && task.startDate > today && task.startDate <= weekISO)
    return { overdue, todayTasks, upcoming }
  }, [leaves, eff, today, weekISO])

  const counts = useMemo(() => {
    const byStatus = (s: TaskStatus) => leaves.filter((task) => eff.get(task.id)?.status === s).length
    return {
      inProgress: byStatus('in-progress'),
      completed: byStatus('completed'),
      paused: byStatus('paused'),
      delayed: byStatus('delayed'),
      todo: byStatus('todo'),
      // Work that has not started yet but begins inside the week.
      comingSoon: leaves.filter((task) => task.startDate != null && task.startDate > today && task.startDate <= weekISO).length,
      // Work due inside the week and not yet finished. Kept off its own card —
      // it rides along in the Delayed card's caption instead. The two never
      // overlap: `delayed` requires the end date to be already past.
      dueSoon: leaves.filter(
        (task) => task.endDate != null && task.endDate >= today && task.endDate <= weekISO && eff.get(task.id)?.status !== 'completed',
      ).length,
    }
  }, [leaves, eff, today, weekISO])

  const wbs = useMemo(() => computeWbs(tasks), [tasks])
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? ''

  const filtered = tasks
    .filter((task) => statusFilter === 'all' || eff.get(task.id)?.status === statusFilter)
    // To-dos last within each project, matching the Gantt's sibling order.
    .sort(
      (a, b) =>
        a.projectId.localeCompare(b.projectId) ||
        (a.isTodo ? 1 : 0) - (b.isTodo ? 1 : 0) ||
        (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
        a.name.localeCompare(b.name),
    )

  const statsFor = (pid: string) => {
    const ptasks = tasks.filter((task) => task.projectId === pid)
    const pleaves = ptasks.filter((task) => !tasks.some((x) => x.parentId === task.id))
    const peff = effectiveStates(ptasks, logs)
    const ps = pleaves.map((task) => peff.get(task.id)?.progress).filter((p): p is number => p != null)
    const pct = ps.length ? Math.round(ps.reduce((s, x) => s + x, 0) / ps.length) : 0
    const done = pleaves.filter((task) => peff.get(task.id)?.status === 'completed').length
    return { total: ptasks.length, leaves: pleaves.length, pct, done }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-[18px] font-semibold text-fg">{t('nav.manage')}</h1>

        {/* ---- Overall ---- */}
        <div>
          <h2 className="text-[14px] font-semibold text-fg mb-3">{t('manage.overall')}</h2>

          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('sidebar.projects')} value={String(projects.length)} sub={t('manage.sub.tracked')} />
            <Stat label={t('manage.totalTasks')} value={String(tasks.length)} sub={t('manage.leafTasks', { count: leaves.length })} />
          </div>

          {/* The bands are nested now, so the parent's `space-y-6` no longer
              separates these two grids — hence the explicit `mt-4`. */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Section title={t('time.today')}>
              {overview.todayTasks.length === 0 && <Empty />}
              {overview.todayTasks.map((task) => (
                <TaskRow key={task.id} task={task} status={eff.get(task.id)?.status ?? 'not-started'} project={projects.find((p) => p.id === task.projectId)} onClick={() => setSelected(task.id)} />
              ))}
            </Section>
            <Section title={t('manage.upcoming')}>
              {overview.upcoming.length === 0 && <Empty />}
              {overview.upcoming.map((task) => (
                <TaskRow key={task.id} task={task} status={eff.get(task.id)?.status ?? 'not-started'} project={projects.find((p) => p.id === task.projectId)} onClick={() => setSelected(task.id)} />
              ))}
            </Section>
            <Section title={t('manage.overdue')}>
              {overview.overdue.length === 0 && <Empty />}
              {overview.overdue.map((task) => (
                <TaskRow key={task.id} task={task} status={eff.get(task.id)?.status ?? 'not-started'} project={projects.find((p) => p.id === task.projectId)} onClick={() => setSelected(task.id)} overdue />
              ))}
            </Section>
          </div>
        </div>

        {/* ---- Projects ---- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-fg">{t('sidebar.projects')}</h2>
            <button
              onClick={() =>
                askText(t('manage.projectNamePrompt'), '', (name) =>
                  addProject(name, PROJECT_COLORS[projects.length % PROJECT_COLORS.length]),
                )
              }
              className="h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] hover:brightness-110"
            >
              <Plus size={14} /> {t('manage.newProject')}
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
                    <button
                      onClick={() => { setEditing(p.id); setNewName(p.name) }}
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                      className="p-1 text-dim hover:text-fg"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => ask(t('manage.deleteProject', { name: p.name }), () => deleteProject(p.id))}
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                      className="p-1 text-dim hover:text-delayed"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-panel2 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${s.pct}%`, background: p.color }} /></div>
                    <span className="font-mono text-[12px] text-fg">{s.pct}%</span>
                  </div>
                  <div className="flex gap-4 text-[11px] text-muted">
                    <span>{t('common.taskCount', { count: s.total })}</span>
                    <span>{t('manage.countCompleted', { count: s.done })}</span>
                    <span>{t('manage.countOpen', { count: s.leaves - s.done })}</span>
                  </div>
                  <button onClick={() => { setProjectFilter(p.id); setActiveView('gantt') }} className="mt-3 text-[11px] text-accent hover:text-fg">{t('manage.openInGantt')}</button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---- Tasks ---- */}
        <div>
          <h2 className="text-[14px] font-semibold text-fg mb-3">{t('common.tasks')}</h2>

          {/* Counts are not mutually exclusive — one task can be both in progress
              and starting this week — so they do not sum to the total. */}
          <div className="grid grid-cols-6 gap-3 mb-4">
            <Stat label={t('status.inProgress')} value={String(counts.inProgress)} sub={t('manage.sub.active')} />
            <Stat label={t('status.completed')} value={String(counts.completed)} sub={t('manage.sub.done')} />
            <Stat label={t('status.paused')} value={String(counts.paused)} sub={t('manage.sub.paused')} />
            <Stat label={t('manage.comingSoon')} value={String(counts.comingSoon)} sub={t('manage.sub.startsIn7')} />
            <Stat
              label={t('status.delayed')}
              value={String(counts.delayed)}
              sub={counts.dueSoon > 0 ? t('manage.sub.pastDueDueSoon', { count: counts.dueSoon }) : t('manage.sub.pastDue')}
              danger={counts.delayed > 0}
            />
            <Stat label={t('status.todo')} value={String(counts.todo)} sub={t('manage.sub.unscheduled')} />
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] text-muted">
              {t('manage.filteredCount', { filtered: filtered.length, count: tasks.length })}
            </div>
            <select className="h-8 px-2 bg-panel2 border border-border rounded-[3px] text-[12px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}>
              <option value="all">{t('manage.allStatuses')}</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{t(STATUS_META[s].labelKey)}</option>)}
            </select>
          </div>

          <div className="bg-panel border border-border rounded-[3px] overflow-hidden">
            <div className="grid grid-cols-[70px_1fr_120px_120px_90px_90px_130px_100px] px-3 h-9 items-center text-[10px] uppercase tracking-wider text-dim border-b border-border bg-panel2">
              <span>{t('common.wbs')}</span><span>{t('common.task')}</span><span>{t('common.project')}</span><span>{t('common.start')}</span><span>{t('common.end')}</span><span>{t('common.progress')}</span><span>{t('common.status')}</span><span>{t('common.priority')}</span>
            </div>
            {filtered.map((task) => {
              const meta = STATUS_META[eff.get(task.id)?.status ?? 'not-started']
              const prio = priorityMeta(task.priority)
              return (
                <button key={task.id} onClick={() => setSelected(task.id)} className="grid grid-cols-[70px_1fr_120px_120px_90px_90px_130px_100px] px-3 h-9 items-center text-[12px] border-b border-line last:border-0 hover:bg-panel2 text-left w-full">
                  <span className="font-mono text-[11px] text-dim">{wbs.get(task.id) ?? ''}</span>
                  <span className="truncate text-fg/90">{task.name}</span>
                  <span className="text-muted truncate">{projectName(task.projectId)}</span>
                  <span className="font-mono text-[11px] text-muted">{task.startDate ? formatShortDate(lang, toDate(task.startDate)) : t('common.none')}</span>
                  <span className="font-mono text-[11px] text-muted">{task.endDate ? formatShortDate(lang, toDate(task.endDate)) : t('common.tbd')}</span>
                  <span className="font-mono text-[11px] text-fg">{eff.get(task.id)?.progress != null ? `${eff.get(task.id)?.progress}%` : t('common.none')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-[2px]" style={{ background: sig(meta.token) }} /><span style={{ color: sigText(meta.token) }}>{t(meta.labelKey)}</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: sig(prio.token) }} /><span className="text-muted">{t(prio.labelKey)}</span></span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {dialogs}
    </div>
  )
}

function Stat({ label, value, sub, danger }: { label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <div className="bg-panel border border-border rounded-[3px] px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`text-[22px] font-semibold font-mono mt-1 ${danger ? 'text-delayed' : 'text-fg'}`}>{value}</div>
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
  const t = useT()
  return <div className="text-[12px] text-dim py-2">{t('manage.empty')}</div>
}

function TaskRow({ task, status, project, onClick, overdue }: { task: Task; status: TaskStatus; project?: Project; onClick: () => void; overdue?: boolean }) {
  const t = useT()
  const meta = STATUS_META[status]
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[3px] hover:bg-panel2 text-left">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sig(meta.token) }} />
      <span className={`flex-1 truncate text-[12px] ${overdue ? 'text-delayed' : 'text-fg/90'}`}>{task.name}</span>
      {/* A dot rather than coloured text: a project's colour is picked for
          identity, not contrast, and several of the choices (`#fbbf24`,
          `#4ade80`) are unreadable as 10px text on the light palette. */}
      {project && (
        <span className="flex items-center gap-1 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: project.color }} />
          <span className="text-[10px] text-muted truncate max-w-[90px]">{project.name}</span>
        </span>
      )}
    </button>
  )
}

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Habit, Project, Task, TaskStatus } from '../types'
import { addDays, toDate, toISO, todayISO } from '../lib/dates'
import { STATUS_META, STATUS_ORDER, priorityMeta, priorityWash, sig, sigText, toggleIn } from '../lib/ui'
import { formatShortDate, weekdayLabels } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { archivedRoots, collectDescendants, compareSiblings, computeWbs, effectiveStates, isArchived, liveTasks } from '../lib/tree'
import { ALL_DAYS, RoutineRow, routineRows } from '../lib/habits'
import { useDialogs } from '../components/dialogs'
import { HabitDialog } from '../components/HabitDialog'
import { Stat } from '../components/ui'
import { CompletionHeatmap, YEAR_WEEKS } from '../components/CompletionHeatmap'

/**
 * What the routine dialog is open on: an existing routine, or a new one and
 * where it hangs.
 *
 * One piece of state rather than a boolean plus a nullable habit, and the
 * "creating" case carries the parent rather than being a bare flag: a row's "+"
 * is the same request as the section's button with one thing already answered,
 * and two pieces of state would allow a fourth combination that means neither.
 */
type HabitEditing = { mode: 'edit'; habit: Habit } | { mode: 'new'; parentId: string | null }

// Dashboard, Tasks, Projects and Statistics used to be four separate pages that
// each re-derived the same numbers. They are one page now: overview, heatmap,
// daily list, projects, tasks. Every figure appears exactly once.
export function ManagePage() {
  const t = useT()
  const lang = useLang()
  const { ask, element: dialogs } = useDialogs()
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const logs = useStore((s) => s.logs)
  const habits = useStore((s) => s.habits)
  const deleteHabit = useStore((s) => s.deleteHabit)
  const todayStamp = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const unarchiveTasks = useStore((s) => s.unarchiveTasks)
  const setActiveView = useStore((s) => s.setActiveView)
  const setProjectFilter = useStore((s) => s.setProjectFilter)
  const updateProject = useStore((s) => s.updateProject)
  const deleteProject = useStore((s) => s.deleteProject)

  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [habitEditing, setHabitEditing] = useState<HabitEditing | null>(null)
  // Folded routines, as everywhere else that draws their tree: a branch nobody
  // has touched is open, because the roster is a list of what there is.
  const [foldedHabits, setFoldedHabits] = useState<Set<string>>(() => new Set())
  const roster = useMemo(() => routineRows(habits, null, foldedHabits), [habits, foldedHabits])

  const today = todayISO()
  const weekISO = toISO(addDays(new Date(), 7))

  const eff = useMemo(() => effectiveStates(tasks, logs), [tasks, logs, todayStamp])
  // Filed-away work is out of everything on this page that answers "what does
  // the board look like now": the counts, the table, the numbering. The roll-ups
  // are not — `eff` above is taken over every task, so filing a finished branch
  // away cannot move a parent's progress or a project's percentage. Archiving
  // changes what is listed, never what is computed; the same split `buildRows`
  // and `daySummary` make.
  const live = useMemo(() => liveTasks(tasks), [tasks])
  // Every count on this page is over leaf tasks, matching what the Gantt shows
  // as work.
  const leaves = useMemo(() => live.filter((task) => !live.some((x) => x.parentId === task.id)), [live])
  // The first level of each project — the branches a project is divided into.
  // Deliberately not "tasks that have children": a first-level task with no
  // children of its own *is* the whole branch, and counting it out would make
  // this figure disagree with the WBS the Gantt prints beside it.
  const parents = useMemo(() => live.filter((task) => task.parentId === null), [live])
  // The branches filed away: one entry per branch, which is what the drawer's
  // rows and the unarchive button both act on.
  const archived = useMemo(() => archivedRoots(tasks), [tasks])

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

  const wbs = useMemo(() => computeWbs(live), [live])
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? ''

  // The Gantt's own sibling order, from the Gantt's own function: to-dos last,
  // then whatever order the user dragged them into, then the date-and-name sort.
  // This list used to carry a near-copy of that comparator, and a near-copy is
  // what it was — it had dropped the `id` tiebreak, and it grouped projects by
  // the letters of their ids rather than by the order they are listed in. Either
  // one on its own is invisible until two tasks happen to tie; together with the
  // project lines now drawn in the Gantt, they read as two pages disagreeing.
  const projectRank = new Map(projects.map((p, i) => [p.id, i]))
  const filtered = live
    .filter((task) => statusFilter === 'all' || eff.get(task.id)?.status === statusFilter)
    .sort(
      (a, b) =>
        (projectRank.get(a.projectId) ?? 999) - (projectRank.get(b.projectId) ?? 999) ||
        compareSiblings(a, b),
    )

  // The project card's numbers. Counts come from the live tasks; the percentage
  // is taken over every leaf the project has, archived ones included, because it
  // is a rate and not a tally — the day a finished branch is filed away is not
  // the day a project gets less done.
  const statsFor = (pid: string) => {
    const ptasks = tasks.filter((task) => task.projectId === pid)
    const leavesOf = (list: Task[]) => list.filter((task) => !tasks.some((x) => x.parentId === task.id))
    const pleaves = leavesOf(ptasks)
    const plive = leavesOf(live.filter((task) => task.projectId === pid))
    const peff = effectiveStates(ptasks, logs)
    const ps = pleaves.map((task) => peff.get(task.id)?.progress).filter((p): p is number => p != null)
    const pct = ps.length ? Math.round(ps.reduce((s, x) => s + x, 0) / ps.length) : 0
    const done = plive.filter((task) => peff.get(task.id)?.status === 'completed').length
    return { total: ptasks.filter((task) => !isArchived(task)).length, leaves: plive.length, pct, done }
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
            {/* The subtasks are the headline because they are the work; the
                parent count is the shape it hangs from. It used to be the other
                way round — total first, leaves as the caption — and "total"
                meant everything, parents included, so the big number was the
                one figure nobody had a use for. */}
            <Stat label={t('manage.subtasks')} value={String(leaves.length)} sub={t('manage.parentTasks', { count: parents.length })} />
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

        {/* ---- Heatmap ---- */}
        <div>
          <h2 className="text-[14px] font-semibold text-fg mb-3">{t('manage.heat')}</h2>
          <div className="bg-panel border border-border rounded-[3px] p-4">
            {/* The whole board, a year back from today — the page is wide enough
                for the year the panel has to truncate to five months. */}
            <CompletionHeatmap taskId={null} start={null} end={null} weeks={YEAR_WEEKS} />
          </div>
        </div>

        {/* ---- Daily ---- */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-fg">{t('habit.section')}</h2>
            <button
              onClick={() => setHabitEditing({ mode: 'new', parentId: null })}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] hover:brightness-110"
            >
              <Plus size={14} /> {t('habit.new')}
            </button>
          </div>
          {/* The whole list, including suspended items — this is the one place
              they are still visible, which is the point of suspending rather
              than deleting. Everywhere else a suspended habit is simply absent,
              because everywhere else is a day it does not run on.
              `day` is null, which is the roster's question rather than a day's:
              every routine, tree and all, and nothing counted as done. */}
          <div className="bg-panel border border-border rounded-[3px]">
            {roster.length === 0 ? (
              <div className="px-4 py-3 text-[12px] text-dim">{t('habit.none')}</div>
            ) : (
              roster.map((row) => (
                <HabitRow
                  key={row.habit.id}
                  row={row}
                  onEdit={() => setHabitEditing({ mode: 'edit', habit: row.habit })}
                  onAddChild={() => setHabitEditing({ mode: 'new', parentId: row.habit.id })}
                  onToggleFold={() => setFoldedHabits((f) => toggleIn(f, row.habit.id))}
                />
              ))
            )}
          </div>
        </div>

        {/* ---- Projects ---- */}
        {/* No button here that makes anything. Everything this page used to
            create, it created by a thinner means than the board does — a project
            by a bare name prompt, with no colour and nothing to say what it was
            for until you had made it and gone back in to edit it. Creating a
            project is the new button on the Gantt now, and the two forms behind
            it are the same ones this page's edit buttons open. This page reads
            the board; it does not add to it. */}
        <div>
          <h2 className="text-[14px] font-semibold text-fg mb-3">{t('sidebar.projects')}</h2>
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
              {t('manage.filteredCount', { filtered: filtered.length, count: live.length })}
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
              // The priority wash goes on the row rather than on the name's
              // cell, so it starts at the table's left edge exactly as it starts
              // at the Gantt's — see `priorityWash`.
              return (
                <button key={task.id} onClick={() => setSelected(task.id)} style={{ backgroundImage: priorityWash(task.priority) }} className="grid grid-cols-[70px_1fr_120px_120px_90px_90px_130px_100px] px-3 h-9 items-center text-[12px] border-b border-line last:border-0 hover:bg-panel2 text-left w-full">
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

        {/* ---- Filed away ---- */}
        {/* The second of the two places archived work can be found, and the one
            that exists for looking rather than for finding: the board's drawer
            is at the bottom of a column that is already busy, and this page is
            where the whole board is meant to be summed up. A branch is one row
            here, the same unit the drawer's rows are, because that is what
            "bring it back" acts on. */}
        <div>
          <h2 className="text-[14px] font-semibold text-fg mb-3">
            {t('archive.title', { count: tasks.length - live.length })}
          </h2>
          <div className="bg-panel border border-border rounded-[3px] overflow-hidden">
            {archived.length === 0 ? (
              <div className="px-4 py-3 text-[12px] text-dim">{t('archive.empty')}</div>
            ) : (
              archived.map((task) => {
                const inside = 1 + collectDescendants(tasks, task.id).length
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: projects.find((p) => p.id === task.projectId)?.color }}
                    />
                    <button onClick={() => setSelected(task.id)} className="min-w-0 flex-1 truncate text-left text-[13px] text-fg/90 hover:text-fg">
                      {task.name}
                    </button>
                    <span className="shrink-0 text-[11px] text-dim">{projectName(task.projectId)}</span>
                    {/* The size of the branch, and only when it is more than the
                        one row standing for it. */}
                    {inside > 1 && (
                      <span className="shrink-0 text-[11px] text-dim">{t('common.taskCount', { count: inside })}</span>
                    )}
                    <button
                      onClick={() => unarchiveTasks([task.id])}
                      className="shrink-0 h-7 px-2.5 text-[11px] font-medium text-accent hover:bg-accent/10 border border-border rounded-[3px]"
                    >
                      {t('task.unarchive')}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      {habitEditing && (
        <HabitDialog
          habit={habitEditing.mode === 'edit' ? habitEditing.habit : undefined}
          defaultParentId={habitEditing.mode === 'new' ? habitEditing.parentId : undefined}
          onClose={() => setHabitEditing(null)}
          // Closing first, then asking, so the two modals never stack — the
          // question has to be put by something that outlives the dialog it was
          // asked from, which is why it is held here and not inside it.
          onDelete={
            habitEditing.mode === 'new'
              ? undefined
              : () => {
                  const h = habitEditing.habit
                  setHabitEditing(null)
                  ask(t('habit.deleteAsk', { name: h.title }), () => deleteHabit(h.id))
                }
          }
        />
      )}
      {dialogs}
    </div>
  )
}

/**
 * One routine in the Manage page's list: what it is, when it runs, and a way in.
 *
 * No delete button of its own. Deleting lives in the editor, which the pencil
 * opens — one destructive path with one confirmation, rather than a second one
 * on the row that would have to be kept saying the same thing.
 *
 * The only place a suspended routine is ever listed. Everywhere else it is
 * simply absent, because everywhere else answers "what does this day hold" and
 * a suspended routine holds none of them.
 *
 * A routine that holds others shows no end date and no suspension badge,
 * because neither is read once it has children — printing them would be stating
 * something the app does not act on. It does show days: `row.weekdays` is the
 * union of everything under it, which is what a heading's days are, and it
 * keeps the note, which is a remark about the routine rather than its schedule.
 */
function HabitRow({
  row,
  onEdit,
  onAddChild,
  onToggleFold,
}: {
  row: RoutineRow
  onEdit: () => void
  /** Another routine under this one — the row's own "+", as on a task row. */
  onAddChild: () => void
  onToggleFold: () => void
}) {
  const t = useT()
  const lang = useLang()
  const labels = weekdayLabels(lang)
  const { habit, depth, hasKids, open, weekdays } = row
  const everyDay = weekdays.length === ALL_DAYS.length

  return (
    <div
      className="flex items-start gap-3 pr-4 py-2.5 border-b border-border last:border-b-0"
      style={{ paddingLeft: 16 + depth * 16 }}
    >
      {/* Holds the triangle's column on every row that has none, so a heading's
          name and a plain routine's name stand at the same x. */}
      {hasKids ? (
        <button
          onClick={onToggleFold}
          aria-expanded={open}
          aria-label={open ? t('common.collapse') : t('common.expand')}
          className="shrink-0 mt-0.5 text-dim hover:text-fg"
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
      ) : (
        <span className="shrink-0 w-[13px]" />
      )}
      <div className="min-w-0 flex-1">
        <div className={`text-[13px] ${habit.paused && !hasKids ? 'text-dim' : 'text-fg'}`}>{habit.title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-dim">
          <span className="shrink-0">
            {everyDay ? t('habit.everyDay') : weekdays.map((d) => labels[d]).join(' · ')}
          </span>
          {!hasKids && habit.endDate && (
            <span className="shrink-0 font-mono">
              {t('habit.endDate')} {formatShortDate(lang, toDate(habit.endDate))}
            </span>
          )}
          {habit.note && <span className="min-w-0 truncate">{habit.note}</span>}
          {!hasKids && habit.paused && (
            <span className="shrink-0 px-1 h-4 inline-flex items-center text-[9px] font-medium rounded-[2px] bg-paused/15 text-paused border border-paused/30">
              {t('habit.paused')}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onAddChild}
        title={t('habit.addSubtask')}
        aria-label={t('habit.addSubtask')}
        className="shrink-0 mt-0.5 p-1 text-dim hover:text-fg"
      >
        <Plus size={13} />
      </button>
      <button
        onClick={onEdit}
        title={t('common.edit')}
        aria-label={t('common.edit')}
        className="shrink-0 mt-0.5 p-1 text-dim hover:text-fg"
      >
        <Pencil size={13} />
      </button>
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

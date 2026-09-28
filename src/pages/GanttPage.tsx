import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Check, FolderTree, Plus, X } from 'lucide-react'
import { useStore, useRows, useTimelineRange } from '../store/useStore'
import { Task, TaskLog, ViewMode } from '../types'
import { addDays } from '../lib/dates'
import { formatDateRange } from '../lib/i18n'
import { Dict } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { Segmented } from '../components/ui'
import { GanttChart } from '../components/gantt/GanttChart'
import { RowTask, todoCascadeIds } from '../lib/tree'
import { TodoActions } from '../components/gantt/RowLeft'
import { TaskDialog } from '../components/TaskDialog'
import { LogDialog } from '../components/LogDialog'
import { StartTodoDialog } from '../components/StartTodoDialog'
import { ContextMenu, MenuState } from '../components/gantt/ContextMenu'
import { useDialogs } from '../components/dialogs'

// Fixed left sidebar width (Sidebar.tsx renders w-[190px]). The timeline is
// sized off the window minus this, so opening the task/project detail panel
// (which shrinks the container by 320px) doesn't reflow the timeline and make
// task bars jump.
const SIDEBAR_W = 190

const VIEWS: { value: ViewMode; labelKey: keyof Dict }[] = [
  { value: 'day', labelKey: 'gantt.view.day' },
  { value: 'week', labelKey: 'gantt.view.week' },
  { value: 'month', labelKey: 'gantt.view.month' },
  { value: 'quarter', labelKey: 'gantt.view.quarter' },
  { value: 'year', labelKey: 'gantt.view.year' },
]

export function GanttPage() {
  const t = useT()
  const lang = useLang()
  const { ask, element: dialogs } = useDialogs()
  const rows = useRows()
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const goToday = useStore((s) => s.goToday)
  const projectFilter = useStore((s) => s.projectFilter)
  const setProjectFilter = useStore((s) => s.setProjectFilter)
  const projects = useStore((s) => s.projects)
  const deleteTask = useStore((s) => s.deleteTask)
  const setTaskParent = useStore((s) => s.setTaskParent)
  const tasks = useStore((s) => s.tasks)

  const [viewportW, setViewportW] = useState(() => window.innerWidth - SIDEBAR_W)

  useEffect(() => {
    const update = () => setViewportW(window.innerWidth - SIDEBAR_W)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Computed here rather than inside GanttChart: the toolbar's range label and
  // the axis itself have to agree, and this is the one place both can reach.
  const range = useTimelineRange(viewMode, Math.max(0, viewportW))

  const [dialog, setDialog] = useState<{
    mode: 'create' | 'edit'
    task?: Task
    parentId?: string | null
    projectId?: string
    isTodo?: boolean
  } | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [logDialog, setLogDialog] = useState<{ taskId: string; existing?: TaskLog | null } | null>(null)
  const [todoSel, setTodoSel] = useState<Set<string>>(new Set())
  const [startTodo, setStartTodo] = useState<string[] | null>(null)
  const [editing, setEditing] = useState(false)
  // What editing mode has picked out. Held here rather than in the chart because
  // two things read it: the rows, which paint it and drag it, and the bar above
  // them, which acts on it.
  const [sel, setSel] = useState<ReadonlySet<string>>(() => new Set())
  const lastUndo = useStore((s) => s.lastUndo)
  const undoLast = useStore((s) => s.undoLast)
  const clearUndo = useStore((s) => s.clearUndo)
  const withUndo = useStore((s) => s.withUndo)
  const setTaskTodo = useStore((s) => s.setTaskTodo)
  const pauseTask = useStore((s) => s.pauseTask)
  const resumeTask = useStore((s) => s.resumeTask)
  const logs = useStore((s) => s.logs)

  // The offer stands for as long as the step is still the thing that just
  // happened. It is one step, not a history, and it does not need to be
  // permanent to be useful: the moment it is for is the moment right after the
  // drop or the button. See `UndoStep`.
  useEffect(() => {
    if (!lastUndo) return
    const timer = setTimeout(clearUndo, 10_000)
    return () => clearTimeout(timer)
  }, [lastUndo, clearUndo])

  // Leaving editing mode drops the selection: it means nothing once the rows
  // cannot be acted on, and a highlight that outlives the mode it belongs to is
  // just a stray colour.
  useEffect(() => {
    if (!editing) setSel(new Set())
  }, [editing])

  // Escape steps back one layer at a time — out of the selection first, then out
  // of editing mode — unless it is already busy closing something on top of
  // both. A mode you can only leave by finding the button that renamed itself is
  // a mode people get stuck in; but Escape is also how the context menu and the
  // dialogs close, and one keypress cannot mean two things at the same level.
  const overlayOpen = menu !== null || dialog !== null || logDialog !== null || startTodo !== null
  const hasSelection = sel.size > 0
  useEffect(() => {
    if (!editing || overlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (hasSelection) setSel(new Set())
      else setEditing(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, overlayOpen, hasSelection])

  const openCreate = (parentId?: string | null, projectId?: string, isTodo?: boolean) =>
    setDialog({ mode: 'create', parentId, projectId, isTodo })
  const openEdit = (row: RowTask) => setDialog({ mode: 'edit', task: row.task })
  const openLog = (row: RowTask) => setLogDialog({ taskId: row.id })

  const handleContext = (e: MouseEvent<HTMLDivElement>, row: RowTask) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, row })
  }

  const handleDelete = (row: RowTask) => {
    ask(
      row.hasKids
        ? t('gantt.deleteTaskWithSubtasks', { name: row.task.name })
        : t('gantt.deleteTask', { name: row.task.name }),
      () => deleteTask(row.id),
    )
  }

  // The same confirmation the detail panel puts up for the same button, and for
  // the same reason: parking a task wipes the schedule of its whole unfinished
  // branch, and the count is what turns "set as to-do" from a label into a
  // decision.
  const handleSetTodo = (row: RowTask) => {
    const subs = todoCascadeIds(tasks, logs, row.id).length - 1
    ask(
      t(subs > 0 ? 'task.setAsTodoConfirmMany' : 'task.setAsTodoConfirm', { name: row.task.name, count: subs }),
      () => withUndo(t('gantt.undoTodo', { what: row.task.name }), () => setTaskTodo(row.id)),
    )
  }

  // --- what the selection can do -------------------------------------------
  //
  // The picked rows, read back through `rows` rather than off `sel` itself. A
  // row that has left the board — deleted a moment ago, or hidden by a project
  // change — is then neither counted nor acted on, and the count in the bar and
  // the buttons beside it are guaranteed to be talking about the same set.
  const picked = useMemo(
    () => rows.filter((r): r is RowTask => r.kind === 'task' && sel.has(r.id)),
    [rows, sel],
  )

  // Which of them each action applies to, gated exactly as the task panel gates
  // its own buttons: a to-do cannot be parked a second time, a long-term goal has
  // no end for a pause to postpone, and finished work is finished. The buttons
  // stay on the bar and go grey rather than disappearing, because a bar that
  // rearranged itself as the selection changed would move the next button under
  // the pointer.
  const parkable = picked.filter((r) => !r.task.isTodo && r.task.type !== 'long-term' && r.eff.status !== 'completed')
  const toPause = parkable.filter((r) => !r.task.paused)
  const toResume = picked.filter((r) => r.task.paused)

  // What the undo strip calls the rows a step touched: the name when it is one,
  // the count when it is several — the same pair of phrasings the drag uses for
  // the pill under the pointer.
  const whatOf = (rs: RowTask[]) =>
    rs.length === 1 ? rs[0].task.name : t('gantt.dragMany', { count: rs.length })

  // Each of these is one store write per row, inside a single event handler, so
  // React renders once and every write composes on the one before it.
  // ponytail: fine for a screenful of rows; a bulk action belongs in the store
  // if a selection ever gets big enough for N passes over the task list to show.
  const handleBulkTodo = () => {
    if (parkable.length === 0) return
    // The union of the branches, not the sum: a picked task sitting inside
    // another picked task is one task, and counting its branch twice would
    // overstate what is about to be cleared.
    const branch = new Set<string>()
    for (const r of parkable) for (const id of todoCascadeIds(tasks, logs, r.id)) branch.add(id)
    const subs = branch.size - parkable.length
    ask(
      t(subs > 0 ? 'gantt.setTodoManyWithSubtasks' : 'gantt.setTodoMany', { count: parkable.length, subs }),
      () => withUndo(t('gantt.undoTodo', { what: whatOf(parkable) }), () => {
        for (const r of parkable) setTaskTodo(r.id)
      }),
    )
  }

  const handleBulkDelete = () => {
    const ids = picked.map((r) => r.id)
    if (ids.length === 0) return
    const kids = ids.some((id) => tasks.some((tk) => tk.parentId === id))
    ask(
      t(kids ? 'gantt.deleteSelectedWithSubtasks' : 'gantt.deleteSelected', { count: ids.length }),
      () => withUndo(t('gantt.undoDelete', { what: whatOf(picked) }), () => {
        for (const id of ids) deleteTask(id)
      }),
    )
  }

  const dropFromSelection = (ids: string[]) =>
    setTodoSel((s) => {
      const n = new Set(s)
      for (const id of ids) n.delete(id)
      return n
    })

  // Selection for the to-do folders' bulk actions. Kept here rather than in the
  // store: it's transient view state, and the folders themselves are synthesized
  // per render.
  const todo: TodoActions = {
    selected: todoSel,
    toggle: (id) =>
      setTodoSel((s) => {
        const n = new Set(s)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
      }),
    setMany: (ids, on) =>
      setTodoSel((s) => {
        const n = new Set(s)
        for (const id of ids) {
          if (on) n.add(id)
          else n.delete(id)
        }
        return n
      }),
    restore: (ids) => {
      if (ids.length) setStartTodo(ids)
    },
    remove: (ids) => {
      if (ids.length === 0) return
      const kids = ids.some((id) => tasks.some((t) => t.parentId === id))
      ask(
        t(kids ? 'gantt.deleteTodosWithSubtasks' : 'gantt.deleteTodos', { count: ids.length }),
        () => {
          for (const id of ids) deleteTask(id)
          dropFromSelection(ids)
        },
      )
    },
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* The toolbar gives way to the selection's own bar while rows are picked,
          rather than a second strip appearing under it. Nothing moves — the bar
          takes the same 48px — and the actions for a selection belong at the top
          of the window, which is where the rest of the world puts them. The X or
          Escape puts the toolbar back. */}
      {editing && picked.length > 0 ? (
        <div className="shrink-0 h-12 flex items-center gap-3 px-3 border-b border-border bg-panel">
          <button
            onClick={() => setSel(new Set())}
            title={t('gantt.clearSelection')}
            aria-label={t('gantt.clearSelection')}
            className="p-1 text-dim hover:text-fg"
          >
            <X size={16} />
          </button>
          <span className="text-[12px] text-fg whitespace-nowrap">{t('gantt.selected', { count: picked.length })}</span>
          <div className="w-px h-6 bg-border" />
          <BulkButton onClick={handleBulkTodo} disabled={parkable.length === 0}>{t('task.setAsTodo')}</BulkButton>
          <BulkButton
            onClick={() => withUndo(t('gantt.undoPause', { what: whatOf(toPause) }), () => {
              for (const r of toPause) pauseTask(r.id)
            })}
            disabled={toPause.length === 0}
          >
            {t('task.pause')}
          </BulkButton>
          <BulkButton
            onClick={() => withUndo(t('gantt.undoResume', { what: whatOf(toResume) }), () => {
              for (const r of toResume) resumeTask(r.id)
            })}
            disabled={toResume.length === 0}
          >
            {t('task.resume')}
          </BulkButton>
          <div className="w-px h-6 bg-border" />
          <BulkButton onClick={handleBulkDelete} danger>{t('common.delete')}</BulkButton>
        </div>
      ) : (
      /* toolbar */
      <div className="shrink-0 h-12 flex items-center gap-3 px-3 border-b border-border bg-panel">
        <Segmented value={viewMode} onChange={setViewMode} options={VIEWS.map((v) => ({ value: v.value, label: t(v.labelKey) }))} />
        <div className="w-px h-6 bg-border" />
        <button onClick={goToday} className="px-2.5 h-7 text-[11px] font-medium text-muted hover:text-fg border border-border rounded-[3px] hover:bg-panel2">{t('gantt.backToToday')}</button>
        <div className="font-mono text-[13px] text-fg whitespace-nowrap">{formatDateRange(lang, range.start, addDays(range.end, -1))}</div>
        <div className="flex-1" />
        <select
          className="h-7 px-2 bg-panel2 border border-border rounded-[3px] text-[12px] text-fg focus:outline-none"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">{t('sidebar.allProjects')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {/* The toolbar sits in whatever the filter put on screen, so a task made
            here belongs to the project being looked at. "All projects" has no
            such context and leaves the choice to the dialog. */}
        <button onClick={() => openCreate(null, projectFilter === 'all' ? undefined : projectFilter)} className="h-7 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] hover:brightness-110">
          <Plus size={14} /> {t('gantt.newTask')}
        </button>
        <div className="w-px h-6 bg-border" />
        {/* One button for both directions, because it is one mode. The label and
            the icon say which way it will go, so a button that only ever said
            "organize" would be a button you cannot use to stop organizing. */}
        <button
          onClick={() => setEditing((on) => !on)}
          aria-pressed={editing}
          className={`h-7 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium rounded-[3px] border ${
            editing
              ? 'bg-accent text-on-accent border-accent'
              : 'text-muted hover:text-fg border-border hover:bg-panel2'
          }`}
        >
          {editing ? <Check size={14} /> : <FolderTree size={14} />}
          {editing ? t('gantt.editDone') : t('gantt.manageTasks')}
        </button>
        {/* The only sign that the board is in a mode at all, and it says one
            thing. Everything else about the mode is the rows' cursors and what
            dragging one does. */}
        {editing && <span className="text-[11px] text-accent">{t('gantt.editMode')}</span>}
      </div>
      )}

      <GanttChart
        rows={rows}
        range={range}
        todo={todo}
        editing={editing}
        sel={sel}
        onSel={setSel}
        onContext={handleContext}
        onAddChild={(r) => openCreate(r.id)}
        onEdit={openEdit}
      />

      {menu && (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onAddChild={(r) => openCreate(r.id)}
          onAddSibling={(r) => openCreate(r.task.parentId, r.task.projectId, r.task.isTodo)}
          onEdit={(r) => openEdit(r)}
          onWriteLog={openLog}
          onOutdent={(r) => setTaskParent(r.id, null)}
          onDelete={handleDelete}
          onSetTodo={handleSetTodo}
          onPause={(r) => withUndo(t('gantt.undoPause', { what: r.task.name }), () => pauseTask(r.id))}
          onResume={(r) => withUndo(t('gantt.undoResume', { what: r.task.name }), () => resumeTask(r.id))}
        />
      )}

      {dialog && (
        <TaskDialog
          onClose={() => setDialog(null)}
          existing={dialog.task}
          defaultParentId={dialog.parentId}
          defaultProjectId={dialog.projectId}
          defaultIsTodo={dialog.isTodo}
        />
      )}

      {logDialog && <LogDialog taskId={logDialog.taskId} existing={logDialog.existing} onClose={() => setLogDialog(null)} />}

      {startTodo && (
        <StartTodoDialog
          taskIds={startTodo}
          onClose={() => {
            setStartTodo(null)
            // Restored tasks leave their folder, so their ticks are stale.
            dropFromSelection(startTodo)
          }}
        />
      )}

      {/* The one step back, and only while the step is still the last thing that
          happened — a drop, a bulk button, a menu item, whichever it was.

          Neither is cheap to read after the fact: a wrong drop recomputes a
          parent's dates, its progress and every WBS number below it, and a wrong
          bulk edit is a state change that leaves no trace of what it replaced.
          Undoing needs none of that working-out — the previous values are on
          record — so it is offered here rather than left to be reconstructed.

          Set below the board rather than over it: the rows just changed are the
          thing being looked at, and a strip across the bottom of the chart
          covers them. */}
      {lastUndo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 h-9 pl-3 pr-1.5 rounded-[4px] bg-panel border border-border shadow-2xl">
          <span className="text-[12px] text-fg whitespace-nowrap">{lastUndo.message}</span>
          <button
            onClick={undoLast}
            className="h-6 px-2.5 text-[12px] font-medium text-accent hover:bg-accent/10 rounded-[3px]"
          >
            {t('gantt.undo')}
          </button>
        </div>
      )}

      {dialogs}
    </div>
  )
}

/**
 * One action on the selection bar.
 *
 * Disabled rather than hidden when the selection holds nothing it applies to:
 * these four sit in a fixed row, and a bar that closed the gap where a button
 * used to be would move the next one under the pointer mid-selection.
 */
function BulkButton({ onClick, disabled, danger, children }: {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-7 px-2.5 text-[12px] font-medium border border-border rounded-[3px] disabled:opacity-35 disabled:pointer-events-none ${
        danger ? 'text-delayed hover:bg-delayed/10' : 'text-muted hover:text-fg hover:bg-panel2'
      }`}
    >
      {children}
    </button>
  )
}

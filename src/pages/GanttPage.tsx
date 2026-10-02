import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Check, FolderInput, FolderTree, History, Plus, X } from 'lucide-react'
import { UndoStep, useStore, useRows, useTimelineRange } from '../store/useStore'
import { Task, TaskLog, ViewMode } from '../types'
import { addDays } from '../lib/dates'
import { formatDateRange } from '../lib/i18n'
import { Dict } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { Modal, Segmented } from '../components/ui'
import { GanttChart } from '../components/gantt/GanttChart'
import { RowTask, archiveCascade, isArchived, movingUnits, todoCascadeIds } from '../lib/tree'
import { ArchiveActions, TodoActions } from '../components/gantt/RowLeft'
import { TaskDialog } from '../components/TaskDialog'
import { ProjectManageDialog } from '../components/ProjectManageDialog'
import { HistoryDialog } from '../components/HistoryDialog'
import { NewDialog } from '../components/NewDialog'
import { LogDialog } from '../components/LogDialog'
import { StartTodoDialog } from '../components/StartTodoDialog'
import { ContextMenu, MenuState } from '../components/gantt/ContextMenu'
import { useDialogs } from '../components/dialogs'

// Fixed left sidebar width (Sidebar.tsx renders w-[190px]). The timeline is
// sized off the window minus this, so opening the task/project detail panel
// (which shrinks the container by 320px) doesn't reflow the timeline and make
// task bars jump.
const SIDEBAR_W = 190

// How long the undo offer stands. Two things read it: the timer that drops the
// step, and the countdown on the strip — which have to be the same number, or
// the offer would sit at zero for a second or vanish while still counting.
const UNDO_SECONDS = 10

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
  // The toolbar's new button, which asks what is being made. Every other way
  // into a new task — a row's "+", the context menu — knows already and goes
  // through `openCreate` to the task form directly.
  const [newOpen, setNewOpen] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [logDialog, setLogDialog] = useState<{ taskId: string; existing?: TaskLog | null } | null>(null)
  const [startTodo, setStartTodo] = useState<string[] | null>(null)
  // Shown in place of the task dialog while the board has no project — see
  // `openCreate`.
  const [noProject, setNoProject] = useState(false)
  // The project-level move, which is why it is reachable only from the edit
  // mode: it is the same kind of change to the board's structure that dragging
  // a row is, and it is kept off the toolbar the rest of the time for the same
  // reason the bulk actions are.
  const [mergeOpen, setMergeOpen] = useState(false)
  // The history tree. Its own entry point rather than a tab inside the project
  // dialog, because it is about every structural change and not only the
  // project-level ones — and it is here, beside the mode that makes those
  // changes, rather than on a page of its own.
  const [historyOpen, setHistoryOpen] = useState(false)
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
  const archiveTasks = useStore((s) => s.archiveTasks)
  const unarchiveTasks = useStore((s) => s.unarchiveTasks)
  const pauseTask = useStore((s) => s.pauseTask)
  const resumeTask = useStore((s) => s.resumeTask)
  const logs = useStore((s) => s.logs)

  // The offer stands for as long as the step is still the thing that just
  // happened. It is one step, not a history, and it does not need to be
  // permanent to be useful: the moment it is for is the moment right after the
  // drop or the button. See `UndoStep`, and `UndoStrip` for the countdown that
  // shows this number running out.
  useEffect(() => {
    if (!lastUndo) return
    const timer = setTimeout(clearUndo, UNDO_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [lastUndo, clearUndo])

  // Leaving editing mode drops the selection: it means nothing once the rows
  // cannot be acted on, and a highlight that outlives the mode it belongs to is
  // just a stray colour. The undo offer goes with it, for the same reason: what
  // the mode's bulk buttons just did is not a step the board outside the mode
  // knows anything about, and a strip still saying "Marked 3 tasks as to-do"
  // after "Done" is a step from a bar that is no longer there.
  useEffect(() => {
    if (!editing) {
      setSel(new Set())
      clearUndo()
    }
  }, [editing, clearUndo])

  // Escape steps back one layer at a time — out of the selection first, then out
  // of editing mode — unless it is already busy closing something on top of
  // both. A mode you can only leave by finding the button that renamed itself is
  // a mode people get stuck in; but Escape is also how the context menu and the
  // dialogs close, and one keypress cannot mean two things at the same level.
  const overlayOpen =
    menu !== null || dialog !== null || logDialog !== null || startTodo !== null || noProject ||
    mergeOpen || historyOpen || newOpen
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

  // Every way into the new-task dialog goes through here — the toolbar's button,
  // and the row menus' "add subtask" / "add sibling" — so the one guard covers
  // all of them. A board with no project has nothing to put a task in: the
  // dialog's project picker would offer an empty list, and whatever it saved
  // would belong to no project on the board.
  const openCreate = (parentId?: string | null, projectId?: string, isTodo?: boolean) => {
    if (projects.length === 0) {
      setNoProject(true)
      return
    }
    setDialog({ mode: 'create', parentId, projectId, isTodo })
  }
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
      () => withUndo(t('gantt.undoDelete', { what: row.task.name }), () => deleteTask(row.id)),
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
  // Any picked row can be filed away, whatever state it is in — so this is the
  // whole selection and not a filtered subset of it. (Rows that are already
  // filed away cannot be in here at all: they are drawn inside the drawer, and
  // the drawer's rows are not selectable.)

  // What the undo strip calls the rows a step touched: the name when it is one,
  // the count when it is several — the same pair of phrasings the drag uses for
  // the pill under the pointer.
  const whatOf = (rs: RowTask[]) =>
    rs.length === 1 ? rs[0].task.name : t('gantt.dragMany', { count: rs.length })

  // Each of these is one store write per row, inside a single event handler, so
  // React renders once and every write composes on the one before it.
  // ponytail: fine for a screenful of rows; a bulk action belongs in the store
  // if a selection ever gets big enough for N passes over the task list to show.
  /**
   * Every bulk button ends the same way, so they all take the same road out.
   *
   * A selection that survives the action it ordered is a selection that will
   * order it again: the rows are still ticked, the bar still counts them, and the
   * next press archives what was just brought back or pauses what was just
   * resumed. The ticks have done their job when the action runs.
   *
   * Inside the confirmation and not when it opens. A cancelled action did
   * nothing, and taking the selection away for it would be the button doing
   * something it was told not to — the same reason the confirmations exist.
   */
  const afterBulk = (label: string, run: () => void) =>
    withUndo(label, () => {
      run()
      setSel(new Set())
    })

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
      () => afterBulk(t('gantt.undoTodo', { what: whatOf(parkable) }), () => {
        for (const r of parkable) setTaskTodo(r.id)
      }),
    )
  }

  const handleBulkDelete = () => {
    // The **roots** of the selection, not every ticked row. Ticking a parent now
    // ticks its whole branch, so counting the ticks would make the confirmation
    // read "delete these 3 and their subtasks" about a 3 that already is the
    // subtasks. What it says and what the store takes have to be the same set,
    // and the store takes branches.
    const roots = movingUnits(tasks, projects, sel).tasks
    if (roots.length === 0) return
    const kids = roots.some((id) => tasks.some((tk) => tk.parentId === id))
    const named = picked.filter((r) => roots.includes(r.id))
    ask(
      t(kids ? 'gantt.deleteSelectedWithSubtasks' : 'gantt.deleteSelected', { count: roots.length }),
      () => afterBulk(t('gantt.undoDelete', { what: whatOf(named) }), () => {
        for (const id of roots) deleteTask(id)
      }),
    )
  }

  // Whether the branch is more than the rows picked — i.e. whether anything at
  // all is coming along with them. Asked of `archiveCascade` rather than worked
  // out here, because the cascade is what the store will actually take, and a
  // confirmation that described a different set from the one being filed away is
  // the one thing it must not do.
  const takesMore = (ids: string[]) => archiveCascade(tasks, ids).length > ids.length

  // Every archive asks first, and the confirmation is the same three sentences at
  // all three entry points: what goes, what goes with it, and where it can be
  // found again. The number it gives up is the reason — filing a row away
  // renumbers everything below it, so a press made by accident leaves a board
  // that has to be read to be put back.
  const handleArchive = (row: RowTask) => {
    ask(
      t(takesMore([row.id]) ? 'task.archiveWithSubtasks' : 'task.archiveConfirm', { name: row.task.name }),
      () => withUndo(t('gantt.undoArchive', { what: row.task.name }), () => archiveTasks([row.id])),
    )
  }

  // The way back needs no confirmation: it undoes the thing that was asked
  // about, and it is offered again by the same strip if the answer was wrong.
  const handleUnarchive = (row: RowTask) => {
    withUndo(t('gantt.undoUnarchive', { what: row.task.name }), () => unarchiveTasks([row.id]))
  }

  const handleBulkPause = () => {
    if (toPause.length === 0) return
    ask(t('gantt.pauseMany', { count: toPause.length }), () =>
      afterBulk(t('gantt.undoPause', { what: whatOf(toPause) }), () => {
        for (const r of toPause) pauseTask(r.id)
      }),
    )
  }

  const handleBulkResume = () => {
    if (toResume.length === 0) return
    ask(t('gantt.resumeMany', { count: toResume.length }), () =>
      afterBulk(t('gantt.undoResume', { what: whatOf(toResume) }), () => {
        for (const r of toResume) resumeTask(r.id)
      }),
    )
  }

  const handleBulkArchive = () => {
    const ids = picked.map((r) => r.id)
    if (ids.length === 0) return
    ask(
      t(takesMore(ids) ? 'gantt.archiveManyWithSubtasks' : 'gantt.archiveMany', { count: ids.length }),
      () => afterBulk(t('gantt.undoArchive', { what: whatOf(picked) }), () => archiveTasks(ids)),
    )
  }

  // The way back out of the archive, for the group's own button and for a row's.
  // Kept here rather than in the store for the same reason `todo` is: the rows
  // are synthesized per render, and bringing something back is one store write
  // wrapped in this page's undo strip.
  const archived: ArchiveActions = {
    restore: (ids) => {
      if (ids.length === 0) return
      const what = ids.length === 1 ? (tasks.find((t) => t.id === ids[0])?.name ?? '') : t('gantt.dragMany', { count: ids.length })
      withUndo(t('gantt.undoUnarchive', { what }), () => unarchiveTasks(ids))
    },
  }

  // The to-do folders' two actions. Kept here rather than in the store: the
  // folders themselves are synthesized per render, and both actions are the
  // page's own dialogs and confirmations.
  const todo: TodoActions = {
    restore: (ids) => {
      if (ids.length) setStartTodo(ids)
    },
    remove: (ids) => {
      if (ids.length === 0) return
      const kids = ids.some((id) => tasks.some((t) => t.parentId === id))
      ask(
        t(kids ? 'gantt.deleteTodosWithSubtasks' : 'gantt.deleteTodos', { count: ids.length }),
        () => withUndo(t('gantt.undoDelete', { what: t('gantt.dragMany', { count: ids.length }) }), () => {
          for (const id of ids) deleteTask(id)
        }),
      )
    },
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* The toolbar — always. It used to give way to the selection's own bar, on
          the grounds that nothing should move: the bar took the same 48px and the
          actions for a selection belong at the top of the window. What that cost
          was the one button the mode is left by. Pick a row and `编辑模式` — now
          reading `完成` — disappeared, so the way out of the mode went with it,
          and the only thing left was a button that renamed itself. A mode you can
          only leave by knowing about Escape is a mode people get stuck in.
          So the selection's actions are a second, shorter strip underneath, and
          everything above it stays exactly where it was. */}
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
        <button onClick={() => setNewOpen(true)} className="h-7 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] hover:brightness-110">
          <Plus size={14} /> {t('gantt.newTaskOrProject')}
        </button>
        <div className="w-px h-6 bg-border" />
        {/* One button for both directions, because it is one mode. The label and
            the icon say which way it will go, so a button that only ever said
            "edit mode" would be a button you cannot use to leave it. */}
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
          {editing ? t('gantt.editDone') : t('gantt.editMode')}
        </button>
        {/* The project-level move, and the reason the mode above is no longer
            named for the tasks: rearranging rows is not the only thing it now
            holds. It stands where the "editing" badge used to — the button to
            its left says the mode already, and says it in the accent colour, so
            a badge repeating the word was a word spent saying nothing.
            A project line carries no controls at all (see `ProjectRow`), which
            is why this is reached from the toolbar and not from the rows it
            acts on. */}
        {editing && (
          <button
            onClick={() => setMergeOpen(true)}
            className="h-7 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-fg border border-border rounded-[3px] hover:bg-panel2"
          >
            <FolderInput size={14} /> {t('project.manage')}
          </button>
        )}
        {/* Available only in the mode, like the move above it — but the history
            itself is not: a pause or an unarchive from the task panel on another
            page is a structural change too, and it lands on the tree whether or
            not this button is on screen. */}
        {editing && (
          <button
            onClick={() => setHistoryOpen(true)}
            className="h-7 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-fg border border-border rounded-[3px] hover:bg-panel2"
          >
            <History size={14} /> {t('history.title')}
          </button>
        )}
      </div>

      {/* What the selection's buttons do, under the toolbar rather than in its
          place. `完成` above is reachable with nothing picked — pressing it with
          rows ticked and nothing done simply leaves the mode, and the selection
          goes with it (the effect below does that). */}
      {editing && picked.length > 0 && (
        <div className="shrink-0 h-11 flex items-center gap-3 px-3 border-b border-border bg-panel2/40">
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
          <BulkButton onClick={handleBulkArchive}>{t('task.archive')}</BulkButton>
          <BulkButton onClick={handleBulkPause} disabled={toPause.length === 0}>{t('task.pause')}</BulkButton>
          <BulkButton onClick={handleBulkResume} disabled={toResume.length === 0}>{t('task.resume')}</BulkButton>
          <div className="w-px h-6 bg-border" />
          <BulkButton onClick={handleBulkDelete} danger>{t('common.delete')}</BulkButton>
        </div>
      )}

      <GanttChart
        rows={rows}
        range={range}
        todo={todo}
        archived={archived}
        editing={editing}
        sel={sel}
        onSel={setSel}
        onContext={handleContext}
        onAddChild={(r) => openCreate(r.id)}
        onAddSibling={(r) => openCreate(r.task.parentId, r.task.projectId, r.task.isTodo)}
        onEdit={openEdit}
        onArchive={handleArchive}
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
          onPause={(r) => ask(t('task.pauseConfirm', { name: r.task.name }), () =>
            withUndo(t('gantt.undoPause', { what: r.task.name }), () => pauseTask(r.id)))}
          onResume={(r) => ask(t('task.resumeConfirm', { name: r.task.name }), () =>
            withUndo(t('gantt.undoResume', { what: r.task.name }), () => resumeTask(r.id)))}
          onArchive={handleArchive}
          onUnarchive={handleUnarchive}
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

      {startTodo && <StartTodoDialog taskIds={startTodo} onClose={() => setStartTodo(null)} />}

      {mergeOpen && <ProjectManageDialog onClose={() => setMergeOpen(false)} />}

      {historyOpen && <HistoryDialog onClose={() => setHistoryOpen(false)} />}

      {newOpen && (
        <NewDialog
          onClose={() => setNewOpen(false)}
          defaultProjectId={projectFilter === 'all' ? undefined : projectFilter}
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
      {lastUndo && <UndoStrip undo={lastUndo} onUndo={undoLast} />}

      {noProject && <NoProjectDialog onClose={() => setNoProject(false)} />}

      {dialogs}
    </div>
  )
}

/**
 * What a board with no projects says instead of the task dialog.
 *
 * A dialog rather than a one-line notice, because this is the first thing a new
 * board can be asked and the answer is structural rather than administrative: a
 * task has to live in a project, and a project is the root of the tree. So the
 * prompt is followed by the two paragraphs that say what that means.
 *
 * It stands in for the dialog rather than warning beside it — hence the button
 * only acknowledging, with nothing to save.
 */
function NoProjectDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  return (
    <Modal title={t('common.noticeTitle')} onClose={onClose} width={520}>
      <div className="space-y-3 text-[12px] leading-relaxed text-muted">
        <p className="text-fg">{t('gantt.noProject', { manage: t('nav.manage') })}</p>
        <p>{t('gantt.noProject.p1')}</p>
        <p>{t('gantt.noProject.p2')}</p>
      </div>
      <div className="flex justify-end pt-4">
        <button
          onClick={onClose}
          autoFocus
          className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px]"
        >
          {t('common.gotIt')}
        </button>
      </div>
    </Modal>
  )
}

/**
 * The one step back, as a strip under the board: what just happened, the way
 * back, and the seconds left to take it.
 *
 * Its own component, and the countdown is the whole reason. The number changes
 * every second, and it has no business re-rendering the board ten times over an
 * offer nobody has taken yet — the tree, its rows and every derived number in
 * them. Here the tick reaches the strip and stops.
 *
 * The tick restarts when a new step arrives rather than on a timer of its own:
 * `undo` is a fresh object per step (`withUndo` builds one), so the effect below
 * re-runs on it and the seconds are read against the offer they belong to.
 *
 * Two digits, always — `09`, not `9`. The strip is centred on its own width, so
 * a number that lost a character at ten would twitch the whole thing sideways
 * once a second, and a twitch is what the eye goes to instead of the message.
 */
function UndoStrip({ undo, onUndo }: { undo: UndoStep; onUndo: () => void }) {
  const t = useT()
  const [left, setLeft] = useState(UNDO_SECONDS)
  useEffect(() => {
    setLeft(UNDO_SECONDS)
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [undo])
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 h-9 pl-3 pr-1.5 rounded-[4px] bg-panel border border-border shadow-2xl">
      <span className="text-[12px] text-fg whitespace-nowrap">{undo.message}</span>
      <button
        onClick={onUndo}
        className="h-6 px-2.5 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:bg-accent/10 rounded-[3px]"
      >
        {t('gantt.undo')}
        <span className="font-mono tabular-nums">{t('gantt.undoSeconds', { seconds: String(left).padStart(2, '0') })}</span>
      </button>
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

import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { useStore, useRows, useTimelineRange } from '../store/useStore'
import { Task, TaskLog, ViewMode } from '../types'
import { addDays } from '../lib/dates'
import { formatDateRange } from '../lib/i18n'
import { Dict } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { Segmented } from '../components/ui'
import { GanttChart } from '../components/gantt/GanttChart'
import { RowTask } from '../lib/tree'
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

  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; task?: Task; parentId?: string | null } | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [logDialog, setLogDialog] = useState<{ taskId: string; existing?: TaskLog | null } | null>(null)
  const [todoSel, setTodoSel] = useState<Set<string>>(new Set())
  const [startTodo, setStartTodo] = useState<string[] | null>(null)

  const openCreate = (parentId?: string | null) => setDialog({ mode: 'create', parentId })
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* toolbar */}
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
        <button onClick={() => openCreate(null)} className="h-7 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] hover:brightness-110">
          <Plus size={14} /> {t('gantt.newTask')}
        </button>
      </div>

      <GanttChart rows={rows} range={range} todo={todo} onContext={handleContext} onAddChild={(r) => openCreate(r.id)} onEdit={openEdit} />

      {menu && (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onAddChild={(r) => openCreate(r.id)}
          onAddSibling={(r) => openCreate(r.task.parentId)}
          onEdit={(r) => openEdit(r)}
          onWriteLog={openLog}
          onOutdent={(r) => setTaskParent(r.id, null)}
          onDelete={handleDelete}
        />
      )}

      {dialog && <TaskDialog onClose={() => setDialog(null)} existing={dialog.task} defaultParentId={dialog.parentId} />}

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

      {dialogs}
    </div>
  )
}

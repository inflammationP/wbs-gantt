import { useState } from 'react'
import type { MouseEvent } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore, useRows } from '../store/useStore'
import { Task, ViewMode } from '../types'
import { periodLabel } from '../lib/timeline'
import { Segmented } from '../components/ui'
import { GanttChart } from '../components/gantt/GanttChart'
import { Row } from '../lib/tree'
import { TaskDialog } from '../components/TaskDialog'
import { ContextMenu, MenuState } from '../components/gantt/ContextMenu'

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

export function GanttPage() {
  const rows = useRows()
  const viewMode = useStore((s) => s.viewMode)
  const setViewMode = useStore((s) => s.setViewMode)
  const anchorISO = useStore((s) => s.anchorISO)
  const goPrev = useStore((s) => s.goPrev)
  const goNext = useStore((s) => s.goNext)
  const goToday = useStore((s) => s.goToday)
  const projectFilter = useStore((s) => s.projectFilter)
  const setProjectFilter = useStore((s) => s.setProjectFilter)
  const projects = useStore((s) => s.projects)
  const deleteTask = useStore((s) => s.deleteTask)
  const setTaskParent = useStore((s) => s.setTaskParent)

  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; task?: Task; parentId?: string | null } | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  const openCreate = (parentId?: string | null) => setDialog({ mode: 'create', parentId })
  const openEdit = (row: Row) => setDialog({ mode: 'edit', task: row.task })

  const handleContext = (e: MouseEvent<HTMLDivElement>, row: Row) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, row })
  }

  const handleDelete = (row: Row) => {
    const msg = row.hasKids ? `Delete "${row.task.name}" and all its subtasks?` : `Delete "${row.task.name}"?`
    if (confirm(msg)) deleteTask(row.id)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* toolbar */}
      <div className="shrink-0 h-12 flex items-center gap-3 px-3 border-b border-border bg-panel">
        <Segmented value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS} />
        <div className="w-px h-6 bg-border" />
        <div className="flex items-center gap-1">
          <button onClick={goPrev} className="p-1.5 text-muted hover:text-fg hover:bg-panel2 rounded-[3px]" title="Previous"><ChevronLeft size={16} /></button>
          <button onClick={goToday} className="px-2.5 h-7 text-[11px] font-medium text-muted hover:text-fg border border-border rounded-[3px] hover:bg-panel2">Today</button>
          <button onClick={goNext} className="p-1.5 text-muted hover:text-fg hover:bg-panel2 rounded-[3px]" title="Next"><ChevronRight size={16} /></button>
        </div>
        <div className="font-mono text-[13px] text-fg whitespace-nowrap">{periodLabel(viewMode, anchorISO)}</div>
        <div className="flex-1" />
        <select
          className="h-7 px-2 bg-panel2 border border-border rounded-[3px] text-[12px] text-fg focus:outline-none"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={() => openCreate(null)} className="h-7 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium bg-accent text-black rounded-[3px] hover:brightness-110">
          <Plus size={14} /> New task
        </button>
      </div>

      <GanttChart rows={rows} onContext={handleContext} onAddChild={(r) => openCreate(r.id)} onEdit={openEdit} />

      {menu && (
        <ContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onAddChild={(r) => openCreate(r.id)}
          onAddSibling={(r) => openCreate(r.task.parentId)}
          onEdit={(r) => openEdit(r)}
          onOutdent={(r) => setTaskParent(r.id, null)}
          onDelete={handleDelete}
        />
      )}

      {dialog && <TaskDialog onClose={() => setDialog(null)} existing={dialog.task} defaultParentId={dialog.parentId} />}
    </div>
  )
}

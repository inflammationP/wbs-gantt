import type { MouseEvent } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Row } from '../../lib/tree'
import { PRIORITY_META, STATUS_META } from '../../lib/ui'
import { useStore } from '../../store/useStore'

export const LEFT_WIDTH = 560

const COLS = { chevron: 20, wbs: 44, progress: 48, status: 96, actions: 60 }

// Per-level indentation applied to the whole tree area (chevron + WBS + name).
const INDENT = 16

// Name font size/weight by hierarchy level: 0 = top ("1"), 1 = child ("1.1"),
// 2 = grandchild and deeper ("1.1.1"+). Differences shrink with depth.
const NAME_CLASS = [
  'text-[17px] font-bold text-fg',
  'text-[13px] font-medium text-fg',
  'text-[12px] text-fg/90',
]

interface Props {
  row: Row
  onAddChild: (row: Row) => void
  onEdit: (row: Row) => void
  onContext: (e: MouseEvent<HTMLDivElement>, row: Row) => void
}

export function RowLeft({ row, onAddChild, onEdit, onContext }: Props) {
  const setSelected = useStore((s) => s.setSelected)
  const toggleExpanded = useStore((s) => s.toggleExpanded)
  const deleteTask = useStore((s) => s.deleteTask)
  const isExpanded = useStore((s) => s.expanded[row.id] !== false)
  const selected = useStore((s) => s.selectedTaskId === row.id)

  const meta = STATUS_META[row.eff.status]
  const prio = PRIORITY_META[row.task.priority]

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation()
    const msg = row.hasKids ? `Delete "${row.task.name}" and all its subtasks?` : `Delete "${row.task.name}"?`
    if (confirm(msg)) deleteTask(row.id)
  }

  return (
    <div
      className={`h-full flex items-stretch text-[12px] group cursor-pointer ${
        selected ? 'bg-accent/10' : 'hover:bg-panel2/60'
      }`}
      onClick={() => setSelected(row.id)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContext(e, row)
      }}
    >
      {/* hierarchy indent — shifts chevron + WBS + name as a unit */}
      <div className="shrink-0" style={{ width: row.depth * INDENT }} />
      {/* chevron */}
      <div className="shrink-0 flex items-center justify-center" style={{ width: COLS.chevron }}>
        {row.hasKids ? (
          <button onClick={(e) => { e.stopPropagation(); toggleExpanded(row.id) }} className="text-dim hover:text-fg">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : null}
      </div>
      {/* WBS */}
      <div className="shrink-0 flex items-center justify-end pr-1.5 font-mono text-[11px] text-dim" style={{ width: COLS.wbs }}>
        {row.wbs}
      </div>
      {/* name */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 pr-1">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: prio.color }} title={`${prio.label} priority`} />
        <span className={`truncate ${NAME_CLASS[Math.min(row.depth, 2)]}`}>{row.task.name}</span>
      </div>
      {/* progress */}
      <div className="shrink-0 flex items-center justify-end pr-2 font-mono text-[11px] text-fg" style={{ width: COLS.progress }}>
        {row.eff.progress}%
      </div>
      {/* status */}
      <div className="shrink-0 flex items-center gap-1.5" style={{ width: COLS.status }}>
        <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: meta.color }} />
        <span className="text-[11px] truncate" style={{ color: meta.text }}>{meta.label}</span>
      </div>
      {/* hover actions */}
      <div
        className={`shrink-0 flex items-center justify-end pr-1 gap-0.5 transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ width: COLS.actions }}
      >
        <button onClick={(e) => { e.stopPropagation(); onAddChild(row) }} title="Add subtask" className="p-1 text-dim hover:text-fg"><Plus size={13} /></button>
        <button onClick={(e) => { e.stopPropagation(); onEdit(row) }} title="Edit" className="p-1 text-dim hover:text-fg"><Pencil size={13} /></button>
        <button onClick={handleDelete} title="Delete" className="p-1 text-dim hover:text-[#f85149]"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

export function LeftHeader() {
  const expandAll = useStore((s) => s.expandAll)
  const collapseAll = useStore((s) => s.collapseAll)
  return (
    <div className="h-full flex items-stretch text-[10px] uppercase tracking-wider text-dim">
      <div className="shrink-0" style={{ width: COLS.chevron }} />
      <div className="shrink-0 flex items-end justify-end pr-1.5 pb-1.5" style={{ width: COLS.wbs }}>WBS</div>
      <div className="flex-1 min-w-0 flex items-end pb-1.5 pr-1">Task</div>
      <div className="shrink-0 flex items-end justify-end pr-2 pb-1.5" style={{ width: COLS.progress }}>Prog</div>
      <div className="shrink-0 flex items-end pb-1.5" style={{ width: COLS.status }}>Status</div>
      <div className="shrink-0 flex items-end justify-center pb-1.5 gap-1" style={{ width: COLS.actions }}>
        <button onClick={expandAll} title="Expand all" className="hover:text-fg">+</button>
        <button onClick={collapseAll} title="Collapse all" className="hover:text-fg">−</button>
      </div>
    </div>
  )
}

import type { MouseEvent } from 'react'
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  FolderOpen,
  Pencil,
  Plus,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react'
import { Row, RowTask, RowTodoGroup } from '../../lib/tree'
import { STATUS_META, TODO_COLOR, hexToRgba, priorityMeta } from '../../lib/ui'
import { useStore } from '../../store/useStore'

export const LEFT_WIDTH = 560

const COLS = { chevron: 20, wbs: 44, progress: 48, status: 96, actions: 84 }

// Per-level indentation applied to the whole tree area (chevron + WBS + name).
const INDENT = 16

// Width of the glyph slot in front of every name, so the names themselves all
// start at the same x whatever marks them.
const GLYPH_W = 16

// Name font size/weight by hierarchy level: 0 = top ("1"), 1 = child ("1.1"),
// 2 = grandchild and deeper ("1.1.1"+). Differences shrink with depth.
const NAME_CLASS = [
  'text-[17px] font-bold text-fg',
  'text-[13px] font-medium text-fg',
  'text-[12px] text-fg/90',
]

// Selection state for the to-do folder's bulk actions, owned by GanttPage.
export interface TodoActions {
  selected: Set<string>
  toggle: (id: string) => void
  setMany: (ids: string[], on: boolean) => void
  restore: (ids: string[]) => void
  remove: (ids: string[]) => void
}

interface Props {
  row: Row
  todo: TodoActions
  onAddChild: (row: RowTask) => void
  onEdit: (row: RowTask) => void
  onContext: (e: MouseEvent<HTMLDivElement>, row: RowTask) => void
}

const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  fn()
}

export function RowLeft({ row, todo, onAddChild, onEdit, onContext }: Props) {
  const setSelected = useStore((s) => s.setSelected)
  const toggleExpanded = useStore((s) => s.toggleExpanded)
  const deleteTask = useStore((s) => s.deleteTask)
  // Folders are collapsed until explicitly opened, tasks are expanded until
  // explicitly closed — so "absent from the map" means the opposite for each.
  const expandedEntry = useStore((s) => s.expanded[row.id])
  const isExpanded = row.kind === 'todoGroup' ? expandedEntry === true : expandedEntry !== false
  const selected = useStore((s) => s.selectedTaskId === row.id)

  if (row.kind === 'todoGroup') {
    return (
      <TodoGroupRow
        row={row}
        todo={todo}
        isExpanded={isExpanded}
        onToggleExpanded={(id) => toggleExpanded(id, false)}
      />
    )
  }

  const isTodo = row.task.isTodo
  const prio = priorityMeta(row.task.priority)
  const meta = STATUS_META[row.eff.status]
  const checked = todo.selected.has(row.id)

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
      {/* name — to-dos get a dashed chip so unscheduled work is unmistakable */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 pr-1">
        {/* Fixed-width glyph slot: the priority dot, the to-do ring and the
            folder icon are different widths, and without this the names below
            them start at different x positions. */}
        <span className="shrink-0 flex items-center justify-center" style={{ width: GLYPH_W }}>
          {isTodo ? (
            <CircleDashed size={12} style={{ color: TODO_COLOR }} />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: prio.color }} title={`${prio.label} priority`} />
          )}
        </span>
        <span
          className={`truncate ${NAME_CLASS[Math.min(row.depth, 2)]} ${
            // Outline, not border: a border plus its padding would push the
            // to-do's text ~6px right of every other name in the column.
            isTodo ? 'rounded-[3px] outline outline-1 outline-dashed outline-offset-2' : ''
          }`}
          style={isTodo ? { outlineColor: hexToRgba(TODO_COLOR, 0.55), color: TODO_COLOR } : undefined}
        >
          {row.task.name}
        </span>
      </div>
      {/* progress */}
      <div className="shrink-0 flex items-center justify-end pr-2 font-mono text-[11px] text-fg" style={{ width: COLS.progress }}>
        {row.eff.progress != null ? `${row.eff.progress}%` : '—'}
      </div>
      {/* status */}
      <div className="shrink-0 flex items-center gap-1.5" style={{ width: COLS.status }}>
        <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: meta.color }} />
        <span className="text-[11px] truncate" style={{ color: meta.text }}>{meta.label}</span>
      </div>
      {/* actions — the to-do checkbox stays visible; the rest is hover-only */}
      <div className="shrink-0 flex items-center justify-end pr-1 gap-0.5" style={{ width: COLS.actions }}>
        {isTodo && (
          <button
            onClick={stop(() => todo.toggle(row.id))}
            title={checked ? 'Deselect' : 'Select'}
            className="p-1 shrink-0 text-dim hover:text-fg"
            style={checked ? { color: TODO_COLOR } : undefined}
          >
            {checked ? <CheckSquare size={13} /> : <Square size={13} />}
          </button>
        )}
        <div className={`flex items-center gap-0.5 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button onClick={(e) => { e.stopPropagation(); onAddChild(row) }} title="Add subtask" className="p-1 text-dim hover:text-fg"><Plus size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(row) }} title="Edit" className="p-1 text-dim hover:text-fg"><Pencil size={13} /></button>
          <button onClick={handleDelete} title="Delete" className="p-1 text-dim hover:text-[#f85149]"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )
}

// The synthesized folder holding one task's to-do children. Not a real task, so
// the row only offers group-level actions: select all, restore, delete.
function TodoGroupRow({
  row,
  todo,
  isExpanded,
  onToggleExpanded,
}: {
  row: RowTodoGroup
  todo: TodoActions
  isExpanded: boolean
  onToggleExpanded: (id: string) => void
}) {
  const { todoIds } = row
  const selected = todoIds.filter((id) => todo.selected.has(id))
  const allSelected = todoIds.length > 0 && selected.length === todoIds.length
  // With nothing ticked, the bulk buttons act on the whole folder — the folders
  // are small and this saves a click each time.
  const target = selected.length > 0 ? selected : todoIds
  const scope = selected.length > 0 ? `${selected.length} selected` : `all ${todoIds.length}`

  return (
    <div
      className="h-full flex items-stretch text-[12px] cursor-pointer bg-accent/[0.07] hover:bg-accent/[0.12]"
      onClick={() => onToggleExpanded(row.id)}
      title={isExpanded ? 'Collapse' : 'Expand'}
    >
      <div className="shrink-0" style={{ width: row.depth * INDENT }} />
      <div className="shrink-0 flex items-center justify-center" style={{ width: COLS.chevron }}>
        <span className="text-dim">{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
      </div>
      {/* WBS slot. A folder has no number of its own, so it gets dashes sized to
          the numbers beside it — one cell per character the real WBS takes. */}
      <div className="shrink-0 flex items-center justify-end pr-1.5 font-mono text-[11px] text-dim" style={{ width: COLS.wbs }}>
        {'—'.repeat(row.wbsCells)}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="shrink-0 flex items-center justify-center" style={{ width: GLYPH_W }}>
          <FolderOpen size={13} style={{ color: TODO_COLOR }} />
        </span>
        <span className="truncate text-[12px] font-medium" style={{ color: TODO_COLOR }}>
          To-dos ({todoIds.length})
        </span>
      </div>
      <div className="shrink-0" style={{ width: COLS.progress }} />
      <div className="shrink-0" style={{ width: COLS.status }} />
      <div className="shrink-0 flex items-center justify-end pr-1 gap-0.5" style={{ width: COLS.actions }}>
        <button
          onClick={stop(() => todo.setMany(todoIds, !allSelected))}
          title={allSelected ? 'Deselect all' : 'Select all'}
          className="p-1 text-dim hover:text-fg"
          style={allSelected ? { color: TODO_COLOR } : undefined}
        >
          {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
        </button>
        <button onClick={stop(() => todo.restore(target))} title={`Restore ${scope}`} className="p-1 text-dim hover:text-fg">
          <RotateCcw size={13} />
        </button>
        <button onClick={stop(() => todo.remove(target))} title={`Delete ${scope}`} className="p-1 text-dim hover:text-[#f85149]">
          <Trash2 size={13} />
        </button>
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

import type { MouseEvent } from 'react'
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDashed,
  FolderOpen,
  Pencil,
  Plus,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react'
import { Row, RowProject, RowTask, RowTodoGroup } from '../../lib/tree'
import { STATUS_META, priorityWash, sig, sigAlpha, sigText } from '../../lib/ui'
import { useStore } from '../../store/useStore'
import { useT } from '../../lib/useT'
import { useDialogs } from '../dialogs'

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
  /** Editing mode is on: rows can be dragged, and clicks build a selection. */
  editing?: boolean
  /** Whether this row is one of the rows about to be dragged. */
  picked?: boolean
  /**
   * A click on the row itself. Owned by the chart rather than by this row,
   * because what a click means depends on the mode: outside editing it opens the
   * task, and inside it adds to or replaces the set the next drag will take.
   */
  onRowClick: (e: MouseEvent<HTMLElement>, row: RowTask) => void
  onAddChild: (row: RowTask) => void
  onEdit: (row: RowTask) => void
  onContext: (e: MouseEvent<HTMLDivElement>, row: RowTask) => void
}

const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  fn()
}

export function RowLeft({ row, todo, editing, picked, onRowClick, onAddChild, onEdit, onContext }: Props) {
  const t = useT()
  const { ask, element: dialogs } = useDialogs()
  const setSelected = useStore((s) => s.setSelected)
  const toggleExpanded = useStore((s) => s.toggleExpanded)
  const deleteTask = useStore((s) => s.deleteTask)
  const withUndo = useStore((s) => s.withUndo)
  const projects = useStore((s) => s.projects)
  // Folders are collapsed until explicitly opened, tasks are expanded until
  // explicitly closed — so "absent from the map" means the opposite for each.
  const expandedEntry = useStore((s) => s.expanded[row.id])
  const isExpanded = row.kind === 'todoGroup' ? expandedEntry === true : expandedEntry !== false
  const highlighted = useStore((s) => s.selectedTaskId === row.id)

  if (row.kind === 'project') {
    return (
      <ProjectRow
        row={row}
        isExpanded={expandedEntry !== false}
        editing={editing}
        onToggleExpanded={(id) => toggleExpanded(id)}
      />
    )
  }

  if (row.kind === 'todoGroup') {
    return (
      <TodoGroupRow
        row={row}
        todo={todo}
        editing={editing}
        isExpanded={isExpanded}
        onToggleExpanded={(id) => toggleExpanded(id, false)}
      />
    )
  }

  // In edit mode there is one highlight and it means one thing: the rows the
  // next drag will take. The detail panel's own selection is suppressed while
  // editing, because letting both paint the same tint would leave a row that is
  // only open in the panel indistinguishable from a row that is about to move.
  const selected = editing ? !!picked : highlighted
  const isTodo = row.task.isTodo
  const meta = STATUS_META[row.eff.status]
  // Set only on the first to-do of an open to-do folder — see `visitGroup`.
  const group = row.todoGroup
  const checked = todo.selected.has(row.id)
  // Identity, not status: tasks from several projects share this column, and the
  // project is what the tree can't otherwise show.
  const project = projects.find((p) => p.id === row.task.projectId)

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation()
    ask(
      row.hasKids
        ? t('gantt.deleteTaskWithSubtasks', { name: row.task.name })
        : t('gantt.deleteTask', { name: row.task.name }),
      // The row's own bin can be taken back like the selection's, and for the
      // same reason: the confirm says what is going, not what the board will
      // look like once it has — and a whole subtree is a lot to work out.
      () => withUndo(t('gantt.undoDelete', { what: row.task.name }), () => deleteTask(row.id)),
    )
  }

  return (
    <>
    <div
      className={`relative h-full flex items-stretch text-[12px] group ${
        editing ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${selected ? 'bg-accent/10' : 'hover:bg-panel2/60'}`}
      // Priority as a band off the row's own left edge — the canvas's edge,
      // before the indent, the chevron and the WBS number — so the washes line
      // up down the column however deep their tasks sit. `priorityWash` holds
      // the rest of the why.
      style={{ backgroundImage: priorityWash(row.task.priority) }}
      onClick={(e) => onRowClick(e, row)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContext(e, row)
      }}
    >
      {/* The mark of an open to-do folder, pinned to that same left edge. It
          sits over the indentation rather than in front of the name, because it
          belongs to the column — and to the rows under it — rather than to any
          one row's text; absolutely placed, so nothing shifts. The dashed ring
          in the glyph slot below still says the row itself is a to-do. */}
      {group && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded(group.id, false)
          }}
          title={t('common.collapse')}
          aria-label={t('common.collapse')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-5 h-5 grid place-items-center rounded-[3px] hover:bg-todo/15"
          style={{ color: sig('todo') }}
        >
          <FolderOpen size={12} />
        </button>
      )}
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
      {/* The pick circle, and in editing mode the only way to pick a row.
          It sits in front of the name rather than at the row's own left edge, so
          it lines up with the text it ticks however deep the row sits — the same
          place a file manager puts its checkboxes. Absent outside editing mode,
          where there is nothing to pick rows for. */}
      {editing && (
        <button
          onClick={(e) => { e.stopPropagation(); onRowClick(e, row) }}
          title={selected ? t('common.deselect') : t('common.select')}
          aria-label={selected ? t('common.deselect') : t('common.select')}
          aria-pressed={selected}
          className={`shrink-0 grid place-items-center -ml-0.5 mr-1 ${selected ? 'text-accent' : 'text-dim hover:text-fg'}`}
          style={{ width: 18 }}
        >
          {selected ? <CircleCheck size={14} /> : <Circle size={14} />}
        </button>
      )}
      {/* name — to-dos get a dashed chip so unscheduled work is unmistakable */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 pr-1">
        {/* Fixed-width glyph slot: the project dot, the to-do ring and the
            folder icon are different widths, and without this the names below
            them start at different x positions. */}
        <span className="shrink-0 flex items-center justify-center" style={{ width: GLYPH_W }}>
          {isTodo ? (
            <CircleDashed size={12} style={{ color: sig('todo') }} />
          ) : (
            // The project's own colour — picked for identity, not contrast, so
            // it stays a mark and never becomes text (see ManagePage's TaskRow).
            // A dangling projectId (hand-edited import) draws nothing rather
            // than an undefined colour.
            project && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: project.color }}
                title={`${t('common.project')}: ${project.name}`}
              />
            )
          )}
        </span>
        <span
          className={`truncate ${NAME_CLASS[Math.min(row.depth, 2)]} ${
            // Outline, not border: a border plus its padding would push the
            // to-do's text ~6px right of every other name in the column.
            isTodo ? 'rounded-[3px] outline outline-1 outline-dashed outline-offset-2' : ''
          }`}
          style={isTodo ? { outlineColor: sigAlpha('todo', 0.55), color: sig('todo') } : undefined}
        >
          {row.task.name}
        </span>
      </div>
      {/* progress */}
      <div className="shrink-0 flex items-center justify-end pr-2 font-mono text-[11px] text-fg" style={{ width: COLS.progress }}>
        {row.eff.progress != null ? `${row.eff.progress}%` : t('common.none')}
      </div>
      {/* status */}
      <div className="shrink-0 flex items-center gap-1.5" style={{ width: COLS.status }}>
        <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: sig(meta.token) }} />
        <span className="text-[11px] truncate" style={{ color: sigText(meta.token) }}>{t(meta.labelKey)}</span>
      </div>
      {/* actions — the to-do checkbox stays visible; the rest is hover-only */}
      <div className="shrink-0 flex items-center justify-end pr-1 gap-0.5" style={{ width: COLS.actions }}>
        {/* Hidden while editing: a to-do row would otherwise carry two selections
            — this tick for its folder's bulk actions, the circle on the left for
            the row itself — and the two tick different sets. The folder's own
            line still holds those actions, acting on all of its to-dos. */}
        {isTodo && !editing && (
          <button
            onClick={stop(() => todo.toggle(row.id))}
            title={checked ? t('common.deselect') : t('common.select')}
            aria-label={checked ? t('common.deselect') : t('common.select')}
            className="p-1 shrink-0 text-dim hover:text-fg"
            style={checked ? { color: sig('todo') } : undefined}
          >
            {checked ? <CheckSquare size={13} /> : <Square size={13} />}
          </button>
        )}
        <div className={`flex items-center gap-0.5 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {/* No "+" on a to-do: it can't be a parent, and a dialog that opened
              on it would have to show "top level" while pointing at the to-do. */}
          {!isTodo && (
            <button onClick={(e) => { e.stopPropagation(); onAddChild(row) }} title={t('task.addSubtask')} className="p-1 text-dim hover:text-fg"><Plus size={13} /></button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(row) }} title={t('common.edit')} className="p-1 text-dim hover:text-fg"><Pencil size={13} /></button>
          <button onClick={handleDelete} title={t('common.delete')} className="p-1 text-dim hover:text-delayed"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
    {dialogs}
    </>
  )
}

// The synthesized folder holding one task's to-do children. Not a real task, so
// the row only offers group-level actions: select all, restore, delete.
function TodoGroupRow({
  row,
  todo,
  editing,
  isExpanded,
  onToggleExpanded,
}: {
  row: RowTodoGroup
  todo: TodoActions
  editing?: boolean
  isExpanded: boolean
  onToggleExpanded: (id: string) => void
}) {
  const t = useT()
  const { todoIds } = row
  const selected = todoIds.filter((id) => todo.selected.has(id))
  const allSelected = todoIds.length > 0 && selected.length === todoIds.length
  // With nothing ticked, the bulk buttons act on the whole folder — the folders
  // are small and this saves a click each time.
  const target = selected.length > 0 ? selected : todoIds
  const bySelection = selected.length > 0

  return (
    <div
      className="h-full flex items-stretch text-[12px] cursor-pointer bg-todo/[0.07] hover:bg-todo/[0.12]"
      onClick={() => onToggleExpanded(row.id)}
      title={isExpanded ? t('common.collapse') : t('common.expand')}
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
          <FolderOpen size={13} style={{ color: sig('todo') }} />
        </span>
        <span className="truncate text-[12px] font-medium" style={{ color: sig('todo') }}>
          {t('todo.folder', { count: todoIds.length })}
        </span>
      </div>
      <div className="shrink-0" style={{ width: COLS.progress }} />
      <div className="shrink-0" style={{ width: COLS.status }} />
      <div className="shrink-0 flex items-center justify-end pr-1 gap-0.5" style={{ width: COLS.actions }}>
        {/* The ticks it drives are hidden in editing mode, so leaving this one
            out on its own would be a switch with nothing to switch. The two
            buttons beside it stay, acting on the whole folder — which is what
            they already do when nothing is ticked. */}
        {!editing && (
          <button
            onClick={stop(() => todo.setMany(todoIds, !allSelected))}
            title={allSelected ? t('common.deselectAll') : t('common.selectAll')}
            aria-label={allSelected ? t('common.deselectAll') : t('common.selectAll')}
            className="p-1 text-dim hover:text-fg"
            style={allSelected ? { color: sig('todo') } : undefined}
          >
            {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
          </button>
        )}
        <button
          onClick={stop(() => todo.restore(target))}
          title={bySelection
            ? t('todo.restoreSelected', { count: selected.length })
            : t('todo.restoreAll', { count: todoIds.length })}
          className="p-1 text-dim hover:text-fg"
        >
          <RotateCcw size={13} />
        </button>
        <button
          onClick={stop(() => todo.remove(target))}
          title={bySelection
            ? t('todo.deleteSelected', { count: selected.length })
            : t('todo.deleteAll', { count: todoIds.length })}
          className="p-1 text-dim hover:text-delayed"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

/**
 * A project's line, the outermost container in the tree.
 *
 * Drawn as a band rather than as a box around its tasks, and it indents nothing:
 * the band already says where the group begins and ends, and wrapping the tasks
 * in a frame would have cost every name a size and pushed the whole tree a step
 * to the right to say the same thing twice.
 *
 * The colour is the project's own — an identity, picked to tell projects apart,
 * never one of the status signals. Those mean a status and nothing else, and the
 * rows two lines below wear them for that.
 */
function ProjectRow({
  row,
  isExpanded,
  editing,
  onToggleExpanded,
}: {
  row: RowProject
  isExpanded: boolean
  editing?: boolean
  onToggleExpanded: (id: string) => void
}) {
  const t = useT()
  const { project } = row
  return (
    <div
      className={`relative h-full flex items-stretch text-[12px] cursor-pointer group/project ${
        editing ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      // A wash of the project's colour over the row's own background, plus a
      // hairline through it: the band is meant to read as a rule between groups,
      // not as another task that happens to be wider. The wash is deliberately
      // light — it is a background under a whole row of text — but it has to be
      // strong enough to read as a band and not as a hovered row.
      style={{ background: `color-mix(in srgb, ${project.color} 18%, transparent)` }}
      onClick={() => onToggleExpanded(row.id)}
      title={isExpanded ? t('common.collapse') : t('common.expand')}
    >
      <div className="shrink-0" style={{ width: COLS.chevron }} />
      <div className="shrink-0" style={{ width: COLS.wbs }} />
      {/* The name is the one thing on this row that says which group this is, so
          it is never cut short to make room for the rule: it takes the width it
          needs and the rule gets what is left. `flex-initial` rather than
          `flex-1` — a growing name cell would split the slack with the rule and
          the rule would start halfway down a short name.
          It does still `truncate`, because a name can be longer than the whole
          column. That is the last resort, and by then the rule has given way to
          its `min-w-2` stub — the name is what must stay readable. */}
      <div className="flex-initial min-w-0 flex items-center gap-1.5 pr-2">
        <span className="shrink-0 flex items-center justify-center text-dim" style={{ width: GLYPH_W }}>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="min-w-0 truncate text-[12px] font-semibold" style={{ color: project.color }}>
          {project.name}
        </span>
      </div>
      {/* The rule that makes it a divider rather than a row: it runs from the
          name to the far end of the task column, so a short name and a long one
          both end with the band reaching the same place.
          It crosses the progress, status and actions columns, which stand empty
          on this row — they are placeholders that keep the other rows' columns
          aligned, and there is no task here to put anything in them.
          `mr-3` is the "somewhere near the right end" the band stops at: a rule
          that ran to the very edge would meet the splitter and read as a border
          of the panel rather than as a divider inside it. */}
      <span className="flex-1 self-center h-px min-w-2 mr-3" style={{ background: project.color, opacity: 0.4 }} />
    </div>
  )
}

export function LeftHeader() {
  const t = useT()
  const expandAll = useStore((s) => s.expandAll)
  const collapseAll = useStore((s) => s.collapseAll)
  return (
    <div className="h-full flex items-stretch text-[10px] uppercase tracking-wider text-dim">
      <div className="shrink-0" style={{ width: COLS.chevron }} />
      <div className="shrink-0 flex items-end justify-end pr-1.5 pb-1.5" style={{ width: COLS.wbs }}>{t('common.wbs')}</div>
      <div className="flex-1 min-w-0 flex items-end pb-1.5 pr-1">{t('common.task')}</div>
      <div className="shrink-0 flex items-end justify-end pr-2 pb-1.5" style={{ width: COLS.progress }}>{t('common.prog')}</div>
      <div className="shrink-0 flex items-end pb-1.5" style={{ width: COLS.status }}>{t('common.status')}</div>
      <div className="shrink-0 flex items-end justify-center pb-1.5 gap-1" style={{ width: COLS.actions }}>
        <button onClick={expandAll} title={t('sidebar.expandAll')} className="hover:text-fg">+</button>
        <button onClick={collapseAll} title={t('sidebar.collapseAll')} className="hover:text-fg">−</button>
      </div>
    </div>
  )
}

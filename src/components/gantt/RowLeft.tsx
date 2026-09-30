import { useState } from 'react'
import type { MouseEvent } from 'react'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDashed,
  FolderOpen,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Row, RowArchiveGroup, RowProject, RowTask, RowTodoGroup, isArchived } from '../../lib/tree'
import { STATUS_META, priorityWash, sig, sigAlpha, sigText } from '../../lib/ui'
import { useStore } from '../../store/useStore'
import { useT } from '../../lib/useT'
import { useDialogs } from '../dialogs'

export const LEFT_WIDTH = 560

// `actions` holds up to four icons on a row on the board (`+`, pencil, archive,
// bin) and two on a filed-away one, and it is sized for the four: the cell does
// not wrap, so one icon over the edge would sit on top of the status column.
const COLS = { chevron: 20, wbs: 44, progress: 48, status: 96, actions: 108 }

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

// The to-do folder's own two actions, owned by GanttPage. There is no selection
// to pass: a folder is a handful of rows and both act on all of them.
export interface TodoActions {
  restore: (ids: string[]) => void
  remove: (ids: string[]) => void
}

// What a filed-away row and the group that holds them can do, owned by
// GanttPage — the same arrangement as `TodoActions`, and separate from it
// because the two confirm in different words and act on different sets.
//
// One action and not two: a to-do folder offers restore *and* a bin over the
// whole folder, and the archive deliberately offers only the way back. A single
// press that wipes everything ever filed away is not something to put beside the
// chevron — that count is the only thing on the board saying the work happened.
// Deleting one of them is still there, on the row, with the usual confirmation.
export interface ArchiveActions {
  restore: (ids: string[]) => void
}

interface Props {
  row: Row
  todo: TodoActions
  archived: ArchiveActions
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
  onAddSibling: (row: RowTask) => void
  onEdit: (row: RowTask) => void
  onArchive: (row: RowTask) => void
  /**
   * Open or close a row's own disclosure. Owned by the chart, not by the row:
   * what is under a row it just opened can land below the fold — the archive
   * drawer always does — and only the chart knows the box that scrolls. See
   * `toggleRow`.
   */
  onToggleRow: (id: string, defaultOpen: boolean) => void
  onContext: (e: MouseEvent<HTMLDivElement>, row: RowTask) => void
}

const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  fn()
}

export function RowLeft({ row, todo, archived, editing, picked, onRowClick, onAddChild, onAddSibling, onEdit, onArchive, onToggleRow, onContext }: Props) {
  const t = useT()
  const { ask, element: dialogs } = useDialogs()
  const setSelected = useStore((s) => s.setSelected)
  const deleteTask = useStore((s) => s.deleteTask)
  const withUndo = useStore((s) => s.withUndo)
  const projects = useStore((s) => s.projects)
  // Folders are collapsed until explicitly opened, tasks are expanded until
  // explicitly closed — so "absent from the map" means the opposite for each.
  // The archive group is a folder in this respect and not in any other.
  const expandedEntry = useStore((s) => s.expanded[row.id])
  const folds = row.kind === 'todoGroup' || row.kind === 'archiveGroup'
  const isExpanded = folds ? expandedEntry === true : expandedEntry !== false
  const highlighted = useStore((s) => s.selectedTaskId === row.id)

  if (row.kind === 'project') {
    return (
      <ProjectRow
        row={row}
        isExpanded={expandedEntry !== false}
        editing={editing}
        onToggleExpanded={(id) => onToggleRow(id, true)}
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
        onToggleExpanded={(id) => onToggleRow(id, false)}
      />
    )
  }

  if (row.kind === 'archiveGroup') {
    return (
      <ArchiveGroupRow
        row={row}
        archived={archived}
        isExpanded={isExpanded}
        onToggleExpanded={(id) => onToggleRow(id, false)}
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
  // Identity, not status: tasks from several projects share this column, and the
  // project is what the tree can't otherwise show.
  const project = projects.find((p) => p.id === row.task.projectId)
  // Filed away: off the board and read-only. The only two things such a row
  // keeps are the way back and the bin.
  const filed = isArchived(row.task)

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
        // Nothing filed away is draggable: it is not on the board to be moved,
        // and the cursor is the one thing that says so before the attempt.
        editing && !filed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
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
            onToggleRow(group.id, false)
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
          <button onClick={(e) => { e.stopPropagation(); onToggleRow(row.id, true) }} className="text-dim hover:text-fg">
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
      {editing && !filed && (
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
          } ${filed ? 'text-dim' : ''}`}
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
      {/* actions — hover-only. A row on the board offers three, a filed-away one
          offers two: the things it could be asked to do have all been said, and
          changing one means bringing it back first. */}
      <div className="shrink-0 flex items-center justify-end pr-1 gap-0.5" style={{ width: COLS.actions }}>
        <div className={`flex items-center gap-0.5 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {/* The "+" means "another task at this place", and a to-do's place
              is beside it rather than under it: it can't be a parent, so
              `onAddChild` would open a dialog showing "top level" while
              pointing at the to-do. So the same button adds a *sibling* there,
              which is the one "+" a to-do row has — and exactly what the
              context menu does with its own pair on the same row. The new task
              is a to-do for the same reason: a to-do's sibling is another one.
              A filed-away row has none: a new task inside a branch that is off
              the board would be a row nothing draws. */}
          {!filed && (
            <button
              onClick={(e) => { e.stopPropagation(); (isTodo ? onAddSibling : onAddChild)(row) }}
              title={isTodo ? t('task.addSibling') : t('task.addSubtask')}
              aria-label={isTodo ? t('task.addSibling') : t('task.addSubtask')}
              className="p-1 text-dim hover:text-fg"
            >
              <Plus size={13} />
            </button>
          )}
          {!filed && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(row) }} title={t('common.edit')} className="p-1 text-dim hover:text-fg"><Pencil size={13} /></button>
          )}
          {/* On every row that is on the board — any status can be filed away,
              not only finished work. The row is where the offer belongs: the
              menu has it too, but a menu is one click further from the row it
              acts on, and there is no longer a subset of rows to single out
              with a mark beside the name. */}
          {!filed && (
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(row) }}
              title={t('task.archive')}
              aria-label={t('task.archive')}
              className="p-1 text-dim hover:text-fg"
            >
              <Archive size={13} />
            </button>
          )}
          {filed && (
            <button
              onClick={(e) => { e.stopPropagation(); archived.restore([row.id]) }}
              title={t('task.unarchive')}
              aria-label={t('task.unarchive')}
              className="p-1 text-dim hover:text-fg"
            >
              <RotateCcw size={13} />
            </button>
          )}
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
  const name = useStore((s) => s.todoFolders[row.id] ?? '')
  const setTodoFolderName = useStore((s) => s.setTodoFolderName)
  const [editingName, setEditingName] = useState(false)
  const { todoIds } = row
  // The row's own click folds it; a click in the name box is not that.
  const commit = (value: string) => {
    setTodoFolderName(row.id, value)
    setEditingName(false)
  }

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
        {/* Named by the user, or counted. A folder is a run of to-do rows and
            nothing else — there is no record of it to hold a name — so what it
            is called lives beside the tasks, keyed by the folder's own id; see
            `todoFolders` in storage.ts. Unnamed folders read exactly as they
            always did, and a named one keeps the count as a quiet suffix
            because how much is folded away is the thing the line is for. */}
        {editingName ? (
          <input
            autoFocus
            defaultValue={name}
            placeholder={t('todo.folderPlaceholder')}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              // Escape puts back what was there. Blurring is what commits, so
              // the value has to be restored before the blur arrives.
              if (e.key === 'Escape') {
                e.currentTarget.value = name
                e.currentTarget.blur()
              }
              e.stopPropagation()
            }}
            className="min-w-0 flex-1 h-5 px-1 bg-panel border border-accent rounded-[2px] text-[12px] text-fg outline-none"
          />
        ) : (
          <>
            <span className="truncate text-[12px] font-medium" style={{ color: sig('todo') }}>
              {name || t('todo.folder', { count: todoIds.length })}
            </span>
            {name && <span className="shrink-0 text-[11px] text-dim">{todoIds.length}</span>}
          </>
        )}
      </div>
      <div className="shrink-0" style={{ width: COLS.progress }} />
      <div className="shrink-0" style={{ width: COLS.status }} />
      <div className="shrink-0 flex items-center justify-end pr-1 gap-0.5" style={{ width: COLS.actions }}>
        {!editing && (
          <button
            onClick={stop(() => setEditingName(true))}
            title={t('todo.renameFolder')}
            aria-label={t('todo.renameFolder')}
            className="p-1 text-dim hover:text-fg"
          >
            <Pencil size={13} />
          </button>
        )}
        <button
          onClick={stop(() => todo.restore(todoIds))}
          title={t('todo.restoreAll', { count: todoIds.length })}
          className="p-1 text-dim hover:text-fg"
        >
          <RotateCcw size={13} />
        </button>
        <button
          onClick={stop(() => todo.remove(todoIds))}
          title={t('todo.deleteAll', { count: todoIds.length })}
          className="p-1 text-dim hover:text-delayed"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

/**
 * The drawer at the bottom of the left column: everything filed away.
 *
 * Drawn as a to-do folder is — the same chevron, the same collapsed-by-default
 * habit, the same count — because it is the same kind of thing: a synthesized
 * line standing for rows that are not where they used to be. What it differs in
 * is what it offers. A to-do folder restores work and deletes it; this one only
 * gives things back, plus a bin per row. Wiping a whole archive in one press is
 * not something to put a button next to the chevron for — the count it would
 * take with it is the only thing on the board that says that work happened.
 *
 * Drawn in the accent, which is the one colour in this app that means "there is
 * something you can do here" — and there is: this line is the way into
 * everything filed away. Not a signal: the rows inside wear the completed ramp
 * for what they are, and a filed-away task is not a status. Not a project colour
 * either — those are identities.
 *
 * And it is drawn a size *up* from the rows it holds (a top-level height, as the
 * header of the little tree inside it) for the same reason it is not dim: this
 * line sits at the bottom of a column the eye has already stopped reading, and
 * a drawer nobody notices is a drawer nothing is ever brought back out of.
 */
function ArchiveGroupRow({
  row,
  archived,
  isExpanded,
  onToggleExpanded,
}: {
  row: RowArchiveGroup
  archived: ArchiveActions
  isExpanded: boolean
  onToggleExpanded: (id: string) => void
}) {
  const t = useT()
  return (
    <div
      className="h-full flex items-stretch text-[12px] cursor-pointer bg-accent/[0.08] hover:bg-accent/[0.16]"
      onClick={() => onToggleExpanded(row.id)}
      title={isExpanded ? t('common.collapse') : t('common.expand')}
    >
      <div className="shrink-0 flex items-center justify-center" style={{ width: COLS.chevron }}>
        <span className="text-accent">{isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
      </div>
      {/* No dashes in the WBS slot, unlike a to-do folder: that placeholder is
          sized to the numbers it stands in for, and a filed-away task has no
          number at all — see `visitArchived`. */}
      <div className="shrink-0" style={{ width: COLS.wbs }} />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="shrink-0 flex items-center justify-center text-accent" style={{ width: GLYPH_W }}>
          <Archive size={15} />
        </span>
        <span className="truncate text-[13px] font-semibold text-accent">{t('archive.title', { count: row.count })}</span>
      </div>
      <div className="shrink-0" style={{ width: COLS.progress }} />
      <div className="shrink-0" style={{ width: COLS.status }} />
      <div className="shrink-0 flex items-center justify-end pr-1 gap-0.5" style={{ width: COLS.actions }}>
        <button
          onClick={stop(() => archived.restore(row.taskIds))}
          title={t('archive.restoreAll', { count: row.count })}
          aria-label={t('archive.restoreAll', { count: row.count })}
          className="p-1 text-accent hover:text-fg"
        >
          <RotateCcw size={14} />
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

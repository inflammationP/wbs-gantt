import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Archive, CircleDashed, CornerUpLeft, NotebookText, Pause, Pencil, Play, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { RowTask, isArchived } from '../../lib/tree'
import { useT } from '../../lib/useT'
import { useDismiss } from '../../lib/useDismiss'

export interface MenuState {
  x: number
  y: number
  row: RowTask
}

interface Props {
  menu: MenuState
  onClose: () => void
  onAddChild: (row: RowTask) => void
  onAddSibling: (row: RowTask) => void
  onEdit: (row: RowTask) => void
  onWriteLog: (row: RowTask) => void
  onOutdent: (row: RowTask) => void
  onDelete: (row: RowTask) => void
  onSetTodo: (row: RowTask) => void
  onPause: (row: RowTask) => void
  onResume: (row: RowTask) => void
  onArchive: (row: RowTask) => void
  onUnarchive: (row: RowTask) => void
}

function Item({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 h-7 text-[12px] text-left ${
        danger ? 'text-delayed hover:bg-delayed/10' : 'text-fg/90 hover:bg-panel2'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

/**
 * The two places a new task can go, for the "+" on a row's own toolbar.
 *
 * The same two items the context menu carries, in the same order and the same
 * words, because it is the same question — the row's "+" used to answer it
 * without asking, and it answered "under this one" every time. A "+" on a row
 * says *something goes here*; "here" has two readings, they are different
 * dialogs, and the one that is chosen by default is the one that is wrong for
 * every reader who meant the other. So it asks.
 *
 * Drawn like the context menu, one row of icons deep, because it is one: same
 * panel, same shadow, same width, and the same two labels in the same order. Two
 * menus that open from the same table should not look like two different things.
 *
 * The press on the "+" itself is left to the "+" — see `useDismiss` — so the
 * button puts the menu away as readily as it brings it up.
 */
export function AddMenu({ row, at, onClose, onAddChild, onAddSibling }: {
  row: RowTask
  /** The trigger's bottom-left corner, in viewport coordinates. */
  at: { x: number; y: number }
  onClose: () => void
  onAddChild: (row: RowTask) => void
  onAddSibling: (row: RowTask) => void
}) {
  const t = useT()
  useDismiss('[data-add-menu], [data-add-toggle]', onClose)

  // The context menu's own width and clamping: the two are the same panel with
  // different lengths, and a menu that ran off the window would be one the
  // reader has to scroll the board to read.
  const w = 190
  const left = Math.min(at.x, window.innerWidth - w - 8)
  const top = Math.min(at.y + 2, window.innerHeight - 72)

  return createPortal(
    <div
      data-add-menu
      className="fixed z-[70] bg-panel border border-border rounded-[3px] shadow-2xl py-1"
      style={{ left, top, width: w }}
    >
      <Item icon={<Plus size={13} />} label={t('task.addSubtask')} onClick={() => { onAddChild(row); onClose() }} />
      <Item icon={<Plus size={13} />} label={t('task.addSibling')} onClick={() => { onAddSibling(row); onClose() }} />
    </div>,
    document.body,
  )
}

export function ContextMenu({ menu, onClose, onAddChild, onAddSibling, onEdit, onWriteLog, onOutdent, onDelete, onSetTodo, onPause, onResume, onArchive, onUnarchive }: Props) {
  const t = useT()
  // The same gate the detail panel uses for the same two buttons. A to-do cannot
  // be parked again, a long-term goal has no end for a pause to postpone, and
  // finished work is finished.
  const canPark =
    !menu.row.task.isTodo && menu.row.task.type !== 'long-term' && menu.row.eff.status !== 'completed'
  // Filed away, the menu is two items rather than the same menu with more
  // conditions on it. Everything else on this row has been answered already —
  // it is finished, it is off the board, and it is read-only until it comes
  // back — so the only questions left are those two, and a short menu says that
  // faster than a long one with the rest greyed out.
  const filed = isArchived(menu.row.task)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const w = 190
  const left = Math.min(menu.x, window.innerWidth - w - 8)
  const top = Math.min(menu.y, window.innerHeight - 230)

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[69]"
        onMouseDown={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />
      <div className="fixed z-[70] bg-panel border border-border rounded-[3px] shadow-2xl py-1" style={{ left, top, width: w }}>
        {filed ? (
          <>
            <Item icon={<RotateCcw size={13} />} label={t('task.unarchive')} onClick={() => { onUnarchive(menu.row); onClose() }} />
            <div className="my-1 border-t border-line" />
            <Item icon={<Trash2 size={13} />} label={t('common.delete')} danger onClick={() => { onDelete(menu.row); onClose() }} />
          </>
        ) : (
        <>
        {/* A to-do can't be a parent (`parentOptions` in TaskDialog filters it
            out), so it gets no "add subtask" — otherwise the two items below
            both hand over a dialog that says "top level" and read as one. */}
        {!menu.row.task.isTodo && (
          <Item icon={<Plus size={13} />} label={t('task.addSubtask')} onClick={() => { onAddChild(menu.row); onClose() }} />
        )}
        <Item icon={<Plus size={13} />} label={t('task.addSibling')} onClick={() => { onAddSibling(menu.row); onClose() }} />
        <div className="my-1 border-t border-line" />
        <Item icon={<Pencil size={13} />} label={t('common.edit')} onClick={() => { onEdit(menu.row); onClose() }} />
        {/* No item on a row with subtasks. Past the status gate below it would
            open a dialog that refuses to render, so the item would do nothing
            at all — and a menu entry that does nothing is worse than one that
            was never there. The panel is where the reason is legible: it says
            the progress is rolled up from the children.

            Finished work is on the list, and it is the same item: the dialog
            asks a task that is not running for no figure, so what it writes is
            a comment — see `running` in `LogDialog`. A to-do is not on it: it
            has no schedule, so there is no window for a day of it to be part
            of, and `taskProgress` reads nothing back for one. */}
        {!menu.row.hasKids && (menu.row.eff.status === 'in-progress' || menu.row.eff.status === 'delayed' || menu.row.eff.status === 'completed') ? (
          <Item icon={<NotebookText size={13} />} label={t('log.write')} onClick={() => { onWriteLog(menu.row); onClose() }} />
        ) : null}
        <Item icon={<CornerUpLeft size={13} />} label={t('gantt.moveToTopLevel')} onClick={() => { onOutdent(menu.row); onClose() }} />
        <div className="my-1 border-t border-line" />
        {/* Parking and pausing, on the task itself rather than only inside the
            detail panel — which is where they lived, and where you had to have
            opened the task already to find out they existed.
            The two are alternatives, as they are in the panel: for work that has
            not started, parking it is the useful move and a pause would only
            postpone nothing. */}
        {canPark && (
          menu.row.eff.status === 'not-started'
            ? <Item icon={<CircleDashed size={13} />} label={t('task.setAsTodo')} onClick={() => { onSetTodo(menu.row); onClose() }} />
            : <Item icon={<Pause size={13} />} label={t('task.pause')} onClick={() => { onPause(menu.row); onClose() }} />
        )}
        {menu.row.task.paused && (
          <Item icon={<Play size={13} />} label={t('task.resume')} onClick={() => { onResume(menu.row); onClose() }} />
        )}
        <div className="my-1 border-t border-line" />
        {/* Any status can be filed away — unfinished work included, which is
            what "already written off" usually is. */}
        <Item icon={<Archive size={13} />} label={t('task.archive')} onClick={() => { onArchive(menu.row); onClose() }} />
        <Item icon={<Trash2 size={13} />} label={t('common.delete')} danger onClick={() => { onDelete(menu.row); onClose() }} />
        </>
        )}
      </div>
    </>,
    document.body,
  )
}

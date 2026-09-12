import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { CornerUpLeft, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { RowTask } from '../../lib/tree'
import { useT } from '../../lib/useT'

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

export function ContextMenu({ menu, onClose, onAddChild, onAddSibling, onEdit, onWriteLog, onOutdent, onDelete }: Props) {
  const t = useT()
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
        <Item icon={<Plus size={13} />} label={t('task.addSubtask')} onClick={() => { onAddChild(menu.row); onClose() }} />
        <Item icon={<Plus size={13} />} label={t('task.addSibling')} onClick={() => { onAddSibling(menu.row); onClose() }} />
        <div className="my-1 border-t border-line" />
        <Item icon={<Pencil size={13} />} label={t('common.edit')} onClick={() => { onEdit(menu.row); onClose() }} />
        {menu.row.eff.status === 'in-progress' || menu.row.eff.status === 'delayed' ? (
          <Item icon={<NotebookPen size={13} />} label={t('log.write')} onClick={() => { onWriteLog(menu.row); onClose() }} />
        ) : null}
        <Item icon={<CornerUpLeft size={13} />} label={t('gantt.moveToTopLevel')} onClick={() => { onOutdent(menu.row); onClose() }} />
        <div className="my-1 border-t border-line" />
        <Item icon={<Trash2 size={13} />} label={t('common.delete')} danger onClick={() => { onDelete(menu.row); onClose() }} />
      </div>
    </>,
    document.body,
  )
}

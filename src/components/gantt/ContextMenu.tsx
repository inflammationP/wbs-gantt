import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { CornerUpLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { Row } from '../../lib/tree'

export interface MenuState {
  x: number
  y: number
  row: Row
}

interface Props {
  menu: MenuState
  onClose: () => void
  onAddChild: (row: Row) => void
  onAddSibling: (row: Row) => void
  onEdit: (row: Row) => void
  onOutdent: (row: Row) => void
  onDelete: (row: Row) => void
}

function Item({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 h-7 text-[12px] text-left ${
        danger ? 'text-[#f85149] hover:bg-[#f85149]/10' : 'text-fg/90 hover:bg-panel2'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

export function ContextMenu({ menu, onClose, onAddChild, onAddSibling, onEdit, onOutdent, onDelete }: Props) {
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
        <Item icon={<Plus size={13} />} label="Add child" onClick={() => { onAddChild(menu.row); onClose() }} />
        <Item icon={<Plus size={13} />} label="Add sibling" onClick={() => { onAddSibling(menu.row); onClose() }} />
        <div className="my-1 border-t border-line" />
        <Item icon={<Pencil size={13} />} label="Edit" onClick={() => { onEdit(menu.row); onClose() }} />
        <Item icon={<CornerUpLeft size={13} />} label="Move to top level" onClick={() => { onOutdent(menu.row); onClose() }} />
        <div className="my-1 border-t border-line" />
        <Item icon={<Trash2 size={13} />} label="Delete" danger onClick={() => { onDelete(menu.row); onClose() }} />
      </div>
    </>,
    document.body,
  )
}

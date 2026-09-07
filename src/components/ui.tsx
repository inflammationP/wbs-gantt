import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export const inputCls =
  'w-full h-8 px-2 bg-panel2 border border-border rounded-[3px] text-[12px] text-fg placeholder:text-dim focus:outline-none focus:border-accent'

export function Modal({
  title,
  onClose,
  children,
  width = 560,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-panel border border-border rounded-[4px] shadow-2xl max-h-[88vh] overflow-hidden flex flex-col"
        style={{ width }}
      >
        <div className="flex items-center justify-between px-4 h-11 shrink-0 border-b border-border">
          <div className="text-[13px] font-semibold tracking-wide text-fg">{title}</div>
          <button onClick={onClose} className="text-dim hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex items-center bg-panel2 border border-border rounded-[3px] overflow-hidden">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 h-7 text-[11px] font-medium tracking-wide transition-colors ${
            value === o.value ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg hover:bg-panel'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{label}</div>
      {children}
    </label>
  )
}

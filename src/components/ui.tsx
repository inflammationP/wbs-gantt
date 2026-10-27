import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useT } from '../lib/useT'

export const inputCls =
  'w-full h-8 px-2 bg-panel2 border border-border rounded-[3px] text-[12px] text-fg placeholder:text-dim focus:outline-none focus:border-accent'

/**
 * The same field, with the softer shape the Today page uses. Kept beside
 * `inputCls` rather than replacing it: the rest of the app is deliberately
 * dense and square, and that is not what this view is.
 */
export const softInputCls =
  'w-full h-9 px-3 bg-panel2/50 border border-border rounded-xl text-[12px] text-fg placeholder:text-dim focus:outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/15'

export function Modal({
  title,
  onClose,
  children,
  width = 560,
  zIndex = 60,
  soft = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
  /**
   * The rounded, blurred variant. Used by the Today page's plan and block
   * dialogs; every other dialog keeps the app's square frame.
   */
  soft?: boolean
  /**
   * Only the confirmations raised from inside a floating bubble need to move:
   * the bubble is z-70, so a question asked from it has to clear that. The
   * default stays below the popovers a dialog opens out of itself (the task
   * dialog's parent picker is z-70).
   */
  zIndex?: number
}) {
  const t = useT()
  return createPortal(
    <div
      data-modal
      style={{ zIndex }}
      className={`fixed inset-0 flex items-center justify-center ${soft ? 'bg-black/55 backdrop-blur-[2px]' : 'bg-black/60'}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`bg-panel border shadow-2xl max-h-[88vh] overflow-hidden flex flex-col ${
          soft ? 'rounded-2xl border-border/70' : 'rounded-[4px] border-border'
        }`}
        style={{ width }}
      >
        <div
          className={`flex items-center justify-between shrink-0 border-b border-border/70 ${
            soft ? 'px-5 h-12' : 'px-4 h-11'
          }`}
        >
          <div className={`font-semibold tracking-wide text-fg ${soft ? 'text-[14px]' : 'text-[13px]'}`}>{title}</div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
            className="text-dim hover:text-fg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className={`overflow-auto ${soft ? 'p-5' : 'p-4'}`}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  pill = false,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  /** The rounded variant used by the Today page and its dialogs. */
  pill?: boolean
}) {
  return (
    <div
      className={
        pill
          ? 'flex items-center gap-1 p-1 rounded-full bg-panel2/50 border border-border/70'
          : 'flex items-center bg-panel2 border border-border rounded-[3px] overflow-hidden'
      }
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`text-[11px] font-medium tracking-wide transition-colors ${
            pill ? 'h-6 px-3 rounded-full' : 'px-2.5 h-7'
          } ${
            value === o.value
              ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgb(var(--c-accent)/0.18)]'
              : 'text-muted hover:text-fg hover:bg-panel/60'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The gutter to the left of a row in a lineage chart — one 12px cell per level.
 *
 * `depth` is how many levels the row sits at, `rails[j]` says whether the line
 * at level `j` carries on past this row, and `first` says there is no sibling
 * above it. The last cell is the join into the row: an elbow, plus the line up
 * to the sibling above and the line down to the one below — either, both or
 * neither, and which of the four it is comes out of one piece of markup:
 *
 *   ├  a sibling above and below    └  the last of a list
 *   ┌  the first of several         └  an only child
 *
 * The only child is the case that reads as a bug when it is got wrong. It has no
 * sibling on either side, so both halves of the vertical could be dropped — and
 * that leaves a bare stub, a row hanging off nothing. It gets the same `└` as a
 * last sibling: there is nothing above it but its parent, and the corner is what
 * says so.
 *
 * Drawn rather than typed. Box-drawing characters line up only if the font makes
 * `│` fill the whole line box, and no font does at a 12px size inside a 24px
 * row: the trunk comes out as disconnected stubs, which is the one thing a
 * lineage chart must not be.
 *
 * Lifted out of `TaskTreeDialog` when the merge dialog's preview wanted the same
 * drawing. Two copies of it would be two answers to "what does a branch look
 * like", and the second one drifts.
 */
export function TreeRails({ depth, rails, first }: { depth: number; rails: boolean[]; first: boolean }) {
  return (
    <>
      {Array.from({ length: depth }, (_, i) => {
        const join = i === depth - 1
        const below = rails[i]
        return (
          <span key={i} className="relative w-3 shrink-0 self-stretch">
            {join ? (
              <>
                <span className="absolute left-1/2 top-1/2 w-1.5 border-t border-dim" />
                <span
                  className={`absolute left-1/2 border-l border-dim ${
                    first && below ? 'top-1/2' : 'top-0'
                  } ${below ? 'bottom-0' : 'bottom-1/2'}`}
                />
              </>
            ) : (
              below && <span className="absolute inset-y-0 left-1/2 border-l border-dim" />
            )}
          </span>
        )
      })}
    </>
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

/**
 * A headline figure: what it counts, the count, and the line that reads it.
 *
 * Lifted out of `ManagePage` when the Today page's header wanted the same
 * thing. Two copies of a card is not a layout problem, it is two answers to
 * "what does a figure look like here" — and the second one always drifts.
 *
 * `value` is `font-mono` so a row of these lines its digits up, and `danger`
 * only ever recolours the number: the sub-line carries the same news in words,
 * because a red figure alone tells a colourblind reader nothing.
 */
export function Stat({
  label,
  value,
  sub,
  danger,
  soft = false,
}: {
  label: string
  value: string
  sub: string
  danger?: boolean
  soft?: boolean
}) {
  return (
    <div className={soft ? 'bg-panel2/35 border border-border/60 rounded-xl px-4 py-3' : 'bg-panel border border-border rounded-[3px] px-4 py-3'}>
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`text-[22px] font-semibold font-mono mt-1 ${danger ? 'text-delayed' : 'text-fg'}`}>{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  )
}

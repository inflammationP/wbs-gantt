import { useT } from '../lib/useT'
import { LoadRead, formatHours } from '../lib/schedule'
import { sig } from '../lib/ui'

/**
 * How full a day is, with the available hours as something you can change.
 *
 * The bar is scaled to `max(used, capacity)` rather than capped at a hundred
 * percent: when the day is over, the part past the capacity mark is hatched and
 * the mark itself is drawn, so "how far past" is a length rather than only a
 * number. Nothing here uses a status colour — over capacity is not a delayed
 * task.
 *
 * A day whose capacity was never filled has no bar at all. The field says so in
 * words ("not set") and the reading says the load cannot be calculated, because
 * a fraction of a day with no denominator is not a load. `read` is the one place
 * that decision is made — see `loadRead` in lib/schedule.ts.
 */
export function LoadMeter({
  used,
  capacity,
  read,
  onCapacity,
  compact = false,
  className = '',
}: {
  used: number
  /** `null` means nobody has said how much time the day has. */
  capacity: number | null
  read: LoadRead
  /** Given means the capacity is editable here; absent means read-only. */
  onCapacity?: (hours: number | null) => void
  compact?: boolean
  className?: string
}) {
  const t = useT()
  // A stored zero is the same statement as no stored value: nothing to divide
  // by. The store already deletes a capacity that returns to the default, so
  // this only catches a hand-edited file.
  const filled = capacity != null && capacity > 0
  const value = filled ? capacity : null
  const over = read.computable && used > (value ?? 0)
  const ratio = value != null && value > 0 ? used / value : used > 0 ? Number.POSITIVE_INFINITY : 0
  const max = Math.max(used, value ?? 0, 0.0001)
  const usedPct = Math.min(100, (used / max) * 100)
  const capPct = Math.min(100, ((value ?? 0) / max) * 100)
  // Traffic-light load: comfortable, nearly full, over. The label beside the
  // bar says the same thing in words, so colour is never the only cue.
  const tone = over ? 'delayed' : ratio >= 0.8 ? 'in-progress' : 'accent'
  const fill = tone === 'accent' ? 'rgb(var(--c-accent))' : sig(tone)
  const statusTone =
    !read.computable
      ? 'text-dim'
      : over
        ? 'text-delayed'
        : tone === 'in-progress'
          ? 'text-today'
          : 'text-dim'
  const status = !read.computable
    ? t('load.unknown')
    : over
      ? t('load.overBy', { hours: formatHours(used - (value ?? 0)) })
      : t('load.left', { hours: formatHours((value ?? 0) - used) })
  // The week's columns are too narrow for a second badge; there an "approximate"
  // mark carries the same meaning and its hover says the word.
  const compactStatus = read.reference ? `≈ ${status}` : status

  const input = (small: boolean) =>
    onCapacity ? (
      <input
        key={value ?? 'unfilled'}
        type="text"
        inputMode="decimal"
        defaultValue={value ?? ''}
        placeholder={value == null ? t('load.unfilled') : undefined}
        aria-label={t('load.available')}
        title={t('load.available')}
        onBlur={(e) => {
          const raw = e.currentTarget.value
          if (raw.trim() === '') {
            if (value != null) onCapacity(null)
            return
          }
          const next = Number(raw)
          if (!Number.isFinite(next)) {
            e.currentTarget.value = value == null ? '' : String(value)
            return
          }
          onCapacity(Math.max(0, Math.min(24, next)))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={
          small
            ? `${value == null ? 'w-12' : 'w-7'} bg-transparent text-right font-mono text-[10px] text-fg outline-none placeholder:text-dim`
            : `${value == null ? 'w-14' : 'w-9'} h-5 rounded-md border border-border bg-panel2/80 px-1 text-right font-mono text-[11px] text-fg outline-none focus:border-accent/70 placeholder:text-muted`
        }
      />
    ) : (
      <span className="font-mono text-[11px] text-fg">
        {value == null ? t('load.unfilled') : formatHours(value)}
      </span>
    )

  return (
    <div className={className}>
      {compact ? (
        <div className="flex items-center justify-between gap-1 text-[9px]">
          <span className="font-mono text-[10px] text-fg">{formatHours(used)} /</span>
          <span className="inline-flex items-center gap-0.5 text-dim">
            {input(true)}
            {value != null && <span>h</span>}
          </span>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider text-dim">{t('load.label')}</span>
          <span className="font-mono text-[11px] text-fg">
            {t('load.used', { hours: formatHours(used) })}
          </span>
        </div>
      )}

      <div
        className={`relative mt-1.5 w-full overflow-hidden rounded-full bg-bg/50 shadow-inner border border-border ${
          compact ? 'h-2' : 'h-2.5'
        } ${read.computable ? '' : 'opacity-40 grayscale'}`}
      >
        {read.computable && (
          <>
            <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: fill }} />
            {over && (
              <div
                className="absolute inset-y-0"
                style={{
                  left: `${capPct}%`,
                  width: `${100 - capPct}%`,
                  backgroundImage:
                    'repeating-linear-gradient(45deg, rgb(var(--c-fg) / 0.5) 0 3px, transparent 3px 6px)',
                }}
              />
            )}
            {over && (
              <div className="absolute inset-y-0 w-px bg-fg/70" style={{ left: `${capPct}%` }} />
            )}
          </>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        {!compact && (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-dim">
            <span className="uppercase tracking-wider">{t('load.available')}</span>
            {input(false)}
            {value != null && <span>h</span>}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5">
          {read.computable && read.reference && !compact && (
            <span className="inline-flex h-4 items-center rounded-full border border-border bg-panel2 px-1.5 text-[9px] text-dim">
              {t('load.reference')}
            </span>
          )}
          <span
            className={`text-[9px] font-medium ${statusTone} ${compact ? '' : 'text-[10px]'}`}
            title={compact && read.reference ? t('load.reference') : undefined}
          >
            {compact ? compactStatus : status}
          </span>
        </span>
      </div>
    </div>
  )
}

import { useT } from '../lib/useT'
import { formatHours } from '../lib/schedule'
import { sig } from '../lib/ui'

/**
 * How full a day is, with the available hours as something you can change.
 *
 * The bar is scaled to `max(used, capacity)` rather than capped at a hundred
 * percent: when the day is over, the part past the capacity mark is hatched and
 * the mark itself is drawn, so "how far past" is a length rather than only a
 * number. Nothing here uses a status colour — over capacity is not a delayed
 * task.
 */
export function LoadMeter({
  used,
  capacity,
  onCapacity,
  compact = false,
  className = '',
}: {
  used: number
  capacity: number
  /** Given means the capacity is editable here; absent means read-only. */
  onCapacity?: (hours: number) => void
  compact?: boolean
  className?: string
}) {
  const t = useT()
  const over = used > capacity
  const ratio = capacity > 0 ? used / capacity : used > 0 ? Number.POSITIVE_INFINITY : 0
  const max = Math.max(used, capacity, 0.0001)
  const usedPct = Math.min(100, (used / max) * 100)
  const capPct = Math.min(100, (capacity / max) * 100)
  // Traffic-light load: comfortable, nearly full, over. The label beside the
  // bar says the same thing in words, so colour is never the only cue.
  const tone = over ? 'delayed' : ratio >= 0.8 ? 'in-progress' : 'accent'
  const fill = tone === 'accent' ? 'rgb(var(--c-accent))' : sig(tone)
  const statusTone =
    tone === 'delayed' ? 'text-delayed' : tone === 'in-progress' ? 'text-today' : 'text-dim'
  const status = over
    ? t('load.overBy', { hours: formatHours(used - capacity) })
    : t('load.left', { hours: formatHours(capacity - used) })

  const input = (value: number, small: boolean) =>
    onCapacity ? (
      <input
        key={value}
        type="number"
        min={0}
        max={24}
        step={0.5}
        defaultValue={value}
        aria-label={t('load.available')}
        title={t('load.available')}
        onBlur={(e) => {
          const raw = e.currentTarget.value
          const next = Number(raw)
          if (raw.trim() === '' || !Number.isFinite(next)) {
            e.currentTarget.value = String(value)
            return
          }
          onCapacity(next)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className={
          small
            ? 'w-7 bg-transparent text-right font-mono text-[10px] text-fg outline-none'
            : 'w-8 rounded-md bg-panel2/70 px-1 text-right font-mono text-[11px] text-fg outline-none focus:ring-1 focus:ring-accent/40'
        }
      />
    ) : (
      <span className="font-mono text-[11px] text-fg">{formatHours(value)}</span>
    )

  return (
    <div className={className}>
      {compact ? (
        <div className="flex items-center justify-between gap-1 text-[9px]">
          <span className="font-mono text-[10px] text-fg">{formatHours(used)} /</span>
          <span className="inline-flex items-center gap-0.5 text-dim">
            {input(capacity, true)}
            <span>h</span>
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
        }`}
      >
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
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        {!compact && (
          <span className="inline-flex items-center gap-1 text-[10px] text-dim">
            {t('load.available')}
            {input(capacity, false)}
            <span>h</span>
          </span>
        )}
        <span
          className={`ml-auto text-[9px] font-medium ${statusTone} ${compact ? '' : 'text-[10px]'}`}
        >
          {status}
        </span>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'

interface Props {
  /** 0–100. */
  value: number
  size?: number
  stroke?: number
  /** Fill colour. `null` draws the track alone (nothing to measure). */
  fill: string | null
  /** A lighter step of the fill's own ramp, so the state reads across the whole ring. */
  track: string
  /** Spoken and hovered; the visual caption lives in `children`. */
  label: string
  children?: ReactNode
}

/**
 * A single ratio against a limit, drawn as a ring — a meter, not a chart. The
 * fill carries severity; the colours this app feeds it (`completed` green vs
 * `today` amber) are only ΔE 3.8 apart under protanopia, so every caller must
 * pair the ring with an icon and a written caption. Colour is never the only
 * channel here.
 */
export function ProgressRing({ value, size = 96, stroke = 9, fill, track, label, children }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Rotating the svg (rather than the arc) puts the gap at 12 o'clock
          without any transform-origin arithmetic. */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        className="-rotate-90"
      >
        <title>{label}</title>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {fill && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={fill}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

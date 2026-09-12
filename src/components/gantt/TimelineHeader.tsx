import type { MouseEvent } from 'react'
import { Timeline, xToDate } from '../../lib/timeline'
import { toISO } from '../../lib/dates'

export function TimelineHeader({
  timeline,
  onPickDate,
}: {
  timeline: Timeline
  onPickDate: (iso: string) => void
}) {
  // Anywhere in the header picks the exact date under the cursor, so every date
  // the timeline shows is reachable. Per-cell would not do: at week/month/…
  // zoom a column is many days wide, and only the pointer's x knows which one
  // inside it was meant.
  const pick = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    onPickDate(toISO(xToDate(e.clientX - r.left, timeline)))
  }

  return (
    <div
      className="h-full flex flex-col cursor-pointer"
      onClick={pick}
      title="Click any date to open its day detail"
    >
      {/* higher-level period layer */}
      <div className="h-[24px] shrink-0 flex border-b border-line" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {timeline.groups.map((g) => (
          <div
            key={g.key}
            className={`border-r border-border text-[10px] px-1.5 flex items-center overflow-hidden whitespace-nowrap hover:bg-white/5 ${
              g.today ? 'text-today font-semibold' : 'text-muted'
            }`}
            style={{ width: g.cells * timeline.colWidth }}
          >
            {g.label}
          </div>
        ))}
      </div>
      {/* selected-unit layer */}
      <div className="flex-1 flex">
        {timeline.cells.map((c) => (
          <div
            key={c.key}
            className={`border-r border-line flex items-center justify-center text-[10px] font-mono hover:bg-white/10 ${
              c.today ? 'text-today font-bold' : c.weekend ? 'text-dim' : 'text-muted'
            }`}
            style={{ width: timeline.colWidth }}
          >
            {c.label}
          </div>
        ))}
      </div>
    </div>
  )
}

import { Timeline } from '../../lib/timeline'

export function TimelineHeader({ timeline }: { timeline: Timeline }) {
  return (
    <div className="h-full flex flex-col">
      {/* higher-level period layer */}
      <div className="h-[24px] shrink-0 flex border-b border-line" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {timeline.groups.map((g) => (
          <div
            key={g.key}
            className={`border-r border-border text-[10px] px-1.5 flex items-center overflow-hidden whitespace-nowrap ${
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
            className={`border-r border-line flex items-center justify-center text-[10px] font-mono ${
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

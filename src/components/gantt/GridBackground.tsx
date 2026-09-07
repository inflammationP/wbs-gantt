import { Timeline } from '../../lib/timeline'

export function GridBackground({ timeline }: { timeline: Timeline }) {
  return (
    <div className="absolute inset-0">
      {timeline.cells.map((c, i) => (
        <div
          key={c.key}
          className="absolute top-0 bottom-0 border-r border-line"
          style={{
            left: i * timeline.colWidth,
            width: timeline.colWidth,
            background: c.today ? 'rgba(227,179,65,0.03)' : c.weekend ? 'rgba(255,255,255,0.02)' : undefined,
          }}
        />
      ))}
    </div>
  )
}

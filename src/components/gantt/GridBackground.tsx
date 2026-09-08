import { Timeline } from '../../lib/timeline'

export function GridBackground({ timeline, leftWidth = 0 }: { timeline: Timeline; leftWidth?: number }) {
  const { colWidth } = timeline
  // Vertical gridlines continuing behind the (semi-transparent) left task area,
  // so the date grid reads as one continuous canvas across the full width.
  const phantomCols = Math.floor(leftWidth / colWidth)

  return (
    <div className="absolute inset-0">
      {Array.from({ length: phantomCols }).map((_, k) => (
        <div
          key={`phantom-${k}`}
          className="absolute top-0 bottom-0 border-r border-line"
          style={{ left: leftWidth - (k + 1) * colWidth, width: colWidth }}
        />
      ))}
      {timeline.cells.map((c, i) => (
        <div
          key={c.key}
          className="absolute top-0 bottom-0 border-r border-line"
          style={{
            left: leftWidth + i * colWidth,
            width: colWidth,
            background: c.today ? 'rgba(227,179,65,0.03)' : c.weekend ? 'rgba(255,255,255,0.02)' : undefined,
          }}
        />
      ))}
    </div>
  )
}

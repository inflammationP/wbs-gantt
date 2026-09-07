import { Fragment, useMemo } from 'react'
import type { MouseEvent } from 'react'
import { Row } from '../../lib/tree'
import { buildTimeline, dateToX } from '../../lib/timeline'
import { startOfDay } from '../../lib/dates'
import { useStore } from '../../store/useStore'
import { TimelineHeader } from './TimelineHeader'
import { GridBackground } from './GridBackground'
import { RowLeft, LeftHeader, LEFT_WIDTH } from './RowLeft'
import { TaskBar } from './TaskBar'

const HEADER_H = 52
const ROW_H = 34

interface Props {
  rows: Row[]
  onContext: (e: MouseEvent<HTMLDivElement>, row: Row) => void
  onAddChild: (row: Row) => void
  onEdit: (row: Row) => void
}

export function GanttChart({ rows, onContext, onAddChild, onEdit }: Props) {
  const viewMode = useStore((s) => s.viewMode)
  const anchorISO = useStore((s) => s.anchorISO)
  const setSelected = useStore((s) => s.setSelected)

  const timeline = useMemo(() => buildTimeline(viewMode, anchorISO), [viewMode, anchorISO])

  const todayX = useMemo(() => {
    const now = new Date()
    const anchor = timeline.unit === 'hour' ? now : startOfDay(now)
    const x = dateToX(anchor, timeline)
    return x >= 0 && x <= timeline.totalWidth ? x : null
  }, [timeline])

  return (
    <div
      className="flex-1 overflow-auto bg-panel"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null)
      }}
    >
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `${LEFT_WIDTH}px ${timeline.totalWidth}px`, width: 'max-content' }}
      >
        {/* grid background (behind rows) */}
        <div
          className="absolute pointer-events-none"
          style={{ left: LEFT_WIDTH, top: HEADER_H, width: timeline.totalWidth, bottom: 0, zIndex: 0 }}
        >
          <GridBackground timeline={timeline} />
        </div>

        {/* today line */}
        {todayX != null && (
          <div
            className="absolute pointer-events-none"
            style={{ left: LEFT_WIDTH + todayX, top: HEADER_H, bottom: 0, width: 1, background: '#e3b341', opacity: 0.75, zIndex: 5 }}
          />
        )}

        {/* header */}
        <div className="sticky top-0 left-0 z-30 bg-panel border-b border-r border-border" style={{ height: HEADER_H }}>
          <LeftHeader />
        </div>
        <div className="sticky top-0 z-20 bg-panel border-b border-border" style={{ height: HEADER_H }}>
          <TimelineHeader timeline={timeline} />
        </div>

        {/* rows */}
        {rows.map((row) => (
          <Fragment key={row.id}>
            <div className="sticky left-0 z-10 bg-panel border-b border-line" style={{ height: ROW_H }}>
              <RowLeft row={row} onAddChild={onAddChild} onEdit={onEdit} onContext={onContext} />
            </div>
            <div className="relative border-b border-line" style={{ height: ROW_H }} onClick={() => setSelected(row.id)}>
              <TaskBar row={row} timeline={timeline} rowH={ROW_H} />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

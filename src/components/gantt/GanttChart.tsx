import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { Row } from '../../lib/tree'
import { buildTimeline, dateToX } from '../../lib/timeline'
import { startOfDay } from '../../lib/dates'
import { useStore } from '../../store/useStore'
import { TimelineHeader } from './TimelineHeader'
import { GridBackground } from './GridBackground'
import { RowLeft, LeftHeader, LEFT_WIDTH } from './RowLeft'
import { TaskBar } from './TaskBar'

const HEADER_H = 52

// Row height by hierarchy depth (0 = top, 1 = child, 2 = grandchild+).
// Secondary rows shrink so the three levels read clearly at a glance.
const ROW_HEIGHT = [48, 36, 32]
const rowHeight = (depth: number) => ROW_HEIGHT[Math.min(depth, 2)]

// Splitter between the left task table and the right timeline.
const SPLITTER_W = 6
const MIN_LEFT = 480
const MAX_LEFT = 960

// Alternating row background so each task row reads as one continuous stripe
// across the full Gantt width (left labels + timeline).
const rowBg = (i: number) => (i % 2 === 1 ? 'bg-stripe' : 'bg-panel')

// Semi-transparent version for the left task overlay (frosted glass base).
const rowBgLeft = (i: number) => (i % 2 === 1 ? 'bg-stripe/30' : 'bg-panel/30')

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

  // Single source of truth for the left/right boundary.
  const [leftWidth, setLeftWidth] = useState(LEFT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const splitterRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewportW, setViewportW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200))

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setViewportW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const timeline = useMemo(
    () => buildTimeline(viewMode, anchorISO, Math.max(0, viewportW)),
    [viewMode, anchorISO, viewportW],
  )

  const todayX = useMemo(() => {
    const x = dateToX(startOfDay(new Date()), timeline)
    return x >= 0 && x <= timeline.totalWidth ? x : null
  }, [timeline])

  const onSplitterDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    splitterRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startWidth: leftWidth }
    setDragging(true)
  }

  const onSplitterMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const next = d.startWidth + (e.clientX - d.startX)
    setLeftWidth(Math.min(MAX_LEFT, Math.max(MIN_LEFT, next)))
  }

  const onSplitterUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    if (splitterRef.current?.hasPointerCapture(e.pointerId)) splitterRef.current.releasePointerCapture(e.pointerId)
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-panel"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setSelected(null)
      }}
    >
      <div className="relative" style={{ width: leftWidth + timeline.totalWidth }}>
        {/* date grid background — full-width bottom layer behind the left overlay */}
        <div className="absolute pointer-events-none" style={{ top: HEADER_H, bottom: 0, left: 0, right: 0, zIndex: 5 }}>
          <GridBackground timeline={timeline} leftWidth={leftWidth} />
        </div>

        {/* left task labels — frosted-glass overlay on top of the date grid */}
        <div className="sticky left-0 z-30 backdrop-blur-[6px]" style={{ width: leftWidth }}>
          {/* left header */}
          <div className="sticky top-0 z-20 bg-panel/30 backdrop-blur-[6px] border-b border-border" style={{ height: HEADER_H }}>
            <LeftHeader />
          </div>
          {/* left rows */}
          {rows.map((row, i) => (
            <div key={row.id} className={`${rowBgLeft(i)} border-b border-line`} style={{ height: rowHeight(row.depth) }}>
              <RowLeft row={row} onAddChild={onAddChild} onEdit={onEdit} onContext={onContext} />
            </div>
          ))}

          {/* splitter handle — pinned with the left region, spans full height */}
          <div
            ref={splitterRef}
            className="group absolute top-0 bottom-0 z-40 cursor-col-resize select-none"
            style={{ right: -SPLITTER_W / 2, width: SPLITTER_W, touchAction: 'none' }}
            onPointerDown={onSplitterDown}
            onPointerMove={onSplitterMove}
            onPointerUp={onSplitterUp}
            onPointerCancel={onSplitterUp}
          >
            <div className={`absolute inset-0 transition-colors ${dragging ? 'bg-accent/15' : 'group-hover:bg-accent/10'}`} />
            <div
              className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors ${
                dragging ? 'bg-accent' : 'bg-transparent group-hover:bg-accent'
              }`}
            />
          </div>
        </div>

        {/* timeline region (scrolls horizontally under the left labels) */}
        <div className="absolute top-0 bottom-0" style={{ left: leftWidth, width: timeline.totalWidth }}>
          {/* today line */}
          {todayX != null && (
            <div
              className="absolute pointer-events-none"
              style={{ left: todayX, top: HEADER_H, bottom: 0, width: 1, background: '#e3b341', opacity: 0.75, zIndex: 15 }}
            />
          )}

          {/* timeline header */}
          <div className="sticky top-0 z-20 bg-panel border-b border-border" style={{ height: HEADER_H }}>
            <TimelineHeader timeline={timeline} />
          </div>

          {/* timeline rows */}
          {rows.map((row, i) => (
            <div key={row.id} className={`relative ${rowBg(i)} border-b border-line`} style={{ height: rowHeight(row.depth) }} onClick={() => setSelected(row.id)}>
              <TaskBar row={row} timeline={timeline} rowH={rowHeight(row.depth)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

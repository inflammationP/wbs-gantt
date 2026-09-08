import { useMemo, useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { Row } from '../../lib/tree'
import { Timeline, dateToX } from '../../lib/timeline'
import { addDays, addUnit, toDate, toISO } from '../../lib/dates'
import { STATUS_META, hexToRgba } from '../../lib/ui'
import { useStore } from '../../store/useStore'

type DragMode = 'move' | 'start' | 'end'

interface DragState {
  mode: DragMode
  startX: number
  origLeft: number
  origWidth: number
  origStart: Date
  origEnd: Date
  unit: Timeline['unit']
  colWidth: number
  moved: boolean
}

export function TaskBar({ row, timeline, rowH }: { row: Row; timeline: Timeline; rowH: number }) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const moveTask = useStore((s) => s.moveTask)
  const resizeTask = useStore((s) => s.resizeTask)
  const setSelected = useStore((s) => s.setSelected)

  const isGoal = row.task.type === 'long-term'
  const isParent = row.hasKids
  const meta = STATUS_META[row.eff.status]

  // Continuous x position of the start (and, for phases, the exclusive end).
  const startX = useMemo(() => {
    if (row.eff.start == null) return 0
    return dateToX(toDate(row.eff.start), timeline)
  }, [row.eff.start, timeline])

  const endX = useMemo(() => {
    if (isGoal || row.eff.end == null) return timeline.totalWidth
    return dateToX(addDays(toDate(row.eff.end), 1), timeline)
  }, [isGoal, row.eff.end, timeline])

  const onClickBar = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setSelected(row.id)
  }

  const begin = (mode: DragMode) => (e: PointerEvent<HTMLDivElement>) => {
    if (isParent && mode !== 'move') return
    if (isGoal && mode !== 'move') return
    e.stopPropagation()
    e.preventDefault()
    const el = barRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode,
      startX: e.clientX,
      origLeft: isGoal ? Math.max(0, startX) : startX,
      origWidth: isGoal ? timeline.totalWidth - Math.max(0, startX) : endX - startX,
      origStart: toDate(row.eff.start ?? toISO(new Date())),
      origEnd: toDate(row.eff.end ?? toISO(new Date())),
      unit: timeline.unit,
      colWidth: timeline.colWidth,
      moved: false,
    }
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const el = barRef.current
    if (!d || !el) return
    const deltaPx = e.clientX - d.startX
    if (Math.abs(deltaPx) > 2) d.moved = true
    const deltaUnits = Math.round(deltaPx / d.colWidth)
    if (d.mode === 'move') {
      const nl = d.origLeft + deltaUnits * d.colWidth
      if (isGoal) {
        const cl = Math.max(0, nl)
        el.style.left = `${cl}px`
        el.style.width = `${timeline.totalWidth - cl}px`
      } else {
        el.style.left = `${nl}px`
      }
    } else if (d.mode === 'start') {
      const nl = d.origLeft + deltaUnits * d.colWidth
      const nw = d.origWidth - deltaUnits * d.colWidth
      el.style.left = `${nl}px`
      el.style.width = `${Math.max(nw, d.colWidth)}px`
    } else {
      const nw = d.origWidth + deltaUnits * d.colWidth
      el.style.width = `${Math.max(nw, d.colWidth)}px`
    }
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    if (d.moved) suppressClickRef.current = true
    const deltaUnits = Math.round((e.clientX - d.startX) / d.colWidth)
    if (d.mode === 'move') {
      moveTask(row.id, deltaUnits, d.unit)
    } else if (d.mode === 'start') {
      let ns = addUnit(d.origStart, d.unit, deltaUnits)
      if (ns > d.origEnd) ns = d.origEnd
      resizeTask(row.id, toISO(ns), toISO(d.origEnd))
    } else {
      let ne = addUnit(d.origEnd, d.unit, deltaUnits)
      if (ne < d.origStart) ne = d.origStart
      resizeTask(row.id, toISO(d.origStart), toISO(ne))
    }
  }

  if (isGoal) {
    if (row.eff.start == null) return null
    const gLeft = Math.max(0, startX)
    const gWidth = timeline.totalWidth - gLeft
    if (gWidth <= 0) return null
    const fadeColor = hexToRgba(meta.color, 0.3)
    return (
      <div
        ref={barRef}
        className="absolute cursor-grab active:cursor-grabbing select-none"
        style={{
          left: gLeft,
          width: gWidth,
          top: 0,
          height: rowH,
          background: `linear-gradient(to right, ${meta.color}, ${fadeColor})`,
          zIndex: 10,
        }}
        onPointerDown={begin('move')}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onClick={onClickBar}
        title={`${row.wbs} ${row.task.name} — ongoing`}
      >
        {/* start marker */}
        <div className="absolute inset-y-0 left-0 w-[2px]" style={{ background: meta.color }} />
        {/* label */}
        <div
          className="absolute inset-0 flex items-center px-2 text-[10px] text-fg truncate pointer-events-none"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
        >
          {row.task.name}
        </div>
        {/* ongoing hint */}
        <span className="absolute inset-y-0 right-1.5 flex items-center text-[11px] pointer-events-none" style={{ color: fadeColor }}>→</span>
      </div>
    )
  }

  const barH = isParent ? 10 : 18
  const top = (rowH - barH) / 2
  const left = startX
  const width = endX - startX

  return (
    <div
      ref={barRef}
      className="absolute rounded-[2px] border cursor-grab active:cursor-grabbing overflow-hidden select-none"
      style={{
        left,
        width,
        top,
        height: barH,
        background: meta.dim,
        borderColor: meta.color,
        zIndex: 10,
      }}
      onPointerDown={begin('move')}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onClick={onClickBar}
      title={`${row.wbs} ${row.task.name}`}
    >
      {/* progress fill */}
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: `${row.eff.progress}%`, background: meta.color, opacity: isParent ? 0.5 : 0.85 }}
      />
      {/* label */}
      {!isParent && width > 44 && (
        <div
          className="absolute inset-0 flex items-center px-1.5 text-[10px] text-fg truncate pointer-events-none"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
        >
          {row.task.name}
        </div>
      )}
      {/* resize handles */}
      {!isParent && (
        <>
          <div onPointerDown={begin('start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" style={{ zIndex: 2 }} />
          <div onPointerDown={begin('end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" style={{ zIndex: 2 }} />
        </>
      )}
    </div>
  )
}

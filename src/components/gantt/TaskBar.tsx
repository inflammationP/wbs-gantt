import { useMemo, useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { Row } from '../../lib/tree'
import { Timeline, dateToX } from '../../lib/timeline'
import { addDays, addUnit, toDate, toISO } from '../../lib/dates'
import { STATUS_META } from '../../lib/ui'
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

  const { left, width } = useMemo(() => {
    if (isGoal || row.eff.start == null || row.eff.end == null) return { left: 0, width: 0 }
    const s = toDate(row.eff.start)
    const eEnd = addDays(toDate(row.eff.end), 1)
    const l = dateToX(s, timeline)
    return { left: l, width: dateToX(eEnd, timeline) - l }
  }, [isGoal, row.eff.start, row.eff.end, timeline])

  const onClickBar = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setSelected(row.id)
  }

  if (isGoal) {
    const top = (rowH - 14) / 2
    return (
      <div
        className="absolute select-none cursor-pointer"
        style={{ left: 6, right: 6, top, height: 14 }}
        onClick={onClickBar}
        title={`${row.wbs} ${row.task.name} — long-term goal`}
      >
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[12px] leading-none"
          style={{ color: meta.color }}
        >
          ∞
        </span>
        <div className="absolute left-5 right-6 top-1/2 border-t border-dashed" style={{ borderColor: meta.color, opacity: 0.55 }} />
        <span
          className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] leading-none"
          style={{ color: meta.color, opacity: 0.9 }}
        >
          →
        </span>
      </div>
    )
  }

  const barH = isParent ? 10 : 18
  const top = (rowH - barH) / 2

  const begin = (mode: DragMode) => (e: PointerEvent<HTMLDivElement>) => {
    if (isParent && mode !== 'move') return
    e.stopPropagation()
    e.preventDefault()
    const el = barRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    dragRef.current = {
      mode,
      startX: e.clientX,
      origLeft: left,
      origWidth: width,
      origStart: toDate(row.eff.start!),
      origEnd: toDate(row.eff.end!),
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
      el.style.left = `${d.origLeft + deltaUnits * d.colWidth}px`
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

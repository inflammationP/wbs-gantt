import { useMemo, useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { RowTask } from '../../lib/tree'
import { Timeline, dateToX } from '../../lib/timeline'
import { addDays, addUnit, toDate, toISO } from '../../lib/dates'
import { STATUS_META, SignalToken, sig, sigAlpha } from '../../lib/ui'
import { useStore } from '../../store/useStore'
import { useT } from '../../lib/useT'

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

// Phase bar thickness by hierarchy level: 0 = top, 1 = child, 2 = grandchild+.
// Differences shrink with depth (0→1 gap > 1→2 gap).
const BAR_H = [40, 20, 12]

export function TaskBar({ row, timeline, rowH }: { row: RowTask; timeline: Timeline; rowH: number }) {
  const t = useT()
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

  // A to-do has no schedule, so it has no position on the timeline. The
  // timeline area is deliberately left empty for it rather than pinning a
  // placeholder at x=0, which would imply a date it doesn't have. (After all
  // hooks, so the hook order stays stable across rows.)
  if (row.task.isTodo) return null

  // Clamped phase-bar bounds, clipped to the visible date range.
  const barLeft = Math.max(0, startX)
  const barRight = Math.min(timeline.totalWidth, endX)

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
      origLeft: barLeft,
      origWidth: barRight - barLeft,
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
    const fadeColor = sigAlpha(meta.token, 0.3)
    return (
      <div
        ref={barRef}
        className="absolute cursor-grab active:cursor-grabbing select-none"
        style={{
          left: gLeft,
          width: gWidth,
          top: 0,
          height: rowH,
          background: `linear-gradient(to right, ${sig(meta.token)}, ${fadeColor})`,
          zIndex: 10,
        }}
        onPointerDown={begin('move')}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onClick={onClickBar}
        title={t('gantt.ongoingTitle', { wbs: row.wbs, name: row.task.name })}
      >
        {/* start marker */}
        <div className="absolute inset-y-0 left-0 w-[2px]" style={{ background: sig(meta.token) }} />
        {/* label */}
        <div
          className="absolute inset-0 flex items-center px-2 text-[10px] text-fg truncate pointer-events-none"
          style={{ textShadow: 'var(--c-bar-shadow)' }}
        >
          {row.task.name}
        </div>
        {/* ongoing hint */}
        <span className="absolute inset-y-0 right-1.5 flex items-center text-[11px] pointer-events-none" style={{ color: fadeColor }}>→</span>
      </div>
    )
  }

  const isPaused = row.task.paused
  const barH = BAR_H[Math.min(row.depth, 2)]
  const top = (rowH - barH) / 2
  // A paused bar is drawn in the "not started" grey rather than its own status
  // colour — the pause is the fact worth showing, and the status is still on the
  // row's left-hand side.
  const barToken: SignalToken = isPaused ? 'not-started' : meta.token

  // A pause/resume splits the bar into two (or more) segments: each active
  // (non-paused) interval becomes one segment, the paused gap is left empty.
  const segs: { left: number; width: number }[] = []
  const segX = (iso: string) => Math.max(0, dateToX(toDate(iso), timeline))
  const segEnd = (iso: string) => Math.min(timeline.totalWidth, dateToX(addDays(toDate(iso), 1), timeline))
  const pushSeg = (s: string | null, e: string) => {
    if (!s || e < s) return
    const l = segX(s)
    const r = segEnd(e)
    if (r > l) segs.push({ left: l, width: r - l })
  }
  {
    let cur: string | null = row.task.startDate
    for (const p of row.task.pauses) {
      pushSeg(cur, p.pauseDate)
      cur = p.resumeDate
    }
    if (row.task.paused && row.task.pauseDate) pushSeg(cur, row.task.pauseDate)
    else if (row.task.endDate) pushSeg(cur, row.task.endDate)
  }

  if (segs.length === 0) return null

  const fill = (w: number) => (
    <div className="absolute inset-y-0 left-0" style={{ width: `${row.eff.progress ?? 0}%`, background: sig(barToken), opacity: isParent ? 0.5 : 0.85 }} />
  )

  // Single uninterrupted segment: fully interactive (drag + resize).
  if (segs.length === 1 && !isPaused) {
    const { left, width } = segs[0]
    return (
      <div
        ref={barRef}
        className="absolute rounded-[2px] border cursor-grab active:cursor-grabbing overflow-hidden select-none"
        style={{ left, width, top, height: barH, background: sigAlpha(barToken, 0.16), borderColor: sig(barToken), zIndex: 10 }}
        onPointerDown={begin('move')}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onClick={onClickBar}
        title={`${row.wbs} ${row.task.name}`}
      >
        {fill(width)}
        {!isParent && width > 44 && (
          <div
            className="absolute inset-0 flex items-center px-1.5 text-[10px] text-fg truncate pointer-events-none"
            style={{ textShadow: 'var(--c-bar-shadow)' }}
          >
            {row.task.name}
          </div>
        )}
        {!isParent && (
          <>
            <div onPointerDown={begin('start')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" style={{ zIndex: 2 }} />
            <div onPointerDown={begin('end')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" style={{ zIndex: 2 }} />
          </>
        )}
      </div>
    )
  }

  // Paused (single gray segment) or resumed (multiple segments): static bars.
  return (
    <>
      {segs.map((seg, i) => (
        <div
          key={i}
          className="absolute rounded-[2px] border overflow-hidden select-none"
          style={{ left: seg.left, width: seg.width, top, height: barH, background: sigAlpha(barToken, 0.16), borderColor: sig(barToken), zIndex: 10 }}
          onClick={onClickBar}
          title={`${row.wbs} ${row.task.name}`}
        >
          {fill(seg.width)}
        </div>
      ))}
    </>
  )
}

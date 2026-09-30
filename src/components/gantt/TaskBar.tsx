import { useMemo } from 'react'
import type { MouseEvent } from 'react'
import { RowTask } from '../../lib/tree'
import { Timeline, dateToX } from '../../lib/timeline'
import { addDays, toDate } from '../../lib/dates'
import { STATUS_META, SignalToken, sig, sigAlpha } from '../../lib/ui'
import { useStore } from '../../store/useStore'
import { useT } from '../../lib/useT'

// Phase bar thickness by hierarchy level: 0 = top, 1 = child, 2 = grandchild+.
// Differences shrink with depth (0→1 gap > 1→2 gap).
const BAR_H = [40, 20, 12]

export function TaskBar({ row, timeline, rowH }: { row: RowTask; timeline: Timeline; rowH: number }) {
  const t = useT()
  const setSelected = useStore((s) => s.setSelected)

  const isGoal = row.task.type === 'long-term'
  const isParent = row.hasKids
  const meta = STATUS_META[row.eff.status]

  // Continuous x position of the start (and, for phases, the exclusive end).
  const startX = useMemo(() => {
    if (row.eff.start == null) return 0
    return dateToX(toDate(row.eff.start), timeline)
  }, [row.eff.start, timeline])

  // A to-do has no schedule, so it has no position on the timeline. The
  // timeline area is deliberately left empty for it rather than pinning a
  // placeholder at x=0, which would imply a date it doesn't have. (After all
  // hooks, so the hook order stays stable across rows.)
  if (row.task.isTodo) return null

  const onClickBar = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setSelected(row.id)
  }

  if (isGoal) {
    if (row.eff.start == null) return null
    const gLeft = Math.max(0, startX)
    const gWidth = timeline.totalWidth - gLeft
    if (gWidth <= 0) return null
    const fadeColor = sigAlpha(meta.token, 0.3)
    return (
      <div
        className="absolute select-none"
        style={{
          left: gLeft,
          width: gWidth,
          top: 0,
          height: rowH,
          background: `linear-gradient(to right, ${sig(meta.token)}, ${fadeColor})`,
          zIndex: 10,
        }}
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
    else {
      // The end the task actually reached. For everything unfinished that is
      // the stored `endDate` — `effectiveStates` hands the same value straight
      // back — and for a finished task it is the day it finished, which is the
      // whole point of drawing this from `eff` rather than from the field. The
      // bar is the picture, so it is the picture that has to move.
      const end = row.eff.end ?? row.task.endDate
      if (end) pushSeg(cur, end)
    }
  }

  if (segs.length === 0) return null

  const fill = (w: number) => (
    <div className="absolute inset-y-0 left-0" style={{ width: `${row.eff.progress ?? 0}%`, background: sig(barToken), opacity: isParent ? 0.5 : 0.85 }} />
  )

  // Single uninterrupted segment: the one shape that can carry its own name.
  if (segs.length === 1 && !isPaused) {
    const { left, width } = segs[0]
    return (
      <div
        className="absolute rounded-[2px] border overflow-hidden select-none"
        style={{ left, width, top, height: barH, background: sigAlpha(barToken, 0.16), borderColor: sig(barToken), zIndex: 10 }}
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

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, MouseEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Flag, Pencil, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import {
  MINUTES_PER_DAY,
  blocksOn,
  resizeEdge,
  capacityOf,
  dayLoad,
  dragSpan,
  loadRead,
  minutesOf,
  nextFreeStart,
  packBlocks,
  plannedIds,
  planOn,
  toHHMM,
} from '../lib/schedule'
import { daySummary } from '../lib/dayTasks'
import { coursesOn } from '../lib/courseSheet'
import { routineRows } from '../lib/habits'
import { plannedFor, todaysChores } from '../lib/chores'
import { isWeekend, toDate, toISO } from '../lib/dates'
import type { CourseSession, ScheduleBlock } from '../types'
import { formatShortDate, weekdayName } from '../lib/i18n'
import { sig } from '../lib/ui'
import { useLang, useT } from '../lib/useT'
import { LoadMeter } from './LoadMeter'
import { ScheduleBlockDialog, ScheduleDraft } from './ScheduleBlockDialog'
import { CourseDialog } from './CourseDialog'
import type { ScheduleItem } from './ScheduleBlockDialog'

const GUTTER = 46
const ITEM_DND = 'application/x-day-item'

/**
 * One hue per block kind, so a glance separates a task from a routine, a chore
 * and a free event. Deliberately none of the status signals: those keep their
 * own meaning on the same screen.
 */
const KIND_COLOR = {
  task: 'rgb(var(--c-accent))',
  habit: '#14b8a6',
  chore: '#84cc16',
  event: '#8b5cf6',
} as const

/** Imported classes: a fixed fact, so a quiet steel rather than an action hue. */
const COURSE_TINT = '#64748b12'

/**
 * One piece of today's work that has not been given a time yet.
 *
 * Assembled from the day's own list (planned tasks, routines that run, chores
 * due), minus whatever already has a block linked to it. The strip is a
 * planning companion rather than a second list: every item in it is something
 * the day already says is on.
 */
interface StripItem {
  kind: 'task' | 'habit' | 'chore'
  id: string
  title: string
  /** Default block length, from the plan's hours or the routine's own answer. */
  minutes: number
  projectId?: string
}

/**
 * A vertical 24-hour grid, for one day or for a week.
 *
 * The two views are the same drawing with a different column count — building
 * a second one for the week would be two answers to where a block sits and how
 * a load reads. A single day gets more room per hour; the week fits seven.
 *
 * Interaction is press-and-drag to claim a span of the day, a plain click to
 * start one at that half-hour, and a click on a block to edit it. Moving an
 * existing block is still a later feature.
 */
export function Timetable({ days, className = '' }: { days: string[]; className?: string }) {
  const t = useT()
  const lang = useLang()
  const today = useStore((s) => s.today)
  const blocks = useStore((s) => s.scheduleBlocks)
  const plans = useStore((s) => s.dayPlans)
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const logs = useStore((s) => s.logs)
  const daySort = useStore((s) => s.daySort)
  const habits = useStore((s) => s.habits)
  const chores = useStore((s) => s.chores)
  const defaultHours = useStore((s) => s.taskDefaultHours)
  const courses = useStore((s) => s.courses)
  const semesterStart = useStore((s) => s.semesterStart)
  const setDayCapacity = useStore((s) => s.setDayCapacity)
  const updateScheduleBlock = useStore((s) => s.updateScheduleBlock)
  const addScheduleBlock = useStore((s) => s.addScheduleBlock)

  const [draft, setDraft] = useState<ScheduleDraft | null>(null)
  /** Right-click menu: a class edits itself, a block starts a second one. */
  const [menu, setMenu] = useState<
    | { kind: 'course'; x: number; y: number; course: CourseSession }
    | { kind: 'block'; x: number; y: number; block: ScheduleBlock }
    | null
  >(null)
  const [editingCourse, setEditingCourse] = useState<CourseSession | null>(null)
  const [now, setNow] = useState(() => new Date())
  /** The half-hour slot under the pointer, for the hover band. */
  const [hover, setHover] = useState<{ date: string; minutes: number } | null>(null)
  /** The span being dragged out, anchored where the press landed. */
  const [drag, setDrag] = useState<{ date: string; anchor: number; cursor: number } | null>(null)
  /** The chip being dragged in from the day's work, and where it would land. */
  const [dragItem, setDragItem] = useState<StripItem | null>(null)
  const [dropAt, setDropAt] = useState<{ date: string; minutes: number } | null>(null)
  /** The block whose top or bottom edge is being pulled, in preview. */
  const [resize, setResize] = useState<{
    id: string
    edge: 'start' | 'end'
    start: number
    end: number
  } | null>(null)
  /** The block being moved by its body, in preview. */
  const [move, setMove] = useState<{
    id: string
    start: number
    end: number
    pressX: number
    pressY: number
    originStart: number
    duration: number
    /** Decided on the first real movement: up/down changes time, left/right lanes. */
    mode: 'undecided' | 'time' | 'lane'
    dx: number
    lane: number
    laneCount: number
    dayBlocks: ScheduleBlock[]
    laneOf: Map<string, { lane: number; lanes: number }>
  } | null>(null)
  /** Set by a release that actually changed the time, so the click is not an edit. */
  const movedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const single = days.length === 1
  const soleDay = single ? days[0] : null

  /**
   * The day's work that has no block yet — the strip above the grid.
   *
   * Gated on a plan: before the day is planned the list is still "everything
   * that happens to be active", and the strip would be a second copy of the
   * day board rather than a partner to the plan. Routines and chores are in it
   * because the day's plan is not the whole of the day's work.
   */
  const strip = useMemo<StripItem[]>(() => {
    if (soleDay == null) return []
    const plan = planOn(plans, soleDay)
    const planned = plannedIds(plan)
    if (planned === undefined) return []

    const taken = { task: new Set<string>(), habit: new Set<string>(), chore: new Set<string>() }
    for (const block of blocksOn(blocks, soleDay)) {
      if (block.taskId) taken.task.add(block.taskId)
      if (block.habitId) taken.habit.add(block.habitId)
      if (block.choreId) taken.chore.add(block.choreId)
    }

    const out: StripItem[] = []
    for (const row of daySummary(tasks, logs, projects, soleDay, today, daySort, planned).all) {
      if (row.status === 'completed' || taken.task.has(row.task.id)) continue
      const hours = plan?.hours?.[row.task.id] ?? defaultHours[row.task.id]
      out.push({
        kind: 'task',
        id: row.task.id,
        title: row.task.name,
        minutes: hours != null && hours > 0 ? Math.max(5, Math.round(hours * 60)) : 60,
        projectId: row.task.projectId,
      })
    }
    for (const row of routineRows(habits, soleDay)) {
      if (row.hasKids || row.done || taken.habit.has(row.habit.id)) continue
      out.push({
        kind: 'habit',
        id: row.habit.id,
        title: row.habit.title,
        minutes: row.habit.durationMinutes ?? 30,
      })
    }
    const dayChores = soleDay <= today ? todaysChores(chores, today) : plannedFor(chores, soleDay)
    for (const chore of dayChores) {
      if (chore.done || taken.chore.has(chore.id)) continue
      out.push({ kind: 'chore', id: chore.id, title: chore.title, minutes: 30 })
    }
    return out
  }, [soleDay, plans, tasks, logs, projects, today, daySort, blocks, habits, chores, defaultHours])

  /** Open the block dialog for a strip item, at a slot or at the first free one. */
  const beginItem = (item: StripItem, day: string, startMin?: number) => {
    const from = startMin ?? (minutesOf(nextFreeStart(blocksOn(blocks, day), item.minutes)) ?? 8 * 60)
    setDraft({
      kind: 'new',
      date: day,
      start: toHHMM(from),
      end: toHHMM(Math.min(MINUTES_PER_DAY - 1, from + item.minutes)),
      ...(item.kind === 'task'
        ? { taskId: item.id }
        : { item: { kind: item.kind, id: item.id, title: item.title } as ScheduleItem }),
    })
  }

  /**
   * A drop places the block directly. The dialog belongs to a click, where
   * there is no position to keep; a drop already said where and how long, and
   * the edges can change it afterwards.
   */
  const dropItem = (day: string, e: DragEvent<HTMLDivElement>) => {
    const raw = e.dataTransfer.getData(ITEM_DND)
    if (!raw) return
    e.preventDefault()
    setDropAt(null)
    setDragItem(null)
    let item: StripItem
    try {
      item = JSON.parse(raw) as StripItem
    } catch {
      return // not one of ours
    }
    const start = slotAt(e)
    const end = Math.min(MINUTES_PER_DAY - 1, start + item.minutes)
    if (end <= start) return
    addScheduleBlock({
      date: day,
      start: toHHMM(start),
      end: toHHMM(end),
      title: item.title,
      ...(item.kind === 'task' ? { taskId: item.id } : {}),
      ...(item.kind === 'habit' ? { habitId: item.id } : {}),
      ...(item.kind === 'chore' ? { choreId: item.id } : {}),
    })
  }

  // The single-day view is a calendar, not a strip: 44px an hour, scrolled to
  // 7:00, so the working day fills the pane and the night hours are a scroll
  // away. The week is a macro read, so it keeps a smaller scale and the whole
  // day in view.
  const hourH = single ? 44 : 32
  const bodyH = 24 * hourH
  const template = `${GUTTER}px repeat(${days.length}, minmax(${single ? 0 : 96}px, 1fr))`

  useEffect(() => {
    if (!scrollRef.current) return
    // The day opens on the working morning; the week is a whole-day picture.
    scrollRef.current.scrollTop = single ? 7 * hourH : 0
  }, [hourH, single])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  /** The half-hour boundary at `clientY` inside a column, from its geometry. */
  const slotIn = (rect: DOMRect, clientY: number) => {
    const ratio = (clientY - rect.top) / rect.height
    return Math.max(0, Math.min(23 * 60 + 30, Math.floor((ratio * 1440) / 30) * 30))
  }

  /** The half-hour boundary under the pointer, from the column's own geometry. */
  const slotAt = (e: MouseEvent<HTMLDivElement>) =>
    slotIn(e.currentTarget.getBoundingClientRect(), e.clientY)

  // Pulling a block's edge. The pointer is captured by the handle, so the
  // release still arrives after the cursor leaves the block; the preview lives
  // in `resize` until then and nothing is written mid-drag.
  const beginResize = (block: ScheduleBlock, edge: 'start' | 'end', e: PointerEvent<HTMLSpanElement>) => {
    if (block.deadline) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setResize({
      id: block.id,
      edge,
      start: minutesOf(block.start) ?? 0,
      end: minutesOf(block.end) ?? 0,
    })
  }

  const moveResize = (e: PointerEvent<HTMLSpanElement>) => {
    if (!resize) return
    const column = (e.currentTarget as HTMLElement).closest('[data-day]')
    if (!column) return
    const minutes = slotIn(column.getBoundingClientRect(), e.clientY)
    setResize((r) => {
      if (!r) return r
      const next = resizeEdge(r.start, r.end, r.edge, minutes)
      return next.start === r.start && next.end === r.end ? r : { ...r, ...next }
    })
  }

  const endResize = (e: PointerEvent<HTMLSpanElement>) => {
    if (!resize) return
    // The release's own position is the last word: the preview's last render
    // may not have landed before the pointer went up.
    const column = (e.currentTarget as HTMLElement).closest('[data-day]')
    const at = column ? slotIn(column.getBoundingClientRect(), e.clientY) : null
    const next = at == null ? resize : resizeEdge(resize.start, resize.end, resize.edge, at)
    updateScheduleBlock(resize.id, { start: toHHMM(next.start), end: toHHMM(next.end) })
    setResize(null)
  }

  // Moving a block by its body. The press remembers where in the block the
  // pointer landed, so the block follows the cursor instead of jumping its top
  // to it; the release recomputes from the pointer's own position, so the last
  // move cannot be lost to a render that never landed.
  const beginMove = (
    block: ScheduleBlock,
    laneInfo: { lane: number; lanes: number },
    dayBlocks: ScheduleBlock[],
    laneOf: Map<string, { lane: number; lanes: number }>,
    e: PointerEvent<HTMLButtonElement>,
  ) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const start = minutesOf(block.start) ?? 0
    const end = minutesOf(block.end) ?? 0
    movedRef.current = false
    setMove({
      id: block.id,
      start,
      end,
      pressX: e.clientX,
      pressY: e.clientY,
      originStart: start,
      duration: end - start,
      mode: 'undecided',
      dx: 0,
      lane: laneInfo.lane,
      laneCount: laneInfo.lanes,
      dayBlocks,
      laneOf,
    })
  }

  // A few pixels of jitter on a click must not become a half-hour move; only a
  // deliberate pull counts as a slot.
  const movedSlots = (clientY: number, m: { pressY: number }) =>
    Math.abs(clientY - m.pressY) < 6 ? 0 : Math.round((clientY - m.pressY) / (hourH / 2))

  /** Stop the click that follows a gesture from opening the editor. */
  const swallowClick = () => {
    movedRef.current = true
    window.setTimeout(() => {
      movedRef.current = false
    }, 0)
  }

  const previewMove = (e: PointerEvent<HTMLButtonElement>) => {
    setMove((m) => {
      if (!m) return m
      const dx = e.clientX - m.pressX
      const dy = e.clientY - m.pressY
      if (m.mode === 'undecided') {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return m
        // The first real movement picks the gesture: sideways is a lane swap,
        // up/down is a time move.
        if (Math.abs(dx) > Math.abs(dy)) return { ...m, mode: 'lane', dx }
        const start = Math.max(
          0,
          Math.min(MINUTES_PER_DAY - 1 - m.duration, m.originStart + movedSlots(e.clientY, m) * 30),
        )
        return { ...m, mode: 'time', start, end: start + m.duration }
      }
      if (m.mode === 'lane') return dx === m.dx ? m : { ...m, dx }
      const start = Math.max(
        0,
        Math.min(MINUTES_PER_DAY - 1 - m.duration, m.originStart + movedSlots(e.clientY, m) * 30),
      )
      return start === m.start ? m : { ...m, start, end: start + m.duration }
    })
  }

  const endMove = (e: PointerEvent<HTMLButtonElement>) => {
    const m = move
    if (!m) return

    if (m.mode === 'lane') {
      // Swapping with the overlapping block in the next lane is enough: the
      // user is choosing left from right, not assigning absolute columns.
      const target = m.lane + (m.dx < 0 ? -1 : 1)
      const dragged = m.dayBlocks.find((block) => block.id === m.id)
      let neighbor: ScheduleBlock | undefined
      if (dragged && target >= 0 && target < m.laneCount) {
        const start = minutesOf(dragged.start) ?? 0
        const end = minutesOf(dragged.end) ?? 0
        neighbor = m.dayBlocks.find((block) => {
          if (block.id === m.id || (m.laneOf.get(block.id)?.lane ?? -1) !== target) return false
          const otherStart = minutesOf(block.start) ?? 0
          const otherEnd = minutesOf(block.end) ?? 0
          return start < otherEnd && otherStart < end
        })
      }
      swallowClick()
      if (neighbor) {
        updateScheduleBlock(m.id, { laneOrder: target })
        updateScheduleBlock(neighbor.id, { laneOrder: m.lane })
      }
      setMove(null)
      return
    }

    const start = Math.max(
      0,
      Math.min(MINUTES_PER_DAY - 1 - m.duration, m.originStart + movedSlots(e.clientY, m) * 30),
    )
    if (start !== m.originStart) {
      swallowClick()
      updateScheduleBlock(m.id, { start: toHHMM(start), end: toHHMM(start + m.duration) })
    }
    setMove(null)
  }

  const hoverAt = (day: string, e: MouseEvent<HTMLDivElement>) => {
    // Over a block, the block is the thing being pointed at — its own hover
    // state says so, and the half-hour band under it would be a second answer.
    if ((e.target as HTMLElement).closest('button')) {
      setHover((h) => (h?.date === day ? null : h))
      return
    }
    const minutes = slotAt(e)
    setHover((h) => (h?.date === day && h.minutes === minutes ? h : { date: day, minutes }))
  }

  // A press starts a span; the pointer is captured so the release still lands
  // on this column even when the cursor has left it, and the dialog opens on
  // release with the two ends the drag picked. A press and release in the same
  // slot is the old click — one block, one hour by default.
  const beginDrag = (day: string, e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // A block is its own target; a drag begun on one would open a second
    // dialog behind the editor its click is about to open.
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const minutes = slotAt(e)
    setDrag({ date: day, anchor: minutes, cursor: minutes })
  }

  const moveDrag = (day: string, e: PointerEvent<HTMLDivElement>) => {
    hoverAt(day, e)
    const minutes = slotAt(e)
    setDrag((d) => (d && d.date === day && d.cursor !== minutes ? { ...d, cursor: minutes } : d))
  }

  const endDrag = (day: string, e: PointerEvent<HTMLDivElement>) => {
    const d = drag
    if (!d || d.date !== day) return
    setDrag(null)
    const span = dragSpan(d.anchor, slotAt(e))
    setDraft({
      kind: 'new',
      date: day,
      start: toHHMM(span.start),
      ...(span.end != null ? { end: toHHMM(span.end) } : {}),
    })
  }

  const nowIso = toISO(now)
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * hourH
  const hoveredHour = hover ? Math.floor(hover.minutes / 60) : -1
  const line = 'rgb(var(--c-line) / 0.55)'
  const half = 'rgb(var(--c-line) / 0.22)'
  const hourLines = {
    backgroundImage: [
      `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourH - 1}px, ${line} ${hourH - 1}px, ${line} ${hourH}px)`,
      ...(single
        ? [
            `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourH / 2 - 1}px, ${half} ${hourH / 2 - 1}px, ${half} ${hourH / 2}px)`,
          ]
        : []),
    ].join(', '),
  }

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {/* The day's work that has no time yet. Above the grid rather than
          inside it: nothing is placed until the user says when, and a chip
          dragged onto a column lands as a real block. */}
      {strip.length > 0 && (
        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/60 bg-panel2/25 overflow-x-auto">
          <span className="shrink-0 mr-0.5 text-[10px] uppercase tracking-wider text-dim">
            {t('schedule.unscheduled')}
          </span>
          {strip.map((item) => {
            const project = item.projectId ? projects.find((p) => p.id === item.projectId) : undefined
            return (
              <button
                key={`${item.kind}:${item.id}`}
                draggable
                onClick={() => soleDay != null && beginItem(item, soleDay)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(ITEM_DND, JSON.stringify(item))
                  e.dataTransfer.effectAllowed = 'copy'
                  setDragItem(item)
                }}
                onDragEnd={() => {
                  setDragItem(null)
                  setDropAt(null)
                }}
                title={item.title}
                className="shrink-0 inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-border/70 bg-panel2/60 text-[11px] text-fg/90 hover:border-accent/50 hover:bg-panel2 cursor-grab active:cursor-grabbing"
              >
                {project && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: project.color }} />
                )}
                <span className="max-w-[10rem] truncate">{item.title}</span>
                <span className="shrink-0 font-mono text-[9px] text-dim">
                  {t('time.minutes', { count: item.minutes })}
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div style={{ minWidth: single ? undefined : GUTTER + days.length * 96 }}>
          {/* Header. Inside the scroll box so it travels with the columns
              horizontally, and sticky so the dates stay put vertically. */}
          <div
            className="sticky top-0 z-20 grid bg-panel/95 backdrop-blur-sm border-b border-border/70"
            style={{ gridTemplateColumns: template }}
          >
            <div className="sticky left-0 z-30 bg-panel" />
            {days.map((day) => {
              const plan = planOn(plans, day)
              const load = dayLoad(plan, blocks, day)
              const planned = plannedIds(plan) ?? []
              const estimated = planned.filter((id) => (plan?.hours?.[id] ?? 0) > 0).length
              const read = loadRead(capacityOf(plan), estimated, planned.length)
              const weekend = isWeekend(toDate(day))
              const isToday = day === today
              return (
                <div
                  key={day}
                  className={`px-2 pt-2 pb-1.5 border-l border-line/70 transition-shadow ${
                    isToday ? 'bg-accent/[0.045]' : weekend ? 'bg-stripe/20' : ''
                  } ${hover?.date === day ? 'ring-1 ring-inset ring-accent/25' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-1 text-[10px]">
                    <span className={`truncate font-medium ${isToday ? 'text-today' : 'text-muted'}`}>
                      {weekdayName(lang, toDate(day).getDay())}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] text-dim">{formatShortDate(lang, toDate(day))}</span>
                  </div>
                  <LoadMeter
                    className="mt-1.5"
                    used={load.used}
                    capacity={plan?.capacityHours ?? null}
                    read={read}
                    onCapacity={(hours) => setDayCapacity(day, hours ?? 0)}
                    compact={!single}
                  />
                </div>
              )
            })}
          </div>

          {/* Body. */}
          <div className="grid" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-20 bg-panel relative" style={{ height: bodyH }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className={`absolute right-1.5 font-mono transition-colors ${
                    h === hoveredHour ? 'text-fg' : 'text-dim/80'
                  } ${single ? 'text-[10px]' : 'text-[9px]'}`}
                  style={{ top: h === 0 ? 0 : h * hourH - 6 }}
                >
                  {toHHMM(h * 60)}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayBlocks = blocksOn(blocks, day)
              // Courses are blocks too: they take a lane, so a task created at
              // the same time sits beside the class instead of covering it.
              const dayCourses = coursesOn(courses, day, semesterStart).map((course, i) => ({
                course,
                key: `course:${day}:${course.week}:${course.weekday}:${course.start}:${i}`,
              }))
              const lanes = packBlocks([
                ...dayBlocks,
                ...dayCourses.map(({ course, key }) => ({
                  id: key,
                  date: day,
                  start: course.start,
                  end: course.end,
                  title: course.title,
                })),
              ])
              const weekend = isWeekend(toDate(day))
              const isToday = day === today
              return (
                <div
                  key={day}
                  data-day={day}
                  onPointerDown={(e) => beginDrag(day, e)}
                  onPointerMove={(e) => moveDrag(day, e)}
                  onPointerUp={(e) => endDrag(day, e)}
                  onPointerCancel={() => setDrag(null)}
                  onMouseLeave={() => setHover((h) => (h?.date === day ? null : h))}
                  onDragOver={(e) => {
                    // Only our own chips may drop; the grid's pointer drag is a
                    // different gesture and must not turn into a native drop.
                    if (!e.dataTransfer.types.includes(ITEM_DND)) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                    const minutes = slotAt(e)
                    setDropAt((d) => (d?.date === day && d.minutes === minutes ? d : { date: day, minutes }))
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
                    setDropAt((d) => (d?.date === day ? null : d))
                  }}
                  onDrop={(e) => dropItem(day, e)}
                  className={`relative border-l border-line/60 cursor-crosshair ${
                    isToday ? 'bg-accent/[0.035]' : weekend ? 'bg-stripe/15' : ''
                  }`}
                  style={{ height: bodyH, ...hourLines }}
                >
                  {/* The imported timetable's own blocks: a class is a fixed
                      fact, so these stay dashed and take no pointer events —
                      clicking their slot still opens "new block", and the
                      lane packing keeps the new task beside the class.
                      `schedule.kind.course` is what this kind is called. */}
                  {dayCourses.map(({ course, key }) => {
                    const start = minutesOf(course.start) ?? 0
                    const end = minutesOf(course.end) ?? 0
                    const top = (start / 60) * hourH
                    const height = Math.max(14, ((end - start) / 60) * hourH - 1)
                    const lane = lanes.get(key) ?? { lane: 0, lanes: 1 }
                    const width = 100 / lane.lanes
                    const full = [course.title, course.location, course.note].filter(Boolean).join(' · ')
                    return (
                      <div
                        key={key}
                        className="absolute z-[1] overflow-hidden rounded-lg border border-dashed border-border px-2 py-1 text-[10px] font-medium leading-tight text-fg/80"
                        style={{
                          top,
                          height,
                          left: `calc(${lane.lane * width}% + 1px)`,
                          width: `calc(${width}% - 2px)`,
                          background: COURSE_TINT,
                        }}
                        title={`${t('schedule.kind.course')} · ${full}`}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setMenu({ kind: 'course', x: e.clientX, y: e.clientY, course })
                        }}
                      >
                        <div className="truncate">{course.title}</div>
                        {height >= 26 && course.location && (
                          <div className="truncate text-[9px] font-normal text-dim">{course.location}</div>
                        )}
                      </div>
                    )
                  })}

                  {/* The span being dragged out. It replaces the half-hour hint
                      while the pointer is down, because that is what the release
                      will create. */}
                  {drag?.date === day ? (
                    (() => {
                      const lo = Math.min(drag.anchor, drag.cursor)
                      const hi = Math.max(drag.anchor, drag.cursor)
                      const span = hi > lo ? hi - lo : 30
                      return (
                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-x-1 z-[5] rounded-md border border-accent/40 bg-accent/15"
                          style={{ top: (lo / 60) * hourH, height: (span / 60) * hourH }}
                        />
                      )
                    })()
                  ) : hover?.date === day ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-1 z-[5] rounded-md border-y border-accent/25 bg-accent/[0.06]"
                      style={{ top: (hover.minutes / 60) * hourH, height: hourH / 2 }}
                    />
                  ) : null}

                  {/* Where a chip from the day's work would land. Same length
                      as the block it will make, so the drop is a placement
                      rather than a guess. */}
                  {dragItem && dropAt?.date === day && (() => {
                    const top = (dropAt.minutes / 60) * hourH
                    const height = Math.min(bodyH - top, Math.max(14, (dragItem.minutes / 60) * hourH - 1))
                    return (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-1 z-[6] rounded-lg border-2 border-dashed border-accent/70 bg-accent/15"
                        style={{ top, height }}
                      />
                    )
                  })()}

                  {(() => {
                    const laneTarget =
                      move?.mode === 'lane'
                        ? (() => {
                            const dragged = dayBlocks.find((b) => b.id === move.id)
                            if (!dragged) return null
                            const target = move.lane + (move.dx < 0 ? -1 : 1)
                            if (target < 0 || target >= move.laneCount) return null
                            return {
                              id: move.id,
                              target,
                              start: minutesOf(dragged.start) ?? 0,
                              end: minutesOf(dragged.end) ?? 0,
                            }
                          })()
                        : null
                    return dayBlocks.map((block) => {
                    const isLaneTarget =
                      !!laneTarget &&
                      block.id !== laneTarget.id &&
                      (lanes.get(block.id)?.lane ?? -1) === laneTarget.target &&
                      laneTarget.start < (minutesOf(block.end) ?? 0) &&
                      (minutesOf(block.start) ?? 0) < laneTarget.end
                    const live =
                      resize?.id === block.id ? resize : move?.id === block.id ? move : null
                    const startMin = live?.start ?? minutesOf(block.start) ?? 0
                    const endMin = live?.end ?? minutesOf(block.end) ?? 0
                    const top = (startMin / 60) * hourH
                    const task = block.taskId ? tasks.find((x) => x.id === block.taskId) : undefined
                    const project = task ? projects.find((p) => p.id === task.projectId) : undefined
                    // The block's own title wins; the task name is the fallback
                    // for a row stored without one (an import, or a task deleted
                    // before the title was filled in). A default title still
                    // follows a rename — see `updateTask`.
                    const label = block.title || task?.name || ''

                    if (block.deadline) {
                      return (
                        <button
                          key={block.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDraft({ kind: 'edit', block })
                          }}
                          className="group absolute inset-x-0 z-20 h-[16px] flex items-center gap-1 text-left"
                          style={{ top: Math.max(0, Math.min(bodyH - 16, top - 8)) }}
                          title={`${label} · ${block.start}`}
                        >
                          <span className="h-px flex-1" style={{ background: 'rgb(var(--c-fg) / 0.28)' }} />
                          <span className="inline-flex max-w-[75%] items-center gap-1 rounded-full border border-border/70 bg-panel px-1.5 py-0.5 text-[9px] text-muted shadow-sm transition-colors group-hover:border-accent/40 group-hover:text-fg">
                            <Flag size={8} className="shrink-0" />
                            <span className="truncate">{label}</span>
                          </span>
                        </button>
                      )
                    }

                    const lane = lanes.get(block.id) ?? { lane: 0, lanes: 1 }
                    const width = 100 / lane.lanes
                    const height = Math.max(14, ((endMin - startMin) / 60) * hourH - 1)
                    const projectColor =
                      project && /^#[0-9a-f]{6}$/i.test(project.color) ? project.color : null
                    const kind = block.habitId
                      ? 'habit'
                      : block.choreId
                        ? 'chore'
                        : block.taskId
                          ? 'task'
                          : 'event'
                    const accent = projectColor ?? KIND_COLOR[kind]
                    // The kind lives on the left bar; the fill only hints at it,
                    // so a day of mixed blocks does not read as a colour chart.
                    const tint = projectColor
                      ? `${projectColor}1a`
                      : kind === 'task'
                        ? 'rgb(var(--c-accent) / 0.08)'
                        : `${accent}14`
                    return (
                      <button
                        key={block.id}
                        onPointerDown={(e) =>
                          beginMove(block, lanes.get(block.id) ?? { lane: 0, lanes: 1 }, dayBlocks, lanes, e)
                        }
                        onPointerMove={previewMove}
                        onPointerUp={endMove}
                        onPointerCancel={() => setMove(null)}
                        onClick={(e) => {
                          e.stopPropagation()
                          // A release that moved the block is not a request to
                          // edit it; the time change has already been written.
                          if (movedRef.current) {
                            movedRef.current = false
                            return
                          }
                          setDraft({ kind: 'edit', block })
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setMenu({ kind: 'block', x: e.clientX, y: e.clientY, block })
                        }}
                        className={`group absolute select-none overflow-hidden rounded-lg border border-border bg-panel2 text-left px-2 py-1 font-medium leading-tight text-fg shadow-sm transition-shadow hover:shadow-md hover:brightness-110 hover:ring-2 hover:ring-accent/50 active:cursor-grabbing ${
                          single ? 'text-[11px]' : 'text-[10px]'
                        } ${move?.id === block.id ? 'cursor-grabbing shadow-lg ring-2 ring-accent/60' : 'cursor-grab'} ${
                          isLaneTarget ? 'ring-2 ring-accent/60' : ''
                        } border-l-[3px]`}
                        style={{
                          top,
                          height,
                          // Above its neighbours while it is being moved.
                          zIndex: move?.id === block.id ? 30 : 10,
                          // Sideways drag previews as a horizontal slide; the
                          // swap itself lands on release.
                          transform:
                            move?.id === block.id && move.mode === 'lane'
                              ? `translateX(${move.dx}px)`
                              : undefined,
                          left: `calc(${lane.lane * width}% + 1px)`,
                          width: `calc(${width}% - 2px)`,
                          background: tint,
                          borderLeftColor: accent,
                        }}
                        title={`${label} · ${toHHMM(startMin)}–${toHHMM(endMin)}`}
                      >
                        <div className="truncate">{label}</div>
                        {height >= 28 && (
                          <div className="truncate font-mono text-[9px] font-normal text-muted">
                            {toHHMM(startMin)}–{toHHMM(endMin)}
                          </div>
                        )}
                        {/* Edge handles: pull either end to shorten or extend
                            the block. The lines only show on hover, so a grid
                            of blocks does not read as a grid of grips. */}
                        <span
                          onPointerDown={(e) => beginResize(block, 'start', e)}
                          onPointerMove={moveResize}
                          onPointerUp={endResize}
                          onPointerCancel={() => setResize(null)}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
                        >
                          <span className="pointer-events-none absolute inset-x-1 top-0.5 h-0.5 rounded-full bg-fg/0 transition-colors group-hover:bg-fg/35" />
                        </span>
                        <span
                          onPointerDown={(e) => beginResize(block, 'end', e)}
                          onPointerMove={moveResize}
                          onPointerUp={endResize}
                          onPointerCancel={() => setResize(null)}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                        >
                          <span className="pointer-events-none absolute inset-x-1 bottom-0.5 h-0.5 rounded-full bg-fg/0 transition-colors group-hover:bg-fg/35" />
                        </span>
                      </button>
                    )
                    })
                  })()}

                  {isToday && nowIso === today && (
                    <div
                      className="absolute inset-x-0 z-20 pointer-events-none"
                      style={{ top: nowTop }}
                      aria-hidden
                    >
                      <div className="h-px" style={{ background: sig('in-progress') }} />
                      <div
                        className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                        style={{ background: sig('in-progress') }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {draft && <ScheduleBlockDialog draft={draft} onClose={() => setDraft(null)} />}
      {editingCourse && (
        <CourseDialog course={editingCourse} onClose={() => setEditingCourse(null)} />
      )}
      {menu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[69]"
              onMouseDown={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenu(null)
              }}
            />
            <div
              className="fixed z-[70] bg-panel border border-border rounded-[3px] shadow-2xl py-1"
              style={{
                left: Math.min(menu.x, window.innerWidth - 198),
                top: Math.min(menu.y, window.innerHeight - 48),
                width: 190,
              }}
            >
              {menu.kind === 'course' ? (
                <button
                  onClick={() => {
                    setEditingCourse(menu.course)
                    setMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-2.5 h-7 text-[12px] text-left text-fg/90 hover:bg-panel2"
                >
                  <Pencil size={13} />
                  {t('course.edit')}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setDraft({
                      kind: 'new',
                      date: menu.block.date,
                      start: menu.block.start,
                      end: menu.block.end,
                    })
                    setMenu(null)
                  }}
                  className="w-full flex items-center gap-2 px-2.5 h-7 text-[12px] text-left text-fg/90 hover:bg-panel2"
                >
                  <Plus size={13} />
                  {t('schedule.newBeside')}
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}

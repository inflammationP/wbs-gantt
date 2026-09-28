import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { Row, RowTask, buildRows, collectDescendants, placeTasks } from '../../lib/tree'
import { buildTimeline, dateToX, DateRange, FOCUS_OFFSET_PX } from '../../lib/timeline'
import { startOfDay, toDate } from '../../lib/dates'
import { useStore } from '../../store/useStore'
import { useLang, useT } from '../../lib/useT'
import { TimelineHeader } from './TimelineHeader'
import { GridBackground } from './GridBackground'
import { RowLeft, LeftHeader, LEFT_WIDTH, TodoActions } from './RowLeft'
import { TaskBar } from './TaskBar'

const HEADER_H = 52

// Row height by hierarchy depth (0 = top, 1 = child, 2 = grandchild+).
// Secondary rows shrink so the three levels read clearly at a glance.
const ROW_HEIGHT = [48, 36, 32]
const rowHeight = (depth: number) => ROW_HEIGHT[Math.min(depth, 2)]

// A project's line is drawn at the smallest of those heights. It is a rule
// between groups rather than a step in the hierarchy, so it does not indent and
// does not grow — the top-level tasks under it keep their own size.
const heightOf = (row: Row) => (row.kind === 'project' ? ROW_HEIGHT[2] : rowHeight(row.depth))

// Splitter between the left task table and the right timeline.
const SPLITTER_W = 6
const MIN_LEFT = 480
const MAX_LEFT = 960

// How far into a row a drop means "before" or "after" it rather than "inside"
// it. A quarter of the row at each end, so on the shortest row (32px) each end
// is 8px of travel — tight, but the same ratio every file manager uses, and the
// alternative is a middle band you cannot hit on purpose.
const EDGE = 0.25
// How far the pointer has to travel before a press counts as a drag rather than
// a click. Below this the gesture is still a selection and the row's own click
// handler gets it.
const DRAG_SLOP = 4

// How long a displaced row takes to reach its new place. Short enough to keep up
// with a drag that is crossing several rows a second — a row still travelling
// when the next one starts reads as lag rather than as motion.
const ROW_SLIDE_MS = 180

// Alternating row background so each task row reads as one continuous stripe
// across the full Gantt width (left labels + timeline).
const rowBg = (i: number) => (i % 2 === 1 ? 'bg-stripe' : 'bg-panel')

// Semi-transparent version for the left task overlay (frosted glass base).
const rowBgLeft = (i: number) => (i % 2 === 1 ? 'bg-stripe/30' : 'bg-panel/30')

/**
 * Which part of a row the pointer is in.
 *
 * `into` puts the rows inside the row — the only one of the three that changes
 * the depth of what is being dragged. Which end is which is decided by `EDGE`.
 */
type DropZone = 'before' | 'after' | 'into'

/** A row the pointer is over, and which part of it. */
interface DropAt {
  idx: number
  zone: DropZone
}

/** The arguments a drop resolves to — the same ones `placeTasks` and `moveTasks` take. */
interface MoveArgs {
  ids: string[]
  parentId: string | null
  beforeId: string | null
  projectId: string
}

interface DragState {
  /** The row the press landed on — what a click means if this turns out to be one. */
  row: RowTask
  /** The topmost tasks being moved — a task inside another is carried, not dragged. */
  roots: string[]
  /** Every id the drag would relocate, so "drop inside your own contents" is a set lookup. */
  blocked: Set<string>
  label: string
  startX: number
  startY: number
  moved: boolean
}

interface Props {
  rows: Row[]
  range: DateRange
  todo: TodoActions
  /** Editing mode: rows can be dragged and clicks build a selection. */
  editing: boolean
  /**
   * The rows picked out in editing mode.
   *
   * Owned by the page rather than kept here, because two things read it now: the
   * drag, which takes the whole set, and the selection bar above the chart, which
   * acts on it. A highlight and the toolbar that operates on it have to be the
   * same list, and a list with two owners is two lists.
   */
  sel: ReadonlySet<string>
  onSel: (next: Set<string>) => void
  onContext: (e: MouseEvent<HTMLDivElement>, row: RowTask) => void
  onAddChild: (row: RowTask) => void
  onEdit: (row: RowTask) => void
}

export function GanttChart({ rows, range, todo, editing, sel, onSel, onContext, onAddChild, onEdit }: Props) {
  const t = useT()
  const lang = useLang()
  const viewMode = useStore((s) => s.viewMode)
  const focusISO = useStore((s) => s.focusISO)
  const focusTick = useStore((s) => s.focusTick)
  const setSelected = useStore((s) => s.setSelected)
  const selectedDay = useStore((s) => s.selectedDay)
  const setSelectedDay = useStore((s) => s.setSelectedDay)
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const projects = useStore((s) => s.projects)
  const expanded = useStore((s) => s.expanded)
  const projectFilter = useStore((s) => s.projectFilter)
  const toggleExpanded = useStore((s) => s.toggleExpanded)
  const moveTasks = useStore((s) => s.moveTasks)

  // Single source of truth for the left/right boundary.
  const [leftWidth, setLeftWidth] = useState(LEFT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const splitterRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // --- the row drag -------------------------------------------------------
  //
  // One gesture, held in refs rather than state: the pointer moves sixty times a
  // second and none of it is worth a render. Only the drop target is state, and
  // it changes when the pointer crosses a row boundary rather than on every
  // pixel — the setter below hands back the previous object when nothing moved,
  // which is what keeps a drag from re-rendering fifty rows per frame.
  const dragState = useRef<DragState | null>(null)
  const suppressClick = useRef(false)
  const ghostRef = useRef<HTMLDivElement>(null)
  const [dropAt, setDropAt] = useState<DropAt | null>(null)
  // Set once when the press turns into a drag and cleared on release, so the
  // card can be rendered from a render rather than written to by hand. Two
  // renders per drag; everything that moves sixty times a second stays in the
  // ref and the transform above.
  const [drag, setDrag] = useState<{ label: string; roots: string[] } | null>(null)
  // Where a shift-click measures its range from — the last row picked on its own.
  const anchor = useRef<string | null>(null)

  // `lang` belongs here: `buildTimeline` builds every cell and group label, so
  // leaving it out would freeze the whole header in the language it loaded in.
  const timeline = useMemo(() => buildTimeline(viewMode, range, lang), [viewMode, range, lang])

  // Leaving editing mode drops any mark the pointer left behind. The selection
  // itself is dropped by the page, which owns it.
  useEffect(() => {
    if (editing) return
    setDropAt(null)
    anchor.current = null
  }, [editing])

  // Scroll-to-today. Wanted on first render and whenever Today is pressed — but
  // deliberately not when the range changes, so switching the project filter
  // leaves the scroll position to the browser, which clamps it into the shorter
  // axis on its own rather than being yanked back to today.
  const pendingFocus = useRef(true)
  useEffect(() => {
    pendingFocus.current = true
  }, [focusTick])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !pendingFocus.current) return
    pendingFocus.current = false
    // `FOCUS_OFFSET_PX` is measured from the left task panel's right edge, which
    // is sticky — so `leftWidth` cancels out and the position holds however far
    // the splitter has been dragged.
    el.scrollLeft = Math.max(0, dateToX(toDate(focusISO), timeline) - FOCUS_OFFSET_PX)
  }, [timeline, focusISO, focusTick])

  const todayX = useMemo(() => {
    const x = dateToX(startOfDay(new Date()), timeline)
    return x >= 0 && x <= timeline.totalWidth ? x : null
  }, [timeline])

  // Marks which exact day the open detail panel belongs to. At coarse zooms a
  // column covers many days, so without this the picked day is anyone's guess.
  const selectedX = useMemo(() => {
    if (!selectedDay) return null
    const x = dateToX(toDate(selectedDay), timeline)
    return x >= 0 && x <= timeline.totalWidth ? x : null
  }, [selectedDay, timeline])

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

  /**
   * Which row the pointer is over, and which part of it.
   *
   * Worked out from the pointer's distance down the scroll area and the rows'
   * own heights — against `rows`, the list as it was when the rows were last
   * rendered *without* a drag in flight, and never against what is on screen.
   *
   * That is not an optimisation; it is the only thing that makes the live
   * preview below possible. The preview moves rows under the pointer, so asking
   * the document which row is at the cursor answers with one the preview just
   * put there, which moves it again — the list would oscillate between two
   * arrangements while the pointer held still. Measured against the rows the
   * user pressed on, the answer depends on where the pointer is and nothing
   * else, so it holds and the preview is free to rearrange.
   *
   * The cost is the arithmetic `elementFromPoint` used to save: rows are 48, 36
   * or 32px depending on depth, the project and folder lines another height, and
   * the header covers the top 52. It is a short walk, and it is paid once per
   * pointer move rather than once per render.
   */
  const rowAt = (y: number): DropAt | null => {
    const el = containerRef.current
    if (!el || rows.length === 0) return null
    // Into content coordinates, then past the sticky header — the rows begin
    // directly under it and run down without a gap.
    let down = y - el.getBoundingClientRect().top + el.scrollTop - HEADER_H
    let idx = 0
    while (idx < rows.length - 1 && down >= heightOf(rows[idx])) {
      down -= heightOf(rows[idx])
      idx++
    }
    const row = rows[idx]
    // Clamped, because the pointer can be above the first row (over the header)
    // or below the last one — both mean the nearest end, not no answer.
    const frac = Math.max(0, Math.min(1, down / heightOf(row)))
    let zone: DropZone = frac < EDGE ? 'before' : frac > 1 - EDGE ? 'after' : 'into'
    // The middle half of a row that cannot hold anything — a to-do, a folder
    // line, or a row the drag is carrying — means the nearer end instead. An
    // "into" that resolves to nothing on release would look like the drop was
    // simply ignored.
    if (zone === 'into' && !canNest(row)) zone = frac < 0.5 ? 'before' : 'after'
    return { idx, zone }
  }

  const canNest = (row: Row): boolean => {
    // Only a real task holds anything, and a to-do explicitly does not — the
    // same rule the dialog's parent picker and the row's own "+" already follow.
    if (row.kind === 'project') return true
    if (row.kind !== 'task' || row.task.isTodo) return false
    return !dragState.current?.blocked.has(row.id)
  }

  /**
   * The sibling a drop lands in front of, found by looking at the rows below.
   *
   * The flat row list is pre-order, so a row's next sibling is the next row that
   * is neither deeper than it (which would be inside its own subtree) nor
   * shallower (which would mean it was the last of its siblings).
   *
   * A folder line stands for the to-dos behind it, so landing in front of the
   * line means landing in front of the first of them. That used to be the end of
   * the level, on the grounds that a to-do sank to the bottom of its list
   * whatever the drop said — true then, and the reason a to-do could not be
   * placed anywhere else.
   */
  const siblingAfter = (i: number, parentId: string | null): string | null => {
    const depth = rows[i].depth
    for (let j = i + 1; j < rows.length; j++) {
      const r = rows[j]
      if (r.depth > depth) continue
      if (r.depth < depth) return null
      if (r.kind === 'todoGroup') return r.parentId === parentId ? (r.todoIds[0] ?? null) : null
      if (r.kind !== 'task' || r.task.parentId !== parentId) return null
      return r.id
    }
    return null
  }

  /**
   * Where a drop at this row actually puts the rows, or null if it cannot.
   *
   * The one description of a drop, read by both the preview and the commit on
   * release — which is why it hands back the arguments to `placeTasks` rather
   * than a result: the preview passes them to it now, the release passes them to
   * `moveTasks` after, and there is no second opinion in between.
   *
   * `ids` comes in as an argument rather than being read off the drag ref, so
   * that the release can ask this question after it has already dropped that
   * ref. Reading it here is how the drop came to do nothing at all: the answer
   * was computed from a gesture that had just been cleared.
   */
  const placeFor = (at: DropAt, ids: string[]): MoveArgs | null => {
    const row = rows[at.idx]
    if (!row || ids.length === 0) return null
    if (row.kind === 'project') {
      // A project's line is one large "inside": landing on it files the rows
      // directly in that project, which is what makes a project a container
      // rather than a heading. Projects are not reordered by dragging.
      return { ids, parentId: null, beforeId: null, projectId: row.project.id }
    }
    const parentId = row.kind === 'task' ? row.task.parentId : row.parentId
    const projectId = row.kind === 'task' ? row.task.projectId : row.projectId
    if (at.zone === 'into') {
      if (row.kind !== 'task') return null
      return { ids, parentId: row.id, beforeId: null, projectId }
    }
    if (at.zone === 'before') {
      // Nothing can be inserted against a folder line itself — it is not a task
      // — so a drop above it goes in front of the to-dos it stands for. The
      // level's end was the old answer, and it was only the same place on screen
      // while a folder was always drawn after every task of its parent.
      if (row.kind === 'todoGroup') return { ids, parentId, beforeId: row.todoIds[0] ?? null, projectId }
      return { ids, parentId, beforeId: row.kind === 'task' ? row.id : null, projectId }
    }
    return { ids, parentId, beforeId: siblingAfter(at.idx, parentId), projectId }
  }

  /**
   * The board as it would be, while the pointer is still down.
   *
   * The drop is shown by *making* it — the rows rearrange under the pointer,
   * which is the only description of "where this lands" that needs no reading.
   * A line between two rows says where the pointer is; it does not say what the
   * branch will look like afterwards, and afterwards is when the answer is
   * expensive: a parent's dates, its progress and every WBS number under it are
   * recomputed the moment the row lands, so a wrong drop is diagnosed by
   * inspecting the damage.
   *
   * Built by `placeTasks` — the same function the release calls — and rendered
   * by the same `buildRows` that drew the list, so what this shows is not an
   * impression of the result. It is the result, one release early.
   */
  const preview = useMemo(() => {
    if (!drag || !dropAt) return null
    const place = placeFor(dropAt, drag.roots)
    if (!place) return null
    return placeTasks(tasks, place.ids, place.parentId, place.beforeId, place.projectId)
  }, [drag, dropAt, tasks])

  const shownRows = useMemo(() => {
    if (!preview) return rows
    // A row dropped into a closed parent would otherwise vanish while it is
    // being placed — the one moment it must not. Folded open for the preview
    // only: nothing is written, so releasing somewhere else leaves the branch
    // shut as it was.
    const place = dropAt && drag ? placeFor(dropAt, drag.roots) : null
    const open = place?.parentId ? { ...expanded, [place.parentId]: true } : expanded
    // The same narrowing `useRows` applies, and it has to be applied here too:
    // the preview is built from the whole board, so without this a drag started
    // while one project is selected would fill the chart with every project as
    // soon as the pointer moved a few pixels.
    const visible = projectFilter === 'all' ? preview : preview.filter((x) => x.projectId === projectFilter)
    return buildRows(visible, open, projects, logs)
  }, [preview, rows, expanded, projects, logs, drag, dropAt, projectFilter])

  /**
   * The rows that the preview displaced slide into their new place.
   *
   * The same trick a phone's home screen uses when an icon is dragged across
   * it: nothing jumps, the icons around the gap make room by *travelling*. FLIP
   * — measure where each row was, let React put it where it now belongs, then
   * push it back to the old spot without a transition and release it, so the
   * browser animates the difference.
   *
   * Two things are load-bearing:
   *
   * **The rows on the move are left out.** They are already under the pointer,
   * which is where the eye says they are; sliding them from their old slot would
   * read as the row lagging behind the hand. They jump, exactly as an icon does
   * under a finger, and only the rows making room for them travel.
   *
   * **Measured with `offsetTop`, not `getBoundingClientRect`.** A row halfway
   * through its own animation still carries a transform, and its client rect
   * would report where it *looks* rather than where it belongs — so dragging
   * quickly across several rows would compute each new move from a half-finished
   * one and the whole list would drift. `offsetTop` is layout, and a transform
   * cannot touch it.
   */
  const prevTops = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const moving = dragState.current?.blocked ?? new Set<string>()
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tops = new Map<string, number>()
    for (const node of el.querySelectorAll<HTMLElement>('[data-row-id]')) {
      const id = node.dataset.rowId!
      const top = node.offsetTop
      const was = prevTops.current.get(id)
      tops.set(id, top)
      // A row that has just appeared — a folded branch opening for the preview
      // — has nowhere to have come from, so it simply arrives.
      if (still || was === undefined || moving.has(id)) continue
      const delta = was - top
      if (delta === 0) continue
      node.style.transition = 'none'
      node.style.transform = `translateY(${delta}px)`
      // Read a layout property to make the browser commit the inverted style
      // before the transition is armed; without this the two writes land in one
      // style recalc and the row never moves.
      void node.offsetHeight
      node.style.transition = `transform ${ROW_SLIDE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`
      node.style.transform = ''
    }
    prevTops.current = tops
  }, [shownRows])

  const beginDrag = (e: PointerEvent<HTMLDivElement>, row: Row) => {
    if (!editing || e.button !== 0) return
    // A folder line and a project line are places, not things — they are drop
    // targets, and neither has a task behind it to move.
    if (row.kind !== 'task') return
    // A press on one of the row's buttons belongs to that button. Its `click`
    // stops propagating, but the `pointerdown` still bubbles to here, so
    // without this the delete button would arm a drag and swallow its own press
    // the moment the pointer twitched.
    if ((e.target as HTMLElement).closest('button')) return

    const roots = sel.has(row.id) ? [...sel] : [row.id]
    const blocked = new Set<string>()
    let single = ''
    for (const id of roots) {
      const task = tasks.find((x) => x.id === id)
      if (!task) continue
      if (roots.length === 1) single = task.name
      blocked.add(id)
      for (const d of collectDescendants(tasks, id)) blocked.add(d)
    }
    if (blocked.size === 0) return

    // A fresh gesture, so whatever click the last one left suppressed is no
    // longer ours to swallow.
    suppressClick.current = false
    // Stops the drag from painting a text selection across the rows it passes
    // over. It is the compatibility `mousedown` that begins a selection, and
    // this is what suppresses it — the same call `TaskBar` makes when a bar is
    // picked up, for the same reason. Every early return above comes first, so
    // a press on one of the row's buttons is still an ordinary press.
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = {
      row,
      roots: roots.filter((id) => blocked.has(id) && !isCarried(id, roots)),
      blocked,
      label: roots.length > 1 ? t('gantt.dragMany', { count: roots.length }) : single,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
  }

  /** One of the dragged tasks that another dragged task is already carrying. */
  const isCarried = (id: string, roots: string[]) =>
    roots.some((r) => r !== id && collectDescendants(tasks, r).includes(id))

  const onRowMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragState.current
    if (!d) return
    if (!d.moved) {
      if (Math.abs(e.clientY - d.startY) < DRAG_SLOP && Math.abs(e.clientX - d.startX) < DRAG_SLOP) return
      d.moved = true
      setDrag({ label: d.label, roots: d.roots })
    }
    if (ghostRef.current) ghostRef.current.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 10}px)`
    const next = rowAt(e.clientY)
    setDropAt((prev) =>
      prev?.idx === next?.idx && prev?.zone === next?.zone ? prev : next,
    )
  }

  const onRowUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragState.current
    if (!d) return
    dragState.current = null
    setDrag(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)

    // A press that never travelled is a click, and this is where it is read.
    //
    // Not from the row's own `onClick`, which is where it used to be: capturing
    // the pointer on `pointerdown` — which the drag needs, or releasing outside
    // the row would never be seen — retargets the `click` that follows to the
    // capturing element. The row's handler is a child of it, so the click never
    // reached the row at all and *nothing* was selectable in editing mode, one
    // row or several. The gesture knows where it started, so it can just say.
    if (!d.moved) {
      onRowClick(e, d.row)
      return
    }

    // The click that follows a real drag is the tail of the same gesture, not a
    // second instruction. Swallowed so releasing over a row does not also
    // reselect it.
    suppressClick.current = true

    const at = rowAt(e.clientY)
    if (at) {
      const place = placeFor(at, d.roots)
      if (place) {
        moveTasks(d.roots, place.parentId, place.beforeId, place.projectId)
        // A branch that was closed stays closed after a drop into it, which
        // would make the rows just moved look like they had been deleted. Only
        // an explicit `false` is closed — see `toggleExpanded`'s `defaultOpen`.
        const target = rows[at.idx]
        if (at.zone === 'into' && target.kind === 'task' && expanded[target.id] === false) {
          toggleExpanded(target.id)
        }
      }
    }
    setDropAt(null)
  }

  /**
   * What a click on a row means.
   *
   * Outside editing mode this is the one thing it has always been — open the
   * task. Inside it, a click adds the row to the selection or takes it out
   * again, and Shift takes a run, exactly as a file manager does. Ctrl needs no
   * branch of its own: it used to be what "add to the selection" meant here, and
   * a plain click replacing the selection instead is what made picking several
   * rows a keyboard chord rather than a gesture. The circle drawn on the row
   * says which way a click will go before it is made.
   *
   * The detail panel is deliberately left alone while editing. It is for reading
   * and this is for acting, and having it follow a click that was meant to tick
   * a row would flick through three tasks while the user builds one selection.
   */
  const onRowClick = (e: MouseEvent<HTMLElement>, row: RowTask) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (!editing) {
      setSelected(row.id)
      return
    }
    if (e.shiftKey && anchor.current) {
      const from = rows.findIndex((r) => r.id === anchor.current)
      const to = rows.findIndex((r) => r.id === row.id)
      if (from !== -1 && to !== -1) {
        const next = new Set<string>()
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
          if (rows[i].kind === 'task') next.add(rows[i].id)
        }
        onSel(next)
        return
      }
    }
    const next = new Set(sel)
    if (next.has(row.id)) next.delete(row.id)
    else next.add(row.id)
    onSel(next)
    anchor.current = row.id
  }

  const picking = (id: string) => editing && sel.has(id)

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-panel"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        setSelected(null)
        if (editing) {
          onSel(new Set())
          anchor.current = null
        }
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
          {shownRows.map((row, i) => (
            <div
              key={row.id}
              className={`${rowBgLeft(i)} border-b border-line`}
              style={{ height: heightOf(row) }}
              data-row-id={row.id}
              onPointerDown={(e) => beginDrag(e, row)}
              onPointerMove={onRowMove}
              onPointerUp={onRowUp}
              onPointerCancel={onRowUp}
            >
              <RowLeft
                row={row}
                todo={todo}
                editing={editing}
                picked={picking(row.id)}
                onRowClick={onRowClick}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onContext={onContext}
              />
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
          {/* today line — the amber signal, and the only solid vertical line */}
          {todayX != null && (
            <div
              className="absolute pointer-events-none"
              style={{ left: todayX, top: HEADER_H, bottom: 0, width: 1, background: 'rgb(var(--c-in-progress))', opacity: 0.75, zIndex: 15 }}
            />
          )}

          {/* selected day marker — above the header so it ties the picked date
              label to the column it belongs to.
              Dashed and neutral, deliberately not the accent. This and the today
              line are both full-height 1px marks on the same canvas, and telling
              them apart by hue alone fails as soon as an accent lands near amber
              — and fails completely under red-green colour blindness. Different
              form separates them however the palette moves. */}
          {selectedX != null && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: selectedX,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundImage:
                  'repeating-linear-gradient(to bottom, rgb(var(--c-fg) / 0.5) 0 4px, transparent 4px 8px)',
                zIndex: 25,
              }}
            />
          )}

          {/* timeline header */}
          <div className="sticky top-0 z-20 bg-panel border-b border-border" style={{ height: HEADER_H }}>
            <TimelineHeader timeline={timeline} onPickDate={setSelectedDay} />
          </div>

          {/* timeline rows */}
          {shownRows.map((row, i) => (
            <div
              key={row.id}
              className={`relative ${rowBg(i)} border-b border-line`}
              style={{ height: heightOf(row) }}
              data-row-id={row.id}
              // Nothing to draw for a project's line: it is a rule between
              // groups, and the colour that marks it is already on the left
              // half of the same row. A bar here would read as a task.
              // A to-do folder has no task behind it, so clicking its empty
              // timeline strip must not select a non-existent task.
              onClick={row.kind === 'task' ? (e) => onRowClick(e, row) : undefined}
            >
              {row.kind === 'task' && <TaskBar row={row} timeline={timeline} rowH={heightOf(row)} />}
            </div>
          ))}
        </div>
      </div>

      {/* What is moving, following the pointer.

          Only that, and deliberately: where it will land is answered by the
          rows themselves rearranging, which needs no reading and cannot be
          misread. A sentence saying it twice would be a second thing to look at
          during the one gesture where the eyes are already busy.

          Positioned by writing a transform rather than through state: a pointer
          that moves sixty times a second should not re-render the tree sixty
          times a second. Whether it is shown *is* state, because the pill's text
          comes from a render — that is two renders per drag. */}
      <div
        ref={ghostRef}
        className={`fixed top-0 left-0 z-[80] w-max max-w-[300px] pointer-events-none ${drag ? 'block' : 'hidden'}`}
      >
        <div className="inline-flex items-center px-2 h-6 text-[11px] font-medium rounded-[3px] bg-accent text-on-accent shadow-lg max-w-full">
          <span className="truncate">{drag?.label}</span>
        </div>
      </div>
    </div>
  )
}

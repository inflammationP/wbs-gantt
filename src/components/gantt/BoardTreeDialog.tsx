import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus } from 'lucide-react'
import { Project, Task } from '../../types'
import { buildChildrenMap, computeWbs, effectiveStates, liveTasks, projectsInView } from '../../lib/tree'
import { loadBoardTree, moveGroup, saveBoardTree, TreeOffset } from '../../lib/boardTree'
import { priorityMeta, sig, sigText, STATUS_META, toggleIn } from '../../lib/ui'
import { useT } from '../../lib/useT'
import { useStore } from '../../store/useStore'
import { Modal } from '../ui'

/**
 * The whole task tree, drawn left to right like a mind map.
 *
 * **Why a map rather than more indentation.** Depth in the Gantt is horizontal
 * displacement, and the left column has a finite width — a task ten levels down
 * eventually has nowhere to put its name. Here depth is the direction the tree
 * grows: the root sits on the left, children branch to the right, and the canvas
 * scrolls instead of squeezing anything. A deep task gets the same box, the same
 * font and the same chance to be read as a root.
 *
 * **The shape is the app's own tree.** Children come from `buildChildrenMap` and
 * the numbers from `computeWbs`, the two functions the board already draws with,
 * so the tree cannot disagree with the Gantt about who belongs to whom or what a
 * row is numbered. Archived tasks are absent, for the same reason they are absent
 * from the board.
 *
 * **Only the layers someone asked for are drawn.** Projects start open — their
 * top-level tasks are the overview — and everything below starts closed behind
 * its `+`. Expanding a branch is a deliberate act, one at a time.
 *
 * A click on a box is the info card: name, status, progress, dates, priority,
 * tags, description. It is a reading popover, not an editor — every action still
 * belongs to the board behind this.
 */
/**
 * The breathing room around the trees, in px. The canvas itself is no larger
 * than the trees plus this: it used to reserve four thousand pixels on the top
 * and left, so opening the dialog put the work in a corner of a mostly empty
 * dot grid. The vertical margin is smaller — screen height is the scarce one.
 */
const PAD_X = 40
const PAD_Y = 16
/** Space between stacked project trees, in px (`gap-16` in Tailwind). */
const GAP = 64

interface TreeDrag {
  /** Every selected tree moves together; the pressed one is `dragId`. */
  ids: string[]
  /** The pointer when the press began, and the scroll offset it began at. */
  x: number
  y: number
  scrollLeft: number
  scrollTop: number
  /** Where each dragged tree sat when the press began. */
  orig: Record<string, TreeOffset>
  moved: boolean
}

interface Marquee {
  x: number
  y: number
  x2: number
  y2: number
  /** The selection a modifier-click adds to, or nothing for a plain marquee. */
  base: Set<string>
  moved: boolean
}

export function BoardTreeDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const projects = useStore((s) => s.projects)
  const projectFilter = useStore((s) => s.projectFilter)

  const shownProjects = useMemo(() => projectsInView(projects, projectFilter), [projects, projectFilter])
  const scope = useMemo(
    () => liveTasks(projectFilter === 'all' ? tasks : tasks.filter((t) => t.projectId === projectFilter)),
    [tasks, projectFilter],
  )
  const children = useMemo(() => buildChildrenMap(scope), [scope])
  // The same per-project numbering the board uses: one project's `1.2` is
  // another's `1.2`, and that is the numbering people know.
  const wbs = useMemo(() => {
    const out = new Map<string, string>()
    for (const p of shownProjects) {
      for (const [id, n] of computeWbs(scope.filter((t) => t.projectId === p.id))) out.set(id, n)
    }
    return out
  }, [scope, shownProjects])
  const states = useMemo(() => effectiveStates(tasks, logs), [tasks, logs])
  const projectOf = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  // Last close's arrangement, read once. No blob yet means a first visit, where
  // projects are open; after that `open` is exactly what was left, including a
  // branch the reader had folded.
  const [saved] = useState(loadBoardTree)
  const [open, setOpen] = useState<Set<string>>(() =>
    new Set(saved ? saved.open : shownProjects.map((p) => `p:${p.id}`)),
  )
  const toggle = (id: string) => setOpen((s) => toggleIn(s, id))

  const [info, setInfo] = useState<{ kind: 'task' | 'project'; id: string; x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Trees are selected as wholes: Ctrl-click a root to add or remove one, drag a
  // box on empty canvas to take every tree it touches. The selection is what a
  // drag carries; it is not kept after the dialog closes.
  const [sel, setSel] = useState<Set<string>>(new Set())

  // Each project's tree floats: grab its root and move it anywhere on the
  // canvas, in any direction. The canvas grows padding on whichever side a tree
  // has been carried past the column, so that space is still scrollable.
  const [offset, setOffset] = useState<Record<string, TreeOffset>>(() => saved?.offset ?? {})
  const [dragId, setDragId] = useState<string | null>(null)
  const treeDrag = useRef<TreeDrag | null>(null)
  const dragPointer = useRef<{ x: number; y: number } | null>(null)
  const autoScroll = useRef<number | null>(null)

  // The trees sit on an absolute canvas: each project's box is its own measured
  // size, stacked with a fixed gap and then moved by its offset. The content is
  // exactly the union of those boxes plus the margin, so dragging trees together
  // shrinks it — a flow column kept the height of the day's five projects
  // forever, which is the dead field below the trees.
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({})
  const geom = useMemo(() => {
    const items = shownProjects.map((p) => {
      const s = sizes[p.id] ?? { w: 0, h: 0 }
      const at = offset[p.id] ?? { x: 0, y: 0 }
      return { id: p.id, w: s.w, h: s.h, x: at.x, y: at.y, base: 0 }
    })
    let base = 0
    for (const it of items) {
      it.base = base
      base += it.h + GAP
    }
    const pos: Record<string, { left: number; top: number }> = {}
    if (!items.length) return { w: 2 * PAD_X, h: 2 * PAD_Y, minLeft: 0, minTop: 0, pos }
    const minLeft = Math.min(...items.map((it) => it.x))
    const minTop = Math.min(...items.map((it) => it.base + it.y))
    let maxRight = -Infinity
    let maxBottom = -Infinity
    for (const it of items) {
      maxRight = Math.max(maxRight, it.x + it.w)
      maxBottom = Math.max(maxBottom, it.base + it.y + it.h)
      pos[it.id] = { left: PAD_X + it.x - minLeft, top: PAD_Y + it.base + it.y - minTop }
    }
    return {
      w: maxRight - minLeft + 2 * PAD_X,
      h: maxBottom - minTop + 2 * PAD_Y,
      minLeft,
      minTop,
      pos,
    }
  }, [shownProjects, offset, sizes])

  // A tree's size is its own rendered box; it changes when a branch unfolds, so
  // measure after every render. Positions do not affect the measurement, and a
  // size that did not move is left alone so this does not re-render in a loop.
  const sizesSettled = useRef(false)
  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return
    const next: Record<string, { w: number; h: number }> = {}
    for (const el of Array.from(content.children) as HTMLElement[]) {
      const id = el.dataset.treeId
      if (!id) continue
      const r = el.getBoundingClientRect()
      next[id] = { w: r.width, h: r.height }
    }
    const same =
      Object.keys(next).length === Object.keys(sizes).length &&
      Object.entries(next).every(
        ([id, s]) => sizes[id] && Math.abs(sizes[id].w - s.w) < 0.5 && Math.abs(sizes[id].h - s.h) < 0.5,
      )
    sizesSettled.current = same
    if (!same) setSizes(next)
  })

  // The canvas is height:auto, so it is exactly as tall as the content. While a
  // tree is being dragged that would resize the viewport under the pointer, so
  // the gesture pins the height it started at and the release lets it go.
  const [dragH, setDragH] = useState<number | null>(null)

  // The last arrangement is written when the dialog unmounts, whichever way it
  // was closed. A ref because the cleanup runs once and must read whatever the
  // state was at that moment.
  const view = useRef({ left: 0, top: 0 })
  const pendingScroll = useRef(saved?.scroll ?? null)
  const latest = useRef({ open: [...open], offset, scroll: view.current })
  useEffect(() => {
    latest.current = { open: [...open], offset, scroll: view.current }
  })
  useEffect(() => () => saveBoardTree(latest.current), [])

  // Normalising positions against the top/left-most tree shifts every other
  // tree whenever that corner moves. Give the scroll back the same amount in
  // the same frame, and move the active drag's baseline with it, or the pointer
  // would drift off the node.
  const origin = useRef({ left: geom.minLeft, top: geom.minTop })
  useLayoutEffect(() => {
    const prev = origin.current
    origin.current = { left: geom.minLeft, top: geom.minTop }
    const dx = prev.left - geom.minLeft
    const dy = prev.top - geom.minTop
    const el = canvasRef.current
    if (!el || (dx === 0 && dy === 0)) return
    el.scrollLeft += dx
    el.scrollTop += dy
    view.current = { left: el.scrollLeft, top: el.scrollTop }
    const d = treeDrag.current
    if (d) {
      d.scrollLeft += dx
      d.scrollTop += dy
    }
  }, [geom.minLeft, geom.minTop])

  // Where the trees must sit so the grabbed point stays under the pointer. The
  // scroll term is the whole of it: without it an auto-scroll moves the content
  // out from under the pointer, and the next pointermove snaps the trees back by
  // the distance the canvas travelled — which reads as the cursor drifting off
  // the node.
  const dragDelta = (d: TreeDrag, px: number, py: number) => {
    const el = canvasRef.current
    const sx = el ? el.scrollLeft - d.scrollLeft : 0
    const sy = el ? el.scrollTop - d.scrollTop : 0
    return { dx: px - d.x + sx, dy: py - d.y + sy }
  }
  const dragTo = (d: TreeDrag, px: number, py: number) => {
    const { dx, dy } = dragDelta(d, px, py)
    // From the positions at press time, not the current ones: the delta is
    // measured from that moment too, and applying it to a moved tree would
    // count the same travel twice.
    setOffset({ ...offset, ...moveGroup(d.orig, d.ids, dx, dy) })
  }

  // Carrying a tree past the canvas edge scrolls the canvas that way, and moves
  // the tree by the same amount so it stays under the pointer. The loop is what
  // makes it keep going while the pointer is held at the edge, with no further
  // pointermove events to feed it.
  const tick = () => {
    autoScroll.current = null
    const d = treeDrag.current
    const el = canvasRef.current
    const p = dragPointer.current
    if (!d || !el || !p) return
    const r = el.getBoundingClientRect()
    const EDGE = 56
    const MAX = 16
    const vx =
      p.x < r.left + EDGE
        ? -Math.min(MAX, ((r.left + EDGE - p.x) / EDGE) * MAX)
        : p.x > r.right - EDGE
          ? Math.min(MAX, ((p.x - (r.right - EDGE)) / EDGE) * MAX)
          : 0
    const vy =
      p.y < r.top + EDGE
        ? -Math.min(MAX, ((r.top + EDGE - p.y) / EDGE) * MAX)
        : p.y > r.bottom - EDGE
          ? Math.min(MAX, ((p.y - (r.bottom - EDGE)) / EDGE) * MAX)
          : 0
    if (vx === 0 && vy === 0) return
    const beforeX = el.scrollLeft
    const beforeY = el.scrollTop
    el.scrollLeft = beforeX + vx
    el.scrollTop = beforeY + vy
    const sx = el.scrollLeft - beforeX
    const sy = el.scrollTop - beforeY
    if (sx === 0 && sy === 0) return
    d.moved = true
    panMoved.current = true
    dragTo(d, p.x, p.y)
    autoScroll.current = requestAnimationFrame(tick)
  }
  const startAutoScroll = () => {
    if (autoScroll.current == null) autoScroll.current = requestAnimationFrame(tick)
  }
  const stopAutoScroll = () => {
    if (autoScroll.current != null) cancelAnimationFrame(autoScroll.current)
    autoScroll.current = null
  }
  useEffect(() => () => stopAutoScroll(), [])

  const startTreeDrag = (e: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (e.button !== 0) return
    e.stopPropagation()
    panMoved.current = false
    // Ctrl-click is a selection gesture, not a drag. A plain press on an
    // unselected root takes it alone; a press on one already in a group keeps
    // the group, which is how the group is carried.
    if (e.ctrlKey || e.metaKey) {
      setSel((s) => toggleIn(s, id))
      return
    }
    // A selection made before the scope narrowed can still hold a project that
    // is no longer drawn; carrying an invisible tree with the group is a change
    // nobody asked for.
    const shownIds = new Set(shownProjects.map((p) => p.id))
    const ids = sel.has(id) ? [...sel].filter((pid) => shownIds.has(pid)) : [id]
    if (!sel.has(id)) setSel(new Set(ids))
    const orig: Record<string, TreeOffset> = {}
    for (const pid of ids) orig[pid] = offset[pid] ?? { x: 0, y: 0 }
    const el = canvasRef.current
    treeDrag.current = {
      ids,
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el?.scrollLeft ?? 0,
      scrollTop: el?.scrollTop ?? 0,
      orig,
      moved: false,
    }
    dragPointer.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragId(id)
    // Pin the canvas height for the gesture; it returns to auto on release.
    setDragH(canvasRef.current?.clientHeight ?? null)
  }
  const moveTreeDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = treeDrag.current
    if (!d) return
    dragPointer.current = { x: e.clientX, y: e.clientY }
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      d.moved = true
      panMoved.current = true
    }
    if (!d.moved) return
    dragTo(d, e.clientX, e.clientY)
    startAutoScroll()
  }
  const endTreeDrag = () => {
    treeDrag.current = null
    dragPointer.current = null
    stopAutoScroll()
    setDragId(null)
    setDragH(null)
  }

  // Drag to pan, the way a map moves. Left-drag on empty canvas is the marquee
  // now, so panning is the middle button. A press that does not travel is still
  // a click: `panMoved` is what keeps a pan from opening a node's card on release.
  const panRef = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const panMoved = useRef(false)
  const startPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 1) return
    e.preventDefault()
    const el = canvasRef.current
    if (!el) return
    panMoved.current = false
    panRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false }
  }
  const movePan = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = panRef.current
    const el = canvasRef.current
    if (!p || !el) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      p.moved = true
      panMoved.current = true
    }
    if (!p.moved) return
    el.scrollLeft = p.left - dx
    el.scrollTop = p.top - dy
  }
  const endPan = () => {
    panRef.current = null
  }

  // Left-drag on empty canvas draws a box and takes every tree it touches.
  // Ctrl (or Cmd) at the start adds to the selection instead of replacing it.
  const marqueeRef = useRef<Marquee | null>(null)
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  // Every node carries its project, so a box that touches any part of a tree
  // selects that tree — a branch says which tree it is as plainly as the root.
  const selectionIn = (l: number, t: number, r: number, b: number) => {
    const out = new Set(marqueeRef.current?.base ?? [])
    const el = canvasRef.current
    if (!el) return out
    for (const node of el.querySelectorAll<HTMLElement>('[data-tree-project]')) {
      const rect = node.getBoundingClientRect()
      if (rect.left < r && rect.right > l && rect.top < b && rect.bottom > t) {
        out.add(node.dataset.treeProject!)
      }
    }
    return out
  }

  const startMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // A new press makes the last pan history; otherwise the click that follows
    // would still be read as the tail of a drag and swallowed.
    panMoved.current = false
    // A press on a button is that button's — a caret, a card, a root. Only the
    // canvas itself starts a box.
    if ((e.target as HTMLElement).closest('button')) return
    const base = e.ctrlKey || e.metaKey ? new Set(sel) : new Set<string>()
    marqueeRef.current = { x: e.clientX, y: e.clientY, x2: e.clientX, y2: e.clientY, base, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const moveMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    const m = marqueeRef.current
    if (!m) return
    m.x2 = e.clientX
    m.y2 = e.clientY
    if (!m.moved && Math.abs(m.x2 - m.x) + Math.abs(m.y2 - m.y) > 4) m.moved = true
    if (!m.moved) return
    // The box stops at the canvas edge even if the pointer leaves it.
    const area = canvasRef.current?.getBoundingClientRect()
    const left = Math.max(area?.left ?? -Infinity, Math.min(m.x, m.x2))
    const top = Math.max(area?.top ?? -Infinity, Math.min(m.y, m.y2))
    const right = Math.min(area?.right ?? Infinity, Math.max(m.x, m.x2))
    const bottom = Math.min(area?.bottom ?? Infinity, Math.max(m.y, m.y2))
    setBox({ left, top, width: right - left, height: bottom - top })
    setSel(selectionIn(left, top, right, bottom))
  }
  const endMarquee = () => {
    const m = marqueeRef.current
    if (!m) return
    marqueeRef.current = null
    setBox(null)
    // A press that did not travel is a click on empty canvas: it puts the
    // selection away, unless Ctrl asked to keep what was already there.
    if (!m.moved && !m.base.size) setSel(new Set())
  }

  // Reopen at the corner the dialog was left at, once the tree sizes have
  // settled. Before that the content is still laid out from placeholder sizes.
  useLayoutEffect(() => {
    if (!sizesSettled.current) return
    const el = canvasRef.current
    const s = pendingScroll.current
    if (!el || !s) return
    pendingScroll.current = null
    el.scrollLeft = s.left
    el.scrollTop = s.top
    view.current = { left: el.scrollLeft, top: el.scrollTop }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const inField = target?.closest('input, textarea, [contenteditable="true"]')
      if (!inField && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSel(new Set(shownProjects.map((p) => p.id)))
        return
      }
      if (e.key !== 'Escape') return
      if (info) setInfo(null)
      else if (sel.size) setSel(new Set())
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [info, onClose, sel, shownProjects])

  const show = (
    e: ReactMouseEvent<HTMLElement>,
    kind: 'task' | 'project',
    id: string,
    projectId: string,
  ) => {
    // A root has already toggled itself on pointerdown, where the drag begins.
    // A card has no drag of its own, so its Ctrl-click is where its tree joins
    // or leaves the selection.
    if (e.ctrlKey || e.metaKey) {
      if (kind === 'task') setSel((s) => toggleIn(s, projectId))
      return
    }
    // `detail === 0` is a keyboard click: it never started a pan, so it must
    // not be swallowed by the last one's flag.
    if (e.detail !== 0 && panMoved.current) return
    const r = e.currentTarget.getBoundingClientRect()
    setInfo({ kind, id, x: r.right + 10, y: r.top })
  }

  // A branch keeps its project's colour, at a weight that reads as a guide
  // rather than as a status. The colour is identity here (which project this
  // tree is), the same meaning it has on the project line of the board.
  const line = (color: string) =>
    /^#[0-9a-f]{6}$/i.test(color) ? `${color}59` : 'rgb(var(--c-dim) / 0.45)'

  // The toggle sits between the box and the branch it opens. The link under it
  // spans the two gaps (`ml-2` back to the box, `ml-6` on to the trunk), so an
  // open branch is one continuous line with the +/− on it.
  const toggleButton = (id: string, isOpen: boolean, color: string) => (
    <span className="relative ml-2 flex shrink-0 items-center">
      {isOpen && (
        <span aria-hidden className="absolute -left-2 -right-6 top-1/2 h-px" style={{ background: line(color) }} />
      )}
      <button
        type="button"
        onClick={(e) => {
          if (e.detail === 0 || !panMoved.current) toggle(id)
        }}
        aria-expanded={isOpen}
        aria-label={isOpen ? t('common.collapse') : t('common.expand')}
        title={t(isOpen ? 'common.collapse' : 'common.expand')}
        className="relative z-10 grid h-[22px] w-[22px] place-items-center rounded-full border border-border/70 bg-panel text-muted shadow-sm transition-all duration-200 hover:border-accent/50 hover:text-fg hover:shadow"
      >
        {isOpen ? <Minus size={11} /> : <Plus size={11} />}
      </button>
    </span>
  )

  // One child row, with its connector. The elbows are drawn with a border and a
  // rounded corner rather than as straight segments, which is what makes the
  // branch read as one stroke instead of a grid.
  const branchRow = (id: string, first: boolean, last: boolean, only: boolean, color: string, node: ReactNode) => (
    <div key={id} className="relative flex items-center py-2.5 pl-8">
      {only ? (
        <span aria-hidden className="absolute left-0 top-1/2 h-px w-8" style={{ background: line(color) }} />
      ) : first ? (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 top-1/2 w-8 rounded-tl-[14px] border-l border-t"
          style={{ borderColor: line(color) }}
        />
      ) : last ? (
        <span
          aria-hidden
          className="absolute bottom-1/2 left-0 top-0 w-8 rounded-bl-[14px] border-l border-b"
          style={{ borderColor: line(color) }}
        />
      ) : (
        <>
          <span aria-hidden className="absolute inset-y-0 left-0 w-px" style={{ background: line(color) }} />
          <span aria-hidden className="absolute left-0 top-1/2 h-px w-8" style={{ background: line(color) }} />
        </>
      )}
      {node}
    </div>
  )

  const taskNode = (task: Task, color: string): ReactNode => {
    const kids = children.get(task.id) ?? []
    const isOpen = open.has(task.id)
    const state = states.get(task.id)
    const meta = STATUS_META[state?.status ?? 'not-started']
    const progress = state?.progress
    const selected = info?.kind === 'task' && info.id === task.id
    return (
      <div className="flex items-center">
        <button
          type="button"
          data-tree-project={task.projectId}
          onClick={(e) => show(e, 'task', task.id, task.projectId)}
          className={`flex max-w-[220px] cursor-pointer flex-col items-start gap-0.5 rounded-[12px] border px-3 py-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md ${
            selected
              ? 'border-accent bg-panel ring-2 ring-accent'
              : task.isTodo
                ? 'border-dashed border-todo/50 bg-gradient-to-b from-panel to-panel2/60'
                : 'border-border/70 bg-gradient-to-b from-panel to-panel2/60 hover:border-accent/50'
          }`}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sig(meta.token) }} />
            <span className="min-w-0 truncate text-[12px] font-medium text-fg/90">{task.name}</span>
          </span>
          <span className="font-mono text-[10px] text-dim">
            {wbs.get(task.id) ?? ''}
            {progress != null ? ` · ${progress}%` : ''}
          </span>
        </button>
        {kids.length > 0 && toggleButton(task.id, isOpen, color)}
        {kids.length > 0 && isOpen && (
          <div className="tree-open ml-6 flex flex-col">
            {kids.map((kid, i) =>
              branchRow(kid.id, i === 0, i === kids.length - 1, kids.length === 1, color, taskNode(kid, color)),
            )}
          </div>
        )}
      </div>
    )
  }

  const projectNode = (project: Project) => {
    const roots = (children.get(null) ?? []).filter((t) => t.projectId === project.id)
    const id = `p:${project.id}`
    const isOpen = open.has(id)
    const selected = info?.kind === 'project' && info.id === project.id
    return (
      <div className={`relative flex items-center ${dragId === project.id ? 'z-20' : ''}`}>
        <button
          type="button"
          data-tree-project={project.id}
          onClick={(e) => show(e, 'project', project.id, project.id)}
          onPointerDown={(e) => startTreeDrag(e, project.id)}
          onPointerMove={moveTreeDrag}
          onPointerUp={endTreeDrag}
          onPointerCancel={endTreeDrag}
          className={`max-w-[220px] cursor-grab truncate rounded-[12px] border px-4 py-2 text-[12.5px] font-semibold transition-all duration-200 hover:-translate-y-px active:cursor-grabbing ${
            dragId === project.id
              ? 'scale-[1.02] outline outline-2 outline-offset-2 outline-accent'
              : selected || sel.has(project.id)
                ? 'outline outline-2 outline-offset-2 outline-accent'
                : ''
          }`}
          style={{
            borderColor: `${project.color}66`,
            background: `linear-gradient(135deg, color-mix(in srgb, ${project.color} 22%, transparent), color-mix(in srgb, ${project.color} 8%, transparent))`,
            color: project.color,
            boxShadow: `0 8px 20px -12px ${project.color}`,
          }}
        >
          {project.name}
        </button>
        {roots.length > 0 && toggleButton(id, isOpen, project.color)}
        {roots.length > 0 && isOpen && (
          <div className="tree-open ml-6 flex flex-col">
            {roots.map((task, i) =>
              branchRow(task.id, i === 0, i === roots.length - 1, roots.length === 1, project.color, taskNode(task, project.color)),
            )}
          </div>
        )}
      </div>
    )
  }

  const infoTask = info?.kind === 'task' ? byId.get(info.id) : undefined
  const infoProject = info?.kind === 'project' ? projectOf.get(info.id) : undefined
  const infoState = infoTask ? states.get(infoTask.id) : undefined
  const infoMeta = STATUS_META[infoState?.status ?? 'not-started']
  const infoPriority = infoTask ? priorityMeta(infoTask.priority) : undefined
  const infoKids = infoTask ? (children.get(infoTask.id) ?? []).length : 0
  const infoProjectTasks = infoProject ? scope.filter((t) => t.projectId === infoProject.id).length : 0
  const infoLeft = info ? Math.max(12, Math.min(info.x, window.innerWidth - 292)) : 0
  const infoTop = info ? Math.max(12, Math.min(info.y, window.innerHeight - 300)) : 0

  return (
    <>
      <Modal
        title={t('gantt.taskTree')}
        onClose={onClose}
        width={Math.max(320, Math.min(1100, window.innerWidth - 48))}
      >
        <div
          ref={canvasRef}
          className="-m-4 select-none overflow-auto bg-bg/30"
          style={{ height: dragH ?? undefined, maxHeight: '68vh' }}
          onScroll={(e) => {
            view.current = { left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop }
            setInfo(null)
          }}
          onMouseDown={(e) => {
            // Middle-drag pans; without this the browser starts its own
            // scroll-the-page mode on the same press.
            if (e.button === 1) e.preventDefault()
            setInfo(null)
          }}
          onPointerDown={(e) => {
            startPan(e)
            startMarquee(e)
          }}
          onPointerMove={(e) => {
            movePan(e)
            moveMarquee(e)
          }}
          onPointerUp={() => {
            endPan()
            endMarquee()
          }}
          onPointerCancel={() => {
            endPan()
            endMarquee()
          }}
        >
          <div
            ref={contentRef}
            className="relative"
            style={{
              width: geom.w,
              height: geom.h,
              // The canvas width is fixed, so a leftward drag needs the content
              // itself to grow past the viewport; without this term the scroll
              // has nothing to give back and the tree sticks at the left edge.
              minWidth: `calc(100% + ${Math.max(0, -geom.minLeft)}px)`,
              backgroundImage: 'radial-gradient(circle, rgb(var(--c-dim) / 0.16) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            {shownProjects.map((p) => (
              <div
                key={p.id}
                data-tree-id={p.id}
                style={{
                  position: 'absolute',
                  left: geom.pos[p.id]?.left ?? PAD_X,
                  top: geom.pos[p.id]?.top ?? PAD_Y,
                  width: 'max-content',
                }}
              >
                {projectNode(p)}
              </div>
            ))}
          </div>
        </div>
      </Modal>
      {box &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[75] rounded-[2px] border border-accent bg-accent/10"
            style={box}
          />,
          document.body,
        )}
      {info &&
        createPortal(
          <div
            className="fixed z-[80] max-h-[calc(100vh-24px)] w-[280px] overflow-auto rounded-[14px] border border-border/70 bg-panel/95 p-4 shadow-2xl backdrop-blur-md"
            style={{ left: infoLeft, top: infoTop }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {infoTask && (
              <>
                <div className="break-words text-[13px] font-semibold text-fg">{infoTask.name}</div>
                <div className="mt-1 font-mono text-[10px] text-dim">
                  {(wbs.get(infoTask.id) ?? '') + (infoTask.isTodo ? '' : ` · ${projectOf.get(infoTask.projectId)?.name ?? ''}`)}
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px] text-muted">
                  <Row label={t('common.status')}>
                    <span style={{ color: sigText(infoMeta.token) }}>{t(infoMeta.labelKey)}</span>
                  </Row>
                  <Row label={t('common.progress')}>
                    <span className="font-mono text-fg">
                      {infoState?.progress != null ? `${infoState.progress}%` : t('common.none')}
                    </span>
                  </Row>
                  <Row label={t('common.start')}>
                    <span className="font-mono text-fg/90">{infoTask.startDate ?? t('common.none')}</span>
                  </Row>
                  <Row label={t('common.end')}>
                    <span className="font-mono text-fg/90">{infoTask.endDate ?? t('common.none')}</span>
                  </Row>
                  {infoTask.priority && (
                    <Row label={t('common.priority')}>
                      <span style={{ color: sigText(infoPriority!.token) }}>{t(infoPriority!.labelKey)}</span>
                    </Row>
                  )}
                  {infoKids > 0 && <Row label={t('taskTree.subtasks', { count: infoKids })} />}
                  {infoTask.tags.length > 0 && (
                    <Row label={t('common.tags')}>
                      <span className="text-fg/90">{infoTask.tags.join(' · ')}</span>
                    </Row>
                  )}
                </div>
                {infoTask.description && (
                  <div className="mt-2.5 max-h-[120px] overflow-auto whitespace-pre-line border-t border-line pt-2.5 text-[11px] leading-relaxed text-muted">
                    {infoTask.description}
                  </div>
                )}
              </>
            )}
            {infoProject && (
              <>
                <div className="break-words text-[13px] font-semibold" style={{ color: infoProject.color }}>
                  {infoProject.name}
                </div>
                <div className="mt-1 text-[11px] text-muted">{t('taskTree.taskCount', { count: infoProjectTasks })}</div>
                {infoProject.description && (
                  <div className="mt-2.5 whitespace-pre-line border-t border-line pt-2.5 text-[11px] leading-relaxed text-muted">
                    {infoProject.description}
                  </div>
                )}
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

function Row({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      {children}
    </div>
  )
}

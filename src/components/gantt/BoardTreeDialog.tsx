import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus } from 'lucide-react'
import { Project, Task } from '../../types'
import { buildChildrenMap, computeWbs, effectiveStates, liveTasks, projectsInView } from '../../lib/tree'
import { priorityMeta, sig, sigText, STATUS_META } from '../../lib/ui'
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
 * The free margin on the canvas's top and left, in px — room to drag a tree up
 * and left. Large enough for a deep tree to be carried beside the one above it,
 * which is the move the margin exists for.
 */
const FREE = 4000

interface TreeDrag {
  id: string
  /** The pointer when the press began, and the scroll offset it began at. */
  x: number
  y: number
  scrollLeft: number
  scrollTop: number
  /** The tree's offset when the press began. */
  ox: number
  oy: number
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

  // Projects are open, tasks are not. Keyed by the same ids the boxes use, so a
  // task's name can never collide with a project's.
  const [open, setOpen] = useState<Set<string>>(() => new Set(shownProjects.map((p) => `p:${p.id}`)))
  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const [info, setInfo] = useState<{ kind: 'task' | 'project'; id: string; x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Each project's tree floats: grab its root and move it anywhere on the
  // canvas. The fixed margin of `FREE` on the top and left is what lets a tree
  // be carried up and left as readily as down and right; the offset stops at
  // that margin, where the tree would be outside the scrollable area for good.
  const [offset, setOffset] = useState<Record<string, { x: number; y: number }>>({})
  const [dragId, setDragId] = useState<string | null>(null)
  const treeDrag = useRef<TreeDrag | null>(null)
  const dragPointer = useRef<{ x: number; y: number } | null>(null)
  const autoScroll = useRef<number | null>(null)

  // Where the tree must sit so its grabbed point stays under the pointer. The
  // scroll term is the whole of it: without it an auto-scroll moves the content
  // out from under the pointer, and the next pointermove snaps the tree back by
  // the distance the canvas travelled — which reads as the cursor drifting off
  // the node.
  const dragOffset = (d: TreeDrag, px: number, py: number) => {
    const el = canvasRef.current
    const sx = el ? el.scrollLeft - d.scrollLeft : 0
    const sy = el ? el.scrollTop - d.scrollTop : 0
    return {
      x: Math.max(-FREE, d.ox + (px - d.x) + sx),
      y: Math.max(-FREE, d.oy + (py - d.y) + sy),
    }
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
    setOffset((o) => ({ ...o, [d.id]: dragOffset(d, p.x, p.y) }))
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
    e.stopPropagation()
    panMoved.current = false
    const o = offset[id] ?? { x: 0, y: 0 }
    const el = canvasRef.current
    treeDrag.current = {
      id,
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el?.scrollLeft ?? 0,
      scrollTop: el?.scrollTop ?? 0,
      ox: o.x,
      oy: o.y,
      moved: false,
    }
    dragPointer.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragId(id)
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
    setOffset((o) => ({ ...o, [d.id]: dragOffset(d, e.clientX, e.clientY) }))
    startAutoScroll()
  }
  const endTreeDrag = () => {
    treeDrag.current = null
    dragPointer.current = null
    stopAutoScroll()
    setDragId(null)
  }

  // The canvas grows by however far a tree has been carried, so nothing dragged
  // right or down can end up outside the area that scrolls.
  const room = useMemo(() => {
    let x = 0
    let y = 0
    for (const o of Object.values(offset)) {
      x = Math.max(x, o.x)
      y = Math.max(y, o.y)
    }
    return { x, y }
  }, [offset])

  // Drag to pan, the way a map moves. A press that does not travel is still a
  // click: `panMoved` is what keeps a pan from opening a node's card on release.
  const panRef = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const panMoved = useRef(false)
  const startPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
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

  // Open on the first tree rather than on the empty margin the free-drag area
  // reserves. The root is centred against its own children, so on a tall tree
  // it sits halfway down — scroll to that half, not to the top of the column.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const first = contentRef.current?.firstElementChild as HTMLElement | null
    el.scrollLeft = FREE
    el.scrollTop = first ? Math.max(0, 40 + FREE + (first.offsetHeight - el.clientHeight) / 2) : FREE
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (info) setInfo(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [info, onClose])

  const show = (e: ReactMouseEvent<HTMLElement>, kind: 'task' | 'project', id: string) => {
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
          onClick={(e) => show(e, 'task', task.id)}
          className={`flex max-w-[220px] cursor-pointer flex-col items-start gap-0.5 rounded-[12px] border px-3 py-2 text-left shadow-sm transition-all duration-200 hover:-translate-y-px hover:shadow-md ${
            selected
              ? 'border-accent bg-panel ring-2 ring-accent/20'
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
    const at = offset[project.id] ?? { x: 0, y: 0 }
    return (
      <div
        className={`relative flex items-center ${dragId === project.id ? 'z-20' : ''}`}
        style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
      >
        <button
          type="button"
          onClick={(e) => show(e, 'project', project.id)}
          onPointerDown={(e) => startTreeDrag(e, project.id)}
          onPointerMove={moveTreeDrag}
          onPointerUp={endTreeDrag}
          onPointerCancel={endTreeDrag}
          className={`max-w-[220px] cursor-grab truncate rounded-[12px] border px-4 py-2 text-[12.5px] font-semibold transition-all duration-200 hover:-translate-y-px active:cursor-grabbing ${
            dragId === project.id
              ? 'scale-[1.02] shadow-lg ring-2 ring-accent/50'
              : selected
                ? 'ring-2 ring-accent/30'
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
          className="-m-4 h-[68vh] cursor-grab select-none overflow-auto bg-bg/30 active:cursor-grabbing"
          onScroll={() => setInfo(null)}
          onMouseDown={() => setInfo(null)}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <div
            ref={contentRef}
            className="inline-flex min-h-full min-w-full flex-col items-start gap-16"
            style={{
              paddingTop: 40 + FREE,
              paddingLeft: 40 + FREE,
              // The same margin on the far side, or the browser cannot scroll the
              // near one away: a short tree makes the content barely wider than
              // the viewport, and `scrollLeft = FREE` clamps, leaving a column of
              // empty margin on the left.
              paddingRight: 40 + FREE + room.x,
              paddingBottom: 40 + FREE + room.y,
              backgroundImage: 'radial-gradient(circle, rgb(var(--c-dim) / 0.16) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            {shownProjects.map((p) => (
              <div key={p.id}>{projectNode(p)}</div>
            ))}
          </div>
        </div>
      </Modal>
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

import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent as ReactClipboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronsRight, GripHorizontal, Plus, StickyNote as StickyNoteIcon, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useT } from '../lib/useT'
import { useDialogs } from './dialogs'
import { StickyNameDialog } from './StickyNameDialog'
import { useDismiss } from '../lib/useDismiss'
import type { StickyNote } from '../types'
import {
  MIN_STICKY_H,
  MIN_STICKY_W,
  STICKY_H,
  STICKY_MARGIN,
  STICKY_W,
  SNAP_ZONE,
  clampSnapAt,
  clampSticky,
  insideRect,
  newStickyAt,
  nextZ,
  noteHtml,
  sanitizeNoteHtml,
  snapAtForRect,
  snapSideForRect,
  stickyPoint,
} from '../lib/sticky'
import type { SnapSide, StickyRect } from '../lib/sticky'

/** Everything a press outside the board must not dismiss on. */
const KEEP = '[data-sticky-board], [data-sticky-card], [data-sticky-chip], [data-sticky-tab], [data-modal]'
/** Space the floating panel keeps from the window edges. */
const BOARD_MARGIN = 20
/** Distance from the window's top edge: below the toolbar and plan tag. */
const BOARD_TOP = 64
/** The sidebar is w-[190px]; the page's left edge is its right edge. */
const PAGE_LEFT = 190

/**
 * The corkboard beside the app, and the cards that can leave it.
 *
 * One body-portalled layer, rendered once from App: the shell is a flex box
 * with `overflow-hidden`, so anything inside it would be clipped by the page it
 * happened to be in. The board is a floating 16:9 panel that slides in from the
 * right edge; cards use viewport coordinates whether they sit on the board or
 * out on the app, which is what makes dragging one off the cork a move rather
 * than a coordinate conversion.
 *
 * `docked` is membership, not position: a docked card is shown only while the
 * board is open, and a card dragged out stays on screen after it slides away.
 * Collapsing is a click anywhere outside the board, the cards and any modal —
 * the document listener lets that click land on the app underneath, rather than
 * swallowing it with a backdrop.
 *
 * The layer's z-index is fixed at 87, above pages (30–40), modals (60) and
 * menus (70–80), and below the confirmation dialogs (90) — a delete question
 * must never be buried under the thing it is asking about. Cards are ordered by
 * `z` in the DOM rather than by a z-index each, so a pile of notes cannot creep
 * up over that ceiling.
 */
export function StickyNotes() {
  const t = useT()
  const notes = useStore((s) => s.stickyNotes)
  const addStickyNote = useStore((s) => s.addStickyNote)
  const updateStickyNote = useStore((s) => s.updateStickyNote)
  const removeStickyNote = useStore((s) => s.removeStickyNote)
  const { ask, element: dialogs } = useDialogs()

  // Session-only, and shut at start: an overlay that covers the app on launch
  // would be work the user did not ask for.
  const [open, setOpen] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  // A chip pulled out of its edge becomes a card still held by the pointer.
  const [pull, setPull] = useState<{ id: string; pos: { x: number; y: number } } | null>(null)
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // A compact 16:9 panel in the top-right corner. Derived rather than measured:
  // the drop test needs the same rectangle the CSS lays out, and computing it
  // here keeps them from disagreeing — including while the slide-in transform
  // is still running.
  const availW = Math.max(300, viewport.w - BOARD_MARGIN * 2)
  const availH = Math.max(180, viewport.h - BOARD_TOP - BOARD_MARGIN)
  const boardW = Math.min(availW, (availH * 16) / 9, 680)
  const boardH = (boardW * 9) / 16
  const panel: StickyRect = {
    left: viewport.w - BOARD_MARGIN - boardW,
    top: BOARD_TOP,
    right: viewport.w - BOARD_MARGIN,
    bottom: BOARD_TOP + boardH,
  }

  const docked = notes.filter((n) => n.docked)
  // Docked cards stay mounted through the slide so they travel with the board;
  // their own transform/visibility below is what takes them off screen.
  const snapped = notes.filter((n) => n.snapped)
  const visible = notes.filter((n) => !n.snapped).sort((a, b) => a.z - b.z)
  const topId = visible.length > 0 ? visible[visible.length - 1].id : null
  // The board's own closed transform is `100% + 56px`, whose 100% is its width;
  // a docked card is shifted by the same number of pixels so the paper and the
  // cork move as one object.
  const slide = open ? 0 : boardW + 56

  // One write per activation, and none for the card already on top.
  const raise = (id: string) => {
    if (id === topId) return
    updateStickyNote(id, { z: nextZ(notes) })
  }

  const add = () => {
    setFocusId(addStickyNote(newStickyAt(panel)))
  }

  const remove = (id: string) => {
    ask(t('sticky.deleteConfirm'), () => removeStickyNote(id))
  }

  // The chip has already left its edge; this turns the same gesture into a card
  // drag. Window listeners are used because the chip that owned the pointer is
  // about to unmount and its capture goes with it.
  const startPull = (id: string, pointerId: number, clientX: number, clientY: number) => {
    const note = notes.find((n) => n.id === id)
    if (!note) return
    const w = note.w ?? STICKY_W
    const h = note.h ?? STICKY_H
    const start = clampSticky(clientX - w / 2, clientY - h / 2, window.innerWidth, window.innerHeight, w, h)
    setPull({ id, pos: start })
    updateStickyNote(id, { snapped: null, snapAt: 0, docked: false, x: start.x, y: start.y, z: nextZ(notes) })

    let last = start
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      e.preventDefault()
      last = clampSticky(e.clientX - w / 2, e.clientY - h / 2, window.innerWidth, window.innerHeight, w, h)
      setPull({ id, pos: last })
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      last = clampSticky(e.clientX - w / 2, e.clientY - h / 2, window.innerWidth, window.innerHeight, w, h)
      setPull(null)
      if (open && insideRect(e.clientX, e.clientY, panel)) {
        updateStickyNote(id, { x: last.x, y: last.y, docked: true, snapped: null })
      } else {
        const rect = { left: last.x, top: last.y, right: last.x + w, bottom: last.y + h }
        const side = snapSideForRect(rect, window.innerWidth, window.innerHeight, PAGE_LEFT)
        if (side) {
          updateStickyNote(id, {
            x: last.x,
            y: last.y,
            snapped: side,
            snapAt: snapAtForRect(side, rect, window.innerWidth, window.innerHeight, PAGE_LEFT),
            docked: false,
          })
        } else {
          updateStickyNote(id, { x: last.x, y: last.y, docked: false, snapped: null })
        }
      }
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const close = () => {
    setOpen(false)
    setFocusId(null)
  }

  // A new card should get the caret once; a later re-mount should not steal it
  // back from whatever the user is doing.
  useEffect(() => {
    if (!focusId) return
    const id = window.setTimeout(() => setFocusId(null), 1200)
    return () => window.clearTimeout(id)
  }, [focusId])

  return createPortal(
    <>
      <Board
        open={open}
        panel={panel}
        count={docked.length}
        onAdd={add}
        onClose={close}
      />
      {/* The tab is the way in; while the board is out it would sit on its
          edge and fight it for the same corner. The board's own « and the
          click outside are the way back. */}
      {!open && (
        <Tab onOpen={() => setOpen(true)} />
      )}

      {/* Always mounted: cards dragged off the board outlive it. */}
      <div className="pointer-events-none fixed inset-0 z-[87]">
        {visible.map((n) => (
          <StickyCard
            key={n.id}
            note={n}
            viewport={viewport}
            dropRect={open ? panel : null}
            slide={n.docked ? slide : 0}
            open={open}
            pullPos={pull?.id === n.id ? pull.pos : null}
            autoFocus={n.id === focusId}
            onRaise={() => raise(n.id)}
            onDelete={() => remove(n.id)}
            onRename={() => setRenameId(n.id)}
          />
        ))}
        {snapped.map((n) => (
          <SnapChip
            key={n.id}
            note={n}
            viewport={viewport}
            onRename={() => setRenameId(n.id)}
            onPullOut={(x, y, pointerId) => startPull(n.id, pointerId, x, y)}
            onExpand={() => updateStickyNote(n.id, { snapped: null, snapAt: 0, z: nextZ(notes) })}
            onPlace={(side, at) => updateStickyNote(n.id, { snapped: side, snapAt: at, docked: false })}
            onExpandAt={(x, y) => {
              const w = n.w ?? STICKY_W
              const h = n.h ?? STICKY_H
              const at = clampSticky(x - w / 2, y - h / 2, viewport.w, viewport.h, w, h)
              updateStickyNote(n.id, {
                snapped: null,
                snapAt: 0,
                x: at.x,
                y: at.y,
                docked: false,
                z: nextZ(notes),
              })
            }}
          />
        ))}
      </div>

      {renameId && (() => {
        const n = notes.find((x) => x.id === renameId)
        return n ? (
          <StickyNameDialog
            initial={n.name ?? ''}
            onSave={(name) => updateStickyNote(n.id, { name })}
            onClose={() => setRenameId(null)}
          />
        ) : null
      })()}

      {dialogs}
    </>,
    document.body,
  )
}

function Board({
  open,
  panel,
  count,
  onAdd,
  onClose,
}: {
  open: boolean
  panel: StickyRect
  count: number
  onAdd: () => void
  onClose: () => void
}) {
  const t = useT()
  // The keep list is the user's rule in one line: presses on the board, on any
  // card (including the ones outside) and on a confirmation dialog do not put
  // the board away; every other press does, and still reaches the app. The hook
  // stays mounted through the slide-out, so the guard keeps a closed board from
  // reacting.
  useDismiss(KEEP, () => {
    if (open) onClose()
  })

  return (
    <aside
      data-sticky-board
      data-open={open}
      aria-hidden={!open}
      aria-label={t('sticky.title')}
      className="sticky-board fixed z-[85] flex flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
      style={{
        left: panel.left,
        top: panel.top,
        width: panel.right - panel.left,
        height: panel.bottom - panel.top,
      }}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="text-[12px] font-semibold text-fg">{t('sticky.title')}</span>
        <span className="flex-1" />
        <button
          onClick={onAdd}
          title={t('sticky.add')}
          aria-label={t('sticky.add')}
          className="rounded-md p-1 text-dim transition-colors hover:bg-panel2 hover:text-fg"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={onClose}
          title={t('sticky.collapse')}
          aria-label={t('sticky.collapse')}
          className="rounded-md p-1 text-dim transition-colors hover:bg-panel2 hover:text-fg"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden bg-bg/30">
        {count === 0 && (
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 text-center text-[11px] leading-relaxed text-dim">
            {t('sticky.empty')}
          </div>
        )}
      </div>
    </aside>
  )
}

function Tab({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  return (
    <button
      type="button"
      data-sticky-tab
      aria-label={t('sticky.expand')}
      aria-expanded={false}
      title={t('sticky.expand')}
      onClick={onOpen}
      style={{ writingMode: 'vertical-rl' }}
      className="sticky-tab fixed right-0 top-24 z-[86] px-1.5 py-3"
    >
      <span className="flex items-center gap-1.5 text-[13px] font-medium tracking-wider">
        <StickyNoteIcon size={15} />
        {t('sticky.title')}
      </span>
    </button>
  )
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** Windows-style resize targets: four edges, four corners. */
const RESIZE_HANDLES: { dir: ResizeDir; className: string }[] = [
  { dir: 'n', className: 'left-2 right-2 top-0 h-1.5 cursor-ns-resize' },
  { dir: 's', className: 'left-2 right-2 bottom-0 h-1.5 cursor-ns-resize' },
  { dir: 'w', className: 'top-2 bottom-2 left-0 w-1.5 cursor-ew-resize' },
  { dir: 'e', className: 'top-2 bottom-2 right-0 w-1.5 cursor-ew-resize' },
  { dir: 'nw', className: 'left-0 top-0 h-2.5 w-2.5 cursor-nwse-resize' },
  { dir: 'ne', className: 'right-0 top-0 h-2.5 w-2.5 cursor-nesw-resize' },
  { dir: 'sw', className: 'left-0 bottom-0 h-2.5 w-2.5 cursor-nesw-resize' },
  { dir: 'se', className: 'right-0 bottom-0 h-2.5 w-2.5 cursor-nwse-resize' },
]

function SnapHint({ side }: { side: SnapSide }) {
  const style =
    side === 'top'
      ? { left: PAGE_LEFT, right: 0, top: 0, height: SNAP_ZONE }
      : side === 'left'
        ? { left: PAGE_LEFT, top: 0, bottom: 0, width: SNAP_ZONE }
        : { right: 0, top: 0, bottom: 0, width: SNAP_ZONE }
  return (
    <div
      aria-hidden
      style={style}
      className="pointer-events-none fixed bg-accent/15 ring-1 ring-inset ring-accent/50"
    />
  )
}

/**
 * A snapped note, collapsed into a name chip on a page edge.
 *
 * Clicking expands it back to the card it came from; dragging the chip along
 * its edge repositions it without expanding it — the same two gestures a
 * Windows taskbar button has.
 */
/**
 * A snapped note, collapsed into a name chip on a page edge.
 *
 * It has the two gestures of a Windows taskbar button and one more: a click
 * expands it back to the card, a drag along the edge repositions it, and a drag
 * away from every edge (or onto another edge) pulls it out / moves it there.
 * While it is off the edge the chip follows the pointer and the target edge
 * lights up, so the release is not a guess.
 */
function SnapChip({
  note,
  viewport,
  onRename,
  onPullOut,
  onExpand,
  onPlace,
  onExpandAt,
}: {
  note: StickyNote
  viewport: { w: number; h: number }
  onRename: () => void
  /** Leave the edge and keep dragging the expanded card. */
  onPullOut: (x: number, y: number, pointerId: number) => void
  onExpand: () => void
  /** Snap to `side` at `at` — the same edge or another one. */
  onPlace: (side: SnapSide, at: number) => void
  /** Pull out and expand, with the card centred on this point. */
  onExpandAt: (x: number, y: number) => void
}) {
  const t = useT()
  const side = note.snapped ?? 'top'
  const stored = clampSnapAt(side, note.snapAt ?? 0, viewport.w, viewport.h, PAGE_LEFT)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(
    null,
  )
  const chipSize = useRef({ w: 0, h: 0 })
  const chipRect = dragPos
    ? {
        left: dragPos.x - chipSize.current.w / 2,
        top: dragPos.y - chipSize.current.h / 2,
        right: dragPos.x + chipSize.current.w / 2,
        bottom: dragPos.y + chipSize.current.h / 2,
      }
    : null
  const target = chipRect ? snapSideForRect(chipRect, viewport.w, viewport.h, PAGE_LEFT) : null
  const vertical = side !== 'top'
  const edgePos =
    side === 'top'
      ? { left: stored, top: 0 }
      : side === 'left'
        ? { left: PAGE_LEFT, top: stored }
        : { right: 0, top: stored }
  const style = dragPos
    ? {
        left: dragPos.x,
        top: dragPos.y,
        transform: 'translate(-50%, -50%)',
        zIndex: 90,
      }
    : edgePos

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = e.currentTarget.getBoundingClientRect()
    chipSize.current = { w: r.width, h: r.height }
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < 4 && Math.abs(e.clientY - d.startY) < 4) return
      d.moved = true
    }
    // The chip itself is out of every snap strip: expand and keep dragging.
    const r = {
      left: e.clientX - chipSize.current.w / 2,
      top: e.clientY - chipSize.current.h / 2,
      right: e.clientX + chipSize.current.w / 2,
      bottom: e.clientY + chipSize.current.h / 2,
    }
    if (!snapSideForRect(r, viewport.w, viewport.h, PAGE_LEFT)) {
      drag.current = null
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      setDragPos(null)
      onPullOut(e.clientX, e.clientY, e.pointerId)
      return
    }
    setDragPos({ x: e.clientX, y: e.clientY })
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!d) return
    if (!d.moved) {
      setDragPos(null)
      onExpand()
      return
    }
    const pos = { x: e.clientX, y: e.clientY }
    const r = {
      left: pos.x - chipSize.current.w / 2,
      top: pos.y - chipSize.current.h / 2,
      right: pos.x + chipSize.current.w / 2,
      bottom: pos.y + chipSize.current.h / 2,
    }
    const dropSide = snapSideForRect(r, viewport.w, viewport.h, PAGE_LEFT)
    setDragPos(null)
    if (dropSide) {
      onPlace(dropSide, snapAtForRect(dropSide, r, viewport.w, viewport.h, PAGE_LEFT))
    } else {
      onExpandAt(pos.x, pos.y)
    }
  }

  const onPointerCancel = () => {
    drag.current = null
    setDragPos(null)
  }

  const name = note.name || t('sticky.title')

  return (
    <>
      {dragPos && target && <SnapHint side={target} />}
      <button
        type="button"
        data-sticky-chip
        title={`${name} · ${t('sticky.expandNote')}`}
        aria-label={`${name} — ${t('sticky.expandNote')}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => {
          e.preventDefault()
          onRename()
        }}
        onClick={(e) => {
          if (e.detail === 0) onExpand()
        }}
        style={{
          ...style,
          writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
          ...(vertical ? { textOrientation: 'upright' as const } : {}),
        }}
        className={`pointer-events-auto fixed z-[87] flex items-center gap-1.5 border border-accent bg-accent px-2.5 py-1.5 text-[13px] font-medium text-on-accent shadow-[0_4px_18px_rgb(var(--c-accent)/0.45)] transition-[filter] hover:brightness-110 ${
          dragPos
            ? 'rounded-xl'
            : side === 'top'
              ? 'rounded-b-xl border-t-0'
              : side === 'left'
                ? 'rounded-r-xl border-l-0'
                : 'rounded-l-xl border-r-0'
        }`}
      >
        <StickyNoteIcon size={14} className="shrink-0" />
        <span
          className={
            vertical ? 'max-h-[132px] overflow-hidden whitespace-nowrap' : 'max-w-[132px] truncate'
          }
        >
          {name}
        </span>
      </button>
    </>
  )
}

function StickyCard({
  note,
  viewport,
  dropRect,
  slide,
  open,
  pullPos,
  autoFocus,
  onRaise,
  onDelete,
  onRename,
}: {
  note: StickyNote
  viewport: { w: number; h: number }
  /** Where a drop counts as "on the board"; null while the board is closed. There
   *  is no board clamp: a note stays exactly where it was dropped. */
  dropRect: StickyRect | null
  /** How far off screen a docked card currently is. */
  slide: number
  open: boolean
  /** While a chip is being pulled out, the card follows this point. */
  pullPos: { x: number; y: number } | null
  autoFocus: boolean
  onRaise: () => void
  onDelete: () => void
  onRename: () => void
}) {
  const t = useT()
  const updateStickyNote = useStore((s) => s.updateStickyNote)
  const base = stickyPoint(note, viewport.w, viewport.h)

  // Moving and resizing both override the stored rectangle while the hand is
  // down; the store is written once on release.
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)

  const [snapHint, setSnapHint] = useState<SnapSide | null>(null)
  const [resizeRect, setResizeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const resize = useRef<{
    pointerId: number
    dir: ResizeDir
    startX: number
    startY: number
    from: { x: number; y: number; w: number; h: number }
  } | null>(null)
  const lastRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  const pos = pullPos ?? (resizeRect ? { x: resizeRect.x, y: resizeRect.y } : dragPos ?? base)
  const size = resizeRect
    ? { w: resizeRect.w, h: resizeRect.h }
    : { w: note.w ?? STICKY_W, h: note.h ?? STICKY_H }

  const editorRef = useRef<HTMLDivElement>(null)
  const dirty = useRef(false)
  const timer = useRef<number | null>(null)
  const lastHtml = useRef<string | null>(null)
  const savedRange = useRef<Range | null>(null)
  const [boldOn, setBoldOn] = useState(false)

  const commit = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    const el = editorRef.current
    if (!el || !dirty.current) return
    dirty.current = false
    // Zero-width characters are formatting carriers, not text.
    const hasText = (el.textContent ?? '').replace(/\u200B/g, '').trim() !== ''
    const html = hasText ? sanitizeNoteHtml(el.innerHTML).slice(0, 50_000) : ''
    lastHtml.current = html
    updateStickyNote(note.id, { text: html, rich: true })
  }
  const commitRef = useRef(commit)
  commitRef.current = commit
  useEffect(() => {
    const flush = () => commitRef.current()
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  // Seed once. `autoFocus` is applied here rather than as a prop because the
  // editor is uncontrolled: React must not rewrite its DOM while the caret is
  // in it.
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const html = noteHtml(note)
    el.innerHTML = html
    lastHtml.current = html
    if (autoFocus) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    // Mount only; later text changes are the adoption effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // An import can replace the text under a card; adopt it only when the editor
  // is not the thing being typed into.
  useEffect(() => {
    const el = editorRef.current
    if (!el || document.activeElement === el) return
    const html = noteHtml(note)
    if (html === lastHtml.current) return
    el.innerHTML = html
    lastHtml.current = html
  }, [note.text, note.rich])

  const schedule = () => {
    dirty.current = true
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => commitRef.current(), 600)
  }

  const onBlur = () => {
    const el = editorRef.current
    // A blur after deleting everything should leave an empty, placeholder-
    // showing editor rather than a lone <br> or a formatting zero-width.
    if (el && (el.textContent ?? '').replace(/\u200B/g, '').trim() === '') el.innerHTML = ''
    commit()
    setBoldOn(false)
  }

  // Query the selection's weight, the way Word lights its B button: a press
  // inside bold text, or a caret with a bold typing state, reads as on.
  const refreshBold = () => {
    const el = editorRef.current
    const sel = document.getSelection()
    const inside =
      !!el &&
      !!sel &&
      sel.rangeCount > 0 &&
      (sel.anchorNode === el || (sel.anchorNode != null && el.contains(sel.anchorNode)))
    setBoldOn(inside ? document.queryCommandState('bold') : false)
  }
  useEffect(() => {
    document.addEventListener('selectionchange', refreshBold)
    return () => document.removeEventListener('selectionchange', refreshBold)
    // The ref and setter are stable; one listener per card is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bold = () => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand('bold')
    refreshBold()
    schedule()
  }

  // Font size on a collapsed caret: the command alone changes the typing state
  // but not the caret's height. A zero-width character inside the font gives
  // the caret that size now, and the next typed text inherits it.
  const setSize = (size: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    document.execCommand('styleWithCSS', false, 'false')
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      document.execCommand('fontSize', false, size)
    } else {
      document.execCommand('insertHTML', false, `<font size="${size}">\u200B</font>`)
    }
    schedule()
  }

  // The native colour picker takes focus; keep the range so the colour lands on
  // the text that was selected when the picker was opened.
  const rememberRange = () => {
    const sel = window.getSelection()
    savedRange.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null
  }

  const setColor = (color: string) => {
    const el = editorRef.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    if (savedRange.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
      savedRange.current = null
    }
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand('foreColor', false, color)
    schedule()
  }

  const onPaste = (e: ReactClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    schedule()
  }

  const onGripDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
    e.preventDefault()
    setSnapHint(null)
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    }
  }

  const onGripMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < 4 && Math.abs(e.clientY - d.startY) < 4) return
      d.moved = true
    }
    const p = clampSticky(
      d.originX + e.clientX - d.startX,
      d.originY + e.clientY - d.startY,
      viewport.w,
      viewport.h,
      size.w,
      size.h,
    )
    setDragPos(p)
    const overBoard = dropRect != null && insideRect(e.clientX, e.clientY, dropRect)
    setSnapHint(
      overBoard
        ? null
        : snapSideForRect(
            { left: p.x, top: p.y, right: p.x + size.w, bottom: p.y + size.h },
            viewport.w,
            viewport.h,
            PAGE_LEFT,
          ),
    )
  }

  const onGripUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!d) return
    setSnapHint(null)
    if (!d.moved) {
      setDragPos(null)
      return
    }
    const p = clampSticky(
      d.originX + e.clientX - d.startX,
      d.originY + e.clientY - d.startY,
      viewport.w,
      viewport.h,
      size.w,
      size.h,
    )
    // The pointer, not the card's corner: "I dropped it on the cork" is what
    // the hand meant, even when the card was grabbed near its far edge. A
    // closed board is not a target: its rect is only for drawing.
    setDragPos(null)
    const board = dropRect != null && insideRect(e.clientX, e.clientY, dropRect)
    if (board && dropRect) {
      updateStickyNote(note.id, { x: p.x, y: p.y, docked: true, snapped: null })
      return
    }
    const rect = { left: p.x, top: p.y, right: p.x + size.w, bottom: p.y + size.h }
    const side = snapSideForRect(rect, viewport.w, viewport.h, PAGE_LEFT)
    if (side) {
      updateStickyNote(note.id, {
        x: p.x,
        y: p.y,
        docked: false,
        snapped: side,
        snapAt: snapAtForRect(side, rect, viewport.w, viewport.h, PAGE_LEFT),
      })
      return
    }
    updateStickyNote(note.id, { x: p.x, y: p.y, docked: false, snapped: null })
  }

  const onGripCancel = () => {
    drag.current = null
    setDragPos(null)
    setSnapHint(null)
  }

  const onResizeDown = (dir: ResizeDir) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const from = { x: pos.x, y: pos.y, w: size.w, h: size.h }
    resize.current = {
      pointerId: e.pointerId,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      from,
    }
    lastRect.current = from
    setResizeRect(from)
  }

  const onResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = resize.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    // The card grows/shrinks inside the board when it is on one, otherwise
    // inside the window. North/west edges move the card's origin.
    // Free placement: resizing is bounded by the window, not by the board.
    const box = {
      left: STICKY_MARGIN,
      top: STICKY_MARGIN,
      right: viewport.w - STICKY_MARGIN,
      bottom: viewport.h - STICKY_MARGIN,
    }
    let { x, y, w, h } = d.from
    if (d.dir.includes('e')) w = Math.min(box.right - x, Math.max(MIN_STICKY_W, w + dx))
    if (d.dir.includes('s')) h = Math.min(box.bottom - y, Math.max(MIN_STICKY_H, h + dy))
    if (d.dir.includes('w')) {
      const right = x + w
      x = Math.max(box.left, Math.min(right - MIN_STICKY_W, x + dx))
      w = right - x
    }
    if (d.dir.includes('n')) {
      const bottom = y + h
      y = Math.max(box.top, Math.min(bottom - MIN_STICKY_H, y + dy))
      h = bottom - y
    }
    const next = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
    lastRect.current = next
    setResizeRect(next)
  }

  const onResizeUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    resize.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    const last = lastRect.current
    lastRect.current = null
    setResizeRect(null)
    if (!last) return
    const before = { x: note.x, y: note.y, w: note.w ?? STICKY_W, h: note.h ?? STICKY_H }
    if (last.x !== before.x || last.y !== before.y || last.w !== before.w || last.h !== before.h) {
      updateStickyNote(note.id, last)
    }
  }

  const onResizeCancel = () => {
    resize.current = null
    lastRect.current = null
    setResizeRect(null)
  }

  return (
    <>
      {snapHint && <SnapHint side={snapHint} />}
      <div
        data-sticky-card
      data-open={note.docked ? open : undefined}
      onPointerDown={onRaise}
      className={`group/card pointer-events-auto absolute ${note.docked ? 'sticky-card-docked' : ''}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        transform: `translateX(${slide}px)`,
      }}
    >
      {/* The 6px ring is the resize target, so the toolbar can own the top
          without a title bar between it and the text. */}
      {RESIZE_HANDLES.map((h) => (
        <div
          key={h.dir}
          aria-hidden
          onPointerDown={onResizeDown(h.dir)}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeCancel}
          className={`absolute z-20 transition-colors hover:bg-accent/20 ${h.className}`}
        />
      ))}

      <div className="absolute inset-1.5 flex flex-col overflow-hidden rounded-md border border-border bg-panel2 shadow-md transition-[border-color,box-shadow] focus-within:border-accent/60 hover:border-accent/40 hover:shadow-lg">
        {/* The name row is the drag handle; the name is read-only here and
            renamed from its context menu (right-click). */}
        <div className="flex h-6 shrink-0 items-center gap-1 border-b border-border/60 px-1.5">
          <div
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={onGripCancel}
            onContextMenu={(e) => {
              e.preventDefault()
              onRename()
            }}
            title={t('sticky.drag')}
            className="flex h-full min-w-0 flex-1 touch-none cursor-grab select-none items-center gap-1 active:cursor-grabbing"
          >
            <GripHorizontal size={14} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-fg" title={note.name || t('sticky.title')}>
              {note.name || t('sticky.title')}
            </span>
          </div>
          <button
            onClick={onDelete}
            title={t('sticky.delete')}
            aria-label={t('sticky.delete')}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-dim opacity-0 transition-opacity hover:bg-fg/10 hover:text-delayed focus-visible:opacity-100 group-hover/card:opacity-100"
          >
            <X size={12} />
          </button>
        </div>

        {/* Formatting applies to the selection. `onMouseDown` is prevented so
            pressing a button does not take the selection away from the editor. */}
        <div
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault()
          }}
          className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border/60 px-1.5"
        >
          <button
            onClick={bold}
            title={t('sticky.bold')}
            aria-label={t('sticky.bold')}
            aria-pressed={boldOn}
            className={`grid h-5 w-5 place-items-center rounded text-[11px] font-bold ${
              boldOn ? 'bg-fg/10 text-fg' : 'text-muted hover:bg-fg/10 hover:text-fg'
            }`}
          >
            B
          </button>
          <span className="mx-0.5 h-3 w-px bg-border/60" />
          {[
            { size: '2', label: 'A−', key: 'sticky.sizeSmall' as const },
            { size: '3', label: 'A', key: 'sticky.sizeDefault' as const },
            { size: '5', label: 'A+', key: 'sticky.sizeLarge' as const },
          ].map((s) => (
            <button
              key={s.size}
              onClick={() => setSize(s.size)}
              title={t(s.key)}
              aria-label={t(s.key)}
              className="grid h-5 w-5 place-items-center rounded text-[10px] font-semibold text-muted hover:bg-fg/10 hover:text-fg"
            >
              {s.label}
            </button>
          ))}
          <span className="mx-0.5 h-3 w-px bg-border/60" />
          <input
            type="color"
            defaultValue="#d9534f"
            onMouseDown={rememberRange}
            onChange={(e) => setColor(e.currentTarget.value)}
            title={t('sticky.textColor')}
            aria-label={t('sticky.textColor')}
            className="h-5 w-5 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0"
          />
        </div>

        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label={note.name || t('sticky.title')}
          data-placeholder={t('sticky.placeholder')}
          onInput={schedule}
          onFocus={refreshBold}
          onBlur={onBlur}
          onPaste={onPaste}
          className="sticky-editor min-h-0 w-full flex-1 overflow-y-auto whitespace-pre-wrap px-2.5 py-2 pb-3 text-[12px] leading-relaxed text-fg/90 outline-none"
        />
      </div>
    </div>
    </>
  )
}

/**
 * Geometry for the corkboard's cards. Pure: no React, no DOM, no window — the
 * viewport and the board's rectangle are always arguments.
 *
 * Cards are stored in viewport coordinates, and the board is only one place on
 * that canvas: a card on it may sit anywhere, so the clamp answers one question
 * — that the card is still somewhere inside the window after a resize.
 */

export const STICKY_W = 240
export const STICKY_H = 200
/** What a card may be resized down to before the editor loses its room. */
export const MIN_STICKY_W = 200
export const MIN_STICKY_H = 120
/** Height of a card's own grip strip, above the text. */
export const STICKY_HEADER = 24
/** The gap a card keeps from any edge it is clamped against. */
export const STICKY_MARGIN = 8
/** What the board's own header takes off the top of its interior. */
export const BOARD_HEADER = 44

export interface StickyRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** A point inside the window, with a card's whole width and height visible. */
export function clampSticky(
  x: number,
  y: number,
  viewportW: number,
  viewportH: number,
  w: number = STICKY_W,
  h: number = STICKY_H,
): { x: number; y: number } {
  // `Math.max` on the far edge, not `Math.min`: a window narrower than a card
  // would otherwise hand back an upper bound below the lower one and a negative
  // slot. The card then sits at the left/top margin and overflows, which is
  // still findable and editable.
  const maxX = Math.max(STICKY_MARGIN, viewportW - w - STICKY_MARGIN)
  const maxY = Math.max(STICKY_MARGIN, viewportH - h - STICKY_MARGIN)
  return {
    x: Math.min(Math.max(STICKY_MARGIN, x), maxX),
    y: Math.min(Math.max(STICKY_MARGIN, y), maxY),
  }
}

/**
 * Where a stored card is drawn: its own point, clamped into the window. A card
 * on the board gets no further clamp — placement on the board is the user's,
 * and the board is just a rectangle on the same viewport.
 */
export function stickyPoint(
  note: { x: number; y: number; w?: number; h?: number },
  viewportW: number,
  viewportH: number,
): { x: number; y: number } {
  return clampSticky(note.x, note.y, viewportW, viewportH, note.w ?? STICKY_W, note.h ?? STICKY_H)
}

/**
 * Whether a drop landed on the board. The pointer, not the card's top-left:
 * "I dropped it on the cork" is what the hand meant, and a card grabbed near its
 * far edge would otherwise count as outside while sitting visibly on the board.
 * Half-open on the right/bottom so a point on the seam belongs to one side only.
 */
export function insideRect(x: number, y: number, rect: StickyRect): boolean {
  return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
}

/** The next stacking number: one above every finite `z` already in use. */
export function nextZ(notes: readonly { z: number }[]): number {
  let max = 0
  for (const n of notes) if (Number.isFinite(n.z) && n.z > max) max = n.z
  return Math.floor(max) + 1
}

export type SnapSide = 'top' | 'left' | 'right'

/** How close to a page edge a drop has to be to snap there. */
export const SNAP_ZONE = 28
/** The length of a collapsed chip along its edge, used for clamping. */
export const CHIP_SPAN = 140

/** The next number for a default note name; names are "标签 1", "标签 2"… */
export function nextStickyNumber(notes: readonly { name?: string }[]): number {
  let max = 0
  for (const n of notes) {
    const m = /(\d+)\s*$/.exec(n.name ?? '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max + 1
}

/** A fresh card's spot: the middle of the board. Where it goes next is the
 *  user's move — the old staircase was an automatic arrangement. */
export function newStickyAt(board: StickyRect): { x: number; y: number } {
  return {
    x: Math.round((board.left + board.right - STICKY_W) / 2),
    y: Math.round((board.top + BOARD_HEADER + board.bottom - STICKY_H) / 2),
  }
}

/** Do two rectangles share any area? Touching counts as overlap. */
export function rectsOverlap(a: StickyRect, b: StickyRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/**
 * Which page edge the dragged thing itself is touching — the card or the name
 * chip, not the pointer. A note can be large enough that the pointer is still
 * in the page while the note's edge is already on the strip, or the other way
 * round; "the note touched the edge" is the gesture the user made.
 */
export function snapSideForRect(
  rect: StickyRect,
  viewportW: number,
  viewportH: number,
  pageLeft: number,
): SnapSide | null {
  const top = { left: pageLeft, top: 0, right: viewportW, bottom: SNAP_ZONE }
  const left = { left: pageLeft, top: 0, right: pageLeft + SNAP_ZONE, bottom: viewportH }
  const right = { left: viewportW - SNAP_ZONE, top: 0, right: viewportW, bottom: viewportH }
  if (rectsOverlap(rect, top)) return 'top'
  if (rectsOverlap(rect, left)) return 'left'
  if (rectsOverlap(rect, right)) return 'right'
  return null
}

/** Keep a chip's position inside its edge. */
export function clampSnapAt(
  side: SnapSide,
  at: number,
  viewportW: number,
  viewportH: number,
  pageLeft: number,
): number {
  if (side === 'top') {
    const min = pageLeft + 8
    const max = Math.max(min, viewportW - CHIP_SPAN - 8)
    return Math.min(Math.max(min, at), max)
  }
  const max = Math.max(8, viewportH - CHIP_SPAN - 8)
  return Math.min(Math.max(8, at), max)
}

/** Where a snap drop puts the chip: centred on the dragged thing. */
export function snapAtForRect(
  side: SnapSide,
  rect: StickyRect,
  viewportW: number,
  viewportH: number,
  pageLeft: number,
): number {
  const center = side === 'top' ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2
  return clampSnapAt(side, center - CHIP_SPAN / 2, viewportW, viewportH, pageLeft)
}

/** Plain text as HTML — what a note written before formatting needs. */
export function escapeNoteHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>')
}

/** What the formatting commands are allowed to produce, and nothing else. */
const NOTE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN', 'FONT'])

/**
 * The card's body as safe HTML.
 *
 * Rich notes store the editor's HTML, and a hand-edited board file can contain
 * anything; `innerHTML` is the trust boundary. Only the tags the toolbar can
 * produce survive, and only a font's `color`/`size` attributes — everything
 * else is unwrapped to its text or stripped. Pasted content is inserted as
 * plain text beside this, so the editor itself never introduces a wider set.
 */
export function sanitizeNoteHtml(html: string): string {
  if (typeof document === 'undefined') return escapeNoteHtml(html)
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  const walk = (node: ParentNode) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) continue // text
      if (child.nodeType !== 1) {
        child.remove()
        continue
      }
      const el = child as HTMLElement
      const tag = el.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE') {
        el.remove()
        continue
      }
      walk(el)
      if (!NOTE_TAGS.has(tag)) {
        el.replaceWith(...Array.from(el.childNodes))
        continue
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase()
        if (tag === 'FONT' && (name === 'color' || name === 'size')) continue
        el.removeAttribute(attr.name)
      }
      if (tag === 'FONT') {
        const size = el.getAttribute('size')
        if (size != null && !/^[1-7]$/.test(size)) el.removeAttribute('size')
        const color = el.getAttribute('color')
        if (color != null && !/^#[0-9a-f]{3,8}$/i.test(color)) el.removeAttribute('color')
      }
    }
  }
  walk(tpl.content)
  return tpl.innerHTML
}

/** A stored note's body ready for the editor. */
export function noteHtml(note: { text: string; rich?: boolean }): string {
  return note.rich ? sanitizeNoteHtml(note.text) : escapeNoteHtml(note.text)
}

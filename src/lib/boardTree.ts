/**
 * The task-tree dialog's own layout: where each project tree floats, which
 * branches are open, and where the canvas was left.
 *
 * View state, not work data, so it lives in its own key rather than in `Prefs`
 * (which is the settings surface) or in the board blob (which is exported and
 * imported as someone else's data). It is written when the dialog closes — the
 * trees are arranged for the session, and a half-finished drag has no meaning
 * to keep.
 */
export interface TreeOffset {
  x: number
  y: number
}

export interface TreeScroll {
  left: number
  top: number
}

export interface BoardTreeState {
  open: string[]
  offset: Record<string, TreeOffset>
  scroll: TreeScroll
}

const KEY = 'wbs-gantt.boardTree'

// A tree offset may be negative: the canvas grows padding on the top and left
// to make that space scrollable. A scroll position cannot be negative, which is
// what the separate guard below says.
function isNonNegative(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

function isTreeOffset(v: unknown): v is TreeOffset {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.x === 'number' && Number.isFinite(o.x) && typeof o.y === 'number' && Number.isFinite(o.y)
}

function isTreeScroll(v: unknown): v is TreeScroll {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return isNonNegative(o.left) && isNonNegative(o.top)
}

export function loadBoardTree(): BoardTreeState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p: unknown = JSON.parse(raw)
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null
    const blob = p as Record<string, unknown>

    const offset: Record<string, TreeOffset> = {}
    if (typeof blob.offset === 'object' && blob.offset !== null && !Array.isArray(blob.offset)) {
      for (const [id, v] of Object.entries(blob.offset as Record<string, unknown>)) {
        if (isTreeOffset(v)) offset[id] = { x: v.x, y: v.y }
      }
    }

    const scroll = isTreeScroll(blob.scroll)
      ? { left: blob.scroll.left, top: blob.scroll.top }
      : { left: 0, top: 0 }

    return {
      open: Array.isArray(blob.open) ? blob.open.filter((x): x is string => typeof x === 'string') : [],
      offset,
      scroll,
    }
  } catch {
    return null
  }
}

export function saveBoardTree(state: BoardTreeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/** Move a group of trees by the same delta, keeping relative positions. */
export function moveGroup(
  offset: Record<string, TreeOffset>,
  ids: string[],
  dx: number,
  dy: number,
): Record<string, TreeOffset> {
  const out = { ...offset }
  for (const id of ids) {
    const at = offset[id] ?? { x: 0, y: 0 }
    out[id] = { x: at.x + dx, y: at.y + dy }
  }
  return out
}

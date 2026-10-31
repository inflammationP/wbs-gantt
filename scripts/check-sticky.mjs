/**
 * The one check on the corkboard's geometry, run with
 * `node scripts/check-sticky.mjs`.
 *
 * Cards are stored in viewport coordinates and clamped again when drawn, so
 * these helpers decide whether a card is reachable at all. The rules are small
 * but they are the difference between "a note fell off the screen" and "a note
 * is where you left it": the four edges of the window, the board's interior,
 * and the half-open boundary a drop is judged against.
 *
 * No DOM and no window: the viewport and the board rectangle are arguments.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const {
  STICKY_W,
  STICKY_H,
  BOARD_HEADER,
  clampSticky,
  stickyPoint,
  insideRect,
  nextZ,
  newStickyAt,
  nextStickyNumber,
  snapSideForRect,
  clampSnapAt,
  snapAtForRect,
  SNAP_ZONE,
  CHIP_SPAN,
} = await server.ssrLoadModule('/src/lib/sticky.ts')

// --- inside the window ----------------------------------------------------

assert.deepEqual(clampSticky(100, 100, 1200, 800), { x: 100, y: 100 })
assert.deepEqual(clampSticky(-50, -50, 1200, 800), { x: 8, y: 8 })
assert.deepEqual(clampSticky(5000, 5000, 1200, 800), {
  x: 1200 - STICKY_W - 8,
  y: 800 - STICKY_H - 8,
})
// A window narrower than a card still gets a finite, editable slot rather than
// a negative one.
const tiny = clampSticky(500, 500, 100, 100)
assert.equal(tiny.x, 8)
assert.equal(tiny.y, 8)

// A resized card is clamped by its own size, not the default.
assert.deepEqual(clampSticky(5000, 5000, 1200, 800, 400, 300), { x: 1200 - 400 - 8, y: 800 - 300 - 8 })
assert.deepEqual(clampSticky(-50, -50, 1200, 800, 400, 300), { x: 8, y: 8 })

// --- the free-position clamp ----------------------------------------------

const board = { left: 900, top: 0, right: 1200, bottom: 800 }

assert.deepEqual(stickyPoint({ x: 0, y: 0 }, 1200, 800), { x: 8, y: 8 })
assert.deepEqual(stickyPoint({ x: 0, y: 0, w: 400, h: 300 }, 1200, 800), { x: 8, y: 8 })
assert.deepEqual(stickyPoint({ x: 5000, y: 5000 }, 1200, 800), {
  x: 1200 - STICKY_W - 8,
  y: 800 - STICKY_H - 8,
})

// --- stacking -------------------------------------------------------------

assert.equal(nextZ([]), 1)
assert.equal(nextZ([{ z: 1 }, { z: 7 }, { z: 3 }]), 8)
assert.equal(nextZ([{ z: Number.NaN }]), 1, 'an unreadable z is no opinion')

// --- a new card lands on the board ---------------------------------------

const spot = newStickyAt(board)
assert.ok(spot.x >= board.left + 8 && spot.x <= board.right - STICKY_W - 8)
assert.ok(spot.y >= board.top + BOARD_HEADER + 8 && spot.y <= board.bottom - STICKY_H - 8)

// --- default names --------------------------------------------------------

assert.equal(nextStickyNumber([]), 1)
assert.equal(nextStickyNumber([{ name: '标签 1' }, { name: '标签 3' }]), 4)
assert.equal(nextStickyNumber([{ name: 'custom 9' }]), 10)
assert.equal(nextStickyNumber([{ name: 'no number' }]), 1)

// --- snapping -------------------------------------------------------------

const PAGE = 190
const box = (left, top, right, bottom) => ({ left, top, right, bottom })
assert.equal(snapSideForRect(box(300, 10, 540, 210), 1200, 800, PAGE), 'top')
assert.equal(snapSideForRect(box(200, 400, 440, 600), 1200, 800, PAGE), 'left')
assert.equal(snapSideForRect(box(960, 400, 1200, 600), 1200, 800, PAGE), 'right')
assert.equal(snapSideForRect(box(500, 300, 740, 500), 1200, 800, PAGE), null)
// The top-left corner belongs to the top edge.
assert.equal(snapSideForRect(box(200, 0, 440, 200), 1200, 800, PAGE), 'top')
// It is the note that touches, not the pointer: this card's left edge is on
// the strip while any pointer inside it is out in the page.
assert.equal(snapSideForRect(box(210, 300, 450, 500), 1200, 800, PAGE), 'left')
// Chips stay on their edge.
assert.equal(clampSnapAt('top', 0, 1200, 800, PAGE), PAGE + 8)
assert.equal(clampSnapAt('top', 5000, 1200, 800, PAGE), 1200 - CHIP_SPAN - 8)
assert.equal(clampSnapAt('left', -10, 1200, 800, PAGE), 8)
assert.equal(clampSnapAt('left', 5000, 1200, 800, PAGE), 800 - CHIP_SPAN - 8)
assert.equal(snapAtForRect('top', box(400, 0, 640, 200), 1200, 800, PAGE), 520 - CHIP_SPAN / 2)
assert.equal(snapAtForRect('right', box(960, 300, 1200, 500), 1200, 800, PAGE), 400 - CHIP_SPAN / 2)
// SNAP_ZONE is the strip width the hint uses.
assert.equal(SNAP_ZONE, 28)

console.log('check-sticky: ok')
await server.close()

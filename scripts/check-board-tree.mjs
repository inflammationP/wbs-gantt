/**
 * The task-tree dialog's saved layout — run with
 * `node scripts/check-board-tree.mjs`.
 *
 * The dialog writes this blob itself, but it is still read back from
 * `localStorage`, which can be hand-edited or left over from an older build.
 * A bad value must fall back to a tree at rest, not put one at `NaN` or off the
 * canvas — while a negative offset is a real place a tree was carried, so the
 * guard must not throw that away.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const store = new Map()
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { entries: [] },
})
const { loadBoardTree, saveBoardTree, moveGroup } = await server.ssrLoadModule('/src/lib/boardTree.ts')

// Nothing stored yet: the dialog opens fresh, not on a made-up blob.
assert.equal(loadBoardTree(), null)

store.set('wbs-gantt.boardTree', '{not json')
assert.equal(loadBoardTree(), null)
store.set('wbs-gantt.boardTree', '[]')
assert.equal(loadBoardTree(), null)

// A blob with one bad tree, one bad scroll and a non-string fold is healed
// field by field: the good tree survives and the bad pieces sit at rest.
store.set(
  'wbs-gantt.boardTree',
  JSON.stringify({
    open: ['p:a', 42],
    offset: { a: { x: 12, y: 34 }, b: { x: -1, y: 5 }, c: { x: '9', y: 2 } },
    scroll: { left: -3, top: 20 },
  }),
)
assert.deepEqual(loadBoardTree(), {
  open: ['p:a'],
  // A negative offset is a tree carried up or left — that is a real position,
  // not a bad one, and the canvas pads for it.
  offset: { a: { x: 12, y: 34 }, b: { x: -1, y: 5 } },
  scroll: { left: 0, top: 0 },
})

// Round trip.
const state = { open: ['p:a', 't1'], offset: { a: { x: 0, y: 70 } }, scroll: { left: 5, top: 9 } }
saveBoardTree(state)
assert.deepEqual(loadBoardTree(), state)

// A group keeps its shape in every direction, including into negative space:
// the canvas pads for wherever it went.
const pair = { a: { x: 0, y: 0 }, b: { x: 100, y: 50 } }
assert.deepEqual(moveGroup(pair, ['a', 'b'], -20, -10), { a: { x: -20, y: -10 }, b: { x: 80, y: 40 } })
assert.deepEqual(moveGroup(pair, ['a', 'b'], 30, 10), { a: { x: 30, y: 10 }, b: { x: 130, y: 60 } })
assert.deepEqual(moveGroup(pair, ['b'], -20, -10), { a: { x: 0, y: 0 }, b: { x: 80, y: 40 } })

await server.close()
console.log('check-board-tree: ok')

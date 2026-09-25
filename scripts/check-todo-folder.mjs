/**
 * The check on the to-do folder rows — run with
 * `node scripts/check-todo-folder.mjs`.
 *
 * A folder is a row `buildRows` synthesizes rather than a task, and it has three
 * shapes: a lone to-do (no folder at all), a closed folder (a line of its own,
 * the to-dos behind it), and an open one (no line, the folder's mark moved onto
 * the first to-do's row). The last two differ by one row for opposite reasons,
 * and only the open one carries a mark — which is the sort of thing that goes
 * wrong invisibly, as a `+1` on a row count or a mark on the wrong to-do.
 *
 * `todoGroupIds` is checked here too because expand-all/collapse-all finds these
 * keys through it and nothing else: if it disagrees with `buildRows` about what
 * counts as a folder, "expand all" silently stops reaching one of them.
 *
 * No framework, nothing mocked: `src/lib/tree.ts` is loaded straight from source
 * by Vite, the same way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // Nothing is served here, only `src/lib/tree.ts` on demand. Without this the
  // entry scan walks every HTML file `src-tauri/target` has ever generated and
  // buries the one line this prints.
  optimizeDeps: { entries: [] },
})
const { buildRows, todoGroupId, todoGroupIds } = await server.ssrLoadModule('/src/lib/tree.ts')

const task = (over) => ({
  id: 'a', name: 'a', description: '', parentId: null, projectId: 'p',
  type: 'phase', isTodo: false,
  startDate: '2026-09-01', endDate: '2026-09-20',
  strictProgress: true, confirmedDays: [], paused: false, pauseDate: null, pauses: [],
  priority: null, tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})

// A to-do has no schedule, no priority and no log mode of its own — the same
// shape `addTask` writes for one.
const todo = (id, parentId = 'P') =>
  task({ id, name: id, parentId, isTodo: true, startDate: null, endDate: null, priority: null, strictProgress: false })

const parent = task({ id: 'P', name: 'parent' })

/** Each row as [kind, id, depth, the folder mark it carries]. */
const shape = (expanded, tasks) =>
  buildRows(tasks, expanded, [], []).map((r) => [
    r.kind,
    r.id,
    r.depth,
    r.kind === 'task' ? (r.todoGroup?.id ?? null) : null,
  ])

const open = todoGroupId('P')

// One to-do is a row, not a folder. A folder line would spend a whole row saying
// "one" — and, being closed by default, would hide its only child behind it.
const one = [parent, todo('t1')]
assert.deepEqual(shape({}, one), [['task', 'P', 0, null], ['task', 't1', 1, null]])
// Opening it changes nothing, because there was nothing to open.
assert.deepEqual(shape({ [open]: true }, one), shape({}, one))
assert.deepEqual(todoGroupIds(one), [])

// Two to-dos are a folder, closed until told otherwise: the folder is the only
// row of the two, and the to-dos it holds are not drawn at all.
const two = [parent, todo('t1'), todo('t2')]
assert.deepEqual(shape({}, two), [['task', 'P', 0, null], ['todoGroup', open, 1, null]])
assert.deepEqual(buildRows(two, {}, [], [])[1].todoIds, ['t1', 't2'])
assert.deepEqual(todoGroupIds(two), [open])

// Open, the folder's line is gone and its mark is on the first to-do's row —
// at the folder's own depth, since the row they hung from is the one removed.
assert.deepEqual(shape({ [open]: true }, two), [
  ['task', 'P', 0, null],
  ['task', 't1', 1, open],
  ['task', 't2', 1, null],
])
// Exactly one row wears it, and it carries the count the closed line showed.
assert.deepEqual(
  buildRows(two, { [open]: true }, [], []).filter((r) => r.todoGroup).map((r) => [r.id, r.todoGroup.count]),
  [['t1', 2]],
)

// A closed *task* takes everything under it with it, folder included.
assert.deepEqual(shape({ P: false }, two), [['task', 'P', 0, null]])

// To-dos with no parent are a folder of their own, under the synthetic root key
// rather than somebody's id.
const rootKey = todoGroupId(null)
const strays = [todo('r1', null), todo('r2', null)]
assert.deepEqual(shape({}, strays), [['todoGroup', rootKey, 0, null]])
assert.deepEqual(shape({ [rootKey]: true }, strays), [
  ['task', 'r1', 0, rootKey],
  ['task', 'r2', 0, null],
])
assert.deepEqual(todoGroupIds(strays), [rootKey])
// One stray is a row again — the rule is the count, not who the parent is.
assert.deepEqual(todoGroupIds([strays[0]]), [])

await server.close()
console.log('todo folder: ok')
process.exit(0)

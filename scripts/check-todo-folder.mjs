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
// shape `addTask` writes for one. `order` is the place a drag gave it, which is
// what decides whether it sinks to the bottom of its list or sits where it was
// dropped.
const todo = (id, parentId = 'P', order) =>
  task({ id, name: id, parentId, isTodo: true, startDate: null, endDate: null, priority: null, strictProgress: false, order })

const parent = task({ id: 'P', name: 'parent' })

/** Each row as [kind, id, depth, the folder mark it carries]. */
const shape = (expanded, tasks, projects = []) =>
  buildRows(tasks, expanded, projects, []).map((r) => [
    r.kind,
    r.id,
    r.depth,
    r.kind === 'task' ? (r.todoGroup?.id ?? null) : null,
  ])

const P = { id: 'p', name: 'project', color: '#888', description: '' }

// The key carries the project as well as the parent: root-level to-dos belong to
// a project like everything else, and without it two projects' root folders
// would share one key and fold together.
const open = todoGroupId('P', P.id)

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

// --- where an arranged to-do sits ------------------------------------------
//
// Once a parent has been dragged, every one of its children carries a place and
// the to-do key no longer decides anything — so the to-dos are drawn where they
// were put, and a folder stands for the run they form there rather than for
// every to-do of that parent. This is the half that makes a to-do draggable at
// all: without it the row would go back to the bottom of the list on release,
// whatever the drop said.

const A = (over) => task({ id: 'A', name: 'A', parentId: 'P', ...over })
const arranged = [
  task({ id: 'P', name: 'parent', order: 0 }),
  A({ order: 1, startDate: '2026-09-01', endDate: '2026-09-02' }),
  todo('t1', 'P', 2),
  todo('t2', 'P', 3),
  A({ id: 'B', name: 'B', order: 4, startDate: '2026-09-03', endDate: '2026-09-04' }),
]
assert.deepEqual(shape({}, arranged), [
  ['task', 'P', 0, null],
  ['task', 'A', 1, null],
  // The run of two, folded — between the two tasks, which is a place the folder
  // could not be while to-dos sank.
  ['todoGroup', open, 1, null],
  ['task', 'B', 1, null],
])
assert.deepEqual(shape({ [open]: true }, arranged), [
  ['task', 'P', 0, null],
  ['task', 'A', 1, null],
  ['task', 't1', 1, open],
  ['task', 't2', 1, null],
  ['task', 'B', 1, null],
])

// A task between two to-dos splits the run, and a run of one is an ordinary row
// — so no folder is drawn at all, open or closed, and both to-dos stand where
// they were put.
const split = [
  task({ id: 'P', name: 'parent', order: 0 }),
  todo('t1', 'P', 1),
  A({ order: 2, startDate: '2026-09-01', endDate: '2026-09-02' }),
  todo('t2', 'P', 3),
]
assert.deepEqual(shape({}, split), [
  ['task', 'P', 0, null],
  ['task', 't1', 1, null],
  ['task', 'A', 1, null],
  ['task', 't2', 1, null],
])
assert.deepEqual(shape({ [open]: true }, split), shape({}, split))
// The key outlives the folder, and that is deliberate: `todoGroupIds` counts a
// parent's to-dos rather than the runs they fall into, so it names keys that no
// row is drawn under. A key nothing reads costs nothing; a missing one would
// leave an open folder that "collapse all" could not close.
assert.deepEqual(todoGroupIds(split), [open])

// To-dos with no parent are a folder of their own, under the synthetic root key
// rather than somebody's id.
const rootKey = todoGroupId(null, P.id)
const strays = [todo('r1', null), todo('r2', null)]
assert.deepEqual(shape({}, strays), [['todoGroup', rootKey, 0, null]])
assert.deepEqual(shape({ [rootKey]: true }, strays), [
  ['task', 'r1', 0, rootKey],
  ['task', 'r2', 0, null],
])
assert.deepEqual(todoGroupIds(strays), [rootKey])
// One stray is a row again — the rule is the count, not who the parent is.
assert.deepEqual(todoGroupIds([strays[0]]), [])

// --- the project's line ----------------------------------------------------
//
// Every root task now hangs under a project's own row, and the line is what says
// where one project's tasks stop and the next one's begin. `projects` was empty
// in every case above, which is why none of them grew a row: a root whose
// project is not in the list has no line to hang under and stands at the top, as
// it did before there were project rows at all.

const p2 = { ...P, id: 'q', name: 'second' }
const T = (id, projectId, over = {}) => task({ id, name: id, projectId, ...over })

const twoProjects = [
  T('a', 'p'),
  T('n', 'q'),
  T('m', 'p', { startDate: '2026-09-05' }),
]
assert.deepEqual(shape({}, twoProjects, [P, p2]), [
  // The project's line carries no depth of its own: it is a band across the
  // group rather than a step in the hierarchy, so its tasks keep depth 0.
  ['project', 'project:p', 0, null],
  ['task', 'a', 0, null],
  ['task', 'm', 0, null],
  ['project', 'project:q', 0, null],
  ['task', 'n', 0, null],
])

// A closed project takes its tasks with it — the whole point of the row.
assert.deepEqual(shape({ 'project:p': false }, twoProjects, [P, p2]), [
  ['project', 'project:p', 0, null],
  ['project', 'project:q', 0, null],
  ['task', 'n', 0, null],
])

// A project with nothing visible gets no line at all: a header over no rows is a
// row spent saying "empty".
assert.deepEqual(shape({}, [T('a', 'p')], [P, p2]), [
  ['project', 'project:p', 0, null],
  ['task', 'a', 0, null],
])

// Roots whose project is not in the list still stand at the top, after every
// project's group — a dangling `projectId` from a hand-edited import must not
// take its tasks out of the tree.
assert.deepEqual(shape({}, [T('a', 'p'), T('lost', 'nowhere')], [P]), [
  ['project', 'project:p', 0, null],
  ['task', 'a', 0, null],
  ['task', 'lost', 0, null],
])

// Two projects, two root to-do folders, two keys — folding one must not fold
// the other. This is the reason the key carries the project at all.
const bothRoots = [todo('x1', null), todo('x2', null), T('y1', 'q', { isTodo: true, startDate: null, endDate: null }), T('y2', 'q', { isTodo: true, startDate: null, endDate: null })]
const keys = todoGroupIds(bothRoots)
assert.equal(keys.length, 2, 'one folder key per project, not one between them')
assert.ok(keys.includes(todoGroupId(null, 'p')) && keys.includes(todoGroupId(null, 'q')))
assert.deepEqual(
  buildRows(bothRoots, { [todoGroupId(null, 'p')]: true }, [P, p2], [])
    .filter((r) => r.kind === 'todoGroup')
    .map((r) => r.id),
  [todoGroupId(null, 'q')],
  'opening one project’s root folder leaves the other folded',
)

// --- both kinds of synthesized row on one board ----------------------------
//
// The archive group is the second row `buildRows` invents, and it is appended
// after everything else — including a to-do folder, whose place is decided by
// where its to-dos sit in the tree. The two must not be able to take each
// other's line: this is the shape where a `rows.push` in the wrong place would
// put the drawer in the middle of a project, and nothing else in either check
// would notice.

const { archiveGroupId } = await server.ssrLoadModule('/src/lib/tree.ts')
const filed = task({ id: 'z', name: 'z', parentId: 'P', archivedAt: '2026-09-30T10:00:00.000Z' })
const mixed = [parent, todo('t1'), todo('t2'), filed]
assert.deepEqual(shape({}, mixed), [
  ['task', 'P', 0, null],
  ['todoGroup', open, 1, null],
  // Last, after every project group and after every folder line inside them.
  ['archiveGroup', archiveGroupId, 0, null],
])
// `todoGroupIds` still counts the archived to-dos, which is the superset the
// comment above says is the safe direction: a key nothing reads costs nothing,
// and computing the drawer's own key is not this function's job.
assert.deepEqual(todoGroupIds(mixed), [open])

await server.close()
console.log('todo folder: ok')
process.exit(0)

/**
 * The check on merging projects — run with `node scripts/check-project-merge.mjs`.
 *
 * Four failures this file exists for, all of them quiet.
 *
 * **The rows that were left behind.** Every task of a merged-away project has to
 * come out the other side naming a project that still exists. A row left
 * pointing at the deleted one is not an error anywhere — `normalize` does not
 * check `projectId` against `projects` — it is just a row the tree draws with no
 * project line above it, or, if it was archived, a branch in the drawer that
 * nothing lists.
 *
 * **The top level, read after it stopped being one.** Which rows were a
 * project's roots is only knowable *before* the `projectId` rewrite; afterwards
 * every row of the source says the target. Anything that reads the source's top
 * level late gets whatever the target happens to look like, which on a
 * single-source merge is often the right answer by accident.
 *
 * **The order that a merge quietly freezes.** A project nobody has ever dragged
 * has no `order` on any of its rows, and it is sorted by date and name. Putting
 * rows among them is a placement, and a placement renumbers the list — so the
 * pairing of "did the rows land in the right place" and "did an untouched board
 * get frozen into today's arrangement" has to be read together.
 *
 * **The preview.** The dialog draws the result before the button is pressed,
 * from the same function the button calls. The two calls differ only in the id
 * they hand the new folder, and if that is not the only difference, the picture
 * is promising something the merge will not do.
 *
 * No framework, nothing mocked beyond the two globals the store reads at module
 * load: `src/lib/tree.ts` and the store are loaded straight from source by Vite,
 * the way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // Without this the entry scan walks every HTML file `src-tauri/target` has
  // ever generated and buries the one line this prints.
  optimizeDeps: { entries: [] },
})
const { archivedRoots, buildRows, isArchived, liveTasks, moveInto, movingUnits, promoteTask, rowsOwnedBy, toggleTicked } = await server.ssrLoadModule('/src/lib/tree.ts')
const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')

const task = (over) => ({
  id: 'a', name: 'a', description: '', parentId: null, projectId: 'p1',
  type: 'phase', isTodo: false,
  startDate: '2026-09-01', endDate: '2026-09-20',
  strictProgress: true, confirmedDays: [], paused: false, pauseDate: null, pauses: [],
  priority: 'medium', tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})
const filed = (over = {}) => task({ archivedAt: '2026-09-30T10:00:00.000Z', ...over })

const project = (id, name) => ({ id, name, color: '#888', description: '' })
const P1 = project('p1', '工作')
const P2 = project('p2', '学习')

const board = () => useStore.getState().tasks
const byId = (id) => board().find((t) => t.id === id)
const rootsOf = (pid) =>
  board()
    .filter((t) => t.projectId === pid && t.parentId === null && !isArchived(t))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

// --- folder mode: the source becomes a parent task -------------------------
//
// The move the whole feature is named after. What has to hold afterwards is that
// nothing was dropped on the way: the source's top level is under the new task,
// what hung below it still hangs below it, and all of it now names the target.

useStore.setState({
  projects: [P1, P2],
  tasks: [
    task({ id: 'a', name: 'a', projectId: 'p1', order: 0 }),
    task({ id: 'b', name: 'b', projectId: 'p1', order: 1 }),
    task({ id: 'c', name: 'c', projectId: 'p2', order: 0 }),
    task({ id: 'c1', name: 'c1', projectId: 'p2', parentId: 'c' }),
    task({ id: 'd', name: 'd', projectId: 'p2', order: 1 }),
    filed({ id: 'e', name: 'e', projectId: 'p2' }),
  ],
  logs: [],
  lastUndo: null,
})
useStore.getState().mergeProjects(['p2'], 'p1', true)

assert.deepEqual(useStore.getState().projects.map((p) => p.id), ['p1'], 'the merged-away project is gone')

const folder = board().find((t) => t.name === '学习')
assert.ok(folder, 'a task named after the project stands in its place')
assert.equal(folder.parentId, null, 'as a root of the target')
assert.equal(folder.projectId, 'p1')
assert.equal(folder.type, 'phase', 'a container, not a leaf')
assert.equal(folder.isTodo, false)

for (const id of ['c', 'd']) {
  assert.equal(byId(id).parentId, folder.id, `${id} hangs under the new parent task`)
  assert.equal(byId(id).projectId, 'p1')
}
assert.equal(byId('c1').parentId, 'c', 'the shape below is untouched')
assert.equal(byId('c1').projectId, 'p1', 'and every descendant follows the project')

// The rows that were already there did not move, and the new one lands last.
assert.deepEqual(
  rootsOf('p1').map((t) => t.id),
  ['a', 'b', folder.id],
  'the folder takes its place at the end of the target top level',
)
assert.deepEqual(rootsOf('p1').map((t) => t.order), [0, 1, 2], 'and the whole list is renumbered')

// A filed-away branch travels too — it has to, the project it named is gone —
// but it keeps its `parentId`, because that is where it was drawn from: the
// drawer, never under a parent.
assert.equal(isArchived(byId('e')), true, 'filed away stays filed away')
assert.equal(byId('e').projectId, 'p1', 'and it follows the project like everything else')
assert.equal(byId('e').parentId, null, 'an archived root of the target, not a child of the new folder')
assert.deepEqual(archivedRoots(board()).map((t) => t.id), ['e'])

// The board, drawn: the source's rows are reachable again, under the new line.
const drawn = buildRows(board(), {}, useStore.getState().projects, [])
assert.ok(drawn.some((r) => r.kind === 'task' && r.id === folder.id), 'the folder is a row')
assert.deepEqual(
  drawn.filter((r) => r.kind === 'task' && r.task.parentId === folder.id).map((r) => r.id),
  ['c', 'd'],
  'with the source top level under it',
)

// --- the picture is the same function as the button ------------------------
//
// Two calls, two ids for the new folder, nothing else different. If the preview
// could differ from the merge, this is where it would.

const strip = (result, generated) =>
  result.tasks.map((t) => ({
    ...t,
    id: t.id === generated ? 'NEW' : t.id,
    parentId: t.parentId === generated ? 'NEW' : t.parentId,
  }))
const before = [
  task({ id: 'a', projectId: 'p1', order: 0 }),
  task({ id: 'c', projectId: 'p2', order: 0 }),
]
const withRealId = moveInto(before, [P1, P2], { projects: ['p2'], tasks: [] }, { parentId: null, projectId: 'p1' }, true, () => 'real-id')
const withPreviewId = moveInto(before, [P1, P2], { projects: ['p2'], tasks: [] }, { parentId: null, projectId: 'p1' }, true, () => 'preview:p2')
assert.deepEqual(
  strip(withRealId, 'real-id').map((t) => t.id),
  strip(withPreviewId, 'preview:p2').map((t) => t.id),
  'the preview and the merge are the same board but for the new id',
)
assert.deepEqual(
  strip(withRealId, 'real-id'),
  strip(withPreviewId, 'preview:p2'),
  'and the same field for field, not just the same shape',
)

// --- flat mode: poured into the top level ----------------------------------

useStore.setState({
  projects: [P1, P2],
  tasks: [
    task({ id: 'a', projectId: 'p1', order: 0 }),
    task({ id: 'b', projectId: 'p1', order: 1 }),
    task({ id: 'c', projectId: 'p2', order: 0 }),
    task({ id: 'd', projectId: 'p2', order: 1 }),
  ],
  logs: [],
})
useStore.getState().mergeProjects(['p2'], 'p1', false)

assert.equal(board().length, 4, 'nothing was created')
assert.deepEqual(useStore.getState().projects.map((p) => p.id), ['p1'])
assert.deepEqual(
  rootsOf('p1').map((t) => t.id),
  ['a', 'b', 'c', 'd'],
  'the source top level joins the target top level',
)
assert.deepEqual(rootsOf('p1').map((t) => t.order), [0, 1, 2, 3])
assert.ok(rootsOf('p1').every((t) => t.projectId === 'p1'))

// --- several at once, and two of them named the same ----------------------
//
// Duplicate project names are normal here — `addProject` does not check — so the
// merge must not be the one place that quietly dedupes them.

useStore.setState({
  projects: [P1, P2, project('p3', '学习')],
  tasks: [
    task({ id: 'a', projectId: 'p1' }),
    task({ id: 'c', projectId: 'p2' }),
    task({ id: 'f', projectId: 'p3' }),
  ],
  logs: [],
})
useStore.getState().mergeProjects(['p2', 'p3'], 'p1', true)
const folders = board().filter((t) => t.name === '学习')
assert.equal(folders.length, 2, 'two sources, two folders, even under one name')
assert.notEqual(folders[0].id, folders[1].id)
assert.deepEqual(folders.map((f) => f.projectId), ['p1', 'p1'])
assert.equal(byId('c').parentId, folders[0].id, 'the first source under the first folder')
assert.equal(byId('f').parentId, folders[1].id, 'and the second under the second')

// --- an empty project, and a project with nothing live on it --------------

useStore.setState({
  projects: [P1, P2],
  tasks: [task({ id: 'a', projectId: 'p1' }), filed({ id: 'e', projectId: 'p2' })],
  logs: [],
})
useStore.getState().mergeProjects(['p2'], 'p1', true)
assert.deepEqual(useStore.getState().projects.map((p) => p.id), ['p1'], 'still merged away')
assert.equal(board().length, 2, 'but a project with nothing live on it grows no folder')
assert.equal(byId('e').projectId, 'p1', 'its filed-away work still travels')
assert.deepEqual(archivedRoots(board()).map((t) => t.id), ['e'])

useStore.setState({ projects: [P1, P2], tasks: [task({ id: 'a', projectId: 'p1' })], logs: [] })
useStore.getState().mergeProjects(['p2'], 'p1', true)
assert.equal(board().length, 1, 'an empty source adds and removes nothing but itself')
assert.equal(board()[0].id, 'a')

// --- the moves that are not moves -----------------------------------------

const untouched = () => JSON.stringify({ p: useStore.getState().projects, t: board() })
useStore.setState({ projects: [P1], tasks: [task({ id: 'a', projectId: 'p1' })], logs: [] })
const snapshot = untouched()
useStore.getState().mergeProjects([], 'p1', true)
useStore.getState().mergeProjects(['p1'], 'p1', true)
useStore.getState().mergeProjects(['nope'], 'p1', true)
useStore.getState().mergeProjects(['p1'], 'nope', true)
assert.equal(untouched(), snapshot, 'nothing to merge, and nothing that names a project, is a no-op')

// --- a dangling parent from a hand-edited import --------------------------
//
// The row is not under any of the source's roots, so the placement never sees
// it. It still has to follow the project — the alternative is a task pointing
// at one that no longer exists, which is a row with no project line to sit under.

useStore.setState({
  projects: [P1, P2],
  tasks: [task({ id: 'orphan', projectId: 'p2', parentId: 'gone' })],
  logs: [],
})
useStore.getState().mergeProjects(['p2'], 'p1', false)
assert.equal(byId('orphan').projectId, 'p1', 'an orphaned row is carried, not stranded')
assert.equal(byId('orphan').parentId, 'gone', 'and its dangling parent is left as it was found')

// --- what the merge does to the rest of the store's state -----------------

useStore.setState({
  projects: [P1, P2, project('p3', '生活')],
  tasks: [task({ id: 'a', projectId: 'p1' }), task({ id: 'c', projectId: 'p2' })],
  logs: [{ id: 'l1', taskId: 'c', date: '2026-09-01', content: 'x', createdAt: '', updatedAt: '' }],
  projectFilter: 'p2',
  selectedProjectId: 'p2',
  selectedTaskId: 'c',
})
const cursorBefore = useStore.getState().history.cursor
useStore.getState().mergeProjects(['p2'], 'p1', false)
const after = useStore.getState()
assert.equal(after.projectFilter, 'p1', 'a filter on a merged-away project follows the work')
assert.equal(after.selectedProjectId, null, 'a selected project that is gone is deselected')
assert.equal(after.selectedTaskId, 'c', 'a selected task is still on the board, so it stays selected')
assert.equal(after.logs.length, 1, 'the rows survived, so their logs stay — unlike a delete')
assert.equal(after.logs[0].taskId, 'c')
// The merge used to be un-undoable, and a step recorded before it had to be
// thrown away, because putting its `projectId` back would have named a project
// that no longer existed. Neither is true now: the merge is a step like any
// other, and a jump across it is walked in order — the sources are rebuilt by
// the inverse of the merge itself, before any earlier step is reached.
assert.equal(after.lastUndo?.parent, cursorBefore, 'the offer points at the node the merge was made from')
useStore.getState().undoLast()
assert.equal(useStore.getState().projects.length, 3, 'one press brings the merged-away project back')
assert.equal(byId('c').projectId, 'p2', 'with its rows where they were')

useStore.setState({ ...after, projectFilter: 'p3' })
useStore.getState().mergeProjects(['p1'], 'p3', false)
assert.equal(useStore.getState().projectFilter, 'p3', 'a filter on an unrelated project is left alone')

// --- what the merge dialog greys out --------------------------------------
//
// The dialog shuts the source box of a project that owns no rows, on the grounds
// that merging it would change nothing you could see. That claim has to hold
// against what `mergeInto` actually does, or the grey becomes a lie in the other
// direction — a hidden operation that would have done something. So both
// directions are asserted here, including the one that catches the tempting
// mistake: counting only the rows *on the board*.

assert.equal(rowsOwnedBy([], 'p1'), 0, 'a project with no rows at all')
assert.equal(rowsOwnedBy([task({ id: 'a', projectId: 'p1' })], 'p1'), 1)
assert.equal(
  rowsOwnedBy([filed({ id: 'e', projectId: 'p1' })], 'p1'),
  1,
  'a filed-away row still counts — it travels to the target drawer',
)

const lonely = [task({ id: 'a', projectId: 'p2' })]
assert.equal(rowsOwnedBy(lonely, 'p1'), 0)
const vanished = moveInto(lonely, [P1, P2], { projects: ['p1'], tasks: [] }, { parentId: null, projectId: 'p2' }, true, () => 'x')
assert.deepEqual(vanished.tasks, lonely, 'a project with no rows merges to nothing')
assert.deepEqual(vanished.projects.map((p) => p.id), ['p2'], 'and the only change is that it is gone')

const filedOnly = [task({ id: 'a', projectId: 'p2' }), filed({ id: 'e', projectId: 'p1' })]
assert.equal(rowsOwnedBy(filedOnly, 'p1'), 1, 'a project with only filed-away work is not empty')
assert.equal(
  moveInto(filedOnly, [P1, P2], { projects: ['p1'], tasks: [] }, { parentId: null, projectId: 'p2' }, true, () => 'x').tasks.find((t) => t.id === 'e').projectId,
  'p2',
  'its filed-away row moves, so it must not be greyed',
)

// --- moving tasks, and not only projects ----------------------------------
//
// The dialog used to merge projects. It moves anything now, and each of these is
// a way that generalisation can be quietly wrong.

// A destination that is a *task*: the rows become its children and take its
// project with them. This is the case a drag can only reach by scrolling to it.
const intoTask = [
  task({ id: 'host', projectId: 'p2', order: 0, name: 'host' }),
  task({ id: 'x', projectId: 'p1', order: 0, name: 'x' }),
  task({ id: 'y', projectId: 'p1', order: 1, name: 'y' }),
]
const under = moveInto(
  intoTask,
  [P1, P2],
  { projects: [], tasks: ['x', 'y'] },
  { parentId: 'host', projectId: 'p2' },
  true,
  () => 'F',
)
assert.deepEqual(
  under.tasks.filter((t) => t.parentId === 'host').map((t) => t.id),
  ['x', 'y'],
  'both arrive under the named task, in the order they were listed',
)
assert.equal(under.tasks.find((t) => t.id === 'x').projectId, 'p2', 'and take the destination project with them')
assert.equal(under.tasks.find((t) => t.id === 'y').projectId, 'p2')
assert.deepEqual(under.projects.map((p) => p.id), ['p1', 'p2'], 'nothing was removed — a task moving is not a project moving')

// A project's top level: no parent, and last among what was already there.
const atTop = moveInto(
  [task({ id: 'a', projectId: 'p1', order: 0 }), task({ id: 'b', projectId: 'p2', order: 0, name: 'b' })],
  [P1, P2],
  { projects: [], tasks: ['b'] },
  { parentId: null, projectId: 'p1' },
  true,
  () => 'F',
)
assert.equal(atTop.tasks.find((t) => t.id === 'b').parentId, null, 'the top level means no parent')
assert.equal(atTop.tasks.find((t) => t.id === 'b').projectId, 'p1', 'and the destination project')
assert.ok(
  atTop.tasks.find((t) => t.id === 'b').order > atTop.tasks.find((t) => t.id === 'a').order,
  'and it is appended, not inserted — position among siblings is the drag’s business',
)

// A project and one of its own tasks handed in together: the task is cargo, not a
// second thing to place. `movingUnits` settles this; `moveInto` has to agree with
// it, because a caller can hand both in.
const mixed = [
  task({ id: 'pa', projectId: 'p1', order: 0, name: 'pa' }),
  task({ id: 'pb', projectId: 'p1', parentId: 'pa', order: 0, name: 'pb' }),
  task({ id: 'host', projectId: 'p2', order: 0, name: 'host' }),
]
const both = moveInto(
  mixed,
  [P1, P2],
  { projects: ['p1'], tasks: ['pb'] },
  { parentId: 'host', projectId: 'p2' },
  true,
  () => 'F',
)
assert.deepEqual(
  both.tasks.filter((t) => t.parentId === 'host').map((t) => t.id),
  ['F'],
  'one row arrives: the folder. The task inside it came along rather than being placed twice',
)
assert.equal(both.tasks.find((t) => t.id === 'pa').parentId, 'F', 'the source top level went into the folder')
assert.equal(both.tasks.find((t) => t.id === 'pb').parentId, 'pa', 'and the row under it is untouched')

// A project arriving as a folder and a task arriving on its own, at the same
// task destination: they sit side by side.
const side = moveInto(
  [
    task({ id: 'host', projectId: 'p2', order: 0, name: 'host' }),
    task({ id: 'pa', projectId: 'p1', order: 0, name: 'pa' }),
    task({ id: 'free', projectId: 'p2', order: 1, name: 'free' }),
  ],
  [P1, P2],
  { projects: ['p1'], tasks: ['free'] },
  { parentId: 'host', projectId: 'p2' },
  true,
  () => 'F',
)
assert.deepEqual(
  side.tasks.filter((t) => t.parentId === 'host').map((t) => t.id).sort(),
  ['F', 'free'],
  'the folder and the task are both under the destination',
)
assert.equal(side.tasks.find((t) => t.id === 'pa').parentId, 'F')

// The rows folded into a new folder keep the order they came with: they never go
// through `placeTasks`, so nothing renumbers the list they land in.
const kept = moveInto(
  [
    task({ id: 'z', projectId: 'p1', order: 2, name: 'z' }),
    task({ id: 'a', projectId: 'p1', order: 0, name: 'a' }),
    task({ id: 'host', projectId: 'p2', order: 0, name: 'host' }),
  ],
  [P1, P2],
  { projects: ['p1'], tasks: [] },
  { parentId: 'host', projectId: 'p2' },
  true,
  () => 'F',
)
assert.deepEqual(
  kept.tasks.filter((t) => t.parentId === 'F').map((t) => t.order).sort(),
  [0, 2],
  "the source's own order survives — the rows are not renumbered into the folder",
)

// The moves that are refused.
const chain = [
  task({ id: 'up', projectId: 'p1', order: 0 }),
  task({ id: 'down', projectId: 'p1', parentId: 'up', order: 0 }),
]
assert.equal(
  moveInto(chain, [P1], { projects: [], tasks: ['up'] }, { parentId: 'down', projectId: 'p1' }, true, () => 'F'),
  null,
  'into its own descendant is a cycle',
)
assert.equal(
  moveInto(chain, [P1], { projects: [], tasks: ['up'] }, { parentId: 'up', projectId: 'p1' }, true, () => 'F'),
  null,
  'and into itself',
)
assert.equal(
  moveInto(chain, [P1], { projects: ['p1'], tasks: [] }, { parentId: 'down', projectId: 'p1' }, true, () => 'F'),
  null,
  'a project landing inside one of its own tasks is the same cycle',
)
assert.equal(
  moveInto(chain, [P1], { projects: ['p1'], tasks: [] }, { parentId: null, projectId: 'p1' }, true, () => 'F'),
  null,
  'and a project moving into itself is nothing to do',
)

const pens = [
  task({ id: 'todo', projectId: 'p1', order: 0, isTodo: true, type: null, priority: null, startDate: null, endDate: null }),
  filed({ id: 'gone', projectId: 'p1' }),
  task({ id: 'live', projectId: 'p1', order: 1 }),
]
assert.equal(
  moveInto(pens, [P1], { projects: [], tasks: ['live'] }, { parentId: 'todo', projectId: 'p1' }, true, () => 'F'),
  null,
  'a to-do is a holding pen, not a container',
)
assert.equal(
  moveInto(pens, [P1], { projects: [], tasks: ['live'] }, { parentId: 'gone', projectId: 'p1' }, true, () => 'F'),
  null,
  'and a filed-away row is not on the board to be dropped into',
)
assert.equal(
  moveInto(pens, [P1], { projects: [], tasks: ['gone'] }, { parentId: null, projectId: 'p1' }, true, () => 'F'),
  null,
  'nor is a filed-away row a unit — moving it would have no visible result',
)

// --- what a tick set means -------------------------------------------------
//
// The three rules the trees follow, as one function. It is the piece most likely
// to be got subtly wrong, which is why it is in `lib/` and not in the component.

const tree = [
  task({ id: 'A', projectId: 'p1', order: 0 }),
  task({ id: 'A1', projectId: 'p1', parentId: 'A', order: 0 }),
  task({ id: 'A2', projectId: 'p1', parentId: 'A', order: 1 }),
  task({ id: 'B', projectId: 'p1', order: 1 }),
  task({ id: 'C', projectId: 'p2', order: 0 }),
  filed({ id: 'G', projectId: 'p1' }),
]
const tick = (...ids) => new Set(ids)

assert.deepEqual(movingUnits(tree, [P1, P2], tick()), { projects: [], tasks: [] }, 'nothing ticked, nothing moves')
assert.deepEqual(
  movingUnits(tree, [P1, P2], tick('p1')),
  { projects: ['p1'], tasks: [] },
  'a ticked project is the project, not each of its tasks',
)
assert.deepEqual(
  movingUnits(tree, [P1, P2], tick('p1', 'A1')),
  { projects: ['p1'], tasks: [] },
  'and ticking one of its tasks as well changes nothing — it is cargo',
)
assert.deepEqual(
  movingUnits(tree, [P1, P2], tick('A1')),
  { projects: [], tasks: ['A1'] },
  'a ticked task whose ancestors are unticked stands on its own',
)
assert.deepEqual(
  movingUnits(tree, [P1, P2], tick('A', 'A1')),
  { projects: [], tasks: ['A'] },
  'and a ticked ancestor swallows the tick below it',
)
assert.deepEqual(
  movingUnits(tree, [P1, P2], tick('A2', 'B')),
  { projects: [], tasks: ['A2', 'B'] },
  'the state unticking one leaf leaves behind: the maximal elements of what is left',
)
assert.deepEqual(
  movingUnits(tree, [P1, P2], tick('G')),
  { projects: [], tasks: [] },
  'a tick on a filed-away row is not a unit',
)
assert.deepEqual(
  movingUnits([], [P1], tick('p1')),
  { projects: [], tasks: [] },
  'nor is an empty project — there is nothing to move, and this is not where you delete one',
)

// --- a task becomes a project ---------------------------------------------
//
// The mirror of moving a project into another one. There a root directory stops
// being a root and becomes a task; here a task stops being a task and becomes a
// root, and everything under it comes up with it.

const deep = [
  task({ id: 'T', projectId: 'p1', order: 0, name: 'T' }),
  task({ id: 'kid', projectId: 'p1', parentId: 'T', order: 0, name: 'kid' }),
  task({ id: 'grand', projectId: 'p1', parentId: 'kid', order: 0, name: 'grand' }),
  task({ id: 'other', projectId: 'p1', order: 1, name: 'other' }),
]
const made = promoteTask(deep, [P1], 'T', { id: 'NEW', color: '#60a5fa' })
assert.equal(made.tasks.some((t) => t.id === 'T'), false, 'the task is gone — it became the project')
assert.deepEqual(made.projects.map((p) => p.id), ['p1', 'NEW'])
assert.equal(made.projects[1].name, 'T', 'and it kept the name, which is the thing that was being kept')
assert.equal(made.tasks.find((t) => t.id === 'kid').parentId, null, 'what hung off it is now the top level')
assert.equal(made.tasks.find((t) => t.id === 'kid').projectId, 'NEW', 'and belongs to the new project')
assert.equal(made.tasks.find((t) => t.id === 'grand').parentId, 'kid', 'the shape below is untouched — it travelled up whole')
assert.equal(made.tasks.find((t) => t.id === 'grand').projectId, 'NEW', 'and every level of it changed project, not just the first')
assert.equal(made.tasks.find((t) => t.id === 'other').projectId, 'p1', 'the project it came out of keeps everything else')
assert.equal(made.tasks.find((t) => t.id === 'other').parentId, null)

// A leaf becomes an empty project: the name and the identity survive even when
// there is nothing to carry up. (An empty project cannot then be merged away —
// see `movingUnits` — so it is renamed or deleted from the projects list.)
const leaf = promoteTask([task({ id: 'L', projectId: 'p1', name: 'L' })], [P1], 'L', { id: 'NEW', color: '#888' })
assert.deepEqual(leaf.projects.map((p) => p.name), [P1.name, 'L'])
assert.equal(leaf.tasks.length, 0)

assert.equal(promoteTask(deep, [P1], 'nope', { id: 'N', color: '#888' }), null, 'a row that is not there')
assert.equal(
  promoteTask([filed({ id: 'F', projectId: 'p1' })], [P1], 'F', { id: 'N', color: '#888' }),
  null,
  'a filed-away row is not on the board to be promoted',
)

// --- and through the store: one task sent to a new project *becomes* it ----

useStore.getState().importData({ projects: [P1], tasks: deep, logs: [] })
assert.equal(useStore.getState().history.steps.length, 0, 'a fresh board')
useStore.getState().moveUnits({ projects: [], tasks: ['T'] }, { kind: 'newProject' }, true)
const afterPromote = useStore.getState()
assert.equal(afterPromote.projects.length, 2, 'a project was made')
const fresh = afterPromote.projects.find((p) => p.id !== 'p1')
assert.equal(fresh.name, 'T')
assert.equal(afterPromote.tasks.some((t) => t.id === 'T'), false, 'and the task is not inside it — the task *is* it')
assert.equal(afterPromote.tasks.find((t) => t.id === 'kid').parentId, null)
assert.equal(afterPromote.history.steps.length, 1, 'the whole thing is one step')
assert.match(afterPromote.history.steps[0].label, /T/)
assert.equal(afterPromote.history.steps[0].kind, 'move')

// Two tasks sent to a new project is the *other* operation: a project is made
// and they go inside it. Only one unit promotes, because only one can be the
// project.
useStore.getState().importData({
  projects: [P1],
  tasks: [
    task({ id: 'one', projectId: 'p1', order: 0, name: 'one' }),
    task({ id: 'two', projectId: 'p1', order: 1, name: 'two' }),
  ],
  logs: [],
})
useStore.getState().moveUnits({ projects: [], tasks: ['one', 'two'] }, { kind: 'newProject' }, true)
const afterTwo = useStore.getState()
const holder = afterTwo.projects.find((p) => p.id !== 'p1')
assert.equal(afterTwo.tasks.find((t) => t.id === 'one').projectId, holder.id, 'both went inside')
assert.equal(afterTwo.tasks.find((t) => t.id === 'one').parentId, null)
assert.deepEqual(
  afterTwo.tasks.filter((t) => t.projectId === holder.id).map((t) => t.id).sort(),
  ['one', 'two'],
  'as rows of the new project, not as projects of their own',
)
assert.equal(afterTwo.projects.length, 2, 'and one project was made, not two')
// Its name is the fallback rather than either task's: with more than one thing
// going in there is no single name to inherit, and picking one would be picking
// a winner. (Not asserted as text — that is the reader's language.)
assert.notEqual(holder.name, 'one')
assert.notEqual(holder.name, 'two')

// --- and how a tick set changes -------------------------------------------
//
// The rules are split across two functions — `toggleTicked` says what a click
// does to the set, `movingUnits` says what the resulting set means — and both are
// rules, so both are asserted. This pair is what a correction of the user's was
// about: a tick on a project is not a mode that freezes the rows under it.

const ticked = (...ids) => new Set(ids)

// Ticking a project ticks everything it owns.
const allTicked = toggleTicked(tree, [P1, P2], ticked(), 'p1', true)
assert.deepEqual(
  [...allTicked].sort(),
  ['A', 'A1', 'A2', 'B', 'G', 'p1'],
  'a tick on a project reaches every row under it',
)

// Unticking one leaf under it: the leaf goes, its ancestors go with it, its
// siblings stay — and the project's own tick goes, because it has stopped
// covering everything.
const withoutA1 = toggleTicked(tree, [P1, P2], allTicked, 'A1', false)
assert.equal(withoutA1.has('A1'), false, 'the row that was unticked')
assert.equal(withoutA1.has('p1'), false, 'the project above it is no longer ticked')
assert.equal(withoutA1.has('A'), false, 'nor is its parent')
assert.equal(withoutA1.has('A2'), true, 'its sibling is still ticked')
assert.equal(withoutA1.has('B'), true)
assert.deepEqual(
  movingUnits(tree, [P1, P2], withoutA1),
  { projects: [], tasks: ['A2', 'B'] },
  'so what moves is its siblings — "everything except that"',
)

// Unticking a project takes its whole subtree with it, rather than leaving ticked
// rows under a row that reads as off.
assert.deepEqual([...toggleTicked(tree, [P1, P2], allTicked, 'p1', false)], [], 'the whole subtree comes off with it')

// An ordinary parent works the same way — none of this is about projects.
const leafOnly = toggleTicked(tree, [P1, P2], ticked(), 'A1', true)
assert.deepEqual(movingUnits(tree, [P1, P2], leafOnly), { projects: [], tasks: ['A1'] }, 'a leaf on its own is a unit')
assert.deepEqual(
  movingUnits(tree, [P1, P2], toggleTicked(tree, [P1, P2], leafOnly, 'A', true)),
  { projects: [], tasks: ['A'] },
  'and ticking the parent above it swallows it',
)

// --- pure function, no store ----------------------------------------------

assert.equal(moveInto([], [P1], { projects: ['p1'], tasks: [] }, { parentId: null, projectId: 'p1' }, true, () => 'x'), null, 'nothing but the target')
assert.equal(moveInto([], [], { projects: [], tasks: [] }, { parentId: null, projectId: 'p1' }, true, () => 'x'), null, 'no such target')
assert.equal(moveInto([], [P1, P2], { projects: ['p2'], tasks: [] }, { parentId: null, projectId: 'nope' }, true, () => 'x'), null, 'target must exist')

const live = liveTasks([task({ id: 'a', projectId: 'p1' }), filed({ id: 'e', projectId: 'p1' })])
assert.equal(live.length, 1, 'and the merge leaves `liveTasks` meaning what it always meant')

await server.close()
console.log('project merge: ok')
process.exit(0)

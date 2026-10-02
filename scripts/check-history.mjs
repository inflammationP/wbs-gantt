/**
 * The check on the undo history — run with `node scripts/check-history.mjs`.
 *
 * Five failures this file exists for, all of them quiet.
 *
 * **A change that was never recorded.** The whole design rests on no structural
 * change happening outside the record: a jump walks the tree step by step, and a
 * step that was never taken is a hole the walk falls through, landing on a board
 * that never existed. That is why the record is taken by the store watching
 * itself rather than by asking call sites to announce — and the way to test a
 * promise like that is to change the board *without announcing*, which is what
 * the raw `setState` below does.
 *
 * **A gesture split into many steps.** A bulk delete runs `deleteTask` twenty
 * times; a pause runs `updateTask` once. The history has to see the first as one
 * step and not twenty, or a single button turns into twenty clicks to undo.
 *
 * **Derived writes getting in.** `syncParentDates` rewrites parents on every
 * tasks change. Recorded, every step drags a meaningless one behind it.
 *
 * **Reproducing a board by walking, rather than by snapshotting.** A jump must
 * leave the board exactly as stepping there one at a time would, in both
 * directions, and the branch left behind must still be reachable. Anyone can
 * make undo work by storing a copy of everything; the point here is that it
 * cannot be done that way, because the things this history does not record —
 * logs, above all — must survive an undo.
 *
 * **The tree drawn from the board instead of from the record.** What a step did
 * has to be readable after the rows it names are gone, which is exactly the state
 * an abandoned branch is in.
 *
 * Clock frozen, like every other check here — see the note in `check-archive.mjs`
 * and the rule it came from. Without it this file would pass today and fail the
 * morning after the last fixture date.
 *
 * No framework, nothing mocked beyond the two globals the store reads at module
 * load: `src/lib/history.ts` and the store are loaded straight from source by
 * Vite, the way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

const RealDate = Date
const FROZEN = new RealDate(2026, 8, 15, 12, 0, 0) // Tue 2026-09-15, local midday
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...args)
    if (args.length === 0) this.setTime(FROZEN.getTime())
  }
  static now() {
    return FROZEN.getTime()
  }
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // Without this the entry scan walks every HTML file `src-tauri/target` has
  // ever generated and buries the one line this prints.
  optimizeDeps: { entries: [] },
})
const { applyDelta, cursorChain, deltaCount, deltaNames, diffBoard, inEffectIds, pathBetween } = await server.ssrLoadModule(
  '/src/lib/history.ts',
)
const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')

const task = (over) => ({
  id: 'a', name: 'a', description: '', parentId: null, projectId: 'p1',
  type: 'phase', isTodo: false,
  startDate: '2026-09-01', endDate: '2026-09-20',
  strictProgress: false, confirmedDays: [], paused: false, pauseDate: null, pauses: [],
  priority: 'medium', tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})
const project = (id, name) => ({ id, name, color: '#888', description: '' })

const P1 = project('p1', 'Work')
const P2 = project('p2', 'Study')

const board = () => useStore.getState().tasks
const steps = () => useStore.getState().history.steps
const cursor = () => useStore.getState().history.cursor
const snapshot = () => {
  const s = useStore.getState()
  return { tasks: s.tasks, projects: s.projects, logs: s.logs, todoFolders: s.todoFolders }
}

/**
 * A fresh board with an empty history.
 *
 * Through `importData` and not `setState`: seeding by hand is itself a change to
 * the board, and with the record watching the store it would be captured as the
 * first step. `importData` replaces everything and clears the tree, which is
 * also the behaviour asserted further down.
 */
const seed = (tasks, projects = [P1, P2], logs = [], todoFolders = {}) => {
  useStore.getState().importData({ projects, tasks, logs, todoFolders })
  assert.equal(steps().length, 0, 'a freshly imported board starts with no history')
}

// --- one gesture is one step ----------------------------------------------

seed([
  task({ id: 'a', projectId: 'p1' }),
  task({ id: 'b', projectId: 'p1' }),
  task({ id: 'c', projectId: 'p1' }),
])
const { withUndo, deleteTask, historyGoTo, undoLast, addLog, setTodoFolderName, updateTask } = useStore.getState()

withUndo('three', () => {
  for (const id of ['a', 'b', 'c']) deleteTask(id)
})
assert.equal(steps().length, 1, 'twenty deletes under one gesture are one step, not twenty')
assert.equal(board().length, 0)
assert.equal(steps()[0].delta.removed.length, 3, 'and the step carries all three rows')

// Nested: a gesture inside a gesture keeps the outer name and closes once.
withUndo('outer', () => {
  withUndo('inner', () => {
    useStore.getState().addTask({ name: 'x', projectId: 'p1', startDate: '2026-09-01', endDate: '2026-09-02' })
  })
  useStore.getState().addTask({ name: 'y', projectId: 'p1', startDate: '2026-09-01', endDate: '2026-09-02' })
})
assert.equal(steps().length, 2, 'a nested gesture closes with its parent')
assert.match(steps()[1].label, /outer/)

// --- a change nobody announced is still a step ----------------------------
//
// The failure this is here for: an operation added later, wired straight to the
// store and not to `withUndo`. It has to end up on the tree anyway — under a
// label assembled from what it did, which is the whole point of inverting the
// failure mode from "silently absent" to "plainly named".

useStore.setState({ tasks: [...board(), task({ id: 'loud', name: 'loud', projectId: 'p1' })] })
assert.equal(steps().length, 3, 'a raw setState is recorded')
assert.equal(cursor(), steps()[2].id)
assert.ok(steps()[2].label.length > 0, 'and it gets a label even though nobody gave it one')

// --- derived writes are not steps -----------------------------------------

seed([
  task({ id: 'parent', projectId: 'p1', startDate: '2026-09-10', endDate: '2026-09-11' }),
  task({ id: 'kid', projectId: 'p1', parentId: 'parent', startDate: '2026-09-01', endDate: '2026-09-20' }),
])
useStore.getState().syncParentDates()
assert.equal(board().find((t) => t.id === 'parent').startDate, '2026-09-01', 'the parent was rewritten')
assert.equal(steps().length, 0, 'and rewriting it is not a step')

// --- undo one step, exactly -----------------------------------------------

seed([
  task({ id: 'a', projectId: 'p1', name: 'a', order: 0 }),
  task({ id: 'b', projectId: 'p1', name: 'b', order: 1 }),
])
const before = snapshot()
useStore.getState().withUndo('rename b', () => updateTask('b', { name: 'renamed' }))
assert.equal(board().find((t) => t.id === 'b').name, 'renamed')
undoLast()
assert.deepEqual(snapshot().tasks, before.tasks, 'undo puts the fields back')
assert.deepEqual(snapshot().logs, before.logs)
assert.equal(cursor(), null, 'and the cursor is back at the opening board')
assert.equal(steps().length, 1, 'undoing is not itself recorded')

// --- undoing a delete brings its logs back --------------------------------

seed([task({ id: 'a', projectId: 'p1' }), task({ id: 'b', projectId: 'p1' })])
addLog({ taskId: 'a', date: '2026-09-01', content: 'wrote this' })
assert.equal(useStore.getState().logs.length, 1)
useStore.getState().withUndo('delete a', () => deleteTask('a'))
assert.equal(useStore.getState().logs.length, 0, 'the delete takes the log with it')
undoLast()
assert.equal(board().some((t) => t.id === 'a'), true, 'the row is back')
assert.equal(useStore.getState().logs.length, 1, 'and so is its log')

// --- undoing a create takes the row away ----------------------------------

seed([task({ id: 'a', projectId: 'p1' })])
useStore.getState().withUndo('new', () =>
  useStore.getState().addTask({ name: 'fresh', projectId: 'p1', startDate: '2026-09-01', endDate: '2026-09-02' }),
)
assert.equal(board().length, 2)
undoLast()
assert.equal(board().length, 1, 'a created row is a row the undo can take away again')

// --- a log written after a step survives undoing that step ----------------
//
// The reason this is a delta and not a snapshot. A snapshot of the whole board
// would put back everything as it was, including the log entries the history
// deliberately does not record — so undoing a merge would silently eat the work
// done since.

seed([task({ id: 'a', projectId: 'p1' }), task({ id: 'b', projectId: 'p1' })])
useStore.getState().withUndo('delete a', () => deleteTask('a'))
addLog({ taskId: 'b', date: '2026-09-02', content: 'written after the step' })
assert.equal(useStore.getState().logs.length, 1)
undoLast()
assert.equal(useStore.getState().logs.length, 1, 'a log the step never touched is still there')
assert.equal(useStore.getState().logs[0].content, 'written after the step')

// --- branches: undoing and then working on keeps the old path -------------

seed([task({ id: 'a', projectId: 'p1', name: 'a' })])
useStore.getState().withUndo('one', () => updateTask('a', { name: 'one' }))
useStore.getState().withUndo('two', () => updateTask('a', { name: 'two' }))
const afterTwo = snapshot().tasks
const [stepOne, stepTwo] = steps()

undoLast()
undoLast()
assert.equal(cursor(), null, 'back at the opening board')
assert.equal(steps().length, 2, 'the steps are still on the tree, not deleted')
useStore.getState().withUndo('three', () => updateTask('a', { name: 'three' }))
const stepThree = steps()[2]
assert.equal(stepThree.parent, null, 'the new work branches from the node it was done at')
assert.equal(board().find((t) => t.id === 'a').name, 'three')
assert.equal(inEffectIds(steps(), cursor()).has(stepThree.id), true)
assert.equal(inEffectIds(steps(), cursor()).has(stepOne.id), false, 'the abandoned branch is out of effect')
assert.equal(inEffectIds(steps(), cursor()).has(stepTwo.id), false)

historyGoTo(stepTwo.id)
assert.deepEqual(snapshot().tasks, afterTwo, 'and it is still reachable — the board comes back')
assert.equal(inEffectIds(steps(), cursor()).has(stepTwo.id), true)

// --- a many-step jump is the same as stepping one at a time ---------------
//
// Both directions, because a jump down a branch replays the forward values and
// that is the half a snapshot design would simply never exercise.

seed([task({ id: 'a', projectId: 'p1', name: 'a' })])
for (const name of ['x1', 'x2', 'x3', 'x4', 'x5']) {
  useStore.getState().withUndo(name, () => updateTask('a', { name }))
}
const tip = cursor()
const atTip = snapshot()
assert.equal(steps().length, 5)

historyGoTo(null)
const jumpedBack = snapshot()
for (let i = 0; i < 5; i++) undoLast()
assert.deepEqual(snapshot(), jumpedBack, 'one jump back is five single steps back')

historyGoTo(tip)
assert.deepEqual(snapshot(), atTip, 'and one jump forward is five single steps forward')

// --- what a step touched is read off the record, not off the board --------

seed([task({ id: 'gone', projectId: 'p1', name: 'GONE' }), task({ id: 'stay', projectId: 'p1' })])
useStore.getState().withUndo('delete', () => deleteTask('gone'))
const del = steps()[0]
assert.deepEqual(deltaNames(del.delta).removed, ['GONE'])
assert.equal(deltaCount(del.delta), 1)
assert.equal(board().some((t) => t.id === 'gone'), false, 'the row really is gone')
assert.deepEqual(deltaNames(del.delta).removed, ['GONE'], 'and the step still says so')

// --- what a step says it touched ------------------------------------------
//
// The list under a step is read as "the items this moved". A move does two
// things to the board, though, and only one of them is the point: the rows that
// arrived are relabelled, and the rows they landed among are renumbered because
// something was inserted above them. Reporting both made "moved 学习" list the
// destination's own tasks underneath it — none of which went anywhere.

const movedRow = (id, name) => ({ id, name, before: { parentId: null }, after: { parentId: 'F' } })
const shifted = (id, name) => ({ id, name, before: { order: 2 }, after: { order: 3 } })
const emptyProjects = { added: [], removed: [], changed: [] }
const withProjects = (over) => ({ ...emptyProjects, ...over })

assert.deepEqual(
  deltaNames({
    added: [], removed: [], removedLogs: [], folders: [],
    changed: [movedRow('a', 'A'), shifted('b', 'B')],
    projects: emptyProjects,
  }).changed,
  ['A'],
  'a row that changed place is listed; one that only shifted down is not',
)

// And when *nothing* changed place, the step is the renumbering — a row dragged
// within its own parent changes only its order — so every changed row belongs.
assert.deepEqual(
  deltaNames({
    added: [], removed: [], removedLogs: [], folders: [],
    changed: [shifted('a', 'A'), shifted('b', 'B')],
    projects: emptyProjects,
  }).changed,
  ['A', 'B'],
  'a pure reorder lists them all, because where they sit is all that happened',
)

// The project groups are three, not one: adding one and removing one are
// opposite news and a single label over both says neither.
const pn = deltaNames({
  added: [], removed: [], removedLogs: [], folders: [], changed: [],
  projects: withProjects({
    added: [{ id: 'n', name: 'New', color: '#888', description: '' }],
    removed: [{ id: 'o', name: 'Old', color: '#888', description: '' }],
    changed: [],
  }),
})
assert.deepEqual(pn.projectAdded, ['New'])
assert.deepEqual(pn.projectRemoved, ['Old'])
assert.deepEqual(pn.projectChanged, [])

// --- the whole history goes when the board does ---------------------------

seed([task({ id: 'a', projectId: 'p1' })])
useStore.getState().withUndo('x', () => updateTask('a', { name: 'x' }))
assert.equal(steps().length, 1)
seed([task({ id: 'z', projectId: 'p1' })])
assert.equal(steps().length, 0, 'importing a board clears a history that names the old one')
assert.equal(cursor(), null)

// --- pointing at rows a jump took away ------------------------------------

seed([task({ id: 'a', projectId: 'p1' }), task({ id: 'b', projectId: 'p1' })], [P1, P2])
useStore.getState().withUndo('new', () =>
  useStore.getState().addTask({ name: 'n', projectId: 'p1', startDate: '2026-09-01', endDate: '2026-09-02' }),
)
const newId = board().find((t) => t.id !== 'a' && t.id !== 'b').id
useStore.setState({ selectedTaskId: newId, projectFilter: 'p2' })
undoLast()
assert.equal(useStore.getState().selectedTaskId, null, 'the selection is dropped with the row it named')
assert.equal(useStore.getState().projectFilter, 'p2', 'a filter on a project that still exists is left alone')

// --- folder names are structural too --------------------------------------

seed([task({ id: 'a', projectId: 'p1', isTodo: true, type: null, priority: null, startDate: null, endDate: null })])
setTodoFolderName('todogroup:root:p1', 'Later')
assert.equal(steps().length, 1, 'naming a to-do folder is a step')
assert.equal(useStore.getState().todoFolders['todogroup:root:p1'], 'Later')
undoLast()
assert.equal(useStore.getState().todoFolders['todogroup:root:p1'], undefined, 'and it comes back off')

// --- making a project is one step, description and all --------------------
//
// The description is a parameter of `addProject` and not a second call after it,
// precisely so this holds: two calls are two steps, and making a project would
// read on the tree as "added 工作" followed by "edited 工作". The forms make the
// one call; this is what says they have to.

seed([], [])
useStore.getState().addProject('工作', '#60a5fa', '一句话说明')
assert.equal(useStore.getState().projects.length, 1)
assert.equal(useStore.getState().projects[0].description, '一句话说明', 'the description lands with the project')
assert.equal(steps().length, 1, 'creating it is one step, not a create followed by an edit')
// Creating a project is not a *move*, and the hierarchy dialog lists moves — so
// it carries no kind and stays out of that list. It is still on the history tree
// the toolbar opens; the filter is the dialog's, not the record's.
assert.equal(steps()[0].kind, undefined, 'a project created is not a move')
undoLast()
assert.equal(useStore.getState().projects.length, 0, 'the undo takes the whole thing back')

// ...and a move is marked as one. This single field is what the whole filter in
// that dialog rests on, and it is the kind of thing that would go on working
// while listing nothing.
seed([task({ id: 'a', projectId: 'p1' })])
useStore.getState().moveUnits({ projects: [], tasks: ['a'] }, { kind: 'project', id: 'p2' }, true)
assert.equal(steps().length, 1, 'a move through the dialog is one step')
assert.equal(steps()[0].kind, 'move', 'and it is marked as a move')
assert.equal(board().find((t) => t.id === 'a').projectId, 'p2', 'the task went where it was sent')

// Dragging is the same operation by another hand, so it is listed too.
useStore.getState().moveTasks(['a'], null, null, 'p1')
assert.equal(steps()[1].kind, 'move', 'and so is a drag — it is a move, and the dialog lists moves')

// --- the pure layer, without a store --------------------------------------

const base = { tasks: [task({ id: 'a' })], projects: [P1], logs: [], todoFolders: {} }
const next = { ...base, tasks: [task({ id: 'a', name: 'renamed' })] }
const d = diffBoard(base, next)
assert.equal(d.changed.length, 1)
assert.equal(d.changed[0].name, 'renamed', 'the name is read after the step, so it is never blank')
assert.deepEqual(applyDelta(applyDelta(base, d, 'forward'), d, 'inverse').tasks, base.tasks, 'forward then back is where it started')

assert.equal(diffBoard(base, { ...base, logs: [{ id: 'l', taskId: 'a', date: '2026-09-01', content: '', createdAt: '', updatedAt: '' }] }), null, 'a log on its own is not a step')

const stepsForPath = [
  { id: 's1', parent: null, label: '', at: '', delta: null },
  { id: 's2', parent: 's1', label: '', at: '', delta: null },
  { id: 's3', parent: 's1', label: '', at: '', delta: null },
]
assert.deepEqual(
  pathBetween(stepsForPath, 's2', 's3').map((p) => `${p.step.id}:${p.dir}`),
  ['s2:inverse', 's3:forward'],
  'between two branches: up to the fork, then down the other side',
)
assert.deepEqual(pathBetween(stepsForPath, 's3', 's3'), [])
assert.equal(pathBetween(stepsForPath, 's3', 'nope'), null, 'a node that is not there is not a jump')

// What the graph opens by default: the chain that is in effect, which is what
// keeps a branch's lane from having to run past rows it has nothing to do with.
assert.deepEqual(cursorChain(stepsForPath, 's2'), ['s2', 's1'], 'the cursor and everything above it')
assert.deepEqual(cursorChain(stepsForPath, 's1'), ['s1'])
assert.deepEqual(cursorChain(stepsForPath, null), [], 'the opening board is not a step')

// The clock is frozen, so a stamp is a fixed string and not a moving one.
assert.match(steps()[0].at, /^\d\d:\d\d$/)

await server.close()
console.log('history: ok')
process.exit(0)

/**
 * The check on rearranging the tree — run with
 * `node scripts/check-task-tree.mjs`.
 *
 * Three things that go wrong quietly, which is the whole reason this file
 * exists rather than a note in the plan.
 *
 * **The order key.** `compareSiblings` falls through to the date sort when a
 * task has never been dragged, and honours `order` when it has. Get the
 * fall-through wrong — `(a.order ?? Infinity) - (b.order ?? Infinity)`, say —
 * and two `undefined`s subtract to `NaN`, which leaves `Array.sort`
 * implementation-defined: the rows come back in an order nobody chose and no
 * test notices, because it looks like a sort that simply disagrees with you.
 *
 * **`moveTasks`.** A drop writes four facts at once — parent, project, place in
 * the new sibling list, and the renumbering that keeps the list coherent. Any
 * one of them dropped is invisible on a board with one project and one level,
 * and badly wrong on a real one: a stale `projectId` files a task under a parent
 * in another project, where it vanishes the moment the project filter is turned
 * on. The cycle guard is here for the same reason — dropping a task into its own
 * subtree detaches the branch from the root and it is never seen again.
 *
 * **Names.** `nameQualifiers` decides what a flat list prints, and its failure
 * mode is a list that looks right. Two rows reading "联调" are the bug, and it is
 * not visible in a fixture that forgot to give them the same name.
 *
 * No framework, nothing mocked beyond the two globals the store touches at
 * module load: `src/lib/tree.ts` and the store are loaded straight from source
 * by Vite, the way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Read at `useStore.ts` module load — see `check-notes.mjs`.
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
const { compareSiblings, effectiveStates, nameQualifiers, placeTasks, syncParentDates } = await server.ssrLoadModule('/src/lib/tree.ts')
const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')
const { readPriority } = await server.ssrLoadModule('/src/store/storage.ts')

const task = (over) => ({
  id: 'a', name: 'a', description: '', parentId: null, projectId: 'p',
  type: 'phase', isTodo: false,
  startDate: '2026-09-01', endDate: '2026-09-20',
  strictProgress: true, confirmedDays: [], paused: false, pauseDate: null, pauses: [],
  priority: 'medium', tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})

const ids = (list) => list.map((t) => t.id)

// --- the order key --------------------------------------------------------

// Nothing dragged: the date sort, then the name, then the id — the order this
// board has always had, unchanged by the arrival of a key nobody has set.
const byDate = [
  task({ id: 'late', startDate: '2026-09-20' }),
  task({ id: 'early', startDate: '2026-09-01' }),
  task({ id: 'mid', startDate: '2026-09-10' }),
]
assert.deepEqual(ids([...byDate].sort(compareSiblings)), ['early', 'mid', 'late'])

// Two tasks on the same date fall to the name, and two with the same name to
// the id — which is the tiebreak a near-copy of this function in Manage used to
// leave out.
const tied = [
  task({ id: 'z', name: 'same', startDate: '2026-09-01' }),
  task({ id: 'a', name: 'same', startDate: '2026-09-01' }),
  task({ id: 'm', name: 'apple', startDate: '2026-09-01' }),
]
assert.deepEqual(ids([...tied].sort(compareSiblings)), ['m', 'a', 'z'])

// Dragged: the hand-set order wins outright, however the dates fall. This is
// the whole of what "remember the order you dragged" means.
const placed = [
  task({ id: 'first', order: 0, startDate: '2026-09-20' }),
  task({ id: 'second', order: 1, startDate: '2026-09-01' }),
]
assert.deepEqual(ids([...placed].sort(compareSiblings)), ['first', 'second'])
assert.deepEqual(ids([...placed].reverse().sort(compareSiblings)), ['first', 'second'])

// Half-ordered — only reachable from a hand-edited import, since `moveTasks`
// renumbers a whole list. It must fall through to the date rather than compare
// two numbers that disagree about meaning, and above all must not be `NaN`.
const half = [task({ id: 'one', order: 0, startDate: '2026-09-20' }), task({ id: 'two', startDate: '2026-09-01' })]
assert.deepEqual(ids([...half].sort(compareSiblings)), ['two', 'one'])
assert.deepEqual(ids([...half].reverse().sort(compareSiblings)), ['two', 'one'])

// A to-do that has been given a place keeps it, among scheduled work like
// anywhere else — the hand-set order outranks the to-do key, and this is the
// whole of "a to-do can sit anywhere". The two keys used to be the other way
// round, which no drop could overrule: a to-do dragged between two tasks sprang
// back to the bottom of the list and the drag looked simply refused.
const hoisted = [
  task({ id: 'todo', isTodo: true, startDate: null, endDate: null, order: 0 }),
  task({ id: 'work', order: 1 }),
]
assert.deepEqual(ids([...hoisted].sort(compareSiblings)), ['todo', 'work'])
assert.deepEqual(ids([...hoisted].reverse().sort(compareSiblings)), ['todo', 'work'])

// With nothing arranged they still sink: unscheduled work belongs after the
// scheduled work. This is what keeps every board that has never been dragged
// reading exactly as it did before any of this existed.
const sinkers = [
  task({ id: 'todo', isTodo: true, startDate: null, endDate: null }),
  task({ id: 'work' }),
]
assert.deepEqual(ids([...sinkers].sort(compareSiblings)), ['work', 'todo'])

// --- moving --------------------------------------------------------------

const { addTask, moveTasks, updateTask } = useStore.getState()
const board = () => useStore.getState().tasks
const rootsOf = (projectId) =>
  ids([...board()].filter((t) => t.parentId === null && t.projectId === projectId).sort(compareSiblings))
const read = () => rootsOf('p')
const kids = (id) => ids([...board()].filter((t) => t.parentId === id).sort(compareSiblings))

useStore.setState({ projects: [{ id: 'p', name: 'P', color: '#888', description: '' }, { id: 'q', name: 'Q', color: '#888', description: '' }], tasks: [], logs: [] })
const a = addTask({ name: 'a', projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-02' })
const b = addTask({ name: 'b', projectId: 'p', startDate: '2026-09-03', endDate: '2026-09-04' })
const c = addTask({ name: 'c', projectId: 'p', startDate: '2026-09-05', endDate: '2026-09-06' })
assert.deepEqual(read(), [a, b, c], 'untouched board reads in date order')

// Nothing has been dragged, so nothing has been numbered: the date sort is
// still doing its job and a new task with an early date lands at the top.
assert.equal(board().find((t) => t.id === a).order, undefined, 'a fresh board carries no order at all')
const early = addTask({ name: 'early', projectId: 'p', startDate: '2026-08-01', endDate: '2026-08-02' })
assert.deepEqual(read(), [early, a, b, c], 'an undragged group still sorts by date')

// Reorder within one parent: `c` in front of `a`, which is between the task
// above `a` and `a` itself — `beforeId` names a row, not a position in the
// sorted list. The whole group is numbered, because a place is only ever read
// relative to its own list.
moveTasks([c], null, a, 'p')
assert.deepEqual(read(), [early, c, a, b])
// Read by id rather than in storage order: `order` is a place in the sorted
// list, and the store's array is in the order things were created.
const orderOf = Object.fromEntries(board().filter((t) => t.parentId === null && t.projectId === 'p').map((t) => [t.id, t.order]))
assert.deepEqual(
  orderOf,
  { [early]: 0, [c]: 1, [a]: 2, [b]: 3 },
  'every member of the destination list is renumbered, not just the one that moved',
)

// And the group is now ordered, so a new task appends rather than jumping to
// the top on its early date — the user has said where things go.
const later = addTask({ name: 'later', projectId: 'p', startDate: '2026-01-01', endDate: '2026-01-02' })
assert.deepEqual(read(), [early, c, a, b, later])

// `beforeId: null` means the end.
moveTasks([c], null, null, 'p')
assert.deepEqual(read(), [early, a, b, later, c])

// Re-parent: `b` into `a`. It leaves one list and joins another, and both have
// to be left coherent.
moveTasks([b], a, null, 'p')
assert.deepEqual(read(), [early, a, later, c])
assert.deepEqual(kids(a), [b])

// A to-do is a holding pen, not a container.
const todoId = addTask({ name: 'todo', projectId: 'p', isTodo: true, startDate: null, endDate: null })
const beforeTodoAttempt = JSON.stringify(board())
moveTasks([c], todoId, null, 'p')
assert.equal(JSON.stringify(board()), beforeTodoAttempt, 'a to-do cannot be dropped into, and the attempt changes nothing')
assert.equal(board().find((t) => t.id === c).parentId, null)

// Cycles: neither the task itself nor anything under it.
moveTasks([a], a, null, 'p')
assert.equal(board().find((t) => t.id === a).parentId, null, 'a task cannot contain itself')
moveTasks([a], b, null, 'p')
assert.equal(board().find((t) => t.id === a).parentId, null, 'nor be dropped inside its own subtree')

// --- subtrees travel -----------------------------------------------------

// A parent moves as a folder: its contents come with it, and a child that is
// itself being dragged along is carried rather than placed a second time.
const kid = addTask({ name: 'kid', parentId: a, projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-02' })
const grandkid = addTask({ name: 'grandkid', parentId: kid, projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-02' })
moveTasks([a, kid], null, null, 'p')
assert.equal(board().find((t) => t.id === kid).parentId, a, 'a child of a moving task travels inside it')
assert.equal(board().find((t) => t.id === grandkid).parentId, kid, 'and so does everything under that')
assert.deepEqual(kids(a), [b, kid])

// --- the project follows the container ------------------------------------

// Across projects, the whole subtree adopts the project it lands in. Without
// this the task hangs under a parent in another project — which reads as fine
// until the project filter is on and the rows are simply gone.
moveTasks([a], null, null, 'q')
assert.equal(board().find((t) => t.id === a).projectId, 'q')
assert.equal(board().find((t) => t.id === kid).projectId, 'q', 'the subtree follows, not just the root')
assert.equal(board().find((t) => t.id === grandkid).projectId, 'q')
assert.ok(rootsOf('q').includes(a), 'and it is now one of project q’s roots')
assert.ok(!read().includes(a), 'while project p’s own roots no longer list it')

// --- parent dates follow their children ------------------------------------

// The defect this replaced: only the end was synced, so dragging a subtask
// right moved its bar and left the parent's left edge where it was.
const parent = addTask({ name: 'parent', projectId: 'p', startDate: '2026-09-10', endDate: '2026-09-10' })
const k1 = addTask({ name: 'k1', parentId: parent, projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-05' })
const k2 = addTask({ name: 'k2', parentId: parent, projectId: 'p', startDate: '2026-09-20', endDate: '2026-09-25' })
const synced = syncParentDates(board(), [])
const p2 = synced.find((t) => t.id === parent)
assert.equal(p2.startDate, '2026-09-01', 'the parent starts when its earliest child does')
assert.equal(p2.endDate, '2026-09-25', 'and ends when its latest one does')

// Converged: a second pass over the result finds nothing to change, which is
// what stops the App effect that calls this from looping.
assert.equal(syncParentDates(synced, []), synced, 'a settled board is returned unchanged, identity and all')

// A parent whose children are all to-dos keeps its own dates — it is outside
// the roll-up, so there is nothing to derive them from. This is the case that
// decides whether the dialog may lock those two fields, and locking them here
// would be a field that looks editable until the moment you try it.
const onlyTodos = addTask({ name: 'only', projectId: 'p', startDate: '2026-09-10', endDate: '2026-09-11' })
addTask({ name: 't1', parentId: onlyTodos, projectId: 'p', isTodo: true, startDate: null, endDate: null })
addTask({ name: 't2', parentId: onlyTodos, projectId: 'p', isTodo: true, startDate: null, endDate: null })
const settled = syncParentDates(board(), [])
const only = settled.find((t) => t.id === onlyTodos)
assert.equal(only.startDate, '2026-09-10', 'a parent of nothing but to-dos keeps its own start')
assert.equal(only.endDate, '2026-09-11')

// A long-term parent is anchored to its own start and has no end to derive.
const goal = addTask({ name: 'goal', projectId: 'p', type: 'long-term', startDate: '2026-09-10' })
addTask({ name: 'g1', parentId: goal, projectId: 'p', startDate: '2026-08-01', endDate: '2026-08-05' })
const withGoal = syncParentDates(board(), []).find((t) => t.id === goal)
assert.equal(withGoal.startDate, '2026-09-10', 'a long-term goal keeps its own anchor')
assert.equal(withGoal.endDate, null)

// --- undoing one move ------------------------------------------------------

// A fresh, quiet board, because this is about one step back and not about the
// tangle the sections above left behind. `lastUndo` is carried in the store
// rather than in the tasks, so it survives the reset — which is exactly what
// `importData` had to learn to clear, and why it is cleared by hand here.
useStore.setState({ projects: [{ id: 'p', name: 'P', color: '#888', description: '' }], tasks: [], logs: [] })
const { deleteTask, undoLast, clearUndo } = useStore.getState()
const lastUndo = () => useStore.getState().lastUndo
clearUndo()
const f1 = addTask({ name: 'one', projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-02' })
const f2 = addTask({ name: 'two', projectId: 'p', startDate: '2026-09-03', endDate: '2026-09-04' })
const f3 = addTask({ name: 'three', projectId: 'p', startDate: '2026-09-05', endDate: '2026-09-06' })
// The baseline is the arrangement, not the absence of an undo offer. Three
// `addTask`s are three steps of the history now, so there is always an offer —
// what matters here is that nothing has been given a place by hand, which is
// what a drop into this list has to leave alone.
assert.deepEqual(read(), [f1, f2, f3], 'a board nobody has dragged is in date order')
assert.ok(read().every((t) => t.order === undefined), 'and no row carries a hand-set place')

moveTasks([f3], null, f1, 'p')
assert.deepEqual(read(), [f3, f1, f2])
assert.ok(lastUndo(), 'a move leaves an offer to take itself back')
// Only the name is asserted, not the phrase around it: the wording is the
// reader's language, which this fixture has no opinion about.
assert.match(lastUndo().message, /three/, 'and the offer names what moved')

undoLast()
assert.deepEqual(read(), [f1, f2, f3], 'undo puts the rows back where they were')
assert.equal(
  board().find((t) => t.id === f3).order,
  undefined,
  'including the absence of an order on a group that had never been arranged',
)
assert.equal(lastUndo(), null, 'and it is one step, so the offer is spent')

// A move that does nothing offers nothing: `moveTasks` bails on the cycle guard
// without touching `tasks`, and an undo that would restore the state it is
// already in is a button that appears to do nothing when pressed.
moveTasks([f1], f1, null, 'p')
assert.equal(lastUndo(), null, 'a drop that changes nothing offers no undo')

// A step touches only what it did, and the top of the stack comes off first.
// A delete's own undo does resurrect — that is the whole of what it is for —
// and what must not happen is a *move's* undo resurrecting something the move
// never touched, which is why a move records the fields it wrote and not a copy
// of the board.
moveTasks([f3], f2, null, 'p')
assert.deepEqual(kids(f2), [f3], 'f3 is inside f2, so it is no longer one of the roots')
deleteTask(f3)
undoLast()
assert.ok(board().some((t) => t.id === f3), 'the delete is on top, so that is the step taken back')
assert.deepEqual(kids(f2), [f3], 'and the move below it is untouched')
undoLast()
assert.equal(board().find((t) => t.id === f3).parentId, null, 'one more press takes the move back too')

// The same the other way round: the edit is on top, so the edit is what comes
// off, and the place the move gave the row stays.
moveTasks([f1], f2, null, 'p')
updateTask(f1, { name: 'renamed' })
undoLast()
assert.equal(board().find((t) => t.id === f1).name, 'one', 'the rename is the step on top')
assert.equal(board().find((t) => t.id === f1).parentId, f2, 'and the move below it is untouched')

clearUndo()
assert.equal(lastUndo(), null)

// --- the same function serves the drag preview -----------------------------

// `placeTasks` is what the Gantt calls on every drop-target change while the
// pointer is still down — the rows rearrange live, before anything is committed.
// Two things about it are therefore load-bearing in a way they would not be if
// only the drop called it: it must not write to what it is given, and it must
// answer "no" rather than "sort of" when the move is impossible. An in-place
// edit would change the board mid-drag with no commit and nothing to undo.
// A to-do is a holding pen, not a container — the fourth way a move can be
// refused, alongside the three above.
const aTodo = addTask({ name: 'todo', projectId: 'p', isTodo: true, startDate: null, endDate: null })
const untouched = JSON.stringify(board())
assert.equal(placeTasks(board(), [], null, null, 'p'), null, 'nothing to move is not a move')
assert.equal(placeTasks(board(), [f1], f1, null, 'p'), null, 'a task cannot be placed inside itself')
assert.equal(placeTasks(board(), [f1], aTodo, null, 'p'), null, 'a to-do cannot hold anything')
assert.equal(JSON.stringify(board()), untouched, 'and none of those attempts touched the board')

const nextBoard = placeTasks(board(), [f1], null, null, 'p')
assert.ok(nextBoard, 'a possible move comes back as a board')
assert.notEqual(nextBoard, board(), 'as a new array, not the one it was handed')
assert.equal(JSON.stringify(board()), untouched, 'the board it was given is left exactly as it was')
assert.equal(nextBoard.length, board().length, 'with no task gained or lost')

// --- undoing anything else --------------------------------------------------

// Everything else that can be taken back is recorded by watching the board
// rather than by each action describing itself — one slot for a park, a pause
// and a delete, instead of three sets of bookkeeping that could disagree. What
// this section is really checking is that a step is the *run*: two actions
// inside one `withUndo` are one offer, not two.
const { withUndo, pauseTask, resumeTask, startTodoTasks, setTaskTodo, addLog, updateTask: editTask } = useStore.getState()
useStore.setState({ projects: [{ id: 'p', name: 'P', color: '#888', description: '' }], tasks: [], logs: [] })
clearUndo()
const g1 = addTask({ name: 'one', projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-02' })
const g2 = addTask({ name: 'two', projectId: 'p', startDate: '2026-09-03', endDate: '2026-09-04' })
const g3 = addTask({ name: 'three', projectId: 'p', startDate: '2026-09-05', endDate: '2026-09-06', strictProgress: true })
addLog({ taskId: g3, date: '2026-09-05', content: 'wrote it up' })
const find = (id) => board().find((t) => t.id === id)

withUndo('paused two', () => {
  pauseTask(g1)
  pauseTask(g2)
})
assert.equal(find(g1).paused, true)
undoLast()
assert.equal(find(g1).paused, false, 'two actions in one run are one step, taken back together')
assert.equal(find(g2).paused, false)
assert.equal(find(g1).pauseDate, null, 'down to the date the pause was stamped with')
assert.equal(lastUndo(), null, 'and the one offer is spent, not two')

// Parking a task wipes its schedule — so the undo has to put the dates back, not
// just clear the flag. This is the whole reason the record is the previous
// *values* and not a list of the fields an action is known to write.
withUndo('parked three', () => setTaskTodo(g3))
assert.equal(find(g3).startDate, null)
undoLast()
assert.equal(find(g3).startDate, '2026-09-05', 'the dates it had come back with it')
assert.equal(find(g3).endDate, '2026-09-06')
assert.equal(find(g3).strictProgress, true, 'and so does the log mode')
assert.equal(find(g3).priority, 'medium')

// A delete is the one step a patch cannot express: the row is not there to patch
// any more, so it is kept whole — along with the log entries that went with it,
// or the row comes back a stranger with no history.
withUndo('deleted three', () => deleteTask(g3))
assert.ok(!find(g3))
assert.equal(useStore.getState().logs.length, 0, 'a delete takes the logs with it')
undoLast()
assert.ok(find(g3), 'the row comes back')
assert.equal(useStore.getState().logs.length, 1, 'and so does its history')
assert.ok(useStore.getState().logs[0].content.includes('wrote it up'))

// A row edited *while* the step is the last one keeps its edit: the same rule as
// the move above, and it has to hold for a delete's undo too.
editTask(g1, { name: 'renamed' })
withUndo('parked one', () => setTaskTodo(g2))
undoLast()
assert.equal(find(g1).name, 'renamed', 'an undo puts back what the step changed, and nothing else')

// Restoring a to-do is a step like its opposite: it writes the whole schedule
// back on at once (dates, type, priority, log mode), and all of that has to
// come off again.
withUndo('parked two', () => setTaskTodo(g2))
assert.equal(find(g2).startDate, null)
withUndo('started two', () =>
  startTodoTasks([{ id: g2, startDate: '2026-09-03', endDate: '2026-09-04', type: 'phase', priority: 'high', strictProgress: true }]),
)
assert.equal(find(g2).isTodo, false)
assert.equal(find(g2).startDate, '2026-09-03')
undoLast()
assert.equal(find(g2).isTodo, true, 'undoing a restore files the row back as a to-do')
assert.equal(find(g2).startDate, null, 'with the schedule it was given taken off again')

// The view no longer decides whether a step is kept. It used to: nothing was
// recorded off the Gantt, because the strip that offered it back was drawn
// there and nowhere else — which left a pause taken from the task panel on the
// Today page with no way back at all. The strip is still the Gantt's, but the
// history is the board's.
useStore.setState({ activeView: 'today' })
const offGantt = useStore.getState().history.steps.length
withUndo('paused one', () => pauseTask(g1))
assert.equal(find(g1).paused, true, 'the action still happens')
assert.equal(useStore.getState().history.steps.length, offGantt + 1, 'and it is a step off the Gantt too')
useStore.setState({ activeView: 'gantt' })
withUndo('resumed one', () => resumeTask(g1))
assert.ok(lastUndo(), 'the same step is offered on the board')
undoLast()

// A run that changes nothing is not a step, and does not clear the offer either.
withUndo('nothing at all', () => {})
assert.equal(lastUndo(), null)

clearUndo()
assert.equal(lastUndo(), null)

// --- telling same-named rows apart -----------------------------------------

// The whole board is handed in as both arguments throughout: `rows` is what is
// being labelled and `tasks` is where the ancestors are looked up, and in the
// real callers the second is the whole board while the first is one list from
// it. Here they can be the same fixture.
const N = (id, name, parentId = null) => task({ id, name, parentId })

// Nothing collides: every row is drawn as plain as it ever was. This is the
// half that makes the feature cost nothing — the qualifier is not decoration on
// every row, it is the answer to one specific question.
const distinct = [N('x', 'design'), N('y', 'build')]
assert.deepEqual(nameQualifiers(distinct, distinct).get('x'), [], 'a list with no collision adds nothing to any row')

// Two rows reading the same, under parents that read differently: one ancestor
// each is enough, and it is the *nearest* one.
const twoBranches = [N('f', 'frontend'), N('b', 'backend'), N('x', 'ship', 'f'), N('y', 'ship', 'b')]
const qualified = nameQualifiers(twoBranches, twoBranches)
assert.deepEqual(qualified.get('x'), ['frontend'], 'a collision is broken by the nearest parent that differs')
assert.deepEqual(qualified.get('y'), ['backend'])
assert.deepEqual(qualified.get('f'), [], 'and the rows that did not collide are left alone')

// Parents named the same too, one level up: the chain deepens until it
// separates, which is the only thing that can separate it.
const twoDeep = [
  N('w1', 'web'), N('w2', 'web'),
  N('f1', 'frontend', 'w1'), N('f2', 'frontend', 'w2'),
  N('x', 'ship', 'f1'), N('y', 'ship', 'f2'),
]
const deepNames = nameQualifiers(twoDeep, twoDeep)
assert.deepEqual(deepNames.get('x'), ['frontend', 'web'], 'the chain keeps going up while rows still collide')
assert.deepEqual(deepNames.get('y'), ['frontend', 'web'])

// Identical all the way to the root: there is no name left that could separate
// them, so it stops rather than spending forever. Which is half of why the round
// limit is there at all.
const twins = [N('f', 'frontend'), N('x', 'ship', 'f'), N('y', 'ship', 'f')]
const same = nameQualifiers(twins, twins)
assert.deepEqual(same.get('x'), ['frontend'], 'spends every ancestor it has and then stops')
assert.deepEqual(same.get('y'), ['frontend'])

// A cycle in hand-edited data must not hang the walk, and must still produce
// something: two rows that are each other's parent, sharing a name, spend the
// one ancestor they can reach and then stop. Reaching the end of the chain is
// what ends the loop — the round limit is the belt to that pair of braces.
const cyclic = [N('c1', 'one', 'c2'), N('c2', 'one', 'c1')]
const cyc = nameQualifiers(cyclic, cyclic)
assert.deepEqual(cyc.get('c1'), ['one'], 'a cycle is walked once, not forever')
assert.deepEqual(cyc.get('c2'), ['one'])

// The priority a saved file carries, read at the trust boundary. It lives in
// this file because nothing else loads the loader, and it is here at all because
// the `'urgent'` line is the one thing in it that reads like dead code: every
// board saved before that level was renamed still says the old word, and
// `PRIORITY_META` has no entry for it — so dropping the line would take the
// priority off every task on every existing board, quietly, at load time.
assert.equal(readPriority('urgent'), 'top', 'the old name still reads as the level it was')
assert.equal(readPriority('top'), 'top')
assert.equal(readPriority('urgent'), readPriority('top'))
// Anything unrecognised falls to the ordinary one rather than through: a value
// with no entry in `PRIORITY_META` is a thrown exception on the first render
// that shows the task, not a wrong colour.
assert.equal(readPriority('nonsense'), 'medium')
assert.equal(readPriority(undefined), 'medium')
assert.equal(readPriority(null), 'medium')
assert.equal(readPriority(3), 'medium')

// --- what a finished task's window becomes ---
// In a block of its own so the fixture names here cannot collide with the ones
// declared above, all of which are top level.
{
  // --- what a finished task's window becomes ---

  // A task finished on the 4th of a window running to the 20th ends on the 4th.
  // The bar is drawn from this, so the old reading was a task still carrying
  // sixteen days of work it had already handed in.
  const log = (taskId, date, targetProgress = null) => ({
    id: `${taskId}@${date}`, taskId, date, content: '', targetProgress, createdAt: '', updatedAt: '',
  })
  const finished = [task({ id: 'p' }), task({ id: 'k', parentId: 'p' })]
  const earlyEnds = effectiveStates(finished, [log('k', '2026-09-04', 100)])
  assert.equal(earlyEnds.get('k').end, '2026-09-04', 'a finished task ends the day it finished')
  // …and the parent, whose span is read off its children's ends, comes in with it.
  assert.equal(earlyEnds.get('p').end, '2026-09-04')
  const synced = syncParentDates(finished, [log('k', '2026-09-04', 100)]).find((t) => t.id === 'p')
  assert.equal(synced.endDate, '2026-09-04', 'and the write-back follows it')

  // Unfinished is unchanged, and so is the stored plan: only the derived end
  // moves, so a task taken back off completed gets its window back.
  const open = effectiveStates([task({})], [])
  assert.equal(open.get('a').end, '2026-09-20')
  assert.equal(task({}).endDate, '2026-09-20')

  // A completion logged before the start cannot invert the bar: `completedOn`
  // refuses to name a finish outside the task's own window — the task reads "not
  // started" on that day — so the derived end falls back to the planned one
  // rather than being drawn right-to-left.
  const backfill = effectiveStates([task({ startDate: '2026-09-10' })], [log('a', '2026-09-02', 100)])
  assert.equal(backfill.get('a').end, '2026-09-20')
  assert.equal(backfill.get('a').status, 'completed', 'it is still finished — just not on a day it could have been')
}

await server.close()
console.log('task tree: ok')
process.exit(0)
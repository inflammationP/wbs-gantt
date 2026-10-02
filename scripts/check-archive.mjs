/**
 * The check on filing away finished work — run with
 * `node scripts/check-archive.mjs`.
 *
 * Three failures this file exists for, all of them quiet.
 *
 * **The split between what is drawn and what is counted.** An archived task
 * leaves the rows and the lists; it must not leave the numbers. The failure is
 * specific and looks like a bug in the app rather than in the archive: file away
 * a finished subtask and its parent's progress drops, because the average it is
 * built from lost its only finished term. The other half is the same rule read
 * backwards — every count that captions a list has to move with that list, or
 * the table says twelve and shows eight.
 *
 * **The branch.** Archiving takes a subtree and restoring puts one back, and the
 * unit of both is the branch: a live task under a filed-away parent is a task
 * the tree cannot reach, because the tree only ever walks down from the roots.
 * Every hole that survives a wrong answer here is invisible — nothing is drawn,
 * so nothing looks wrong.
 *
 * **The numbers that stop closing up.** WBS is derived from the tree, so filing
 * a task away renumbers everything below it. That is the intent, and it is also
 * why an archive is confirmed rather than done in passing; a numbering pass that
 * still counted the archived rows would print numbers with holes in them and
 * disagree with the picker in the task dialog.
 *
 * No framework, nothing mocked beyond the two globals the store reads at module
 * load: `src/lib/tree.ts`, the store and `src/store/storage.ts` are loaded
 * straight from source by Vite, the way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

// The clock is frozen, and it is the fixture's, not the calendar's.
//
// Every window below is in one September, and the statuses asserted off those
// windows — running, completed, past due — are derived by comparing against
// today. This script used to leave the clock alone, which made it a time bomb:
// green the day it was written, red the morning after the last end date in it.
// It went off on 2026-10-01, on a `2026-09-30` window, blaming the rules for
// what was the calendar.
//
// Same fix, and the same reasoning, as PR #2 did for `check-habits.mjs`:
// `new Date()` and `Date.now()` stand still, so today stops being an input to
// an assertion about the rules. `setTime` on a real instance rather than
// returning a substitute object, so `instanceof Date` keeps meaning what it
// meant for anything downstream that asks.
//
// 2026-09-15 rather than the first or last day of a window: a fixture date
// asserted to be `in-progress` needs today to be *inside* its span, and being
// inside all of them at once is the whole reason one instant can serve.
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
const { archiveCascade, archiveGroupId, archivedRoots, buildRows, computeWbs, effectiveStates, isArchived, liveTasks, placeTasks } = await server.ssrLoadModule('/src/lib/tree.ts')
const { strictLogObligations, strictLogRate, daySummary } = await server.ssrLoadModule('/src/lib/dayTasks.ts')
const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')
const { parseImport, exportJson } = await server.ssrLoadModule('/src/store/storage.ts')

const task = (over) => ({
  id: 'a', name: 'a', description: '', parentId: null, projectId: 'p',
  type: 'phase', isTodo: false,
  startDate: '2026-09-01', endDate: '2026-09-20',
  strictProgress: true, confirmedDays: [], paused: false, pauseDate: null, pauses: [],
  priority: 'medium', tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})
const done = (over = {}) => task({ strictProgress: false, confirmedDays: ['2026-09-01'], ...over })
const filed = (over = {}) => task({ archivedAt: '2026-09-30T10:00:00.000Z', ...over })

const P = { id: 'p', name: 'project', color: '#888', description: '' }

/** Each row as [kind, id, depth, wbs] — the WBS because it is what renumbers. */
const shape = (expanded, tasks) =>
  buildRows(tasks, expanded, [P], []).map((r) => [r.kind, r.id, r.depth, r.kind === 'task' ? r.wbs : ''])

// --- the numbering closes up behind what is filed away ---------------------
//
// `computeWbs` is what both the board and the task dialog's parent picker print,
// so an archived task left in it would put a number beside a row that is not
// there — and the numbers of the rows that are would stop being consecutive.

const numbered = [
  task({ id: 'one', order: 0 }),
  filed({ id: 'gone', order: 1 }),
  task({ id: 'two', order: 2 }),
]
// The one-line filter every "what is on the board" surface is built from — the
// Manage table, the day's rows, the reminder's board. A wrong answer here is a
// wrong answer in six places at once, which is why it is asserted and not just
// used.
assert.deepEqual(liveTasks(numbered).map((t) => t.id), ['one', 'two'])
assert.deepEqual([...computeWbs(numbered.filter((t) => !isArchived(t))).values()], ['1', '2'])
assert.equal(computeWbs(numbered.filter((t) => !isArchived(t))).get('gone'), undefined, 'a filed-away task has no number')

// The tree itself: the archived row is gone from where it sat, the rows around
// it close up, and the drawer is the last line of the column.
assert.deepEqual(shape({}, numbered), [
  ['project', 'project:p', 0, ''],
  ['task', 'one', 0, '1'],
  ['task', 'two', 0, '2'],
  ['archiveGroup', archiveGroupId, 0, ''],
])

// Nothing filed away, no drawer: a line that says "empty" is a row spent on
// saying nothing.
assert.deepEqual(shape({}, [task({ id: 'one' })]), [
  ['project', 'project:p', 0, ''],
  ['task', 'one', 0, '1'],
])

// Closed by default, like a to-do folder and unlike a task — so the group's own
// line is the only thing drawn until it is opened.
assert.equal(shape({}, numbered).length, 4)
// Open, it draws the branch roots inside at depth 1 — the group's own line stays
// on screen, so its rows sit under it the way a task's children do — and with no
// number to print: they have left the numbering, and inventing one here would
// disagree with the WBS the day the branch comes back.
assert.deepEqual(shape({ [archiveGroupId]: true }, numbered), [
  ['project', 'project:p', 0, ''],
  ['task', 'one', 0, '1'],
  ['task', 'two', 0, '2'],
  ['archiveGroup', archiveGroupId, 0, ''],
  ['task', 'gone', 1, ''],
])

// A row inside the drawer folds like any other, by the same rule: tasks are
// expanded until told otherwise. The chevron the row draws has to do something —
// it is the same component that draws the board's.
//
// The project's line is at the top of both, and that is the point of these two:
// every task it had is in the drawer, so it has nothing live under it at all,
// and it still stands. Its line is where a task would be dropped into it and the
// only row that says it exists, so a project cannot be allowed to disappear the
// moment its last task is filed away.
const nested = [
  filed({ id: 'P', order: 0 }),
  filed({ id: 'k', parentId: 'P', order: 0 }),
]
assert.deepEqual(shape({ [archiveGroupId]: true }, nested).map((r) => r[1]), [
  'project:p', 'archiveGroup', 'P', 'k',
])
assert.deepEqual(shape({ [archiveGroupId]: true, P: false }, nested).map((r) => r[1]), [
  'project:p', 'archiveGroup', 'P',
])

// --- a branch is the unit --------------------------------------------------

// Two levels, one archive action: the group holds the branch root, and the
// descendant hangs under it in the drawer rather than beside it — one line for
// one thing that was filed away.
const M = '2026-09-30T10:00:00.000Z'
const branch = [
  task({ id: 'P', name: 'phase', order: 0 }),
  done({ id: 'kid', name: 'kid', parentId: 'P', order: 0 }),
  task({ id: 'P2', name: 'other', order: 1 }),
]
const filedBranch = [
  { ...branch[0], archivedAt: M },
  { ...branch[1], archivedAt: M },
  branch[2],
]
assert.deepEqual(archivedRoots(filedBranch).map((t) => t.id), ['P'], 'the branch, not each row in it')

// The half-filed shape — the parent in the drawer and the child still on the
// board — is a file nobody should be able to write, and it is why the unit is
// the branch: the child drawn beside the branch root would sit in a place the
// tree has no parent for. `normalize` repairs it on the way in (asserted at the
// bottom), and `unarchiveTasks` walks the chain above for the same reason.
const half = [{ ...branch[0], archivedAt: M }, branch[1], branch[2]]
assert.deepEqual(archivedRoots(half).map((t) => t.id), ['P'], 'the child is inside the branch, not beside it')

// --- the store owns the cascade -------------------------------------------

useStore.setState({ projects: [P], tasks: [], logs: [] })
const { addTask, archiveTasks, unarchiveTasks, updateTask, startTodoTasks, withUndo, undoLast, clearUndo } = useStore.getState()
const board = () => useStore.getState().tasks
const byId = (id) => board().find((t) => t.id === id)
clearUndo()

const phase = addTask({ name: 'phase', projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-20' })
// A one-day task, ticked: the shortest true completion there is, and enough for
// the phase above it to read as done.
const kid = addTask({ name: 'kid', parentId: phase, projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-01' })
// A to-do under a finished phase is the case the confirmation exists for: a
// to-do is left out of its parent's roll-up, so it cannot stop the parent from
// reading as done — and the cascade takes it anyway, because a task left behind
// inside a filed-away branch is a task nothing draws.
const todo = addTask({ name: 'later', parentId: phase, projectId: 'p', isTodo: true })
updateTask(kid, { strictProgress: false, confirmedDays: ['2026-09-01'] })

const eff = effectiveStates(board(), [])
assert.equal(eff.get(phase).status, 'completed', 'a phase whose only timed child is done reads as done')
assert.deepEqual(archiveCascade(board(), [phase]).length, 3, 'the branch is the phase, the finished child and the to-do')

archiveTasks([phase])
assert.ok(board().every((t) => isArchived(t)), 'the whole branch goes, to-do included')
assert.equal(
  isArchived(byId(phase)),
  isArchived(byId(todo)),
  'one moment for the branch',
)
assert.equal(byId(phase).archivedAt, byId(todo).archivedAt, 'copied down rather than stamped three times')

// Archived ids dedupe, and archiving twice is not a second step.
const stamp = byId(phase).archivedAt
archiveTasks([phase, kid])
assert.equal(byId(phase).archivedAt, stamp, 're-archiving leaves the moment alone')

// --- the numbers do not move ---------------------------------------------
//
// The rule the whole feature rests on. Filing a finished child away changes what
// the board draws and nothing about what it computes: a parent whose only
// finished child has just been put in a drawer is exactly as far along as it was
// a moment ago, and the count above the table stays the count the table shows.

const before = effectiveStates(board(), []).get(phase).progress
unarchiveTasks([phase])
assert.equal(isArchived(byId(phase)), false, 'and the branch comes back')
const after = effectiveStates(board(), []).get(phase).progress
assert.equal(before, after, 'archiving moved no progress on the parent')

// --- the one number that follows the list ---------------------------------
//
// A strict task owes a log on the days it ran. Once it is filed away its row is
// gone from that day's list, so the ring that counts those rows has to lose it
// too — otherwise the day shows "1 still missing" over a panel that lists
// nothing, and the box that used to satisfy the count went into the drawer with
// it.

const strict = addTask({ name: 'strict', projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-03', strictProgress: true })
const day = '2026-09-02'
assert.equal(strictLogObligations(board(), [], day).length, 1, 'the day owes its log')
assert.deepEqual(strictLogRate(board(), [], day), { done: 0, total: 1, pct: 0 })
const rowsOn = () => daySummary(board(), [], [P], day, day).all.filter((r) => r.task.id === strict)
assert.equal(rowsOn().length, 1, 'and the task is on the day’s list')

updateTask(strict, { archivedAt: '2026-09-30T10:00:00.000Z' })
assert.equal(strictLogObligations(board(), [], day).length, 0, 'filed away, it owes nothing')
assert.deepEqual(strictLogRate(board(), [], day), { done: 0, total: 0, pct: 0 })
assert.equal(rowsOn().length, 0, 'and the rate and the list still agree about the day')

// --- any status can be filed away -----------------------------------------
//
// There is no gate in the store, and this is the case that says why: work that
// is *not* finished is what most often gets written off. The two rules still
// have to hold for it. The parent's number is the sharp one — a roll-up that
// skipped filed-away children would read `—` here instead of the number it had a
// moment ago, which reads as the parent losing its progress to the archive.
const shell = addTask({ name: 'shell', projectId: 'p', startDate: '2026-09-01', endDate: '2026-09-30' })
const running = addTask({
  name: 'running',
  parentId: shell,
  projectId: 'p',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  strictProgress: true,
})
const shellBefore = effectiveStates(board(), []).get(shell)
assert.equal(shellBefore.status, 'in-progress', 'the child is running, so the parent is too')
archiveTasks([running])
assert.ok(isArchived(byId(running)), 'a task that is still running can be filed away')
assert.deepEqual(effectiveStates(board(), []).get(shell), shellBefore, 'and the parent reads exactly as it did')
assert.ok(
  !strictLogObligations(board(), [], '2026-09-05').some((o) => o.task.id === running),
  'and it stops owing logs where it ran',
)

// --- restoring ------------------------------------------------------------

const branchIds = [phase, kid, todo]
unarchiveTasks([phase])
assert.ok(branchIds.every((id) => !isArchived(byId(id))), 'a branch comes back whole')
// ...including from the deepest row: the chain above has to come back with it,
// or the task would be live under a parent that is still in the drawer.
archiveTasks([phase])
unarchiveTasks([kid])
assert.ok([phase, kid].every((id) => !isArchived(byId(id))), 'restoring a descendant brings the branch above it too')
assert.ok(isArchived(byId(todo)), 'and nothing else: the sibling it left behind stays in the drawer')
unarchiveTasks([todo])

// A filed-away to-do cannot be started into a schedule: it would come back as a
// live task under an archived parent.
archiveTasks([phase])
startTodoTasks([{ id: todo, startDate: '2026-10-01', endDate: '2026-10-05', type: 'phase', priority: 'medium', strictProgress: true }])
assert.equal(byId(todo).isTodo, true, 'an archived to-do is not started')
unarchiveTasks([phase])

// --- undo ------------------------------------------------------------------

clearUndo()
const beforeArchive = useStore.getState().history.steps.length
withUndo('archived', () => archiveTasks([phase]))
assert.ok(isArchived(byId(phase)), 'the branch is in the drawer')
const step = useStore.getState().history.steps[beforeArchive]
assert.equal(useStore.getState().history.steps.length, beforeArchive + 1, 'one gesture, one step')
assert.ok(
  step.delta.changed.some((c) => c.id === phase && 'archivedAt' in c.before && 'archivedAt' in c.after),
  'the step records the field it wrote, on both sides — that is what makes it reversible',
)
undoLast()
assert.ok(branchIds.every((id) => !isArchived(byId(id))), 'and one press takes the whole branch back out')
clearUndo()

// --- a drop cannot file anything inside the drawer -------------------------

// `placeTasks` is the one description of a drop, read by the preview and by the
// commit. A `beforeId` naming a filed-away row is not a place, and the answer
// has to be "this cannot happen" rather than "the end of the list" — the latter
// would look like a drop that landed somewhere else.
archiveTasks([phase])
assert.equal(placeTasks(board(), [strict], phase, null, 'p'), null, 'nothing lands inside a filed-away task')
assert.equal(placeTasks(board(), [strict], null, phase, 'p'), null, 'nor in front of one')
assert.deepEqual(
  placeTasks(board(), [strict], null, null, 'p').filter((t) => t.id === phase)[0].order,
  byId(phase).order,
  'and a drop at the end renumbers the rows on the board, not the one in the drawer',
)

// --- storage ---------------------------------------------------------------

const parse = (tasks, extra = {}) =>
  parseImport(JSON.stringify({ projects: [P], tasks, logs: [], ...extra })).tasks

// A value that is not a moment reads as "not archived" rather than being written
// straight back to disk on the next save.
assert.equal(parse([task({ id: 'x', archivedAt: 'last tuesday' })])[0].archivedAt, undefined)
const kept = parse([task({ id: 'x', archivedAt: '2026-09-30T10:00:00.000Z' })])[0]
assert.equal(kept.archivedAt, '2026-09-30T10:00:00.000Z')

// The invariant the app keeps, repaired on the way in: a hand-edited file can
// hold a live task under a filed-away parent, and the tree only walks down from
// the roots — so that task would be on no screen at all.
const repaired = parse([
  filed({ id: 'P', name: 'phase' }),
  task({ id: 'orphan', name: 'orphan', parentId: 'P' }),
])
assert.ok(repaired.every((t) => isArchived(t)), 'a live child of a filed-away parent is filed away too')
assert.equal(repaired.find((t) => t.id === 'orphan').archivedAt, repaired[0].archivedAt, 'under the same moment')

// Round trip: export writes the field, import reads it back.
const exported = exportJson({ projects: [P], tasks: board(), logs: [], chores: [], habits: [], notes: [], todoFolders: {}, version: 1, exportedAt: '' })
const back = parseImport(exported).tasks
assert.deepEqual(
  back.filter((t) => isArchived(t)).map((t) => t.id).sort(),
  board().filter((t) => isArchived(t)).map((t) => t.id).sort(),
  'archived stays archived through a file',
)

// The cascade is a pure helper too, and the callers that count with it do not
// look at `effectiveStates` — this is the set an archive takes.
assert.deepEqual(
  archiveCascade(board(), [phase]).sort(),
  [phase, kid, todo].sort(),
  'a cascade is the branch — the root, everything under it, and nothing beside it',
)

await server.close()
console.log('archive: ok')
process.exit(0)

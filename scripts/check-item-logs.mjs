/**
 * The check on the entries written about routines and chores — run with
 * `node scripts/check-item-logs.mjs`.
 *
 * Two things are pinned here, and they are the two that fail quietly.
 *
 * **Who may be written about.** Every rule in `addItemLog` answers "may this
 * have a log today" without ever raising anything: a routine that is suspended,
 * ended, or simply not on today's weekday, a heading that has no tick of its own
 * to have a log beside, a chore that is not on today's plate. Refusing to write
 * looks exactly like writing to a day nobody looked at, which is why the rules
 * are asserted rather than left to the row that happens to draw the button.
 *
 * **What must not move.** The whole reason `ItemLog` is its own collection is
 * that nothing which reads a task's log may see one of these: `taskProgress`,
 * `strictLogRate` and `boardDayTallies` all read `logs`, and an entry about a
 * routine that reached them would be a percentage moving for something nobody
 * measured. The last section drives the same writes and holds those three still.
 *
 * Loaded from source by Vite like the other checks, and the clock is frozen at
 * the same Tuesday `check-habits.mjs` uses — the fixture below is laid out in one
 * specific week, and every weekday assertion leans on it.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Read at `useStore.ts` module load: the theme writes an attribute, and the
// persistence layer reads and writes localStorage. Neither is what this script
// is about, so both are stubbed rather than emulated.
globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

// Frozen at Tuesday 2026-09-22, local midday — the fixture's week depends on it.
const RealDate = Date
const FROZEN = new RealDate(2026, 8, 22, 12, 0, 0)
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
  // ever generated.
  optimizeDeps: { entries: [] },
})
const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')
const { itemLogsOn, itemLogSubject } = await server.ssrLoadModule('/src/lib/itemLogs.ts')
const { boardDayTallies } = await server.ssrLoadModule('/src/lib/heatmap.ts')
const { strictLogRate } = await server.ssrLoadModule('/src/lib/dayTasks.ts')
const { taskProgress } = await server.ssrLoadModule('/src/lib/progress.ts')
const { exportJson, parseImport } = await server.ssrLoadModule('/src/store/storage.ts')

const TODAY = '2026-09-22'
const WEEK = [0, 1, 2, 3, 4, 5, 6]
const MON_WED_FRI = [0, 2, 4]

let added = 0
const habit = (id, over = {}) => ({
  id,
  title: id,
  note: '',
  parentId: null,
  startDate: '2026-08-31',
  endDate: null,
  weekdays: [...WEEK],
  paused: false,
  pauseDate: null,
  pauses: [],
  doneDays: [],
  createdAt: `2026-08-31T00:00:${String(added++).padStart(2, '0')}Z`,
  updatedAt: '',
  ...over,
})

const chore = (id, over = {}) => ({
  id,
  title: id,
  note: '',
  date: TODAY,
  slot: null,
  time: null,
  done: false,
  completedDate: null,
  createdAt: `2026-01-01T00:00:${String(added++).padStart(2, '0')}Z`,
  updatedAt: '',
  ...over,
})

const task = (id, over = {}) => ({
  id,
  name: id,
  description: '',
  parentId: null,
  projectId: 'p1',
  type: 'phase',
  isTodo: false,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  strictProgress: true,
  confirmedDays: [],
  paused: false,
  pauseDate: null,
  pauses: [],
  priority: 'medium',
  tags: [],
  dependencies: [],
  createdAt: '',
  updatedAt: '',
  ...over,
})

useStore.setState({
  today: TODAY,
  projects: [{ id: 'p1', name: 'P', color: '#fff', description: '' }],
  tasks: [task('t1')],
  logs: [],
  habits: [
    habit('daily'),
    habit('mwf', { weekdays: [...MON_WED_FRI] }),
    habit('ended', { endDate: '2026-09-01' }),
    habit('suspended', { paused: true, pauseDate: '2026-09-10' }),
    habit('heading'),
    habit('kid', { parentId: 'heading' }),
  ],
  chores: [
    chore('due', { date: '2026-09-20' }),
    chore('doneToday', { done: true, completedDate: TODAY }),
    chore('tomorrow', { date: '2026-09-23' }),
    chore('finishedAgo', { date: '2026-09-18', done: true, completedDate: '2026-09-18' }),
  ],
  itemLogs: [],
})

const write = (kind, id, content) => useStore.getState().addItemLog(kind, id, content)
const logs = () => useStore.getState().itemLogs

// --- who a write is refused for ---------------------------------------------

write('habit', 'mwf', 'Tuesday is not its day')
write('habit', 'ended', 'over before it started')
write('habit', 'suspended', 'suspended since the tenth')
// A heading holds no tick of its own, so it holds no entry of its own either.
write('habit', 'heading', 'the container, not the work')
write('chore', 'tomorrow', 'not due yet')
write('chore', 'finishedAgo', 'finished four days ago')
write('habit', 'never-existed', 'and neither did this')
write('chore', 'never-existed', 'nor this')
assert.equal(logs().length, 0, 'a refused write leaves nothing behind')

// Nothing written is nothing stored: an empty entry would put a line in the
// day's record and a card on the Logs page for a day nobody wrote about.
write('habit', 'daily', '   \n  ')
assert.equal(logs().length, 0, 'whitespace is not an entry')

// --- and who it is allowed for ----------------------------------------------

write('habit', 'daily', 'ran 5k')
assert.equal(logs().length, 1)
assert.deepEqual(
  { kind: logs()[0].kind, ownerId: logs()[0].ownerId, date: logs()[0].date, content: logs()[0].content },
  { kind: 'habit', ownerId: 'daily', date: TODAY, content: 'ran 5k' },
  'the day is today, and it was not something the caller had to say',
)
assert.deepEqual(logs()[0].stamps, [{ at: '12:00' }], 'one reading per paragraph, from the clock')

// A child routine is a leaf like any other — the heading above it is what may
// not be written about, not the branch.
write('habit', 'kid', 'the part that is actually done')
// A chore carried over from Sunday, and one finished today: both are on today's
// plate, which is what "may be written about" means for a chore.
write('chore', 'due', 'the shop was shut, going tomorrow')
write('chore', 'doneToday', 'done at last')
assert.deepEqual(
  logs().map((l) => `${l.kind}:${l.ownerId}`),
  ['habit:daily', 'habit:kid', 'chore:due', 'chore:doneToday'],
)

// --- one entry per item per day, appended -----------------------------------

const before = logs().find((l) => l.ownerId === 'daily')
useStore.setState((s) => ({
  itemLogs: s.itemLogs.map((l) => (l === before ? { ...l, stamps: [{ at: '09:15' }] } : l)),
}))
write('habit', 'daily', 'and again in the evening')

const daily = logs().filter((l) => l.kind === 'habit' && l.ownerId === 'daily')
assert.equal(daily.length, 1, 'a second write is the same entry, not a second one')
assert.equal(daily[0].content, 'ran 5k\n\nand again in the evening', 'joined by a blank line')
// The paragraph already there keeps the reading it was written under; the new
// one carries this write's. That is what makes the two tellable apart.
assert.deepEqual(daily[0].stamps, [{ at: '09:15' }, { at: '12:00' }])

// --- reading it back --------------------------------------------------------

assert.deepEqual(
  itemLogsOn(logs(), TODAY).map((l) => l.content.split('\n')[0]),
  // Routines first, then chores; within each, by id — not by when they were
  // written, which is what keeps two entries from swapping places on a re-render.
  ['ran 5k', 'the part that is actually done', 'done at last', 'the shop was shut, going tomorrow'],
  'a day reads routines first, then chores, and in a stable order',
)
assert.deepEqual(itemLogsOn(logs(), '2026-09-21'), [], 'another day has none of this')
assert.equal(itemLogSubject(logs()[0], useStore.getState().habits, useStore.getState().chores), 'daily')
// The app sweeps an item's entries when the item goes, so this is a hand-edited
// file's case: nothing draws a line under a name, rather than under "undefined".
assert.equal(itemLogSubject({ ...logs()[0], ownerId: 'ghost' }, useStore.getState().habits, useStore.getState().chores), null)

// --- what must not move -----------------------------------------------------

const state = useStore.getState()
const tallyBefore = JSON.stringify([...boardDayTallies(state.tasks, state.logs, state.chores, state.habits, TODAY, [TODAY]).entries()])
const rateBefore = JSON.stringify(strictLogRate(state.tasks, state.logs, TODAY))
const progressBefore = taskProgress(state.tasks[0], state.logs, new Date())

write('habit', 'daily', 'one more line about the running')
write('chore', 'due', 'and another about the shop')
assert.equal(useStore.getState().logs, state.logs, 'task logs are the same list, untouched')

const after = useStore.getState()
assert.equal(
  JSON.stringify([...boardDayTallies(after.tasks, after.logs, after.chores, after.habits, TODAY, [TODAY]).entries()]),
  tallyBefore,
  'the heatmap counts what it counted',
)
assert.equal(JSON.stringify(strictLogRate(after.tasks, after.logs, TODAY)), rateBefore, 'the day still owes what it owed')
assert.equal(taskProgress(after.tasks[0], after.logs, new Date()), progressBefore, 'and nothing has a percentage on it')

// --- deleting takes the entries with it -------------------------------------

write('habit', 'heading', 'x')
useStore.getState().addHabit('branch', { parentId: 'heading' })
const branchId = useStore.getState().habits.find((h) => h.title === 'branch').id
write('habit', branchId, 'written under the branch')
const headingId = 'heading'
write('habit', headingId, 'never written, it is a heading')
// The branch's child is written about through the store, which needs it to be a
// leaf that runs today — it is both.
const branchLogs = logs().filter((l) => l.ownerId === branchId).length
assert.equal(branchLogs, 1, 'the new child is writable')

useStore.getState().deleteHabit(headingId)
assert.equal(
  logs().some((l) => l.ownerId === headingId || l.ownerId === branchId),
  false,
  'deleting a routine takes the whole branch\'s entries, not only its own',
)

useStore.getState().deleteChore('due')
assert.equal(logs().some((l) => l.kind === 'chore' && l.ownerId === 'due'), false, 'and a chore takes its own')
assert.equal(logs().some((l) => l.ownerId === 'doneToday'), true, 'and only its own')

// --- and it survives the file -------------------------------------------------

const written = logs().length
const roundTripped = parseImport(exportJson({ ...useStore.getState() }))
assert.deepEqual(roundTripped.itemLogs, logs(), 'an export and an import keep every entry')
assert.equal(roundTripped.itemLogs.length, written)
// A blob from before any of this existed: the field is absent, and absent has to
// read as "nothing written" rather than as an unreadable board.
assert.deepEqual(parseImport(JSON.stringify({ projects: [], tasks: [] })).itemLogs, [])

await server.close()
console.log('item logs: all assertions passed')
// Loading the store leaves a handle open — the same reason every check that
// loads it ends this way.
process.exit(0)

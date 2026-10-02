/**
 * The one check on the daily-item rules, run with
 * `node scripts/check-habits.mjs`.
 *
 * No framework, and nothing mocked except the two browser globals the store
 * touches at module load: `src/lib/habits.ts` and `src/store/useStore.ts` are
 * loaded straight from source by Vite, the way `check-chores.mjs` loads the
 * chore rules.
 *
 * What is being pinned down is `runsOn` — the single predicate behind "does this
 * habit belong to this day", which decides what the Today page draws, what the
 * day panel records, and whether `toggleHabit` is allowed to write anything at
 * all. It is four conditions over a date, and every one of them fails quietly:
 * an off-by-one on `endDate` looks like a habit that ran a day too long, a
 * weekday set indexed Sunday-first shifts the whole week by one, and a pause
 * that is forgotten on resume turns days the habit was *off* into days it was
 * *skipped* — the specific lie the three pause fields exist to prevent.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Read at `useStore.ts` module load: the theme writes an attribute, and the
// persistence layer reads and writes localStorage. Neither is what this script
// is about, so both are stubbed rather than emulated.
globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

// The fixture below is written around one specific week: 2026-08-31 is a
// Monday, its "today" 2026-09-22 a Tuesday, and every assertion leans on that
// layout. It used to *assert* that the real clock agreed — which made the
// script a time bomb that went off the morning after, blaming the rules for
// what was the calendar. The clock is frozen instead: `new Date()` and
// `Date.now()` stand still at the fixture's Tuesday noon, so the weekday each
// date was chosen for stays the weekday it has. Both readers of the clock go
// through it — this file's `today()` helper, and `todayISO()` inside the
// store's `toggleHabit`.
//
// `setTime` on a real instance rather than returning a substitute object:
// the subclass prototype chain stays intact, so `instanceof Date` keeps
// meaning what it meant for anything downstream that asks.
const RealDate = Date
const FROZEN = new RealDate(2026, 8, 22, 12, 0, 0) // Tue 2026-09-22, local midday
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
  optimizeDeps: { entries: [] },
})
const { habitsOn, habitBranch, routineRows, runsOn, tickedOn, pausePatch, ALL_DAYS } =
  await server.ssrLoadModule('/src/lib/habits.ts')
const { weekdayIndex } = await server.ssrLoadModule('/src/lib/dates.ts')
const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')

const today = (offset) => {
  const t = new Date()
  t.setDate(t.getDate() + offset)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
const TODAY = today(0)

// The fixture's premise is the frozen clock above, not the calendar, so the
// weekday assertions below are timeless: they pin the Monday-first convention
// the whole fixture is laid out with.
assert.equal(TODAY, '2026-09-22', 'the frozen clock is the fixture itself')
assert.equal(weekdayIndex(new Date(2026, 8, 21)), 0) // Mon
assert.equal(weekdayIndex(new Date(2026, 8, 22)), 1) // Tue
assert.equal(weekdayIndex(new Date(2026, 8, 23)), 2) // Wed
assert.equal(weekdayIndex(new Date(2026, 8, 25)), 4) // Fri
assert.equal(weekdayIndex(new Date(2026, 8, 26)), 5) // Sat
assert.equal(weekdayIndex(new Date(2026, 8, 27)), 6) // Sun

const WEEK = [0, 1, 2, 3, 4, 5, 6]
// A Monday, so that `mwf` is on the very first day it exists.
const START = '2026-08-31'

// `createdAt` walks forward by a second per fixture, because `byStart` falls
// through to it when two habits share a start date. Left equal, the order the
// assertions below read would come from `id`'s alphabet instead of from the
// order they were added — true to the code, and noise to read.
let added = 0
const habit = (id, over = {}) => {
  const n = added++
  return {
    id,
    title: id,
    note: '',
    startDate: START,
    endDate: null,
    weekdays: [...WEEK],
    paused: false,
    pauseDate: null,
    pauses: [],
    doneDays: [],
    createdAt: `2026-08-31T09:00:${String(n).padStart(2, '0')}Z`,
    updatedAt: '',
    ...over,
  }
}

const ALL = [
  // Every day, since the start of the fixture.
  habit('every'),
  // Monday, Wednesday, Friday.
  habit('mwf', { weekdays: [0, 2, 4] }),
  // Ends on a Monday. The boundary case the inclusive test is for.
  habit('ends', { endDate: '2026-09-21' }),
  // Was away from the 10th to the 15th — a *closed* segment, which is the one
  // that only survives if resuming writes it down.
  habit('away', { pauses: [{ pauseDate: '2026-09-10', resumeDate: '2026-09-15' }] }),
  // Suspended since the 20th. Still running on the 19th.
  habit('off', { paused: true, pauseDate: '2026-09-20' }),
  // Started today.
  habit('fresh', { startDate: TODAY }),
  // Started tomorrow.
  habit('later', { startDate: today(1) }),
]

const ids = (day) => habitsOn(ALL, day).map((h) => h.id)

// --- not started yet, and nothing before the earliest start -------------------
assert.deepEqual(ids('2026-08-30'), [])
// The day it started counts as a day it runs; the day before does not. This is
// the boundary `startDate` is stored for at all. `2026-08-31` being a Monday is
// also what puts `mwf` in the list.
assert.deepEqual(ids(START), ['every', 'mwf', 'ends', 'away', 'off'])
// Four habits drop out of today and each for a different reason: `mwf` is not a
// Tuesday, `ends` ran out on the 21st, `off` is suspended, `later` has not
// started. That all four absences are absences rather than greyed rows is the
// decision this whole predicate exists to carry out.
assert.deepEqual(ids(TODAY), ['every', 'away', 'fresh'])
assert.deepEqual(ids(today(1)), ['every', 'mwf', 'away', 'fresh', 'later'])

// --- weekdays -----------------------------------------------------------------
// A Tuesday. `mwf` is simply not on it — not shown greyed, absent.
assert.equal(runsOn(ALL[1], TODAY), false)
assert.equal(runsOn(ALL[1], '2026-09-21'), true) // Mon
assert.equal(runsOn(ALL[1], '2026-09-23'), true) // Wed
assert.equal(runsOn(ALL[1], '2026-09-25'), true) // Fri
assert.equal(runsOn(ALL[1], '2026-09-26'), false) // Sat
assert.equal(runsOn(ALL[1], '2026-09-27'), false) // Sun
// Index 0 is Monday, not Sunday. A set that meant Mon/Wed/Fri on a Sunday-first
// reading would light up Tue/Thu/Sat instead, which is the whole failure mode.
assert.deepEqual(ids('2026-09-26'), ['every', 'away', 'fresh', 'later'])
// All seven is every day, and there is no eighth value that means it.
assert.deepEqual([...ALL_DAYS], WEEK)
assert.equal(runsOn(habit('x', { weekdays: ALL_DAYS }), '2026-09-27'), true)

// --- end date, inclusive ------------------------------------------------------
assert.equal(runsOn(ALL[2], '2026-09-21'), true)
assert.equal(runsOn(ALL[2], TODAY), false)
// The 21st is the last day `ends` runs — and the day after `off` was suspended.
assert.deepEqual(ids('2026-09-21'), ['every', 'mwf', 'ends', 'away'])

// --- pause --------------------------------------------------------------------
// A closed segment covers `[pauseDate, resumeDate)`: the 10th is the first day
// away, the 15th is the day back.
assert.equal(runsOn(ALL[3], '2026-09-09'), true)
assert.equal(runsOn(ALL[3], '2026-09-10'), false)
assert.equal(runsOn(ALL[3], '2026-09-14'), false)
assert.equal(runsOn(ALL[3], '2026-09-15'), true)
assert.deepEqual(ids('2026-09-12'), ['every', 'ends', 'off'])
// The open segment has no end: suspended since the 20th, off on the 20th and
// every day after, and still on for every day before it.
assert.equal(runsOn(ALL[4], '2026-09-19'), true)
assert.equal(runsOn(ALL[4], '2026-09-20'), false)
assert.equal(runsOn(ALL[4], TODAY), false)

// --- pausePatch ---------------------------------------------------------------
// Already what was asked for: no patch, so the caller writes nothing and
// `updatedAt` does not move.
assert.deepEqual(pausePatch(ALL[0], false, TODAY), {})

// Suspending: the open segment starts today, and nothing else moves.
assert.deepEqual(pausePatch(ALL[0], true, TODAY), { paused: true, pauseDate: TODAY })

// Resuming: the open segment is closed into `pauses`. This is the write that
// makes the days it covered stay off the list afterwards — drop it and the whole
// fortnight comes back reading as a fortnight the habit was skipped.
const resumed = { ...ALL[4], ...pausePatch(ALL[4], false, '2026-09-25') }
assert.deepEqual(resumed.pauses, [
  { pauseDate: '2026-09-20', resumeDate: '2026-09-25' },
])
assert.equal(resumed.paused, false)
assert.equal(resumed.pauseDate, null)
// The days under it are still not days it runs on, now as a closed segment.
assert.equal(runsOn(resumed, '2026-09-22'), false)
assert.equal(runsOn(resumed, '2026-09-24'), false)
assert.equal(runsOn(resumed, '2026-09-25'), true)
// The suspension that was lifted on the same day it began covers no day at all:
// `[d, d)` is empty, which is correct — it never lasted a day to be off on.
const sameDay = { ...ALL[0], paused: true, pauseDate: '2026-09-22' }
assert.equal(runsOn({ ...sameDay, ...pausePatch(sameDay, false, TODAY) }, TODAY), true)

// --- an empty board, and a tick with nothing behind it ------------------------
assert.deepEqual(habitsOn([], TODAY), [])
assert.equal(tickedOn(habit('x'), TODAY), false)
// `tickedOn` is membership and nothing else. It is asked about days the habit
// does run on; a tick dated outside them cannot be created (see the store guard
// below), and this must not quietly pretend otherwise.
assert.equal(tickedOn(habit('x', { doneDays: ['2026-09-10'] }), '2026-09-10'), true)
// The input is not rearranged: `habitsOn` sorts a copy, and the store's array is
// shared with everything else reading it.
assert.deepEqual(ALL.map((h) => h.id), ['every', 'mwf', 'ends', 'away', 'off', 'fresh', 'later'])

// --- the store guard ----------------------------------------------------------
// The last line of defence, and the only one that protects the *data* rather
// than a rendering. `toggleHabit` takes no day argument — it always writes the
// day that is happening — so what it has to refuse is a habit that is not
// running today: suspended, ended, or simply not a Tuesday.
useStore.setState({ today: TODAY, habits: ALL })
const doneDaysOf = (id) => useStore.getState().habits.find((h) => h.id === id).doneDays

useStore.getState().toggleHabit('every')
assert.deepEqual(doneDaysOf('every'), [TODAY], 'a habit that runs today ticks')
useStore.getState().toggleHabit('every')
assert.deepEqual(doneDaysOf('every'), [], 'and untickcs')

for (const id of ['mwf', 'ends', 'off', 'later']) {
  useStore.getState().toggleHabit(id)
  // Nothing written, rather than a tick on a day that is not one of its own.
  assert.deepEqual(doneDaysOf(id), [], `${id} does not run today; nothing may be written`)
}

// The idle habit — away until the 15th, and it is now the 22nd — is running
// again, so it ticks like any other.
useStore.getState().toggleHabit('away')
assert.deepEqual(doneDaysOf('away'), [TODAY])

// --- the routine tree ---------------------------------------------------------
//
// `routineRows` is what every list of routines is drawn from now — the two Today
// columns, the day panel, the Manage page's roster and the reminder digest — and
// three of its rules fail silently. A heading counted as a leaf puts a group and
// its children into the same fraction; a heading left lit over unticked children
// is the one contradiction the roll-up exists to prevent; and a routine that
// cannot hang anywhere would just be absent from the board, which is the only
// failure here that loses something rather than misdrawing it.

const rowOf = (habits, id, folded = new Set()) =>
  routineRows(habits, TODAY, folded).find((r) => r.habit.id === id)
/** Each row as [id, depth, is-a-heading, done, open] — the days are checked apart. */
const shape = (habits, day = TODAY, folded = new Set()) =>
  routineRows(habits, day, folded).map((r) => [r.habit.id, r.depth, r.hasKids, r.done, r.open])
/** Each row as [id, its days of the week]. */
const days = (habits, day = null) => routineRows(habits, day).map((r) => [r.habit.id, r.weekdays])

const tickedFixture = (h) => ({ ...h, doneDays: [TODAY] })

// A flat board is what there was before trees, and it has to still be exactly
// that: same rows, same order, nothing nested, nothing a heading.
assert.deepEqual(
  shape(ALL),
  habitsOn(ALL, TODAY).map((h) => [h.id, 0, false, false, true]),
  'a board with no parent links must read exactly as it did before there were any',
)

// A Sunday of a Monday-only routine: `mwf` is off, and nothing else moves.
assert.deepEqual(routineRows(ALL, TODAY).map((r) => r.habit.id), ids(TODAY))

// `group` runs on Mondays and its children every day. On a Tuesday it is still
// drawn, because its children are — a heading's own days are not read, and a
// heading with nothing under it that day is not a row at all.
const GROUP = [
  habit('group', { weekdays: [0] }),
  habit('run', { parentId: 'group' }),
  habit('stretch', { parentId: 'group' }),
]
assert.deepEqual(shape(GROUP), [
  ['group', 0, true, false, true],
  ['run', 1, false, false, true],
  ['stretch', 1, false, false, true],
])

// Done when all of them are, and only then — the whole point of the roll-up.
assert.equal(rowOf([GROUP[0], tickedFixture(GROUP[1]), GROUP[2]], 'group').done, false)
assert.equal(rowOf(GROUP.map((h) => (h.id === 'group' ? h : tickedFixture(h))), 'group').done, true)

// The heading's own tick is not read in either direction: one dated from before
// it had children must not light it up, and `toggleHabit` cannot write one now.
assert.equal(rowOf([tickedFixture(GROUP[0]), GROUP[1], GROUP[2]], 'group').done, false)

// Folding takes the rows away, not the answer: the count on a folded heading is
// every child it has, which is what keeps `2/3` from changing as it is opened.
const allTick = GROUP.map((h) => (h.id === 'group' ? h : tickedFixture(h)))
assert.deepEqual(shape(allTick, TODAY, new Set(['group'])), [['group', 0, true, true, false]])
assert.equal(rowOf(GROUP, 'group', new Set(['group'])).open, false)

// --- the days a heading is on -------------------------------------------------
//
// A heading holds no days of its own, so the field reports the union of what is
// under it — the same bargain as its tick, and the only thing that keeps a
// heading's schedule from being a value nothing reads. The leaf rows below it
// report their own, unchanged, so the two forms of the field have to come out of
// the same walk without one overwriting the other.

const MWF = [0, 2, 4]
const spread = [
  habit('group', { weekdays: [5, 6] }), // its own days are the one thing not read
  habit('mon', { parentId: 'group', weekdays: [0] }),
  habit('wed', { parentId: 'group', weekdays: [2, 4] }),
]
assert.deepEqual(days(spread), [
  ['group', MWF],
  ['mon', [0]],
  ['wed', [2, 4]],
])
// Three levels: the union is over the leaves, not over whatever each level
// happens to have been given.
const nested = [
  habit('top', { weekdays: [3] }),
  habit('mid', { parentId: 'top', weekdays: [1] }),
  habit('leaf', { parentId: 'mid', weekdays: [6] }),
]
assert.deepEqual(days(nested), [
  ['top', [6]],
  ['mid', [6]],
  ['leaf', [6]],
])
// All seven under a heading reads as "every day", which is what the roster and
// the editor both print it as.
assert.deepEqual(rowOf(GROUP, 'group').weekdays, ALL_DAYS)
// The union is a fresh array: a caller that sorted one in place would otherwise
// be rearranging the board's own list.
const own = routineRows(spread, null).find((r) => r.habit.id === 'wed').weekdays
own.reverse()
assert.deepEqual(spread[2].weekdays, [2, 4])

// A heading whose only child is off today has nothing to head, so it is not a
// row — otherwise the day would carry a line with no box and no children.
assert.deepEqual(shape([GROUP[0], habit('mondays', { parentId: 'group', weekdays: [0] })]), [])

// Grandchildren, and a sibling that arrives after its parent: the tree is drawn
// in `byStart` order within each level, whichever order the collection is in.
const DEEP = [habit('top'), habit('mid', { parentId: 'top' }), habit('deep', { parentId: 'mid' }), habit('other')]
assert.deepEqual(shape(DEEP), [
  ['top', 0, true, false, true],
  ['mid', 1, true, false, true],
  ['deep', 2, false, false, true],
  ['other', 0, false, false, true],
])
assert.deepEqual(routineRows(DEEP, TODAY, new Set(['top'])).map((r) => r.habit.id), ['top', 'other'])

// A parent that is not on the list, or a cycle somebody hand-edited in, leaves
// the child with nowhere to hang — and it stands at the top rather than
// vanishing. This is the one rule here that can lose data instead of misdrawing
// it, so it is asserted in both shapes.
assert.deepEqual(shape([habit('lost', { parentId: 'nobody' })]), [['lost', 0, false, false, true]])
const cyclic = [habit('a', { parentId: 'b' }), habit('b', { parentId: 'a' })]
assert.deepEqual(shape(cyclic), [
  ['a', 0, false, false, true],
  ['b', 0, false, false, true],
])

// The roster's question: `day` is null, so everything is there and nothing is
// done — a paused routine included, which is the whole reason the Manage page
// asks its own question rather than the day's.
// Listed with the suspended routine first, and drawn with it last: the roster is
// in `byStart` order — the order the rows have always been in — and the array
// order decides nothing. A day filter would have dropped `paused` altogether,
// which is the whole reason the roster asks its own question.
const roster = [habit('paused', { paused: true, pauseDate: TODAY }), ...GROUP]
assert.deepEqual(shape(roster, null), [
  ['group', 0, true, false, true],
  ['run', 1, false, false, true],
  ['stretch', 1, false, false, true],
  ['paused', 0, false, false, true],
])
assert.equal(rowOf(allTick, 'group', new Set()).done, true, 'a day, the same board')
assert.equal(routineRows(allTick, null).find((r) => r.habit.id === 'group').done, false, 'the roster, not a day')

// The digest's slice: the day's routines that are neither headings nor done.
assert.deepEqual(
  routineRows([GROUP[0], tickedFixture(GROUP[1]), GROUP[2]], TODAY)
    .filter((r) => !r.hasKids && !r.done)
    .map((r) => r.habit.title),
  ['stretch'],
)

// Sorting a copy, not the board: the store's array is shared with everything
// else reading it, and `byStart` is the order the rows are drawn in.
const before = GROUP.map((h) => h.id)
routineRows(GROUP, TODAY)
assert.deepEqual(GROUP.map((h) => h.id), before)

// A heading is refused a tick of its own — for a different reason from `mwf`
// above: it runs every day, so `runsOn` would let this one through, and what it
// would leave behind is a day nothing reads, because `routineRows` takes a
// heading's done from its children. The refusal is what keeps `doneDays` empty
// on a heading by construction rather than by nobody ever asking.
useStore.setState({ today: TODAY, habits: GROUP })
useStore.getState().toggleHabit('group')
assert.deepEqual(doneDaysOf('group'), [], 'a heading has no tick of its own to write')
useStore.getState().toggleHabit('run')
assert.deepEqual(doneDaysOf('run'), [TODAY], 'and its children tick as they always did')

// --- the branch, and what deleting a heading takes --------------------------
assert.deepEqual([...habitBranch(DEEP, 'top')].sort(), ['deep', 'mid', 'top'])
assert.deepEqual([...habitBranch(DEEP, 'mid')].sort(), ['deep', 'mid'])
assert.deepEqual([...habitBranch(DEEP, 'other')], ['other'])
assert.deepEqual([...habitBranch(cyclic, 'a')].sort(), ['a', 'b'], 'a cycle still terminates')

useStore.setState({ habits: GROUP })
useStore.getState().deleteHabit('group')
assert.deepEqual(useStore.getState().habits, [], 'deleting a heading takes its children with it')
useStore.setState({ habits: DEEP })
useStore.getState().deleteHabit('mid')
assert.deepEqual(useStore.getState().habits.map((h) => h.id), ['top', 'other'], 'and only its own branch')

await server.close()
console.log('habits: ok')
process.exit(0)

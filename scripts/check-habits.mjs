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

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { entries: [] },
})
const { habitsOn, runsOn, tickedOn, pausePatch, ALL_DAYS } = await server.ssrLoadModule('/src/lib/habits.ts')
const { weekdayIndex } = await server.ssrLoadModule('/src/lib/dates.ts')
const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')

const today = (offset) => {
  const t = new Date()
  t.setDate(t.getDate() + offset)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
const TODAY = today(0)

// The fixture's own premise, asserted before anything is built on it. Every date
// below is chosen for the weekday it falls on, so if one of them is not the day
// the test believes, the failures downstream would blame the rule.
assert.equal(TODAY, '2026-09-22', 'fixture dates below assume this is today')
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

await server.close()
console.log('habits: ok')
process.exit(0)

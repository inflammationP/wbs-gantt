/**
 * The one check on which log entry states a day's progress — run with
 * `node scripts/check-log-progress.mjs`.
 *
 * A day has one figure, and only the day's *first* entry says what it is. A
 * second entry written hours later is more of the same day's writing, and
 * `LogDialog` no longer offers it any boxes to fill in. Two things have to hold
 * for that to be safe rather than a lost number, and neither is visible when it
 * breaks:
 *
 *  1. `opensLogDay` has to answer "no" for exactly the entries that come after
 *     the day's first — per task and per day, so another task's log on the same
 *     day does not close this one's day.
 *  2. The entry that states nothing must not erase what an earlier one stated.
 *     `taskProgress` walks back for the latest entry that *does* carry a
 *     target; reading only the last row would drop a stated 40% to the
 *     logged-days fallback the moment a second, blank entry was written.
 *
 * No framework, nothing mocked: the two modules are loaded straight from source
 * by Vite, the same way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { opensLogDay, isLogDayOpen } = await server.ssrLoadModule('/src/lib/logs.ts')
const { taskProgress } = await server.ssrLoadModule('/src/lib/progress.ts')

/** Local midnight, the way `toDate` builds the dates the app passes in. */
const on = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** A strict leaf: the only kind of task a target progress is ever read back on. */
const task = (over = {}) => ({
  id: 'a',
  name: 'a',
  description: '',
  parentId: null,
  projectId: 'p',
  type: 'phase',
  isTodo: false,
  startDate: '2026-09-01',
  endDate: '2026-09-05',
  strictProgress: true,
  confirmedDays: [],
  paused: false,
  pauseDate: null,
  pauses: [],
  priority: null,
  tags: [],
  dependencies: [],
  createdAt: '',
  updatedAt: '',
  ...over,
})

const log = (taskId, date, targetProgress = null) => ({
  id: `${taskId}@${date}#${String(targetProgress)}`,
  taskId,
  date,
  content: '',
  targetProgress,
  createdAt: '',
  updatedAt: '',
})

const DAY = '2026-09-02'

// --- which days are still open ---------------------------------------------
//
// A log is written, corrected and removed on its own day and never again. The
// window is one day wide, and both edges matter: yesterday is the record this
// rule exists to protect, and tomorrow is the entry that would sit at the end of
// the task's list and be the figure it reads — so writing today would move
// nothing. See `isLogDayOpen`.

assert.equal(isLogDayOpen(DAY, DAY), true)
assert.equal(isLogDayOpen('2026-09-01', DAY), false, 'yesterday is a record')
assert.equal(isLogDayOpen('2026-09-03', DAY), false, 'tomorrow would outrank today')

// --- which entry opens the day ---------------------------------------------

assert.equal(opensLogDay([], 'a', DAY), true)
assert.equal(opensLogDay([log('a', '2026-09-01')], 'a', DAY), true, 'yesterday does not close today')
assert.equal(opensLogDay([log('a', DAY)], 'a', DAY), false, 'the day is open from its first entry on')
// Per task: another task's work on the same day is its own day.
assert.equal(opensLogDay([log('b', DAY)], 'a', DAY), true)
// Per day: the same task's entry a day later opens *that* day.
assert.equal(opensLogDay([log('a', '2026-09-03')], 'a', '2026-09-03'), false)

// --- the entry that states nothing -----------------------------------------

const T = task()
const OPENING = log('a', DAY, 40)

// The day's figure comes off its first entry.
assert.equal(taskProgress(T, [OPENING], on(DAY)), 40)
// A second entry that day writes no number, and the day keeps the one it gave.
// This is the pair the dialog's hidden boxes rely on: nothing is asked, so
// nothing is written, so nothing moves.
assert.equal(taskProgress(T, [OPENING, log('a', DAY)], on(DAY)), 40)
// ...and it still reads 40 the next morning, rather than falling back to the
// logged-days rule, which would have counted the blank second entry as a day.
assert.equal(taskProgress(T, [OPENING, log('a', DAY)], on('2026-09-03')), 40)
// A later day's stated number is a later number, whatever the middle entries say.
assert.equal(taskProgress(T, [OPENING, log('a', DAY), log('a', '2026-09-03', 65)], on('2026-09-03')), 65)
// An entry carrying a figure is what closes a day for the purposes of the
// question, but not for this one: what matters is that there is an entry.
assert.equal(opensLogDay([log('a', DAY, 40)], 'a', DAY), false)
// No entry at all for the task: the fallback still counts logged days, which is
// what keeps the logs written before the field existed from reading 0%.
assert.equal(taskProgress(T, [log('a', '2026-09-01')], on('2026-09-01')), 20)

await server.close()
console.log('log progress: ok')

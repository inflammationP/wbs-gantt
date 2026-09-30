/**
 * The one check on how a simplified task's progress is counted, run with
 * `node scripts/check-simplified-progress.mjs`.
 *
 * `strictProgress: false` used to mean "the calendar works this out for you":
 * progress was the share of the window that had elapsed, so it moved whether or
 * not anyone did anything. It now means the opposite — the days you ticked off,
 * over the days you could have — and the two rules disagree in exactly the
 * places that are easy to get wrong and impossible to notice: a tick made today
 * leaking into yesterday's number, a pause counted as a day that was missed, and
 * a window with no countable days left in it.
 *
 * No framework, nothing mocked: `src/lib/progress.ts` is loaded straight from
 * source by Vite, the same way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { taskProgress, completedOn } = await server.ssrLoadModule('/src/lib/progress.ts')

/** Local midnight, the way `toDate` builds the dates the app passes in. */
const on = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const task = (over) => ({
  id: 'a',
  name: 'a',
  description: '',
  parentId: null,
  projectId: 'p',
  type: 'phase',
  isTodo: false,
  startDate: '2026-09-01',
  endDate: '2026-09-05',
  strictProgress: false,
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

/** A log entry — what moves a strict task's number, where a tick moves a plain one. */
const log = (taskId, date, targetProgress = null) => ({
  id: `${taskId}@${date}`, taskId, date, content: '', targetProgress, createdAt: '', updatedAt: '',
})

/** The same task keeping a log instead of ticking days. The fixture is the
    plain one, because that is what this file is about. */
const strict = (over = {}) => task({ strictProgress: true, ...over })

/** Progress of a simplified task, with `days` ticked off, read on `when`. */
const pct = (days, when = '2026-09-05', over = {}) =>
  taskProgress(task({ confirmedDays: days, ...over }), [], on(when))

// The window is 09-01..09-05 inclusive: five days you could be on it.
assert.equal(pct([]), 0)
assert.equal(pct(['2026-09-01']), 20)
assert.equal(pct(['2026-09-01', '2026-09-02']), 40)
// Every day ticked is every day there was.
assert.equal(pct(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']), 100)
assert.equal(pct(['2026-09-01', '2026-09-02'], '2026-09-20'), 40)

// A tick made today cannot answer for yesterday. `dayTasks.progressBefore` asks
// this one day at a time to work out whether a task was already finished when a
// day began, so a number that ignored `onDate` would move the past.
assert.equal(pct(['2026-09-01', '2026-09-04'], '2026-09-03'), 20)
assert.equal(pct(['2026-09-01', '2026-09-04'], '2026-09-04'), 40)

// Days outside the window are not part of the question, whichever side they
// fall on.
assert.equal(pct(['2026-08-31', '2026-09-06']), 0)
assert.equal(pct(['2026-09-01', '2026-08-31', '2026-09-06']), 20)

// Paused days leave the denominator. `resumeTask` pushes the end date out by
// however long the pause lasted, so counting those days would grow the total
// without adding a day anyone could tick — the task could never reach 100%.
// Here two days are paused inside a five-day window: three days remain, and two
// of them are ticked.
const paused = { pauses: [{ pauseDate: '2026-09-02', resumeDate: '2026-09-04' }] }
assert.equal(pct(['2026-09-01', '2026-09-04'], '2026-09-05', paused), 67)
assert.equal(pct(['2026-09-01', '2026-09-04', '2026-09-05'], '2026-09-05', paused), 100)

// A window with nothing countable left in it — paused end to end — is a
// degenerate input, not a division by zero.
assert.equal(pct([], '2026-09-05', { pauses: [{ pauseDate: '2026-09-01', resumeDate: '2026-09-06' }] }), 0)

// The pause that is still open counts the same way as a closed one.
assert.equal(pct([], '2026-09-05', { paused: true, pauseDate: '2026-09-02' }), 0)

// Long-term goals and to-dos have no progress at all, and a task that has not
// started reads "—" rather than 0.
assert.equal(taskProgress(task({ type: 'long-term', endDate: null }), [], on('2026-09-05')), null)
assert.equal(taskProgress(task({ isTodo: true, startDate: null, endDate: null }), [], on('2026-09-05')), null)
assert.equal(pct([], '2026-08-31'), null)

// A task with no dates cannot be counted on any day.
assert.equal(taskProgress(task({ startDate: null, endDate: null }), [], on('2026-09-05')), 0)

// --- the day a task was actually finished ---

// A strict task's day is its log's, and the *first* log that reads 100 is the
// one — not the last log it has. A diary entry the next morning carries no
// target, states nothing, and must not push the completion a day later.
const early = [log('a', '2026-09-01', 40), log('a', '2026-09-03', 100), log('a', '2026-09-05')]
assert.equal(completedOn(strict(), early), '2026-09-03')

// Backfilled: one log, written today, about a day three days ago. The day it
// says is the day it means.
assert.equal(completedOn(strict(), [log('a', '2026-09-02', 100)]), '2026-09-02')

// Finished at the end of the window, and never finished at all.
assert.equal(completedOn(strict(), [log('a', '2026-09-05', 100)]), '2026-09-05')
assert.equal(completedOn(strict(), [log('a', '2026-09-03', 80)]), null)
assert.equal(completedOn(strict(), []), null)

// A plain task is finished when every countable day has been ticked, so the day
// it finished is the day of the tick that completed the set.
const window = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']
assert.equal(completedOn(task({ confirmedDays: window }), []), '2026-09-05')
assert.equal(completedOn(task({ confirmedDays: window.slice(0, 4) }), []), null)

await server.close()
console.log('simplified progress: ok')

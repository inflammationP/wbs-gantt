/**
 * The one check on the heatmap's day rule, run with
 * `node scripts/check-heatmap.mjs`.
 *
 * No framework, and nothing mocked: the app's own types, loaded straight from
 * source by Vite (which is the only reason a `.ts` file with type-only imports
 * can be loaded outside the browser at all). Each case is one clause of the rule
 * the task panel's heatmap and Manage's overview both read: a day is done when
 * every task scheduled for it was finished — logged, for a strict task, elapsed
 * for any other.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { branchDayTallies, boardDayTallies } = await server.ssrLoadModule('/src/lib/heatmap.ts')

const TODAY = '2026-09-15'

const task = (over) => ({
  id: 't', name: 't', description: '', parentId: null, projectId: 'p',
  type: 'phase', isTodo: false,
  startDate: '2026-09-10', endDate: '2026-09-14',
  strictProgress: false, paused: false, pauseDate: null, pauses: [],
  priority: null, tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})

const log = (taskId, date) => ({ id: `${taskId}@${date}`, taskId, date, content: '', createdAt: '', updatedAt: '' })

// Every clause asks about one week, so one list of days does for all of them.
const WEEK = ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15']
const talliesOf = (tasks, logs, days = WEEK) => branchDayTallies(tasks, logs, TODAY, 'a', days)
const board = (tasks, logs, days = WEEK) => boardDayTallies(tasks, logs, TODAY, days)
/** The days a branch counts as clean — what the task panel's heatmap lights. */
const doneOn = (tasks, logs, days = WEEK) => {
  const tallies = talliesOf(tasks, logs, days)
  return days.filter((day) => {
    const { total, done } = tallies.get(day)
    return total > 0 && done === total
  })
}

// Non-strict: the days the window has passed over, and neither the day before
// the start nor today itself — a day is done once it is over.
assert.deepEqual(doneOn([task({ id: 'a' })], []), ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'])

// A window that has not opened yet: nothing is done.
assert.deepEqual(doneOn([task({ id: 'a', startDate: '2026-09-20', endDate: '2026-09-30' })], []), [])

// Strict: only the logged days. A log dated outside the window does not make
// that day done — the day still has to be one the task was scheduled for, which
// is the same condition the Calendar's strict count uses.
assert.deepEqual(
  doneOn([task({ id: 'a', strictProgress: true })], [log('a', '2026-09-10'), log('a', '2026-09-12'), log('a', '2026-09-15')]),
  ['2026-09-10', '2026-09-12'],
)
// Today's own log does count, on a window that reaches it.
assert.deepEqual(
  doneOn([task({ id: 'a', strictProgress: true, endDate: '2026-09-20' })], [log('a', '2026-09-15')]),
  ['2026-09-15'],
)

// A strict child alongside a non-strict one: the branch is done only on the days
// both are — and the non-strict child is done on every day that has passed, so
// the branch's done days are exactly the strict child's logs.
const branch = [
  task({ id: 'a', startDate: '2026-09-10', endDate: '2026-09-14' }),
  task({ id: 'b', parentId: 'a', strictProgress: true }),
  task({ id: 'c', parentId: 'a' }),
]
assert.deepEqual(doneOn(branch, [log('b', '2026-09-10'), log('b', '2026-09-12')]), ['2026-09-10', '2026-09-12'])

// Paused days are not days the task could have been done on.
assert.deepEqual(
  doneOn([task({ id: 'a', paused: true, pauseDate: '2026-09-12' })], []),
  ['2026-09-10', '2026-09-11'],
)

// An unresolved end (`null`) is open-ended, not never-active: the days up to
// today still count.
assert.deepEqual(
  doneOn([task({ id: 'a', endDate: null })], []),
  ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'],
)

// A to-do and a long-term goal are neither of them things a day can be done
// for, so a branch made only of those has no done days at all.
assert.deepEqual(doneOn([task({ id: 'a', isTodo: true, startDate: null, endDate: null })], []), [])
assert.deepEqual(doneOn([task({ id: 'a', type: 'long-term', endDate: null })], []), [])

// The days asked about are the only ones answered about — the heatmap's window
// is a slice of the task, not the whole of it.
assert.deepEqual(doneOn([task({ id: 'a' })], [], ['2026-09-11']), ['2026-09-11'])

// The board is the same question asked of every project at once, and it answers
// with a size rather than a yes: `a` is carried by the calendar, `b` only by its
// log, so the 11th is a two and the 12th a one — which is the shading Manage
// draws, and the whole point of counting instead of testing.
const boardTasks = [
  task({ id: 'a' }),
  task({ id: 'b', projectId: 'q', strictProgress: true }),
]
assert.deepEqual(board(boardTasks, [log('b', '2026-09-11')]).get('2026-09-11'), { total: 2, done: 2 })
assert.deepEqual(board(boardTasks, [log('b', '2026-09-11')]).get('2026-09-12'), { total: 2, done: 1 })
// A day nobody had anything scheduled for tallies zero rather than going
// missing, so an empty square and a quiet day are told apart downstream.
assert.deepEqual(board(boardTasks, []).get('2026-09-09'), { total: 0, done: 0 })
// With only one of the two scheduled, that one alone decides the day.
const split = [task({ id: 'a' }), task({ id: 'b', projectId: 'q', startDate: '2026-09-20', endDate: '2026-09-25' })]
assert.deepEqual(board(split, []).get('2026-09-11'), { total: 1, done: 1 })
// ...and a day still to come is scheduled without being done: it has a size,
// but nothing has been finished on it yet.
assert.deepEqual(board(split, [], ['2026-09-22']).get('2026-09-22'), { total: 1, done: 0 })
// A paused task is not scheduled work, so it does not pad the day's size.
assert.deepEqual(board([task({ id: 'a', paused: true, pauseDate: '2026-09-12' })], []).get('2026-09-12'), { total: 0, done: 0 })

await server.close()
console.log('heatmap: ok')

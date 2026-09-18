/**
 * The one check on the heatmap's day rule, run with
 * `node scripts/check-heatmap.mjs`.
 *
 * No framework, and nothing mocked: the app's own types, loaded straight from
 * source by Vite (which is the only reason a `.ts` file with type-only imports
 * can be loaded outside the browser at all). Each case is one clause of the rule
 * the task panel's heatmap and Manage's overview both read: a day is done when
 * every task scheduled for it was finished — logged, for a strict task, ticked
 * off by hand for any other. Both kinds are done because a person said so; the
 * plain one used to be done by the calendar, which lit up every day that had
 * passed for a task nobody had touched.
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
  strictProgress: false, confirmedDays: [], paused: false, pauseDate: null, pauses: [],
  priority: null, tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})

const log = (taskId, date) => ({ id: `${taskId}@${date}`, taskId, date, content: '', createdAt: '', updatedAt: '' })

// Every clause asks about one week, so one list of days does for all of them.
const WEEK = ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15']
const talliesOf = (tasks, logs, days = WEEK) => branchDayTallies(tasks, logs, TODAY, 'a', days)
const board = (tasks, logs, days = WEEK) => boardDayTallies(tasks, logs, [], TODAY, days)
const chore = (over) => ({
  id: 'c', title: 'c', note: '', date: '2026-09-11', done: false,
  completedDate: null, createdAt: '', updatedAt: '',
  ...over,
})
/** The days a branch counts as clean — what the task panel's heatmap lights. */
const doneOn = (tasks, logs, days = WEEK) => {
  const tallies = talliesOf(tasks, logs, days)
  return days.filter((day) => {
    const { total, done } = tallies.get(day)
    return total > 0 && done === total
  })
}

// Plain: exactly the days that were ticked off, and nothing else. An untended
// task is not a task being done, however much of its window has gone by.
assert.deepEqual(doneOn([task({ id: 'a' })], []), [])
assert.deepEqual(
  doneOn([task({ id: 'a', confirmedDays: ['2026-09-11', '2026-09-13'] })], []),
  ['2026-09-11', '2026-09-13'],
)
// A tick dated outside the window has no square of its own to land on, and must
// not be credited to the nearest one either.
assert.deepEqual(doneOn([task({ id: 'a', confirmedDays: ['2026-09-09'] })], []), [])

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

// A strict child alongside a plain one: the branch is done only on the days both
// are, and the two are done in different ways — the log and the tick have to
// agree. Here the strict child logged the 10th and the 12th while the plain one
// was ticked on the 10th and the 11th, so the 10th is the only day the whole
// branch was done. The 11th has the tick but no log; the 12th the log but no
// tick.
const branch = [
  task({ id: 'a', startDate: '2026-09-10', endDate: '2026-09-14' }),
  task({ id: 'b', parentId: 'a', strictProgress: true }),
  task({ id: 'c', parentId: 'a', confirmedDays: ['2026-09-10', '2026-09-11'] }),
]
assert.deepEqual(doneOn(branch, [log('b', '2026-09-10'), log('b', '2026-09-12')]), ['2026-09-10'])

// Paused days are not days the task could have been done on, whatever the ticks
// say: the 12th onwards is skipped out of the day altogether, so a tick left on
// one of them lights nothing.
assert.deepEqual(
  doneOn(
    [task({ id: 'a', confirmedDays: ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'], paused: true, pauseDate: '2026-09-12' })],
    [],
  ),
  ['2026-09-10', '2026-09-11'],
)

// An unresolved end (`null`) is open-ended, not never-active: a tick past the
// window this fixture would otherwise have still lands on its own day.
assert.deepEqual(
  doneOn([task({ id: 'a', endDate: null, confirmedDays: ['2026-09-15'] })], []),
  ['2026-09-15'],
)

// A to-do and a long-term goal are neither of them things a day can be done
// for, so a branch made only of those has no done days at all.
assert.deepEqual(doneOn([task({ id: 'a', isTodo: true, startDate: null, endDate: null })], []), [])
assert.deepEqual(doneOn([task({ id: 'a', type: 'long-term', endDate: null })], []), [])

// The days asked about are the only ones answered about — the heatmap's window
// is a slice of the task, not the whole of it.
assert.deepEqual(doneOn([task({ id: 'a', confirmedDays: ['2026-09-11'] })], [], ['2026-09-11']), ['2026-09-11'])

// The board is the same question asked of every project at once, and it answers
// with a size rather than a yes: `a` is carried by its ticks, `b` only by its
// log, so the 11th is a two and the 12th a one — which is the shading Manage
// draws, and the whole point of counting instead of testing.
const boardTasks = [
  task({ id: 'a', confirmedDays: ['2026-09-11', '2026-09-12'] }),
  task({ id: 'b', projectId: 'q', strictProgress: true }),
]
assert.deepEqual(board(boardTasks, [log('b', '2026-09-11')]).get('2026-09-11'), { total: 2, done: 2 })
assert.deepEqual(board(boardTasks, [log('b', '2026-09-11')]).get('2026-09-12'), { total: 2, done: 1 })
// A day nobody had anything scheduled for tallies zero rather than going
// missing, so an empty square and a quiet day are told apart downstream.
assert.deepEqual(board(boardTasks, []).get('2026-09-09'), { total: 0, done: 0 })
// With only one of the two scheduled, that one alone decides the day.
const split = [
  task({ id: 'a', confirmedDays: ['2026-09-11'] }),
  task({ id: 'b', projectId: 'q', startDate: '2026-09-20', endDate: '2026-09-25' }),
]
assert.deepEqual(board(split, []).get('2026-09-11'), { total: 1, done: 1 })
// ...and a day still to come is scheduled without being done: it has a size,
// but nothing has been finished on it yet.
assert.deepEqual(board(split, [], ['2026-09-22']).get('2026-09-22'), { total: 1, done: 0 })
// A paused task is not scheduled work, so it does not pad the day's size.
assert.deepEqual(board([task({ id: 'a', paused: true, pauseDate: '2026-09-12' })], []).get('2026-09-12'), { total: 0, done: 0 })

// Chores join the board and nothing else: a branch is a view down the task
// tree, and a chore is not in it.
//
// Written as a delta off the same board without chores, so each case states the
// claim — "a chore adds one to the day it was ticked" — rather than restating
// arithmetic that would have to be recomputed whenever the task fixtures move.
const BOARD_LOGS = [log('b', '2026-09-11')]
const base = board(boardTasks, BOARD_LOGS)
const withChores = (chores, days = WEEK) => boardDayTallies(boardTasks, BOARD_LOGS, chores, TODAY, days)
/** How many the given chores add to `day`, and whether `total` moved at all. */
const added = (chores, day) => {
  const tally = withChores(chores).get(day)
  return { added: tally.done - base.get(day).done, totalMoved: tally.total - base.get(day).total }
}

// One chore finished on a day adds exactly one to that day, and announces its
// size nowhere: nothing shades the board by `total`, and a chore has no schedule
// to be sized by.
assert.deepEqual(added([chore({ done: true, completedDate: '2026-09-12' })], '2026-09-12'), { added: 1, totalMoved: 0 })
// Credited to the day it was ticked, not the day it was written for. A chore
// dated the 11th and ticked on the 12th leaves the 11th exactly as it was —
// finishing Monday's chore on Tuesday must not turn Monday green.
const slipped = [chore({ date: '2026-09-11', done: true, completedDate: '2026-09-12' })]
assert.deepEqual(added(slipped, '2026-09-11'), { added: 0, totalMoved: 0 })
assert.deepEqual(added(slipped, '2026-09-12'), { added: 1, totalMoved: 0 })
// Still open: nothing was finished, so nothing is credited.
assert.deepEqual(added([chore({ date: '2026-09-11' })], '2026-09-11'), { added: 0, totalMoved: 0 })
// Finished outside the window the grid covers, so there is no square to land on
// — and it must not fall through to the nearest one.
assert.deepEqual(added([chore({ done: true, completedDate: '2026-01-01' })], '2026-09-11'), { added: 0, totalMoved: 0 })
// Two on one day are two, not one: the board counts rather than tests.
assert.deepEqual(
  added([chore({ done: true, completedDate: '2026-09-13' }), chore({ id: 'c2', done: true, completedDate: '2026-09-13' })], '2026-09-13'),
  { added: 2, totalMoved: 0 },
)

await server.close()
console.log('heatmap: ok')

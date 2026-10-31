/**
 * The one check on the task DDL, run with `node scripts/check-deadline.mjs`.
 *
 * A DDL is a commitment, not a span: it is independent of the planned end date,
 * and passing it makes a task late even while its window is still open. This
 * file pins the places that decide that — the status rule, the parent roll-up,
 * the calendar's "due" day and the Gantt axis — because a wrong date here looks
 * like a perfectly ordinary list until someone reads it closely.
 *
 * Nothing reads the wall clock: the day is an argument.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { deriveTaskStatus } = await server.ssrLoadModule('/src/lib/tree.ts')
const { dayStates, milestonesOnDay } = await server.ssrLoadModule('/src/lib/dayTasks.ts')
const { timelineRange } = await server.ssrLoadModule('/src/lib/timeline.ts')

const task = (over) => ({
  id: 'a', name: 'a', description: '', parentId: null, projectId: 'p',
  type: 'phase', isTodo: false,
  startDate: '2026-10-01', endDate: '2026-10-30',
  strictProgress: true, confirmedDays: [], paused: false, pauseDate: null, pauses: [],
  priority: 'medium', tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})

const log = (taskId, date, targetProgress = null) => ({
  id: `${taskId}@${date}`, taskId, date, content: '', targetProgress, createdAt: '', updatedAt: '',
})

// --- the status rule ------------------------------------------------------

// Past the DDL, even though the planned window is still open.
assert.equal(deriveTaskStatus(task({ deadline: '2026-10-10' }), 20, '2026-10-11'), 'delayed')
// The deadline day itself is not late yet.
assert.equal(deriveTaskStatus(task({ deadline: '2026-10-11' }), 20, '2026-10-11'), 'in-progress')
// Finished work beats a missed date.
assert.equal(deriveTaskStatus(task({ deadline: '2026-10-10' }), 100, '2026-10-11'), 'completed')
// A missed hard date beats the pause state, as the user asked.
assert.equal(
  deriveTaskStatus(task({ deadline: '2026-10-10', paused: true, pauseDate: '2026-10-09' }), 20, '2026-10-11'),
  'delayed',
)
// A long-term goal has no end date, but can still carry a DDL.
assert.equal(
  deriveTaskStatus(task({ type: 'long-term', endDate: null, deadline: '2026-10-10' }), 0, '2026-10-11'),
  'delayed',
)
assert.equal(
  deriveTaskStatus(task({ type: 'long-term', endDate: null, deadline: '2026-10-20' }), 0, '2026-10-11'),
  'in-progress',
)
// The old end-date rule still applies to tasks with no DDL.
assert.equal(deriveTaskStatus(task({ endDate: '2026-10-10' }), 20, '2026-10-11'), 'delayed')
// A DDL before the start date is still a missed date.
assert.equal(
  deriveTaskStatus(task({ startDate: '2026-10-20', deadline: '2026-10-10' }), 0, '2026-10-15'),
  'delayed',
)

// --- a parent's own commitment -------------------------------------------

const parentAndChild = (deadline, logs = []) => {
  const parent = task({ id: 'p1', startDate: '2026-10-01', endDate: '2026-10-30', deadline })
  const child = task({ id: 'c1', parentId: 'p1', startDate: '2026-10-01', endDate: '2026-10-30' })
  return { tasks: [parent, child], logs }
}
const statusOn = (tasks, logs, day = '2026-10-12') => dayStates(tasks, logs, day).get('p1').status

// The child is still running; the parent's missed deadline makes the branch late.
assert.equal(statusOn(...Object.values(parentAndChild('2026-10-10'))), 'delayed')
// The same parent without a deadline rolls up as in progress.
assert.equal(statusOn(...Object.values(parentAndChild(null))), 'in-progress')
// Every child finished: the roll-up's completed wins over the parent's date.
const done = parentAndChild('2026-10-10', [log('c1', '2026-10-10', 100)])
assert.equal(statusOn(done.tasks, done.logs), 'completed')

// --- the calendar's due day ----------------------------------------------

const dueOn = (tasks, day) => milestonesOnDay(tasks, dayStates(tasks, [], day), day).due.map((t) => t.id)

const withDeadline = [task({ id: 'a', endDate: '2026-10-10', deadline: '2026-10-12' })]
assert.deepEqual(dueOn(withDeadline, '2026-10-10'), [], 'the DDL replaces the planned end as the due day')
assert.deepEqual(dueOn(withDeadline, '2026-10-12'), ['a'])
// A parent is not printed beside its children's span, but its own DDL is its own.
const parentDeadline = [
  task({ id: 'p1', deadline: '2026-10-12' }),
  task({ id: 'c1', parentId: 'p1', startDate: '2026-10-01', endDate: '2026-10-30' }),
]
assert.deepEqual(dueOn(parentDeadline, '2026-10-12'), ['p1'])
assert.deepEqual(dueOn([task({ id: 'p1' }), parentDeadline[1]], '2026-10-12'), [])

// --- the Gantt axis reaches the DDL --------------------------------------

const range = timelineRange(
  'month',
  [task({ id: 'a', startDate: '2026-09-01', endDate: '2026-09-10', deadline: '2027-01-15' })],
  '2026-10-11',
  900,
)
assert.ok(
  range.end > new Date(2027, 0, 15),
  'the axis extends past a DDL later than every planned end',
)

console.log('check-deadline: ok')
await server.close()

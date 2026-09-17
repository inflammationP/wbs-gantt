/**
 * The one check on what owes a log on a day, run with
 * `node scripts/check-day-obligations.mjs`.
 *
 * `strictLogObligations` is the single rule behind three surfaces — the day's
 * coverage ring, the Calendar's cell shading, and the task panel's "still to
 * log" list — so a change here moves all three at once, silently, and the
 * disagreement would only ever show up as a number that looks slightly off.
 *
 * No framework, nothing mocked: `src/lib/dayTasks.ts` is loaded straight from
 * source by Vite, the same way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { strictLogObligations } = await server.ssrLoadModule('/src/lib/dayTasks.ts')

const TODAY = '2026-09-15'

const task = (over) => ({
  id: 'a', name: 'a', description: '', parentId: null, projectId: 'p',
  type: 'phase', isTodo: false,
  startDate: '2026-09-01', endDate: '2026-09-20',
  strictProgress: true, paused: false, pauseDate: null, pauses: [],
  priority: null, tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})

// `taskProgress` takes a strict task's latest log at its word when that log
// carries a target, which is how these fixtures pin a progress without having
// to write a window's worth of entries.
const log = (taskId, date, targetProgress = null) => ({
  id: `${taskId}@${date}`, taskId, date, content: '', targetProgress, createdAt: '', updatedAt: '',
})

const owes = (tasks, logs, day = TODAY) => strictLogObligations(tasks, logs, day)
const ids = (owed) => owed.map((o) => o.task.id)

// Inside its window and unfinished: owes, and reports itself unlogged.
assert.deepEqual(ids(owes([task({})], [])), ['a'])
assert.equal(owes([task({})], [])[0].logged, false)

// Logged today is still owed — it is the ring's numerator, not a way off the
// list. `logged` is what tells the two apart.
const written = owes([task({})], [log('a', TODAY, 40)])
assert.deepEqual(ids(written), ['a'])
assert.equal(written[0].logged, true)

// The window closed on the 14th and the task was never finished. It owes on the
// 15th all the same: overdue work is today's work, and dropping it the day its
// end date passed is exactly how the most urgent thing on the board would go
// unmentioned. This is the clause that separates `hasComeDue` from `activeOnDay`.
assert.deepEqual(ids(owes([task({ endDate: '2026-09-14' })], [])), ['a'])
// ...and it goes on owing, day after day, until it is done.
assert.deepEqual(ids(owes([task({ endDate: '2026-09-14' })], [], '2026-09-30')), ['a'])

// The start is the one bound that survives: a task that has not begun cannot
// owe anything yet, and one with no start at all is not scheduled work.
assert.deepEqual(owes([task({ startDate: '2026-09-20' })], []), [])
assert.deepEqual(owes([task({ startDate: null })], []), [])

// Finished before the day began means finished, closed window or not.
assert.deepEqual(owes([task({})], [log('a', '2026-09-12', 100)]), [])
assert.deepEqual(owes([task({ endDate: '2026-09-14' })], [log('a', '2026-09-12', 100)]), [])

// A log written *today* that completes the task does not empty the day: the
// test is against the previous day, so 3/5 cannot silently become 3/4 the
// moment the log lands and read as a regression.
assert.deepEqual(ids(owes([task({})], [log('a', TODAY, 100)])), ['a'])

// Paused work is not the day's work.
assert.deepEqual(owes([task({ paused: true, pauseDate: '2026-09-13' })], []), [])

// Only strict leaves. `strictProgress` is inert on a parent — its progress is
// the average of its children's — so `a`, having a child, owes nothing itself
// while its strict child `b` owes, being a leaf.
assert.deepEqual(ids(owes([task({ id: 'a' }), task({ id: 'b', parentId: 'a' })], [])), ['b'])
assert.deepEqual(owes([task({ isTodo: true, startDate: null, endDate: null })], []), [])
assert.deepEqual(owes([task({ type: 'long-term', endDate: null })], []), [])
// A plain (non-strict) leaf owes nothing either: it has no log to write.
assert.deepEqual(owes([task({ strictProgress: false })], []), [])

await server.close()
console.log('day obligations: ok')

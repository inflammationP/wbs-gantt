/**
 * The one check on what owes a log on a day, and on the order the day's list
 * comes out in — run with `node scripts/check-day-obligations.mjs`.
 *
 * `strictLogObligations` is the single rule behind three surfaces — the day's
 * coverage ring, the Calendar's cell shading, and the task panel's "still to
 * log" list — so a change here moves all three at once, silently, and the
 * disagreement would only ever show up as a number that looks slightly off.
 *
 * `daySummary` is checked here too because the order it returns *is* the day's
 * list: a tree walk that quietly stopped nesting, or stopped hoisting the
 * siblings that owe a log, would look like nothing at all until someone
 * noticed the list reading wrong.
 *
 * No framework, nothing mocked: `src/lib/dayTasks.ts` is loaded straight from
 * source by Vite, the same way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { strictLogObligations, daySummary } = await server.ssrLoadModule('/src/lib/dayTasks.ts')
const { taskProgress } = await server.ssrLoadModule('/src/lib/progress.ts')

const TODAY = '2026-09-15'

const task = (over) => ({
  id: 'a', name: 'a', description: '', parentId: null, projectId: 'p',
  type: 'phase', isTodo: false,
  startDate: '2026-09-01', endDate: '2026-09-20',
  strictProgress: true, confirmedDays: [], paused: false, pauseDate: null, pauses: [],
  priority: null, tags: [], dependencies: [],
  createdAt: '', updatedAt: '',
  ...over,
})

// `taskProgress` takes a strict task's latest *target-carrying* log at its word,
// which is how these fixtures pin a progress without having to write a window's
// worth of entries. A log left with `null` states nothing and is walked past.
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

// A log that states no target states *nothing* — it must not erase a number an
// earlier log wrote. Reading only the latest row did exactly that: this pair
// reported the fallback (2 logged days ÷ 19 ≈ 11%), so a task finished on the
// 10th quietly un-finished itself because someone wrote a diary entry on the
// 12th, and came back to owe a log every day from then on.
const stated = [log('a', '2026-09-10', 100), log('a', '2026-09-12')]
assert.deepEqual(owes([task({})], stated, '2026-09-20'), [])
assert.equal(taskProgress(task({}), stated, new Date(2026, 8, 20)), 100)

// --- what the Calendar draws on a day ---

// The cell's own decision, and the one place the two "nothing owed" days come
// apart. `worked` is the caller saying something was on the day; a day off and a
// day that finished all of nothing are otherwise the same rate, and they used to
// be the same green ring.
const { dayCellState, parentPath } = await server.ssrLoadModule('/src/lib/dayTasks.ts')
const rate = (done, total) => ({ done, total, pct: total ? Math.round((done / total) * 100) : 0 })
const cell = (day, worked, r = rate(0, 0)) => dayCellState(day, TODAY, r, worked).kind

assert.equal(cell('2026-09-15', true), 'clear')
assert.equal(cell('2026-09-15', false), 'empty')
// Nothing has been put on a day that has not arrived, so it is not judged for
// the work — worked or not.
assert.equal(cell('2026-09-16', true), 'future')
assert.equal(cell('2026-09-16', false), 'future')
// Anything owed outranks both: the squares are drawn whatever was on the day,
// which is what keeps an overdue backlog visible on a day it no longer covers.
assert.equal(cell('2026-09-15', false, rate(0, 2)), 'owed')
assert.equal(cell('2026-09-15', false, rate(1, 2)), 'partial')
assert.equal(cell('2026-09-15', false, rate(2, 2)), 'full')

// --- the order the day's list comes out in ---

const PROJECTS = [{ id: 'p', name: 'p', color: '#888', description: '' }]
/** The day's task ids, in the order the panel renders them. */
const list = (tasks, day = TODAY) => daySummary(tasks, [], PROJECTS, day, day).all.map((r) => r.task.id)

const rowsFor = (tasks, day = TODAY) => daySummary(tasks, [], PROJECTS, day, day).all

// Among siblings the ones that owe a log come first. The names are picked so
// that the sibling without the obligation would win on WBS alone — `alpha` is
// numbered 1.1 and `zebra` 1.2 — which makes this an assert about the
// obligation rule rather than about the numbering happening to agree with it.
//
// `a` is absent, and that is the point: a parent is a container, so its row was
// a line of the day spent saying what the rows under it said. It is the chain
// on each of them now.
const tree = [
  task({ id: 'a' }),
  task({ id: 'zebra', parentId: 'a', strictProgress: true }),
  task({ id: 'alpha', parentId: 'a', strictProgress: false }),
]
assert.deepEqual(list(tree), ['zebra', 'alpha'])
assert.deepEqual(rowsFor(tree).map((r) => r.parents), [['a'], ['a']])

// The order is still the tree's: a branch's leaves stay together and keep their
// own order, even though the list that comes out of it is flat.
assert.deepEqual(list([...tree, task({ id: 'z', endDate: '2026-09-14' })]), ['z', 'zebra', 'alpha'])

// And it is the whole list, not each rung. `first` is numbered 1 and comes
// before `beta` at 2.1 on WBS alone, with nothing else to separate them — so
// this is an assert about the hoist reaching across branches rather than about
// the tree happening to agree with it.
const across = [
  task({ id: 'first', name: 'first', strictProgress: false }),
  task({ id: 'holder', name: 'holder' }),
  task({ id: 'beta', name: 'beta', parentId: 'holder' }),
]
assert.deepEqual(list(across), ['beta', 'first'])

// A parent that is not on the day still names the branch. It has no row — the
// rule is about what is scheduled, not about what is reachable — but the chain
// is walked over the whole store, so the row it belongs to can still say where
// it came from.
const away = [
  // Named, because the chain carries names and `task()` defaults every one of
  // them to 'a' — an assertion on ids here would pass on the wrong thing.
  task({ id: 'p', name: 'phase', startDate: '2026-10-01', endDate: '2026-10-05' }),
  task({ id: 'b', parentId: 'p', strictProgress: true }),
]
assert.deepEqual(list(away), ['b'])
assert.deepEqual(rowsFor(away)[0].parents, ['phase'])

// A child that is itself a to-do does not make a container. To-dos are
// unscheduled and take no part in the roll-up, so a task whose children are all
// to-dos keeps its own dates and is a leaf here.
const todoKid = [task({ id: 'a' }), task({ id: 't', parentId: 'a', isTodo: true, startDate: null, endDate: null })]
assert.deepEqual(list(todoKid), ['a'])
assert.deepEqual(rowsFor(todoKid)[0].parents, [])

// --- the chain printed in front of a row's name ------------------------------

// `parents` arrives nearest-first, and a path is read top-down: the reversal is
// the whole of the shallow case, and getting it backwards prints the branch
// upside down in a way that still reads as a path.
assert.deepEqual(parentPath([]), [])
assert.deepEqual(parentPath(['上一级']), ['上一级'])
assert.deepEqual(parentPath(['上一级', '最高级']), ['最高级', '上一级'])
// Three deep, one is spent on the mark: the two ends are the two that answer
// something — where the row came from, and which of several same-named rows it
// is. The step between them is the one nobody asked about.
assert.deepEqual(parentPath(['上一级', '中间', '最高级']), ['最高级', '(...)', '上一级'])
// Still two ends however deep it goes, so the row's width does not depend on how
// far down the tree the task happens to live.
assert.deepEqual(
  parentPath(['上一级', '中间', '更中间', '最高级']),
  ['最高级', '(...)', '上一级'],
)

await server.close()
console.log('day obligations: ok')

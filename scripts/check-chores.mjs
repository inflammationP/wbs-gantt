/**
 * The one check on the chore day rules, run with
 * `node scripts/check-chores.mjs`.
 *
 * No framework, and nothing mocked: `src/lib/chores.ts` is loaded straight from
 * source by Vite, the same way `check-heatmap.mjs` loads the heatmap.
 *
 * What is being pinned down is the rollover rule, which is the subtle part of
 * the whole feature. A chore's `date` records the day it was *put on* and is
 * never rewritten, so "what is on today" is answered at read time instead of by
 * a nightly rewrite — which is what lets a slipped chore still say how long it
 * has slipped, and keeps the day it was originally meant for readable.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { todaysChores, plannedFor, choresTouching, carriedSince } = await server.ssrLoadModule('/src/lib/chores.ts')

const TODAY = '2026-09-17'
const TOMORROW = '2026-09-18'

// `createdAt` is written out per chore rather than generated: the order two
// chores of the same day come back in is part of what is being checked, and a
// counter would hide a sort that had stopped reading it.
const chore = (id, date, over = {}) => ({
  id,
  title: id,
  note: '',
  date,
  done: false,
  completedDate: null,
  createdAt: `${date}T09:00:00Z`,
  updatedAt: '',
  ...over,
})

const ids = (list) => list.map((c) => c.id)

const ALL = [
  // Written Monday, never finished — the case the whole feature exists for.
  chore('a', '2026-09-15'),
  // Two put on today, in the order they were added.
  chore('b', TODAY),
  chore('c', TODAY, { createdAt: `${TODAY}T10:00:00Z` }),
  // Written Monday and finished Monday: a closed fact, not today's business.
  chore('d', '2026-09-15', { done: true, completedDate: '2026-09-15' }),
  // Put on today and finished today: stays as today's tally.
  chore('e', TODAY, { createdAt: `${TODAY}T11:00:00Z`, done: true, completedDate: TODAY }),
  // Lined up for tomorrow.
  chore('f', TOMORROW),
  // Written for tomorrow, ticked early, today.
  chore('g', TOMORROW, { createdAt: `${TODAY}T12:00:00Z`, done: true, completedDate: TODAY }),
]

// Today holds what has come due and is still open, plus what was finished
// today — `a` carried in, `b`/`c` put on, `e` ticked off, `g` ticked early.
// `d` is out because it was closed before today; `f` because it is not due yet.
// Carried work leads, because the sort is by the day each was put on.
assert.deepEqual(ids(todaysChores(ALL, TODAY)), ['a', 'b', 'c', 'e', 'g'])

// Carrying forward is a read, not a write: the slipped chore is listed under
// today while still saying it was written on the 15th. This is the assertion
// that would fail if anything ever "helpfully" restamped the date.
const carried = todaysChores(ALL, TODAY).find((c) => c.id === 'a')
assert.equal(carried.date, '2026-09-15')
assert.deepEqual(ids(ALL), ['a', 'b', 'c', 'd', 'e', 'f', 'g']) // input untouched

// Tomorrow: a plan, so strictly the chores written for it and still open. `g`
// was ticked early and is gone; `a` and `b` are not pulled forward into a day
// that has not happened.
assert.deepEqual(ids(plannedFor(ALL, TOMORROW)), ['f'])

// The day after that: yesterday's tally is over. `e` was finished today, so by
// tomorrow it is a closed fact like `d` — this is what makes a ticked chore
// leave on its own without anything having to sweep it away.
assert.deepEqual(ids(todaysChores(ALL, TOMORROW)), ['a', 'b', 'c', 'f'])
// ...and `g`, ticked early, does not come back around when its day arrives.
assert.equal(todaysChores(ALL, TOMORROW).some((c) => c.id === 'g'), false)

// A day's account of itself: what was put on it, and what was finished on it —
// two different sets, since work slips. `g` belongs to the 17th because that is
// when the work happened, not the 18th it was written for, which is the same
// choice the heatmap's shading makes.
assert.deepEqual(ids(choresTouching(ALL, TODAY)), ['b', 'c', 'e', 'g'])
assert.deepEqual(ids(choresTouching(ALL, '2026-09-15')), ['a', 'd'])
// The 18th has what was written for it — `g` included, because it *was* the
// 18th's, however early it got done. This is where the panel and the page part
// ways on purpose: `plannedFor` leaves `g` out, being a plan, and a plan has no
// room for something already finished. A record does.
assert.deepEqual(ids(choresTouching(ALL, TOMORROW)), ['g', 'f'])
// A day nothing touches is empty rather than absent, so the panel can tell a
// quiet day from a failed lookup.
assert.deepEqual(choresTouching(ALL, '2026-01-01'), [])

// Carried-ness runs backwards: a chore put on four days ago is -4, so it reads
// "4 days ago" rather than "in 4 days". The wrong sign here does not look like a
// bug, it looks like a chore that is due later this week.
assert.equal(carriedSince(chore('a', '2026-09-13'), TODAY), -4)
assert.equal(carriedSince(chore('a', TODAY), TODAY), 0)
// Still negative for a chore put on for tomorrow — it has not been carried at
// all, and nothing renders this for it, but the sign must not flip.
assert.equal(carriedSince(chore('a', TOMORROW), TODAY), 1)

// An empty board is not a special case anywhere.
assert.deepEqual(todaysChores([], TODAY), [])
assert.deepEqual(plannedFor([], TOMORROW), [])
assert.deepEqual(choresTouching([], TODAY), [])

await server.close()
console.log('chores: ok')

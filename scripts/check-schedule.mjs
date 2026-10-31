/**
 * The one check on the timetable's arithmetic, run with
 * `node scripts/check-schedule.mjs`.
 *
 * Every rule here is a number the screen draws: a block's height, a day's load,
 * whether a column is over capacity, and how overlapping blocks share a column.
 * Get one wrong and the picture is quietly misleading rather than broken.
 *
 * No clock is read: the date and times are arguments.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const {
  isHHMM,
  minutesOf,
  toHHMM,
  blockMinutes,
  dayLoadMinutes,
  planOn,
  plannedIds,
  capacityOf,
  dayLoad,
  promptDue,
  formatHours,
  packBlocks,
  dragSpan,
  loadRead,
} = await server.ssrLoadModule('/src/lib/schedule.ts')

// --- stored times are strict, unlike typed chore times --------------------

assert.equal(isHHMM('09:30'), true)
assert.equal(isHHMM('23:59'), true)
assert.equal(isHHMM('9:30'), false)
assert.equal(isHHMM('24:00'), false)
assert.equal(isHHMM('09:60'), false)
assert.equal(minutesOf('09:30'), 570)
assert.equal(minutesOf('9:30'), null)
assert.equal(toHHMM(570), '09:30')
assert.equal(toHHMM(1439), '23:59')
assert.equal(toHHMM(1440), '23:59')
assert.equal(toHHMM(-1), '00:00')

// --- a block's duration ---------------------------------------------------

const block = (over = {}) => ({
  id: 'b',
  date: '2026-10-27',
  start: '09:00',
  end: '10:30',
  title: 'b',
  ...over,
})

assert.equal(blockMinutes(block()), 90)
assert.equal(blockMinutes(block({ start: '09:00', end: '09:00' })), 0)
assert.equal(blockMinutes(block({ start: '10:00', end: '09:00' })), 0)
assert.equal(blockMinutes(block({ deadline: true, start: '17:00', end: '10:00' })), 0)
assert.equal(blockMinutes(block({ start: '9:00' })), 0)

// --- drag-to-create -------------------------------------------------------

// A drag gives the span between its two ends, whichever way it went; a press
// and release in one slot is a click, and takes no end from the drag.
assert.deepEqual(dragSpan(9 * 60, 11 * 60), { start: 540, end: 660 })
assert.deepEqual(dragSpan(11 * 60, 9 * 60), { start: 540, end: 660 })
assert.deepEqual(dragSpan(9 * 60, 9 * 60), { start: 540, end: null })
assert.deepEqual(dragSpan(23 * 60 + 30, 0), { start: 0, end: 1410 })

// --- when a load can be stated ---------------------------------------------

// No capacity means no load: the board no longer assumes a working day.
assert.deepEqual(loadRead(0, 5, 5), { computable: false, reference: false })
// Below three fifths of the tasks carrying an estimate, the sum is not a total.
assert.deepEqual(loadRead(8, 2, 5), { computable: false, reference: false })
assert.deepEqual(loadRead(8, 3, 5), { computable: true, reference: true })
// Every task estimated: stated plainly.
assert.deepEqual(loadRead(8, 5, 5), { computable: true, reference: false })
// Nothing planned: no estimate is missing, and the blocks still count.
assert.deepEqual(loadRead(8, 0, 0), { computable: true, reference: false })

// --- load -----------------------------------------------------------------

const day = '2026-10-27'
const blocks = [
  block({ id: 'a', start: '09:00', end: '10:00' }), // 60
  block({ id: 'b', start: '09:30', end: '10:30' }), // 60, overlaps a
  block({ id: 'c', date: '2026-10-28' }), // another day
  block({ id: 'd', start: '17:00', end: '17:00', deadline: true }), // no time
]
assert.equal(dayLoadMinutes(blocks, day), 120, 'overlap counts twice; deadline and other days do not count')

// Nobody has said: zero, not an invented eight-hour day.
assert.equal(capacityOf(undefined), 0)
assert.equal(capacityOf({ date: day }), 0)
assert.equal(capacityOf({ date: day, capacityHours: 6 }), 6)
assert.equal(capacityOf({ date: day, capacityHours: 0 }), 0)
assert.equal(capacityOf({ date: day, capacityHours: 25 }), 0)

const load = dayLoad({ date: day, capacityHours: 6 }, blocks, day)
assert.deepEqual(load, { used: 2, capacity: 6, ratio: 2 / 6, over: false })
assert.equal(dayLoad({ date: day, capacityHours: 1.5 }, blocks, day).over, true)
assert.equal(dayLoad({ date: day, capacityHours: 0 }, blocks, day).over, true)
assert.equal(formatHours(3.5), '3.5')
assert.equal(formatHours(8), '8')
assert.equal(formatHours(0), '0')

// --- planned hours: one commitment, whichever layer states it -------------

// A plan with hours and no blocks is the estimate itself.
assert.equal(dayLoad({ date: day, taskIds: ['a'], hours: { a: 2 } }, [], day).used, 2)

const blocked = [block({ id: 'x', taskId: 'a', start: '09:00', end: '12:00' })] // 3h
assert.equal(dayLoad({ date: day, taskIds: ['a'], hours: { a: 2 } }, blocked, day).used, 3, 'a block wins over a smaller estimate')
assert.equal(dayLoad({ date: day, taskIds: ['a'], hours: { a: 4 } }, blocked, day).used, 4, 'an estimate wins over a shorter block')

const mixed = [
  ...blocked,
  block({ id: 'f', start: '13:00', end: '14:00' }), // free event, 1h
  block({ id: 'u', taskId: 'b', start: '14:00', end: '15:00' }), // task left out of the plan, 1h
]
assert.equal(dayLoad({ date: day, taskIds: ['a'], hours: { a: 4 } }, mixed, day).used, 6, 'free events and unplanned task blocks still take time')
assert.equal(dayLoad({ date: day, taskIds: [], hours: { a: 4 } }, mixed, day).used, 5, 'a rest day does not hide time already on the clock')
assert.equal(dayLoad(undefined, mixed, day).used, 5, 'no plan: the sum of every block, as before')

// --- the start-of-day prompt ---------------------------------------------

assert.equal(promptDue(undefined, null, day), true)
assert.equal(promptDue({ date: day, capacityHours: 6 }, null, day), true, 'a capacity-only row is still unplanned')
assert.equal(promptDue({ date: day, taskIds: [] }, null, day), false, 'a rest day is a plan')
assert.equal(promptDue({ date: day, taskIds: ['a'] }, null, day), false)
assert.equal(promptDue(undefined, day, day), false, 'put off today')
assert.equal(promptDue(undefined, '2026-10-26', day), true, 'yesterday’s skip has expired')

// --- plans: absent, rest day, chosen --------------------------------------

const plans = [
  { date: '2026-10-27', taskIds: ['a', 'b'] },
  { date: '2026-10-28', taskIds: [] },
  { date: '2026-10-29', capacityHours: 6 },
]
assert.equal(planOn(plans, '2026-10-27').taskIds.length, 2)
assert.equal(planOn(plans, '2026-10-30'), undefined)
assert.deepEqual(plannedIds(planOn(plans, '2026-10-27')), ['a', 'b'])
assert.deepEqual(plannedIds(planOn(plans, '2026-10-28')), [], 'a rest day is an empty list, not undefined')
assert.equal(plannedIds(planOn(plans, '2026-10-29')), undefined, 'capacity-only row is not planned')
assert.equal(plannedIds(planOn(plans, '2026-10-30')), undefined)

// --- overlap lanes --------------------------------------------------------

const lanes = packBlocks([
  block({ id: 'a', start: '09:00', end: '10:00' }),
  block({ id: 'b', start: '09:30', end: '10:30' }),
  block({ id: 'c', start: '10:00', end: '11:00' }),
  block({ id: 'd', start: '17:00', end: '17:00', deadline: true }),
])
assert.deepEqual(lanes.get('a'), { lane: 0, lanes: 2 })
assert.deepEqual(lanes.get('b'), { lane: 1, lanes: 2 })
assert.deepEqual(lanes.get('c'), { lane: 0, lanes: 2 }, 'c starts when a ends, so it reuses lane 0')
assert.equal(lanes.has('d'), false, 'deadlines are not lanes')

// Back-to-back blocks do not force each other narrower.
const apart = packBlocks([
  block({ id: 'a', start: '09:00', end: '10:00' }),
  block({ id: 'b', start: '10:00', end: '11:00' }),
])
assert.deepEqual(apart.get('a'), { lane: 0, lanes: 1 })
assert.deepEqual(apart.get('b'), { lane: 0, lanes: 1 })

console.log('check-schedule: ok')
await server.close()

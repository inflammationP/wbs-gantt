/**
 * The one check on what counts as a postponement, run with
 * `node scripts/check-postpone.mjs`.
 *
 * `postponePatch` is the only door the record comes through, so the rules that
 * matter are pinned here rather than in the dialog that calls it: the end date
 * only ever moves later, a reason is required, and the record it writes names
 * the window it moved. A dialog can be dismissed or replaced; a wrong patch
 * would write a reason against a date the task never had.
 *
 * The clock is an argument, not the wall's: `today` is passed in, so none of
 * these assertions depends on the day the check runs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { postponePatch } = await server.ssrLoadModule('/src/lib/postpone.ts')

const TODAY = '2026-09-10'

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
  postponements: [],
  priority: 'medium',
  tags: [],
  dependencies: [],
  createdAt: '',
  updatedAt: '',
  ...over,
})

// --- a later end is the whole of it ---------------------------------------

const moved = postponePatch(task(), '2026-09-12', '  甲方改需求  ', TODAY)
assert.equal(moved.endDate, '2026-09-12')
assert.deepEqual(moved.postponements, [
  { date: TODAY, from: '2026-09-05', to: '2026-09-12', reason: '甲方改需求' },
])

// The record is history, so earlier ones stay and the new one lands last.
const earlier = [{ date: '2026-09-02', from: '2026-09-01', to: '2026-09-05', reason: '排期冲突' }]
const appended = postponePatch(task({ postponements: earlier }), '2026-09-12', '联调延期', TODAY)
assert.deepEqual(appended.postponements.map((p) => p.reason), ['排期冲突', '联调延期'])

// The patch is a patch: the task handed in is not rewritten on the way.
const original = task()
postponePatch(original, '2026-09-12', '联调延期', TODAY)
assert.equal(original.endDate, '2026-09-05')
assert.equal(original.postponements.length, 0)

// --- anything else is refused rather than recorded ------------------------

// A shorter or equal window is an edit, not a postponement.
assert.equal(postponePatch(task(), '2026-09-05', '改短一点', TODAY), null)
assert.equal(postponePatch(task(), '2026-09-01', '改短一点', TODAY), null)

// No reason, no record — the reason is the point of the feature.
assert.equal(postponePatch(task(), '2026-09-12', '', TODAY), null)
assert.equal(postponePatch(task(), '2026-09-12', '   \n  ', TODAY), null)

// The kinds that have no end date of their own never get one written.
assert.equal(postponePatch(task({ isTodo: true, endDate: null }), '2026-09-12', 'x', TODAY), null)
assert.equal(postponePatch(task({ type: 'long-term', endDate: null }), '2026-09-12', 'x', TODAY), null)
assert.equal(postponePatch(task({ endDate: null }), '2026-09-12', 'x', TODAY), null)

console.log('check-postpone: ok')
await server.close()

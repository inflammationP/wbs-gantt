/**
 * The one check on what counts as a postponement, run with
 * `node scripts/check-postpone.mjs`.
 *
 * `postponePatch` is the only door the record comes through, so the rules that
 * matter are pinned here rather than in the dialog that calls it: the end date
 * only ever moves later, and the record it writes names the window it moved.
 * The reason is an optional memo. A dialog can be dismissed or replaced; a wrong
 * patch would write a record against a date the task never had.
 *
 * The clock is an argument, not the wall's: `today` is passed in, so none of
 * these assertions depends on the day the check runs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { editPostponePatch, postponePatch } = await server.ssrLoadModule('/src/lib/postpone.ts')

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

// The reason is a memo, so an empty one still records the move.
const noReason = postponePatch(task(), '2026-09-12', '   \n  ', TODAY)
assert.equal(noReason.endDate, '2026-09-12')
assert.deepEqual(noReason.postponements, [
  { date: TODAY, from: '2026-09-05', to: '2026-09-12', reason: '' },
])

// The kinds that have no end date of their own never get one written.
assert.equal(postponePatch(task({ isTodo: true, endDate: null }), '2026-09-12', 'x', TODAY), null)
assert.equal(postponePatch(task({ type: 'long-term', endDate: null }), '2026-09-12', 'x', TODAY), null)
assert.equal(postponePatch(task({ endDate: null }), '2026-09-12', 'x', TODAY), null)

// --- the latest record can be rewritten, and the task follows it ------------

const first = { date: '2026-09-02', from: '2026-09-01', to: '2026-09-05', reason: '排期冲突' }
const latest = { date: '2026-09-10', from: '2026-09-05', to: '2026-09-12', reason: '甲方改需求' }

const edited = editPostponePatch(
  task({ endDate: '2026-09-12', postponements: [first, latest] }),
  { date: '2026-09-11', from: '2026-09-06', to: '2026-09-15', reason: '  联调延期  ' },
)
assert.equal(edited.endDate, '2026-09-15')
assert.deepEqual(edited.postponements, [
  first,
  { date: '2026-09-11', from: '2026-09-06', to: '2026-09-15', reason: '联调延期' },
])

// A pause after the postponement moved the current end; rewriting the record
// moves only its own share, so the pause is not lost.
const afterPause = editPostponePatch(
  task({ endDate: '2026-09-20', postponements: [first, latest] }),
  { date: '2026-09-10', from: '2026-09-05', to: '2026-09-15', reason: '甲方改需求' },
)
assert.equal(afterPause.endDate, '2026-09-23')

// --- and it can be taken back ----------------------------------------------

const revoked = editPostponePatch(
  task({ endDate: '2026-09-20', postponements: [first, latest] }),
  null,
)
assert.deepEqual(revoked.postponements, [first])
assert.equal(revoked.endDate, '2026-09-13', 'the shift the record added comes back out')

// --- the guards ------------------------------------------------------------

// Nothing to rewrite, and nothing to take back.
assert.equal(editPostponePatch(task(), latest), null)
assert.equal(editPostponePatch(task(), null), null)
// A recorded day is required; the reason is a memo and may be blank.
assert.equal(
  editPostponePatch(task({ postponements: [latest] }), { ...latest, reason: '  ' }).postponements.at(-1).reason,
  '',
)
assert.equal(editPostponePatch(task({ postponements: [latest] }), { ...latest, date: '' }), null)
// A rewritten window that shrinks is not a postponement either.
assert.equal(editPostponePatch(task({ postponements: [latest] }), { ...latest, from: '2026-09-12' }), null)
assert.equal(editPostponePatch(task({ isTodo: true, postponements: [latest] }), latest), null)
assert.equal(editPostponePatch(task({ type: 'long-term', endDate: null, postponements: [latest] }), latest), null)
assert.equal(editPostponePatch(task({ endDate: null, postponements: [latest] }), null), null)

console.log('check-postpone: ok')
await server.close()

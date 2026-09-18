/**
 * The one check on the copy's emphasis markup, run with
 * `node scripts/check-emphasis.mjs`.
 *
 * `parseEmphasis` decides how much of a sentence a person actually reads — the
 * dialog that talks someone out of the log system leans on it, and a mark that
 * fails to close does not fail loudly, it quietly turns the rest of a paragraph
 * into a footnote. So the cases worth pinning are the ones where a mark is
 * *absent* or *unmatched*: those are where it goes wrong without looking wrong.
 *
 * No framework, nothing mocked: `src/lib/emphasis.ts` is loaded straight from
 * source by Vite, the same way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { parseEmphasis, MAX_SCALE } = await server.ssrLoadModule('/src/lib/emphasis.ts')

/** What each run says, so an assert reads as the sentence rather than the object. */
const shape = (s) => parseEmphasis(s).map((r) => [r.text, r.bold, r.scale])

// Nothing marked: one plain run, so callers never have to special-case it.
assert.deepEqual(shape('no marks here'), [['no marks here', false, 1]])
assert.deepEqual(shape(''), [])

// Bold, and the doubled asterisks people write by hand mean the same thing.
assert.deepEqual(shape('a *b* c'), [['a ', false, 1], ['b', true, 1], [' c', false, 1]])
assert.deepEqual(shape('a **b** c'), [['a ', false, 1], ['b', true, 1], [' c', false, 1]])

// Slash count is the degree, and three is the ceiling — a fourth slash must not
// buy a bigger size.
assert.deepEqual(shape('/b/')[0], ['b', false, 1.08])
assert.deepEqual(shape('//b//')[0], ['b', false, 1.14])
assert.deepEqual(shape('///b///')[0], ['b', false, 1.2])
assert.deepEqual(shape('////b////')[0], ['b', false, 1.2])
assert.equal(MAX_SCALE, 1.2)

// Both at once, which is how the loudest line in the dialog is written.
assert.deepEqual(shape('*/b*/')[0], ['b', true, 1.08])
assert.deepEqual(shape('**//b**//')[0], ['b', true, 1.14])

// A fullwidth slash is a character, not a mark. The Chinese copy has one in
// 「暂时忽略／将确认补上」, and treating it as a mark there would bold the rest
// of that sentence and close it somewhere arbitrary.
assert.deepEqual(shape('忽略／将确认补上'), [['忽略／将确认补上', false, 1]])

// Unmatched marks stay literal and swallow nothing. This is the failure that
// would not look like one: the tail of the paragraph going bold or vanishing.
assert.deepEqual(shape('a * b'), [['a * b', false, 1]])
assert.deepEqual(shape('a / b'), [['a / b', false, 1]])
assert.deepEqual(shape('*open only'), [['*open only', false, 1]])

// A `*` inside a `*/…*/` span cannot close it early — the closer has to carry
// the slash too, or the span would end at the first asterisk it met.
assert.deepEqual(shape('*/a * b*/'), [['a * b', true, 1.08]])

// The real line from the dialog, marks and all.
assert.deepEqual(
  shape('本任务可能将*/无法精确反应任务实际进度*/，且确认某日的*/监督力度几乎为 0 */。'),
  [
    ['本任务可能将', false, 1],
    ['无法精确反应任务实际进度', true, 1.08],
    ['，且确认某日的', false, 1],
    ['监督力度几乎为 0 ', true, 1.08],
    ['。', false, 1],
  ],
)

await server.close()
console.log('emphasis: ok')

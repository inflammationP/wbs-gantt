/**
 * The check on the AI timetable fallback, run with
 * `node scripts/check-ai-course.mjs`.
 *
 * No model and no network: the provider returns a canned `submit_sessions`
 * tool call, and the result is put through the same `readCourses` sanitizer as
 * a stored board. The cases are the ones that would otherwise reach the
 * timetable: a malformed row, a week outside the requested set, a missing
 * semester start, and a local week that AI must not overwrite.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
})
const { buildLocalDraft, mergeCourseDrafts } = await server.ssrLoadModule('/src/lib/courseImport.ts')
const { parseCoursesWithAi } = await server.ssrLoadModule('/src/lib/ai/courseParse.ts')
const { courseGroup, courseSemesterStart } = await server.ssrLoadModule('/src/lib/courseSheet.ts')
const { AiError } = await server.ssrLoadModule('/src/lib/ai/types.ts')

const sheet = (name, cells, merges = []) => ({ name, cells: new Map(Object.entries(cells)), merges })
const TIMES = {
  B7: 'Séance 1 8H00-8H45',
  B8: 'Séance 2 8H50-9H35',
  B9: 'Séance 3 9H40-10H25',
  B10: 'Séance 4 10H40-11H25',
  B11: 'Séance 5 11H30-12H15',
  B12: '12H15-13H00',
  B13: '13H15-14H00',
  B14: 'Séance 6 14H00-14H45',
  B15: 'Séance 7 14H50-15H35',
  B16: 'Séance 8 15H50-16H35',
  B17: 'Séance 9 16H40-17H25',
  B18: 'Séance 10 17H30-18H15',
  B19: '18H15-19H00',
  B20: 'Séance 11-13 19H00-21H30',
}
const DAY_MERGES = ['D5:G5', 'H5:K5', 'L5:O5', 'P5:S5', 'T5:W5', 'X5:Y5', 'Z5:AA5']
const valid = sheet(
  'S11',
  {
    D5: '2 novembre ',
    H5: '3 novembre',
    L5: '4 novembre ',
    P5: '5 novembre',
    T5: '6 novembre',
    X5: '7 novembre',
    Z5: '8 novembre ',
    ...TIMES,
    D7: '课程A\n[老师]\n（11(2学时)周[01-02节]）\n格物C101',
  },
  DAY_MERGES,
)
const broken = sheet('S12', { A1: 'not a timetable' })

const sources = [{ file: 'sample.xlsx', startYear: 2026, sheets: [valid, broken] }]

// --- local fast path and its failures -------------------------------------

const local = buildLocalDraft(sources)
assert.ok(local.draft, 'the valid S11 sheet parses locally')
assert.equal(local.draft.weeks[0], 11)
assert.equal(local.draft.semesterStart, courseSemesterStart('2026-11-02', 11))
assert.deepEqual(local.failures.map((f) => f.sheet), ['S12'], 'the unreadable week sheet is recorded, not hidden')

// --- AI can fill the failure ---------------------------------------------

let lastRequest = null
const toolCall = (args) => ({
  async chat(request) {
    lastRequest = request
    return {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'submit_sessions', arguments: JSON.stringify(args) },
        },
      ],
    }
  },
})

const stages = []
const ai = await parseCoursesWithAi({
  provider: toolCall({
    semesterStart: '2026-08-24',
    sessions: [
      { week: 11, weekday: 0, start: '08:00', end: '09:35', title: 'Math', location: 'A101', note: 'Groupe S' },
      { week: 11, weekday: 1, start: '9:00', end: '10:00', title: 'Bad time' },
      { week: 11, weekday: 0, start: '10:00', end: '11:00', title: '' },
      { week: 12, weekday: 0, start: '08:00', end: '09:00', title: 'Out of scope' },
    ],
  }),
  sources,
  weeks: [11],
  knownSemesterStart: local.draft.semesterStart,
  onProgress: (stage) => stages.push(stage),
})

assert.equal(ai.draft.sessions.length, 1)
assert.equal(ai.draft.sessions[0].title, 'Math')
assert.equal(ai.draft.sessions[0].week, 11)
assert.equal(courseGroup(ai.draft.sessions[0].note), 'S')
assert.equal(ai.draft.semesterStart, local.draft.semesterStart, 'the local semester start wins')
assert.equal(ai.warnings.dropped, 2)
assert.equal(ai.warnings.outOfScope, 1)
assert.deepEqual(stages, ['thinking', 'validating'], 'progress reports the two stages it reaches')

// The model reads the raw grid; the known start is passed so date-only sheets
// can still be turned into week numbers.
const sent = JSON.parse(lastRequest.messages[1].content)
assert.equal(sent.semesterStart, local.draft.semesterStart)
assert.ok(sent.sheets.length > 0)
assert.equal(lastRequest.toolChoice, 'auto', 'a forced tool choice breaks thinking-mode models')
assert.equal(lastRequest.maxTokens, 8192, 'a whole timetable does not fit in the old 4096 budget')

// Thinking models may answer with the JSON in prose instead of a tool call.
const prose = await parseCoursesWithAi({
  provider: {
    chat: async () => ({
      role: 'assistant',
      content:
        'Voici le résultat :\n```json\n{"sessions":[{"week":11,"weekday":0,"start":"08:00","end":"09:00","title":"From text"}]}\n```',
    }),
  },
  sources,
  weeks: [11],
})
assert.equal(prose.draft.sessions.length, 1)
assert.equal(prose.draft.sessions[0].title, 'From text')

// A reply cut off by the token limit says so instead of "no structure".
await assert.rejects(
  () =>
    parseCoursesWithAi({
      provider: { chat: async () => ({ role: 'assistant', content: '{"sessions":[', finish_reason: 'length' }) },
      sources,
      weeks: [11],
    }),
  /cut off/,
)

// A missing date row leaves the start empty; the preview must ask for it.
const noStart = await parseCoursesWithAi({
  provider: toolCall({
    sessions: [{ week: 11, weekday: 0, start: '08:00', end: '09:00', title: 'Math' }],
  }),
  sources,
  weeks: [11],
})
assert.equal(noStart.draft.semesterStart, '')

// A non-Monday start is not accepted.
const badStart = await parseCoursesWithAi({
  provider: toolCall({
    semesterStart: '2026-08-25',
    sessions: [{ week: 11, weekday: 0, start: '08:00', end: '09:00', title: 'Math' }],
  }),
  sources,
  weeks: [11],
})
assert.equal(badStart.draft.semesterStart, '')

// No tool call at all is an error, not an empty timetable.
const retryStages = []
await assert.rejects(
  () =>
    parseCoursesWithAi({
      provider: { chat: async () => ({ role: 'assistant', content: 'no tool' }) },
      sources,
      weeks: [11],
      onProgress: (stage) => retryStages.push(stage),
    }),
  (err) => err instanceof AiError && err.code === 'bad_response',
)
assert.deepEqual(retryStages, ['thinking', 'correcting'], 'the correction turn is reported')

// --- period numbers instead of clock times --------------------------------

const periodResult = await parseCoursesWithAi({
  provider: toolCall({
    periods: [
      { period: 1, start: '08:00', end: '08:45' },
      { period: 2, end: '09:35' },
    ],
    sessions: [
      { week: 11, weekday: 0, periodStart: 1, periodEnd: 2, title: 'Span' },
      { week: 11, weekday: 1, periodStart: 3, periodEnd: 4, title: 'Unknown periods' },
    ],
  }),
  sources,
  weeks: [11],
})
assert.equal(periodResult.draft.sessions.length, 1, 'a span with stated times resolves')
assert.equal(periodResult.draft.sessions[0].start, '08:00')
assert.equal(periodResult.draft.sessions[0].end, '09:35')
assert.equal(periodResult.pending.length, 1, 'periods with no times are left for the preview')
assert.equal(periodResult.pending[0].periodStart, 3)
assert.deepEqual(periodResult.periods.map((p) => p.period), [1, 2])
assert.equal(periodResult.periods[1].start, '', 'a half-stated period is kept, not guessed')

// A sheet that only has period numbers must not throw: every row is pending.
const allPending = await parseCoursesWithAi({
  provider: toolCall({
    sessions: [{ week: 11, weekday: 0, periodStart: 1, periodEnd: 2, title: 'Periods only' }],
  }),
  sources,
  weeks: [11],
})
assert.equal(allPending.draft.sessions.length, 0)
assert.equal(allPending.pending.length, 1)

// --- tool arguments that are not clean JSON -------------------------------

const toolCallRaw = (args) => ({
  async chat() {
    return {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call-x', type: 'function', function: { name: 'submit_sessions', arguments: args } }],
    }
  },
})

const doubled = await parseCoursesWithAi({
  provider: toolCallRaw(
    JSON.stringify(
      JSON.stringify({
        sessions: [{ week: 11, weekday: 0, start: '08:00', end: '09:00', title: 'Doubled' }],
      }),
    ),
  ),
  sources,
  weeks: [11],
})
assert.equal(doubled.draft.sessions[0].title, 'Doubled', 'a double-encoded argument is unwrapped')

const recovered = await parseCoursesWithAi({
  provider: {
    chat: async () => ({
      role: 'assistant',
      content:
        '{"sessions":[{"week":11,"weekday":0,"start":"08:00","end":"09:00","title":"From content"}]}',
      tool_calls: [
        { id: 'call-y', type: 'function', function: { name: 'submit_sessions', arguments: '{"sessions": [' } },
      ],
    }),
  },
  sources,
  weeks: [11],
})
assert.equal(recovered.draft.sessions[0].title, 'From content', 'the message content is the fallback')

await assert.rejects(
  () =>
    parseCoursesWithAi({
      provider: {
        chat: async () => ({
          role: 'assistant',
          content: null,
          finish_reason: 'length',
          tool_calls: [
            { id: 'call-z', type: 'function', function: { name: 'submit_sessions', arguments: '{"sessions": [' } },
          ],
        }),
      },
      sources,
      weeks: [11],
    }),
  /cut off/,
)

// --- merging keeps local weeks --------------------------------------------

const localDraft = {
  sessions: [{ week: 7, weekday: 0, start: '08:00', end: '09:00', title: 'Local', location: '', note: '' }],
  semesterStart: '2026-08-24',
  weeks: [7],
  conflicts: [],
}
const aiDraft = {
  sessions: [{ week: 11, weekday: 0, start: '08:00', end: '09:00', title: 'AI', location: '', note: '' }],
  semesterStart: '2026-08-24',
  weeks: [11],
  conflicts: [],
}
const merged = mergeCourseDrafts(localDraft, aiDraft)
assert.deepEqual(merged.weeks, [7, 11])
assert.equal(merged.sessions.find((s) => s.week === 7).title, 'Local')
assert.equal(merged.sessions.find((s) => s.week === 11).title, 'AI')

const override = mergeCourseDrafts(localDraft, {
  ...aiDraft,
  sessions: [{ week: 7, weekday: 0, start: '08:00', end: '09:00', title: 'AI 7', location: '', note: '' }],
  weeks: [7],
})
assert.equal(override.sessions[0].title, 'AI 7')
assert.deepEqual(override.conflicts, [7])

await server.close()
console.log('ai course: ok')

/**
 * The check on the assistant loop, run with `node scripts/check-ai-agent.mjs`.
 *
 * No network and no store: the provider is a scripted sequence, and the tool
 * effects are recorded by the test. What is pinned down is the shape that makes
 * the assistant safe — reads run, writes stop as proposals, invalid tool JSON
 * comes back as a tool error, and a thinking model's `reasoning_content` is
 * carried to the next request.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
})
const { runAiTurn } = await server.ssrLoadModule('/src/lib/ai/agent.ts')
const { AiError } = await server.ssrLoadModule('/src/lib/ai/types.ts')

const final = (text) => ({ role: 'assistant', content: text })
const call = (id, name, args) => ({
  role: 'assistant',
  content: null,
  tool_calls: [{ id, type: 'function', function: { name, arguments: args } }],
})

const proposal = {
  kind: 'day_plan',
  id: 'p1',
  date: '2026-09-15',
  mode: 'rest',
  taskIds: [],
  hours: {},
  rows: [],
  summary: 'rest',
  warnings: [],
}

function fakeProvider(responses) {
  const seen = []
  return {
    seen,
    async chat(request) {
      seen.push(request)
      const next = responses.shift()
      if (!next) throw new Error('script exhausted')
      if (next instanceof Error) throw next
      return next
    },
  }
}

const executeRead = () => ({ content: JSON.stringify({ ok: true, value: 1 }) })
const executeProposal = () => ({ content: JSON.stringify({ ok: true, status: 'pending_confirmation' }), proposal })

// A read tool runs, its result is appended, and the model answers.
{
  const provider = fakeProvider([call('t1', 'search_tasks', '{"query":"a"}'), final('done')])
  const result = await runAiTurn({
    provider,
    messages: [{ role: 'user', content: 'find a' }],
    system: 'sys',
    tools: [],
    execute: executeRead,
  })
  assert.equal(result.stopped, 'final')
  const tool = result.messages.find((m) => m.role === 'tool')
  assert.equal(tool.tool_call_id, 't1')
  assert.match(tool.content, /"ok":true/)
  assert.equal(result.messages.at(-1).content, 'done')
}

// A proposal stops before any write; the tool result says it is pending.
{
  const provider = fakeProvider([call('t2', 'propose_day_plan', '{}'), final('waiting')])
  const result = await runAiTurn({
    provider,
    messages: [{ role: 'user', content: 'plan' }],
    system: 'sys',
    tools: [],
    execute: executeProposal,
  })
  assert.equal(result.stopped, 'proposal')
  assert.equal(result.proposals.length, 1)
  assert.equal(result.proposals[0].kind, 'day_plan')
  // The second response is never requested: the loop stops at the proposal.
  assert.equal(provider.seen.length, 1)
  assert.match(result.messages.find((m) => m.role === 'tool').content, /pending_confirmation/)
}

// Malformed tool JSON becomes a tool error and the loop can continue.
{
  const provider = fakeProvider([call('t3', 'search_tasks', '{bad'), final('recovered')])
  const result = await runAiTurn({
    provider,
    messages: [{ role: 'user', content: 'x' }],
    system: 'sys',
    tools: [],
    execute: () => {
      throw new Error('must not run')
    },
  })
  assert.equal(result.stopped, 'final')
  assert.match(result.messages.find((m) => m.role === 'tool').content, /invalid_json/)
}

// The thinking model's reasoning_content is still on the assistant message
// when the next request is built.
{
  const thinking = { ...call('t4', 'search_tasks', '{}'), reasoning_content: 'thinking...' }
  const provider = fakeProvider([thinking, final('done')])
  const result = await runAiTurn({
    provider,
    messages: [{ role: 'user', content: 'x' }],
    system: 'sys',
    tools: [],
    execute: executeRead,
  })
  assert.equal(result.stopped, 'final')
  const second = provider.seen[1].messages.find((m) => m.role === 'assistant')
  assert.equal(second.reasoning_content, 'thinking...')
}

// A provider that keeps calling tools eventually hits the step limit.
{
  const provider = {
    async chat() {
      return call('loop', 'search_tasks', '{}')
    },
  }
  const result = await runAiTurn({
    provider,
    messages: [{ role: 'user', content: 'loop' }],
    system: 'sys',
    tools: [],
    execute: executeRead,
    maxSteps: 2,
  })
  assert.equal(result.stopped, 'max_steps')
}

// HTTP/auth failures are returned as typed errors, not thrown out of the page.
{
  const provider = fakeProvider([new AiError('auth', 'no')])
  const result = await runAiTurn({
    provider,
    messages: [{ role: 'user', content: 'x' }],
    system: 'sys',
    tools: [],
    execute: executeRead,
  })
  assert.equal(result.stopped, 'error')
  assert.equal(result.error.code, 'auth')
}

await server.close()
console.log('ai agent: ok')

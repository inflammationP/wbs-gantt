/**
 * The check on the DeepSeek transport, run with `node scripts/check-ai-client.mjs`.
 *
 * The network is replaced by a fake `fetch`: what is pinned is the request the
 * app makes (fixed endpoint, bearer key, OpenAI tool-call shape) and the mapping
 * of an HTTP status to a typed error. No real key and no request leave the test.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
})
const { createDeepSeekProvider, listDeepSeekModels } = await server.ssrLoadModule('/src/lib/ai/deepseek.ts')
const { AiError } = await server.ssrLoadModule('/src/lib/ai/types.ts')

const realFetch = globalThis.fetch
let seen = null
globalThis.fetch = async (url, init) => {
  seen = { url, init }
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'ok',
            reasoning_content: 'why',
            tool_calls: [
              { id: 't1', type: 'function', function: { name: 'search_tasks', arguments: '{}' } },
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

try {
  const provider = createDeepSeekProvider({ apiKey: 'test-key', model: 'deepseek-chat' })
  const reply = await provider.chat({
    messages: [{ role: 'user', content: 'hi' }],
    tools: [
      {
        type: 'function',
        function: { name: 'search_tasks', description: 'find', parameters: { type: 'object', properties: {} } },
      },
    ],
  })
  assert.equal(seen.url, 'https://api.deepseek.com/chat/completions')
  assert.equal(seen.init.headers.Authorization, 'Bearer test-key')
  const body = JSON.parse(seen.init.body)
  assert.equal(body.model, 'deepseek-chat')
  assert.equal(body.stream, false)
  assert.equal(body.tool_choice, 'auto')
  assert.equal(body.tools[0].function.name, 'search_tasks')
  assert.equal(reply.content, 'ok')
  assert.equal(reply.reasoning_content, 'why')
  assert.equal(reply.tool_calls[0].id, 't1')

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'no' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  await assert.rejects(
    () => provider.chat({ messages: [{ role: 'user', content: 'hi' }], tools: [] }),
    (err) => err instanceof AiError && err.code === 'auth',
  )

  globalThis.fetch = async (url, init) => {
    seen = { url, init }
    return new Response(
      JSON.stringify({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-flash' }, { id: 'deepseek-chat' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const models = await listDeepSeekModels({ apiKey: 'test-key' })
  assert.equal(seen.url, 'https://api.deepseek.com/models')
  assert.equal(seen.init.headers.Authorization, 'Bearer test-key')
  assert.deepEqual(models, ['deepseek-chat', 'deepseek-flash'])

  globalThis.fetch = async () => new Response('nope', { status: 500 })
  assert.deepEqual(await listDeepSeekModels({ apiKey: 'test-key' }), [])
  assert.deepEqual(await listDeepSeekModels({ apiKey: '  ' }), [])
} finally {
  globalThis.fetch = realFetch
  await server.close()
}

console.log('ai client: ok')

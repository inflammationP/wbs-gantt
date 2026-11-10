import { isTauri } from '../updater'
import { AI_MAX_TOKENS, AI_TIMEOUT_MS, DEEPSEEK_BASE_URL, DEFAULT_AI_MODEL } from './constants'
import { AiError, AiMessage, AiProvider, AiToolSpec } from './types'

/**
 * The DeepSeek transport.
 *
 * One endpoint, the user's key, and the OpenAI-compatible chat shape. Desktop
 * goes through the Tauri HTTP plugin, which the webview's own `fetch` needs to
 * bypass CORS; the web build uses the browser's fetch and therefore depends on
 * DeepSeek answering CORS.
 */

async function resolveFetch(): Promise<typeof fetch> {
  if (isTauri()) {
    const { fetch: pluginFetch } = await import('@tauri-apps/plugin-http')
    return pluginFetch as unknown as typeof fetch
  }
  return globalThis.fetch.bind(globalThis)
}

function httpError(status: number, message: string): AiError {
  if (status === 401) return new AiError('auth', message, status)
  if (status === 402) return new AiError('balance', message, status)
  if (status === 429) return new AiError('rate_limit', message, status)
  if (status >= 500) return new AiError('server', message, status)
  return new AiError('http', message, status)
}

function cleanMessage(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 300) : ''
}

export function createDeepSeekProvider({
  apiKey,
  model = DEFAULT_AI_MODEL,
}: {
  apiKey: string
  model?: string
}): AiProvider {
  return {
    async chat({ messages, tools, signal, maxTokens, toolChoice = 'auto' }): Promise<AiMessage> {
      if (!apiKey.trim()) throw new AiError('no_key', 'DeepSeek API key is not set')

      const controller = new AbortController()
      const onAbort = () => controller.abort()
      if (signal?.aborted) controller.abort()
      else signal?.addEventListener('abort', onAbort)
      const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

      try {
        const fetchImpl = await resolveFetch()
        const body: Record<string, unknown> = {
          model: model.trim() || DEFAULT_AI_MODEL,
          messages,
          stream: false,
          max_tokens: maxTokens ?? AI_MAX_TOKENS,
        }
        if (tools.length > 0) {
          body.tools = tools
          body.tool_choice = toolChoice
        }

        const response = await fetchImpl(`${DEEPSEEK_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        } as RequestInit)

        const text = await response.text()
        let payload: unknown = null
        try {
          payload = text ? JSON.parse(text) : null
        } catch {
          // Keep the status; a proxy's HTML error page is not worth echoing.
        }
        const record = (payload ?? {}) as {
          error?: { message?: unknown }
          choices?: { message?: Record<string, unknown>; finish_reason?: unknown }[]
        }

        if (!response.ok) {
          throw httpError(
            response.status,
            cleanMessage(record.error?.message) || `DeepSeek HTTP ${response.status}`,
          )
        }

        const choice = record.choices?.[0]
        const message = choice?.message
        if (!message || typeof message !== 'object') {
          throw new AiError('bad_response', 'DeepSeek returned no message')
        }
        return {
          role: 'assistant',
          content: typeof message.content === 'string' ? message.content : null,
          ...(typeof choice?.finish_reason === 'string' ? { finish_reason: choice.finish_reason } : {}),
          ...(Array.isArray(message.tool_calls)
            ? { tool_calls: message.tool_calls as AiMessage['tool_calls'] }
            : {}),
          ...(typeof message.reasoning_content === 'string'
            ? { reasoning_content: message.reasoning_content }
            : {}),
        }
      } catch (error) {
        if (error instanceof AiError) throw error
        if (controller.signal.aborted) {
          throw new AiError(
            signal?.aborted ? 'aborted' : 'timeout',
            signal?.aborted ? 'Request stopped' : 'DeepSeek request timed out',
          )
        }
        throw new AiError(
          'network',
          error instanceof Error ? error.message.slice(0, 300) : 'DeepSeek request failed',
        )
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
      }
    },
  }
}

/**
 * The model ids this key may use, for the settings picker. Any failure returns
 * an empty list: the picker only suggests, the field stays free text.
 */
export async function listDeepSeekModels({ apiKey }: { apiKey: string }): Promise<string[]> {
  if (!apiKey.trim()) return []
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const fetchImpl = await resolveFetch()
    const response = await fetchImpl(`${DEEPSEEK_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    } as RequestInit)
    if (!response.ok) return []
    const payload = (await response.json()) as { data?: { id?: unknown }[] }
    const ids = (payload.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    return [...new Set(ids)]
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * A real request, small enough to be cheap and large enough to prove the key,
 * model and network path all work.
 */
export async function testDeepSeekConnection({
  apiKey,
  model,
}: {
  apiKey: string
  model: string
}): Promise<void> {
  const provider = createDeepSeekProvider({ apiKey, model })
  await provider.chat({
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    tools: [],
    maxTokens: 16,
  })
}

export type { AiMessage, AiProvider, AiToolSpec }

import { AI_MAX_STEPS, AI_MAX_TOKENS } from './constants'
import { parseToolCall, AiProposal, ToolResult } from './tools'
import { AiError, AiMessage, AiProvider, AiToolCall, AiToolSpec } from './types'

export interface AiTurnResult {
  messages: AiMessage[]
  proposals: AiProposal[]
  stopped: 'final' | 'proposal' | 'max_steps' | 'error'
  error?: AiError
}

export type ToolExecutor = (call: AiToolCall, input: Record<string, unknown>) => ToolResult

/**
 * One turn of the assistant: ask, run the tools the model chooses, repeat until
 * it answers or proposes something.
 *
 * A proposal stops the loop after every tool result has been appended. The UI
 * then shows the card; applying is a separate step, and only after applying
 * does another turn explain what happened. The model is never told a write
 * succeeded until the app says so.
 */
export async function runAiTurn({
  provider,
  messages,
  system,
  tools,
  execute,
  maxSteps = AI_MAX_STEPS,
  signal,
  onTool,
}: {
  provider: AiProvider
  /** Conversation history without the system prompt. */
  messages: AiMessage[]
  system: string
  tools: AiToolSpec[]
  execute: ToolExecutor
  maxSteps?: number
  signal?: AbortSignal
  onTool?: (name: string, phase: 'start' | 'end', ok?: boolean) => void
}): Promise<AiTurnResult> {
  const working: AiMessage[] = [...messages]
  const proposals: AiProposal[] = []

  for (let step = 0; step < maxSteps; step++) {
    let response: AiMessage
    try {
      response = await provider.chat({
        messages: [{ role: 'system', content: system }, ...working],
        tools,
        signal,
        maxTokens: AI_MAX_TOKENS,
      })
    } catch (err) {
      return {
        messages: working,
        proposals,
        stopped: 'error',
        error:
          err instanceof AiError
            ? err
            : new AiError('bad_response', err instanceof Error ? err.message : 'Assistant request failed'),
      }
    }

    working.push(response)
    const calls = response.tool_calls ?? []
    if (calls.length === 0) return { messages: working, proposals, stopped: 'final' }

    for (const call of calls) {
      onTool?.(call.function.name, 'start')
      const input = parseToolCall(call)
      if (!input) {
        working.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, error: 'invalid_json', message: 'Tool arguments were not valid JSON.' }),
        })
        onTool?.(call.function.name, 'end', false)
        continue
      }
      const result = execute(call, input)
      working.push({ role: 'tool', tool_call_id: call.id, content: result.content })
      if (result.proposal) proposals.push(result.proposal)
      onTool?.(call.function.name, 'end', true)
    }

    if (proposals.length > 0) return { messages: working, proposals, stopped: 'proposal' }
  }

  return { messages: working, proposals, stopped: 'max_steps' }
}

/**
 * The small wire between the app and DeepSeek.
 *
 * Deliberately the OpenAI-compatible chat shape, not an Anthropic one: the
 * user's key is a DeepSeek key, and DeepSeek's tool calling is the OpenAI
 * function-calling protocol. `reasoning_content` is carried through so a
 * thinking model can be used without losing its own turn.
 */

export interface AiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: AiToolCall[]
  tool_call_id?: string
  /** DeepSeek thinking models return this; it must be sent back unchanged. */
  reasoning_content?: string
  /** `length` means the answer was cut off before it ended. */
  finish_reason?: string
}

export interface AiToolSpec {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface AiChatRequest {
  messages: AiMessage[]
  tools: AiToolSpec[]
  signal?: AbortSignal
  maxTokens?: number
  /** `auto` for conversation; a named function for the timetable extractor. */
  toolChoice?: 'auto' | { type: 'function'; function: { name: string } }
}

export interface AiProvider {
  chat(request: AiChatRequest): Promise<AiMessage>
}

export type AiErrorCode =
  | 'no_key'
  | 'auth'
  | 'balance'
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'bad_response'
  | 'server'
  | 'http'

export class AiError extends Error {
  code: AiErrorCode
  status?: number

  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
  }
}

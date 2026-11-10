/**
 * The DeepSeek endpoint is fixed in the first version.
 *
 * A user-supplied Base URL would mean allowing an arbitrary HTTPS host through
 * the Tauri HTTP capability, which is a real widening of what the app may talk
 * to. The default provider is DeepSeek; a custom/relay address is a later
 * decision, not a hidden setting.
 */
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

/** Non-thinking model, documented as supporting OpenAI-style tool calls. */
export const DEFAULT_AI_MODEL = 'deepseek-flash'

export const AI_MAX_TOKENS = 4096
export const AI_MAX_STEPS = 6
export const AI_TIMEOUT_MS = 60_000

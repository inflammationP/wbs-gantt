import type { Dict } from '../i18n'
import type { TFunc } from '../useT'
import { AiError, AiErrorCode } from './types'

const KEYS: Record<AiErrorCode, keyof Dict> = {
  no_key: 'ai.error.noKey',
  auth: 'ai.error.auth',
  balance: 'ai.error.balance',
  rate_limit: 'ai.error.rateLimit',
  network: 'ai.error.network',
  timeout: 'ai.error.timeout',
  aborted: 'ai.error.aborted',
  bad_response: 'ai.error.badResponse',
  server: 'ai.error.unknown',
  http: 'ai.error.unknown',
}

export function aiErrorMessage(t: TFunc, error: unknown): string {
  if (!(error instanceof AiError)) return t('ai.error.unknown')
  const base = t(KEYS[error.code])
  // The provider's own message is the only clue for a bad model name or a
  // proxy error; it is already trimmed by the client and never contains a key.
  return error.code === 'http' || error.code === 'server' || error.code === 'bad_response'
    ? `${base} ${error.message}`.slice(0, 320)
    : base
}

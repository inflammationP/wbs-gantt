import { todayISO } from './dates'
import type { Lang } from './i18n'
import {
  Board,
  CopyOverrides,
  DayMessages,
  Digest,
  DigestCategory,
  ReminderRule,
  RenderRule,
  DIGEST_WINDOW_DAYS,
  upcomingDigests,
} from './reminder'
import { isTauri } from './updater'

/**
 * Where a message goes.
 *
 * PushPlus is the one channel wired up. The *delivery* is the part that is one
 * line wide here — POST a token, a title and a body — so a second channel
 * (企业微信群机器人 is the obvious next one, at
 * `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…` with
 * `{msgtype:'text', text:{content}}`) is another constant and another branch in
 * `sendReminder`, not a refactor. There is deliberately no channel registry: one
 * row is not a table.
 */
const SEND_URL = 'https://www.pushplus.plus/send'

/**
 * How long to wait before calling the network unreachable.
 *
 * The same deadline `updater.ts` puts on its check, and for the same reason: a
 * blocked or black-holed network otherwise leaves the button spinning forever.
 * `connectTimeout` rather than an `AbortSignal` because this is the plugin's own
 * option and the stall being defended against is the connection, not the reply.
 */
const CONNECT_TIMEOUT_MS = 15_000

/**
 * What a send produced.
 *
 * A union rather than a boolean, because the caller has to tell apart three
 * things that would otherwise collapse: this build cannot send at all (the
 * browser bundle — the same `unsupported` the updater reports), it went, and it
 * did not. Only the last is worth showing, and it is worth showing *why*: a bad
 * token needs a different fix from an offline laptop.
 */
export type SendResult = { kind: 'unsupported' } | { kind: 'sent' } | { kind: 'error'; detail: string }

/** The fields of PushPlus's reply this module reads. */
interface Reply {
  code?: number
  msg?: string
}

/**
 * One message to one PushPlus token.
 *
 * The plugin's `fetch` rather than the webview's, and the difference is the
 * whole reason the dependency exists: PushPlus returns no CORS headers, so a
 * cross-origin POST from the webview is blocked before it leaves — the request
 * is refused by origin policy, not by the network. The plugin runs it in Rust
 * instead, where no such policy applies.
 *
 * Imported lazily, like `openExternal` in `links.ts`, so the browser bundle
 * never carries a Tauri plugin it cannot call.
 */
export async function sendReminder(token: string, digest: Digest): Promise<SendResult> {
  if (!isTauri()) return { kind: 'unsupported' }

  const { fetch } = await import('@tauri-apps/plugin-http')
  try {
    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        title: digest.title,
        content: digest.body,
        // `txt` and not the default `html`: the html template shows the first 50
        // characters and hides the rest behind a "view details" tap, which for a
        // list of names is the entire message behind a tap.
        template: 'txt',
      }),
      connectTimeout: CONNECT_TIMEOUT_MS,
    })
    if (!res.ok) return { kind: 'error', detail: `HTTP ${res.status}` }

    // PushPlus answers 200 at the transport level and puts the real outcome in
    // `code`, so a rejected token arrives here as a *successful* HTTP response.
    // Checking `res.ok` alone would report a wrong token as delivered.
    const reply = (await res.json()) as Reply
    if (reply.code !== 200) return { kind: 'error', detail: reply.msg ?? `code ${reply.code}` }
    return { kind: 'sent' }
  } catch (err) {
    console.warn('Reminder send failed:', err)
    return { kind: 'error', detail: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * The file the scheduled task reads.
 *
 * `version` is here so a script left over from an older build can refuse a file
 * it does not understand rather than misread it — the file and the script are
 * installed and upgraded at different moments, so they will disagree at least once.
 */
export interface ReminderFile {
  version: 2
  /** When this was rendered, for the "has it gone stale" question. */
  writtenAt: string
  settings: {
    wechat: boolean
    token: string
    /**
     * What the toast's acknowledgement button says, in the app's language.
     *
     * Travels in the file because the sender has no dictionary — the same reason
     * the tray's two labels are pushed down from here rather than looked up over
     * there.
     */
    ack: string
  }
  /**
   * The rules that were in force when this was rendered.
   *
   * With their times, which is what the sender compares the clock against. It
   * knows nothing else about them: which slot a send lands in is decided by the
   * window on each message, not by the rule.
   */
  rules: (RenderRule & { time: string })[]
  /**
   * Keyed by `yyyy-MM-dd`, then by rule id, then a list of messages in the order
   * they run — each carrying the hours it is for.
   *
   * Two levels of key because a rule is a time, not a message: the sender picks
   * by the clock at the moment it sends, which is what lets a rule that arrives
   * hours late arrive in the right voice. A day or a rule with nothing to say is
   * absent at its own level.
   *
   * The hours are in the file rather than derived on the far side so that the
   * sender needs no idea what a slot *is*: it takes the one whose window
   * contains the current minute. See `SlotDigest`.
   */
  digests: Record<string, Record<string, DayMessages>>
}

/**
 * Render the next fortnight and hand it to the scheduled task.
 *
 * The rendering happens here, while the app is open, because the sender cannot
 * do it: it is a PowerShell script on the far side of a process boundary, and
 * teaching it what a strict leaf is would mean two implementations of the same
 * rules drifting apart. So the app decides and the script only delivers.
 *
 * `lookahead` is deliberately not "today": the point of the file is to survive
 * the app being closed, and a file holding only today's digest would be useless
 * by tomorrow morning — which is exactly when it is needed.
 */
export async function syncReminderFile(
  board: Board,
  lang: Lang,
  settings: {
    wechat: boolean
    token: string
    ack: string
    rules: ReminderRule[]
    topics: DigestCategory[]
    leadDays: number
    overrides?: CopyOverrides
  },
): Promise<void> {
  if (!isTauri()) return
  const active = settings.rules.filter((r) => r.enabled)
  const file: ReminderFile = {
    version: 2,
    writtenAt: new Date().toISOString(),
    settings: { wechat: settings.wechat, token: settings.token, ack: settings.ack },
    rules: active.map((r) => ({ id: r.id, time: r.time, weekdays: r.weekdays, shape: r.shape })),
    digests: upcomingDigests(board, todayISO(), DIGEST_WINDOW_DAYS, lang, active, {
      topics: settings.topics,
      leadDays: settings.leadDays,
      overrides: settings.overrides,
    }),
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('write_reminder_file', { contents: JSON.stringify(file) })
  } catch (err) {
    // A failed write must not take the app down with it: the board is the
    // product, the digest is a convenience, and losing the convenience is not
    // worth interrupting anyone over.
    console.warn('Reminder file write failed:', err)
  }
}

/** Ask Windows whether the scheduled task is registered. Never cached — see `State`. */
export async function isReminderTaskInstalled(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<boolean>('reminder_task_installed')
  } catch (err) {
    console.warn('Reminder task query failed:', err)
    return false
  }
}

/**
 * Write the sender script and register it with Task Scheduler.
 *
 * Throws rather than returning a union: unlike a send, this is not something the
 * app retries or works around, and the settings page has to show the reason —
 * usually that the policy on a managed machine forbids `schtasks`.
 */
export async function installReminderTask(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('install_reminder_task')
}

export async function removeReminderTask(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('remove_reminder_task')
}

/**
 * Turn "start with Windows" on or off, returning what the system reports.
 *
 * Reads back rather than assuming: the registry write can be refused, and a
 * toggle that shows "on" while nothing starts is worse than one that shows off.
 */
export async function setAutostart(enabled: boolean): Promise<boolean> {
  if (!isTauri()) return false
  const { isEnabled, enable, disable } = await import('@tauri-apps/plugin-autostart')
  if (enabled) await enable()
  else await disable()
  return isEnabled()
}

/**
 * Raise one Windows notification.
 *
 * The desktop channel, and the only one of the two that needs no account and no
 * network — it is also the only one that can be tested without embarrassing
 * anyone, so the settings page's button uses it directly rather than waiting for
 * the sender to run.
 */
export async function showToast(title: string, body: string, ack: string): Promise<SendResult> {
  if (!isTauri()) return { kind: 'unsupported' }
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('show_toast', { title, body, ack })
    return { kind: 'sent' }
  } catch (err) {
    console.warn('Toast failed:', err)
    return { kind: 'error', detail: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Rebuild the tray menu in the interface's language.
 *
 * The menu is assembled in Rust, which has no access to the dictionaries — the
 * language is a preference and the strings are TypeScript — so the two labels
 * are pushed down from here instead of looked up there.
 */
export async function setTrayLabels(open: string, quit: string): Promise<void> {
  if (!isTauri()) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_tray_labels', { open, quit })
  } catch (err) {
    console.warn('Tray label update failed:', err)
  }
}

/**
 * Whether Windows will start this app at login, or `null` if it would not say.
 *
 * Three answers rather than two, because "off" and "could not ask" lead to
 * opposite decisions at the call site: the first is a fact to store, the second
 * must leave the user's own preference alone. Collapsing them would let a failed
 * query silently switch autostart off in the prefs while the registry still has
 * it on.
 */
export async function isAutostartEnabled(): Promise<boolean | null> {
  if (!isTauri()) return null
  try {
    const { isEnabled } = await import('@tauri-apps/plugin-autostart')
    return await isEnabled()
  } catch (err) {
    console.warn('Autostart query failed:', err)
    return null
  }
}

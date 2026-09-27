import { isTauri } from './updater'

/** This project on GitHub — where the releases and their notes live. */
export const REPO_URL = 'https://github.com/inflammationP/wbs-gantt'

/**
 * Watt Toolkit, the connectivity accelerator recommended in Settings.
 *
 * Verified rather than recalled: the project's own repository
 * (`BeyondDimension/SteamTools`, GPL-3.0) declares this as its homepage, and it
 * is the URL the app has always been told to send people to.
 */
export const ACCELERATOR_URL = 'https://steampp.net/'

/**
 * Where the reminder token comes from.
 *
 * PushPlus is a Chinese relay that delivers to personal WeChat through its own
 * 公众号, which is why it needs no server of ours and no App Review: you scan a
 * QR code, follow the account, and copy a token. The token is the only
 * credential the app holds, and this is where the user goes to get it.
 */
export const PUSHPLUS_URL = 'https://www.pushplus.plus/'

/**
 * Hand a URL to the user's browser.
 *
 * Called from buttons rather than anchors, deliberately. A plain `<a href>`
 * does nothing useful inside the Tauri webview — the navigation is not passed
 * to the system browser without the opener plugin — so it would fail silently,
 * which is the exact failure these links exist to prevent.
 *
 * The plugin is imported lazily so the browser bundle never carries it; on the
 * web build `window.open` is already the right answer.
 */
export async function openExternal(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(url)
}

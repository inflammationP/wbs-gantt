import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

/**
 * How long to wait for the update endpoint before calling it unreachable.
 *
 * Without a deadline the request can hang indefinitely on a blocked network,
 * which would surface the "cannot reach GitHub" notice at an unpredictable
 * moment — or never. That silent-forever failure is the thing this module
 * exists to make visible, so the timeout is part of the fix, not a nicety.
 */
const CHECK_TIMEOUT_MS = 15_000

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * What a check produced.
 *
 * A union rather than the old `void`, because the caller has to tell apart four
 * outcomes that used to collapse into one: this build cannot update itself at
 * all (the browser bundle), there is nothing to install, there is something to
 * install, and the check failed. Only the last is news the user needs to see.
 *
 * `available` carries its own installer rather than the raw `Update`, so the
 * plugin's types never leak past this module. Whoever receives one must
 * eventually call `install` or `dismiss` — the handle is a Tauri resource and
 * `close()` is what releases it.
 */
export type CheckResult =
  | { kind: 'unsupported' }
  | { kind: 'current' }
  | {
      kind: 'available'
      version: string
      current: string
      /** Release notes, as written into `latest.json` by `scripts/release.mjs`. */
      notes: string
      date: string | null
      install: () => Promise<void>
      /** Release the handle if the user declines the update. */
      dismiss: () => Promise<void>
    }
  | { kind: 'error'; detail: string }

/**
 * Ask GitHub whether there is a newer build.
 *
 * Never installs anything — the caller decides. That split is the whole point:
 * it lets the launch check stay silent while the manual one stops to ask.
 */
export async function checkForUpdate(): Promise<CheckResult> {
  if (!isTauri()) return { kind: 'unsupported' }

  let update: Update | null
  try {
    update = await check({ timeout: CHECK_TIMEOUT_MS })
  } catch (err) {
    // Not a footnote branch: for a user behind a blocked network this is the
    // *normal* outcome, and it is exactly what the settings page reports as
    // "cannot reach GitHub". Keep the detail for the tooltip and the console,
    // since the message also covers a malformed or unsigned manifest.
    console.warn('Update check failed:', err)
    return { kind: 'error', detail: err instanceof Error ? err.message : String(err) }
  }

  if (!update) return { kind: 'current' }

  const handle = update
  return {
    kind: 'available',
    version: handle.version,
    current: handle.currentVersion,
    notes: handle.body ?? '',
    date: handle.date ?? null,
    // On Windows this exits the process once the installer is launched, so
    // anything the caller needs kept must be written before it runs.
    install: async () => {
      await handle.downloadAndInstall()
      await relaunch()
    },
    dismiss: () => handle.close(),
  }
}

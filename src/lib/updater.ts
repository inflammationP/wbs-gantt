import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Check for and install updates. No-op when running in a normal browser.
export async function checkForUpdates(): Promise<void> {
  if (!isTauri()) return
  try {
    const update = await check()
    if (update) {
      await update.downloadAndInstall()
      await relaunch()
    }
  } catch (err) {
    // Ignore failures in dev / when no update endpoint is reachable.
    console.warn('Update check failed:', err)
  }
}

import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import bundledReleases from './releaseHistory.json'

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
      /** Fetch it. Separate from `install` so the app can carry on meanwhile. */
      download: () => Promise<void>
      /** Replace the process with what `download` fetched. */
      install: () => Promise<void>
      /** Release the handle if the user declines the update. */
      dismiss: () => Promise<void>
    }
  | { kind: 'error'; detail: string }

/** One release's own notes, as the dialog shows them. */
export interface ReleaseNotes {
  version: string
  notes: string
}

/** Which update dialog is up, if either. */
export type UpdateOverlay = 'offer' | 'ready' | null

/**
 * The update overlay, from the state that decides it.
 *
 * One function rather than a guard inside each dialog, because the two dialogs
 * are alternatives and nothing used to say so: each one decided for itself, and
 * the download landing satisfied both — the restart question opened in front of
 * the offer that asked for the download, still on screen behind it.
 *
 * `updateReady` is a fact (the installer is on disk) and cannot double as the
 * dialog's visibility: dismissing the question leaves the fact true, which is
 * the whole point — the version section offers the same restart afterwards.
 * `updateReadyOpen` is only ever about the question being on screen.
 */
export function updateOverlay(s: {
  updateInfo: unknown
  updateInstalling: boolean
  updateError: string | null
  updateReady: boolean
  updateReadyOpen: boolean
}): UpdateOverlay {
  // Mid-download there is nothing to decide, and asking anything here is what
  // this state exists to avoid. The dialog the button was in gets out of the way
  // and the app carries on.
  if (!s.updateInfo || s.updateInstalling) return null
  // A failure is the one thing that reopens the offer, with the reason and the
  // button to try again — the question was already answered by pressing it.
  if (s.updateError) return 'offer'
  if (s.updateReadyOpen) return 'ready'
  // Fetched and put aside. From here the version section carries it, which is
  // what "later" has to mean if it is not to mean "never".
  if (s.updateReady) return null
  return 'offer'
}

/**
 * Every published release, with the notes each one was released with.
 *
 * That `body` is the same text `latest.json` calls `notes` — `release.mjs`
 * writes both from one prompt at publish time — is what makes this endpoint
 * usable as the app's history: the notes the dialog shows for the version on
 * offer and the notes it shows for the versions before it are the same kind of
 * thing, written the same way. `per_page=100` is the API's ceiling and far past
 * this project's count of releases.
 */
const RELEASES_URL = 'https://api.github.com/repos/inflammationP/wbs-gantt/releases?per_page=100'

/**
 * The bare placeholder `release.mjs` publishes when nobody typed notes.
 *
 * Treated as empty so the dialog's own translated "no release notes" line shows
 * instead — that English sentence in the middle of a Chinese bullet list reads
 * as a bug.
 */
const NO_NOTES = 'No release notes.'

/** `'v0.9.0'` and `'0.9.0'` both read as `[0, 9, 0]`. */
function versionParts(v: string): number[] {
  return v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
}

/**
 * Numeric, segment by segment.
 *
 * Not a string compare, and that is the whole reason this exists: `'0.9.0' >
 * '0.10.0'` as strings, which would file the newer release away as older and
 * silently drop it from the list.
 */
function compareVersions(a: string, b: string): number {
  const x = versionParts(a)
  const y = versionParts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * The releases between what is installed and what is on offer, newest first.
 *
 * Strictly between: a version's own notes are already in the dialog above this
 * list, and the version being run needs no introduction. An empty answer means
 * "nothing was skipped", which is also the condition for hiding the section —
 * so this function and the UI agree by construction.
 */
export function releasesBetween(
  releases: ReleaseNotes[],
  current: string,
  target: string,
): ReleaseNotes[] {
  return releases
    .filter((r) => compareVersions(r.version, current) > 0 && compareVersions(r.version, target) < 0)
    .sort((a, b) => compareVersions(b.version, a.version))
}

/**
 * Cached for the session: the dialog can be closed and re-opened, and a manual
 * check can follow a launch check, but the answer is the same list either way.
 * Only ever written after a successful parse, so a failure is retried rather
 * than remembered.
 */
let releaseCache: ReleaseNotes[] | null = null

/**
 * The releases, as GitHub has them.
 *
 * Only the update dialog reaches this, and that dialog exists only in the
 * desktop app, so it always goes through the plugin's fetch — the webview's own
 * `fetch` would be subject to CORS and the plugin's is not.
 */
async function getReleases(): Promise<RawRelease[]> {
  const headers = { Accept: 'application/vnd.github+json' }
  const { fetch } = await import('@tauri-apps/plugin-http')
  const request = fetch(RELEASES_URL, { headers, connectTimeout: CHECK_TIMEOUT_MS })
  // `connectTimeout` bounds only the connection; a route that stalls after it
  // would leave this promise pending forever.
  const res = await Promise.race([
    request,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('releases: timed out')), CHECK_TIMEOUT_MS)),
  ])
  // Throwing rather than returning `[]`: an empty answer means "this app has
  // shipped nothing", which is never true, and `loadReleases` would cache it
  // for the rest of the run — one failed read and the update dialog silently
  // omits the skipped versions until the app restarts.
  if (!res.ok) throw new Error(`releases: HTTP ${res.status}`)
  return (await res.json()) as RawRelease[]
}

/**
 * The published releases, as GitHub has them.
 *
 * Only the update dialog's "what did I skip" reads this now. The Settings
 * history ships in `releaseHistory.json` (`allReleases`) and needs no network.
 * This one still has to be fetched, because the versions between the installed
 * build and one released later did not exist when this build was made.
 *
 * Every failure returns an empty list, which is deliberate for that dialog: the
 * user this happens to already has the "automatic updates are unavailable"
 * banner, and the skipped-versions list is the one part of the check that does
 * not affect whether the update can be installed.
 */
async function loadReleases(): Promise<ReleaseNotes[]> {
  if (releaseCache) return releaseCache
  try {
    releaseCache = parseReleases(await getReleases())
    return releaseCache
  } catch (err) {
    console.warn('Release history unavailable:', err)
    return []
  }
}

/** One release as the API hands it over. */
interface RawRelease {
  tag_name?: string
  body?: string
  draft?: boolean
}

/**
 * The API's answer read into the shape the app draws.
 *
 * Split out from the fetch so it can be checked without a network: every rule
 * here fails silently. A draft that slips through is a release nobody has been
 * told about appearing in the history; a tag left as `v0.10.0` is a version
 * that will not compare against the `0.9.0` the app calls itself, which drops
 * it from the skipped list rather than misplacing it; and an unread `NO_NOTES`
 * is that English sentence in the middle of someone's Chinese notes.
 */
export function parseReleases(json: RawRelease[]): ReleaseNotes[] {
  return json
    .filter((r) => !r.draft && r.tag_name)
    .map((r) => {
      const body = (r.body ?? '').trim()
      return { version: r.tag_name!.replace(/^v/, ''), notes: body === NO_NOTES ? '' : body }
    })
}

/** The releases strictly between what is installed and what is on offer. */
export async function fetchReleaseHistory(current: string, target: string): Promise<ReleaseNotes[]> {
  return releasesBetween(await loadReleases(), current, target)
}

/**
 * Everything this build has shipped, newest first.
 *
 * Shipped with the app instead of fetched: the Settings history has to open
 * before any network is involved, and offline. `scripts/release.mjs` prepends
 * the notes of the release it is building to `releaseHistory.json`, so each
 * build carries its own history. The update dialog is the one that still
 * fetches (`fetchReleaseHistory`): the versions between this build and a newer
 * one were not published when this build was made, so no local copy can name
 * them.
 */
export function allReleases(): ReleaseNotes[] {
  return [...bundledReleases].sort((a, b) => compareVersions(b.version, a.version))
}

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
    /**
     * Fetching and installing are two steps, and the user gets a say between
     * them.
     *
     * `downloadAndInstall` would do both in one call, and that is what the app
     * used to make the button do: the only way to reach `install` was to sit
     * through a download first. Split, the download runs in the background while
     * the app stays usable — which matters where GitHub is slow, and it is slow
     * or unreachable for a good share of this app's users — and the question of
     * whether to restart **now** is asked when it can be answered, rather than
     * at the moment the button is pressed and nobody knows how long it will take.
     */
    download: () => handle.download(),
    // On Windows this exits the process once the installer is launched, so
    // anything the caller needs kept must be written before it runs.
    install: async () => {
      await handle.install()
      await relaunch()
    },
    dismiss: () => handle.close(),
  }
}

import { Chore, Project, Task, TaskLog } from '../types'
import { DEFAULT_LANG, isLang, Lang } from '../lib/i18n'
import { DEFAULT_THEME, isThemeId, ThemeId } from '../lib/theme'

export interface PersistedData {
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
  /**
   * Chores, kept apart from `tasks` on purpose — see `Chore` in types.ts.
   *
   * Optional in the type, unlike the three above: every blob written before
   * chores existed has no such field, and `normalize` is what turns that into
   * an empty array. Declaring it required would only move the same admission
   * to a cast at each read.
   */
  chores?: Chore[]
}

/**
 * What `normalize` guarantees: every collection present, whatever the blob had.
 *
 * The distinction from `PersistedData` is the whole point of these two types.
 * On the way in, a field may be absent — old blobs, hand-edited files. On the
 * way out it may not, so the store never has to write `?? []` and a future
 * collection cannot be half-adopted.
 */
export type LoadedData = Required<PersistedData>

const KEY = 'wbs-gantt.v2'

/**
 * Interface preferences.
 *
 * Deliberately a separate key from the data. `parseImport` produces a
 * `PersistedData` and `importData` replaces the store with it wholesale, so
 * anything filed under `KEY` is destroyed by importing a file — a user would
 * lose their language and theme by opening someone else's project. Exports
 * carry work, not preferences.
 */
export interface Prefs {
  lang: Lang
  theme: ThemeId
  /**
   * The getting-started card has been dismissed.
   *
   * A preference rather than work data, and the split is what makes it work:
   * `importData` replaces everything under `KEY` wholesale, so a flag filed
   * there would come back the moment someone opened a file a friend sent them.
   * Where it counts is the guide's *progress*: importing a board must not make
   * the card reappear over work the user has already been through.
   */
  guideDismissed: boolean
  /**
   * Milestones the guide has recorded, in two kinds.
   *
   * `language` / `endDate` are explanation dialogs that have been opened — the
   * two steps whose instruction is only "read this", which the board cannot
   * witness, since the rule they describe holds equally before and after it is
   * understood. `strict` is recorded too, for a faithful log of what has been
   * seen, though nothing gates on it.
   *
   * `tour.<page>` (see `guide.ts`) records a page the user has been taken to.
   * That one is not a read: the last step completes on having looked around, so
   * that its first "take me there" does not finish it and collapse the card
   * along with the other three places still to see.
   */
  guideDone: string[]
  /**
   * When the app last successfully reached GitHub, as an ISO instant.
   *
   * This is the anchor for the "it has been a while" nag. `null` means we have
   * never managed it — either a fresh install or a blob from before this field
   * existed. The store heals that to "now" and writes it back exactly once, so
   * a missing value cannot restart the 30-day clock on every launch (which
   * would mean the nag never fires for the user who most needs it).
   */
  updateAnchorAt: string | null
  /**
   * When the nag was last *shown* — written on display, not on dismissal.
   *
   * Display is what has to be rate-limited: a user who kills the app with the
   * modal still open never dismisses it, and a dismiss-time stamp would let
   * that user be nagged on every single launch.
   */
  nagShownAt: string | null
  /**
   * Until when the update prompt has been silenced, as an ISO instant.
   *
   * Set by the dialog's "ignore for a while" button. `null` means no snooze is
   * running. A snooze only suppresses the **prompt** — the check still runs and
   * still reports its result on the settings page, so silencing the dialog
   * never hides the fact that an update exists.
   */
  updateSnoozeUntil: string | null
}

const PREF_KEY = 'wbs-gantt.prefs'

export const DEFAULT_PREFS: Prefs = {
  lang: DEFAULT_LANG,
  theme: DEFAULT_THEME,
  guideDismissed: false,
  guideDone: [],
  updateAnchorAt: null,
  nagShownAt: null,
  updateSnoozeUntil: null,
}

// An instant this module wrote itself. Anything else — absent, from an older
// build, hand-edited — reads as "never", which the store then heals. Parsing
// rather than pattern-matching because `Date.parse` is the operation that
// actually has to succeed later.
function isInstant(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v))
}

// Anything unrecognised falls back to the default rather than propagating: a
// theme id left over from an older build, or a hand-edited file, must not leave
// the app painting a palette that no longer exists or looking up keys in a
// dictionary that was never loaded. A blob written before the guide existed has
// no `guideDismissed` at all, which is the same path — it lands on the default
// and the card shows, which is what a first run after an upgrade should do.
export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      lang: typeof parsed.lang === 'string' && isLang(parsed.lang) ? parsed.lang : DEFAULT_PREFS.lang,
      theme: typeof parsed.theme === 'string' && isThemeId(parsed.theme) ? parsed.theme : DEFAULT_THEME,
      guideDismissed:
        typeof parsed.guideDismissed === 'boolean' ? parsed.guideDismissed : DEFAULT_PREFS.guideDismissed,
      guideDone: Array.isArray(parsed.guideDone)
        ? parsed.guideDone.filter((s): s is string => typeof s === 'string')
        : DEFAULT_PREFS.guideDone,
      updateAnchorAt: isInstant(parsed.updateAnchorAt)
        ? parsed.updateAnchorAt
        : DEFAULT_PREFS.updateAnchorAt,
      nagShownAt: isInstant(parsed.nagShownAt) ? parsed.nagShownAt : DEFAULT_PREFS.nagShownAt,
      updateSnoozeUntil: isInstant(parsed.updateSnoozeUntil)
        ? parsed.updateSnoozeUntil
        : DEFAULT_PREFS.updateSnoozeUntil,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

// Normalize data loaded from disk or import: backfill `type`/`strictProgress`,
// coerce missing dates to null, and default missing collections. This is also
// the invariant repair point for to-dos — a task marked `isTodo` always comes
// back unscheduled, however it was written.
function normalize(data: PersistedData): LoadedData {
  return {
    projects: data.projects,
    chores: (Array.isArray(data.chores) ? data.chores : []).map((c) => {
      const date = c.date ?? ''
      const done = c.done === true
      return {
        ...c,
        title: c.title ?? '',
        note: c.note ?? '',
        date,
        done,
        // `done` is authoritative in both directions. An open chore carrying a
        // completion date would credit the heatmap for work that is not done,
        // and a checked one from a blob written before the field existed falls
        // back to its own date — the best guess available, and one the heatmap
        // can use, where a null it would silently skip.
        completedDate: done ? (c.completedDate ?? date) : null,
      }
    }),
    tasks: data.tasks.map((t) => {
      const isLT = t.type === 'long-term'
      const isTodo = t.isTodo === true
      return {
        ...t,
        type: isLT && !isTodo ? 'long-term' : 'phase',
        isTodo,
        startDate: isTodo ? null : (t.startDate ?? null),
        endDate: isTodo || isLT ? null : (t.endDate ?? null),
        strictProgress: isTodo ? false : (t.strictProgress ?? false),
        paused: isTodo ? false : (t.paused ?? false),
        pauseDate: isTodo ? null : (t.pauseDate ?? null),
        pauses: Array.isArray(t.pauses) ? t.pauses : [],
        priority: isTodo ? null : (t.priority ?? 'medium'),
      }
    }),
    logs: (data.logs ?? []).map((l) => ({
      ...l,
      date: l.date ?? '',
      content: l.content ?? '',
      targetProgress: l.targetProgress ?? null,
    })),
  }
}

export function loadData(): LoadedData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedData
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.tasks)) return null
    return normalize(parsed)
  } catch {
    return null
  }
}

export function saveData(data: PersistedData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function exportJson(data: PersistedData): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: data.projects,
      tasks: data.tasks,
      logs: data.logs,
      chores: data.chores ?? [],
    },
    null,
    2,
  )
}

export function parseImport(json: string): LoadedData {
  const parsed = JSON.parse(json) as PersistedData
  if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid file: expected { projects, tasks } arrays')
  }
  return normalize({
    projects: parsed.projects,
    tasks: parsed.tasks,
    logs: parsed.logs ?? [],
    chores: parsed.chores ?? [],
  })
}

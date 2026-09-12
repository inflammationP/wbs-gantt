import { Project, Task, TaskLog } from '../types'
import { isLang, Lang } from '../lib/i18n'
import { DEFAULT_THEME, isThemeId, ThemeId } from '../lib/theme'

export interface PersistedData {
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
}

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
}

const PREF_KEY = 'wbs-gantt.prefs'

export const DEFAULT_PREFS: Prefs = { lang: 'en', theme: DEFAULT_THEME }

// Anything unrecognised falls back to the default rather than propagating: a
// theme id left over from an older build, or a hand-edited file, must not leave
// the app painting a palette that no longer exists or looking up keys in a
// dictionary that was never loaded.
export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      lang: typeof parsed.lang === 'string' && isLang(parsed.lang) ? parsed.lang : DEFAULT_PREFS.lang,
      theme: typeof parsed.theme === 'string' && isThemeId(parsed.theme) ? parsed.theme : DEFAULT_THEME,
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
function normalize(data: PersistedData): PersistedData {
  return {
    projects: data.projects,
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

export function loadData(): PersistedData | null {
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
    { version: 1, exportedAt: new Date().toISOString(), projects: data.projects, tasks: data.tasks, logs: data.logs },
    null,
    2,
  )
}

export function parseImport(json: string): PersistedData {
  const parsed = JSON.parse(json) as PersistedData
  if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid file: expected { projects, tasks } arrays')
  }
  return normalize({ projects: parsed.projects, tasks: parsed.tasks, logs: parsed.logs ?? [] })
}

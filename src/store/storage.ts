import { Project, Task, TaskLog } from '../types'

export interface PersistedData {
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
}

const KEY = 'wbs-gantt.v2'

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

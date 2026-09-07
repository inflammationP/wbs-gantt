import { Project, Task } from '../types'

export interface PersistedData {
  projects: Project[]
  tasks: Task[]
}

const KEY = 'wbs-gantt.v1'

// Normalize data loaded from disk or import: backfill the `type` field and
// coerce missing dates to null so older saved data keeps working.
function normalize(data: PersistedData): PersistedData {
  return {
    projects: data.projects,
    tasks: data.tasks.map((t) => ({
      ...t,
      type: t.type === 'long-term' ? 'long-term' : 'phase',
      startDate: t.startDate ?? null,
      endDate: t.endDate ?? null,
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
    { version: 1, exportedAt: new Date().toISOString(), projects: data.projects, tasks: data.tasks },
    null,
    2,
  )
}

export function parseImport(json: string): PersistedData {
  const parsed = JSON.parse(json) as PersistedData
  if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid file: expected { projects, tasks } arrays')
  }
  return normalize({ projects: parsed.projects, tasks: parsed.tasks })
}

import type { Project, Task } from '../types'

// No demo data: new users open to an empty Gantt. User data is persisted
// separately to localStorage (see src/store/storage.ts) and is unaffected.
export function buildSeed(): { projects: Project[]; tasks: Task[] } {
  return { projects: [], tasks: [] }
}

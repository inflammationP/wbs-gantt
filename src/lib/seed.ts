import { Project, Task, TaskLog } from '../types'

// Fresh installs start empty — no bundled demo data.
export function buildSeed(): { projects: Project[]; tasks: Task[]; logs: TaskLog[] } {
  return { projects: [], tasks: [], logs: [] }
}

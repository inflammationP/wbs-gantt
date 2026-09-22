import { Chore, Habit, Project, Task, TaskLog } from '../types'

// Fresh installs start empty — no bundled demo data.
//
// The demo board used for screenshots and the tutorial lives on the
// `seed-tutorial` branch, not here: a new install must open empty, and a dataset
// in this file would ship to every user.
export function buildSeed(): {
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
  chores: Chore[]
  habits: Habit[]
} {
  return { projects: [], tasks: [], logs: [], chores: [], habits: [] }
}

import { Project, Task, TaskPriority, TaskStatus, TaskType } from '../types'
import { addDays, toISO } from './dates'

interface Spec {
  id: string
  name: string
  parent?: string
  project: string
  type?: TaskType
  start?: number
  end?: number
  progress: number
  status: TaskStatus
  priority?: TaskPriority
  est?: number
  act?: number
  desc?: string
  tags?: string[]
}

const PROJECTS: Project[] = [
  { id: 'course', name: 'Course', color: '#4ade80', description: 'Coursework and study plan' },
  { id: 'french', name: 'French', color: '#a78bfa', description: 'French A1–A2 study' },
  { id: 'team', name: 'Competition Team', color: '#fb923c', description: 'RoboMaster competition team' },
  { id: 'stm32', name: 'STM32', color: '#60a5fa', description: 'Embedded / motor control project' },
  { id: 'personal', name: 'Personal', color: '#2dd4bf', description: 'Personal goals' },
]

const SPECS: Spec[] = [
  // Long-term goals (open-ended, no dates)
  { id: 'fr-goal', name: 'Become conversational', project: 'french', type: 'long-term', progress: 25, status: 'in-progress' },
  { id: 'pe-goal', name: 'Master embedded systems', project: 'personal', type: 'long-term', progress: 0, status: 'not-started' },
  { id: 'pe-goal-robot', name: 'Build a personal robot', parent: 'pe-goal', project: 'personal', start: 30, end: 90, progress: 0, status: 'not-started' },

  // STM32
  { id: 'stm-chassis', name: 'Chassis & Drive', project: 'stm32', start: -14, end: 35, progress: 0, status: 'in-progress' },
  { id: 'stm-motor', name: 'Motor driver board', parent: 'stm-chassis', project: 'stm32', start: -14, end: 9, progress: 55, status: 'in-progress' },
  { id: 'stm-motor-sch', name: 'Schematic design', parent: 'stm-motor', project: 'stm32', start: -14, end: -8, progress: 100, status: 'completed', est: 16, act: 18 },
  { id: 'stm-motor-pcb', name: 'PCB layout', parent: 'stm-motor', project: 'stm32', start: -8, end: -1, progress: 100, status: 'completed', est: 20, act: 22 },
  { id: 'stm-motor-test', name: 'Bring-up & test', parent: 'stm-motor', project: 'stm32', start: 0, end: 9, progress: 25, status: 'in-progress', est: 24, act: 5 },
  { id: 'stm-mach', name: 'Chassis machining', parent: 'stm-chassis', project: 'stm32', start: 14, end: 34, progress: 0, status: 'not-started' },
  { id: 'stm-fw', name: 'Control firmware', project: 'stm32', start: -2, end: 70, progress: 0, status: 'in-progress' },
  { id: 'stm-can', name: 'CAN bus driver', parent: 'stm-fw', project: 'stm32', start: -2, end: 13, progress: 50, status: 'in-progress', est: 30, act: 16 },
  { id: 'stm-pid', name: 'PID tuning', parent: 'stm-fw', project: 'stm32', start: -2, end: 6, progress: 15, status: 'delayed', est: 20, act: 4, priority: 'high' },
  { id: 'stm-aim', name: 'Auto-aim algorithm', parent: 'stm-fw', project: 'stm32', start: 28, end: 72, progress: 0, status: 'not-started', priority: 'urgent' },
  { id: 'stm-test', name: 'Integration testing', project: 'stm32', start: 56, end: 76, progress: 0, status: 'not-started' },
  { id: 'stm-field', name: 'Field test', parent: 'stm-test', project: 'stm32', start: 56, end: 76, progress: 0, status: 'not-started' },

  // Competition Team
  { id: 'team-mech', name: 'Mechanical', project: 'team', start: -14, end: -2, progress: 40, status: 'in-progress', priority: 'high' },
  { id: 'team-elec', name: 'Electrical', project: 'team', start: -5, end: 25, progress: 50, status: 'in-progress' },
  { id: 'team-algo', name: 'Algorithm', project: 'team', start: 0, end: 60, progress: 0, status: 'in-progress' },
  { id: 'team-vision', name: 'Vision', parent: 'team-algo', project: 'team', start: 0, end: 40, progress: 35, status: 'in-progress', est: 60, act: 20 },
  { id: 'team-decision', name: 'Decision', parent: 'team-algo', project: 'team', start: 20, end: 60, progress: 0, status: 'not-started' },

  // French
  { id: 'fr-u5', name: 'Unité 5', project: 'french', start: -7, end: 21, progress: 60, status: 'in-progress' },
  { id: 'fr-anki', name: 'Anki review', project: 'french', start: -3, end: 4, progress: 70, status: 'in-progress', tags: ['anki'] },
  { id: 'fr-listen', name: 'Listening practice', project: 'french', start: 5, end: 12, progress: 0, status: 'not-started' },

  // Course
  { id: 'co-python', name: 'Python', project: 'course', start: -30, end: -1, progress: 100, status: 'completed', est: 40, act: 38 },
  { id: 'co-pytorch', name: 'PyTorch', project: 'course', start: 0, end: 30, progress: 0, status: 'in-progress' },
  { id: 'co-mlp', name: 'MLP', parent: 'co-pytorch', project: 'course', start: 0, end: 12, progress: 60, status: 'in-progress', est: 20, act: 12 },
  { id: 'co-cnn', name: 'CNN', parent: 'co-pytorch', project: 'course', start: 12, end: 30, progress: 0, status: 'not-started' },

  // Personal
  { id: 'pe-read', name: 'Reading', project: 'personal', start: 0, end: 20, progress: 30, status: 'paused' },
  { id: 'pe-fitness', name: 'Fitness', project: 'personal', start: -14, end: 60, progress: 50, status: 'in-progress', tags: ['health'] },
]

export function buildSeed(): { projects: Project[]; tasks: Task[] } {
  const now = new Date().toISOString()
  const d = (offset: number) => toISO(addDays(new Date(), offset))
  const tasks: Task[] = SPECS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.desc ?? '',
    parentId: s.parent ?? null,
    projectId: s.project,
    type: s.type ?? 'phase',
    startDate: s.type === 'long-term' ? null : d(s.start ?? 0),
    endDate: s.type === 'long-term' ? null : d(s.end ?? 0),
    progress: s.progress,
    status: s.status,
    priority: s.priority ?? 'medium',
    estimatedHours: s.est ?? 0,
    actualHours: s.act ?? 0,
    tags: s.tags ?? [],
    dependencies: [],
    createdAt: now,
    updatedAt: now,
  }))
  return { projects: PROJECTS.map((p) => ({ ...p })), tasks }
}

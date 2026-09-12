import { TaskPriority, TaskStatus, TaskType } from '../types'

export interface StatusMeta {
  label: string
  color: string
  dim: string
  text: string
}

export const TODO_COLOR = '#a371f7'

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo: { label: 'To-do', color: TODO_COLOR, dim: 'rgba(163,113,247,0.16)', text: TODO_COLOR },
  'not-started': { label: 'Not started', color: '#6e7681', dim: 'rgba(110,118,129,0.16)', text: '#9aa4ad' },
  'in-progress': { label: 'In progress', color: '#e3b341', dim: 'rgba(227,179,65,0.16)', text: '#e3b341' },
  completed: { label: 'Completed', color: '#3fb950', dim: 'rgba(63,185,80,0.18)', text: '#3fb950' },
  paused: { label: 'Paused', color: '#58a6ff', dim: 'rgba(88,166,255,0.15)', text: '#58a6ff' },
  delayed: { label: 'Delayed', color: '#f85149', dim: 'rgba(248,81,73,0.18)', text: '#f85149' },
}

export interface PriorityMeta {
  label: string
  color: string
}

export const PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  low: { label: 'Low', color: '#6e7681' },
  medium: { label: 'Medium', color: '#58a6ff' },
  high: { label: 'High', color: '#e3b341' },
  urgent: { label: 'Urgent', color: '#f85149' },
}

// To-dos have no priority. Everything that renders one goes through here so a
// null can never reach `PRIORITY_META[...]` and blank the app.
const NO_PRIORITY: PriorityMeta = { label: '—', color: '#6e7681' }

export function priorityMeta(p: TaskPriority | null): PriorityMeta {
  return p ? PRIORITY_META[p] : NO_PRIORITY
}

export const STATUS_ORDER: TaskStatus[] = ['todo', 'not-started', 'in-progress', 'completed', 'paused', 'delayed']
export const PRIORITY_ORDER: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

export const PROJECT_COLORS = [
  '#60a5fa', '#4ade80', '#fb923c', '#a78bfa', '#2dd4bf', '#f472b6', '#fbbf24', '#94a3b8',
]

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  phase: 'Phase',
  'long-term': 'Long-Term',
}

/** Convert a `#rrggbb` color to `rgba(r, g, b, alpha)`. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

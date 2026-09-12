import { TaskPriority, TaskStatus } from '../types'
import { Dict } from './i18n'

/**
 * The signal palette: the colours that carry meaning rather than structure.
 *
 * Green means done and red means late in every theme, so these are named for
 * what they say, not for what they look like, and the dark palettes in
 * `src/index.css` spell all six out identically. Only the light palette restates
 * them — those values are also used as text (see the status column in
 * `gantt/RowLeft.tsx` and the table in `ManagePage.tsx`) and the dark ramp fails
 * contrast on a light surface.
 *
 * Always reach a signal through one of the three helpers below rather than
 * writing a colour out. A raw hex for one of these is what let `#f85149` end up
 * copied across eight files, and what hid the green in `CalendarPage` inside an
 * `rgba(63,185,80,…)` that no search for the hex would ever find.
 */
export type SignalToken =
  | 'todo'
  | 'not-started'
  | 'in-progress'
  | 'completed'
  | 'paused'
  | 'delayed'

/** A signal at full strength: dots, bar borders and fills. */
export function sig(token: SignalToken): string {
  return `rgb(var(--c-${token}))`
}

/** A signal thinned out, for bar bodies and badge backgrounds. */
export function sigAlpha(token: SignalToken, alpha: number): string {
  return `rgb(var(--c-${token}) / ${alpha})`
}

/**
 * The readable form of a signal, where one is set as text on a panel rather than
 * drawn as a mark. Identical to `sig` everywhere except `not-started`, whose dot
 * and whose label are deliberately different weights of grey.
 */
export function sigText(token: SignalToken): string {
  return `rgb(var(--c-${token}-text))`
}

export interface StatusMeta {
  /** i18n key; the label itself lives in the dictionaries. */
  labelKey: keyof Dict
  token: SignalToken
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo: { labelKey: 'status.todo', token: 'todo' },
  'not-started': { labelKey: 'status.notStarted', token: 'not-started' },
  'in-progress': { labelKey: 'status.inProgress', token: 'in-progress' },
  completed: { labelKey: 'status.completed', token: 'completed' },
  paused: { labelKey: 'status.paused', token: 'paused' },
  delayed: { labelKey: 'status.delayed', token: 'delayed' },
}

export interface PriorityMeta {
  labelKey: keyof Dict
  token: SignalToken
}

// Priority rides the signal ramp: the four levels are the four signal colours,
// so a "high" marker and an "in progress" dot agree by construction.
export const PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  low: { labelKey: 'priority.low', token: 'not-started' },
  medium: { labelKey: 'priority.medium', token: 'paused' },
  high: { labelKey: 'priority.high', token: 'in-progress' },
  urgent: { labelKey: 'priority.urgent', token: 'delayed' },
}

// To-dos have no priority. Everything that renders one goes through here so a
// null can never reach `PRIORITY_META[...]` and blank the app.
const NO_PRIORITY: PriorityMeta = { labelKey: 'common.none', token: 'not-started' }

export function priorityMeta(p: TaskPriority | null): PriorityMeta {
  return p ? PRIORITY_META[p] : NO_PRIORITY
}

export const STATUS_ORDER: TaskStatus[] = ['todo', 'not-started', 'in-progress', 'completed', 'paused', 'delayed']
export const PRIORITY_ORDER: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

// Project identity colours, chosen by the user in the project dialog. Not part
// of any theme: a project is the same project whichever palette is on.
export const PROJECT_COLORS = [
  '#60a5fa', '#4ade80', '#fb923c', '#a78bfa', '#2dd4bf', '#f472b6', '#fbbf24', '#94a3b8',
]

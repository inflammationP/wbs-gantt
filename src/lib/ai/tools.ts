import { Chore, DayPlan, Habit, Project, Task, TaskLog, TaskPriority, TaskType } from '../../types'
import { PROJECT_COLORS } from '../ui'
import { dayStates } from '../dayTasks'
import { isArchived } from '../tree'
import { routineRows } from '../habits'
import { plannedFor, todaysChores } from '../chores'
import { planOn, plannedIds } from '../schedule'
import { toDate, toISO } from '../dates'
import { AiToolCall, AiToolSpec } from './types'

/**
 * The assistant's hands.
 *
 * Reads execute immediately. Writes never touch the store: they validate the
 * model's arguments and return a proposal for the UI to confirm. That split is
 * the trust boundary — the model can be wrong, the proposal card and the store
 * actions are what actually decide.
 */

export interface ToolContext {
  tasks: Task[]
  projects: Project[]
  logs: TaskLog[]
  dayPlans: DayPlan[]
  habits: Habit[]
  chores: Chore[]
  today: string
}

export interface TaskTreeTask {
  key: string
  name: string
  parentKey?: string
  description?: string
  startDate: string | null
  endDate: string | null
  deadline: string | null
  priority: TaskPriority
  type: TaskType
  isTodo: boolean
  strictProgress: boolean
  tags: string[]
}

export interface TaskTreeProposal {
  kind: 'task_tree'
  id: string
  project: { kind: 'existing'; id: string; name: string } | { kind: 'new'; name: string; color: string }
  parent?: { id: string; name: string }
  tasks: TaskTreeTask[]
  rows: { key: string; name: string; parentName: string | null; depth: number; startDate: string | null; endDate: string | null; deadline: string | null; isTodo: boolean }[]
  summary: string
  warnings: string[]
}

export interface DayPlanProposal {
  kind: 'day_plan'
  id: string
  date: string
  mode: 'tasks' | 'rest' | 'clear'
  taskIds: string[]
  hours: Record<string, number>
  capacityHours?: number
  rows: { id: string; name: string; hours: number | null }[]
  summary: string
  warnings: string[]
}

export type AiProposal = TaskTreeProposal | DayPlanProposal

export interface ToolResult {
  /** JSON text appended as the `tool` message. */
  content: string
  /** Present for a write tool; the loop stops and the UI shows this card. */
  proposal?: AiProposal
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'top']
const TOOL_NAMES = new Set<string>()

function iso(value: unknown): string | null {
  if (typeof value !== 'string' || !DATE.test(value)) return null
  const date = toDate(value)
  return toISO(date) === value ? value : null
}

function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function numberIn(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null
  return value
}

function error(code: string, message: string): ToolResult {
  return { content: JSON.stringify({ ok: false, error: code, message }) }
}

function ok(value: Record<string, unknown>): ToolResult {
  return { content: JSON.stringify({ ok: true, ...value }) }
}

function taskById(ctx: ToolContext, id: string): Task | undefined {
  return ctx.tasks.find((task) => task.id === id)
}

function projectName(ctx: ToolContext, id: string): string {
  return ctx.projects.find((project) => project.id === id)?.name ?? ''
}

function uniqueColor(projects: Project[]): string {
  const used = new Set(projects.map((project) => project.color))
  return PROJECT_COLORS.find((color) => !used.has(color)) ?? PROJECT_COLORS[projects.length % PROJECT_COLORS.length]
}

const state = (ctx: ToolContext, day: string) => dayStates(ctx.tasks, ctx.logs, day)

function taskLine(ctx: ToolContext, task: Task, st: ReturnType<typeof state>): Record<string, unknown> {
  return {
    id: task.id,
    name: task.name,
    projectId: task.projectId,
    projectName: projectName(ctx, task.projectId),
    parentId: task.parentId,
    parentName: task.parentId ? (taskById(ctx, task.parentId)?.name ?? null) : null,
    startDate: task.startDate,
    endDate: task.endDate,
    deadline: task.deadline ?? null,
    priority: task.priority,
    type: task.type,
    isTodo: task.isTodo,
    strictProgress: task.strictProgress,
    archived: isArchived(task),
    status: st.get(task.id)?.status ?? 'not-started',
    progress: st.get(task.id)?.progress ?? null,
  }
}

// --- read tools ------------------------------------------------------------

function listProjects(ctx: ToolContext, _input: unknown): ToolResult {
  return ok({
    projects: ctx.projects.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color,
      liveTasks: ctx.tasks.filter((task) => task.projectId === project.id && !isArchived(task)).length,
      archivedTasks: ctx.tasks.filter((task) => task.projectId === project.id && isArchived(task)).length,
    })),
  })
}

function searchTasks(ctx: ToolContext, input: Record<string, unknown>): ToolResult {
  const query = text(input.query, 100).toLowerCase()
  const projectId = text(input.projectId, 100) || null
  const requested = text(input.status, 30)
  const status = ['all', 'open', 'completed', 'paused', 'todo', 'archived'].includes(requested) ? requested : 'all'
  const limit = Math.max(1, Math.min(50, typeof input.limit === 'number' ? Math.round(input.limit) : 30))
  const st = state(ctx, ctx.today)
  const tasks = ctx.tasks.filter((task) => {
    if (status === 'archived' ? !isArchived(task) : isArchived(task)) return false
    if (projectId && task.projectId !== projectId) return false
    if (query && !`${task.name}\n${task.description}`.toLowerCase().includes(query)) return false
    const statusNow = st.get(task.id)?.status
    if (status === 'open' && (statusNow === 'completed' || task.isTodo)) return false
    if (status === 'completed' && statusNow !== 'completed') return false
    if (status === 'paused' && statusNow !== 'paused') return false
    if (status === 'todo' && !task.isTodo) return false
    return true
  })
  return ok({
    total: tasks.length,
    tasks: tasks.slice(0, limit).map((task) => taskLine(ctx, task, st)),
  })
}

function getTask(ctx: ToolContext, input: Record<string, unknown>): ToolResult {
  const id = text(input.taskId, 100)
  const query = text(input.query, 100).toLowerCase()
  const task = id
    ? taskById(ctx, id)
    : query
      ? ctx.tasks.find((candidate) => candidate.name.toLowerCase().includes(query))
      : undefined
  if (!task) return error('not_found', 'Task not found; search first.')
  const st = state(ctx, ctx.today)
  return ok({
    task: taskLine(ctx, task, st),
    description: task.description,
    children: ctx.tasks.filter((child) => child.parentId === task.id).map((child) => taskLine(ctx, child, st)),
  })
}

function getDay(ctx: ToolContext, input: Record<string, unknown>): ToolResult {
  const date = iso(input.date) ?? ctx.today
  const plan = planOn(ctx.dayPlans, date)
  const ids = plannedIds(plan)
  const kind = ids === undefined ? 'automatic' : ids.length === 0 ? 'rest' : 'planned'
  const st = state(ctx, date)
  const tasks = ctx.tasks.filter((task) => !task.isTodo && !isArchived(task) && task.startDate != null)
  const onDay = tasks.filter((task) => {
    const starts = task.startDate! <= date
    const ends = task.endDate == null || date <= task.endDate
    const late = st.get(task.id)?.status === 'delayed' || st.get(task.id)?.status === 'overrun'
    return ids === undefined ? starts && ends : ids.includes(task.id) || (late && starts)
  })
  const routines = routineRows(ctx.habits, date)
    .filter((row) => !row.hasKids && !row.done)
    .map((row) => ({ id: row.habit.id, title: row.habit.title, minutes: row.habit.durationMinutes ?? null }))
  const chores = (date <= ctx.today ? todaysChores(ctx.chores, ctx.today) : plannedFor(ctx.chores, date))
    .filter((chore) => !chore.done)
    .map((chore) => ({ id: chore.id, title: chore.title, time: chore.time ?? null }))
  return ok({
    date,
    today: ctx.today,
    plan: {
      kind,
      taskIds: ids ?? [],
      hours: plan?.hours ?? {},
      capacityHours: plan?.capacityHours ?? null,
    },
    tasks: onDay.slice(0, 80).map((task) => taskLine(ctx, task, st)),
    truncated: onDay.length > 80,
    routines,
    chores,
  })
}

function getProject(ctx: ToolContext, input: Record<string, unknown>): ToolResult {
  const id = text(input.projectId, 100)
  const name = text(input.projectName, 100).toLowerCase()
  const project = id
    ? ctx.projects.find((candidate) => candidate.id === id)
    : name
      ? ctx.projects.find((candidate) => candidate.name.toLowerCase() === name)
      : undefined
  if (!project) return error('not_found', 'Project not found; list projects first.')
  const st = state(ctx, ctx.today)
  return ok({
    project: { id: project.id, name: project.name, color: project.color },
    tasks: ctx.tasks.filter((task) => task.projectId === project.id).slice(0, 100).map((task) => taskLine(ctx, task, st)),
    truncated: ctx.tasks.filter((task) => task.projectId === project.id).length > 100,
  })
}

// --- proposal tools --------------------------------------------------------

const PRIORITY_SET = new Set<TaskPriority>(PRIORITIES)

function proposeTaskTree(ctx: ToolContext, input: Record<string, unknown>, callId?: string): ToolResult {
  const parentId = text(input.parentId, 100) || null
  const projectId = text(input.projectId, 100) || null
  const projectName = text(input.projectName, 120)
  const rawTasks = Array.isArray(input.tasks) ? input.tasks : []
  if (rawTasks.length < 1 || rawTasks.length > 80) return error('invalid_tasks', 'Provide 1–80 tasks.')

  const parent = parentId ? taskById(ctx, parentId) : undefined
  if (parentId && (!parent || parent.isTodo || isArchived(parent))) {
    return error('invalid_parent', 'The parent task must exist, not be a to-do, and not be archived.')
  }
  if (parent && projectId && projectId !== parent.projectId) {
    return error('invalid_project', 'The chosen project does not contain the parent task.')
  }
  if (parent && projectName) {
    return error('ambiguous_project', 'A task tree under an existing parent cannot also create a new project.')
  }
  const existing = parent
    ? ctx.projects.find((project) => project.id === parent.projectId)
    : projectId
      ? ctx.projects.find((project) => project.id === projectId)
      : undefined
  if (!parent && !existing && !projectName) return error('missing_project', 'Choose an existing project or give a name for a new one.')
  if (existing && projectName) return error('ambiguous_project', 'Choose an existing project or name a new one, not both.')
  if (projectId && !existing) return error('not_found', 'Project not found; list projects first.')

  const project = parent && existing
    ? { kind: 'existing' as const, id: existing.id, name: existing.name }
    : existing
      ? { kind: 'existing' as const, id: existing.id, name: existing.name }
      : { kind: 'new' as const, name: projectName, color: uniqueColor(ctx.projects) }

  const tasks: TaskTreeTask[] = []
  const keys = new Set<string>()
  const byKey = new Map<string, Record<string, unknown>>()
  for (const raw of rawTasks) {
    if (!raw || typeof raw !== 'object') return error('invalid_tasks', 'Each task must be an object.')
    const row = raw as Record<string, unknown>
    const key = text(row.key, 40)
    const name = text(row.name, 200)
    if (!key || keys.has(key)) return error('invalid_tasks', 'Task keys must be unique and non-empty.')
    if (!name) return error('invalid_tasks', 'Each task needs a name.')
    keys.add(key)
    byKey.set(key, row)
  }

  for (const raw of rawTasks) {
    const row = raw as Record<string, unknown>
    const key = text(row.key, 40)
    const name = text(row.name, 200)
    const parentKey = text(row.parentKey, 40) || undefined
    if (parentKey && !byKey.has(parentKey)) return error('invalid_parent', `Unknown parentKey "${parentKey}".`)
    const isTodo = row.isTodo === true
    const type: TaskType = isTodo ? 'phase' : row.type === 'long-term' ? 'long-term' : 'phase'
    const priority = PRIORITY_SET.has(row.priority as TaskPriority) ? (row.priority as TaskPriority) : 'medium'
    const startDate = iso(row.startDate)
    const endDate = iso(row.endDate)
    const deadline = row.deadline == null || row.deadline === '' ? null : iso(row.deadline)
    if (row.deadline != null && row.deadline !== '' && !deadline) return error('invalid_date', `Invalid deadline for "${name}".`)
    if (isTodo) {
      if (parentKey && byKey.get(parentKey)?.isTodo === true) return error('invalid_parent', 'A to-do cannot contain tasks.')
    } else if (type === 'long-term') {
      if (!startDate) return error('missing_date', `"${name}" needs a startDate; ask the user.`)
    } else {
      if (!startDate || !endDate) return error('missing_date', `"${name}" needs startDate and endDate; ask the user.`)
      if (startDate > endDate) return error('invalid_date', `"${name}" starts after it ends.`)
    }
    tasks.push({
      key,
      name,
      ...(parentKey ? { parentKey } : {}),
      description: text(row.description, 2000),
      startDate: isTodo ? null : startDate,
      endDate: isTodo || type === 'long-term' ? null : endDate,
      deadline: isTodo ? null : deadline,
      priority: isTodo ? 'medium' : priority,
      type,
      isTodo,
      strictProgress: isTodo ? false : row.strictProgress !== false,
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 20) : [],
    })
  }

  // A cycle check and the preview depth, on the validated list.
  const byTaskKey = new Map(tasks.map((task) => [task.key, task]))
  const depthOf = (task: TaskTreeTask, seen: Set<string>): number => {
    if (!task.parentKey) return 0
    if (seen.has(task.key)) return -1
    seen.add(task.key)
    const parentTask = byTaskKey.get(task.parentKey)
    if (!parentTask) return -1
    const depth = depthOf(parentTask, seen)
    return depth < 0 ? -1 : depth + 1
  }
  for (const task of tasks) {
    if (depthOf(task, new Set()) < 0) return error('cycle', 'The task tree contains a cycle.')
    if (depthOf(task, new Set()) > 10) return error('too_deep', 'The task tree is deeper than 10 levels.')
    if (task.isTodo && tasks.some((other) => other.parentKey === task.key)) {
      return error('invalid_parent', 'A to-do cannot contain tasks.')
    }
  }
  const rows = tasks.map((task) => ({
    key: task.key,
    name: task.name,
    parentName: task.parentKey ? (byTaskKey.get(task.parentKey)?.name ?? null) : parent?.name ?? null,
    depth: depthOf(task, new Set()),
    startDate: task.startDate,
    endDate: task.endDate,
    deadline: task.deadline,
    isTodo: task.isTodo,
  }))

  const id = callId ?? `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const proposal: TaskTreeProposal = {
    kind: 'task_tree',
    id,
    project,
    ...(parent ? { parent: { id: parent.id, name: parent.name } } : {}),
    tasks,
    rows,
    summary: `创建 ${tasks.length} 个任务${project.kind === 'new' ? `，新项目「${project.name}」` : `到「${project.name}」`}`,
    warnings: [
      ...(project.kind === 'new' ? ['将新建一个项目。'] : []),
      ...(parent ? [`新任务会放在「${parent.name}」下面。`] : []),
    ],
  }
  return {
    content: JSON.stringify({
      ok: true,
      status: 'pending_confirmation',
      proposalId: id,
      kind: 'task_tree',
      summary: proposal.summary,
    }),
    proposal,
  }
}

function proposeDayPlan(ctx: ToolContext, input: Record<string, unknown>, callId?: string): ToolResult {
  const date = iso(input.date) ?? ctx.today
  const mode = input.mode === 'rest' || input.mode === 'clear' ? input.mode : 'tasks'
  const rawIds = Array.isArray(input.taskIds) ? input.taskIds.filter((id): id is string => typeof id === 'string') : []
  const ids = [...new Set(rawIds)]
  const live = ctx.tasks.filter((task) => !task.isTodo && !isArchived(task))
  const tasks = ids.map((id) => live.find((task) => task.id === id))
  if (mode === 'tasks') {
    if (ids.length === 0) return error('missing_tasks', 'Select at least one task, or use rest for a rest day.')
    if (tasks.some((task) => !task)) return error('not_found', 'One of the tasks does not exist, is archived, or is a to-do.')
  }
  const hours: Record<string, number> = {}
  if (input.hours && typeof input.hours === 'object' && !Array.isArray(input.hours)) {
    for (const [id, value] of Object.entries(input.hours as Record<string, unknown>)) {
      if (mode === 'tasks' && !ids.includes(id)) return error('invalid_hours', `Hours were given for a task outside the plan: ${id}.`)
      const hoursValue = numberIn(value, 0.01, 24)
      if (hoursValue == null) return error('invalid_hours', `Invalid hours for ${id}.`)
      hours[id] = hoursValue
    }
  }
  const capacity = input.capacityHours == null
    ? undefined
    : numberIn(input.capacityHours, 0, 24) ?? undefined
  if (input.capacityHours != null && capacity == null) return error('invalid_capacity', 'capacityHours must be between 0 and 24.')

  const id = callId ?? `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const rows = (mode === 'tasks' ? ids : []).map((taskId) => ({
    id: taskId,
    name: ctx.tasks.find((task) => task.id === taskId)?.name ?? taskId,
    hours: hours[taskId] ?? null,
  }))
  const proposal: DayPlanProposal = {
    kind: 'day_plan',
    id,
    date,
    mode,
    taskIds: mode === 'tasks' ? ids : [],
    hours: mode === 'tasks' ? hours : {},
    ...(capacity !== undefined ? { capacityHours: capacity } : {}),
    rows,
    summary:
      mode === 'clear'
        ? `恢复 ${date} 的自动计划`
        : mode === 'rest'
          ? `${date} 设为休息日`
          : `${date} 安排 ${ids.length} 个任务`,
    warnings: ['保存计划没有撤销，确认后再应用。'],
  }
  return {
    content: JSON.stringify({
      ok: true,
      status: 'pending_confirmation',
      proposalId: id,
      kind: 'day_plan',
      summary: proposal.summary,
    }),
    proposal,
  }
}

// --- registry --------------------------------------------------------------

const tools: Record<string, (ctx: ToolContext, input: Record<string, unknown>, callId?: string) => ToolResult> = {
  list_projects: listProjects,
  search_tasks: searchTasks,
  get_task: getTask,
  get_day: getDay,
  get_project: getProject,
  propose_task_tree: proposeTaskTree,
  propose_day_plan: proposeDayPlan,
}

export const AI_TOOLS: AiToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description: 'List the projects with their ids, names, colors and task counts.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_tasks',
      description: 'Find tasks by text, project or status. Returns compact task records with ids.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text matched against name and description.' },
          projectId: { type: 'string' },
          status: { type: 'string', enum: ['all', 'open', 'completed', 'paused', 'todo', 'archived'] },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_task',
      description: 'Get one task by id (or the first name match), with its description and children.',
      parameters: {
        type: 'object',
        properties: { taskId: { type: 'string' }, query: { type: 'string' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_day',
      description: 'Read a day’s plan, its tasks, unfinished routines and open chores.',
      parameters: {
        type: 'object',
        properties: { date: { type: 'string', description: 'yyyy-MM-dd; defaults to today.' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project',
      description: 'Get one project and its tasks (up to 100).',
      parameters: {
        type: 'object',
        properties: { projectId: { type: 'string' }, projectName: { type: 'string' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_task_tree',
      description:
        'Propose creating a project or a tree of tasks. This does not write anything; the user confirms it. Every non-to-do task needs dates; ask the user instead of guessing.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Existing project id.' },
          projectName: { type: 'string', description: 'Name for a new project.' },
          parentId: { type: 'string', description: 'Existing task to put the new tree under.' },
          tasks: {
            type: 'array',
            minItems: 1,
            maxItems: 80,
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Temporary unique key used by parentKey.' },
                name: { type: 'string' },
                parentKey: { type: 'string', description: 'Another task key in this list.' },
                description: { type: 'string' },
                startDate: { type: 'string', description: 'yyyy-MM-dd' },
                endDate: { type: 'string', description: 'yyyy-MM-dd' },
                deadline: { type: 'string', description: 'yyyy-MM-dd' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'top'] },
                type: { type: 'string', enum: ['phase', 'long-term'] },
                isTodo: { type: 'boolean' },
                strictProgress: { type: 'boolean' },
                tags: { type: 'array', items: { type: 'string' } },
              },
              required: ['key', 'name'],
              additionalProperties: false,
            },
          },
        },
        required: ['tasks'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_day_plan',
      description: 'Propose today’s plan: chosen tasks and hours, a rest day, or restoring automatic. Does not write.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'yyyy-MM-dd; defaults to today.' },
          mode: { type: 'string', enum: ['tasks', 'rest', 'clear'] },
          taskIds: { type: 'array', items: { type: 'string' } },
          hours: { type: 'object', additionalProperties: { type: 'number' } },
          capacityHours: { type: 'number', minimum: 0, maximum: 24 },
        },
        additionalProperties: false,
      },
    },
  },
]

for (const spec of AI_TOOLS) TOOL_NAMES.add(spec.function.name)

export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.has(name)
}

export function executeTool(name: string, input: unknown, ctx: ToolContext, callId?: string): ToolResult {
  const fn = tools[name]
  if (!fn) return error('unknown_tool', `Unknown tool: ${name}`)
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return error('invalid_input', 'Tool input must be an object.')
  }
  return fn(ctx, input as Record<string, unknown>, callId)
}

export function parseToolCall(call: AiToolCall): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(call.function.arguments)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

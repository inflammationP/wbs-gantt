import { useMemo } from 'react'
import { create } from 'zustand'
import { AppView, Project, Task, TaskLog, TaskPriority, TaskType, ViewMode } from '../types'
import { todayISO, addUnitISO, Unit, addDays, diffDays, toDate, toISO } from '../lib/dates'
import { timelineRange, DateRange } from '../lib/timeline'
import { buildRows, collectDescendants, hasChildren, syncParentEnds, todoCascadeIds, todoGroupIds, Row } from '../lib/tree'
import { loadData, saveData, loadPrefs, savePrefs, PersistedData } from './storage'
import { applyLang, Lang } from '../lib/i18n'
import { applyTheme, ThemeId } from '../lib/theme'
import { buildSeed } from '../lib/seed'

export interface NewTaskInput {
  name: string
  description?: string
  parentId?: string | null
  projectId: string
  type?: TaskType
  isTodo?: boolean
  startDate: string | null
  endDate: string | null
  strictProgress?: boolean
  priority?: TaskPriority
  tags?: string[]
  dependencies?: string[]
}

// The schedule a to-do is given when it is started (or restored in bulk).
export interface StartTodoInput {
  id: string
  startDate: string
  endDate: string
  strictProgress: boolean
  priority: TaskPriority
}

interface State {
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
  activeView: AppView
  selectedTaskId: string | null
  selectedProjectId: string | null
  // yyyy-MM-dd of the day whose detail panel is open in the Calendar. View
  // state only — the persistence subscriber below never writes it.
  selectedDay: string | null
  viewMode: ViewMode
  // The date the timeline scrolls back to when Today is pressed. Needs the tick
  // beside it: pressing Today twice leaves `focusISO` unchanged, so the value
  // alone cannot tell the Gantt that another scroll was asked for.
  focusISO: string
  focusTick: number
  today: string
  expanded: Record<string, boolean>
  projectFilter: string
  lang: Lang
  theme: ThemeId

  setLang: (l: Lang) => void
  setTheme: (t: ThemeId) => void
  setActiveView: (v: AppView) => void
  setSelected: (id: string | null) => void
  setSelectedProject: (id: string | null) => void
  setSelectedDay: (day: string | null) => void
  setViewMode: (m: ViewMode) => void
  goToday: () => void
  setProjectFilter: (id: string) => void
  toggleExpanded: (id: string, defaultOpen?: boolean) => void
  expandAll: () => void
  collapseAll: () => void

  addProject: (name: string, color: string) => string
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void

  addTask: (input: NewTaskInput) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  setTaskParent: (id: string, parentId: string | null) => void
  moveTask: (id: string, deltaUnits: number, unit: Unit) => void
  resizeTask: (id: string, startISO: string, endISO: string) => void

  addLog: (input: { taskId: string; date: string; content: string; targetProgress?: number | null }) => string
  updateLog: (id: string, patch: { date?: string; content?: string; targetProgress?: number | null }) => void
  deleteLog: (id: string) => void

  pauseTask: (id: string) => void
  resumeTask: (id: string) => void

  setTaskTodo: (id: string) => void
  startTodoTasks: (entries: StartTodoInput[]) => void

  syncParentEnds: () => void

  importData: (data: PersistedData) => void
}

function uid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const loaded = loadData()
const initial = loaded ?? buildSeed()
if (!loaded) saveData({ projects: initial.projects, tasks: initial.tasks, logs: initial.logs })

const prefs = loadPrefs()
// Before the first render, not in an effect: the palette is applied by an
// attribute on <html>, and an effect would let one frame paint in the wrong one.
// The *default* palette does not depend on this at all — it lives in `:root` —
// so this only ever has to catch up the three non-default themes.
applyTheme(prefs.theme)
applyLang(prefs.lang)

// Written from the actions rather than a subscriber: the subscriber below keys
// off the identity of projects/tasks/logs and never fires for a preference, and
// a second subscriber would run after React commits, a frame late.
function persistPrefs(): void {
  const { lang, theme } = useStore.getState()
  savePrefs({ lang, theme })
}

export const useStore = create<State>()((set) => ({
  projects: initial.projects,
  tasks: initial.tasks,
  logs: initial.logs,
  activeView: 'gantt',
  selectedTaskId: null,
  selectedProjectId: null,
  selectedDay: null,
  viewMode: 'day',
  focusISO: todayISO(),
  focusTick: 0,
  today: todayISO(),
  expanded: {},
  projectFilter: 'all',
  lang: prefs.lang,
  theme: prefs.theme,

  setLang: (l) => {
    applyLang(l)
    set({ lang: l })
    persistPrefs()
  },
  setTheme: (t) => {
    applyTheme(t)
    set({ theme: t })
    persistPrefs()
  },
  setActiveView: (v) => set({ activeView: v }),
  setSelected: (id) => set({ selectedTaskId: id, selectedProjectId: null }),
  setSelectedProject: (id) => set({ selectedProjectId: id, selectedTaskId: null }),
  setSelectedDay: (day) => set({ selectedDay: day }),
  setViewMode: (m) => set({ viewMode: m }),
  goToday: () => set((s) => ({ focusISO: todayISO(), focusTick: s.focusTick + 1 })),
  setProjectFilter: (id) => set({ projectFilter: id }),
  // `defaultOpen` has to be passed in: tasks are expanded until told otherwise,
  // but the synthesized to-do folders are collapsed until told otherwise, so
  // "absent" means opposite things for the two.
  toggleExpanded: (id, defaultOpen = true) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: !(s.expanded[id] ?? defaultOpen) } })),
  // Tasks default to expanded when absent from the map, but the synthesized
  // folders are collapsed by default, so "expand all" must name them explicitly.
  expandAll: () =>
    set((s) => {
      const expanded: Record<string, boolean> = {}
      for (const gid of todoGroupIds(s.tasks)) expanded[gid] = true
      return { expanded }
    }),
  collapseAll: () =>
    set((s) => {
      const expanded: Record<string, boolean> = {}
      for (const t of s.tasks) if (hasChildren(s.tasks, t.id)) expanded[t.id] = false
      for (const gid of todoGroupIds(s.tasks)) expanded[gid] = false
      return { expanded }
    }),

  addProject: (name, color) => {
    const project: Project = { id: uid(), name, color, description: '' }
    set((s) => ({ projects: [...s.projects, project] }))
    return project.id
  },
  updateProject: (id, patch) =>
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  deleteProject: (id) =>
    set((s) => {
      const taskIds = new Set(s.tasks.filter((t) => t.projectId === id).map((t) => t.id))
      return {
        projects: s.projects.filter((p) => p.id !== id),
        tasks: s.tasks.filter((t) => t.projectId !== id),
        logs: s.logs.filter((l) => !taskIds.has(l.taskId)),
        projectFilter: s.projectFilter === id ? 'all' : s.projectFilter,
        selectedTaskId: null,
        selectedProjectId: null,
      }
    }),

  addTask: (input) => {
    const id = uid()
    const now = new Date().toISOString()
    set((s) => {
      const projectId = input.parentId
        ? s.tasks.find((t) => t.id === input.parentId)?.projectId ?? input.projectId
        : input.projectId
      // A to-do has no schedule, so every scheduling field is dropped rather
      // than taken from the input.
      const isTodo = input.isTodo === true
      const isLT = !isTodo && input.type === 'long-term'
      const task: Task = {
        id,
        name: input.name,
        description: input.description ?? '',
        parentId: input.parentId ?? null,
        projectId,
        type: isLT ? 'long-term' : 'phase',
        isTodo,
        startDate: isTodo ? null : input.startDate,
        endDate: isTodo || isLT ? null : input.endDate,
        strictProgress: isTodo || isLT ? false : (input.strictProgress ?? false),
        paused: false,
        pauseDate: null,
        pauses: [],
        priority: isTodo ? null : (input.priority ?? 'medium'),
        tags: input.tags ?? [],
        dependencies: input.dependencies ?? [],
        createdAt: now,
        updatedAt: now,
      }
      return { tasks: [...s.tasks, task], selectedTaskId: id }
    })
    return id
  },
  updateTask: (id, patch) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    })),
  deleteTask: (id) =>
    set((s) => {
      const ids = new Set(collectDescendants(s.tasks, id).concat(id))
      const tasks = s.tasks
        .filter((t) => !ids.has(t.id))
        .map((t) => ({ ...t, dependencies: t.dependencies.filter((d) => !ids.has(d)) }))
      const selectedTaskId = s.selectedTaskId && ids.has(s.selectedTaskId) ? null : s.selectedTaskId
      const logs = s.logs.filter((l) => !ids.has(l.taskId))
      return { tasks, logs, selectedTaskId }
    }),
  setTaskParent: (id, parentId) =>
    set((s) => {
      if (parentId && (parentId === id || collectDescendants(s.tasks, id).includes(parentId))) return {}
      return {
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, parentId, updatedAt: new Date().toISOString() } : t,
        ),
      }
    }),
  moveTask: (id, deltaUnits, unit) =>
    set((s) => {
      const task = s.tasks.find((t) => t.id === id)
      if (!task || deltaUnits === 0) return {}
      const ids = new Set(hasChildren(s.tasks, id) ? collectDescendants(s.tasks, id).concat(id) : [id])
      return {
        tasks: s.tasks.map((t) => {
          if (!ids.has(t.id)) return t
          const updatedAt = new Date().toISOString()
          if (t.type === 'long-term') {
            // Long-term goals shift their start only; the end stays unresolved.
            return t.startDate != null ? { ...t, startDate: addUnitISO(t.startDate, unit, deltaUnits), updatedAt } : t
          }
          if (t.startDate != null && t.endDate != null) {
            return {
              ...t,
              startDate: addUnitISO(t.startDate, unit, deltaUnits),
              endDate: addUnitISO(t.endDate, unit, deltaUnits),
              updatedAt,
            }
          }
          return t
        }),
      }
    }),
  resizeTask: (id, startISO, endISO) =>
    set((s) => {
      const task = s.tasks.find((t) => t.id === id)
      if (!task || task.type === 'long-term' || task.isTodo) return {}
      let sDate = startISO
      let eDate = endISO
      if (sDate > eDate) {
        const tmp = sDate
        sDate = eDate
        eDate = tmp
      }
      return {
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, startDate: sDate, endDate: eDate, updatedAt: new Date().toISOString() } : t,
        ),
      }
    }),

  addLog: (input) => {
    const id = uid()
    const now = new Date().toISOString()
    set((s) => ({
      logs: [
        ...s.logs,
        {
          id,
          taskId: input.taskId,
          date: input.date,
          content: input.content,
          targetProgress: input.targetProgress ?? null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }))
    return id
  },
  updateLog: (id, patch) =>
    set((s) => ({
      logs: s.logs.map((l) => (l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l)),
    })),
  deleteLog: (id) =>
    set((s) => ({ logs: s.logs.filter((l) => l.id !== id) })),

  pauseTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id && !t.paused
          ? { ...t, paused: true, pauseDate: todayISO(), updatedAt: new Date().toISOString() }
          : t,
      ),
    })),
  resumeTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id || !t.paused) return t
        const resumeDate = todayISO()
        const pauseDate = t.pauseDate ?? resumeDate
        const n = t.endDate != null ? Math.max(0, diffDays(toDate(pauseDate), toDate(t.endDate))) : 0
        const endDate = t.endDate != null ? toISO(addDays(toDate(resumeDate), n)) : t.endDate
        return {
          ...t,
          paused: false,
          pauseDate: null,
          endDate,
          pauses: [...t.pauses, { pauseDate, resumeDate }],
          updatedAt: new Date().toISOString(),
        }
      }),
    })),

  // Park a task as unscheduled work. Cascades to every unfinished descendant
  // (completed work is finished, and stays scheduled where it is). Written as a
  // single atomic `set` because App re-runs syncParentEnds on every `tasks`
  // identity change. Pause history and logs are deliberately kept.
  setTaskTodo: (id) =>
    set((s) => {
      const target = s.tasks.find((t) => t.id === id)
      if (!target || target.isTodo) return {}
      const ids = new Set(todoCascadeIds(s.tasks, s.logs, id))
      const now = new Date().toISOString()
      return {
        tasks: s.tasks.map((t) =>
          ids.has(t.id)
            ? {
                ...t,
                isTodo: true,
                startDate: null,
                endDate: null,
                strictProgress: false,
                priority: null,
                paused: false,
                pauseDate: null,
                updatedAt: now,
              }
            : t,
        ),
      }
    }),

  // Give one or more to-dos a schedule again. Single "Start task" and the
  // folder's bulk "Restore" both come through here.
  startTodoTasks: (entries) =>
    set((s) => {
      const byId = new Map(entries.map((e) => [e.id, e]))
      const now = new Date().toISOString()
      return {
        tasks: s.tasks.map((t) => {
          const e = byId.get(t.id)
          if (!e || !t.isTodo) return t
          let start = e.startDate
          let end = e.endDate
          if (start > end) {
            const tmp = start
            start = end
            end = tmp
          }
          return {
            ...t,
            isTodo: false,
            startDate: start,
            endDate: end,
            strictProgress: e.strictProgress,
            priority: e.priority,
            updatedAt: now,
          }
        }),
      }
    }),

  syncParentEnds: () =>
    set((s) => {
      const next = syncParentEnds(s.tasks, s.logs)
      return next === s.tasks ? {} : { tasks: next }
    }),

  importData: (data) =>
    set({ projects: data.projects, tasks: data.tasks, logs: data.logs ?? [], selectedTaskId: null, selectedProjectId: null, projectFilter: 'all' }),
}))

// Persist data (only) to localStorage whenever projects/tasks change.
useStore.subscribe((state, prev) => {
  if (state.projects !== prev.projects || state.tasks !== prev.tasks || state.logs !== prev.logs) {
    saveData({ projects: state.projects, tasks: state.tasks, logs: state.logs })
  }
})

// Keep `today` fresh across midnights so derived progress/status re-render.
setInterval(() => {
  const t = todayISO()
  if (useStore.getState().today !== t) useStore.setState({ today: t })
}, 60_000)

export function useRows(): Row[] {
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const today = useStore((s) => s.today)
  const expanded = useStore((s) => s.expanded)
  const projectFilter = useStore((s) => s.projectFilter)
  const projects = useStore((s) => s.projects)
  return useMemo(() => {
    const visible = projectFilter === 'all' ? tasks : tasks.filter((t) => t.projectId === projectFilter)
    return buildRows(visible, expanded, projects, logs)
  }, [tasks, logs, today, expanded, projectFilter, projects])
}

/**
 * The stretch of time the Gantt's axis covers, for the project in view.
 *
 * Deliberately not derived from `useRows()`: `buildRows` honours `expanded`, so
 * collapsing a parent would move the right edge of the axis.
 */
export function useTimelineRange(mode: ViewMode, canvasWidth: number): DateRange {
  const tasks = useStore((s) => s.tasks)
  const today = useStore((s) => s.today)
  const projectFilter = useStore((s) => s.projectFilter)
  return useMemo(() => {
    const visible = projectFilter === 'all' ? tasks : tasks.filter((t) => t.projectId === projectFilter)
    return timelineRange(mode, visible, today, canvasWidth)
  }, [mode, tasks, today, projectFilter, canvasWidth])
}

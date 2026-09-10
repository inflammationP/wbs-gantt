import { useMemo } from 'react'
import { create } from 'zustand'
import { AppView, Project, Task, TaskPriority, TaskStatus, TaskType, ViewMode } from '../types'
import { todayISO, addUnitISO, Unit } from '../lib/dates'
import { shiftAnchor } from '../lib/timeline'
import { buildRows, collectDescendants, hasChildren, syncParentEnds, Row } from '../lib/tree'
import { loadData, saveData, PersistedData } from './storage'
import { buildSeed } from '../lib/seed'

export interface NewTaskInput {
  name: string
  description?: string
  parentId?: string | null
  projectId: string
  type?: TaskType
  startDate: string | null
  endDate: string | null
  progress?: number
  status?: TaskStatus
  priority?: TaskPriority
  tags?: string[]
  dependencies?: string[]
}

interface State {
  projects: Project[]
  tasks: Task[]
  activeView: AppView
  selectedTaskId: string | null
  selectedProjectId: string | null
  viewMode: ViewMode
  anchorISO: string
  expanded: Record<string, boolean>
  projectFilter: string

  setActiveView: (v: AppView) => void
  setSelected: (id: string | null) => void
  setSelectedProject: (id: string | null) => void
  setViewMode: (m: ViewMode) => void
  goPrev: () => void
  goNext: () => void
  goToday: () => void
  setProjectFilter: (id: string) => void
  toggleExpanded: (id: string) => void
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
if (!loaded) saveData({ projects: initial.projects, tasks: initial.tasks })

export const useStore = create<State>()((set) => ({
  projects: initial.projects,
  tasks: initial.tasks,
  activeView: 'gantt',
  selectedTaskId: null,
  selectedProjectId: null,
  viewMode: 'day',
  anchorISO: todayISO(),
  expanded: {},
  projectFilter: 'all',

  setActiveView: (v) => set({ activeView: v }),
  setSelected: (id) => set({ selectedTaskId: id, selectedProjectId: null }),
  setSelectedProject: (id) => set({ selectedProjectId: id, selectedTaskId: null }),
  setViewMode: (m) => set({ viewMode: m }),
  goPrev: () => set((s) => ({ anchorISO: shiftAnchor(s.viewMode, s.anchorISO, -1) })),
  goNext: () => set((s) => ({ anchorISO: shiftAnchor(s.viewMode, s.anchorISO, 1) })),
  goToday: () => set({ anchorISO: todayISO() }),
  setProjectFilter: (id) => set({ projectFilter: id }),
  toggleExpanded: (id) =>
    set((s) => ({ expanded: { ...s.expanded, [id]: s.expanded[id] === false ? true : false } })),
  expandAll: () => set({ expanded: {} }),
  collapseAll: () =>
    set((s) => {
      const expanded: Record<string, boolean> = {}
      for (const t of s.tasks) if (hasChildren(s.tasks, t.id)) expanded[t.id] = false
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
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tasks: s.tasks.filter((t) => t.projectId !== id),
      projectFilter: s.projectFilter === id ? 'all' : s.projectFilter,
      selectedTaskId: null,
      selectedProjectId: null,
    })),

  addTask: (input) => {
    const id = uid()
    const now = new Date().toISOString()
    set((s) => {
      const projectId = input.parentId
        ? s.tasks.find((t) => t.id === input.parentId)?.projectId ?? input.projectId
        : input.projectId
      const isLT = input.type === 'long-term'
      const task: Task = {
        id,
        name: input.name,
        description: input.description ?? '',
        parentId: input.parentId ?? null,
        projectId,
        type: isLT ? 'long-term' : 'phase',
        startDate: input.startDate,
        endDate: isLT ? null : input.endDate,
        progress: Math.max(0, Math.min(100, input.progress ?? 0)),
        status: input.status ?? 'not-started',
        priority: input.priority ?? 'medium',
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
      return { tasks, selectedTaskId }
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
      if (!task || task.type === 'long-term') return {}
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

  syncParentEnds: () =>
    set((s) => {
      const next = syncParentEnds(s.tasks)
      return next === s.tasks ? {} : { tasks: next }
    }),

  importData: (data) =>
    set({ projects: data.projects, tasks: data.tasks, selectedTaskId: null, selectedProjectId: null, projectFilter: 'all' }),
}))

// Persist data (only) to localStorage whenever projects/tasks change.
useStore.subscribe((state, prev) => {
  if (state.projects !== prev.projects || state.tasks !== prev.tasks) {
    saveData({ projects: state.projects, tasks: state.tasks })
  }
})

export function useRows(): Row[] {
  const tasks = useStore((s) => s.tasks)
  const expanded = useStore((s) => s.expanded)
  const projectFilter = useStore((s) => s.projectFilter)
  const projects = useStore((s) => s.projects)
  return useMemo(() => {
    const visible = projectFilter === 'all' ? tasks : tasks.filter((t) => t.projectId === projectFilter)
    return buildRows(visible, expanded, projects)
  }, [tasks, expanded, projectFilter, projects])
}

import { useMemo } from 'react'
import { create } from 'zustand'
import { AppView, Chore, Habit, Project, Task, TaskLog, TaskPriority, TaskType, ViewMode } from '../types'
import { ALL_DAYS, runsOn } from '../lib/habits'
import { todayISO, addUnitISO, Unit, addDays, diffDays, toDate, toISO } from '../lib/dates'
import { timelineRange, DateRange } from '../lib/timeline'
import { buildRows, collectDescendants, hasChildren, syncParentEnds, todoCascadeIds, todoGroupIds, Row } from '../lib/tree'
import { loadData, saveData, loadPrefs, savePrefs, PersistedData, Prefs } from './storage'
import { editDivider } from '../lib/logs'
import { applyLang, Lang } from '../lib/i18n'
import { applyTheme, ThemeId } from '../lib/theme'
import { buildSeed } from '../lib/seed'
import { checkForUpdate, isTauri, CheckResult } from '../lib/updater'

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

/** How long without reaching GitHub before the nag appears, and its throttle. */
const NAG_AFTER_DAYS = 30

/**
 * How long the dialog's "ignore for now" button silences the update prompt.
 *
 * Exported so the button can name the span it is offering — a button reading
 * "ignore for a while" would make the user guess how long.
 */
export const SNOOZE_DAYS = 7

/**
 * Where the update check stands.
 *
 * `unreachable` is the one that carries news: to a user behind a blocked
 * network it is the normal outcome of every launch, not an error state.
 */
export type UpdatePhase = 'idle' | 'checking' | 'current' | 'available' | 'unreachable' | 'unsupported'

/** The `available` variant, kept whole so the dialog can call `install`. */
export type AvailableUpdate = Extract<CheckResult, { kind: 'available' }>

interface State {
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
  // Chores and habits live outside the three above on purpose — see `Chore` and
  // `Habit` in types.ts.
  chores: Chore[]
  habits: Habit[]
  activeView: AppView
  // Bumped by `openGantt` and used as the Gantt page's React key, so clicking
  // the nav item remounts it rather than reusing the mounted one.
  ganttKey: number
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
  // Persisted alongside lang/theme — see `Prefs` in store/storage.ts for why the
  // guide's state lives with the preferences rather than with the work data.
  guideDismissed: boolean
  guideDone: string[]
  /**
   * The to-do note in the task dialog has been acknowledged. A preference, not
   * view state: it survives a reload, and it is not part of an imported board.
   */
  todoNoteDismissed: boolean
  // Update state. Session-only: it describes the check that just ran. The three
  // durable facts — the 30-day anchor, the nag throttle, the dismissal — are
  // preferences and live in `Prefs`.
  updatePhase: UpdatePhase
  updateInfo: AvailableUpdate | null
  updateInstalling: boolean
  /** Why the install failed, if it did. */
  updateError: string | null
  nagOpen: boolean
  // The persisted half, mirrored into state so components can read it directly.
  updateAnchorAt: string | null
  nagShownAt: string | null
  updateSnoozeUntil: string | null

  setLang: (l: Lang) => void
  setTheme: (t: ThemeId) => void
  setActiveView: (v: AppView) => void
  openGantt: () => void
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
  toggleTaskDay: (id: string, day: string) => void

  addChore: (title: string, date: string) => void
  updateChore: (id: string, patch: Partial<Chore>) => void
  toggleChore: (id: string) => void
  deleteChore: (id: string) => void

  /**
   * `init` carries what the editor can also set; the quick path passes a title
   * and nothing else. Read field by field rather than spread, so a new habit
   * cannot be born paused or pre-ticked by a caller that happened to have a
   * whole `Habit` lying around.
   */
  addHabit: (title: string, init?: { note?: string; weekdays?: number[]; endDate?: string | null }) => void
  updateHabit: (id: string, patch: Partial<Habit>) => void
  /** No day argument on purpose — see the implementation. */
  toggleHabit: (id: string) => void
  deleteHabit: (id: string) => void

  syncParentEnds: () => void

  importData: (data: PersistedData) => void

  dismissGuide: () => void
  showGuide: () => void
  dismissTodoNote: () => void
  markGuideDone: (stepId: string) => void

  runUpdateCheck: () => Promise<void>
  installUpdate: () => Promise<void>
  closeUpdateDialog: () => void
  snoozeUpdate: () => void
  closeNag: () => void
}

function uid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const loaded = loadData()
const initial = loaded ?? buildSeed()
if (!loaded) {
  saveData({
    projects: initial.projects,
    tasks: initial.tasks,
    logs: initial.logs,
    chores: initial.chores,
    habits: initial.habits,
  })
}

const loadedPrefs = loadPrefs()
// Heal a missing update anchor exactly once, and write it back.
//
// Stamping a fresh "now" on every launch instead would restart the 30-day clock
// forever for any blob that has no anchor — precisely the user who can never
// reach GitHub, and so the one the nag exists for. A new object rather than a
// mutation: `loadPrefs` returns `DEFAULT_PREFS` itself on two of its paths, and
// that object is shared.
const prefs: Prefs =
  loadedPrefs.updateAnchorAt === null
    ? { ...loadedPrefs, updateAnchorAt: new Date().toISOString() }
    : loadedPrefs
if (prefs !== loadedPrefs) savePrefs(prefs)

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
  // Rebuilt field by field rather than spread off state, which is why every new
  // preference has to be named here. That is enforced rather than remembered:
  // `savePrefs` demands the full `Prefs` type, so forgetting one is a compile
  // error — as long as the field is declared required and not optional.
  const {
    lang,
    theme,
    guideDismissed,
    guideDone,
    todoNoteDismissed,
    updateAnchorAt,
    nagShownAt,
    updateSnoozeUntil,
  } = useStore.getState()
  savePrefs({
    lang,
    theme,
    guideDismissed,
    guideDone,
    todoNoteDismissed,
    updateAnchorAt,
    nagShownAt,
    updateSnoozeUntil,
  })
}

/** Is a snooze currently running? */
function isSnoozed(): boolean {
  const { updateSnoozeUntil } = useStore.getState()
  return updateSnoozeUntil !== null && Date.parse(updateSnoozeUntil) > Date.now()
}

/**
 * Show the "it has been a while" nag, if the clock says so.
 *
 * Evaluated at the tail of *every* failed check, whichever button started it.
 * It states a fact about the anchor — "we have not reached GitHub in over a
 * month" — and that fact does not depend on who asked, so making it depend on
 * the caller would be the one way left for an automatic check to behave
 * differently from a manual one. A successful check has just moved the anchor
 * to now, so the condition is false by construction; and a user who cannot
 * reach GitHub keeps their stale anchor, so they are nagged even though the
 * notice on the settings page already explained why.
 *
 * `new Date(iso)`, not `toDate(iso)`: `toDate` splits on '-' and expects
 * 'yyyy-MM-dd', so a full instant would parse as the 1st of the month.
 */
function maybeNag(): void {
  if (!isTauri()) return
  const { updateAnchorAt, nagShownAt } = useStore.getState()
  if (updateAnchorAt === null) return

  const now = new Date()
  if (diffDays(new Date(updateAnchorAt), now) < NAG_AFTER_DAYS) return
  if (nagShownAt !== null && diffDays(new Date(nagShownAt), now) < NAG_AFTER_DAYS) return

  // Stamped on display rather than on dismissal: a user who kills the app with
  // the modal still open never dismisses it, and would otherwise be nagged on
  // every single launch.
  useStore.setState({ nagOpen: true, nagShownAt: now.toISOString() })
  persistPrefs()
}

export const useStore = create<State>()((set, get) => ({
  projects: initial.projects,
  tasks: initial.tasks,
  logs: initial.logs,
  chores: initial.chores,
  habits: initial.habits,
  activeView: 'gantt',
  ganttKey: 0,
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
  guideDismissed: prefs.guideDismissed,
  guideDone: prefs.guideDone,
  todoNoteDismissed: prefs.todoNoteDismissed,
  updatePhase: 'idle',
  updateInfo: null,
  updateInstalling: false,
  updateError: null,
  nagOpen: false,
  updateAnchorAt: prefs.updateAnchorAt,
  nagShownAt: prefs.nagShownAt,
  updateSnoozeUntil: prefs.updateSnoozeUntil,

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
  // The nav's Gantt item is a way back to the board, not a way to resume the
  // project you last narrowed to: it lands on the whole thing, every time —
  // while the project rows below it (and "Open in Gantt" elsewhere) still filter.
  openGantt: () =>
    set((s) => ({
      activeView: 'gantt',
      projectFilter: 'all',
      selectedProjectId: null,
      ganttKey: s.ganttKey + 1,
    })),
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
        confirmedDays: [],
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

  /**
   * Write a log — or add to the one this task already has for that day.
   *
   * A day is one entry, not a stack of them. Coming back to a task you already
   * wrote up today used to leave two rows wearing the same date, which then read
   * as two days' work in the history, counted twice wherever a day is counted,
   * and left "which of these is today's number" to the order they happened to be
   * added in. The new text is appended to the entry that is already there and
   * the fresh target replaces the old one, because it is the later statement of
   * the same day.
   *
   * Merging here rather than in the dialog: this is the only door a log comes
   * through, so the overdue "mark as completed" path gets it too.
   */
  addLog: (input) => {
    const now = new Date().toISOString()
    const existing = get().logs.find((l) => l.taskId === input.taskId && l.date === input.date)
    if (existing) {
      set((s) => ({
        logs: s.logs.map((l) =>
          l.id === existing.id
            ? {
                ...l,
                content: `${l.content}\n${editDivider(new Date())}\n${input.content}`,
                // A null says nothing, so it must not wipe a number an earlier
                // write for the day put there.
                targetProgress: input.targetProgress ?? l.targetProgress,
                updatedAt: now,
              }
            : l,
        ),
      }))
      return existing.id
    }

    const id = uid()
    set((s) => ({
      logs: [
        ...s.logs,
        {
          id,
          taskId: input.taskId,
          date: input.date,
          // The first write is stamped like every later one, so the rule reads
          // as "each write is preceded by its time" rather than "each write
          // *after the first*" — and so a day's entry always opens with when it
          // was written, not just where it was added to.
          content: `${editDivider(new Date())}\n${input.content}`,
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

  addChore: (title, date) => {
    const now = new Date().toISOString()
    set((s) => ({
      chores: [
        ...s.chores,
        { id: uid(), title, note: '', date, done: false, completedDate: null, createdAt: now, updatedAt: now },
      ],
    }))
  },
  updateChore: (id, patch) =>
    set((s) => ({
      chores: s.chores.map((c) =>
        c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
      ),
    })),
  // The one write a simplified task's progress ever gets: this day happened, or
  // it didn't. A day can be ticked after the fact — that is how a missed one is
  // backfilled from the day panel — but nothing here takes a number.
  toggleTaskDay: (id, day) =>
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t
        const days = t.confirmedDays ?? []
        return {
          ...t,
          confirmedDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
          updatedAt: new Date().toISOString(),
        }
      }),
    })),

  toggleChore: (id) =>
    set((s) => ({
      chores: s.chores.map((c) => {
        if (c.id !== id) return c
        const done = !c.done
        // `completedDate` moves with the flag in both directions. It is what the
        // heatmap counts, so an uncheck that left it behind would keep a day
        // credited for work that was put back.
        return { ...c, done, completedDate: done ? todayISO() : null, updatedAt: new Date().toISOString() }
      }),
    })),
  deleteChore: (id) => set((s) => ({ chores: s.chores.filter((c) => c.id !== id) })),

  addHabit: (title, init) => {
    const now = new Date().toISOString()
    set((s) => ({
      habits: [
        ...s.habits,
        {
          id: uid(),
          title,
          note: init?.note ?? '',
          startDate: todayISO(),
          endDate: init?.endDate ?? null,
          // A habit is born running every day, and the editor is what narrows
          // it. `addHabit` is also the Today column's quick path — a title and
          // Enter — where there is nothing to narrow it with.
          weekdays: init?.weekdays?.length ? init.weekdays : [...ALL_DAYS],
          paused: false,
          pauseDate: null,
          pauses: [],
          doneDays: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    }))
  },
  // Patch-style rather than one action per field, for the reason `updateChore`
  // is: the editor writes title, note, weekdays and end date together, and a
  // setter apiece would be four chances for one of them to be forgotten.
  updateHabit: (id, patch) =>
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h,
      ),
    })),
  // Suspending and resuming are `lib/habits.ts`'s `pausePatch` rather than two
  // actions here: they are edited in the same dialog as the name and the days,
  // and an action that fired on the switch would take effect whether or not the
  // edit was saved. Note that neither direction moves `endDate`, which is where
  // this parts company with `resumeTask` — a task's end date is pushed out by
  // the length of the pause because a task has progress and a window that shrank
  // could never reach 100%. A habit has no progress, and its end date is a
  // calendar fact ("到这天为止") rather than a budget of days to be spent.
  //
  // The day being ticked is never an argument, and that is the feature: a habit
  // can only be ticked for the day that is happening. Backfilling a missed day
  // is not something this refuses to do — it is something it cannot express, so
  // no caller can come along later and pass a date in. `todayISO()` is read here
  // rather than closed over so that an app left open across midnight ticks the
  // new day, which is what the clock on the wall says.
  toggleHabit: (id) =>
    set((s) => ({
      habits: s.habits.map((h) => {
        if (h.id !== id) return h
        const day = todayISO()
        // A tick on a day the habit does not run is a fact the data should never
        // learn — an ended habit, a Tuesday of a Mon/Wed/Fri one, a suspended
        // one. `habitsOn` already keeps those off the list, so nothing in the UI
        // can reach this branch; the guard is what keeps that from being the
        // only thing standing between the two, and it asks the same function
        // that decides what to show.
        if (!runsOn(h, day)) return h
        return {
          ...h,
          // Ticked days are kept in the order they were ticked. Nothing reads
          // that order — the heatmap tests membership and `tickedOn` does too —
          // so there is no reason to sort a list that only ever grows at the end.
          doneDays: h.doneDays.includes(day) ? h.doneDays.filter((d) => d !== day) : [...h.doneDays, day],
          updatedAt: new Date().toISOString(),
        }
      }),
    })),
  deleteHabit: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

  syncParentEnds: () =>
    set((s) => {
      const next = syncParentEnds(s.tasks, s.logs)
      return next === s.tasks ? {} : { tasks: next }
    }),

  importData: (data) =>
    set({
      projects: data.projects,
      tasks: data.tasks,
      logs: data.logs ?? [],
      chores: data.chores ?? [],
      habits: data.habits ?? [],
      selectedTaskId: null,
      selectedProjectId: null,
      projectFilter: 'all',
    }),

  dismissGuide: () => {
    set({ guideDismissed: true })
    persistPrefs()
  },
  showGuide: () => {
    set({ guideDismissed: false })
    persistPrefs()
  },
  // One way, unlike the guide's pair: the note is an explanation, and a way to
  // ask for it back would be a setting nobody would ever find.
  dismissTodoNote: () => {
    set({ todoNoteDismissed: true })
    persistPrefs()
  },
  markGuideDone: (stepId) => {
    // Guarded both ways: re-opened dialogs and revisited pages are the same
    // milestone twice, and the list is what the guide counts.
    if (useStore.getState().guideDone.includes(stepId)) return
    set((s) => ({ guideDone: [...s.guideDone, stepId] }))
    persistPrefs()
  },

  // Takes no argument on purpose. The launch check *is* a manual check fired on
  // the app's behalf, so anything that varied the outcome by who asked would be
  // a difference the user could see — and the two are meant to be
  // indistinguishable right down to the prompt.
  runUpdateCheck: async () => {
    // Doubles as the double-click guard and as StrictMode's: the launch effect
    // fires twice in development, and a second check while one is in flight is
    // never what anyone wanted.
    if (useStore.getState().updatePhase === 'checking') return
    set({ updatePhase: 'checking', updateError: null })

    const result = await checkForUpdate()

    if (result.kind === 'unsupported') {
      set({ updatePhase: 'unsupported' })
      return
    }

    if (result.kind === 'error') {
      set({ updatePhase: 'unreachable' })
      maybeNag()
      return
    }

    // Reaching GitHub is the event the 30-day clock measures, whichever answer
    // it gave. Recorded before anything else can go wrong.
    const anchorAt = new Date().toISOString()

    if (result.kind === 'current') {
      set({ updatePhase: 'current', updateAnchorAt: anchorAt, updateInfo: null })
      persistPrefs()
      return
    }

    set({ updatePhase: 'available', updateAnchorAt: anchorAt })
    persistPrefs()

    // Never install unasked. An app that restarts itself under the user's
    // cursor is not a courtesy, and the release notes are worth reading *before*
    // the decision rather than after the restart — which is what the dialog is
    // for. The cost is a prompt on every launch until the update is taken; that
    // is the trade being made.
    //
    // A running snooze suppresses the dialog only. The phase still becomes
    // `available`, so the settings page keeps reporting that an update exists —
    // silencing the prompt must never amount to hiding the update.
    const snoozed = isSnoozed()
    if (!snoozed) set({ updateInfo: result })
  },

  installUpdate: async () => {
    const info = useStore.getState().updateInfo
    if (!info) return
    // Stamp the anchor before installing: on Windows the installer exits the
    // process, so anything written after this point may never land.
    set({ updateInstalling: true, updateError: null, updateAnchorAt: new Date().toISOString() })
    persistPrefs()
    try {
      await info.install()
    } catch (err) {
      set({
        updateInstalling: false,
        updateError: err instanceof Error ? err.message : String(err),
      })
    }
  },

  closeUpdateDialog: () => {
    const info = useStore.getState().updateInfo
    set({ updateInfo: null, updateInstalling: false, updateError: null })
    // Release the Tauri resource. Nothing is lost: checking again re-fetches it.
    void info?.dismiss()
  },

  snoozeUpdate: () => {
    const info = useStore.getState().updateInfo
    set({
      updateInfo: null,
      updateInstalling: false,
      updateError: null,
      updateSnoozeUntil: addDays(new Date(), SNOOZE_DAYS).toISOString(),
    })
    persistPrefs()
    void info?.dismiss()
  },

  closeNag: () => set({ nagOpen: false }),
}))

// Persist data (only) to localStorage whenever projects/tasks/logs/chores/habits
// change.
useStore.subscribe((state, prev) => {
  if (
    state.projects !== prev.projects ||
    state.tasks !== prev.tasks ||
    state.logs !== prev.logs ||
    state.chores !== prev.chores ||
    state.habits !== prev.habits
  ) {
    saveData({
      projects: state.projects,
      tasks: state.tasks,
      logs: state.logs,
      chores: state.chores,
      habits: state.habits,
    })
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

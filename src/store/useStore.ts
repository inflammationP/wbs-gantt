import { useMemo } from 'react'
import { create } from 'zustand'
import { AppView, Chore, Habit, Note, Project, Task, TaskLog, TaskPriority, TaskType, ViewMode } from '../types'
import { ALL_DAYS, runsOn } from '../lib/habits'
import { todayISO, addDays, diffDays, pad, toDate, toISO } from '../lib/dates'
import { timelineRange, DateRange } from '../lib/timeline'
import {
  archiveCascade,
  archiveGroupId,
  archivedRoots,
  buildRows,
  collectDescendants,
  hasChildren,
  isArchived,
  liveTasks,
  placeTasks,
  syncParentDates,
  todoCascadeIds,
  todoGroupIds,
  projectRowId,
  Row,
} from '../lib/tree'
import { loadData, saveData, loadPrefs, savePrefs, PersistedData, Prefs } from './storage'
import { logStamp, restamp } from '../lib/logs'
import { applyLang, Lang, translate } from '../lib/i18n'
import { applyTheme, ThemeId } from '../lib/theme'
import { buildSeed } from '../lib/seed'
import { checkForUpdate, isTauri, CheckResult } from '../lib/updater'
import {
  CopyKey,
  CopyOverrides,
  DigestCategory,
  ReminderRule,
  Slot,
  composeDigest,
  slotAt,
  testDigest,
} from '../lib/reminder'
import {
  sendReminder,
  syncReminderFile,
  installReminderTask as installTask,
  removeReminderTask as removeTask,
  isReminderTaskInstalled,
  setAutostart as enableAutostart,
  isAutostartEnabled,
  showToast,
  SendResult,
} from '../lib/notify'

export interface NewTaskInput {
  name: string
  description?: string
  parentId?: string | null
  projectId: string
  /** null creates a to-do with no type — see `Task.type`. */
  type?: TaskType | null
  isTodo?: boolean
  startDate: string | null
  endDate: string | null
  strictProgress?: boolean
  priority?: TaskPriority
  tags?: string[]
  dependencies?: string[]
}

/**
 * The last rearrangement, kept so a wrong one can be put back exactly.
 *
 * One step, and only ever one: whatever just happened, offered while it is still
 * the thing that just happened, and gone after that. Deliberately not a stack —
 * a history of every edit is a different feature with a different interface, and
 * this is the answer to a specific moment (the row landed somewhere and the
 * damage is not obvious yet).
 *
 * What is kept is the *previous value of the fields the step wrote*, per task it
 * touched — not a snapshot of the whole board. A board snapshot would put back
 * anything else done in the meantime, which for a drag means resurrecting a task
 * deleted since: a row that is gone is simply not there to patch, and a row that
 * was renamed keeps the new name.
 *
 * A delete is the exception, and has to be: the row *is* the thing that went, so
 * `removedTasks` and `removedLogs` hold what was taken and put it back. That is
 * the one step that cannot be expressed as a patch on rows that are still there.
 *
 * The derived dates are not in here. Putting the structure back is enough —
 * `syncParentDates` recomputes the same span from the same children on the next
 * frame, which is where it came from.
 */
export interface UndoStep {
  /**
   * What the strip prints before its button, already in the reader's language —
   * "Moved A", "Paused 3 tasks". Spelled out when the step is recorded rather
   * than when it is read: the offer stands for a few seconds, and a language
   * switched inside those seconds is not worth a second translation of
   * something already read.
   */
  message: string
  /** The fields each touched task had before the step, merged back over it. */
  patches: { id: string; patch: Partial<Task> }[]
  /** Rows the step removed outright, with everything hanging under them. */
  removedTasks: Task[]
  removedLogs: TaskLog[]
}

// The schedule a to-do is given when it is started (or restored in bulk).
export interface StartTodoInput {
  id: string
  startDate: string
  endDate: string
  /**
   * What the to-do turns out to be, asked here because this is the first moment
   * the question has an answer — see the note on `Task.type`.
   */
  type: TaskType
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

/**
 * Where a manual test send has got to.
 *
 * Session-only, like `UpdatePhase` and for the same reason: it describes the
 * send that just happened. The durable facts — whether reminders are on, when
 * they go out, and the token — are preferences.
 */
export type ReminderPhase = 'idle' | 'sending' | 'sent' | 'error' | 'unsupported'

interface State {
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
  // Chores, habits and notes live outside the three above on purpose — see
  // `Chore`, `Habit` and `Note` in types.ts.
  chores: Chore[]
  habits: Habit[]
  notes: Note[]
  /** What the user calls each to-do folder, by `todoGroupId` — see `storage.ts`. */
  todoFolders: Record<string, string>
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
  // The WeChat digest. `reminderPhase` is session-only like `updatePhase`: it
  // describes the send that just happened, not a durable fact.
  reminderWechat: boolean
  reminderRules: ReminderRule[]
  reminderTopics: DigestCategory[]
  reminderLeadDays: number
  reminderCopy: Partial<Record<Lang, CopyOverrides>>
  reportSeenDay: string | null
  reminderToken: string
  autostart: boolean
  reminderPhase: ReminderPhase
  reminderError: string | null
  /** Whether Windows currently has the scheduled task. Asked, never remembered. */
  reminderTaskInstalled: boolean

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
  /**
   * Where a drag lands: put these tasks in that place in the tree.
   *
   * One action for both halves of the gesture, because they are one gesture —
   * "reorder among siblings" and "move into another branch" differ only in
   * whether `parentId` changed, and a caller that had to pick between them would
   * have to work out which it was holding. See the implementation for what
   * "place" costs.
   */
  moveTasks: (ids: string[], parentId: string | null, beforeId: string | null, projectId: string) => void
  /**
   * Run a set of edits as one step that can be taken back.
   *
   * `run` is a batch of ordinary actions — a drag's `moveTasks`, or the loop a
   * bulk button runs — and what gets recorded is whatever the tasks array looks
   * like afterwards. Reading the difference rather than asking each action to
   * describe itself is what lets one step cover a move, a pause, a park and a
   * delete without four sets of bookkeeping drifting apart.
   */
  withUndo: (message: string, run: () => void) => void
  /** The last step, or null. Read by the Gantt's "did X · undo" strip. */
  lastUndo: UndoStep | null
  undoLast: () => void
  /** Dismiss the offer without using it — the strip's own timeout, or leaving. */
  clearUndo: () => void

  addLog: (input: { taskId: string; date: string; content: string; targetProgress?: number | null }) => string
  updateLog: (id: string, patch: { date?: string; content?: string; targetProgress?: number | null }) => void
  deleteLog: (id: string) => void

  pauseTask: (id: string) => void
  resumeTask: (id: string) => void

  setTaskTodo: (id: string) => void
  startTodoTasks: (entries: StartTodoInput[]) => void
  toggleTaskDay: (id: string, day: string) => void

  /**
   * File these branches away, and bring them back.
   *
   * Both take the **whole branch** — see `archiveCascade`. The cascade lives
   * here rather than in the four callers (the row's button, the menu, the
   * selection bar, Manage) because four places expanding a set the same way is
   * four places to forget, and the failure of forgetting is silent: a live child
   * under a filed-away parent is a task no screen draws.
   */
  archiveTasks: (ids: string[]) => void
  unarchiveTasks: (ids: string[]) => void

  addChore: (title: string, date: string) => void
  updateChore: (id: string, patch: Partial<Chore>) => void
  toggleChore: (id: string) => void
  /** Name a to-do folder, or clear the name by passing a blank one. */
  setTodoFolderName: (groupId: string, name: string) => void
  deleteChore: (id: string) => void

  /**
   * Write a day's notebook. One action, because a day holds one box — see
   * `Note` in types.ts.
   *
   * An empty body deletes the note rather than storing a blank one: the store
   * shape has no way to tell "nothing written" from "written and cleared", and
   * inventing one would put an empty note on every day the user ever opened.
   * Writing the same text back is a no-op, which is what keeps a blur that
   * changed nothing from bumping `updatedAt` and writing the board to disk.
   */
  setNote: (date: string, body: string) => void

  /**
   * Add a paragraph to a day, keeping whatever is already written there.
   *
   * The other half of `setNote`, and the two are not interchangeable: an edit
   * replaces the box's contents, while this puts text *into* it. That is what
   * makes "write something" a thing you can do on a day you have already
   * written on without standing in front of the whole of it.
   *
   * Joined with a blank line, the same join `collapseNotes` makes when it folds
   * an older blob down. No clock, no divider, nothing that marks one write off
   * from the next — a day is one box, and where the paragraphs break is the
   * only structure it has.
   */
  appendNote: (date: string, body: string) => void

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

  syncParentDates: () => void

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

  setReminderWechat: (on: boolean) => void
  setReminderRules: (rules: ReminderRule[]) => void
  setReminderTopic: (category: DigestCategory, on: boolean) => void
  setReminderLeadDays: (days: number) => void
  setCopyOverride: (key: CopyKey, text: string) => void
  /** Mark the day report read. Clears the sidebar mark until tomorrow. */
  markReportSeen: () => void
  setReminderToken: (token: string) => void
  installReminderTask: () => Promise<void>
  removeReminderTask: () => Promise<void>
  refreshReminderTask: () => Promise<void>
  setAutostart: (on: boolean) => Promise<void>
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
    notes: initial.notes,
    todoFolders: initial.todoFolders,
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
    reminderWechat,
    reminderRules,
    reminderTopics,
    reminderLeadDays,
    reminderCopy,
    reportSeenDay,
    reminderToken,
    autostart,
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
    reminderWechat,
    reminderRules,
    reminderTopics,
    reminderLeadDays,
    reminderCopy,
    reportSeenDay,
    reminderToken,
    autostart,
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
  notes: initial.notes,
  todoFolders: initial.todoFolders,
  lastUndo: null,
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
  reminderWechat: prefs.reminderWechat,
  reminderRules: prefs.reminderRules,
  reminderTopics: prefs.reminderTopics,
  reminderLeadDays: prefs.reminderLeadDays,
  reminderCopy: prefs.reminderCopy,
  reportSeenDay: prefs.reportSeenDay,
  reminderToken: prefs.reminderToken,
  autostart: prefs.autostart,
  reminderPhase: 'idle',
  reminderError: null,
  reminderTaskInstalled: false,

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
      // The archive group is a synthesized row like the folders, and is not
      // discoverable by walking tasks — its key is a constant. Spelled through
      // the imported name rather than written out here, for the reason
      // `todoGroupId` gives: two spellings of one key is how they come apart.
      if (archivedRoots(s.tasks).length > 0) expanded[archiveGroupId] = true
      return { expanded }
    }),
  collapseAll: () =>
    set((s) => {
      const expanded: Record<string, boolean> = {}
      for (const t of s.tasks) if (hasChildren(s.tasks, t.id)) expanded[t.id] = false
      for (const gid of todoGroupIds(s.tasks)) expanded[gid] = false
      expanded[archiveGroupId] = false
      // Project lines fold too, which is what makes this button mean "show me
      // the projects" rather than "show me the projects, still open". Named
      // explicitly like the folders above, because they are expanded by default
      // and an absent key is what "expanded" looks like.
      for (const p of s.projects) expanded[projectRowId(p.id)] = false
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
      // The requested parent, unless it is filed away — an archived task is not
      // on the board, so a task placed inside it would be one nothing draws. The
      // dialog's parent picker does not offer one either; this is the belt to
      // that pair of braces, and the reason it is here rather than only there is
      // that a `parentId` can also arrive from a row's own "+".
      const asked = input.parentId ? s.tasks.find((t) => t.id === input.parentId) : undefined
      const parent = asked && !isArchived(asked) ? asked : undefined
      const projectId = parent?.projectId ?? input.projectId
      // A to-do has no schedule, so every scheduling field is dropped rather
      // than taken from the input.
      const isTodo = input.isTodo === true
      const isLT = !isTodo && input.type === 'long-term'
      const parentId = parent?.id ?? null
      // The sibling group this lands in, and where in it. A group the user has
      // arranged keeps its arrangement: appending is what "the new task is at
      // the bottom of this branch" means once they have said where things go.
      // A group nobody has dragged has no `order` anywhere, and writing one here
      // would be the first — which would freeze a date sort that is still doing
      // its job.
      // The project is part of the test, not decoration: every root-level task
      // in every project shares `parentId === null`, so without it a new top
      // level task would be appended by the order of whichever project happens
      // to be furthest along.
      const kin = s.tasks.filter((t) => t.parentId === parentId && t.projectId === projectId)
      const ordered = kin.some((t) => t.order != null)
      const order = ordered ? Math.max(...kin.map((t) => t.order ?? -1)) + 1 : undefined
      const task: Task = {
        id,
        name: input.name,
        description: input.description ?? '',
        parentId,
        projectId,
        // A to-do is created without one. Falling through to the 'phase' this
        // line used to write for everything would put a type on the task that
        // the panel then reported back as if it had been chosen.
        type: isTodo ? null : isLT ? 'long-term' : 'phase',
        isTodo,
        startDate: isTodo ? null : input.startDate,
        endDate: isTodo || isLT ? null : input.endDate,
        strictProgress: isTodo || isLT ? false : (input.strictProgress ?? false),
        confirmedDays: [],
        paused: false,
        pauseDate: null,
        pauses: [],
        priority: isTodo ? null : (input.priority ?? 'medium'),
        order,
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
  /**
   * Put a set of tasks at one place in the tree — the drop, once it has
   * happened.
   *
   * The rearrangement itself is `placeTasks` in `lib/tree.ts`, which is pure and
   * which the Gantt's drag preview also calls: what the rows show while the
   * pointer is down is produced by the same function that produces what they
   * become here, so the preview cannot show one arrangement and commit another.
   *
   * What is left for this action is the two things a preview must not do —
   * stamping `updatedAt`, and leaving a record of where everything was.
   *
   * One `set`, because App re-runs the parent-date sync on every `tasks`
   * identity change: a half-applied move would be read once, and the derived
   * dates of two branches would be computed from a tree that never existed.
   */
  moveTasks: (ids, parentId, beforeId, projectId) =>
    set((s) => {
      const next = placeTasks(s.tasks, ids, parentId, beforeId, projectId)
      if (!next) return {}

      // Read off the two arrays rather than off the internals of `placeTasks`:
      // the rows are one-to-one and in order, so anything that differs is
      // something the move wrote, and that is exactly the set to record.
      const patches: UndoStep['patches'] = []
      for (let i = 0; i < next.length; i++) {
        const was = s.tasks[i]
        const now = next[i]
        if (was.parentId !== now.parentId || was.projectId !== now.projectId || was.order !== now.order) {
          // `order: undefined` is how a task that had never been dragged gets
          // its "no opinion" back; `Number.isFinite` reads it as absent, and
          // `JSON.stringify` drops the key entirely.
          patches.push({ id: was.id, patch: { parentId: was.parentId, projectId: was.projectId, order: was.order } })
        }
      }
      // `ids` are the roots — the caller removes anything another moving task is
      // already carrying — so its length is the count the strip should say.
      //
      // Spelled out here rather than in the component, so the strip and the
      // label that followed the pointer during the drag read the same. Written
      // in the language on screen at the time and left that way, like a log's
      // auto-written text.
      const what =
        ids.length > 1
          ? translate(s.lang, 'gantt.dragMany', { count: ids.length })
          : (s.tasks.find((t) => t.id === ids[0])?.name ?? '')

      const now = new Date().toISOString()
      return {
        tasks: next.map((t) => ({ ...t, updatedAt: now })),
        lastUndo: { message: translate(s.lang, 'gantt.moved', { what }), patches, removedTasks: [], removedLogs: [] },
      }
    }),

  /**
   * Everything else that can be taken back, recorded by watching the board.
   *
   * The tasks array is compared by identity first and by value only for the rows
   * that changed: every action here maps over the array and hands back the same
   * object for the rows it did not touch, so a `!==` is enough to skip the ones
   * that are not this step's business. What survives that filter is written down
   * as the values those fields had *before*, which is all an undo needs.
   *
   * Rows that are gone rather than changed are the delete case, and they are
   * kept whole — a row that has left the board has no field left to patch, and
   * the log entries that went with it are not on the board either.
   *
   * Only while the Gantt is the view on screen: the strip that offers the step
   * back lives there and nowhere else. The task panel opens over every page, so
   * without this a pause taken on the Today page would leave an offer waiting in
   * the Gantt.
   */
  withUndo: (message, run) => {
    if (get().activeView !== 'gantt') {
      run()
      return
    }
    const before = get()
    const tasks = before.tasks
    const logs = before.logs
    run()
    const after = get()
    if (after.tasks === tasks && after.logs === logs) return

    const stillThere = new Map(after.tasks.map((t) => [t.id, t]))
    const patches: UndoStep['patches'] = []
    const removedTasks: Task[] = []
    for (const was of tasks) {
      const now = stillThere.get(was.id)
      if (!now) {
        removedTasks.push(was)
        continue
      }
      if (now === was) continue
      const patch: Record<string, unknown> = {}
      for (const k of Object.keys(was) as (keyof Task)[]) if (was[k] !== now[k]) patch[k] = was[k]
      if (Object.keys(patch).length > 0) patches.push({ id: was.id, patch: patch as Partial<Task> })
    }
    const logIds = new Set(after.logs.map((l) => l.id))
    const removedLogs = removedTasks.length > 0 ? logs.filter((l) => !logIds.has(l.id)) : []

    set({ lastUndo: { message, patches, removedTasks, removedLogs } })
  },

  undoLast: () =>
    set((s) => {
      const u = s.lastUndo
      if (!u) return {}
      const byId = new Map(u.patches.map((p) => [p.id, p.patch]))
      const now = new Date().toISOString()
      const tasks = s.tasks.map((t) => {
        const p = byId.get(t.id)
        return p ? { ...t, ...p, updatedAt: now } : t
      })
      return {
        // A removed row comes back as it was, timestamp and all — it is the same
        // record, and nothing about it changed while it was off the board. Its
        // place in the array is wherever the end is: the array's order is the
        // order things were created and nothing reads it as an arrangement.
        tasks: u.removedTasks.length > 0 ? [...tasks, ...u.removedTasks] : tasks,
        logs: u.removedLogs.length > 0 ? [...s.logs, ...u.removedLogs] : s.logs,
        lastUndo: null,
      }
    }),
  clearUndo: () => set((s) => (s.lastUndo ? { lastUndo: null } : {})),
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
                // The blank line is the boundary between the two writes; the
                // reading for it is attributed rather than typed into the text.
                // Through `restamp` because a write can also *change* what is
                // already there — the log editor sends the whole box — and a
                // paragraph that was edited has to say so in its own corner.
                ...(() => {
                  const body = l.content.trim() ? `${l.content}\n\n${input.content}` : input.content
                  return {
                    content: body,
                    stamps: restamp(l.content, l.stamps ?? [], body, logStamp(new Date())),
                  }
                })(),
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
          content: input.content,
          stamps: restamp('', [], input.content, logStamp(new Date())),
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
      logs: s.logs.map((l) => {
        if (l.id !== id) return l
        // A content change is an edit like any other, so it goes through the
        // same comparison an append does — otherwise editing an entry's text
        // would shuffle its paragraphs under readings that no longer belong to
        // them. Guarded on the text actually differing, because the editor
        // sends the whole box back on every save and each stamp would otherwise
        // claim the paragraph was touched again.
        const stamps =
          patch.content != null && patch.content !== l.content
            ? restamp(l.content, l.stamps ?? [], patch.content, logStamp(new Date()))
            : l.stamps
        return { ...l, ...patch, stamps, updatedAt: new Date().toISOString() }
      }),
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
                // Dropped with the other scheduling fields, and for the same
                // reason: a to-do has no type. It comes back from
                // `startTodoTasks` with the one the user picks at that point.
                type: null,
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
          // The archived check is not redundant with the buttons being hidden:
          // starting a to-do that sits inside a filed-away branch would put a
          // scheduled task under a parent the board no longer draws.
          if (!e || !t.isTodo || isArchived(t)) return t
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
            type: e.type,
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
        // Filing a task away stops the ticking with the rest of it: the day
        // panel no longer lists the row, so the state it would change is not
        // something the user can see the result of.
        if (t.id !== id || isArchived(t)) return t
        const days = t.confirmedDays ?? []
        return {
          ...t,
          confirmedDays: days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
          updatedAt: new Date().toISOString(),
        }
      }),
    })),

  // File a branch away, or bring it back. One `archivedAt` for the whole
  // branch, taken once so that "everything archived together says so", and one
  // `set` so App's `syncParentDates` pass sees the change once.
  //
  // Nothing here checks that the tasks are finished: the callers do that, and
  // this action is also what the invariant repair in `normalize` leans on. What
  // it does own is the cascade, and that is deliberate — see the interface.
  archiveTasks: (ids) =>
    set((s) => {
      const take = new Set(archiveCascade(s.tasks, ids))
      if (take.size === 0) return {}
      const now = new Date().toISOString()
      return {
        tasks: s.tasks.map((t) => (take.has(t.id) && !isArchived(t) ? { ...t, archivedAt: now, updatedAt: now } : t)),
      }
    }),

  unarchiveTasks: (ids) =>
    set((s) => {
      const byId = new Map(s.tasks.map((t) => [t.id, t]))
      const give = new Set<string>()
      for (const id of ids) {
        const self = byId.get(id)
        if (!self) continue
        for (const tid of archiveCascade(s.tasks, [id])) give.add(tid)
        // The chain above comes back too, which is the half that keeps this
        // usable from any row: a live task under an archived parent is a task no
        // screen can draw, so bringing one row out of a filed-away branch has to
        // bring what it hangs from. `seen` is not decoration — a hand-edited
        // file can hold a cycle, and this walk would not return.
        const seen = new Set<string>([id])
        let parentId = self.parentId
        while (parentId != null && !seen.has(parentId)) {
          seen.add(parentId)
          give.add(parentId)
          parentId = byId.get(parentId)?.parentId ?? null
        }
      }
      if (give.size === 0) return {}
      const now = new Date().toISOString()
      return {
        tasks: s.tasks.map((t) => (give.has(t.id) && isArchived(t) ? { ...t, archivedAt: undefined, updatedAt: now } : t)),
      }
    }),

  // Blank clears the entry rather than storing one: `normalize` drops empty
  // names on the way in for the same reason, and a folder with no name has to
  // read as unnamed on both paths or a cleared name would come back after a
  // reload.
  setTodoFolderName: (groupId, name) =>
    set((s) => {
      const trimmed = name.trim()
      const next = { ...s.todoFolders }
      if (trimmed) next[groupId] = trimmed
      else delete next[groupId]
      return { todoFolders: next }
    }),

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

  // Three ways in, one way out: a blank body removes the note, which is the
  // only "delete" this feature has and needs no confirm — the text is right
  // there in the box that is about to lose it.
  setNote: (date, body) =>
    set((s) => {
      const existing = s.notes.find((n) => n.date === date)
      // Whitespace-only counts as empty: a note of nothing but newlines would
      // draw a card saying the user had written something on that day.
      const text = body.trim() ? body : ''
      if (existing && existing.body === text) return {}
      if (!text) {
        return existing ? { notes: s.notes.filter((n) => n.date !== date) } : {}
      }
      const updatedAt = new Date().toISOString()
      // The notebook's stamps work exactly as the log's do, and through the
      // same comparison: the box is one textarea, so which paragraph an edit
      // changed is worked out rather than told.
      const stamps = restamp(existing?.body ?? '', existing?.stamps ?? [], text, logStamp(new Date()))
      return {
        notes: existing
          ? s.notes.map((n) => (n.date === date ? { ...n, body: text, stamps, updatedAt } : n))
          : [...s.notes, { date, body: text, stamps, updatedAt }],
      }
    }),
  appendNote: (date, body) =>
    set((s) => {
      const text = body.trim()
      if (!text) return {}
      const existing = s.notes.find((n) => n.date === date)
      const updatedAt = new Date().toISOString()
      const next = existing ? `${existing.body}\n\n${text}` : text
      // Same comparison as `setNote`: adding a paragraph is a save like any
      // other, and the ones already there keep the readings they were written
      // under rather than being restamped by the addition below them.
      const stamps = restamp(existing?.body ?? '', existing?.stamps ?? [], next, logStamp(new Date()))
      return {
        notes: existing
          ? s.notes.map((n) => (n.date === date ? { ...n, body: next, stamps, updatedAt } : n))
          : [...s.notes, { date, body: next, stamps, updatedAt }],
      }
    }),

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

  syncParentDates: () =>
    set((s) => {
      const next = syncParentDates(s.tasks, s.logs)
      // The same array back means nothing moved, and returning `{}` is what
      // keeps this from re-triggering the effect that called it.
      return next === s.tasks ? {} : { tasks: next }
    }),

  importData: (data) =>
    set({
      projects: data.projects,
      tasks: data.tasks,
      logs: data.logs ?? [],
      chores: data.chores ?? [],
      habits: data.habits ?? [],
      notes: data.notes ?? [],
      todoFolders: data.todoFolders ?? {},
      selectedTaskId: null,
      selectedProjectId: null,
      projectFilter: 'all',
      // A drag from the board that was just replaced is not a step back from
      // this one. The ids are almost certain not to match, so the offer would
      // mostly do nothing — but "mostly" is not a thing to leave to chance when
      // the failure is a silent edit to an unrelated task.
      lastUndo: null,
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

  setReminderWechat: (on) => {
    set({ reminderWechat: on })
    persistPrefs()
    scheduleReminderSync(0)
  },
  setReminderRules: (rules) => {
    set({ reminderRules: rules })
    persistPrefs()
    scheduleReminderSync(0)
  },
  setReminderTopic: (category, on) => {
    const current = get().reminderTopics
    const next = on ? [...current, category] : current.filter((c) => c !== category)
    set({ reminderTopics: next })
    persistPrefs()
    scheduleReminderSync(0)
  },
  setReminderLeadDays: (days) => {
    set({ reminderLeadDays: days })
    persistPrefs()
    scheduleReminderSync(0)
  },
  setCopyOverride: (key, text) => {
    const { reminderCopy, lang } = get()
    const forLang = { ...(reminderCopy[lang] ?? {}) }
    // Empty means no opinion, not render nothing — see copy() in reminder.ts.
    if (text.trim() === '') delete forLang[key]
    else forLang[key] = text
    set({ reminderCopy: { ...reminderCopy, [lang]: forLang } })
    persistPrefs()
    scheduleReminderSync(0)
  },
  markReportSeen: () => {
    set({ reportSeenDay: todayISO() })
    persistPrefs()
  },
  setReminderToken: (token) => {
    set({ reminderToken: token })
    persistPrefs()
    scheduleReminderSync(0)
  },

  installReminderTask: async () => {
    try {
      await installTask()
      set({ reminderTaskInstalled: true, reminderError: null })
    } catch (err) {
      console.warn('Reminder task install failed:', err)
      set({ reminderError: err instanceof Error ? err.message : String(err) })
    }
  },
  removeReminderTask: async () => {
    try {
      await removeTask()
      set({ reminderTaskInstalled: false, reminderError: null })
    } catch (err) {
      console.warn('Reminder task removal failed:', err)
      set({ reminderError: err instanceof Error ? err.message : String(err) })
    }
  },
  refreshReminderTask: async () => {
    set({ reminderTaskInstalled: await isReminderTaskInstalled() })
  },

  setAutostart: async (on) => {
    try {
      const actual = await enableAutostart(on)
      set({ autostart: actual })
      persistPrefs()
    } catch (err) {
      console.warn('Autostart change failed:', err)
      set({ reminderError: err instanceof Error ? err.message : String(err) })
    }
  },
}))

// Persist data (only) to localStorage whenever projects/tasks/logs/chores/habits/
// notes change.
//
// Both halves of this are load-bearing, and neither is checked by the compiler:
// a collection missing from the condition is a collection whose edits are never
// written, and one missing from the literal is a collection the next write of
// anything else silently erases.
useStore.subscribe((state, prev) => {
  if (
    state.projects !== prev.projects ||
    state.tasks !== prev.tasks ||
    state.logs !== prev.logs ||
    state.chores !== prev.chores ||
    state.habits !== prev.habits ||
    state.notes !== prev.notes ||
    state.todoFolders !== prev.todoFolders
  ) {
    saveData({
      projects: state.projects,
      tasks: state.tasks,
      logs: state.logs,
      chores: state.chores,
      habits: state.habits,
      notes: state.notes,
      todoFolders: state.todoFolders,
    })
  }
})

// Keep `today` fresh across midnights so derived progress/status re-render.
setInterval(() => {
  const t = todayISO()
  if (useStore.getState().today !== t) useStore.setState({ today: t })
}, 60_000)

/**
 * How long a burst of edits is allowed to settle before the reminder file is
 * rewritten.
 *
 * The file is the whole fortnight re-rendered, so writing it on every keystroke
 * of a task rename would be churn for something nothing reads until tomorrow
 * morning. Long enough that renaming and retyping is one write, short enough
 * that the file is never meaningfully behind.
 */
const REMINDER_SETTLE_MS = 30_000

let reminderTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Rewrite the reminder file from the board as it stands, coalescing bursts.
 *
 * `delay = 0` is for settings the user has just changed by hand: they are about
 * to close the window and have every right to expect it stuck.
 */
function scheduleReminderSync(delay = REMINDER_SETTLE_MS): void {
  if (reminderTimer !== null) clearTimeout(reminderTimer)
  reminderTimer = setTimeout(() => {
    reminderTimer = null
    const s = useStore.getState()
    // Filed-away work is not pushed: the digest is a list of what is coming, and
    // an archived task is finished work that has been put down. The one place
    // the live-only rule is applied at the source rather than at a screen.
    void syncReminderFile(
      { tasks: liveTasks(s.tasks), logs: s.logs, chores: s.chores, habits: s.habits },
      s.lang,
      {
        wechat: s.reminderWechat,
        token: s.reminderToken.trim(),
        ack: translate(s.lang, 'reminder.ack'),
        rules: s.reminderRules,
        topics: s.reminderTopics,
        leadDays: s.reminderLeadDays,
        overrides: s.reminderCopy[s.lang],
      },
    )
  }, delay)
}

// Everything the digest is made of, plus the language it is written in. Keyed on
// the same identity comparisons as the data subscriber above — a set of new
// arrays is a change, a re-render is not.
useStore.subscribe((state, prev) => {
  if (
    state.tasks !== prev.tasks ||
    state.logs !== prev.logs ||
    state.chores !== prev.chores ||
    state.habits !== prev.habits ||
    state.lang !== prev.lang
  ) {
    scheduleReminderSync()
  }
})

// The first run, and with it the recovery path for every launch after: whatever
// the file happens to hold, rewrite it from the board that was just loaded.
scheduleReminderSync(0)

// Two questions only the operating system can answer, asked once at startup.
// Neither is guessable from our own preferences: the scheduled task can be
// deleted from Task Scheduler and autostart turned off from Task Manager, and a
// toggle that keeps saying "on" after that is worse than no toggle at all.
if (isTauri()) {
  void (async () => {
    // The scheduled task is registered here, on the first launch, rather than by
    // a button someone has to find. The whole point of the feature is that it
    // works without being attended to, and a reminder that waits for its owner to
    // finish setting it up is one that has already failed at that.
    //
    // Deliberately not in a dev build: the task would be registered against
    // `target/debug/app.exe`, which the next `cargo clean` deletes, leaving a
    // scheduled task aimed at a path that no longer exists — and one the user
    // never asked for and cannot account for.
    let installed = await isReminderTaskInstalled()
    if (!installed && !import.meta.env.DEV) {
      try {
        await installTask()
        installed = await isReminderTaskInstalled()
      } catch (err) {
        console.warn('Could not register the reminder task:', err)
      }
    }
    useStore.setState({ reminderTaskInstalled: installed })

    // The preference is the source of truth here, not the registry — that is the
    // opposite of how this read before, and it is what makes the default a
    // default. Reconciling the other way would let the very first launch flip
    // "start with Windows" straight back off, since a fresh install is by
    // definition not yet registered. The cost is that switching it off from Task
    // Manager is undone on the next launch; switching it off in the app is not.
    const auto = await isAutostartEnabled()
    const wants = useStore.getState().autostart
    // `null` means the question could not be put to Windows at all, which is not
    // the same answer as "off" and must not be acted on either way.
    if (auto !== null && auto !== wants) {
      try {
        await enableAutostart(wants)
      } catch (err) {
        console.warn('Could not apply the autostart preference:', err)
      }
    }
  })()
}

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
    // Live only, unlike `useRows` above: the axis is measured to fit the bars
    // that are drawn, and an archived task's bar is not one of them. Keeping a
    // branch filed away two years ago in the sum would stretch the axis over two
    // years of nothing. It is the one place the archive is filtered rather than
    // drawn somewhere, and it is a layout question, not a number on the board.
    const live = liveTasks(projectFilter === 'all' ? tasks : tasks.filter((t) => t.projectId === projectFilter))
    return timelineRange(mode, live, today, canvasWidth)
  }, [mode, tasks, today, projectFilter, canvasWidth])
}

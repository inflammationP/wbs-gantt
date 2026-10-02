import { useMemo } from 'react'
import { create } from 'zustand'
import { AppView, Chore, Habit, Note, Project, Task, TaskLog, TaskPriority, TaskType, ViewMode } from '../types'
import { ALL_DAYS, habitBranch, runsOn } from '../lib/habits'
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
  projectsInView,
  moveInto,
  promoteTask,
  Row,
} from '../lib/tree'
import {
  Board,
  EMPTY_HISTORY,
  History,
  HistoryDelta,
  HistoryStep,
  StepKind,
  applyDelta,
  deltaCount,
  diffBoard,
  mergeDelta,
  pathBetween,
} from '../lib/history'
import { loadData, saveData, loadPrefs, savePrefs, PersistedData, Prefs } from './storage'
import { PROJECT_COLORS } from '../lib/ui'
import { logStamp, restamp } from '../lib/logs'
import { applyLang, Lang, translate } from '../lib/i18n'
import { applyTheme, ThemeId } from '../lib/theme'
import { buildSeed } from '../lib/seed'
import { checkForUpdate, fetchReleaseHistory, isTauri, CheckResult, ReleaseNotes } from '../lib/updater'
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
  /** The node the strip's button asks for — one step back from the cursor. */
  parent: string | null
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
  /**
   * The releases skipped over, newest first — empty when none were, which is
   * also what hides the dialog's folded section. Filled in after the dialog is
   * already up: it is a fetch, and the version number and install button do not
   * wait on it.
   */
  updateHistory: ReleaseNotes[]
  updateInstalling: boolean
  /**
   * The installer is on disk and waiting for the word.
   *
   * Its own flag rather than a phase of the check, because it is not a step of
   * the check: the check is over, the answer was "yes", and this is the pause
   * between fetching the thing and replacing the process with it.
   */
  updateReady: boolean
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
  closeToTray: boolean
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

  addProject: (name: string, color: string, description?: string) => string
  updateProject: (id: string, patch: Partial<Project>) => void
  deleteProject: (id: string) => void
  /**
   * Fold these projects into that one — the project-level move.
   *
   * A project is a root directory, so this is what a file manager does when one
   * root is dragged inside another: the rows come along, the source stops being
   * a root, and the only question is whether it arrives as a folder of its own
   * (`asFolder`, named after the project) or poured flat into the target's top
   * level. The rearrangement is `moveInto` in `lib/tree.ts`, which is pure and
   * which the dialog's preview also calls — so the picture shown before the
   * button is pressed is produced by the function the button runs.
   *
   * Deliberately not undoable, and not wrapped in `withUndo`: the same call
   * `deleteProject` makes, and for a stronger reason — the step *creates* a
   * folder, and an undo step only knows how to put back fields on rows that were
   * already there. Undoing one would leave the new folder standing over an empty
   * project. The dialog is the confirmation, and the preview is what makes it
   * one you can read.
   */
  mergeProjects: (sourceIds: string[], targetId: string, asFolder: boolean) => void
  /**
   * Put a mixed set of projects and tasks in one place — see the implementation.
   *
   * `target` is a kind rather than a resolved place because one kind is a place
   * that does not exist yet: `newProject` makes one inside the same gesture, so
   * the whole thing stays one step of the history.
   */
  moveUnits: (
    units: { projects: string[]; tasks: string[] },
    target: { kind: 'project'; id: string } | { kind: 'task'; id: string } | { kind: 'newProject' },
    asFolder: boolean,
  ) => void

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
  withUndo: (message: string, run: () => void, kind?: StepKind) => void
  /** The last step, or null. Read by the Gantt's "did X · undo" strip. */
  lastUndo: UndoStep | null
  /**
   * Every structural change since the app opened, as a tree.
   *
   * Session-only, and deliberately outside `PersistedData` — see the note on
   * `HistoryStep`. Nothing about it goes to disk, so none of the "six places" a
   * new collection has to be named apply here.
   */
  history: History
  /**
   * Move the board to any node of the history tree, however far.
   *
   * Applied by walking the path from where the board is to the node it is going
   * to and folding each step's delta in turn — one step at a time is the same
   * operation, one step shorter. See `lib/history.ts` for why walking is what
   * makes a fifty-step jump safe.
   */
  historyGoTo: (nodeId: string | null) => void
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
  addHabit: (
    title: string,
    init?: { note?: string; weekdays?: number[]; endDate?: string | null; parentId?: string | null },
  ) => void
  updateHabit: (id: string, patch: Partial<Habit>) => void
  /** No day argument on purpose — see the implementation. */
  toggleHabit: (id: string) => void
  deleteHabit: (id: string) => void

  syncParentDates: () => void

  importData: (data: PersistedData) => void

  dismissTodoNote: () => void

  runUpdateCheck: () => Promise<void>
  /** Fetch it, in the background. */
  installUpdate: () => Promise<void>
  /** Replace the process with it, once the reader has said when. */
  applyUpdate: () => Promise<void>
  /** "Later" — put it aside, keeping what was downloaded. */
  dismissReady: () => void
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
  setCloseToTray: (on: boolean) => void
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
    closeToTray,
  } = useStore.getState()
  savePrefs({
    lang,
    theme,
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
    closeToTray,
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

/**
 * Capturing the history.
 *
 * **The store watches itself.** Every structural change goes through `set`, so
 * comparing one state with the next catches all of them — and, crucially, catches
 * the ones nobody remembered to announce. The previous design asked twenty UI
 * call sites to wrap their work in `withUndo`, which is exactly why "move to top
 * level" and "rename a to-do folder" never made it into the undo at all: a call
 * site that forgot produced no error, just an operation that could not be taken
 * back.
 *
 * The failure mode is inverted here. A gesture that opens with `withUndo` gets
 * its label; one that does not still gets recorded, under a label assembled from
 * the delta itself ("added 2"). Something missed shows up as a badly named step
 * rather than as a silent hole in the history — and a hole is the one thing the
 * whole design cannot survive, because a jump across it would land on a board
 * that never existed.
 *
 * Two things are held back from the record:
 *
 *   - **Derived writes.** `syncParentDates` rewrites a parent's window from its
 *     children, on every tasks change. Recorded, every single step would drag a
 *     noise entry behind it.
 *   - **The history's own writes**, and anything else that only sets state this
 *     module owns — a step must never be recorded about recording a step.
 *
 * `suspended` covers both, and is a counter rather than a flag so that a
 * suspended write inside a suspended one cannot re-arm the record on its way out.
 */
let suspended = 0
let inGesture = false
let gestureLabel: string | null = null
let gestureKind: StepKind | undefined
let accumulating: HistoryDelta | null = null

/** `HH:MM`, local. The tree is read at a glance; a date would be noise. */
function clockNow(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * What to call a step nobody named.
 *
 * Assembled from the delta so it always says something true, and ordered by what
 * a reader would want to be told first: a step that removed rows is the one worth
 * looking at, then one that added, then the rest.
 */
function autoLabel(lang: Lang, delta: HistoryDelta): string {
  const n = deltaCount(delta)
  if (delta.removed.length > 0 || delta.projects.removed.length > 0) {
    return translate(lang, 'history.autoRemove', { count: n })
  }
  if (delta.added.length > 0 || delta.projects.added.length > 0) {
    return translate(lang, 'history.autoAdd', { count: n })
  }
  return translate(lang, 'history.autoChange', { count: n })
}

/**
 * Close the current gesture and put it on the tree.
 *
 * Called both by `withUndo` on its way out and by the subscriber when a change
 * arrives with no gesture open — which is what makes an unannounced change a
 * step rather than a gap.
 */
function flushHistory() {
  const delta = accumulating
  accumulating = null
  const named = gestureLabel
  const kind = gestureKind
  gestureLabel = null
  gestureKind = undefined
  if (!delta) return

  const state = useStore.getState()
  const label = named ?? autoLabel(state.lang, delta)
  const step: HistoryStep = {
    id: uid(),
    parent: state.history.cursor,
    label,
    at: clockNow(),
    kind,
    delta,
  }
  suspended++
  useStore.setState({
    history: { steps: [...state.history.steps, step], cursor: step.id },
    lastUndo: { message: label, parent: step.parent },
  })
  suspended--
}

/** The collections the history is about. Chores, habits and notes are not. */
const boardOf = (s: {
  tasks: Task[]
  projects: Project[]
  logs: TaskLog[]
  todoFolders: Record<string, string>
}): Board => ({
  tasks: s.tasks,
  projects: s.projects,
  logs: s.logs,
  todoFolders: s.todoFolders,
})

export const useStore = create<State>()((set, get) => ({
  projects: initial.projects,
  tasks: initial.tasks,
  logs: initial.logs,
  chores: initial.chores,
  habits: initial.habits,
  notes: initial.notes,
  todoFolders: initial.todoFolders,
  lastUndo: null,
  history: EMPTY_HISTORY,
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
  todoNoteDismissed: prefs.todoNoteDismissed,
  updatePhase: 'idle',
  updateInfo: null,
  updateHistory: [],
  updateInstalling: false,
  updateReady: false,
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
  closeToTray: prefs.closeToTray,
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

  addProject: (name, color, description = '') => {
    // The description is a parameter rather than a second `updateProject` call
    // after the fact: two calls are two steps of the history, and making a
    // project would read as "added 工作" followed by "edited 工作".
    const project: Project = { id: uid(), name, color, description }
    get().withUndo(translate(get().lang, 'history.newProject', { what: name }), () =>
      set((s) => ({ projects: [...s.projects, project] })),
    )
    return project.id
  },
  updateProject: (id, patch) => {
    const name = get().projects.find((p) => p.id === id)?.name ?? ''
    get().withUndo(translate(get().lang, 'history.editProject', { what: name }), () =>
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
    )
  },
  deleteProject: (id) => {
    const name = get().projects.find((p) => p.id === id)?.name ?? ''
    get().withUndo(translate(get().lang, 'history.deleteProject', { what: name }), () =>
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
    )
  },

  mergeProjects: (sourceIds, targetId, asFolder) =>
    get().moveUnits({ projects: sourceIds, tasks: [] }, { kind: 'project', id: targetId }, asFolder),

  /**
   * Put a mixed set of projects and tasks in one place.
   *
   * The general form of what used to be `mergeProjects`, and that action is now
   * nothing but a call into this with the task half empty. The reason the two are
   * one action is the reason the dialog is one dialog: "move this whole project
   * into that one" and "move these six tasks under that task" are the same
   * question asked with different things ticked, and the destination picker is
   * the same picker either way.
   *
   * The target is a *kind* rather than a place, because one of the three kinds is
   * a place that does not exist yet: `newProject` makes one inside the same
   * gesture, which is what keeps it to a single step of the history — `withUndo`
   * folds every `set` in its run into one.
   */
  moveUnits: (units, target, asFolder) => {
    const s = get()
    // One lookup over both kinds, because the label does not care which a unit
    // was — it prints whatever was ticked.
    const names = new Map<string, string>([
      ...s.projects.map((p) => [p.id, p.name] as const),
      ...s.tasks.map((t) => [t.id, t.name] as const),
    ])
    const movingIds = [...units.projects, ...units.tasks]
    const what = movingIds.map((id) => names.get(id) ?? '').join(translate(s.lang, 'common.listSeparator'))

    /**
     * One task and nothing else, sent to a new project: it *becomes* the project
     * rather than being moved into one.
     *
     * Anything else would put a task of the same name inside a project of the
     * same name and spend a level saying nothing — and the name is exactly what
     * the person meant to keep. It is the mirror of moving a project into another
     * project, where the project stops being a root and becomes a task; here the
     * task stops being a task and becomes a root.
     *
     * More than one unit, or a project among them, is the other operation: a new
     * project is made and they go *into* it.
     */
    const promoting = target.kind === 'newProject' && units.projects.length === 0 && units.tasks.length === 1
    const labelKey = promoting
      ? 'history.promoteTask'
      : target.kind === 'newProject'
        ? 'history.moveNewProject'
        : 'history.move'

    get().withUndo(translate(s.lang, labelKey, { what }), () => {
      const nextColor = () => {
        const projects = get().projects
        return PROJECT_COLORS[projects.length % PROJECT_COLORS.length]
      }

      if (promoting) {
        const before = get()
        const promoted = promoteTask(before.tasks, before.projects, units.tasks[0], {
          id: uid(),
          color: nextColor(),
        })
        if (!promoted) return
        set({
          tasks: promoted.tasks,
          projects: promoted.projects,
          // The row that was selected is no longer a task; the panel showing it
          // is showing something that is not there.
          selectedTaskId: before.selectedTaskId === units.tasks[0] ? null : before.selectedTaskId,
        })
        return
      }

      {
        let projectId: string
        if (target.kind === 'newProject') {
          // Named after the one thing being moved when there is exactly one, so
          // the common case — pull a branch out into a project of its own — lands
          // with a name that means something. Renaming it is a pencil away.
          const name =
            movingIds.length === 1
              ? (names.get(movingIds[0]) ?? translate(s.lang, 'move.newProjectName'))
              : translate(s.lang, 'move.newProjectName')
          projectId = get().addProject(name, nextColor(), '')
        } else if (target.kind === 'project') {
          projectId = target.id
        } else {
          projectId = get().tasks.find((t) => t.id === target.id)?.projectId ?? ''
        }

        const before = get()
        const place =
          target.kind === 'task'
            ? { parentId: target.id, projectId }
            : { parentId: null, projectId }
        const next = moveInto(before.tasks, before.projects, units, place, asFolder, () => uid())
        if (!next) return

        const stillThere = (id: string | null) => next.projects.some((p) => p.id === id)
        // The tasks are all still here — only their project changed — so the logs
        // stay exactly as they are. `deleteProject` filters them out for the
        // opposite reason: there, the rows they belong to are gone.
        set({
          tasks: next.tasks,
          projects: next.projects,
          // A filter left pointing at a project that has just been moved away
          // would show an empty board. Following it to where the work went is
          // the useful answer; anything else — `all`, or a project that
          // survived — is left alone.
          projectFilter:
            before.projectFilter === 'all' || stillThere(before.projectFilter)
              ? before.projectFilter
              : projectId,
          selectedProjectId: stillThere(before.selectedProjectId) ? before.selectedProjectId : null,
        })
      }
    }, 'move')
  },

  addTask: (input) => {
    const id = uid()
    const now = new Date().toISOString()
    get().withUndo(translate(get().lang, 'history.newTask', { what: input.name }), () =>
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
      }),
    )
    return id
  },
  updateTask: (id, patch) => {
    const name = get().tasks.find((t) => t.id === id)?.name ?? ''
    get().withUndo(translate(get().lang, 'history.editTask', { what: name }), () =>
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
        ),
      })),
    )
  },
  deleteTask: (id) =>
    set((s) => {
      const ids = new Set(collectDescendants(s.tasks, id).concat(id))
      const tasks = s.tasks
        .filter((t) => !ids.has(t.id))
        .map((t) => {
          const deps = t.dependencies.filter((d) => !ids.has(d))
          // The same row back when nothing in it changed. Every action here hands
          // back the object it was given for the rows it did not touch, and the
          // undo history reads the board by exactly that identity — rebuild them
          // all and deleting one task becomes a step that "changed" every other
          // one, with a delta to match.
          return deps.length === t.dependencies.length ? t : { ...t, dependencies: deps }
        })
      const selectedTaskId = s.selectedTaskId && ids.has(s.selectedTaskId) ? null : s.selectedTaskId
      const logs = s.logs.filter((l) => !ids.has(l.taskId))
      return { tasks, logs, selectedTaskId }
    }),
  setTaskParent: (id, parentId) => {
    const name = get().tasks.find((t) => t.id === id)?.name ?? ''
    get().withUndo(
      translate(get().lang, parentId === null ? 'history.outdent' : 'history.editTask', { what: name }),
      () =>
        set((s) => {
          if (parentId && (parentId === id || collectDescendants(s.tasks, id).includes(parentId))) return {}
          return {
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, parentId, updatedAt: new Date().toISOString() } : t,
            ),
          }
        }),
    )
  },
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
  /**
   * Where a drag lands — and it names its own step rather than being wrapped by
   * the caller, because the Gantt's drop calls it directly and a label belongs
   * next to the thing that knows what moved.
   */
  moveTasks: (ids, parentId, beforeId, projectId) => {
    const s = get()
    // `ids` are the roots — the caller removes anything another moving task is
    // already carrying — so its length is the count the strip should say.
    //
    // Spelled out here rather than in the component, so the strip and the label
    // that followed the pointer during the drag read the same. Written in the
    // language on screen at the time and left that way, like a log's
    // auto-written text.
    const what =
      ids.length > 1
        ? translate(s.lang, 'gantt.dragMany', { count: ids.length })
        : (s.tasks.find((t) => t.id === ids[0])?.name ?? '')
    get().withUndo(translate(s.lang, 'gantt.moved', { what }), () =>
      set((state) => {
        const next = placeTasks(state.tasks, ids, parentId, beforeId, projectId)
        if (!next) return {}
        // Only the rows the move actually wrote are stamped. `placeTasks` hands
        // back the *same object* for a row it did not touch, and that identity is
        // the whole difference between a step that moved four rows and one that
        // "changed" every task on the board by giving them all a new timestamp.
        const now = new Date().toISOString()
        return { tasks: next.map((t, i) => (t === state.tasks[i] ? t : { ...t, updatedAt: now })) }
      }),
      'move',
    )
  },

  /**
   * Name the step that is about to happen.
   *
   * The capturing itself is done by the subscriber — this only says what to call
   * the result. It used to do the diffing too, which is why an operation nobody
   * wrapped could not be taken back at all; now an unwrapped one is still
   * recorded, just under a label assembled from its delta.
   *
   * Re-entrant: a gesture that runs inside another keeps the outer name and does
   * not close the step, so a bulk action built out of single-row actions is one
   * step rather than twenty.
   */
  withUndo: (message, run, kind) => {
    const outer = inGesture
    const outerLabel = gestureLabel
    const outerKind = gestureKind
    if (!outer) {
      inGesture = true
      gestureLabel = message
      gestureKind = kind
    }
    let threw: unknown
    try {
      run()
    } catch (e) {
      threw = e
    } finally {
      if (outer) {
        gestureLabel = outerLabel
        gestureKind = outerKind
      } else {
        inGesture = false
        flushHistory()
      }
    }
    if (threw) throw threw
  },

  historyGoTo: (nodeId) => {
    const s = get()
    const path = pathBetween(s.history.steps, s.history.cursor, nodeId)
    if (!path || path.length === 0) return

    let board = boardOf(s)
    for (const { step, dir } of path) board = applyDelta(board, step.delta, dir)

    // The rows a jump can take away are the same rows a delete can, so the
    // pointing-at-a-dead-row cleanup is the same one `deleteTask` does.
    const taskIds = new Set(board.tasks.map((t) => t.id))
    const projectIds = new Set(board.projects.map((p) => p.id))

    suspended++
    set({
      ...board,
      history: { ...s.history, cursor: nodeId },
      lastUndo: null,
      selectedTaskId: s.selectedTaskId && taskIds.has(s.selectedTaskId) ? s.selectedTaskId : null,
      selectedProjectId: s.selectedProjectId && projectIds.has(s.selectedProjectId) ? s.selectedProjectId : null,
      projectFilter:
        s.projectFilter === 'all' || projectIds.has(s.projectFilter) ? s.projectFilter : 'all',
    })
    suspended--
  },

  undoLast: () => {
    const s = get()
    if (s.history.cursor === null) return
    const step = s.history.steps.find((x) => x.id === s.history.cursor)
    get().historyGoTo(step ? step.parent : null)
  },
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
    get().withUndo(translate(get().lang, 'history.folderRename'), () =>
      set((s) => {
        const trimmed = name.trim()
        const next = { ...s.todoFolders }
        if (trimmed) next[groupId] = trimmed
        else delete next[groupId]
        return { todoFolders: next }
      }),
    ),

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
          parentId: init?.parentId ?? null,
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
        // A tick on a day the routine does not run is a fact the data should
        // never learn — one that has ended, a Tuesday of a Mon/Wed/Fri one, a
        // suspended one. `routineRows` already keeps those off every list, so
        // nothing in the UI can reach this branch; the guard is what keeps that
        // from being the only thing standing between the two, and it asks the
        // same function that decides what to show.
        if (!runsOn(h, day)) return h
        // ...and neither is a tick on a heading, which has no box to click and
        // whose `done` is its children's. Its `doneDays` staying empty is what
        // makes the roll-up the only answer to "is this done today"; a tick
        // written here would be read by nothing, and would sit in the file
        // looking like a fact. `routineRows` treats one that got in anyway the
        // same way — it does not read it.
        if (s.habits.some((k) => k.parentId === h.id)) return h
        return {
          ...h,
          // Ticked days are kept in the order they were ticked. Nothing reads
          // that order — the heatmap tests membership and every day's list does
          // too — so there is no reason to sort a list that only ever grows at
          // the end.
          doneDays: h.doneDays.includes(day) ? h.doneDays.filter((d) => d !== day) : [...h.doneDays, day],
          updatedAt: new Date().toISOString(),
        }
      }),
    })),
  // The whole branch goes, as `deleteTask` takes a task's subtree: a routine is
  // a container once it has children, and leaving them behind would file them
  // under a parent that is gone — which `routineRows` draws at the top, so the
  // delete would look like it had half happened.
  deleteHabit: (id) =>
    set((s) => {
      const ids = habitBranch(s.habits, id)
      return { habits: s.habits.filter((h) => !ids.has(h.id)) }
    }),

  /**
   * Recompute each phase parent's window from its children.
   *
   * Suspended from the history: this runs on every tasks change, and it writes
   * `tasks` every time it finds anything to move. Recorded, every structural step
   * would be followed by a second, meaningless one saying "changed 3" — the same
   * numbers the first step already implies, recomputed. It is also a *derived*
   * write: whatever it puts on a parent comes straight back off its children, so
   * a jump that skipped it would land on the right board anyway.
   */
  syncParentDates: () => {
    suspended++
    set((s) => {
      const next = syncParentDates(s.tasks, s.logs)
      // The same array back means nothing moved, and returning `{}` is what
      // keeps this from re-triggering the effect that called it.
      return next === s.tasks ? {} : { tasks: next }
    })
    suspended--
  },

  importData: (data) => {
    // Suspended, or the subscriber would record the import itself as a step —
    // one enormous "changed 500" — in the same breath as clearing the tree that
    // step would go on.
    suspended++
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
      // this one, and neither is anything else in the history: every step names
      // task ids, and this board's ids have nothing to do with the old one's.
      // Keeping the tree would leave a jump that lands on a board made of half
      // of each.
      lastUndo: null,
      history: EMPTY_HISTORY,
    })
    suspended--
  },

  // One way: the note is an explanation, and a way to ask for it back would be a
  // setting nobody would ever find.
  dismissTodoNote: () => {
    set({ todoNoteDismissed: true })
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
    // Emptied up front, not when the answer arrives: checking again against a
    // different version would otherwise leave the previous version's history
    // sitting under the new release's notes until the fetch came back.
    set({ updatePhase: 'checking', updateError: null, updateHistory: [] })

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

    // The skipped versions are a second request, fetched after the dialog is
    // already up rather than before: the version number, the notes and the
    // install button do not wait behind it, and the folded section appears when
    // — or never — it arrives. Nothing is fetched for a snoozed update, since
    // nobody is looking at a dialog.
    if (!snoozed) {
      const history = await fetchReleaseHistory(result.current, result.version)
      // Unless a check that started while this one was in flight has taken over.
      if (useStore.getState().updateInfo === result) set({ updateHistory: history })
    }
  },

  /**
   * Fetch the installer, in the background.
   *
   * The dialog disappears the moment this is called and the app carries on: a
   * download is a download, and it does not need the user watching it. What
   * comes back is `updateReady`, which raises the question the download cannot
   * answer — whether to restart now.
   */
  installUpdate: async () => {
    const info = useStore.getState().updateInfo
    if (!info) return
    // Stamp the anchor before anything is written downstream: on Windows the
    // installer exits the process, so anything written after that may never land.
    set({ updateInstalling: true, updateError: null, updateAnchorAt: new Date().toISOString() })
    persistPrefs()
    try {
      await info.download()
      set({ updateInstalling: false, updateReady: true })
    } catch (err) {
      set({
        updateInstalling: false,
        updateError: err instanceof Error ? err.message : String(err),
      })
    }
  },

  applyUpdate: async () => {
    const info = useStore.getState().updateInfo
    if (!info) return
    set({ updateInstalling: true, updateReady: false, updateError: null })
    try {
      await info.install()
    } catch (err) {
      set({
        updateInstalling: false,
        updateError: err instanceof Error ? err.message : String(err),
      })
    }
  },

  // The handle stays: what was downloaded is still downloaded, and the way back
  // to it is the version section, which shows the same offer. Dropping the
  // handle here would make "later" mean "never", and the whole download would
  // happen again on the next launch.
  dismissReady: () => set({ updateReady: false }),

  closeUpdateDialog: () => {
    const info = useStore.getState().updateInfo
    set({ updateInfo: null, updateInstalling: false, updateReady: false, updateError: null })
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

  setCloseToTray: (on) => {
    set({ closeToTray: on })
    persistPrefs()
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

  // ...and the other half of the same pass: this is where the undo history is
  // captured. Same comparison, one more use for it — the alternative was asking
  // every action to remember, which is how two of them came to be missing.
  if (suspended > 0) return
  if (
    state.tasks === prev.tasks &&
    state.projects === prev.projects &&
    state.logs === prev.logs &&
    state.todoFolders === prev.todoFolders
  ) {
    return
  }
  const delta = diffBoard(prev, state)
  if (!delta) return
  accumulating = mergeDelta(accumulating, delta)
  // No gesture open means nobody announced this one. It is still a step — the
  // whole point — and it gets a name assembled from what it did.
  if (!inGesture) flushHistory()
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
    return buildRows(visible, expanded, projectsInView(projects, projectFilter), logs)
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

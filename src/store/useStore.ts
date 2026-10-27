import { useMemo } from 'react'
import { create } from 'zustand'
import { AppView, Chore, ChoreSlot, DayPlan, DaySortMode, Habit, ItemLog, Note, Project, ScheduleBlock, Task, TaskLog, TaskPriority, TaskType, ViewMode } from '../types'
import { ALL_DAYS, habitBranch, runsOn } from '../lib/habits'
import { todaysChores } from '../lib/chores'
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
  editTask,
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
  pathBetween,
} from '../lib/history'
import { loadData, saveData, loadPrefs, savePrefs, backupStoredData, workData, exportJson, prepareData, PersistedData, Prefs } from './storage'
import { PROJECT_COLORS } from '../lib/ui'
import { isLogDayOpen, logStamp, restamp } from '../lib/logs'
import { postponePatch } from '../lib/postpone'
import { DEFAULT_CAPACITY_HOURS, isHHMM, minutesOf } from '../lib/schedule'
import { applyLang, Lang, translate } from '../lib/i18n'
import { applyTheme, ThemeId } from '../lib/theme'
import { buildSeed } from '../lib/seed'
import { CheckResult, ReleaseNotes } from '../lib/updater'
import type { CopyKey, CopyOverrides, DigestCategory, ReminderRule } from '../lib/reminder'
import { createUpdateActions } from './updateSlice'
import { createReminderActions, startReminderRuntime } from './reminderSlice'
export { SNOOZE_DAYS } from './updateSlice'

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
 * Parent dates settle in the same store write as the structural operation.
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

export type StoreSet = (update: Partial<State> | ((state: State) => Partial<State>)) => void

export interface State {
  storageIssue: { kind: 'load' | 'save'; message: string; raw: string | null } | null
  retrySave: () => void
  exportData: () => string
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
  // Chores, habits, notes and the entries written about the first two live
  // outside the three above on purpose — see `Chore`, `Habit`, `Note` and
  // `ItemLog` in types.ts.
  chores: Chore[]
  habits: Habit[]
  notes: Note[]
  itemLogs: ItemLog[]
  /** What the user calls each to-do folder, by `todoGroupId` — see `storage.ts`. */
  todoFolders: Record<string, string>
  /** Per-day planning and the timetable — see `DayPlan` / `ScheduleBlock`. */
  dayPlans: DayPlan[]
  scheduleBlocks: ScheduleBlock[]
  activeView: AppView
  // Bumped by `openGantt` and used as the Gantt page's React key, so clicking
  // the nav item remounts it rather than reusing the mounted one.
  ganttKey: number
  // The same trick for Today: the nav item returns to the Today tab rather
  // than leaving the page on whichever of Today / Tomorrow / This week was
  // last open.
  todayKey: number
  openToday: () => void
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
  /** How the Today and date-detail task lists are ordered. */
  daySort: DaySortMode
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
  /**
   * The restart question is on screen.
   *
   * Not the same thing as `updateReady`, and it needs to be its own flag
   * precisely because "later" keeps the installer: answering the question takes
   * it off the screen without taking back the fact, which is what the version
   * section's restart button reads. `updateOverlay` is the one place the two are
   * read together.
   */
  updateReadyOpen: boolean
  /** Why the install failed, if it did. */
  updateError: string | null
  /**
   * "Not this run" — the notice that GitHub could not be reached has been put
   * away until the app restarts.
   *
   * Session-only, and deliberately not one of the durable preferences beside
   * `updateSnoozeUntil`: a snooze says "leave me alone for a while", and this
   * says "I have read it", which is a fact about this sitting rather than about
   * the week. Restarting asks again, because a network that was down last night
   * is worth retrying without the user having to remember they hid a notice.
   *
   * Hidden rather than cleared: the phase still says the check failed, which is
   * true, and the sidebar's dot and this notice read the same pair of fields so
   * one cannot outlive the other.
   */
  unreachableHidden: boolean
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
  /** The day the start-of-day plan prompt was put off — see `prefs`. */
  planSkippedOn: string | null
  /** A task's usual daily hours, used to prefill the plan dialog. */
  taskDefaultHours: Record<string, number>
  reminderToken: string
  autostart: boolean
  closeToTray: boolean
  reminderPhase: ReminderPhase
  reminderError: string | null
  /** Whether Windows currently has the scheduled task. Asked, never remembered. */
  reminderTaskInstalled: boolean

  setLang: (l: Lang) => void
  setTheme: (t: ThemeId) => void
  setDaySort: (s: DaySortMode) => void
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
  /**
   * Correct the figure on an entry that is already written.
   *
   * The figure and nothing else — no text, no date, which is why the parameter
   * is a number rather than a patch. What a log said and when it said it are the
   * record; how far along the task was is a claim about the task, and a claim
   * typed in a hurry the first time is worth being able to fix. Only on the day
   * it was made, like everything else about an entry: past that it is history,
   * and history is read.
   */
  updateLog: (id: string, targetProgress: number | null) => void

  pauseTask: (id: string) => void
  resumeTask: (id: string) => void
  /**
   * Push a task's end date later and write down why.
   *
   * The guard is in `postponePatch` — later end, non-empty reason, a scheduled
   * phase — so a request that is really an edit is refused rather than recorded
   * as a postponement that never happened.
   */
  postponeTask: (id: string, newEnd: string, reason: string) => void

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

  addChore: (title: string, date: string, slot?: ChoreSlot | null) => void
  updateChore: (id: string, patch: Partial<Chore>) => void
  toggleChore: (id: string) => void
  /** Name a to-do folder, or clear the name by passing a blank one. */
  setTodoFolderName: (groupId: string, name: string) => void
  deleteChore: (id: string) => void

  /**
   * Choose a day's work: `[]` is an explicit rest day, `null` restores the
   * automatic rules. Never writes a log or any "not scheduled" entry.
   */
  setDayPlan: (date: string, taskIds: string[] | null, hours?: Record<string, number>) => void
  /** Put the start-of-day prompt away for today; the corner tag stays. */
  skipTodayPlan: () => void
  /** A task's usual daily hours, prefilled next time it is planned; `null` clears. */
  setTaskDefaultHours: (taskId: string, hours: number | null) => void
  /** The day's available hours; `8` (the default) removes the override. */
  setDayCapacity: (date: string, hours: number) => void
  addScheduleBlock: (input: Omit<ScheduleBlock, 'id'>) => string
  updateScheduleBlock: (id: string, patch: Partial<Omit<ScheduleBlock, 'id' | 'date'>>) => void
  deleteScheduleBlock: (id: string) => void

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
   * Write about a routine or a chore, for today.
   *
   * The task log's counterpart with no figure on it, and the same shape of
   * action: more text joins what is already there as a further paragraph rather
   * than replacing it or starting a second entry. See `ItemLog` in types.ts for
   * why it is its own collection rather than a kind of `TaskLog`.
   *
   * **No date argument**, which is what makes "today is the only day you can
   * write on" structural rather than a rule to remember: there is no way to ask
   * for another day. `addLog` has to check (`isLogDayOpen`); this cannot be
   * asked the question in the first place.
   */
  addItemLog: (kind: ItemLog['kind'], ownerId: string, content: string) => void

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

  /**
   * `manual` is the one thing about the two callers that is allowed to matter.
   * See the implementation.
   */
  runUpdateCheck: (manual?: boolean) => Promise<void>
  /** Put the "cannot reach GitHub" notice away until the next launch. */
  hideUnreachable: () => void
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

/**
 * The plan's per-task hours, limited to the tasks the plan keeps.
 *
 * Zero and every unreadable value mean "no estimate", which is also what an
 * empty map means, so the field disappears rather than storing a row of zeros.
 */
function planHours(
  hours: Record<string, number> | undefined,
  ids: string[],
): Record<string, number> | undefined {
  if (!hours) return undefined
  const out: Record<string, number> = {}
  for (const id of ids) {
    const value = hours[id]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 24) out[id] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function sameHours(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

/**
 * A block as the timetable can draw it, or null.
 *
 * The dialog validates first; this is the door every write comes through, so a
 * bad block cannot reach persistence by another path. A deadline is a point —
 * its end is the start. Everything else must have a positive duration.
 */
function readBlockInput(
  input: Omit<ScheduleBlock, 'id'>,
): Omit<ScheduleBlock, 'id'> | null {
  const date = input.date?.trim() ?? ''
  const title = input.title.trim()
  const taskId = input.taskId?.trim() || undefined
  if (!date || !isHHMM(input.start) || !isHHMM(input.end)) return null
  const deadline = input.deadline === true
  if (!deadline && (minutesOf(input.end) ?? 0) <= (minutesOf(input.start) ?? 0)) return null
  if (!title && !taskId) return null
  return {
    date,
    start: input.start,
    end: deadline ? input.start : input.end,
    title,
    ...(taskId ? { taskId } : {}),
    ...(deadline ? { deadline: true } : {}),
  }
}

const loaded = loadData()
const initialData = loaded.kind === 'loaded' ? loaded.data : buildSeed()
const initial = { ...initialData, tasks: syncParentDates(initialData.tasks, initialData.logs) }
const initialSave = loaded.kind === 'empty' ? saveData(workData(initial)) : { ok: true as const }

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
    daySort,
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
    planSkippedOn,
    taskDefaultHours,
    reminderToken,
    autostart,
    closeToTray,
  } = useStore.getState()
  savePrefs({
    lang,
    theme,
    daySort,
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
    planSkippedOn,
    taskDefaultHours,
    reminderToken,
    autostart,
    closeToTray,
  })
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
 *   - **Explicit repair.** `syncParentDates` remains available for callers
 *     repairing a board. Normal operations already settle dates atomically.
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
// A transient starting board; only the final delta is kept in history.
let gestureStart: Board | null = null
let persistenceDirty = false

function persistWork(): void {
  persistenceDirty = false
  const state = useStore.getState()
  if (state.storageIssue?.kind === 'load') return
  const result = saveData(workData(state))
  if (!result.ok) {
    useStore.setState({ storageIssue: { kind: 'save', message: result.message, raw: null } })
  } else if (state.storageIssue) {
    useStore.setState({ storageIssue: null })
  }
}

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
  const before = gestureStart
  gestureStart = null
  const delta = before ? diffBoard(before, boardOf(useStore.getState())) : null
  if (persistenceDirty) persistWork()
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

export const useStore = create<State>()((rawSet, get) => {
  // Settle derived dates before the write reaches persistence or history.
  const set = (update: Partial<State> | ((state: State) => Partial<State>)) =>
    rawSet((state) => {
      const patch = typeof update === 'function' ? update(state) : update
      if ((patch.tasks && patch.tasks !== state.tasks) || (patch.logs && patch.logs !== state.logs)) {
        return { ...patch, tasks: syncParentDates(patch.tasks ?? state.tasks, patch.logs ?? state.logs) }
      }
      return patch
    })
  return ({
  storageIssue: loaded.kind === 'error'
    ? { kind: 'load', message: loaded.message, raw: loaded.raw }
    : !initialSave.ok ? { kind: 'save', message: initialSave.message, raw: null } : null,
  exportData: () => exportJson(workData(get())),
  retrySave: () => {
    if (get().storageIssue?.kind === 'load') {
      const result = backupStoredData()
      if (!result.ok) {
        set({ storageIssue: { ...get().storageIssue!, message: result.message } })
        return
      }
      set({ storageIssue: null })
    }
    persistWork()
  },
  projects: initial.projects,
  tasks: initial.tasks,
  logs: initial.logs,
  chores: initial.chores,
  habits: initial.habits,
  notes: initial.notes,
  itemLogs: initial.itemLogs,
  todoFolders: initial.todoFolders,
  dayPlans: initial.dayPlans,
  scheduleBlocks: initial.scheduleBlocks,
  lastUndo: null,
  history: EMPTY_HISTORY,
  activeView: 'gantt',
  ganttKey: 0,
  todayKey: 0,
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
  daySort: prefs.daySort,
  todoNoteDismissed: prefs.todoNoteDismissed,
  updatePhase: 'idle',
  updateInfo: null,
  updateHistory: [],
  updateInstalling: false,
  updateReady: false,
  updateReadyOpen: false,
  updateError: null,
  unreachableHidden: false,
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
  planSkippedOn: prefs.planSkippedOn,
  taskDefaultHours: prefs.taskDefaultHours,
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
  setDaySort: (s) => {
    set({ daySort: s })
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
  openToday: () => set((s) => ({ activeView: 'today', todayKey: s.todayKey + 1 })),
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
    const state = get()
    const parent = input.parentId ? state.tasks.find((t) => t.id === input.parentId) : undefined
    const projectId = parent?.projectId ?? input.projectId
    if (!state.projects.some((p) => p.id === projectId)) throw new Error('Task project does not exist')
    if (input.parentId && (!parent || parent.isTodo)) throw new Error('Invalid task parent')
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
        postponements: [],
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
      set((s) => {
        const tasks = editTask(s.tasks, s.projects, id, patch)
        return tasks ? { tasks } : {}
      }),
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
      () => get().updateTask(id, { parentId }),
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
    if (!s.projects.some((p) => p.id === projectId)) return
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
    // A log is only ever written on its own day. Today only — see
    // `isLogDayOpen` for why a future date is refused as well as a past one.
    // The callers hide the way in; this is the line that makes the rule true,
    // so an entry cannot arrive from a path that forgot to ask.
    if (!isLogDayOpen(input.date, get().today)) return ''
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

  // Never persisted, and nothing else has to be told: the notice and the
  // sidebar's dot both read this beside the phase, so one write puts both away.
  updateLog: (id, targetProgress) =>
    set((s) => {
      const target = s.logs.find((l) => l.id === id)
      if (!target || !isLogDayOpen(target.date, s.today)) return {}
      return {
        logs: s.logs.map((l) =>
          l.id === id ? { ...l, targetProgress, updatedAt: new Date().toISOString() } : l,
        ),
      }
    }),

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

  postponeTask: (id, newEnd, reason) => {
    const s = get()
    const task = s.tasks.find((t) => t.id === id)
    if (!task || isArchived(task)) return
    // A parent's window is its children's span, so an end written here would be
    // replaced by the next sync — leaving a record of a postponement the
    // schedule never kept.
    if (s.tasks.some((t) => t.parentId === id && !t.isTodo)) return
    const patch = postponePatch(task, newEnd, reason, s.today)
    if (!patch) return
    set((state) => {
      const tasks = editTask(state.tasks, state.projects, id, patch)
      return tasks ? { tasks } : {}
    })
  },

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

  addChore: (title, date, slot = null) => {
    const now = new Date().toISOString()
    set((s) => ({
      chores: [
        ...s.chores,
        { id: uid(), title, note: '', date, slot, done: false, completedDate: null, createdAt: now, updatedAt: now },
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
  // `set` so the entire branch and its derived dates settle together.
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

  setDayPlan: (date, taskIds, hours) => {
    if (!date) return
    const ids = taskIds === null ? undefined : [...new Set(taskIds)]
    set((s) => {
      const existing = s.dayPlans.find((p) => p.date === date)
      const nextHours = ids === undefined ? undefined : planHours(hours ?? existing?.hours, ids)
      if (!existing) {
        if (ids === undefined) return {}
        return {
          dayPlans: [
            ...s.dayPlans,
            { date, taskIds: ids, ...(nextHours ? { hours: nextHours } : {}) },
          ],
        }
      }
      const same =
        (ids === undefined
          ? existing.taskIds === undefined
          : existing.taskIds !== undefined &&
            existing.taskIds.length === ids.length &&
            existing.taskIds.every((id, i) => id === ids[i])) && sameHours(existing.hours, nextHours)
      if (same) return {}
      const next: DayPlan = { ...existing }
      if (ids === undefined) {
        delete next.taskIds
        delete next.hours
      } else {
        next.taskIds = ids
        if (nextHours) next.hours = nextHours
        else delete next.hours
      }
      // A row exists only while it says something; capacity alone keeps it.
      if (next.taskIds === undefined && next.capacityHours === undefined) {
        return { dayPlans: s.dayPlans.filter((p) => p !== existing) }
      }
      return { dayPlans: s.dayPlans.map((p) => (p === existing ? next : p)) }
    })
  },

  skipTodayPlan: () => {
    set({ planSkippedOn: todayISO() })
    persistPrefs()
  },

  setTaskDefaultHours: (taskId, hours) => {
    if (!taskId) return
    const value = hours !== null && Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours : null
    const current = get().taskDefaultHours
    if (value === null ? current[taskId] === undefined : current[taskId] === value) return
    if (value === null) {
      const next = { ...current }
      delete next[taskId]
      set({ taskDefaultHours: next })
    } else {
      set({ taskDefaultHours: { ...current, [taskId]: value } })
    }
    persistPrefs()
  },

  setDayCapacity: (date, hours) => {
    if (!date || !Number.isFinite(hours)) return
    const value = Math.max(0, Math.min(24, Math.round(hours * 2) / 2))
    set((s) => {
      const existing = s.dayPlans.find((p) => p.date === date)
      if (!existing) {
        if (value === DEFAULT_CAPACITY_HOURS) return {}
        return { dayPlans: [...s.dayPlans, { date, capacityHours: value }] }
      }
      if (existing.capacityHours === value) return {}
      const next: DayPlan = { ...existing }
      if (value === DEFAULT_CAPACITY_HOURS) delete next.capacityHours
      else next.capacityHours = value
      if (next.taskIds === undefined && next.capacityHours === undefined) {
        return { dayPlans: s.dayPlans.filter((p) => p !== existing) }
      }
      return { dayPlans: s.dayPlans.map((p) => (p === existing ? next : p)) }
    })
  },

  addScheduleBlock: (input) => {
    const row = readBlockInput(input)
    if (!row) return ''
    const id = uid()
    set((s) => ({ scheduleBlocks: [...s.scheduleBlocks, { id, ...row }] }))
    return id
  },

  updateScheduleBlock: (id, patch) => {
    set((s) => {
      const existing = s.scheduleBlocks.find((b) => b.id === id)
      if (!existing) return {}
      const { id: _id, ...rest } = { ...existing, ...patch }
      const row = readBlockInput(rest)
      if (!row) return {}
      const next = { id, ...row }
      const same = (['date', 'start', 'end', 'title', 'taskId', 'deadline'] as const).every(
        (key) => existing[key] === next[key],
      )
      return same ? {} : { scheduleBlocks: s.scheduleBlocks.map((b) => (b.id === id ? next : b)) }
    })
  },

  deleteScheduleBlock: (id) =>
    set((s) => ({ scheduleBlocks: s.scheduleBlocks.filter((b) => b.id !== id) })),

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
  // The chore's entries go with it. Nothing else can reach them: they name an id
  // that no longer exists, so the day's record would draw no line for them and
  // no screen lists them — a file that only grows.
  deleteChore: (id) =>
    set((s) => ({
      chores: s.chores.filter((c) => c.id !== id),
      itemLogs: s.itemLogs.filter((l) => !(l.kind === 'chore' && l.ownerId === id)),
    })),

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

  /**
   * The task log's counterpart for a routine or a chore — one entry per item per
   * day, written only today, and only about something that is on today.
   *
   * The two guards below are `toggleHabit`'s, asked of the same functions, and
   * for the same reason: the row that carries the button is drawn from
   * `routineRows` / `todaysChores`, so nothing in the UI can reach a routine
   * that is not running today or a chore that is not on the plate — but "the
   * only thing standing between the two is what the UI happens to draw" is
   * exactly what these guards refuse to rely on.
   */
  addItemLog: (kind, ownerId, content) => {
    set((s) => {
      const text = content.trim()
      // Nothing written is nothing to store, exactly as in `appendNote`. A blank
      // entry would draw a line in the day's record saying something was written
      // there, and would put a card on the Logs page for a day with nothing on it.
      if (!text) return {}
      const date = s.today
      if (kind === 'habit') {
        const habit = s.habits.find((h) => h.id === ownerId)
        // Not running today — ended, not one of its weekdays, suspended.
        if (!habit || !runsOn(habit, date)) return {}
        // A routine with children is a heading, and a heading holds no tick of
        // its own; a log is the same kind of claim, so it holds none either. A
        // task with subtasks is refused on the same grounds in `LogDialog`.
        if (s.habits.some((k) => k.parentId === habit.id)) return {}
      } else {
        const chore = s.chores.find((c) => c.id === ownerId)
        // On today's plate: due and open, or finished today. Asked through
        // `todaysChores` rather than re-deriving it here, so "may this be
        // written about" and "is this on today's list" are one answer.
        if (!chore || todaysChores([chore], date).length === 0) return {}
      }
      const existing = s.itemLogs.find(
        (l) => l.kind === kind && l.ownerId === ownerId && l.date === date,
      )
      const now = new Date().toISOString()
      const next = existing && existing.content.trim() ? `${existing.content}\n\n${text}` : text
      // Stamped like a task's log and a note, through the same comparison: the
      // entry is one block of text, so which paragraph this write added is
      // worked out from the two bodies rather than told.
      const stamps = restamp(existing?.content ?? '', existing?.stamps ?? [], next, logStamp(new Date()))
      return {
        itemLogs: existing
          ? s.itemLogs.map((l) => (l === existing ? { ...l, content: next, stamps, updatedAt: now } : l))
          : [...s.itemLogs, { kind, ownerId, date, content: next, stamps, createdAt: now, updatedAt: now }],
      }
    })
  },

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
      // The whole branch's entries go with it, not only the one asked about —
      // the children go too, and an entry about a routine that was deleted with
      // its parent is an entry about nothing.
      return {
        habits: s.habits.filter((h) => !ids.has(h.id)),
        itemLogs: s.itemLogs.filter((l) => !(l.kind === 'habit' && ids.has(l.ownerId))),
      }
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
    const prepared = prepareData(data)
    if (get().storageIssue?.kind === 'load') {
      const result = backupStoredData()
      if (!result.ok) throw new Error(result.message)
    }
    // Suspended, or the subscriber would record the import itself as a step —
    // one enormous "changed 500" — in the same breath as clearing the tree that
    // step would go on.
    suspended++
    try { set({
      storageIssue: null,
      ...prepared,
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
    }) } finally { suspended-- }
  },

  // One way: the note is an explanation, and a way to ask for it back would be a
  // setting nobody would ever find.
  dismissTodoNote: () => {
    set({ todoNoteDismissed: true })
    persistPrefs()
  },

  ...createUpdateActions(set, get, persistPrefs),

  ...createReminderActions(set, get, persistPrefs),
  })
})

// Persist data (only) to localStorage whenever projects/tasks/logs/chores/habits/
// notes change.
//
// `workData` is the complete snapshot used by both persistence and export.
useStore.subscribe((state, prev) => {
  if (
    state.projects !== prev.projects ||
    state.tasks !== prev.tasks ||
    state.logs !== prev.logs ||
    state.chores !== prev.chores ||
    state.habits !== prev.habits ||
    state.notes !== prev.notes ||
    state.itemLogs !== prev.itemLogs ||
    state.todoFolders !== prev.todoFolders ||
    state.dayPlans !== prev.dayPlans ||
    state.scheduleBlocks !== prev.scheduleBlocks
  ) {
    if (inGesture) persistenceDirty = true
    else persistWork()
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
  if (!gestureStart) gestureStart = boardOf(prev)
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
startReminderRuntime(useStore)

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

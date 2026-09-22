export type TaskStatus = 'todo' | 'not-started' | 'in-progress' | 'completed' | 'paused' | 'delayed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskType = 'phase' | 'long-term'
export type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type AppView = 'gantt' | 'today' | 'calendar' | 'logs' | 'manage' | 'settings'

export interface Project {
  id: string
  name: string
  color: string
  description: string
}

export interface Task {
  id: string
  name: string
  description: string
  parentId: string | null
  projectId: string
  type: TaskType
  // A to-do is unscheduled work parked for later: no dates, no priority, no
  // strict flag, no progress. `isTodo` is authoritative — nothing derives a
  // date, a progress or a rolled-up status onto a task carrying it.
  isTodo: boolean
  startDate: string | null // yyyy-MM-dd (null for long-term goals and to-dos)
  endDate: string | null // yyyy-MM-dd inclusive (null for long-term goals and to-dos)
  strictProgress: boolean // strict: progress accumulates only via daily logs
  // The days a simplified task (`strictProgress: false`) was ticked off, which
  // is the whole of its progress. Dates and nothing else: the point of the
  // simplified rule is that the tick says whether you did the day's work, and no
  // one gets to type in how much it was worth. Deliberately not a `TaskLog` —
  // these must not turn up as history in the Logs page or the day's log count.
  confirmedDays: string[] // yyyy-MM-dd
  paused: boolean
  pauseDate: string | null // yyyy-MM-dd, set while paused
  pauses: { pauseDate: string; resumeDate: string }[]
  priority: TaskPriority | null // null only for to-dos
  tags: string[]
  dependencies: string[] // task ids
  createdAt: string
  updatedAt: string
}

/**
 * A chore — the short, day-sized thing you handle today or tomorrow.
 *
 * Deliberately its own collection rather than a `Task` with a flag. Nothing on
 * the Gantt side reads `chores`, so a chore cannot leak into the tree, the
 * roll-ups, the timeline's range or a project's progress: the isolation is
 * structural instead of a check every one of those places has to remember.
 *
 * `date` is the day it was *put* on and is never rewritten. Carrying unfinished
 * work forward is done by reading (`date <= today`), not by writing, so a chore
 * that has slipped three days still says so, and the day it was originally
 * meant for stays readable. `completedDate` is the other half of that: without
 * it the heatmap would have to credit the day a chore was *assigned*, so
 * finishing Monday's chore on Tuesday would turn Monday green retroactively.
 */
export interface Chore {
  id: string
  title: string
  note: string // one line, may be empty
  date: string // yyyy-MM-dd, the day it was put on; never rewritten
  done: boolean
  completedDate: string | null // yyyy-MM-dd, null while open. The heatmap reads this
  createdAt: string
  updatedAt: string
}

/**
 * A habit — the thing you do every day, which finishing does not remove.
 *
 * Its own collection rather than a flag on `Chore`, because the two are governed
 * by opposite rules. A chore has a debt: undone, it carries forward day after
 * day, and `date` records the day it was originally meant for. A habit has no
 * debt — skipping yesterday does not mean doing it twice today — so it neither
 * carries nor accumulates a "how late" figure. A single `done` flag meaning both
 * "this thing is finished" and "today's instance is finished" would put that
 * question to every one of the twelve places that read `chore.done`.
 *
 * `startDate`/`endDate`/`weekdays` are load-bearing, not bookkeeping: opening
 * the day panel on a date a month back, a habit that did not exist yet must not
 * appear in that day's record as an unticked line, and neither must one that was
 * never meant to run that day. "Which habits were on this day" is `runsOn` in
 * `lib/habits.ts`, and it is the only place that answer is written down.
 *
 * One entry per day in `doneDays`: ticked appends, unticking removes. That array
 * is the whole history, and while it grows with time it gains at most one entry
 * a day, which is far lighter than a log.
 */
export interface Habit {
  id: string
  title: string
  note: string // one line, may be empty
  startDate: string // yyyy-MM-dd, the day it was put on; never rewritten
  endDate: string | null // yyyy-MM-dd inclusive, null while it runs on
  /**
   * The days of the week it runs on, 0 = Monday … 6 = Sunday.
   *
   * Never empty: "every day" is stored as all seven rather than as an empty
   * array. Empty-means-everything reads well in a filter and badly on screen —
   * turning all seven buttons off would then mean "every day", which is the one
   * thing the person doing it plainly does not mean. All seven is also what
   * every habit written before this field existed is backfilled to.
   */
  weekdays: number[]
  /**
   * Suspended: off the daily list from `pauseDate` on, but still ticked in the
   * past and still on the days it was actually run.
   *
   * The same three fields `Task` carries, and for the same reason rather than
   * for symmetry. A lone `paused` boolean forgets the pause the moment it is
   * lifted, and the days it covered then read as days the habit was skipped —
   * the precise falsehood `runsOn` exists to prevent. `isPausedOnDay` already
   * answers this over `[pauseDate, resumeDate)`, so there is nothing new here.
   */
  paused: boolean
  pauseDate: string | null // yyyy-MM-dd, set while paused
  pauses: { pauseDate: string; resumeDate: string }[]
  doneDays: string[] // yyyy-MM-dd, the days it was ticked
  createdAt: string
  updatedAt: string
}

export interface TaskLog {
  id: string
  taskId: string
  date: string // yyyy-MM-dd
  content: string // raw text; newline = item, leading tabs = nesting
  targetProgress?: number | null // 0..100, strict phase tasks only
  createdAt: string
  updatedAt: string
}

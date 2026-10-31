export type TaskStatus = 'todo' | 'not-started' | 'in-progress' | 'completed' | 'paused' | 'delayed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'top'
export type TaskType = 'phase' | 'long-term'
export type ViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type AppView = 'gantt' | 'today' | 'calendar' | 'logs' | 'manage' | 'settings'
/** How the Today and date-detail task lists are ordered. */
export type DaySortMode = 'status' | 'priority'

export interface Project {
  id: string
  name: string
  color: string
  description: string
}

/** One push of a task's end date, with the reason it was made. */
export interface Postponement {
  /** yyyy-MM-dd, the day the decision was written. */
  date: string
  /** The end date before and after the push. */
  from: string
  to: string
  reason: string
}

/**
 * A day's own plan: which tasks were chosen for it, and how much room it has.
 *
 * `taskIds` is deliberately optional rather than a `planned: boolean` plus a
 * list — two fields can contradict each other, one cannot:
 *   absent   never planned; the old automatic day rules still apply
 *   []       planned as a rest day: the day owes nothing
 *   [id...]  only these tasks count for the day
 *
 * A row may exist only to carry `capacityHours`; row presence therefore does
 * not mean "planned". Ask `planOn` / `plannedIds` in lib/schedule.ts.
 */
export interface DayPlan {
  date: string // yyyy-MM-dd, one per day
  taskIds?: string[]
  /** Hours available that day; absent = not filled, and the load is unknown. */
  capacityHours?: number
  /**
   * How many hours each planned task is expected to take *that day*.
   *
   * Per day rather than per task: the same task can be a forty-hour project
   * worked on in two-hour slices. Keys are always a subset of `taskIds`; a task
   * with no entry contributes nothing until the timetable blocks it.
   */
  hours?: Record<string, number>
}

/**
 * One block on the day timetable: a task session, a free event, or a deadline.
 *
 * `title` is a snapshot taken when the block is written, so a block whose task
 * is later deleted still reads. It is what the timetable draws: a title the
 * user typed is the block's own name, while the default (the task's name at the
 * time) follows a rename — see `updateTask`. A deadline is a zero-length
 * marker: `end === start` and `deadline: true`.
 */
export interface ScheduleBlock {
  id: string
  date: string // yyyy-MM-dd
  start: string // HH:MM
  end: string // HH:MM; equals start for a deadline
  title: string
  taskId?: string
  deadline?: boolean
}

export interface Task {
  id: string
  name: string
  description: string
  parentId: string | null
  projectId: string
  // null only for to-dos.
  //
  // A to-do has no type yet. Its creation form no longer asks — the field was
  // there but disabled, which is a question that cannot be answered at that
  // point, and writing 'phase' into it anyway was the app answering for the
  // user. `StartTodoDialog` asks when the work actually begins, and that answer
  // is what lands here.
  type: TaskType | null
  // A to-do is unscheduled work parked for later: no dates, no priority, no
  // type, no strict flag, no progress. `isTodo` is authoritative — nothing
  // derives a date, a progress or a rolled-up status onto a task carrying it.
  isTodo: boolean
  startDate: string | null // yyyy-MM-dd (null for long-term goals and to-dos)
  endDate: string | null // yyyy-MM-dd inclusive (null for long-term goals and to-dos)
  /**
   * The hard date the work is promised for, or null.
   *
   * A commitment, not a span: it is independent of `endDate` and passing it
   * makes the task late even while the planned window is still open. Date-only,
   * like the dates above. Optional so saves written before it, and hand-edited
   * files, load unchanged.
   */
  deadline?: string | null
  /**
   * The window this task had of its own, put aside for as long as it is a
   * container.
   *
   * A phase parent has no window of its own — its dates *are* its children's
   * span, and `syncParentDates` keeps the stored pair in step with that span
   * because the bar and the axis read the stored pair rather than the derived
   * one. Which makes the pair a cache; and a cache written over the thing it
   * caches loses it for good. That is what happened: with a single child, the
   * parent's own dates were replaced by that child's on the day it was added,
   * and deleting the child again left the parent wearing them — an add and a
   * delete that did not cancel out.
   *
   * So the pair the user set moves here on the write that first makes the task a
   * container, and goes back onto the task on the write where it stops being
   * one. While the task is a leaf — the only time those two fields are editable
   * — this is always absent.
   */
  ownWindow?: { start: string | null; end: string | null }
  strictProgress: boolean // strict: progress accumulates only via daily logs
  // The days a simplified task (`strictProgress: false`) was ticked off, which
  // is the whole of its progress. Dates and nothing else: the point of the
  // simplified rule is that the tick says whether you did the day's work, and no
  // one gets to type in how much it was worth. Deliberately not a `TaskLog` —
  // these must not turn up as history in the Logs page or the day's log count.
  confirmedDays: string[] // yyyy-MM-dd
  paused: boolean
  pauseDate: string | null // yyyy-MM-dd, set while paused
  /**
   * Why the pause that is still open happened, while paused. The closed pairs
   * below carry their own reason; this is the one place the open pause can keep
   * one, because an open pause is not yet in `pauses`.
   */
  pauseReason?: string | null
  pauses: { pauseDate: string; resumeDate: string; reason?: string }[]
  /**
   * Every time the end date was pushed back, oldest first.
   *
   * A record, not a schedule input: the dates on the task are the schedule, and
   * this says how they got there and why. Kept on the task rather than in a
   * collection of its own for the reason `archivedAt` gives — a task field rides
   * through export, import and the save subscriber by object spread.
   */
  postponements: Postponement[]
  priority: TaskPriority | null // null only for to-dos
  /**
   * Where this task sits among its siblings, once the user has said so by
   * dragging it. Absent means "no opinion": the sibling list falls back to the
   * date-and-name sort it has always used.
   *
   * Deliberately not backfilled on load. Deriving an order for every task from
   * the sort it happens to be in would freeze today's arrangement as a fact —
   * and a task created tomorrow with an earlier start date, which today appears
   * above its siblings, would then be appended to the bottom instead.
   *
   * Sparse by design, and every value is relative to the other members of one
   * sibling list: `moveTasks` renumbers the whole group on every drop, so a
   * group is either wholly ordered or not ordered at all.
   */
  order?: number
  /**
   * When the task was filed away, as an ISO instant. Absent means it is on the
   * board.
   *
   * A field rather than a collection of its own, and not a matter of taste: a
   * new collection has to be named in six places (the store's state, its
   * initial write, `importData`, the save subscriber's condition *and* its
   * literal, `exportJson`, `parseImport`), and every one of them that is missed
   * drops the data silently on the next save. A task field rides through all of
   * them by object spread.
   *
   * Archiving is only ever offered on a task that is completed, and it takes
   * the whole subtree with it — a child left live under an archived parent is a
   * task nothing can draw and nothing can reach. See `archiveTasks`.
   */
  archivedAt?: string
  tags: string[]
  dependencies: string[] // task ids
  createdAt: string
  updatedAt: string
}

/**
 * The part of the day a chore belongs to: 凌晨 0–7, 上午 7–12, 下午 12–18,
 * 晚上 18–24.
 *
 * The boundaries are `slotOfTime`'s, in `lib/chores.ts`, and they are written
 * down there once. They matter in exactly one place: a chore carries this slot
 * from the moment it is created, and a precise `time` typed later *may* fall in
 * a different one — which is a question for the person who typed it, not a rule
 * for the code to settle quietly.
 */
export type ChoreSlot = 'dawn' | 'am' | 'pm' | 'eve'

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
  /**
   * The part of the day it belongs to, chosen when it is created, or null when
   * nothing was chosen. Null is what every chore written before this existed
   * reads as, which is why it is a value rather than a default of `'am'`: the
   * group it lands in has to be the group that means "nobody said".
   *
   * Unknown words from a hand-edited file read as null too — see `choreSlot`.
   */
  slot?: ChoreSlot | null
  /**
   * A precise time of day, `HH:MM`, or null for none.
   *
   * Optional and note-like: it is typed into the edit dialog only, by someone
   * who wants to be exact, and it is only ever a sort key inside its slot —
   * chores that have one come before the ones that do not, earliest first.
   * Nothing is measured against it, and nothing is late at 12:01: the point of
   * asking for a rough slot first is to keep the day from turning back into a
   * schedule.
   *
   * It may disagree with `slot` — the two are typed in different places at
   * different times. `ChoreDialog` asks which one wins rather than picking.
   */
  time?: string | null
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
  /**
   * The routine this one hangs under, or null at the top.
   *
   * A routine that has children is a **heading, not a checkbox**: what it shows
   * is its children's ticks, exactly as a phase task's progress is its
   * subtasks'. So its own `weekdays`, `endDate`, `paused` and `doneDays` are not
   * read once it has one — the same bargain `syncParentDates` strikes for a task
   * parent's window. `routineRows` in `lib/habits.ts` is where that is written
   * down, and the only place anything reads this field.
   */
  parentId: string | null
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

/**
 * A day's notebook — the thing you write and never tick off.
 *
 * Its own collection rather than a `Task` or a `Chore`, and the difference is
 * one word: *state*. A task has a status, a chore has a `done`. A note has
 * neither, and that is the whole point of it — the feature exists because the
 * user was parking stray writing in a task called "supplement for logs", where
 * it silently acquired a schedule, a priority, a progress and a log obligation
 * it never asked for.
 *
 * **One per day, keyed by `date`.** A day is a single box you keep adding to,
 * not a list of entries — so there is nothing to distinguish one write from the
 * next, and no `id`. A collection keyed by its own date cannot hold two notes
 * for one day, which makes "one note per day" a property of the shape rather
 * than a rule every write path has to remember.
 *
 * `updatedAt` is the last write and nothing else. There is deliberately no
 * `createdAt`: a box edited over a week has no single beginning, and the writer
 * is the Logs page's day card, which needs to say *when it was last touched* if
 * it says anything at all.
 *
 * Nothing reads `notes` except the Logs page, the day panel and the Today page.
 * Not the tree, not the roll-ups, not the timeline, not the reminder digest,
 * not the heatmap — the isolation is structural rather than a check each of
 * those places has to remember, exactly as it is for `Chore` and `Habit`.
 */
/**
 * One paragraph's provenance: when it was written, and every later edit that
 * changed it.
 *
 * A paragraph is a blank-line-separated block — the unit both texts already
 * have, and the one the log's own display has always drawn a rule in front of.
 * `at` is the write that created it; `edited` is the writes that came back and
 * changed it, oldest first.
 *
 * The list is the record and the corner prints its last entry: what a reader
 * wants from a paragraph is when it was last touched, but the fact that it was
 * touched three times happened, and throwing it away at the moment of writing
 * would be a decision the data cannot take back.
 *
 * Optional, and one per block in order. A block with no entry is drawn with no
 * stamp at all, which is what a hand-edited file or a body from before this
 * existed should look like rather than a wrong time.
 */
export interface Stamp {
  /** `HH:MM`, local. */
  at: string
  edited?: string[]
}

export interface Note {
  date: string // yyyy-MM-dd, and the identity of the note
  body: string // free text; a newline is a newline
  updatedAt: string
  /** One per paragraph of `body` — see `Stamp`. */
  stamps?: Stamp[]
}

/**
 * A sticky note on the corkboard beside the app.
 *
 * Its own collection, and not a `Note`: a notebook page belongs to a day and is
 * a record of that day, while a sticky leans on screen until it is taken down.
 * A blank sticky is still a card the user made, so it is kept; the notebook's
 * blank text is a deletion.
 *
 * Positions are viewport pixels. `docked` is membership of the board, not a
 * coordinate system: a detached card keeps its viewport point and stays visible
 * while the board is collapsed. `z` orders the cards among themselves; the
 * layer they render in has one fixed z-index, so a card count cannot push them
 * above the confirmation dialogs.
 */
export interface StickyNote {
  id: string
  /**
   * The name shown when the note is snapped shut. Created as "标签 N" and
   * stored; old saves are backfilled on load.
   */
  name?: string
  /**
   * The body. Plain text for notes written before formatting existed; sanitized
   * HTML (`<b>`, `<font color size>`) once `rich` is true.
   */
  text: string
  x: number // viewport px, card top-left
  y: number
  /** Card size in viewport px; absent means the default. */
  w?: number
  h?: number
  z: number // stacking among cards; higher = nearer
  /** Shown only while the corkboard is open. */
  docked: boolean
  /**
   * Collapsed against the page: the top edge, the left edge (the sidebar's
   * right) or the right edge. A snapped note draws as a name chip, not a card.
   */
  snapped?: 'top' | 'left' | 'right' | null
  /** Where the chip sits along that edge: x on the top, y on the sides. */
  snapAt?: number
  /** `text` is HTML with the basic formatting commands, not plain text. */
  rich?: boolean
  createdAt: string
  updatedAt: string
}

/**
 * A day's entry about a routine or a chore — the task log's counterpart, with
 * no figure on it.
 *
 * Its own collection rather than a field on `Habit` or `Chore`, and *not* an
 * entry in `logs`, for one reason: everything that reads a log wants the
 * percentage attached to it. `taskProgress`, `strictLogRate`, `boardDayTallies`
 * and the reminder digest's `collectDay` all read `logs`, and a routine's entry
 * living there would put "which kind of log is this" into every one of them.
 * What a routine log is worth is a sentence, and nothing measures it — so the
 * isolation here is structural rather than a check each of those places has to
 * remember, exactly as it is for `Chore` and `Habit` themselves.
 *
 * Nothing on the Gantt side reads `itemLogs` at all. The two places that do are
 * the day's record (the Logs page's day card and `DayLogsModal`), which is the
 * whole point of writing one.
 *
 * **One entry per item per day**, which is why there is no `id`: the identity is
 * the triple below, and a collection keyed by it cannot hold two entries for one
 * day. Writing again joins the new text onto the same entry as a further
 * paragraph, exactly as `addLog` does for a task — see `Note`, which is the same
 * arrangement one level up.
 */
export interface ItemLog {
  /** Which collection `ownerId` names. */
  kind: 'habit' | 'chore'
  ownerId: string
  date: string // yyyy-MM-dd
  content: string // raw text; newline = item, leading tabs = nesting
  /** One per paragraph of `content`, in order — see `Stamp`. */
  stamps?: Stamp[]
  createdAt: string
  updatedAt: string
}

export interface TaskLog {
  id: string
  taskId: string
  date: string // yyyy-MM-dd
  content: string // raw text; newline = item, leading tabs = nesting
  /**
   * One entry per paragraph of `content`, in order — see `Stamp`. The first
   * paragraph's `at` is when the entry was written, so it always opens with a
   * reading rather than only where more was added to.
   *
   * A field rather than a line in `content`, where it used to live: a stamp
   * inside the user's text is a stamp they can edit or delete, and the only
   * right answer here is the clock. What separates one write from the next is
   * the blank line between them, which is the writer's own paragraph break.
   *
   * Optional because every entry written before this existed has its stamps
   * still in the content — `liftTimes` in `lib/logs.ts` moves them on load.
   */
  stamps?: Stamp[]
  targetProgress?: number | null // 0..100, strict phase tasks only
  createdAt: string
  updatedAt: string
}

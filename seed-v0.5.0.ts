import { Chore, Note, Project, Task, TaskLog, TaskPriority, TaskType } from '../types'
import { addDays, toISO } from './dates'

// The demo dataset, kept for putting a filled board in front of yourself.
// `src/lib/seed.ts` is an empty stub now, so this no longer reaches a new
// install — `scripts/demo-seed.mjs` writes it out as a JSON file and you import
// that by hand.
//
// The name is where it came from, not what it holds: it was `seed.ts` the last
// time that file was taken off `main`, and the specs below have been added to
// since — the archive (`archived`), and the two shapes a log's timestamps come
// in (see `LOG_SPECS`). Anything a later build can do that this dataset cannot
// show is a feature nobody can see without building it first.
//
// Dates are day offsets from today (`d(offset)`), so it never goes stale — a
// task described as "in progress" always straddles the current date, however
// long ago this file was written.
//
// `progress` and `status` are deliberately absent: both are derived now
// (src/lib/progress.ts, src/lib/tree.ts). What they derive to depends on the
// task's kind:
//
//   - A **strict** task counts logs. Its number is the target on its latest log.
//   - A **simplified** task (`strict: false`, the default being strict now)
//     counts the days ticked off by hand (`confirmed`). Days you did not tick
//     count for nothing, so its ceiling is still the share of the window that
//     has elapsed — you cannot tick a day that has not happened. The old rule
//     derived that share for you; the new one is what you actually earned of it,
//     which is why a few of the entries below deliberately sit below the line.
//   - A window that closed with every tickable day ticked reads 100%
//     (completed); one that closed with gaps reads overdue.
interface Spec {
  id: string
  name: string
  parent?: string
  project: string
  type?: TaskType
  isTodo?: boolean
  // Day offsets from today. Omitted on a to-do, which has no schedule at all.
  start?: number
  end?: number
  // Strict phase leaf: progress accrues only from logs. Only ever set on leaves
  // — a parent's progress is the average of its children's, so the flag would do
  // nothing there.
  strict?: boolean
  // Simplified phase leaf: the days ticked off. Only ever set on leaves, for the
  // same reason. A paused day does not belong here — it leaves the denominator
  // as well as the numerator, so listing one would count it twice.
  confirmed?: number[]
  paused?: boolean
  pause?: number
  // Closed pause/resume cycles, as [pauseOffset, resumeOffset] pairs.
  pauses?: [number, number][]
  priority?: TaskPriority
  /**
   * Task ids this one waits on, rendered in the detail panel.
   *
   * The only way to see a dependency at all: the model has the field, the panel
   * draws it, and **nothing in the UI writes it** — the form has no picker, so a
   * dependency can arrive from an import and nowhere else. That is worth knowing
   * before reading this line as "the demo shows the feature"; what it shows is a
   * feature that is half-built, and the half that is missing is the one a user
   * would reach for.
   */
  dependencies?: string[]
  /**
   * Where this row sits among its siblings, once somebody has said so by
   * dragging it.
   *
   * Set on a whole sibling group or on none of it — the app renumbers a list on
   * every drop, so a group is either wholly arranged or not arranged at all, and
   * a mixed one is a state only a hand-edited file can be in.
   */
  order?: number
  desc?: string
  tags?: string[]
  // Day offset it was filed away on. Set on the **root** of an archived branch
  // and nowhere else, on purpose: the app archives a whole subtree and repairs a
  // live child under an archived parent on the way in (`storage.ts`
  // `repairArchive`), and the demo script asserts that the children below come
  // back archived without the file having said so.
  archived?: number
}

const PROJECTS: Project[] = [
  { id: 'course', name: 'Course', color: '#4ade80', description: 'Coursework and study plan' },
  { id: 'french', name: 'French', color: '#a78bfa', description: 'French A1–A2 study' },
  { id: 'team', name: 'Competition Team', color: '#fb923c', description: 'RoboMaster competition team' },
  { id: 'stm32', name: 'STM32', color: '#60a5fa', description: 'Embedded / motor control project' },
  { id: 'personal', name: 'Personal', color: '#2dd4bf', description: 'Personal goals' },
  // A project with nothing in it, on purpose. It draws its own line on the
  // board — a project nobody can see is a project nobody can put a task in — and
  // it is greyed out in the hierarchy manager, where a project with no rows is
  // not a unit: merging it would only make it disappear, with nothing on screen
  // to show for it.
  { id: 'reading', name: 'Reading', color: '#fbbf24', description: 'Nothing filed here yet — the empty-project case.' },
]

// Two entries below exist for the archive, and they are the two halves of it:
// one branch is **already filed away** (so the drawer at the bottom of the left
// column is not empty the moment this board is imported), and one is **finished
// and still on the board** (so there is something to press 归档 on, and to watch
// what that does to the numbers around it).
//
// Any status can be filed away, so the sharpest case is one of the existing
// ones: archive `team-vision` — strict, still running, and a child of
// `team-algo`. The parent's percentage must not move. A roll-up that skipped
// filed-away children would drop it the moment the child went into the drawer.
const SPECS: Spec[] = [
  // Long-term goals (open-ended: real start, no end)
  { id: 'fr-goal', name: 'Become conversational', project: 'french', type: 'long-term', start: -120, desc: 'Open-ended goal — no end date, no progress.' },
  { id: 'pe-goal', name: 'Master embedded systems', project: 'personal', type: 'long-term', start: -200, desc: 'Open-ended goal with a scheduled sub-goal under it.' },
  { id: 'pe-goal-robot', name: 'Build a personal robot', parent: 'pe-goal', project: 'personal', start: 30, end: 90 },

  // STM32
  { id: 'stm-chassis', name: 'Chassis & Drive', project: 'stm32', start: -14, end: 35, order: 1, desc: 'Parent whose end date is synced from its children.' },
  { id: 'stm-motor', name: 'Motor driver board', parent: 'stm-chassis', project: 'stm32', start: -14, end: 9 },
  { id: 'stm-motor-sch', name: 'Schematic design', parent: 'stm-motor', project: 'stm32', start: -14, end: -8, confirmed: [-14, -13, -12, -11, -10, -9, -8], desc: 'Every tickable day ticked and the window closed → 100%, completed. Archive this one to see the rule that matters: it is a finished child of a parent that is still running, and the parent’s number must not move when it is filed away.' },
  { id: 'stm-motor-pcb', name: 'PCB layout', parent: 'stm-motor', project: 'stm32', start: -8, end: 0, confirmed: [-8, -7, -6, -5, -4, -3, -2, -1, 0], desc: 'Closes today with every day ticked, so it reads 100% while still on today’s list — shows as struck through.' },
  { id: 'stm-motor-test', name: 'Bring-up & test', parent: 'stm-motor', project: 'stm32', start: 0, end: 9, strict: true, priority: 'high', dependencies: ['stm-motor-pcb'], desc: 'Strict task with a log written today, and it waits on the board layout — open it and the detail panel names what it depends on.' },
  { id: 'stm-mach', name: 'Chassis machining', parent: 'stm-chassis', project: 'stm32', start: 14, end: 34 },
  { id: 'stm-fw', name: 'Control firmware', project: 'stm32', start: -2, end: 70, order: 0, desc: 'The three roots of this project are the one arranged group on the board: nothing was dragged, the order was simply set, and it puts firmware above the chassis although the chassis starts twelve days earlier. Every other sibling list is unarranged and still sorts by date.' },
  { id: 'stm-can', name: 'CAN bus driver', parent: 'stm-fw', project: 'stm32', start: -2, end: 13, strict: true, desc: 'Strict task with a log written today.' },
  { id: 'stm-pid', name: 'PID tuning', parent: 'stm-fw', project: 'stm32', start: -2, end: 6, strict: true, priority: 'high', desc: 'Strict, but today’s log is missing — logged yesterday only, so it wears the No log badge and counts against the ring.' },
  { id: 'stm-aim', name: 'Auto-aim algorithm', parent: 'stm-fw', project: 'stm32', start: 28, end: 72, priority: 'top', dependencies: ['team-vision'], desc: 'Top priority, and depends on a task in **another** project — a dependency is an id, so nothing stops it crossing projects, and the panel resolves it wherever it lives.' },
  { id: 'stm-test', name: 'Integration testing', project: 'stm32', start: 56, end: 76, order: 2 },
  { id: 'stm-field', name: 'Field test', parent: 'stm-test', project: 'stm32', start: 56, end: 76 },
  { id: 'stm-todo-mosfet', name: 'Pick a MOSFET', parent: 'stm-chassis', project: 'stm32', isTodo: true, desc: 'Unscheduled to-do parked under a scheduled parent.' },
  { id: 'stm-todo-encoder', name: 'Pick an encoder', parent: 'stm-chassis', project: 'stm32', isTodo: true, desc: 'The second one under the same parent — which is what makes the two of them a folder rather than two loose rows. It is named below, in `TODO_FOLDERS`.' },

  // Competition Team
  { id: 'team-design', name: 'Conceptual design', project: 'team', start: -30, end: -16, confirmed: [-30, -29, -28, -27, -26, -25, -24, -23, -22, -21, -20, -19, -18, -17, -16], priority: 'high', desc: 'Reaches the left end of the axis — the range starts 30 days back — and is ticked the whole way, so it closed at 100%.' },
  // --- Finished, still on the board, waiting to be filed away. ---
  // The one to press 归档 on. Three things it shows that a plain finished leaf
  // cannot: the confirmation counts the to-do underneath it (a to-do is left out
  // of its parent's roll-up, so it cannot stop the parent from reading as done —
  // which is why the warning exists), the branch goes as one piece, and the
  // numbering below it closes up. Its bar stops at the axis start rather than
  // past it, so the timeline does not move when the branch leaves.
  { id: 'team-proto', name: 'Prototype build', project: 'team', start: -28, end: -15, desc: 'Complete and still on the board — this is the one to archive. Watch the numbers around it: a finished child of a live parent takes nothing with it.' },
  { id: 'team-proto-frame', name: 'Frame assembly', parent: 'team-proto', project: 'team', start: -28, end: -15, confirmed: [-28, -27, -26, -25, -24, -23, -22, -21, -20, -19, -18, -17, -16, -15], desc: 'Finished, and the reason its parent reads as complete.' },
  { id: 'team-todo-bom', name: 'Settle the BOM', parent: 'team-proto', project: 'team', isTodo: true, desc: 'Never scheduled, never finished, and sitting inside a complete branch. Archiving the branch takes this with it, and the confirmation says how many like it are going.' },
  { id: 'team-sim', name: 'Dynamics simulation', project: 'team', start: -26, end: -14, strict: true, desc: 'Third strict task in the early window — three to cover on those days, so the ring shows thirds rather than only halves.' },
  { id: 'team-mech', name: 'Mechanical', project: 'team', start: -14, end: -2, confirmed: [-14, -13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3], priority: 'high', desc: 'A closed window with one day never ticked — reads overdue rather than done. The calendar used to finish this one on its own.' },
  { id: 'team-elec', name: 'Electrical', project: 'team', start: -5, end: 25, confirmed: [-5, -4, -3, -2, -1, 0], desc: 'Ticked every day so far — a simplified task kept up with, so its number matches the share of the window elapsed.' },
  { id: 'team-algo', name: 'Algorithm', project: 'team', start: 0, end: 60 },
  { id: 'team-vision', name: 'Vision', parent: 'team-algo', project: 'team', start: 0, end: 40, strict: true, desc: 'Strict task with a log written today.' },
  { id: 'team-decision', name: 'Decision', parent: 'team-algo', project: 'team', start: 20, end: 60 },

  // French
  { id: 'fr-u4', name: 'Unité 4', project: 'french', start: -30, end: -8, strict: true, desc: 'Strict unit carried across three weeks — holds most of the log history.' },
  { id: 'fr-u5', name: 'Unité 5', project: 'french', start: -7, end: 21, strict: true, desc: 'Strict, logged on a few days and with no target on any log. That shape cannot be written any more — the progress fields are mandatory — so this one stands for data from before that, and falls back to logged-days ÷ countable-days.' },
  { id: 'fr-anki', name: 'Anki review', project: 'french', start: -3, end: 4, confirmed: [-3, -2, -1, 0], tags: ['anki'], desc: 'Simplified, but still carries journal logs — a log on a simplified task is a note to yourself, not a progress figure.' },
  { id: 'fr-listen', name: 'Listening practice', project: 'french', start: 5, end: 12 },
  { id: 'fr-todo-podcast', name: 'Podcast listening', project: 'french', isTodo: true },

  // Course
  { id: 'co-python', name: 'Python', project: 'course', start: -30, end: -1, confirmed: [-30, -29, -28, -27, -26, -24, -23, -22, -21, -20, -18, -17, -16, -15, -14, -12, -11, -10, -8, -7, -6, -4, -3, -1], desc: 'A closed window with six days never ticked → overdue. Under the old rule a closed window read 100% of its own accord; now only the days you ticked count, so this is the state that did not use to exist.' },
  { id: 'co-stats', name: 'Probability & Statistics', project: 'course', start: -28, end: -12, strict: true, priority: 'high', desc: 'Strict, window closed, and no target on any log — the other sample of the pre-mandatory shape, settling at the share of days actually logged.' },
  { id: 'co-pytorch', name: 'PyTorch', project: 'course', start: 0, end: 30 },
  // --- Already filed away. ---
  // The drawer at the bottom of the left column holds this branch on import, so
  // the archive is visible without using the feature first. Three things to look
  // at: it reaches back to -60 while the axis still starts at -30 (a filed-away
  // task is not on the schedule, so the timeline ignores it), the to-do inside
  // went with it (that is what the cascade is for), and the whole branch is
  // read-only until it is brought back.
  //
  // Only the root carries `archived`: the children are archived on the way in by
  // `normalize`'s repair, which is the same code that rescues a hand-edited file.
  // `scripts/demo-seed.mjs` asserts they come back filed away.
  { id: 'co-found', name: 'Foundations', project: 'course', start: -60, end: -44, archived: -7, desc: 'Finished and filed away a week ago. Find it in the Archived group at the bottom of the left column; it comes back from there, or from Manage.' },
  { id: 'co-found-git', name: 'Git & tooling', parent: 'co-found', project: 'course', start: -60, end: -45, confirmed: [-60, -59, -58, -57, -56, -55, -54, -53, -52, -51, -50, -49, -48, -47, -46, -45], desc: 'Finished, and filed away with its parent.' },
  { id: 'co-todo-notes', name: 'Rewrite the lecture notes', parent: 'co-found', project: 'course', isTodo: true, desc: 'A to-do that went into the archive with its parent. It never stopped being unfinished — which is exactly why the confirmation counts them before it files a branch away.' },
  { id: 'co-mlp', name: 'MLP', parent: 'co-pytorch', project: 'course', start: 0, end: 12 },
  { id: 'co-cnn', name: 'CNN', parent: 'co-pytorch', project: 'course', start: 12, end: 30 },

  // Personal
  { id: 'pe-read', name: 'Reading', project: 'personal', start: -20, end: 20, paused: true, pause: -3, confirmed: [-20, -19, -18, -17, -16, -15, -13, -12, -11, -10, -8, -6], desc: 'Currently paused — shows a Paused badge and is skipped by the log ring. The days from the pause onward leave the denominator, so the ticks before it are not diluted by a stretch nobody could have worked.' },
  { id: 'pe-fitness', name: 'Fitness', project: 'personal', start: -14, end: 60, confirmed: [-14, -13, -12, -11, -8, -7, -6, -5, -4], pauses: [[-10, -8]], tags: ['health'], desc: 'Was paused once and resumed — carries pause history. Nothing is ticked inside the pause, because those days are not in the denominator either.' },
  { id: 'pe-todo-sicp', name: 'Work through SICP', project: 'personal', isTodo: true },
]

interface LogSpec {
  id: string
  taskId: string
  offset: number
  content: string
  targetProgress: number | null
  /**
   * The clock readings, one per paragraph, as `TaskLog.stamps` holds them.
   *
   * Two shapes appear below on purpose, because both still exist in the wild and
   * only one of them is what the app writes now:
   *
   *   - **`stamps` set** — the current shape. The reading is a field, the text is
   *     only the text, and the editor never shows the time.
   *   - **a `— HH:MM —` line at the top of `content`, no `stamps`** — what every
   *     build before v0.10.0 wrote into the body itself. Loading it lifts the
   *     line out and leaves the reading in the field; if that ever stops
   *     happening, the entry draws the clock twice, once from the field and once
   *     from the text. One log below is left in this shape so that stays visible.
   */
  stamps?: string[]
}

// A month of history, today included.
//
// Two jobs, and they pull in opposite directions. The strict logs below drive
// the day panel's coverage ring, so they are deliberately gappy — all three
// states (every strict task logged, only some, none) have to be reachable.
// The journal entries add volume without touching that: a log on a simplified
// task carries no progress and owes nothing to the ring, so it can fill a day
// freely. They exist because the Logs page shows at most two tasks per day and
// at most two items per task before collapsing into "+N more" — a day with one
// task logged never exercises any of that.
const LOG_SPECS: LogSpec[] = [
  // --- Unité 4, a strict unit closed out over three weeks. The gaps (-27, -24,
  //     -21, -19, -16, -14, -12, -10) are intentional. ---
  // The **old shape**: the reading is the first line of the body, and there is no
  // `stamps` beside it — the way every build before v0.10.0 wrote a log. Loading
  // this one lifts `— 08:40 —` out of the text and into the field; the body keeps
  // the paragraph it opened. Open it in the panel and there is one clock, not two.
  { id: 'log-fr-u4-29', taskId: 'fr-u4', offset: -29, content: '— 08:40 —\n- Leçon 1: passé composé\n\t- avoir + participe passé\n- 20 new words into Anki', targetProgress: 8 },
  { id: 'log-fr-u4-28', taskId: 'fr-u4', offset: -28, content: '- Drill: passé composé vs imparfait\n- Weak spot: agreement with être verbs', targetProgress: 12 },
  { id: 'log-fr-u4-26', taskId: 'fr-u4', offset: -26, content: '- Leçon 2: pronoms objets\n\t- le / la / les go before the verb\n- Listening: 15 min RFI journal', targetProgress: 20 },
  { id: 'log-fr-u4-25', taskId: 'fr-u4', offset: -25, content: '- Shadowing practice, 15 min\n- Read the transcript twice', targetProgress: 25 },
  { id: 'log-fr-u4-23', taskId: 'fr-u4', offset: -23, content: '- Leçon 3: comparatif / superlatif\n- Next: write a short paragraph', targetProgress: 33 },
  { id: 'log-fr-u4-22', taskId: 'fr-u4', offset: -22, content: '- Wrote 8 sentences using comparatives', targetProgress: 38 },
  { id: 'log-fr-u4-20', taskId: 'fr-u4', offset: -20, content: '- Leçon 4: futur simple\n\t- irregular stems: ser-, aur-, ir-\n- Anki: 30 cards', targetProgress: 46 },
  { id: 'log-fr-u4-18', taskId: 'fr-u4', offset: -18, content: '- Reading: Le Petit Prince ch. 1–3\n\t- 12 unknown words looked up', targetProgress: 55 },
  { id: 'log-fr-u4-17', taskId: 'fr-u4', offset: -17, content: '- Review session, no new material', targetProgress: 60 },
  { id: 'log-fr-u4-15', taskId: 'fr-u4', offset: -15, content: '- Leçon 5: conditionnel\n- Recorded myself, listened back', targetProgress: 68 },
  { id: 'log-fr-u4-13', taskId: 'fr-u4', offset: -13, content: '- Grammar drill set 5 — 90% correct', targetProgress: 78 },
  { id: 'log-fr-u4-11', taskId: 'fr-u4', offset: -11, content: '- Unit review\n\t- Weak spot: irregular futur stems\n- Next: self-test', targetProgress: 88 },
  { id: 'log-fr-u4-9', taskId: 'fr-u4', offset: -9, content: '- Self-test passed, unit closed', targetProgress: 100 },

  // --- Probability & Statistics — the second strict task in that window, and
  //     one of the two carrying logs from before the progress fields became
  //     mandatory. No log here has a target, so its progress is the share of
  //     days actually logged; two of the original six days were dropped to open
  //     that gap up. ---
  { id: 'log-co-stats-27', taskId: 'co-stats', offset: -27, content: '- Lecture 1–2: descriptive statistics\n- Problem set 1 handed in', targetProgress: null },
  { id: 'log-co-stats-25', taskId: 'co-stats', offset: -25, content: '- Lecture 3: discrete distributions\n\t- binomial vs Poisson, when to use which', targetProgress: null },
  { id: 'log-co-stats-22', taskId: 'co-stats', offset: -22, content: '- Problem set 2\n- Worked through the harder tail questions', targetProgress: null },
  { id: 'log-co-stats-13', taskId: 'co-stats', offset: -13, content: '- Final problem set, reviewed with the study group', targetProgress: null },

  // --- Dynamics simulation — the third strict task in the early window, so
  //     those days have three to cover and the ring reads in thirds. ---
  { id: 'log-team-sim-26', taskId: 'team-sim', offset: -26, content: '- Picked MuJoCo as the backend\n- Imported the chassis mesh', targetProgress: null },
  { id: 'log-team-sim-23', taskId: 'team-sim', offset: -23, content: '- Motor model parameters off the datasheet', targetProgress: null },
  { id: 'log-team-sim-20', taskId: 'team-sim', offset: -20, content: '- First gait in sim\n\t- Falls straight over, CoM too high', targetProgress: null },
  { id: 'log-team-sim-17', taskId: 'team-sim', offset: -17, content: '- Retuned and it stands for three seconds', targetProgress: null },

  // --- Unité 5 — the other pre-mandatory sample, and the one that keeps the
  //     last week from reading as a solid block of missed days. Logged on five
  //     of the eight elapsed days, no targets, one deliberate hole at -4. ---
  { id: 'log-fr-u5-7', taskId: 'fr-u5', offset: -7, content: '- Leçon 1: subjonctif présent\n\t- after verbs of wanting and emotion\n- New Anki deck for the unit', targetProgress: null },
  { id: 'log-fr-u5-6', taskId: 'fr-u5', offset: -6, content: '- Drill: subjonctif triggers', targetProgress: null },
  { id: 'log-fr-u5-5', taskId: 'fr-u5', offset: -5, content: '- Leçon 2: relative pronouns\n\t- qui / que / dont', targetProgress: null },
  { id: 'log-fr-u5-3', taskId: 'fr-u5', offset: -3, content: '- Listening: 20 min podcast\n- Shadowed two passages', targetProgress: null },
  { id: 'log-fr-u5-2', taskId: 'fr-u5', offset: -2, content: '- Leçon 3: si-clauses with the imparfait', targetProgress: null },

  // --- Journal entries. No progress, no effect on the ring. ---
  // Python — the course unit whose window closed with six days unaccounted for.
  { id: 'log-co-python-30', taskId: 'co-python', offset: -30, content: '- Installed the toolchain\n- Ran the first script', targetProgress: null },
  { id: 'log-co-python-26', taskId: 'co-python', offset: -26, content: '- Functions and modules\n\t- Split the CLI helper into two files', targetProgress: null },
  { id: 'log-co-python-21', taskId: 'co-python', offset: -21, content: '- File I/O and exceptions', targetProgress: null },
  { id: 'log-co-python-16', taskId: 'co-python', offset: -16, content: '- Classes and dataclasses\n- Next: generators', targetProgress: null },
  { id: 'log-co-python-8', taskId: 'co-python', offset: -8, content: '- Generators and comprehensions', targetProgress: null },
  { id: 'log-co-python-3', taskId: 'co-python', offset: -3, content: '- Final exercise set done\n- Unit closed', targetProgress: null },

  // Conceptual design — the team phase that reaches the left end of the axis.
  { id: 'log-team-design-30', taskId: 'team-design', offset: -30, content: '- Kickoff meeting, scoped the robot\n- Three concepts on the board', targetProgress: null },
  { id: 'log-team-design-27', taskId: 'team-design', offset: -27, content: '- Down-selected to two concepts', targetProgress: null },
  { id: 'log-team-design-24', taskId: 'team-design', offset: -24, content: '- Sketched the chassis geometry\n\t- 4-wheel omni, 300 mm square', targetProgress: null },
  { id: 'log-team-design-21', taskId: 'team-design', offset: -21, content: '- Picked the omni layout\n\t- Better strafing, simpler kinematics', targetProgress: null },
  { id: 'log-team-design-18', taskId: 'team-design', offset: -18, content: '- Gear ratio table done\n- Handed off to machining', targetProgress: null },
  { id: 'log-team-design-16', taskId: 'team-design', offset: -16, content: '- Design review with the team\n- Phase closed', targetProgress: null },

  // Schematic design.
  { id: 'log-stm-motor-sch-14', taskId: 'stm-motor-sch', offset: -14, content: '- Block diagram drafted\n- Picked the DRV8323 gate driver', targetProgress: null },
  { id: 'log-stm-motor-sch-11', taskId: 'stm-motor-sch', offset: -11, content: '- Schematic capture, power stage done', targetProgress: null },
  { id: 'log-stm-motor-sch-8', taskId: 'stm-motor-sch', offset: -8, content: '- ERC clean\n- Netlist exported for layout', targetProgress: null },

  // Mechanical.
  { id: 'log-team-mech-13', taskId: 'team-mech', offset: -13, content: '- Measured the old chassis for reference', targetProgress: null },
  { id: 'log-team-mech-9', taskId: 'team-mech', offset: -9, content: '- Frame material settled: 6061 aluminium', targetProgress: null },
  { id: 'log-team-mech-5', taskId: 'team-mech', offset: -5, content: '- Motor mounts dimensioned', targetProgress: null },

  // Reading — paused since three days ago, so its last entry is older still.
  { id: 'log-pe-read-19', taskId: 'pe-read', offset: -19, content: '- Started The Pragmatic Programmer\n- Ch. 1–2', targetProgress: null },
  { id: 'log-pe-read-15', taskId: 'pe-read', offset: -15, content: '- Ch. 3–4\n\t- DRY finally sank in', targetProgress: null },
  { id: 'log-pe-read-11', taskId: 'pe-read', offset: -11, content: '- Ch. 5', targetProgress: null },
  { id: 'log-pe-read-6', taskId: 'pe-read', offset: -6, content: '- Ch. 6–7\n- Margins full of notes', targetProgress: null },

  // Fitness — the -10..-8 pause window is skipped on purpose.
  { id: 'log-pe-fitness-14', taskId: 'pe-fitness', offset: -14, content: '- 5 km run, 27:10', targetProgress: null },
  { id: 'log-pe-fitness-12', taskId: 'pe-fitness', offset: -12, content: '- Upper body session', targetProgress: null },
  { id: 'log-pe-fitness-7', taskId: 'pe-fitness', offset: -7, content: '- 5 km run, 26:20', targetProgress: null },
  { id: 'log-pe-fitness-4', taskId: 'pe-fitness', offset: -4, content: '- Leg day\n\t- Squats back up to 80 kg', targetProgress: null },

  // Electrical.
  { id: 'log-team-elec-5', taskId: 'team-elec', offset: -5, content: '- Power budget draft\n\t- 24 V rail, 6 A peak', targetProgress: null },
  { id: 'log-team-elec-4', taskId: 'team-elec', offset: -4, content: '- Connector selection done', targetProgress: null },

  // Control firmware.
  { id: 'log-stm-fw-2', taskId: 'stm-fw', offset: -2, content: '- Repo scaffolded, build system up', targetProgress: null },

  // --- The recent week, so today's panel and the ring have a full spread. ---
  { id: 'log-fr-anki-3', taskId: 'fr-anki', offset: -3, content: '- 25 new cards, 80 reviews', targetProgress: null },
  { id: 'log-fr-anki-1', taskId: 'fr-anki', offset: -1, content: '- 15 new cards, 95 reviews\n\t- Retention 88%', targetProgress: null },
  { id: 'log-fr-anki-2', taskId: 'fr-anki', offset: -2, content: '- 40 new cards, 120 reviews', targetProgress: null },
  { id: 'log-stm-can-2', taskId: 'stm-can', offset: -2, content: '- Read the RM reference manual, CAN chapter\n- Nothing on the bus yet', targetProgress: 10 },
  // The **current shape**: the reading is a field, so the editor never shows it
  // and cannot lose it. This is today's log on a strict task — the one place the
  // time rule is easiest to see, since the day panel is where you land first.
  // Deliberately not 09:00 like `createdAt`: the rule is drawn from the field,
  // and a reading that happens to equal the record’s own stamp would hide that.
  { id: 'log-stm-can-0', taskId: 'stm-can', offset: 0, content: '- CAN frames TX/RX at 500 kbps\n\t- Filter mask was wrong, fixed\n- Next: error-frame handling', targetProgress: 50, stamps: ['11:20'] },
  { id: 'log-stm-pid-2', taskId: 'stm-pid', offset: -2, content: '- Chose the control loop structure\n- Step response baseline captured', targetProgress: 5 },
  { id: 'log-stm-pid-1', taskId: 'stm-pid', offset: -1, content: '- 1 kHz PID loop running\n\t- 30% overshoot at Kp=2.0\n- Next: lower Kp, add D term', targetProgress: 15 },
  { id: 'log-stm-motor-test-0', taskId: 'stm-motor-test', offset: 0, content: '- Flashed bring-up firmware\n\t- Encoder counts stable at 1 kHz\n\t- Closed-loop spin test OK\n- Next: current-loop calibration', targetProgress: 25 },
  { id: 'log-team-vision-0', taskId: 'team-vision', offset: 0, content: '- Labelled 120 armor-plate images\n- 20 epochs, mAP 0.42\n- Next: augment for low light', targetProgress: 35 },
]

function makeLogs(d: (offset: number) => string): TaskLog[] {
  // Stamped at 09:00 so log history reads in a sane order.
  const stamp = (offset: number) => new Date(`${d(offset)}T09:00:00`).toISOString()
  return LOG_SPECS.map((s) => {
    const at = stamp(s.offset)
    return {
      id: s.id,
      taskId: s.taskId,
      date: d(s.offset),
      content: s.content,
      ...(s.stamps ? { stamps: s.stamps.map((t) => ({ at: t })) } : {}),
      targetProgress: s.targetProgress,
      createdAt: at,
      updatedAt: at,
    }
  })
}

interface ChoreSpec {
  id: string
  title: string
  note?: string
  // Day offset from today; the day it was put on, never rewritten.
  date: number
  // Day offset it was ticked on, or omitted while it is still open.
  done?: number
}

// Chores live outside the Gantt entirely — no project, no parent, no progress
// roll-up — so there are a few here for the same reason the tasks are: the Today
// page's right-hand column and Manage's board tally have to have something in
// them. Between them they cover the three states the row can wear: open today,
// done today, and carried (written for an earlier day and still unticked, which
// is what draws the ↺ badge).
const CHORE_SPECS: ChoreSpec[] = [
  { id: 'ch-mosfet', title: 'Pick up the MOSFET samples', note: 'Lab front desk, 2 pm', date: -2 },
  { id: 'ch-email', title: 'Reply to the lab-slot email', date: 0, done: 0 },
  { id: 'ch-can', title: 'Order the CAN transceivers', note: 'TCAN1042 × 4', date: -1, done: -1 },
  { id: 'ch-backup', title: 'Back up the firmware repo', date: -4 },
  { id: 'ch-standup', title: 'Team stand-up', note: '20 min, bring the gear-ratio table', date: 1 },
  { id: 'ch-print', title: 'Print the schematic for review', date: -8, done: -6 },
]

function makeChores(d: (offset: number) => string): Chore[] {
  const now = new Date().toISOString()
  return CHORE_SPECS.map((s) => ({
    id: s.id,
    title: s.title,
    note: s.note ?? '',
    date: d(s.date),
    done: s.done !== undefined,
    completedDate: s.done === undefined ? null : d(s.done),
    createdAt: now,
    updatedAt: now,
  }))
}

// The notebook, one entry per day.
//
// **The one collection this dataset had nothing of at all**, and the only way to
// see it: a `Note` is read by the Logs page, the day panel and the Today page and
// by nothing else — not the tree, not the roll-ups, not the timeline, not the
// heatmap. A board without one looks exactly like a board whose notes are
// broken.
//
// `stamps` is the paragraph's provenance, and it is written here rather than
// left to `liftTimes` so this entry shows both halves of the shape: a paragraph
// written once, and one that came back and was changed. The corner prints the
// last reading, which for the second paragraph is the later of the two.
const NOTE_SPECS: { day: number; body: string; edited?: string }[] = [
  {
    day: -1,
    // A real paragraph break, not an escape: the notebook's paragraphs are
    // separated by a blank line, and a template literal is the one place in this
    // file where that can be written as what it is.
    body: `Sketched the gear ratio on paper — 3.2:1 looks right for the hill test.

The chassis can take another 40 g, so the mount can be printed rather than milled.`,
  },
  {
    day: 0,
    body: `Ordered the transceivers.

The CAN termination question from stand-up: 120 Ω at both ends, and the second one is on the far board rather than here.`,
    edited: '14:05',
  },
]

/**
 * The names given to to-do folders, by `todoGroupId`.
 *
 * The key is the parent and the project together, because two projects each have
 * their own root-level to-dos and one parent can hold a different set in each —
 * a key of the parent alone would name somebody else's folder in the other
 * project.
 *
 * A folder is drawn only where two or more to-dos sit next to each other in one
 * sibling list, which is why `stm-todo-encoder` above exists: with a single
 * to-do there is nothing to fold, so nothing to name, and this line would do
 * nothing at all.
 */
const TODO_FOLDERS: Record<string, string> = {
  'todogroup:stm-chassis:stm32': 'Parts to order',
}

export function buildSeed(): {
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
  chores: Chore[]
  notes: Note[]
  todoFolders: Record<string, string>
} {
  const now = new Date().toISOString()
  const d = (offset: number) => toISO(addDays(new Date(), offset))

  const tasks: Task[] = SPECS.map((s) => {
    const isTodo = s.isTodo === true
    const isLT = !isTodo && s.type === 'long-term'
    return {
      id: s.id,
      name: s.name,
      description: s.desc ?? '',
      parentId: s.parent ?? null,
      projectId: s.project,
      type: isLT ? 'long-term' : 'phase',
      isTodo,
      startDate: isTodo ? null : d(s.start ?? 0),
      endDate: isTodo || isLT ? null : d(s.end ?? 0),
      strictProgress: isTodo || isLT ? false : (s.strict ?? false),
      confirmedDays: isTodo ? [] : (s.confirmed ?? []).map(d),
      paused: !isTodo && (s.paused ?? false),
      pauseDate: !isTodo && s.paused ? d(s.pause ?? 0) : null,
      pauses: isTodo ? [] : (s.pauses ?? []).map(([p, r]) => ({ pauseDate: d(p), resumeDate: d(r) })),
      priority: isTodo ? null : (s.priority ?? 'medium'),
      tags: s.tags ?? [],
      dependencies: s.dependencies ?? [],
      order: s.order,
      createdAt: now,
      updatedAt: now,
      // Evening, so it is plainly the moment it was filed away rather than the
      // day the work ended. Absent on everything else — `undefined` drops out of
      // the JSON rather than being written as a null the app would have to read
      // around.
      archivedAt: s.archived === undefined ? undefined : new Date(`${d(s.archived)}T18:00:00`).toISOString(),
    }
  })

  return {
    projects: PROJECTS.map((p) => ({ ...p })),
    tasks,
    logs: makeLogs(d),
    chores: makeChores(d),
    todoFolders: { ...TODO_FOLDERS },
    notes: NOTE_SPECS.map((n) => ({
      date: d(n.day),
      body: n.body,
      updatedAt: new Date(`${d(n.day)}T22:00:00`).toISOString(),
      // One stamp per paragraph, in order. The first was written and left alone;
      // the second came back and was changed, which is what the extra reading in
      // `edited` records.
      stamps: [
        { at: '09:30' },
        { at: '09:30', edited: [n.edited ?? '20:15'] },
      ],
    })),
  }
}

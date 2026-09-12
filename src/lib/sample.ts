import { Project, Task, TaskLog, TaskPriority, TaskType } from '../types'
import { addDays, toISO } from './dates'

// The sample board, loaded on demand by the last step of the getting-started
// guide. Deliberately *not* in `seed.ts`: that one is reached by
// `loaded ?? buildSeed()` at module scope in the store, so anything put there
// arrives on a fresh install and is written to localStorage immediately. A new
// install must stay blank, and this board must only ever appear because someone
// asked for it.
//
// Dates are day offsets from today (`d(offset)`), so it never goes stale — a
// task described as "in progress" always straddles the current date, however
// long ago this file was written.
//
// `progress` and `status` are deliberately absent: both are derived now
// (src/lib/progress.ts, src/lib/tree.ts). A window that has already closed
// derives to 100% on its own, and a window covering today derives to whatever
// fraction of it has elapsed — so "completed" here just means "in the past",
// and "not started" means "starts later".
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
  // Strict phase leaf: progress accrues only from logs, one logged day per day
  // of the window. Only ever set on leaves — a parent's progress is the average
  // of its children's, so the flag would do nothing there.
  strict?: boolean
  paused?: boolean
  pause?: number
  // Closed pause/resume cycles, as [pauseOffset, resumeOffset] pairs.
  pauses?: [number, number][]
  priority?: TaskPriority
  desc?: string
  tags?: string[]
}

const PROJECTS: Project[] = [
  { id: 'course', name: 'Course', color: '#4ade80', description: 'Coursework and study plan' },
  { id: 'french', name: 'French', color: '#a78bfa', description: 'French A1–A2 study' },
  { id: 'team', name: 'Competition Team', color: '#fb923c', description: 'RoboMaster competition team' },
  { id: 'stm32', name: 'STM32', color: '#60a5fa', description: 'Embedded / motor control project' },
  { id: 'personal', name: 'Personal', color: '#2dd4bf', description: 'Personal goals' },
]

const SPECS: Spec[] = [
  // Long-term goals (open-ended: real start, no end)
  { id: 'fr-goal', name: 'Become conversational', project: 'french', type: 'long-term', start: -120, desc: 'Open-ended goal — no end date, no progress.' },
  { id: 'pe-goal', name: 'Master embedded systems', project: 'personal', type: 'long-term', start: -200, desc: 'Open-ended goal with a scheduled sub-goal under it.' },
  { id: 'pe-goal-robot', name: 'Build a personal robot', parent: 'pe-goal', project: 'personal', start: 30, end: 90 },

  // STM32
  { id: 'stm-chassis', name: 'Chassis & Drive', project: 'stm32', start: -14, end: 35, desc: 'Parent whose end date is synced from its children.' },
  { id: 'stm-motor', name: 'Motor driver board', parent: 'stm-chassis', project: 'stm32', start: -14, end: 9 },
  { id: 'stm-motor-sch', name: 'Schematic design', parent: 'stm-motor', project: 'stm32', start: -14, end: -8, desc: 'Window already closed → derives to 100% completed.' },
  { id: 'stm-motor-pcb', name: 'PCB layout', parent: 'stm-motor', project: 'stm32', start: -8, end: 0, desc: 'Closes today, so it derives to 100% while still on today’s list — shows as struck through.' },
  { id: 'stm-motor-test', name: 'Bring-up & test', parent: 'stm-motor', project: 'stm32', start: 0, end: 9, strict: true, priority: 'high', desc: 'Strict task with a log written today.' },
  { id: 'stm-mach', name: 'Chassis machining', parent: 'stm-chassis', project: 'stm32', start: 14, end: 34 },
  { id: 'stm-fw', name: 'Control firmware', project: 'stm32', start: -2, end: 70 },
  { id: 'stm-can', name: 'CAN bus driver', parent: 'stm-fw', project: 'stm32', start: -2, end: 13, strict: true, desc: 'Strict task with a log written today.' },
  { id: 'stm-pid', name: 'PID tuning', parent: 'stm-fw', project: 'stm32', start: -2, end: 6, strict: true, priority: 'high', desc: 'Strict, but today’s log is missing — logged yesterday only.' },
  { id: 'stm-aim', name: 'Auto-aim algorithm', parent: 'stm-fw', project: 'stm32', start: 28, end: 72, priority: 'urgent' },
  { id: 'stm-test', name: 'Integration testing', project: 'stm32', start: 56, end: 76 },
  { id: 'stm-field', name: 'Field test', parent: 'stm-test', project: 'stm32', start: 56, end: 76 },
  { id: 'stm-todo-mosfet', name: 'Pick a MOSFET', parent: 'stm-chassis', project: 'stm32', isTodo: true, desc: 'Unscheduled to-do parked under a scheduled parent.' },

  // Competition Team
  { id: 'team-design', name: 'Conceptual design', project: 'team', start: -30, end: -16, priority: 'high', desc: 'Reaches the left end of the axis — the range starts 30 days back.' },
  { id: 'team-sim', name: 'Dynamics simulation', project: 'team', start: -26, end: -14, strict: true, desc: 'Third strict task in the early window — three to cover on those days, so the ring shows thirds rather than only halves.' },
  { id: 'team-mech', name: 'Mechanical', project: 'team', start: -14, end: -2, priority: 'high' },
  { id: 'team-elec', name: 'Electrical', project: 'team', start: -5, end: 25 },
  { id: 'team-algo', name: 'Algorithm', project: 'team', start: 0, end: 60 },
  { id: 'team-vision', name: 'Vision', parent: 'team-algo', project: 'team', start: 0, end: 40, strict: true, desc: 'Strict task with a log written today.' },
  { id: 'team-decision', name: 'Decision', parent: 'team-algo', project: 'team', start: 20, end: 60 },

  // French
  { id: 'fr-u4', name: 'Unité 4', project: 'french', start: -30, end: -8, strict: true, desc: 'Strict unit carried across three weeks — holds most of the log history.' },
  { id: 'fr-u5', name: 'Unité 5', project: 'french', start: -7, end: 21, strict: true, desc: 'Strict, logged on a few days and with no target on any log — so it falls back to the auto-accumulated logged-days/window, well under what the elapsed time alone would suggest.' },
  { id: 'fr-anki', name: 'Anki review', project: 'french', start: -3, end: 4, tags: ['anki'], desc: 'Non-strict, but still carries a journal log.' },
  { id: 'fr-listen', name: 'Listening practice', project: 'french', start: 5, end: 12 },
  { id: 'fr-todo-podcast', name: 'Podcast listening', project: 'french', isTodo: true },

  // Course
  { id: 'co-python', name: 'Python', project: 'course', start: -30, end: -1, desc: 'Finished unit — window closed, derives to 100%.' },
  { id: 'co-stats', name: 'Probability & Statistics', project: 'course', start: -28, end: -12, strict: true, priority: 'high', desc: 'Strict, window closed, no target on any log — so it settles at the share of days actually logged instead of 100%. Sits beside the non-strict units, which all read 100% the moment their window closes.' },
  { id: 'co-pytorch', name: 'PyTorch', project: 'course', start: 0, end: 30 },
  { id: 'co-mlp', name: 'MLP', parent: 'co-pytorch', project: 'course', start: 0, end: 12 },
  { id: 'co-cnn', name: 'CNN', parent: 'co-pytorch', project: 'course', start: 12, end: 30 },

  // Personal
  { id: 'pe-read', name: 'Reading', project: 'personal', start: -20, end: 20, paused: true, pause: -3, desc: 'Currently paused — shows a Paused badge and is skipped by the log ring.' },
  { id: 'pe-fitness', name: 'Fitness', project: 'personal', start: -14, end: 60, pauses: [[-10, -8]], tags: ['health'], desc: 'Was paused once and resumed — carries pause history.' },
  { id: 'pe-todo-sicp', name: 'Work through SICP', project: 'personal', isTodo: true },
]

interface LogSpec {
  id: string
  taskId: string
  offset: number
  content: string
  targetProgress: number | null
}

// A month of history, today included.
//
// Two jobs, and they pull in opposite directions. The strict logs below drive
// the day panel's coverage ring, so they are deliberately gappy — all three
// states (every strict task logged, only some, none) have to be reachable.
// The journal entries add volume without touching that: a log on a non-strict
// task carries no progress and owes nothing to the ring, so it can fill a day
// freely. They exist because the Logs page shows at most two tasks per day and
// at most two items per task before collapsing into "+N more" — a day with one
// task logged never exercises any of that.
const LOG_SPECS: LogSpec[] = [
  // --- Unité 4, a strict unit closed out over three weeks. The gaps (-27, -24,
  //     -21, -19, -16, -14, -12, -10) are intentional. ---
  { id: 'log-fr-u4-29', taskId: 'fr-u4', offset: -29, content: '- Leçon 1: passé composé\n\t- avoir + participe passé\n- 20 new words into Anki', targetProgress: 8 },
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
  //     one of the two demonstrating the auto-accumulate path. No log here
  //     carries a target, so its progress is the share of days actually logged;
  //     two of the original six days were dropped to open that gap up. ---
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

  // --- Unité 5 — the other auto-accumulate sample, and the one that keeps the
  //     last week from reading as a solid block of missed days. Logged on five
  //     of the eight elapsed days, no targets, one deliberate hole at -4. ---
  { id: 'log-fr-u5-7', taskId: 'fr-u5', offset: -7, content: '- Leçon 1: subjonctif présent\n\t- after verbs of wanting and emotion\n- New Anki deck for the unit', targetProgress: null },
  { id: 'log-fr-u5-6', taskId: 'fr-u5', offset: -6, content: '- Drill: subjonctif triggers', targetProgress: null },
  { id: 'log-fr-u5-5', taskId: 'fr-u5', offset: -5, content: '- Leçon 2: relative pronouns\n\t- qui / que / dont', targetProgress: null },
  { id: 'log-fr-u5-3', taskId: 'fr-u5', offset: -3, content: '- Listening: 20 min podcast\n- Shadowed two passages', targetProgress: null },
  { id: 'log-fr-u5-2', taskId: 'fr-u5', offset: -2, content: '- Leçon 3: si-clauses with the imparfait', targetProgress: null },

  // --- Journal entries. No progress, no effect on the ring. ---
  // Python — the finished course unit.
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
  { id: 'log-fr-anki-0', taskId: 'fr-anki', offset: -2, content: '- 40 new cards, 120 reviews', targetProgress: null },
  { id: 'log-stm-can-2', taskId: 'stm-can', offset: -2, content: '- Read the RM reference manual, CAN chapter\n- Nothing on the bus yet', targetProgress: 10 },
  { id: 'log-stm-can-0', taskId: 'stm-can', offset: 0, content: '- CAN frames TX/RX at 500 kbps\n\t- Filter mask was wrong, fixed\n- Next: error-frame handling', targetProgress: 50 },
  { id: 'log-stm-pid-2', taskId: 'stm-pid', offset: -2, content: '- Chose the control loop structure\n- Step response baseline captured', targetProgress: 5 },
  { id: 'log-stm-pid-0', taskId: 'stm-pid', offset: -1, content: '- 1 kHz PID loop running\n\t- 30% overshoot at Kp=2.0\n- Next: lower Kp, add D term', targetProgress: 15 },
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
      targetProgress: s.targetProgress,
      createdAt: at,
      updatedAt: at,
    }
  })
}

/**
 * The ids of the sample's projects.
 *
 * Stable strings where everything a user makes carries a uuid, which is what
 * lets `addSample` recognise its own work and stay idempotent — and what makes
 * appending safe in the first place.
 */
export const SAMPLE_PROJECT_IDS = PROJECTS.map((p) => p.id)

export function buildSample(): { projects: Project[]; tasks: Task[]; logs: TaskLog[] } {
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
      paused: !isTodo && (s.paused ?? false),
      pauseDate: !isTodo && s.paused ? d(s.pause ?? 0) : null,
      pauses: isTodo ? [] : (s.pauses ?? []).map(([p, r]) => ({ pauseDate: d(p), resumeDate: d(r) })),
      priority: isTodo ? null : (s.priority ?? 'medium'),
      tags: s.tags ?? [],
      dependencies: [],
      createdAt: now,
      updatedAt: now,
    }
  })

  return { projects: PROJECTS.map((p) => ({ ...p })), tasks, logs: makeLogs(d) }
}

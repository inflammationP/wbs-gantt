import { Project, Task, TaskLog } from '../types'
import { DEFAULT_LANG, Lang } from './i18n'

/**
 * The getting-started guide: seven ordered steps.
 *
 * Ordered, not independent — step 3's task is built inside step 2's project,
 * step 4's strict subtask hangs under step 3's task, and step 6's log is
 * written on step 4's subtask. So the card shows "step n of 7" and the steps
 * after the current one are dimmed rather than left as free-floating boxes.
 *
 * Every step teaches on the board the user is building. Nothing here reads, or
 * loads, a bundled example — the pages the last step sends them to have their
 * own project, tasks and log on them by then.
 *
 * Pure, like `progress.ts` / `tree.ts` / `dayTasks.ts`, and it does no
 * translating: the component builds `t(`guide.step.${id}`)` from the id. The one
 * thing it takes from the dictionaries is `DEFAULT_LANG`, to tell whether a
 * language has been chosen.
 */
export type GuideStepId =
  | 'language'
  | 'project'
  | 'parentTask'
  | 'strictChild'
  | 'endDate'
  | 'log'
  | 'tour'

/** Which explanation dialog a step offers, if any. */
export type GuideExplainId = 'language' | 'endDate' | 'strict' | 'tour'

/**
 * The pages the last step asks the user to look at, in sidebar order.
 *
 * Their values are `AppView` members, so the card can navigate to one directly.
 * Each visit is recorded under `tour.<page>` — which is what makes that step
 * finish on having looked around rather than on having opened its dialog. It
 * used to complete on the dialog opening, and since completion is what collapses
 * the card, the first "take me there" took the other three with it.
 */
export const TOUR_PAGES = ['logs', 'manage', 'calendar', 'settings'] as const
export type TourPage = (typeof TOUR_PAGES)[number]

/** The `done`-list id recording that `page` has been visited. */
export const tourVisitKey = (page: TourPage) => `tour.${page}`

export interface GuideStep {
  id: GuideStepId
  /** What the board witnesses right now, before any recorded mark. */
  derived: boolean
  /** `derived`, or reached earlier and recorded — what the card shows. */
  done: boolean
  /**
   * The dialog this step offers. `language`, `endDate` and `tour` are
   * *completed* by what happens in it; `strict` carries one without depending on
   * it — the user may read the strict/non-strict comparison before or after
   * writing the log.
   */
  explain: GuideExplainId | null
  /** The task this step is about, for the "take me there" button. */
  taskId: string | null
  /** Sub-progress, for a step made of several separate visits. */
  progress?: { done: number; total: number }
}

/**
 * Marks that assert something about the board, as against what the user has read
 * or visited. Only these are voided by an empty board — see `guideSteps`.
 */
const BOARD_MARKS = new Set<string>(['project', 'parentTask', 'strictChild', 'log'])

/** Earliest by `createdAt`, tie-broken by id so the pick is stable. */
function earliest(tasks: Task[]): Task | undefined {
  return tasks.reduce<Task | undefined>(
    (best, t) =>
      best == null || t.createdAt < best.createdAt || (t.createdAt === best.createdAt && t.id < best.id)
        ? t
        : best,
    undefined,
  )
}

export function guideSteps(
  projects: Project[],
  tasks: Task[],
  logs: TaskLog[],
  lang: Lang,
  done: string[],
): GuideStep[] {
  /**
   * A step once reached stays reached.
   *
   * The card used to re-derive every step from the board on each render, which
   * meant a user tidying up — deleting the parent task they had just made —
   * watched their progress go backwards. `deleteTask` cascades to descendants
   * and their logs, so removing that one task also takes the strict subtask and
   * its log, rewinding three steps at once. Progress through a tutorial is a
   * record of what someone did, not a claim about what the board holds.
   *
   * One exception: a board with no projects at all is somebody starting over,
   * and a guide that stays permanently finished above a blank board is no use to
   * them. So the marks that *claim board state* are dropped there, which is also
   * the way back for anyone who wants to be walked through it again.
   *
   * Only those, though. Voiding the whole list looked equivalent and was not: a
   * blank board is exactly where steps 1 and 2 are carried out, so the language
   * mark — which claims nothing about the board — was being thrown away at the
   * one moment it was needed, and step 1 could never be finished at all.
   */
  const marked = new Set(
    projects.length === 0 ? done.filter((id) => !BOARD_MARKS.has(id)) : done,
  )

  // The project the user made in step 2. The board starts empty, so this is
  // theirs, which keeps steps 3-6 scoped to their own work.
  const projectId = projects[0]?.id

  // A parent is a root task of their own: not a to-do, which has no schedule at
  // all and cannot contain anything. A long-term goal counts — the form offers
  // them as parents, so the guide has to accept what its own UI allows.
  const parentTask = earliest(
    tasks.filter((t) => t.projectId === projectId && t.parentId === null && !t.isTodo),
  )
  const strictChild = parentTask
    ? earliest(tasks.filter((t) => t.parentId === parentTask.id && t.strictProgress))
    : undefined

  const logged = strictChild != null && logs.some((l) => l.taskId === strictChild.id)
  const visited = TOUR_PAGES.filter((p) => marked.has(tourVisitKey(p))).length

  const steps: Omit<GuideStep, 'done'>[] = [
    {
      id: 'language',
      // Someone who switched language before opening the dialog has answered
      // this step already — nothing would be gained by making them open it and
      // press "not now".
      derived: lang !== DEFAULT_LANG,
      explain: 'language',
      taskId: null,
    },
    { id: 'project', derived: projects.length > 0, explain: null, taskId: null },
    { id: 'parentTask', derived: parentTask != null, explain: null, taskId: parentTask?.id ?? null },
    {
      id: 'strictChild',
      derived: strictChild != null,
      explain: null,
      taskId: strictChild?.id ?? null,
    },
    // Both of these are completed by their dialog rather than by the board, so
    // `derived` is false and the mark is what finishes them. `tour` is the
    // exception inside the exception: its mark is one per page, so it is
    // finished by all four being there rather than by `marked.has('tour')`.
    { id: 'endDate', derived: false, explain: 'endDate', taskId: parentTask?.id ?? null },
    { id: 'log', derived: logged, explain: 'strict', taskId: strictChild?.id ?? null },
    {
      id: 'tour',
      derived: visited === TOUR_PAGES.length,
      explain: 'tour',
      taskId: null,
      progress: { done: visited, total: TOUR_PAGES.length },
    },
  ]

  return steps.map((s) => ({ ...s, done: s.derived || marked.has(s.id) }))
}

/** Index of the first step still to do, or `steps.length` when all are done. */
export function currentStepIndex(steps: GuideStep[]): number {
  const i = steps.findIndex((s) => !s.done)
  return i === -1 ? steps.length : i
}

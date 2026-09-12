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
 * Every action step's completion is *derived* from the store — nothing is
 * instrumented, so a reload loses no progress and the guide cannot tick
 * something the board does not actually contain. Steps whose instruction is
 * only "read this" or "go and look" are the exception: the board cannot witness
 * those, so they are recorded in the `done` list the store persists.
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
  // The project the user made in step 2. The board starts empty, and the sample
  // board is only ever *appended*, so this stays theirs — which also keeps steps
  // 3-6 scoped to their own work rather than drifting onto a sample task whose
  // project happens to sort first.
  const projectId = projects[0]?.id

  // A parent is a phase root: not a to-do (no schedule at all) and not a
  // long-term goal (open-ended, so it has no end date to hand down).
  const parentTask = earliest(
    tasks.filter((t) => t.projectId === projectId && t.parentId === null && !t.isTodo && t.type !== 'long-term'),
  )
  const strictChild = parentTask
    ? earliest(tasks.filter((t) => t.parentId === parentTask.id && t.strictProgress))
    : undefined

  const marked = new Set(done)
  const logged = strictChild != null && logs.some((l) => l.taskId === strictChild.id)
  const visited = TOUR_PAGES.filter((p) => marked.has(tourVisitKey(p))).length

  return [
    {
      id: 'language',
      // Someone who switched language before opening the dialog has answered
      // this step already — nothing would be gained by making them open it and
      // press "not now".
      done: marked.has('language') || lang !== DEFAULT_LANG,
      explain: 'language',
      taskId: null,
    },
    { id: 'project', done: projects.length > 0, explain: null, taskId: null },
    { id: 'parentTask', done: parentTask != null, explain: null, taskId: parentTask?.id ?? null },
    { id: 'strictChild', done: strictChild != null, explain: null, taskId: strictChild?.id ?? null },
    { id: 'endDate', done: marked.has('endDate'), explain: 'endDate', taskId: parentTask?.id ?? null },
    { id: 'log', done: logged, explain: 'strict', taskId: strictChild?.id ?? null },
    {
      id: 'tour',
      done: visited === TOUR_PAGES.length,
      explain: 'tour',
      taskId: null,
      progress: { done: visited, total: TOUR_PAGES.length },
    },
  ]
}

/** Index of the first step still to do, or `steps.length` when all are done. */
export function currentStepIndex(steps: GuideStep[]): number {
  const i = steps.findIndex((s) => !s.done)
  return i === -1 ? steps.length : i
}

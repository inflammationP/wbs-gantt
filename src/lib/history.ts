import { Project, Task, TaskLog } from '../types'

/**
 * The undo history: what one step did, and how to walk back and forth over it.
 *
 * **Deltas, not snapshots.** A step stores the rows it touched — their values on
 * both sides — and nothing else. A snapshot of the whole board would be simpler
 * to apply, and it is the wrong shape: restoring one puts back *everything* as it
 * was, including the things this history deliberately does not record. Write
 * three log entries after a merge, undo the merge, and a snapshot would take the
 * entries with it. A delta can only undo what it did.
 *
 * **Why walking the tree is safe.** Jumping from one node to another applies the
 * steps along the path between them: the inverses on the way up to the common
 * ancestor, the forward values on the way down — each in the order it was
 * originally applied. Every step is therefore applied against exactly the state
 * its own parent node defines, rebuilt in order. A step that puts task X under
 * parent Y always finds X, because the step that created X is on the same path
 * and is replayed first. This is the whole reason the history is a tree walked
 * from the current node rather than a list of snapshots to jump between.
 *
 * The guarantee rests on one thing holding: **no structural change may happen
 * outside this record**. One that slips past is invisible until a jump lands on a
 * board that never existed. That is why the store watches itself and captures
 * deltas in its subscriber, rather than trusting twenty call sites to remember.
 *
 * Pure, so `scripts/check-history.mjs` can drive it without a store.
 */

/**
 * The collections the history is about. Chores, habits and notes are not: they
 * are content, and a day of them would bury the structural steps.
 *
 * `todoFolders` is in, small as it is, because it is the one thing a to-do
 * folder *is* — the folder itself is synthesized by `buildRows` and has no row to
 * change, so renaming one is a structural edit with nothing else to record it.
 * Leaving it out would have been the exact failure this design exists to
 * prevent: an operation that changes the board, is never captured, and leaves a
 * hole for a later jump to land in.
 */
export interface Board {
  tasks: Task[]
  projects: Project[]
  logs: TaskLog[]
  todoFolders: Record<string, string>
}

export interface HistoryDelta {
  /**
   * Rows that existed before and were changed: both sides of every field that
   * moved, plus the name the row had *after* this step.
   *
   * The name is kept rather than looked up when the tree is drawn. A step on an
   * abandoned branch can point at a row the current board no longer has, and a
   * lookup would come back empty; keeping it also means the tree shows the name
   * the row had at that moment, which is the same footing as the step's own
   * label — both are what was true then, not what is true now.
   */
  changed: { id: string; name: string; before: Partial<Task>; after: Partial<Task> }[]
  /** Rows this step created, whole — so undoing it can take them away again. */
  added: Task[]
  /** Rows this step removed, whole — so undoing it can put them back. */
  removed: Task[]
  /** Logs that went with the removed rows. Only these; a step never touches another's. */
  removedLogs: TaskLog[]
  /**
   * To-do folder names, by `todoGroupId`. `undefined` on one side means the key
   * was not there — a folder that had not been named, or a name that was cleared.
   */
  folders: { key: string; before: string | undefined; after: string | undefined }[]
  projects: {
    added: Project[]
    removed: Project[]
    changed: { id: string; name: string; before: Partial<Project>; after: Partial<Project> }[]
  }
}

/**
 * What kind of operation a step is — see `HistoryStep.kind`.
 *
 * One value so far, and it is written as a union rather than a bare `'move'`
 * because the shape is the point: the hierarchy dialog lists the moves, and the
 * day a second kind is recorded (a bulk priority change is the obvious next one)
 * it is added here and to that list rather than to a boolean somewhere.
 */
export type StepKind = 'move'

export interface HistoryStep {
  id: string
  /** The node this step was performed from. `null` is the board as the app opened. */
  parent: string | null
  /**
   * Set on steps that are a move, so the hierarchy dialog can list those.
   *
   * It used to be a `scope: 'project'`, which stopped meaning anything the moment
   * the dialog could move a *task*: a task moving from one project to another is
   * neither a project-level operation nor something to leave out. What that
   * dialog wants is not "which level" but "which operation", so the field says
   * that instead.
   *
   * A field rather than a test on the label, because the label is a sentence in
   * whatever language was on screen at the time — matching on it would be a test
   * that changes with the locale, and would quietly stop matching the day a
   * wording changed.
   */
  kind?: StepKind
  /**
   * The whole sentence, translated when the step was recorded — the same choice
   * `UndoStep.message` made, and for the same reason: the row is read for as long
   * as the session lasts, and a language switched in the middle of it is not
   * worth a second translation of something already read.
   */
  label: string
  /** `HH:MM`, local. */
  at: string
  delta: HistoryDelta
}

/** Where the board sits in the tree. `null` is the board as the app opened. */
export interface History {
  steps: HistoryStep[]
  cursor: string | null
}

export const EMPTY_HISTORY: History = { steps: [], cursor: null }

/** How many rows a step touched — the `· 12 项` on its line. */
export function deltaCount(delta: HistoryDelta): number {
  return (
    delta.added.length +
    delta.removed.length +
    delta.changed.length +
    delta.folders.length +
    delta.projects.added.length +
    delta.projects.removed.length +
    delta.projects.changed.length
  )
}

/**
 * What a step did, as names — the list behind a node's fold.
 *
 * Read entirely off the delta, never off the live board: these are the rows as
 * they were at that step, and half of them may not exist any more.
 */
export function deltaNames(delta: HistoryDelta): {
  added: string[]
  removed: string[]
  changed: string[]
  projectAdded: string[]
  projectRemoved: string[]
  projectChanged: string[]
} {
  // **Only the rows that changed place**, when any did.
  //
  // A move does two things to the board and only one of them is the point: the
  // rows that arrived are relabelled, and the rows they landed among are
  // renumbered, because something was inserted above them. Reporting both makes
  // the list read as if half the destination had been edited — "moved 学习" with
  // 接口设计 and 联调 under it, neither of which went anywhere.
  //
  // When *no* row changed place, the step **is** the renumbering: a row dragged
  // within its own parent changes only its `order`. Then every changed row
  // belongs, because where it sits is the whole of what happened to it.
  const moved = delta.changed.filter((c) => 'parentId' in c.before || 'projectId' in c.before)
  return {
    added: delta.added.map((t) => t.name),
    removed: delta.removed.map((t) => t.name),
    changed: (moved.length > 0 ? moved : delta.changed).map((c) => c.name),
    // Split three ways rather than pooled under "projects": a step that removed a
    // project and a step that added one are opposite news, and one label over
    // both says neither.
    projectAdded: delta.projects.added.map((p) => p.name),
    projectRemoved: delta.projects.removed.map((p) => p.name),
    projectChanged: delta.projects.changed.map((p) => p.name),
  }
}

/** Fields that differ between two rows of the same id, both ways. */
function fieldDiff<T extends object>(before: T, after: T): { before: Partial<T>; after: Partial<T> } | null {
  const b: Record<string, unknown> = {}
  const a: Record<string, unknown> = {}
  // The union, not `Object.keys(before)`: a field the step *added* is not in the
  // before row's keys, and a diff that cannot see it cannot take it away again.
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const x = (before as Record<string, unknown>)[k]
    const y = (after as Record<string, unknown>)[k]
    if (x !== y) {
      b[k] = x
      a[k] = y
    }
  }
  return Object.keys(b).length === 0 ? null : { before: b as Partial<T>, after: a as Partial<T> }
}

/**
 * What changed between two boards, or null when nothing the history cares about
 * did.
 *
 * **Logs alone are not a step.** Writing, editing and deleting a log are content,
 * and a day of logging would bury the structural steps under dozens of entries.
 * They still ride along in `removedLogs` when a task or project change takes some
 * with it — that is the one way a log belongs in here, and it belongs because
 * undoing the delete has to bring it back.
 */
export function diffBoard(prev: Board, next: Board): HistoryDelta | null {
  const tasksMoved = prev.tasks !== next.tasks
  const projectsMoved = prev.projects !== next.projects
  const foldersMoved = prev.todoFolders !== next.todoFolders
  if (!tasksMoved && !projectsMoved && !foldersMoved) return null

  const now = new Map(next.tasks.map((t) => [t.id, t]))
  const was = new Map(prev.tasks.map((t) => [t.id, t]))

  const added: Task[] = []
  const removed: Task[] = []
  const changed: HistoryDelta['changed'] = []
  if (tasksMoved) {
    for (const t of next.tasks) if (!was.has(t.id)) added.push(t)
    for (const t of prev.tasks) {
      const after = now.get(t.id)
      if (!after) {
        removed.push(t)
        continue
      }
      if (after === t) continue
      const d = fieldDiff(t, after)
      if (d) changed.push({ id: t.id, name: after.name, ...d })
    }
  }

  const nowProjects = new Map(next.projects.map((p) => [p.id, p]))
  const wasProjects = new Map(prev.projects.map((p) => [p.id, p]))
  const pAdded: Project[] = []
  const pRemoved: Project[] = []
  const pChanged: HistoryDelta['projects']['changed'] = []
  if (projectsMoved) {
    for (const p of next.projects) if (!wasProjects.has(p.id)) pAdded.push(p)
    for (const p of prev.projects) {
      const after = nowProjects.get(p.id)
      if (!after) {
        pRemoved.push(p)
        continue
      }
      if (after === p) continue
      const d = fieldDiff(p, after)
      if (d) pChanged.push({ id: p.id, name: after.name, ...d })
    }
  }

  // Every log that is gone, not only the ones whose task went: this runs once per
  // gesture, and a gesture that removed logs both ways still has to be able to
  // put all of them back.
  const liveLogs = new Set(next.logs.map((l) => l.id))
  const removedLogs = prev.logs.filter((l) => !liveLogs.has(l.id))

  const folders: HistoryDelta['folders'] = []
  if (foldersMoved) {
    for (const key of new Set([...Object.keys(prev.todoFolders), ...Object.keys(next.todoFolders)])) {
      if (prev.todoFolders[key] !== next.todoFolders[key]) {
        folders.push({ key, before: prev.todoFolders[key], after: next.todoFolders[key] })
      }
    }
  }

  if (
    added.length === 0 && removed.length === 0 && changed.length === 0 &&
    folders.length === 0 &&
    pAdded.length === 0 && pRemoved.length === 0 && pChanged.length === 0
  ) {
    return null
  }
  return {
    changed,
    added,
    removed,
    removedLogs,
    folders,
    projects: { added: pAdded, removed: pRemoved, changed: pChanged },
  }
}

/** Fold one more delta into an accumulating one — one gesture can be many `set`s. */
export function mergeDelta(a: HistoryDelta | null, b: HistoryDelta): HistoryDelta {
  if (!a) return b
  return {
    changed: [...a.changed, ...b.changed],
    added: [...a.added, ...b.added],
    removed: [...a.removed, ...b.removed],
    removedLogs: [...a.removedLogs, ...b.removedLogs],
    folders: [...a.folders, ...b.folders],
    projects: {
      added: [...a.projects.added, ...b.projects.added],
      removed: [...a.projects.removed, ...b.projects.removed],
      changed: [...a.projects.changed, ...b.projects.changed],
    },
  }
}

/**
 * The board one step away, in either direction.
 *
 * `inverse` puts back what the step changed and takes away what it made;
 * `forward` does the same the other way round. Both are written once here rather
 * than as two functions that would drift — the only difference is which side of
 * each pair is the destination.
 *
 * A row a delta names but the board does not have is skipped rather than
 * throwing. Walking the tree in order means that should not happen; it is a
 * guard, not a feature.
 */
export function applyDelta(board: Board, delta: HistoryDelta, dir: 'forward' | 'inverse'): Board {
  const fromKey = dir === 'forward' ? 'before' : 'after'
  const toKey = dir === 'forward' ? 'after' : 'before'
  const appear = dir === 'forward' ? delta.added : delta.removed
  const vanish = dir === 'forward' ? delta.removed : delta.added
  const vanishIds = new Set(vanish.map((r) => r.id))

  const patch = new Map(delta.changed.map((c) => [c.id, c[toKey]]))
  let tasks = board.tasks.map((t) => {
    const p = patch.get(t.id)
    return p ? { ...t, ...p } : t
  })
  tasks = tasks.filter((t) => !vanishIds.has(t.id))
  const have = new Set(tasks.map((t) => t.id))
  tasks = [...tasks, ...appear.filter((t) => !have.has(t.id))]

  const pPatch = new Map(delta.projects.changed.map((c) => [c.id, c[toKey]]))
  let projects = board.projects.map((p) => {
    const q = pPatch.get(p.id)
    return q ? { ...p, ...q } : p
  })
  const pVanish = new Set(
    (dir === 'forward' ? delta.projects.removed : delta.projects.added).map((p) => p.id),
  )
  projects = projects.filter((p) => !pVanish.has(p.id))
  const pHave = new Set(projects.map((p) => p.id))
  projects = [
    ...projects,
    ...(dir === 'forward' ? delta.projects.added : delta.projects.removed).filter((p) => !pHave.has(p.id)),
  ]

  // Logs go by id, both ways: forward takes away exactly the entries this step
  // recorded as lost, and nothing else; inverse puts exactly those back.
  const goneLogs = new Set(delta.removedLogs.map((l) => l.id))
  const logs =
    dir === 'forward'
      ? board.logs.filter((l) => !goneLogs.has(l.id))
      : [...board.logs, ...delta.removedLogs.filter((l) => !board.logs.some((x) => x.id === l.id))]

  const todoFolders = { ...board.todoFolders }
  for (const f of delta.folders) {
    const value = dir === 'forward' ? f.after : f.before
    if (value === undefined) delete todoFolders[f.key]
    else todoFolders[f.key] = value
  }

  return { tasks, projects, logs, todoFolders }
}

/**
 * The steps between two nodes, in the order they have to be applied.
 *
 * Up from where the board is to the deepest node the two share, then down to
 * where it is going — the same walk an editor's undo tree makes, and the whole
 * reason a jump of fifty steps is safe: it is fifty single steps, in order.
 *
 * Returns null when the target is not a node of this tree.
 */
export function pathBetween(
  steps: HistoryStep[],
  from: string | null,
  to: string | null,
): { step: HistoryStep; dir: 'forward' | 'inverse' }[] | null {
  if (from === to) return []
  const byId = new Map(steps.map((s) => [s.id, s]))
  if (from !== null && !byId.has(from)) return null
  if (to !== null && !byId.has(to)) return null

  /** The node itself first, `null` (the opening board) last. */
  const chain = (start: string | null): (string | null)[] => {
    const out: (string | null)[] = []
    let at = start
    // A hand-edited history cannot cycle — only this module writes it — but the
    // walk is bounded by the step count anyway, so a cycle would stop, not hang.
    for (let i = 0; at !== null && i <= steps.length; i++) {
      out.push(at)
      at = byId.get(at)?.parent ?? null
    }
    out.push(null)
    return out
  }

  const up = chain(from)
  const down = chain(to)
  const inDown = new Set(down)
  const ancestor = up.find((id) => inDown.has(id))
  if (ancestor === undefined) return null

  const out: { step: HistoryStep; dir: 'forward' | 'inverse' }[] = []
  for (const id of up) {
    if (id === ancestor) break
    out.push({ step: byId.get(id as string)!, dir: 'inverse' })
  }
  // `down` runs leaf-ward, so the tail from the ancestor to the target is already
  // in the order the steps were originally applied.
  const downTail = down.slice(0, down.indexOf(ancestor)).reverse()
  // `null` is the opening board, which sits at the end of every chain and can
  // only ever be the ancestor itself — so there is no null left to step *to*.
  for (const id of downTail) if (id !== null) out.push({ step: byId.get(id)!, dir: 'forward' })
  return out
}

/**
 * The cursor and everything above it, up to the opening board.
 *
 * The one chain of steps that is in effect, listed rather than set-membered
 * because the graph opens exactly these branches and shuts the rest — see
 * `HistoryDialog`. Returns ids only: `null` is the opening board, which is not a
 * step and has nothing to open.
 */
export function cursorChain(steps: HistoryStep[], cursor: string | null): string[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const out: string[] = []
  let at = cursor
  for (let i = 0; at !== null && i <= steps.length; i++) {
    out.push(at)
    at = byId.get(at)?.parent ?? null
  }
  return out
}

/** Every id from the opening board down to the cursor — what is still in effect. */
export function inEffectIds(steps: HistoryStep[], cursor: string | null): Set<string | null> {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const out = new Set<string | null>([null])
  let at = cursor
  for (let i = 0; at !== null && i <= steps.length; i++) {
    out.add(at)
    at = byId.get(at)?.parent ?? null
  }
  return out
}

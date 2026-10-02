import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Modal, TreeRails } from './ui'
import { toggleIn } from '../lib/ui'
import { Task } from '../types'
import { buildChildrenMap, liveTasks } from '../lib/tree'
import { useStore } from '../store/useStore'
import { useT } from '../lib/useT'

interface Row {
  /** A task id, or `projectKey` for the project's own row. */
  id: string
  name: string
  depth: number
  /** The task the panel is on: the one row that is not a way in. */
  self: boolean
  /**
   * The gutter, one entry per level this row steps in — the same length as
   * `depth`. Entry `j` says whether the line at that level carries on past this
   * row; the last entry is the join cell's line going *down*.
   */
  rails: boolean[]
  /** No sibling above: the join has no line going up, so it is a `┌` or a `└`. */
  first: boolean
  /** Whether this row can be folded, which is also whether it wears a caret. */
  kids: boolean
  open: boolean
  /** The project's row: a name and a caret, but not a task to open. */
  project: boolean
}

/**
 * The project's tasks as a pedigree chart: the project at the top, the work
 * branching down from it, and nothing on a row but a name and the lines that
 * say where the name sits.
 *
 * No status, no progress, no boxes. Every one of those was a second thing to
 * read on a row whose whole job is to say where a task stands and to be a way
 * into it; what carries the structure is the drawing itself.
 *
 * It opens on the one branch that matters: everything with children is folded
 * except the line this task is on, so the chart answers "where am I" without a
 * scroll, and the rest of the project is a row of closed names — which are
 * themselves the way into the other branches. Expanding the lot is one press.
 */
export function TaskTreeDialog({
  taskId,
  onPick,
  onClose,
}: {
  taskId: string
  onPick: (id: string) => void
  onClose: () => void
}) {
  const t = useT()
  // The chart is the project's structure, so it is drawn from the tasks still on
  // the board — a filed-away branch has left it. The lookup below reads the
  // store directly rather than this list, so the one task the caller asked about
  // is found whether or not it is live: the panel hides the button for an
  // archived task, but a dialog that answered "no such task" would be worse than
  // one that draws nothing.
  const allTasks = useStore((s) => s.tasks)
  const tasks = useMemo(() => liveTasks(allTasks), [allTasks])
  const task = useStore((s) => s.tasks.find((x) => x.id === taskId))
  const project = useStore((s) => s.projects.find((p) => p.id === task?.projectId))
  const kids = useMemo(() => buildChildrenMap(tasks), [tasks])
  const projectId = task?.projectId
  // The project's row folds like any other, but it is not a task, so it cannot
  // share the id space the store hands out for those.
  const projectKey = `project:${projectId}`

  /** Project → this task. Empty when the task is gone. */
  const chain = useMemo(() => {
    const byId = new Map(tasks.map((x) => [x.id, x]))
    const out: Task[] = []
    const seen = new Set<string>()
    for (let cur = byId.get(taskId); cur && !seen.has(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      seen.add(cur.id)
      out.unshift(cur)
    }
    return out
  }, [tasks, taskId])

  // Everything with children starts folded, except the line this task is on —
  // so the one open path reaches it. Derived rather than hand-written, because
  // "the line this task is on" is exactly the chain above. The project's own
  // row is not in the set, so it stays open and the branch is reachable at all.
  const focusSet = useMemo(() => {
    const on = new Set(chain.map((x) => x.id))
    return new Set(tasks.filter((x) => (kids.get(x.id) ?? []).length > 0 && !on.has(x.id)).map((x) => x.id))
  }, [tasks, kids, chain])
  const [folded, setFolded] = useState<Set<string>>(focusSet)

  // Which of the two states the chart is actually in, rather than which one it
  // was last put in: folding one node by hand is a real change, and a label
  // still offering to do what is already done is the button lying about the
  // thing on screen. Compared as sets, because the same set built twice is not
  // the same object.
  const atFocus = folded.size === focusSet.size && [...folded].every((id) => focusSet.has(id))

  const rows = useMemo(() => {
    const out: Row[] = []
    if (!projectId) return out
    const seen = new Set<string>()
    const roots = (kids.get(null) ?? []).filter((x) => x.projectId === projectId)
    out.push({
      id: projectKey,
      name: project?.name ?? '',
      depth: 0,
      self: false,
      rails: [],
      first: true,
      kids: roots.length > 0,
      open: !folded.has(projectKey),
      project: true,
    })
    /**
     * `parentRails` is the *parent's* gutter, and it is exactly this row's
     * continuation cells: the line at level `j + 1` carries on iff the ancestor
     * at that level has a sibling below it. The row's own join is the one entry
     * appended here, and it is what turns the last sibling's join into a `└`.
     */
    const walk = (list: Task[], depth: number, parentRails: boolean[]) => {
      for (let i = 0; i < list.length; i++) {
        const x = list[i]
        // Hand-edited data can hold a cycle, and this is what stops the walk.
        if (seen.has(x.id)) continue
        seen.add(x.id)
        const mine = kids.get(x.id) ?? []
        const rails = [...parentRails, i < list.length - 1]
        out.push({
          id: x.id,
          name: x.name,
          depth,
          self: x.id === taskId,
          rails,
          first: i === 0,
          kids: mine.length > 0,
          open: !folded.has(x.id),
          project: false,
        })
        if (mine.length && !folded.has(x.id)) walk(mine, depth + 1, rails)
      }
    }
    if (!folded.has(projectKey) && roots.length) walk(roots, 1, [])
    return out
  }, [kids, folded, taskId, projectId, project, projectKey])

  // Opened on a project with a dozen roots, the line this task is on can be
  // below the fold — and a "where am I" chart that opens somewhere else is one
  // the user has to hunt through. Centred rather than scrolled to the top, so
  // the ancestors above it are on screen too.
  const selfRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    selfRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  if (!task || !project) return null

  const toggle = (id: string) => setFolded((f) => toggleIn(f, id))

  return (
    <Modal title={t('task.tree')} onClose={onClose} width={620}>
      <div className="flex justify-end -mt-1 mb-1">
        <button
          onClick={() => setFolded(atFocus ? new Set() : focusSet)}
          className="text-[11px] text-accent hover:text-fg"
        >
          {atFocus ? t('common.expand') : t('task.treeFocus')}
        </button>
      </div>

      <div>
        {rows.map((r) => (
          <div key={r.id} ref={r.self ? selfRef : undefined} className="flex items-center h-6 pl-2">
            {/* The drawing, which lives in `ui.tsx` now that the merge dialog's
                preview draws the same thing. */}
            <TreeRails depth={r.depth} rails={r.rails} first={r.first} />
            {/* The caret holds its column whether or not there is one, so the
                names down a level line up. */}
            {r.kids ? (
              <button
                onClick={() => toggle(r.id)}
                aria-label={r.open ? t('common.collapse') : t('common.expand')}
                className="w-4 h-6 shrink-0 inline-flex items-center justify-center text-dim hover:text-fg"
              >
                {r.open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            {/* The project's own row is the root of the chart, not a task: it
                can be folded but there is nowhere to open it to. */}
            {r.project ? (
              <span className="flex-1 min-w-0 truncate text-[12px] text-fg">{r.name}</span>
            ) : (
              <button
                // The current row is where the panel already is, so it is not a
                // way in — a button that reopens the panel you came from is a
                // button that does nothing.
                disabled={r.self}
                onClick={() => onPick(r.id)}
                title={r.name}
                className={`flex-1 min-w-0 truncate text-left text-[12px] ${
                  r.self ? 'text-accent' : 'text-muted hover:text-fg'
                }`}
              >
                {r.name}
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}

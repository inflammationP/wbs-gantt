import { useMemo, useState } from 'react'
import type { RefObject } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TreeRails } from './ui'
import { Project, Task } from '../types'
import { buildChildrenMap, isArchived, rowsOwnedBy } from '../lib/tree'
import { useT } from '../lib/useT'

export interface UnitTreeProps {
  tasks: Task[]
  projects: Project[]
  /**
   * `pick` gives every row a checkbox and lets any number be chosen; `target`
   * gives it a radio and lets exactly one be named.
   *
   * One component for both because they are the same tree — the same projects,
   * the same tasks, the same nesting, the same rails — and the only difference is
   * what a row's control means. Two of them would be two things to keep in step,
   * and the first thing to drift would be the row order, which is the one thing a
   * reader compares between the two columns.
   */
  mode: 'pick' | 'target'
  /** The ticked rows, in `pick` mode. */
  ticked?: ReadonlySet<string>
  /** The named row, in `target` mode. */
  selected?: string | null
  onPick: (id: string, on: boolean) => void
  /**
   * Rows that cannot be chosen at all, dimmed.
   *
   * The target tree uses it for the rows that are about to move and everything
   * under them: landing inside the thing you are moving is a cycle. The pick tree
   * uses it for a project with nothing in it — see `movingUnits` for why that is
   * not a unit.
   */
  blocked?: ReadonlySet<string>
  scrollRef?: RefObject<HTMLDivElement>
}

interface Row {
  id: string
  project: boolean
  name: string
  color?: string
  /** Only on a project row: how many rows moving it would take along. */
  owned?: number
  depth: number
  rails: boolean[]
  first: boolean
  /** In `pick` mode: not ticked itself, but something under it is. */
  partial: boolean
  /** It has rows under it, so it gets a fold — this is the "qualifies" test. */
  kids: boolean
}

/**
 * The board as a tree you can tick or point at.
 *
 * The rows are built the way `TaskTreeDialog` and the merge preview build theirs
 * — a walk over `buildChildrenMap`, one `rails` boolean per level and the
 * `TreeRails` gutter to draw them — because this is the third tree in the app and
 * three different ways of drawing a branch is three ways for them to disagree
 * about what a branch looks like.
 *
 * A project is a row here rather than a heading over its tasks, and that is the
 * whole reason a picker beats dragging: choosing it is how you say "the top level
 * of that project", which the drag can only say by having somewhere to drop.
 */
export function UnitTree({
  tasks,
  projects,
  mode,
  ticked,
  selected,
  onPick,
  blocked,
  scrollRef,
}: UnitTreeProps) {
  const t = useT()
  // What is *open*, so an absent key is the shut state — the same way the Gantt
  // reads a to-do folder, and the reason a board of two hundred rows opens as a
  // list of projects rather than as two hundred rows. Opening is an act; being
  // shut is where a row starts.
  //
  // Each tree has its own: the two columns are read against each other, and one
  // folding because the other did would be a second thing to keep in step. The
  // preview is a third, and starts shut for the same reason.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())

  const rows = useMemo(() => {
    const live = tasks.filter((x) => !isArchived(x))
    const children = buildChildrenMap(live)
    const out: Row[] = []

    /**
     * A row is "partial" when it is not ticked itself but something under it is:
     * the tick set's ancestors, which have to show as half-filled or a branch
     * with one ticked leaf in it reads as an unticked branch with a ticked line
     * poking out of it.
     */
    const partial = new Set<string>()
    if (ticked) {
      const byId = new Map(live.map((x) => [x.id, x]))
      for (const id of ticked) {
        const seen = new Set([id])
        let above = byId.get(id)?.parentId ?? null
        while (above != null && !seen.has(above)) {
          seen.add(above)
          if (ticked.has(above)) break
          partial.add(above)
          above = byId.get(above)?.parentId ?? null
        }
      }
    }

    const walk = (list: Task[], depth: number, parentRails: boolean[]) => {
      list.forEach((task, i) => {
        const rails = [...parentRails, i < list.length - 1]
        const kids = children.get(task.id) ?? []
        out.push({
          id: task.id,
          project: false,
          name: task.name,
          depth,
          rails,
          first: i === 0,
          partial: partial.has(task.id),
          kids: kids.length > 0,
        })
        // Shut: the row stays, what hangs under it does not. The rows are only
        // *hidden* — a tick inside a shut branch is still in the set and still
        // moves, which is what the count and the half-filled box on the row above
        // it are reporting.
        if (!open.has(task.id)) return
        walk(kids, depth + 1, rails)
      })
    }

    for (const p of projects) {
      const roots = children.get(null)?.filter((x) => x.projectId === p.id) ?? []
      out.push({
        id: p.id,
        project: true,
        name: p.name,
        color: p.color,
        owned: rowsOwnedBy(tasks, p.id),
        depth: 0,
        rails: [],
        first: true,
        partial: partial.has(p.id),
        kids: roots.length > 0,
      })
      if (!open.has(p.id)) continue
      walk(roots, 1, [])
    }
    return out
  }, [tasks, projects, ticked, open])

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto border border-border rounded-[3px] divide-y divide-line"
    >
      {rows.map((row) => {
        const off = blocked?.has(row.id) ?? false
        const on = mode === 'pick' ? (ticked?.has(row.id) ?? false) : selected === row.id
        return (
          <label
            key={row.id}
            className={`flex items-center h-6 pr-2 text-[12px] ${
              off ? 'text-dim' : 'text-fg cursor-pointer hover:bg-panel2/60'
            }`}
          >
            <span className="pl-2 shrink-0">
              <input
                type={mode === 'pick' ? 'checkbox' : 'radio'}
                name={mode === 'target' ? 'unit-target' : undefined}
                checked={on}
                disabled={off}
                ref={(el) => {
                  // Half-filled, not a third state the browser has no drawing
                  // for: `indeterminate` is a property, not an attribute, so it
                  // can only be set here.
                  if (el) el.indeterminate = mode === 'pick' && !on && row.partial
                }}
                onChange={(e) => onPick(row.id, e.target.checked)}
              />
            </span>
            <TreeRails depth={row.depth} rails={row.rails} first={row.first} />
            {/* The caret holds its column whether or not there is one, so the
                names down a level line up — the same reason `TaskTreeDialog`
                holds it. Only a row with something under it gets a fold to
                press: a chevron that folds nothing is a button that does
                nothing, which is the lie this row would be telling. */}
            <span className="w-4 shrink-0 flex items-center justify-center text-dim">
              {row.kids && (
                <button
                  type="button"
                  // It sits inside the row's `<label>`, so without this the press
                  // would activate the checkbox instead — and folding a branch
                  // would silently move everything in it.
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setOpen((prev) => {
                      const next = new Set(prev)
                      if (next.has(row.id)) next.delete(row.id)
                      else next.add(row.id)
                      return next
                    })
                  }}
                  aria-expanded={open.has(row.id)}
                  aria-label={row.name}
                  className="hover:text-fg"
                >
                  {open.has(row.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              )}
            </span>
            {row.color && <span className="w-2 h-2 rounded-full shrink-0 mr-1.5" style={{ background: row.color }} />}
            <span className="flex-1 min-w-0 truncate">{row.name}</span>
            {row.owned !== undefined && (
              <span className="shrink-0 text-[10px] text-dim ml-2">
                {t('history.count', { count: row.owned })}
              </span>
            )}
          </label>
        )
      })}
    </div>
  )
}

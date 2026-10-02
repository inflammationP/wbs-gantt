import { Fragment, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Modal, Field, Segmented, TreeRails } from './ui'
import { UnitTree } from './UnitTree'
import { useStore } from '../store/useStore'
import {
  Project,
  Task,
} from '../types'
import {
  buildChildrenMap,
  collectDescendants,
  isArchived,
  moveInto,
  movingUnits,
  promoteTask,
  tickedSubtree,
  toggleTicked,
} from '../lib/tree'
import { PROJECT_COLORS } from '../lib/ui'
import { useT } from '../lib/useT'

// The id a previewed folder is given. Prefixed so the picture can point at the
// rows that are not there yet — nothing else ever reads it, and the real move
// gets its ids from `uid` through the store.
const PREVIEW_MARK = 'preview:'
const previewId = (p: Project) => PREVIEW_MARK + p.id
/** The row a preview project gets when the destination is a brand-new one. */
const PREVIEW_PROJECT = 'preview:new'

/** One row of the picture, with everything that hangs under it. */
interface PreviewRow {
  task: Task
  /** The unit this row arrived with, when it arrived with one. */
  from: string | undefined
  kids: PreviewRow[]
}

/**
 * A row of the picture: real depth, the tree's own connectors, and the same fold
 * the two pickers above have.
 *
 * Shut by default, like them: the picture's job is to say what arrived and where,
 * and at the top of that it says "these rows, under this place". Opening one is
 * how you check the detail.
 */
function PreviewLine({
  row,
  depth,
  rails,
  first,
  open,
  onToggle,
}: {
  row: PreviewRow
  depth: number
  rails: boolean[]
  first: boolean
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="h-6 flex items-center text-[12px] pl-2">
      <TreeRails depth={depth} rails={rails} first={first} />
      <span className="w-4 shrink-0 flex items-center justify-center text-dim">
        {row.kids.length > 0 && (
          <button type="button" onClick={onToggle} aria-expanded={open} aria-label={row.task.name} className="hover:text-fg">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
      </span>
      <span className={`truncate ${row.from ? 'text-accent' : 'text-fg/80'}`}>{row.task.name}</span>
    </div>
  )
}

/**
 * A sibling list, with each run that arrived from one unit framed.
 *
 * A run rather than a whole unit: what `moveInto` produces is a contiguous block,
 * and the frame is drawn around exactly that. Adjacent runs from different units
 * get a frame each, which is how two things moved at once stay tellable apart —
 * and the frame is the only thing that says so in flat mode, where the rows
 * themselves carry no sign of where they came from.
 *
 * `inside` is the frame the caller is already within, and it is what keeps the
 * frames from nesting: a moved project's rows are a run at its own level and a
 * run again at every level below, all with the same origin, so framing each run
 * as it is met draws a box inside a box inside a box around one subtree.
 */
function PreviewRun({
  nodes,
  depth,
  parentRails,
  inside,
  colorOf,
  isOpen,
  onToggle,
}: {
  nodes: PreviewRow[]
  depth: number
  parentRails: boolean[]
  inside?: string
  colorOf: (unitId: string) => string
  isOpen: (id: string) => boolean
  onToggle: (id: string) => void
}) {
  const out: ReactNode[] = []
  let i = 0
  while (i < nodes.length) {
    const from = nodes[i].from
    let j = i + 1
    if (from) while (j < nodes.length && nodes[j].from === from) j++
    const run = nodes.slice(i, j)
    const framed = from != null && from !== inside
    const frameColor = from != null ? colorOf(from) : ''
    const rows = run.map((node, k) => {
      const rails = [...parentRails, i + k < nodes.length - 1]
      const open = isOpen(node.task.id)
      return (
        <Fragment key={node.task.id}>
          <PreviewLine
            row={node}
            depth={depth}
            rails={rails}
            first={i + k === 0}
            open={open}
            onToggle={() => onToggle(node.task.id)}
          />
          {open && (
            <PreviewRun
              nodes={node.kids}
              depth={depth + 1}
              parentRails={rails}
              inside={framed ? from : inside}
              colorOf={colorOf}
              isOpen={isOpen}
              onToggle={onToggle}
            />
          )}
        </Fragment>
      )
    })
    out.push(
      framed ? (
        <div
          key={`frame:${nodes[i].task.id}`}
          className="border border-dashed rounded-[3px] my-0.5"
          style={{ borderColor: `color-mix(in srgb, ${frameColor} 50%, transparent)` }}
        >
          {rows}
        </div>
      ) : (
        <Fragment key={`plain:${nodes[i].task.id}`}>{rows}</Fragment>
      ),
    )
    i = j
  }
  return <>{out}</>
}

/**
 * The hierarchy manager: move any number of projects and tasks to one place.
 *
 * It used to merge projects and only projects. What it is for is the case a drag
 * cannot serve — **many things, or a destination that is not on screen**. Dragging
 * needs the place you are dropping into to be visible, and scrolling to it
 * mid-drag does not happen; and a batch of thirty rows is a batch of thirty
 * gestures. Here the destination is *named* rather than pointed at, which is the
 * same division a file manager makes between dragging a file into a folder you
 * can see and using "move to…" when you cannot.
 *
 * Which is why it does not decide *where among its siblings* a row lands. A
 * picker can say whose something is; only a drag can say "between these two".
 *
 * The two trees are the same tree with different controls — see `UnitTree`. The
 * preview at the bottom is produced by `moveInto`, the same function the button
 * calls, so it cannot promise a rearrangement the move will not make.
 */
export function ProjectManageDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const moveUnits = useStore((s) => s.moveUnits)
  const history = useStore((s) => s.history)
  const historyGoTo = useStore((s) => s.historyGoTo)

  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const [target, setTarget] = useState<{ kind: 'project' | 'task'; id: string } | null>(null)
  const [newProject, setNewProject] = useState(false)
  const [asFolder, setAsFolder] = useState(true)
  // The picture folds too, and starts shut like the two pickers: it says what
  // arrived and where, and the detail behind that is something you open.
  const [previewOpen, setPreviewOpen] = useState<ReadonlySet<string>>(() => new Set())

  const togglePreview = (id: string) =>
    setPreviewOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const units = useMemo(() => movingUnits(tasks, projects, ticked), [tasks, projects, ticked])
  const hasProject = units.projects.length > 0
  const anything = hasProject || units.tasks.length > 0

  /**
   * The subtree a tick on this row covers.
   *
   * A project's is every row it owns; a task's is itself and its descendants.
   * Ticking and unticking are the same set, which is what makes "untick a
   * branch" mean the whole branch rather than leaving orphans ticked under an
   * unticked parent — a row that reads as off with ticked rows under it.
   */
  /**
   * The rules themselves live in `lib/tree.ts` — `toggleTicked` for what a click
   * does to the set and `movingUnits` for what the set means. This is only the
   * click: the two are a rule and its reading, and a rule kept in a component is
   * one no check can reach.
   */
  const pick = (id: string, on: boolean) => {
    setTicked((prev) => toggleTicked(tasks, projects, prev, id, on))
    // The rows that are about to move cannot be a destination: landing inside the
    // thing you are moving is a cycle. Cleared rather than left stale, because a
    // target that silently refuses when the button is pressed is worse than one
    // that visibly unset itself.
    if (on) {
      const covered = tickedSubtree(tasks, projects, id)
      setTarget((cur) => (cur && covered.includes(cur.id) ? null : cur))
    }
  }

  /** Everything on its way out, so the target tree can grey it. */
  const moving = useMemo(() => {
    const out = new Set<string>()
    for (const p of units.projects) for (const x of tasks) if (x.projectId === p) out.add(x.id)
    for (const id of units.tasks) {
      out.add(id)
      for (const d of collectDescendants(tasks, id)) out.add(d)
    }
    return out
  }, [tasks, units])

  const place = newProject
    ? ({ kind: 'newProject' } as const)
    : target === null
      ? null
      : target.kind === 'project'
        ? ({ kind: 'project', id: target.id } as const)
        : ({ kind: 'task', id: target.id } as const)

  const preview = useMemo(() => {
    if (!anything || !place) return null
    // One task sent to a new project *becomes* it — the store's rule, and this
    // picture has to obey the same one or it is a picture of a different
    // operation. Everything else is a move into a place.
    const promoting = place.kind === 'newProject' && units.projects.length === 0 && units.tasks.length === 1

    let next: { tasks: Task[]; projects: Project[] } | null
    let at: { parentId: string | null; projectId: string }
    if (promoting) {
      next = promoteTask(tasks, projects, units.tasks[0], { id: PREVIEW_PROJECT, color: '#94a3b8' })
      at = { parentId: null, projectId: PREVIEW_PROJECT }
    } else if (place.kind === 'newProject') {
      at = { parentId: null, projectId: PREVIEW_PROJECT }
      next = moveInto(
        tasks,
        [...projects, { id: PREVIEW_PROJECT, name: t('move.newProjectName'), color: '#94a3b8', description: '' }],
        units,
        at,
        asFolder,
        previewId,
      )
    } else {
      at =
        place.kind === 'project'
          ? { parentId: null, projectId: place.id }
          : { parentId: place.id, projectId: tasks.find((x) => x.id === place.id)?.projectId ?? '' }
      next = moveInto(tasks, projects, units, at, asFolder, previewId)
    }
    if (!next) return null

    // Which unit each row arrived with, read off the board *before* the move.
    // (`moveInto` no longer knows about a task that became a project — it is not
    // in the board it was handed — so that one case is seeded from the name.)
    const carriedBy = new Map<string, string>()
    if (promoting) {
      const children = buildChildrenMap(next.tasks)
      for (const root of children.get(null) ?? []) {
        if (root.projectId === PREVIEW_PROJECT) carriedBy.set(root.id, units.tasks[0])
        for (const d of collectDescendants(next.tasks, root.id)) carriedBy.set(d, units.tasks[0])
      }
    }
    for (const id of units.tasks) {
      carriedBy.set(id, id)
      for (const d of collectDescendants(tasks, id)) carriedBy.set(d, id)
    }
    for (const p of units.projects) for (const x of tasks) if (x.projectId === p) carriedBy.set(x.id, p)

    const originOf = (row: Task) =>
      carriedBy.get(row.id) ?? (row.id.startsWith(PREVIEW_MARK) ? row.id.slice(PREVIEW_MARK.length) : undefined)

    const children = buildChildrenMap(next.tasks)
    const build = (list: Task[]): PreviewRow[] =>
      list.map((task) => ({
        task,
        from: originOf(task),
        kids: build((children.get(task.id) ?? []).filter((k) => !isArchived(k))),
      }))

    const roots =
      place.kind === 'task'
        ? [next.tasks.find((x) => x.id === place.id)].filter((x): x is Task => x != null)
        : (children.get(null) ?? []).filter(
            (x) => x.projectId === (place.kind === 'newProject' ? PREVIEW_PROJECT : place.id) && !isArchived(x),
          )
    return { roots: build(roots), projectId: at.projectId }
  }, [anything, place, tasks, projects, units, asFolder, t])

  const colorOf = (unitId: string) =>
    projects.find((p) => p.id === unitId)?.color ?? '#94a3b8'

  const projectSteps = history.steps.filter((step) => step.kind === 'move').slice().reverse()

  const submit = () => {
    if (!anything || !place) return
    moveUnits(units, place, asFolder)
    onClose()
  }

  return (
    <Modal title={t('project.manage')} onClose={onClose} width={860}>
      <div className="space-y-3">
        {/* The two trees are one row, and the right one is a step shorter so the
            "or new project" button under it ends level with the left tree's
            bottom — the two columns are read against each other, and bottoms that
            do not line up read as one of them having failed to load. */}
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('move.sources')}</div>
            <div className="h-64">
              <UnitTree
                tasks={tasks}
                projects={projects}
                mode="pick"
                ticked={ticked}
                onPick={pick}
                blocked={
                  // A project with nothing in it is not a unit — see `movingUnits`.
                  new Set(projects.filter((p) => !tasks.some((x) => x.projectId === p.id)).map((p) => p.id))
                }
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('move.target')}</div>
            <div className="h-56">
              <UnitTree
                tasks={tasks}
                projects={projects}
                mode="target"
                selected={newProject ? null : (target?.id ?? null)}
                onPick={(id) => {
                  setNewProject(false)
                  setTarget({ kind: projects.some((p) => p.id === id) ? 'project' : 'task', id })
                }}
                blocked={moving}
              />
            </div>
            <div className="h-8 flex items-center gap-1.5 text-[11px] text-dim">
              <span>{t('move.newProjectOr')}</span>
              <button
                onClick={() => {
                  setNewProject(true)
                  setTarget(null)
                }}
                className={`h-6 px-2 rounded-[3px] border text-[11px] ${
                  newProject
                    ? 'border-accent text-accent bg-accent/15'
                    : 'border-border text-muted hover:text-fg hover:bg-panel2'
                }`}
              >
                {t('move.newProject')}
              </button>
            </div>
          </div>
        </div>

        {/* Greyed rather than hidden when nothing ticked is a project: the choice
            does not apply, and a row that comes and goes moves everything under
            it every time. */}
        <div className={hasProject ? '' : 'opacity-40 pointer-events-none'}>
          <Field label={t('project.moveMode')}>
            <Segmented
              value={asFolder ? 'folder' : 'flat'}
              onChange={(v) => setAsFolder(v === 'folder')}
              options={[
                { value: 'folder', label: t('project.moveModeFolder') },
                { value: 'flat', label: t('project.moveModeFlat') },
              ]}
            />
          </Field>
        </div>

        {preview && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-dim mb-1">
              {`${t('move.target')} · ${
                place?.kind === 'newProject'
                  ? t('move.newProjectName')
                  : (projects.find((p) => p.id === (target?.kind === 'project' ? target.id : undefined))
                      ?.name ?? '')
              }`}
            </div>
            <div className="max-h-72 overflow-auto bg-panel2/40 border border-border rounded-[3px] py-1">
              {place?.kind === 'task' &&
                (() => {
                  const at = tasks.find((x) => x.id === place.id)
                  return at ? (
                    <div className="h-6 flex items-center text-[12px] pl-2">
                      <span className="truncate text-fg">{at.name}</span>
                    </div>
                  ) : null
                })()}
              {place?.kind !== 'task' && (
                <div className="h-6 flex items-center text-[12px] pl-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 mr-1.5"
                    style={{
                      background:
                        place?.kind === 'newProject'
                          ? '#94a3b8'
                          : (projects.find((p) => p.id === place?.id)?.color ?? '#888'),
                    }}
                  />
                  <span className="truncate text-fg">
                    {place?.kind === 'newProject'
                      ? t('move.newProjectName')
                      : (projects.find((p) => p.id === place?.id)?.name ?? '')}
                  </span>
                </div>
              )}
              <PreviewRun
                nodes={preview.roots}
                depth={1}
                parentRails={[]}
                colorOf={colorOf}
                isOpen={(id) => previewOpen.has(id)}
                onToggle={togglePreview}
              />
            </div>
          </div>
        )}

        {/* The project-level half of the history tree, as a heading rather than a
            button, and under the same name the toolbar's entry uses: it is one
            tree with a filter on it, not a second record. */}
        {projectSteps.length > 0 && (
          <details className="border border-border rounded-[3px]">
            <summary className="cursor-pointer px-2 h-8 flex items-center text-[10px] uppercase tracking-wider text-dim hover:text-fg">
              {t('history.title')}（{projectSteps.length}）
            </summary>
            <div className="max-h-40 overflow-auto border-t border-line">
              {projectSteps.map((step) => (
                <button
                  key={step.id}
                  // Jumps and closes: the board underneath this dialog is about to
                  // be a different board, and a form full of ticked rows chosen
                  // against the old one would be describing the wrong thing.
                  onClick={() => {
                    historyGoTo(step.id)
                    onClose()
                  }}
                  className="w-full flex items-center gap-2 px-2 h-7 text-[12px] text-left text-muted hover:text-fg hover:bg-panel2"
                >
                  <span className="font-mono text-[11px] text-dim shrink-0">{step.at}</span>
                  <span className="flex-1 truncate">{step.label}</span>
                </button>
              ))}
            </div>
          </details>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
            {t('common.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!anything || !place}
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]"
          >
            {t('move.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

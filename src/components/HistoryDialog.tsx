import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Modal } from './ui'
import { useStore } from '../store/useStore'
import { HistoryStep, cursorChain, deltaCount, deltaNames, inEffectIds } from '../lib/history'
import { useT } from '../lib/useT'

/** How many names a folded node lists before it says how many are left. */
const NAMES_SHOWN = 20

/** One lane of the graph, in pixels. */
const LANE = 14
/** Room to the left of lane 0, so a dot is not clipped by the dialog's edge. */
const PAD = 7
/** The row's height, and the height of the little svg drawn in it. */
const ROW_H = 24
/** The radius of a commit's dot, and of the halo that sits under it. */
const DOT_R = 3.5

/**
 * The colours the lanes take, in order, wrapping.
 *
 * Deliberately **not** `PROJECT_COLORS`: those mean "which project", and a lane
 * does not. Reusing them would put project identity on a line that has none —
 * the same mistake as painting a status colour on something that is not a
 * status. These six are the graph's own vocabulary and nothing else reads them.
 */
const LANES = ['#5aa9e6', '#5fc27e', '#d98b4a', '#9b8cf0', '#4fbdb0', '#c97bab']
const laneColor = (i: number) => LANES[i % LANES.length]

interface Row {
  step: HistoryStep | null
  /** The lane this row's own node sits in. */
  lane: number
  /** Lanes whose line runs through this row, each with whether it is the chain. */
  through: { lane: number; solid: boolean }[]
  /** Lanes that leave this row: one per branch made here. */
  forks: { lane: number; solid: boolean }[]
  /** It has steps under it, so it gets a fold. */
  kids: boolean
  /** Only meaningful when `kids`: is its own branch showing. */
  open: boolean
}

/**
 * Every structural change since the app opened, as a graph you can walk to.
 *
 * **Drawn, not spelled out.** An earlier version drew the lineage with hairlines
 * in right-angled 12-pixel cells, and at any size it read as box-drawing
 * characters that had gone wrong: forks were a stub plus a corner, and following
 * a branch across three rows meant counting pixels. This is the shape a source
 * control graph uses instead — a lane per branch, a curve where a branch leaves
 * one, a filled dot on each step — because that is a picture whose whole purpose
 * is to make a fork obvious at a glance.
 *
 * **It grows upwards.** The board as it was when the app opened is the bottom
 * line and each step sits above the one it was made from, so the newest work is
 * at the top and the origin at the bottom. `flex-col-reverse` turns the rows
 * over; each row's own svg is drawn normally, with y=0 at its top edge, which is
 * the side its children are on.
 *
 * **The tree is not a list of everything that happened, it is everything that is
 * still reachable.** A step you undid and then left behind by doing something
 * else is still on the tree — that is the point of keeping the branch — and it is
 * drawn dim, because dim here means "not in effect", not "broken". The lane's hue
 * is untouched by that: hue says which branch, brightness says whether it counts.
 *
 * Clicking a line walks the board there, however many steps away that is. Opening
 * one is a separate click on a separate control, because "I only wanted to see
 * what it touched" must not turn into an undo.
 */
export function HistoryDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const history = useStore((s) => s.history)
  const goTo = useStore((s) => s.historyGoTo)
  /**
   * Which branches are **open** — an absent id is a shut one, so the default is
   * the thing that needs no setting.
   *
   * The default is the chain that is in effect and nothing else. That is the
   * answer to a real problem rather than a tidy one: a branch's lane has to run
   * alongside every row between where it was made and the step it was made from,
   * and rows belonging to a branch you have left are exactly what it has to get
   * past. Folded, an abandoned branch shows as its head and nothing under it, so
   * the line crossing it is one row long instead of twenty.
   *
   * A board with no branches on it is one long chain — every step in effect — so
   * nothing is folded and the picture is unchanged from before this existed.
   */
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(cursorChain(history.steps, history.cursor)),
  )

  /** Opening a branch is also how you follow a jump: land somewhere and the path
   *  that leads to it has to be on screen. */
  const reveal = (id: string | null) =>
    setOpen((prev) => new Set([...prev, ...cursorChain(history.steps, id)]))

  const live = useMemo(() => inEffectIds(history.steps, history.cursor), [history.steps, history.cursor])

  const layout = useMemo(() => {
    const kids = new Map<string | null, HistoryStep[]>()
    for (const step of history.steps) {
      const list = kids.get(step.parent)
      if (list) list.push(step)
      else kids.set(step.parent, [step])
    }

    // Lanes are handed out down the tree: the first child inherits its parent's
    // lane, every later one takes the next unused lane. The counter only ever
    // grows, so two branches are never drawn in one lane and no line has to be
    // broken to get past another. (A plain *depth* would be the same number only
    // for a task tree, where a child is inside its parent; here every step is
    // made from the one before it, so a chain of fifty would be fifty lanes wide
    // — a staircase where the picture should be a straight line.)
    const flat: { step: HistoryStep | null; lane: number }[] = []
    const forkOf = new Map<string | null, number>()
    /** The row a lane was created at — where its curve leaves. */
    const forkAt = new Map<number, number>()
    let nextLane = 1

    /**
     * `parentRow` is the row index of the node whose children these are, and it
     * is a parameter rather than `flat.length - 1` — which is what it looks like
     * it should be, and which is wrong the moment there is more than one child:
     * by the time the second one is reached, the last row pushed belongs to the
     * first one's subtree, and the branch's curve is drawn from a row that has
     * nothing to do with where it leaves.
     */
    const place = (parent: string | null, lane: number, parentRow: number): number => {
      let forkTo = lane
      ;(kids.get(parent) ?? []).forEach((step, i) => {
        const mine = i === 0 ? lane : nextLane++
        forkTo = Math.max(forkTo, mine)
        if (mine !== lane) forkAt.set(mine, parentRow)
        flat.push({ step, lane: mine })
        // Shut: the row stays and what hangs under it does not. The lanes are
        // worked out over what is *drawn*, not over the whole tree — a span
        // measured against rows nobody can see would leave a line reaching down
        // to nothing.
        const kidsHere = open.has(step.id) ? place(step.id, mine, flat.length - 1) : mine
        forkOf.set(step.id, kidsHere)
      })
      return forkTo
    }

    flat.push({ step: null, lane: 0 })
    forkOf.set(null, place(null, 0, 0))

    const first = new Map<number, number>()
    const last = new Map<number, number>()
    flat.forEach((r, i) => {
      if (!first.has(r.lane)) first.set(r.lane, i)
      last.set(r.lane, i)
    })

    // A lane's line runs from the row it was forked at to the last row in it. The
    // curve has to reach the fork, not start at the branch's own first node: the
    // rows in between belong to the branch it left, and a line drawn only from
    // the node would leave the curve at the fork pointing at nothing.
    const lo = (j: number) => Math.min(forkAt.get(j) ?? first.get(j) ?? 0, first.get(j) ?? 0)
    const hi = (j: number) => Math.max(last.get(j) ?? 0, forkAt.get(j) ?? 0)

    const forksByRow = new Map<number, number[]>()
    for (const [lane, row] of forkAt) {
      const list = forksByRow.get(row)
      if (list) list.push(lane)
      else forksByRow.set(row, [lane])
    }

    /**
     * Which lanes **carry the chain you are on**, whole.
     *
     * A lane made by a fork between two steps that are both in effect is the
     * chain crossing over: it exists precisely to get from a step to its parent
     * past rows belonging to a branch you left. Drawn by the row rule — solid
     * where the row is in effect, dim where it is not — that lane breaks into
     * bright and dim pieces across exactly the rows it was made for, and the one
     * line a reader most wants to follow is the one they cannot.
     *
     * The mainline is not one of these: its rows include the abandoned branch's
     * own steps, and those segments really are off the chain. So this is
     * consulted per lane *or* per row, and a lane that fails it still draws solid
     * on the rows that are in effect.
     */
    const laneSteps = new Map<number, string[]>()
    for (const r of flat) {
      if (!r.step) continue
      laneSteps.set(r.lane, [...(laneSteps.get(r.lane) ?? []), r.step.id])
    }
    const chainLane = new Set<number>()
    for (const [lane, ids] of laneSteps) {
      const forkedAt = forkAt.get(lane)
      const from = forkedAt != null ? flat[forkedAt]?.step?.id : undefined
      if (ids.every((id) => live.has(id)) && (from === undefined || live.has(from))) chainLane.add(lane)
    }
    const solid = (lane: number, row: number) => chainLane.has(lane) || live.has(flat[row].step?.id ?? null)

    const width = Math.max(1, nextLane) * LANE + PAD * 2
    return {
      width,
      rows: flat.map((r, i) => ({
        step: r.step,
        lane: r.lane,
        // Not for the opening board: it is the floor of the graph rather than a
        // step on it, and folding it would hide everything — a control whose only
        // use is to empty the dialog.
        kids: r.step != null && (kids.get(r.step.id) ?? []).length > 0,
        open: r.step != null && open.has(r.step.id),
        through: Array.from({ length: Math.max(1, nextLane) }, (_, j) => j)
          .filter((j) => lo(j) <= i && i <= hi(j))
          .map((j) => ({ lane: j, solid: solid(j, i) })),
        forks: (forksByRow.get(i) ?? []).map((j) => ({ lane: j, solid: solid(j, i) })),
      })),
    }
  }, [history.steps, open, live])

  // The other fold, on the other side of the row: this one opens the *names*
  // under a step, and touches nothing about the graph. Two chevrons a row apart
  // rather than one that means two things.
  const [details, setDetails] = useState<ReadonlySet<string>>(() => new Set())
  const toggleBranch = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleDetail = (id: string) =>
    setDetails((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const x = (lane: number) => PAD + lane * LANE

  return (
    <Modal title={t('history.title')} onClose={onClose} width={620}>
      {history.steps.length === 0 ? (
        <div className="text-[12px] text-dim px-2 py-3">{t('history.empty')}</div>
      ) : (
        <div className="max-h-[60vh] overflow-auto flex flex-col-reverse">
          {layout.rows.map((row) => {
            const step = row.step
            const id = step?.id ?? null
            const isCursor = history.cursor === id
            const isLive = live.has(id)
            const names = step ? deltaNames(step.delta) : null
            const groups = names
              ? ([
                  ['history.added', names.added],
                  ['history.removed', names.removed],
                  ['history.changed', names.changed],
                  ['history.projectAdded', names.projectAdded],
                  ['history.projectRemoved', names.projectRemoved],
                  ['history.projectChanged', names.projectChanged],
                ] as const).filter(([, list]) => list.length > 0)
              : []
            const count = step ? deltaCount(step.delta) : 0
            const expanded = id !== null && details.has(id)
            // Hue says which branch. Brightness says whether that piece of line
            // is the chain you are on — a fact about the lane, not about the row
            // it happens to be passing through. See `chainLane`.
            const dim = 0.35
            // **A step that is not in effect says nothing until it is pointed
            // at.** The graph keeps every node — the shape of the branches is
            // half of what this picture is for — but the text belongs to the
            // chain you are on, and a list of twenty operations where six are
            // ones you undid reads as twenty operations. Pointing at a row is
            // how you ask what that node was.
            //
            // Hidden rather than dropped: the row keeps its height, so the lanes
            // still line up with the labels beside them.
            const ghost = !isLive
            return (
              <div key={id ?? 'root'}>
                {/* The row is tinted on hover, and that is what ties a name to
                    its node: the names are all in one column and the dots are not,
                    so pointing at a row is how you find out which dot is its
                    own. The dot grows a little too, for the same reason. */}
                <div className="h-6 flex items-stretch text-[12px] hover:bg-panel2/60 group">
                  <svg width={layout.width} height={ROW_H} className="shrink-0" aria-hidden>
                    {/* The lanes themselves, edge to edge so the line is
                        unbroken from one row to the next. */}
                    {row.through.map((seg) => (
                      <line
                        key={`t${seg.lane}`}
                        x1={x(seg.lane)}
                        y1={0}
                        x2={x(seg.lane)}
                        y2={ROW_H}
                        stroke={laneColor(seg.lane)}
                        strokeWidth={2}
                        strokeLinecap="round"
                        opacity={seg.solid ? 1 : dim}
                      />
                    ))}
                    {/* A branch leaving this row: out of the dot, up to the new
                        lane's own edge, so it meets that lane's vertical. */}
                    {row.forks.map((seg) => (
                      <path
                        key={`f${seg.lane}`}
                        d={`M ${x(row.lane)} ${ROW_H / 2} C ${x(row.lane)} ${ROW_H * 0.2} ${x(seg.lane)} ${ROW_H * 0.3} ${x(seg.lane)} 0`}
                        fill="none"
                        stroke={laneColor(seg.lane)}
                        strokeWidth={2}
                        strokeLinecap="round"
                        opacity={seg.solid ? 1 : dim}
                      />
                    ))}
                    {/* No halo behind the dot. It looks like the obvious way to
                        keep a passing branch from reading as part of the node,
                        but it cannot happen — lanes are never in the same column
                        — and a halo big enough to matter is a hole punched in
                        the node's *own* lane, which is the line the dot is
                        supposed to sit on. Drawn plain, the same hue merges and
                        the dot reads as a step along it. */}
                    <circle
                      cx={x(row.lane)}
                      cy={ROW_H / 2}
                      r={isCursor ? DOT_R + 1 : DOT_R}
                      fill={laneColor(row.lane)}
                      opacity={isLive ? 1 : dim}
                      pointerEvents="none"
                    />
                    {/* **The node is the way in**, not the name beside it. A
                        label that acts is a label somebody presses while reading;
                        the graph is the part that means something, so the graph
                        is the part you click. The target is deliberately much
                        wider than the dot — seven pixels is a thing you miss. */}
                    <circle
                      cx={x(row.lane)}
                      cy={ROW_H / 2}
                      r={9}
                      fill="transparent"
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={step?.label ?? t('history.now')}
                      onClick={() => {
                        goTo(id)
                        reveal(id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return
                        e.preventDefault()
                        goTo(id)
                        reveal(id)
                      }}
                    />
                  </svg>
                  {/* The branch's fold. On this side of the name because that
                      is where the app puts every row's fold — and it is why it
                      is hidden until the row is under the pointer: the row
                      already has a chevron at its other end that opens the
                      *names*, and two identical triangles doing different things
                      is a control you learn by pressing it wrong.
                      Every one of them hides, folded or not — the row keeps its
                      dot and its lane, so "there is a branch here" is still on
                      screen; what the triangle adds is only "you can fold it". */}
                  <span className="w-4 shrink-0 flex items-center justify-center text-dim">
                    {row.kids && (
                      <button
                        type="button"
                        onClick={() => toggleBranch(id!)}
                        aria-expanded={row.open}
                        aria-label={step?.label ?? t('history.now')}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-fg transition-opacity"
                      >
                        {row.open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    )}
                  </span>
                  <span
                    title={step?.label ?? t('history.now')}
                    className={`flex-1 min-w-0 truncate text-left pl-1 ${
                      ghost ? 'opacity-0 group-hover:opacity-100' : ''
                    } ${isCursor ? 'text-fg font-medium' : isLive ? 'text-fg/75' : 'text-dim'}`}
                  >
                    {step ? (
                      <>
                        <span className="font-mono text-[11px] text-dim mr-1.5">{step.at}</span>
                        {step.label}
                        {count > 0 && (
                          <span className="text-dim ml-1.5">· {t('history.count', { count })}</span>
                        )}
                      </>
                    ) : (
                      t('history.now')
                    )}
                  </span>
                  {/* Folding and walking are different things, so they are
                      different controls: this one never moves the board. */}
                  {groups.length > 0 && (
                    <button
                      onClick={() => toggleDetail(id!)}
                      aria-expanded={expanded}
                      aria-label={t('history.title')}
                      className={`w-5 shrink-0 inline-flex items-center justify-center text-dim hover:text-fg ${
                        ghost ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : ''
                      }`}
                    >
                      <ChevronRight size={12} className={expanded ? 'rotate-90' : ''} />
                    </button>
                  )}
                </div>
                {expanded && (
                  <div className="pb-1 text-[11px] leading-5 text-fg/60" style={{ paddingLeft: layout.width + 4 }}>
                    {groups.map(([key, list]) => (
                      <div key={key}>
                        <span className="text-dim">{t(key)}：</span>
                        {list.slice(0, NAMES_SHOWN).join(t('common.listSeparator'))}
                        {list.length > NAMES_SHOWN && (
                          <span className="text-dim"> {t('history.more', { count: list.length - NAMES_SHOWN })}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

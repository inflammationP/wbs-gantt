import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { routineRows } from '../../lib/habits'
import { todaysChores } from '../../lib/chores'
import { toggleIn } from '../../lib/ui'
import { useDismiss } from '../../lib/useDismiss'
import { useStore } from '../../store/useStore'
import { useT } from '../../lib/useT'
import { ChoreRow, HabitLine } from '../DayBoard'

/**
 * Today's routines or its chores, in a bubble off the Gantt's column header.
 *
 * **A bubble and not a panel.** The detail panels on the right of this chart are
 * for a task or a day the reader picked out; these two lists are the ones that
 * are outside the tree — no WBS number, no progress, no dates — and they are
 * opened to be read and ticked and then put away. So each hangs off its button,
 * over the board, and leaves the chart's width and rows exactly as they were. It
 * is deliberately not a modal: nothing here needs an answer, and a dialog would
 * have to be dismissed twice.
 *
 * **The rows are the day views' own, literally** — `HabitLine` and `ChoreRow`,
 * the components the Today page and the day panel draw, with the pencils left
 * off (`editable` false) because both are written where they are written. One
 * implementation of "a routine on a day" and of "a chore on a day" is the point:
 * the tick, the strike, the heading's read-only box, the fold and the carried
 * badge are the same facts here as there. A second copy of either row would be a
 * second answer to "was this done today".
 *
 * The list is the Today page's: open work that has come due (carried chores
 * included) plus what was finished today. `plannedFor` is the calendar's
 * question and would answer a different one.
 *
 * The clock is the store's `today`, not the browser's: the board's rows are
 * drawn against that day, and a bubble that ticked a different one would write a
 * fact about a date the screen is not showing.
 */
export function DailyBubble({ kind, at, onClose }: {
  /** Which of the day's two lists is up. One bubble at a time, per the page. */
  kind: 'habits' | 'chores'
  /** The trigger's bottom-right corner, in viewport coordinates. */
  at: { x: number; y: number }
  onClose: () => void
}) {
  const t = useT()
  const habits = useStore((s) => s.habits)
  const chores = useStore((s) => s.chores)
  const today = useStore((s) => s.today)
  const toggleHabit = useStore((s) => s.toggleHabit)
  // Which headings are closed. Folded ids rather than open ones, the same way
  // round as `routineRows` wants them and as the day board keeps them: a branch
  // is open until somebody says otherwise.
  const [folded, setFolded] = useState<Set<string>>(() => new Set())
  const routines = useMemo(() => routineRows(habits, today, folded), [habits, today, folded])
  const dayChores = useMemo(() => todaysChores(chores, today), [chores, today])

  // A press outside, or Escape — and what counts as "outside" is the two marks
  // below: the bubble, and the button it hangs off. See `useDismiss` for why the
  // button has to be named. Both buttons share the name: pressing the other one
  // is answered by that button (it swaps the bubble), not by this handler.
  useDismiss('[data-daily-bubble], [data-daily-toggle]', onClose)

  const W = 320
  // To the right of the button, and kept on screen: the button sits near the
  // middle of a wide window, so a long day's list can run past the right edge —
  // and a short window can have no room below it at all.
  const left = Math.min(at.x + 8, window.innerWidth - W - 8)
  const top = Math.min(at.y, window.innerHeight - 360)

  const empty = kind === 'habits' ? t('habit.none') : t('chore.noneOnDay')

  return createPortal(
    <>
      {/* The tail — drawn rather than measured: a square, rotated, sharing the
          bubble's fill and its left border so the two read as one shape. It is
          its own element *outside* the bubble, and behind it in paint order, so
          that the bubble's rounded corners can clip its contents without also
          cutting the tail off. Its `top` is the button's own middle: the tail is
          what says which button this came out of. */}
      <div
        data-daily-bubble
        className="fixed z-[70] w-2 h-2 rotate-45 bg-panel border-l border-b border-border"
        style={{ left: left - 5, top: top + 6 }}
      />
      <div
        data-daily-bubble
        className="fixed z-[70] bg-panel border border-border rounded-[4px] shadow-2xl overflow-hidden"
        style={{ left, top, width: W }}
      >
        <div className="px-2.5 h-8 flex items-center text-[12px] font-medium text-fg border-b border-line">
          {kind === 'habits' ? t('habit.section') : t('chore.section')}
        </div>
        <div className="max-h-[320px] overflow-auto py-1">
          {kind === 'habits' ? (
            routines.length === 0 ? (
              <div className="px-2.5 py-1.5 text-[12px] text-dim">{empty}</div>
            ) : (
              routines.map((row) => (
                <HabitLine
                  key={row.habit.id}
                  row={row}
                  editable={false}
                  onToggle={row.hasKids ? undefined : () => toggleHabit(row.habit.id)}
                  onToggleFold={() => setFolded((f) => toggleIn(f, row.habit.id))}
                />
              ))
            )
          ) : dayChores.length === 0 ? (
            <div className="px-2.5 py-1.5 text-[12px] text-dim">{empty}</div>
          ) : (
            dayChores.map((c) => <ChoreRow key={c.id} chore={c} today={today} editable={false} />)
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

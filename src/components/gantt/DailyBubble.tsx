import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { routineRows } from '../../lib/habits'
import { toggleIn } from '../../lib/ui'
import { useDismiss } from '../../lib/useDismiss'
import { useStore } from '../../store/useStore'
import { useT } from '../../lib/useT'
import { HabitLine } from '../DayBoard'

/**
 * Today's routines, in a bubble off the Gantt's column header.
 *
 * **A bubble and not a panel.** The detail panels on the right of this chart are
 * for a task or a day the reader picked out; this is the one list that is the
 * same every day, opened to be read and ticked and then put away — so it hangs
 * off the button that opened it, over the board, and leaves the chart's width
 * and rows exactly as they were. It is deliberately not a modal: nothing here
 * needs an answer, and a dialog would have to be dismissed twice.
 *
 * **The rows are the day view's, literally** — `HabitLine`, the same component
 * the Today page and the day panel draw, with the pencil left off (`editable`
 * false) because a routine is written where it is written. One implementation of
 * "a routine on a day" is the point: the tick, the strike, the heading's read-only
 * box and the fold are the same facts here as there, and a second copy of that
 * row would be a second answer to "was this done today".
 *
 * Nothing is offered but the tick, and a heading is not even that: `onToggle` is
 * passed only for the rows that have no children, exactly as `DayBoard` does.
 * A heading's tick is its children's.
 *
 * The clock is the store's `today`, not the browser's: the board's rows are
 * drawn against that day, and a bubble that ticked a different one would write a
 * fact about a date the screen is not showing.
 */
export function DailyBubble({ at, onClose }: {
  /** The trigger's bottom-right corner, in viewport coordinates. */
  at: { x: number; y: number }
  onClose: () => void
}) {
  const t = useT()
  const habits = useStore((s) => s.habits)
  const today = useStore((s) => s.today)
  const toggleHabit = useStore((s) => s.toggleHabit)
  // Which headings are closed. Folded ids rather than open ones, the same way
  // round as `routineRows` wants them and as the day board keeps them: a branch
  // is open until somebody says otherwise.
  const [folded, setFolded] = useState<Set<string>>(() => new Set())
  const routines = useMemo(() => routineRows(habits, today, folded), [habits, today, folded])

  // A press outside, or Escape — and what counts as "outside" is the two marks
  // below: the bubble, and the button it hangs off. See `useDismiss` for why the
  // button has to be named.
  useDismiss('[data-daily-bubble], [data-daily-toggle]', onClose)

  const W = 320
  // To the right of the button, and kept on screen: the button sits near the
  // middle of a wide window, so a long day's list can run past the right edge —
  // and a short window can have no room below it at all.
  const left = Math.min(at.x + 8, window.innerWidth - W - 8)
  const top = Math.min(at.y, window.innerHeight - 360)

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
          {t('habit.section')}
        </div>
        <div className="max-h-[320px] overflow-auto py-1">
          {routines.length === 0 ? (
            <div className="px-2.5 py-1.5 text-[12px] text-dim">{t('habit.none')}</div>
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
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

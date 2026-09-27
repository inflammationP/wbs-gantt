import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { CopyKey, collectDay, copy } from '../lib/reminder'
import { strictLogRate } from '../lib/dayTasks'
import { sig } from '../lib/ui'
import { addDays, toDate, toISO } from '../lib/dates'
import { formatShortDate } from '../lib/i18n'
import { useT } from '../lib/useT'
import { Modal } from './ui'

const ACCENT = 'rgb(var(--c-accent))'

/**
 * The panel behind the sidebar's report button: yesterday's tally over today's
 * shape, in numbers.
 *
 * **It is a recap, not a list.** The first draft listed every outstanding item
 * with a link to each, and it was the Today page under a different title — same
 * data, same rows, one more place to read them. What is here instead is the
 * thing no page shows: how much got done yesterday, and how big today is. Names
 * are deliberately absent. A name is what you go to the board to find; a count
 * is what tells you whether you need to.
 *
 * **Three levels, and each one earns its size:**
 *
 * 1. the section — 昨日 is a result, 今天 is the subject, so 今天 is drawn at
 *    full strength and 昨日 recedes behind it
 * 2. the row — a label at normal size, and its figure in `font-mono` so a column
 *    of them lines its digits up
 * 3. the sub-row — the three deadline counts, folded under one figure until
 *    asked for, indented and smaller
 *
 * **A zero is dimmed, not hidden.** "已逾期 0" is the news this whole feature
 * exists to deliver, so it stays; but on a day where it is the only zero, the
 * rows that do have something in them should be what the eye lands on first.
 * Only the whole of today being empty gets a sentence instead, because five
 * zeroes in a column is a worse way to say "clean".
 */
export function DailyReport({ onClose }: { onClose: () => void }) {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const today = useStore((s) => s.today)
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const chores = useStore((s) => s.chores)
  const habits = useStore((s) => s.habits)
  const leadDays = useStore((s) => s.reminderLeadDays)
  // The user's own wording for the panel's own two sentences. The row labels are
  // interface text, not message copy, so they are not overridable — see
  // `docs/notification-copy.md` §九.
  const overrides = useStore((s) => s.reminderCopy[s.lang])
  const [openTasks, setOpenTasks] = useState(false)

  const yesterday = toISO(addDays(toDate(today), -1))

  const recap = useMemo(() => {
    const { total, pct } = strictLogRate(tasks, logs, yesterday)
    return {
      // Entries, not tasks: two logs on one task is two things written down, and
      // that is what the line counts.
      written: logs.filter((l) => l.date === yesterday).length,
      // What the day asked for. The same figure the rate below is a percentage
      // of, and the same one the day's ring and the Calendar cell are drawn
      // from — so `3 / 5` here and `60%` beside it are one fact, not two.
      owed: total,
      pct,
    }
  }, [tasks, logs, yesterday])

  const cats = useMemo(
    () => collectDay({ tasks, logs, chores, habits }, today, leadDays),
    [tasks, logs, chores, habits, today, leadDays],
  )

  // Today's obligations, counted the same way yesterday's were — the smallest
  // tasks, the ones that owe a log. It is the same figure the day's ring and the
  // Calendar cell are drawn from, and the same one yesterday's rate is a
  // percentage *of*, so the two sections of this panel are asking one question
  // about two days rather than two questions about one.
  const owedToday = useMemo(() => strictLogRate(tasks, logs, today).total, [tasks, logs, today])

  // The three deadline counts are one thought — "what is due, and how late" —
  // so they share a figure and open on demand. Three rows saying 4, 1 and 2 put
  // the same kind of news three times in the reader's way.
  //
  // These three go through `copy` rather than `t`, unlike every other label on
  // the panel: they name three of the notification's seven categories, so they
  // are the words the *messages* use, and a user who renames 已逾期 in Settings
  // must not find the panel still calling it something else.
  const open = (category: string) => copy(`topic.${category}` as CopyKey, lang, overrides)
  const deadlines: [string, number][] = [
    [open('dueToday'), cats.dueToday.length],
    [open('overdue'), cats.overdue.length],
    [open('dueSoon'), cats.dueSoon.length],
  ]
  const deadlineTotal = deadlines.reduce((n, [, v]) => n + v, 0)
  // The rest go through `copy` too, and all four of these are the very keys the
  // day's opening notification renders its four figures from. One source for
  // "任务清单" and "到期与逾期" rather than a dictionary entry here and a copy
  // key there, which would be two answers the first time either was reworded.
  const rest: [string, number][] = [
    [copy('topic.chores', lang, overrides), cats.chores.length],
    [copy('topic.habits', lang, overrides), cats.habits.length],
  ]
  // Everything today has to say. The obligation count is in here as well as the
  // deadlines: a day can owe a log with nothing due on it, and that is still a
  // day this panel has something to report.
  const todayTotal = owedToday + deadlineTotal + rest.reduce((n, [, v]) => n + v, 0)

  return (
    <Modal title={copy('report.title', lang, overrides)} onClose={onClose} width={400}>
      <Section label={t('reminder.reportYesterday')} date={formatShortDate(lang, toDate(yesterday))} past>
        <Row label={t('day.strictLogs')} value={recap.written} of={recap.owed} />
        <Row label={t('reminder.reportRate')} value={recap.pct} bar />
      </Section>

      <Section label={t('reminder.reportToday')} date={formatShortDate(lang, toDate(today))}>
        {todayTotal === 0 ? (
          <div className="px-1 py-2 text-[12px] text-muted">{copy('report.empty', lang, overrides)}</div>
        ) : (
          <>
            <Row label={copy('group.tasks', lang, overrides)} value={owedToday} />
            <Row
              label={copy('group.deadlines', lang, overrides)}
              value={deadlineTotal}
              open={openTasks}
              onToggle={deadlineTotal > 0 ? () => setOpenTasks((o) => !o) : undefined}
            />
            {openTasks &&
              deadlines.map(([label, value]) => <Row key={label} label={label} value={value} indent />)}
            {rest.map(([label, value]) => (
              <Row key={label} label={label} value={value} />
            ))}
          </>
        )}
      </Section>
    </Modal>
  )
}

/**
 * One titled block. The rule under the heading is what separates the levels.
 *
 * `past` is the whole of how 昨日 is set apart: a dimmer heading and a muted
 * date. It has already happened, and the panel exists to talk about today — so
 * the section that is over should be readable without being the first thing
 * read.
 */
function Section({
  label,
  date,
  past,
  children,
}: {
  label: string
  date: string
  past?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="mb-5 last:mb-0">
      <div className="flex items-baseline gap-2 pb-1.5 mb-1.5 border-b border-line">
        <h3 className={`text-[12px] font-semibold tracking-wide ${past ? 'text-muted' : 'text-fg'}`}>{label}</h3>
        <span className="text-[10px] text-dim">{date}</span>
      </div>
      {children}
    </section>
  )
}

/**
 * A label and its figure, on one line.
 *
 * Four things carry meaning here and nothing else is decoration:
 *
 * - **the figure is `font-mono`** and right-aligned, so the column reads as a
 *   column of numbers rather than of sentences
 * - **a zero goes dim** — see the note on the panel
 * - **`bar`** draws the figure as a proportion as well as a number. Only the
 *   completion rate is a proportion, and the two colours are the pair
 *   `DayBoard`'s ring already uses for the same idea at the same threshold
 * - **`indent`** is a sub-row: pushed in, a step smaller, and it gives up the
 *   chevron for a dot because it does not open
 */
function Row({
  label,
  value,
  of,
  bar,
  indent,
  open,
  onToggle,
}: {
  label: string
  value: number
  /** The figure it is out of. Rendered dimmer — it is the context, not the result. */
  of?: number
  /** The value is a percentage: draw it as a filled track as well as a figure. */
  bar?: boolean
  indent?: boolean
  /** Present on a row that opens. */
  open?: boolean
  onToggle?: () => void
}) {
  const zero = value === 0
  const body = (
    <>
      {/* One slot for both markers, because a chevron is three times the width
          of a dot and a bare one would shove this row's label out of the column
          the rows below it are in. */}
      <span className="w-3 flex items-center justify-center shrink-0">
        {onToggle ? (
          <ChevronRight
            size={12}
            className={`text-dim transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-1 h-1 rounded-full bg-dim" />
        )}
      </span>
      <span className={`flex-1 truncate ${indent ? 'text-[11px]' : ''} ${zero ? 'text-dim' : 'text-muted'}`}>
        {label}
      </span>
      {bar && (
        <span className="w-16 h-1 rounded-full bg-panel2 overflow-hidden shrink-0">
          <span
            className="block h-full rounded-full transition-[width] duration-300"
            style={{ width: `${value}%`, background: value === 100 ? sig('completed') : ACCENT }}
          />
        </span>
      )}
      <span className={`font-mono ${indent ? 'text-[12px]' : 'text-[13px]'} ${zero ? 'text-dim' : 'text-fg'}`}>
        {bar ? `${value}%` : value}
        {of !== undefined && <span className="text-dim"> / {of}</span>}
      </span>
    </>
  )

  // `text-left` because a button centres its content and this one is a row.
  const cls = `w-full flex items-center gap-2 h-7 text-[12px] text-left ${indent ? 'pl-6 pr-1' : 'px-1'}`
  if (!onToggle) return <div className={cls}>{body}</div>
  return (
    <button onClick={onToggle} className={`${cls} rounded-[3px] hover:bg-panel2 transition-colors`}>
      {body}
    </button>
  )
}

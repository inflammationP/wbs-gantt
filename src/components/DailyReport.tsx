import { Fragment, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { CopyKey, DigestCategory, DigestItem, collectDay, copy } from '../lib/reminder'
import { strictLogRate } from '../lib/dayTasks'
import { liveTasks } from '../lib/tree'
import { sig } from '../lib/ui'
import { addDays, toDate, toISO } from '../lib/dates'
import { Lang, formatShortDate } from '../lib/i18n'
import { useT } from '../lib/useT'
import { Modal } from './ui'

const ACCENT = 'rgb(var(--c-accent))'

/** One line of the panel, and whatever it opens onto. */
interface Node {
  key: string
  label: string
  value: number
  /** Names this line opens onto. */
  items?: DigestItem[]
  /** Counts this line opens onto, each of which opens onto its own names. */
  children?: Node[]
}

/**
 * The panel behind the sidebar's report button: yesterday's tally over today's
 * shape, in numbers.
 *
 * **It is a recap, not a list.** An earlier draft listed every outstanding item
 * and it was the Today page under a different title — same data, same rows, one
 * more place to read them. What is here instead is the thing no page shows: how
 * much got done yesterday, and how big today is.
 *
 * **But every figure opens.** A count is what tells you whether you need to go
 * and look; the names underneath are for when it did, and they are one click
 * away rather than on screen. So the panel opens as four numbers and answers
 * "which ones" only when asked — which is the difference between this and the
 * list it used to be, and the difference is entirely in what it costs to *not*
 * care.
 *
 * **Three levels, and each earns its size:**
 *
 * 1. the section — 昨日 is a result, 今天 is the subject, so 今天 is drawn at
 *    full strength and 昨日 recedes behind it
 * 2. the line — a label at normal size and its figure in `font-mono`, so a
 *    column of them lines its digits up
 * 3. what it opened — one step smaller and one step further in, whether that is
 *    another count or a name
 *
 * **A zero is dimmed, not hidden.** "已逾期 0" is the news this feature exists to
 * deliver, so it stays; but on a day where it is the only zero, the rows that do
 * have something in them should be what the eye lands on first. Only the whole
 * of today being empty gets a sentence instead, because four zeroes in a column
 * is a worse way to say "clean".
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
  // The user's own wording for everything the panel calls a thing. These are the
  // same keys the day's opening notification renders its four figures from, so a
  // rename lands in both at once.
  const overrides = useStore((s) => s.reminderCopy[s.lang])
  const [opened, setOpened] = useState<Record<string, boolean>>({})

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
    // Filed-away work is not coming up: the report is the same list the push is
    // built from (`scheduleReminderSync`), and the two have to agree about what
    // is due. The log rate above is not filtered — obligations drop archived
    // tasks themselves, and they are the only part of that number that could
    // have counted one.
    () => collectDay({ tasks: liveTasks(tasks), logs, chores, habits }, today, leadDays),
    [tasks, logs, chores, habits, today, leadDays],
  )

  // The four figures the opening notification sends, and the same four rows —
  // one definition, so the panel and the 07:00 message cannot come apart.
  const nodes: Node[] = [
    { key: 'tasks', label: copy('group.tasks', lang, overrides), value: cats.obligations.length, items: cats.obligations },
    {
      key: 'deadlines',
      label: copy('group.deadlines', lang, overrides),
      value: cats.overdue.length + cats.dueToday.length + cats.dueSoon.length,
      children: [
        { key: 'overdue', label: label('overdue'), value: cats.overdue.length, items: cats.overdue },
        { key: 'dueToday', label: label('dueToday'), value: cats.dueToday.length, items: cats.dueToday },
        { key: 'dueSoon', label: label('dueSoon'), value: cats.dueSoon.length, items: cats.dueSoon },
      ],
    },
    { key: 'chores', label: label('chores'), value: cats.chores.length, items: cats.chores },
    { key: 'habits', label: label('habits'), value: cats.habits.length, items: cats.habits },
  ]
  const total = nodes.reduce((n, x) => n + x.value, 0)

  function label(key: DigestCategory) {
    return copy(`topic.${key}`, lang, overrides)
  }

  const line = (n: Node, depth: number) => {
    const opens = (n.children?.length ?? 0) + (n.items?.length ?? 0) > 0
    const isOpen = Boolean(opened[n.key])
    const flip = () => setOpened((o) => ({ ...o, [n.key]: !o[n.key] }))
    return (
      <Fragment key={n.key}>
        <Row
          label={n.label}
          value={n.value}
          depth={depth}
          open={isOpen}
          onToggle={opens ? flip : undefined}
        />
        {isOpen && n.children?.map((c) => line(c, depth + 1))}
        {isOpen && n.items?.map((item, i) => (
          // Index in the key: these are names, two of which can perfectly well
          // be the same word, and the list does not reorder within a render.
          <Name key={`${n.key}-${i}`} item={item} depth={depth + 1} today={today} lang={lang} />
        ))}
      </Fragment>
    )
  }

  return (
    <Modal title={copy('report.title', lang, overrides)} onClose={onClose} width={400}>
      <Section label={t('reminder.reportYesterday')} date={formatShortDate(lang, toDate(yesterday))} past>
        <Row label={t('day.strictLogs')} value={recap.written} of={recap.owed} depth={0} />
        <Row label={t('reminder.reportRate')} value={recap.pct} bar depth={0} />
      </Section>

      <Section label={t('reminder.reportToday')} date={formatShortDate(lang, toDate(today))}>
        {total === 0 ? (
          <div className="px-1 py-2 text-[12px] text-muted">{copy('report.empty', lang, overrides)}</div>
        ) : (
          nodes.map((n) => line(n, 0))
        )}
      </Section>
    </Modal>
  )
}

/** One titled block. The rule under the heading is what separates the levels. */
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
 * One step in from the left, per level.
 *
 * Applied to the row and to the name under it alike, so the whole tree shifts by
 * the same amount rather than each level inventing its own indent.
 */
const INDENT = 20

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
 * - **`onToggle`** makes the whole line the control, and the chevron says so
 */
function Row({
  label,
  value,
  of,
  bar,
  depth,
  open,
  onToggle,
}: {
  label: string
  value: number
  /** The figure it is out of. Rendered dimmer — it is the context, not the result. */
  of?: number
  /** The value is a percentage: draw it as a filled track as well as a figure. */
  bar?: boolean
  depth: number
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
          <ChevronRight size={12} className={`text-dim transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        ) : (
          <span className="w-1 h-1 rounded-full bg-dim" />
        )}
      </span>
      <span className={`flex-1 truncate ${depth ? 'text-[11px]' : ''} ${zero ? 'text-dim' : 'text-muted'}`}>
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
      <span className={`font-mono ${depth ? 'text-[12px]' : 'text-[13px]'} ${zero ? 'text-dim' : 'text-fg'}`}>
        {bar ? `${value}%` : value}
        {of !== undefined && <span className="text-dim"> / {of}</span>}
      </span>
    </>
  )

  // `text-left` because a button centres its content and this one is a row.
  const cls = 'w-full flex items-center gap-2 h-7 text-[12px] text-left pr-1'
  const style = { paddingLeft: 4 + depth * INDENT }
  if (!onToggle) return <div className={cls} style={style}>{body}</div>
  return (
    <button onClick={onToggle} className={`${cls} rounded-[3px] hover:bg-panel2 transition-colors`} style={style}>
      {body}
    </button>
  )
}

/**
 * One name, under the figure that counted it.
 *
 * No dot and no chevron: it is the end of a branch, and the indent is already
 * saying which figure it belongs to. The date appears on the right only when it
 * is news — a task due today carries today's date and the section header already
 * says which day this is; an overdue or an upcoming one is the whole reason its
 * line is here.
 */
function Name({ item, depth, today, lang }: { item: DigestItem; depth: number; today: string; lang: Lang }) {
  return (
    <div className="flex items-center gap-2 h-6 text-[12px] pr-1" style={{ paddingLeft: 4 + depth * INDENT }}>
      <span className="w-3 shrink-0" />
      <span className="flex-1 truncate text-dim">{item.name}</span>
      {item.date && item.date !== today && (
        <span className="shrink-0 font-mono text-[10px] text-dim">{formatShortDate(lang, toDate(item.date))}</span>
      )}
    </div>
  )
}

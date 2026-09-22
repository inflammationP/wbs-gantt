import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, NotebookText, Pencil, ScrollText, TriangleAlert } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Chore, Habit, TaskLog } from '../types'
import { DayRow, daySummary } from '../lib/dayTasks'
import { carriedSince } from '../lib/chores'
import { tickedOn } from '../lib/habits'
import { STATUS_META, sig, sigAlpha } from '../lib/ui'
import { addDays, toDate, toISO } from '../lib/dates'
import { formatLongDate, formatRelativeDay } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { ProgressRing } from './ProgressRing'
import { LogDialog } from './LogDialog'
import { DayLogsModal } from './DayLogsModal'
import { Field, Modal, Segmented, Stat, inputCls } from './ui'
import { useDialogs } from './dialogs'
import { HabitDialog } from './HabitDialog'

// The ring's empty track is the border token, which is what it always was —
// `#242c35` was that token written out by hand, and stayed put when a theme
// moved the border it was meant to match.
const TRACK = 'rgb(var(--c-border))'
const ACCENT = 'rgb(var(--c-accent))'

interface Props {
  day: string
  /**
   * The chores to show, chosen by the caller rather than here.
   *
   * The two callers are asking different questions of the same day. The day
   * panel is a *record*: what was put on this day and what got finished on it
   * (`choresTouching`). The Today page is an *action list*: everything that has
   * come due and is still open, plus what was finished today (`todaysChores`) —
   * which is what carries a slipped chore forward. Neither is a special case of
   * the other, and hiding the choice in here would mean one of them quietly got
   * the wrong answer.
   */
  dayChores: Chore[]
  /**
   * The habits to show, chosen by the caller for the same reason `dayChores` is.
   *
   * Unlike chores there is only one question to ask of them — `habitsOn`, which
   * is "which of these existed by then" — so both callers pass that. What
   * differs is the two props below, and it is the caller holding the composer
   * that decides whether the section appears at all: the Tomorrow column has no
   * habits to show and no way to tick one, and a column of boxes that cannot be
   * touched reads as a list of things not done yet.
   */
  habits: Habit[]
  /**
   * `stack` is the 320px day panel: ring, then strict, other and chores one
   * after another. `side` is a wide Today-page column, where the ring sits above
   * two panes — the day's tasks on the left, its chores on the right.
   */
  layout: 'stack' | 'side'
  /**
   * Given only where chores may be added, ticked and edited. Absent means the
   * board is a record: the day panel takes this path, because a second place to
   * tick a chore is a second place for the two to disagree.
   */
  onAddChore?: (title: string) => void
  /** Absent means habits are a record here too, on the same grounds. */
  onAddHabit?: (title: string) => void
  onToggleHabit?: (id: string) => void
}

/**
 * A single day, whole: its strict-log coverage, the work scheduled on it, and
 * the chores it has to account for.
 *
 * One component rather than two, because the day panel and the Today page show
 * the same day out of the same data — and the moment those were separate
 * components they would be separate answers to "what was on today". The only
 * real difference is the arrangement and whether the chores can be touched, so
 * that is all `layout` and `onAddChore` carry.
 */
export function DayBoard({ day, dayChores, habits, layout, onAddChore, onAddHabit, onToggleHabit }: Props) {
  const t = useT()
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const projects = useStore((s) => s.projects)
  const today = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const deleteLog = useStore((s) => s.deleteLog)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState({ tasks: true, habits: true, chores: true })
  const [logFor, setLogFor] = useState<string | null>(null)
  const [editLog, setEditLog] = useState<TaskLog | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)

  const summary = useMemo(() => daySummary(tasks, logs, projects, day, today), [tasks, logs, projects, day, today])
  const dayLogs = useMemo(() => logs.filter((l) => l.date === day), [logs, day])
  const projectOf = (id: string) => projects.find((p) => p.id === id)

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  const { ring } = summary
  // `strictLogRate` answers the same for a day that has not happened yet —
  // nothing is logged, so it reads as 0% and looks like a failure. A day still
  // to come has no coverage to report, so it gets its own state rather than the
  // "nothing logged yet" accusation.
  const isFuture = day > today
  const ringView = isFuture
    ? { fill: null, track: TRACK, icon: null, caption: t('day.notYetDue'), tone: 'text-dim' }
    : // The remaining states are told apart by icon and wording as much as by
      // colour: the ring's green and amber are only ΔE 3.8 apart under protanopia.
      ring.total === 0
      ? { fill: null, track: TRACK, icon: null, caption: t('day.noStrictScheduled'), tone: 'text-dim' }
      : ring.done === ring.total
        ? { fill: sig('completed'), track: sigAlpha('completed', 0.16), icon: Check, caption: t('day.allLogged'), tone: 'text-completed' }
        : {
            // Amber while the day still has nothing written, accent once some of
            // it is — the same pair the caption and icon already distinguish.
            fill: ring.done === 0 ? sig('in-progress') : ACCENT,
            track: ring.done === 0 ? sigAlpha('in-progress', 0.16) : 'rgb(var(--c-accent) / 0.16)',
            icon: TriangleAlert,
            caption: ring.done === 0 ? t('day.nothingLogged') : t('day.stillMissing', { count: ring.total - ring.done }),
            tone: 'text-today',
          }
  const RingIcon = ringView.icon

  const rowProps = {
    expanded,
    day,
    isFuture,
    onToggle: toggle,
    onWriteLog: (id: string) => setLogFor(id),
    onOpenTask: (id: string) => setSelected(id),
    projectName: (id: string) => projectOf(id)?.name ?? '',
  }

  // One list, not two. Splitting the day into "strict" and "the rest" put the
  // log obligations at the top, but it also meant calling every task one thing
  // or the other — and the only difference that matters is whether a task owes a
  // log, which the mark on the row says better than a heading can. The legend
  // underneath is what has to carry the mark's meaning.
  const taskSections = (
    <Section
      title={t('day.taskList')}
      count={summary.all.length}
      // Only when there is a mark to explain. A legend on a day with nothing to
      // explain is the same mistake as a reminder that is always green.
      hint={summary.strict.length > 0 ? t('day.logMark') : undefined}
      open={open.tasks}
      onToggle={() => setOpen((o) => ({ ...o, tasks: !o.tasks }))}
    >
      {summary.all.length === 0 ? (
        <Empty>{t('day.nothingScheduled')}</Empty>
      ) : (
        summary.all.map((r) => <DayRowView key={r.task.id} row={r} {...rowProps} />)
      )}
    </Section>
  )

  const habitsDone = habits.filter((h) => tickedOn(h, day)).length
  // Above the chores, and that is the reading order the list is meant to have:
  // the habits are the same list tomorrow and are ticked off first thing, while
  // the chores are the day's own errands and appear only as they come up. Shown
  // when the caller offers a composer — which is the Today column, and it must
  // show even at zero, or there is nowhere to add the first one — or when there
  // is a habit to record.
  const habitSection = (onAddHabit != null || habits.length > 0) && (
    <Section
      title={t('habit.section')}
      // The fraction rather than the total: what the other sections count is how
      // much is on the label, and here that is how much is done.
      count={`${habitsDone}/${habits.length}`}
      open={open.habits}
      onToggle={() => setOpen((o) => ({ ...o, habits: !o.habits }))}
    >
      {onAddHabit && <HabitComposer onAdd={onAddHabit} />}
      {habits.length === 0 ? (
        <Empty>{t('habit.none')}</Empty>
      ) : (
        habits.map((h) => (
          <HabitLine
            key={h.id}
            habit={h}
            ticked={tickedOn(h, day)}
            onToggle={onToggleHabit && (() => onToggleHabit(h.id))}
          />
        ))
      )}
    </Section>
  )

  const choreSection = (
    <Section
      title={t('chore.section')}
      count={dayChores.length}
      open={open.chores}
      onToggle={() => setOpen((o) => ({ ...o, chores: !o.chores }))}
    >
      {onAddChore && <ChoreComposer day={day} onAdd={onAddChore} />}
      {dayChores.length === 0 ? (
        <Empty>{t('chore.noneOnDay')}</Empty>
      ) : onAddChore ? (
        dayChores.map((c) => <ChoreRow key={c.id} chore={c} today={today} />)
      ) : (
        dayChores.map((c) => <ChoreLine key={c.id} chore={c} />)
      )}
    </Section>
  )

  const taskCount = summary.strict.length + summary.nonStrict.length
  const choresDone = dayChores.filter((c) => c.done).length
  // The ring answers `—` for a day that has not happened or has no strict work,
  // and the cards have to agree with it rather than print a `0/0` beside it.
  const ringValue = isFuture || ring.total === 0 ? t('common.none') : `${ring.done}/${ring.total}`
  const choresSub =
    dayChores.length === 0
      ? t('common.none')
      : choresDone === dayChores.length
        ? t('chore.allDone')
        : t('chore.stillOpen', { count: dayChores.length - choresDone })

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* The day's headline figures, above the work itself whichever way the two
          panes below are arranged.

          Wide, it is a ring plus the same figure cards Manage opens with — one
          format for a headline number across the app. Narrow, the cards would
          each be about eighty pixels, so the panel keeps the ring and its three
          lines, which say the same things in prose. */}
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center gap-4">
        <ProgressRing
          value={isFuture ? 0 : ring.pct}
          fill={ringView.fill}
          track={ringView.track}
          label={
            isFuture
              ? t('day.notYetDue')
              : ring.total === 0
                ? t('day.noStrictTasksScheduled')
                : t('day.ringPartial', { count: ring.done, total: ring.total })
          }
        >
          <span className="font-mono text-[19px] font-semibold leading-none text-fg">
            {isFuture || ring.total === 0 ? t('common.none') : `${ring.pct}%`}
          </span>
          {/* The ratio under the percentage belongs to the narrow band only. In
              the wide one it is already in the card beside the ring, and the
              same `3/5` twice within a hundred pixels reads as a mistake. */}
          {layout === 'stack' && !isFuture && ring.total > 0 && (
            <span className="font-mono text-[10px] text-dim mt-0.5">{ring.done}/{ring.total}</span>
          )}
        </ProgressRing>

        {layout === 'side' ? (
          <div className="flex-1 min-w-0 grid grid-cols-3 gap-3">
            <Stat label={t('day.strictLogs')} value={ringValue} sub={ringView.caption} />
            <Stat label={t('common.tasks')} value={String(taskCount)} sub={t('day.tasksBreakdown', { strict: summary.strict.length, other: summary.nonStrict.length })} />
            <Stat label={t('chore.section')} value={`${choresDone}/${dayChores.length}`} sub={choresSub} />
          </div>
        ) : (
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('day.strictLogs')}</div>
            <div className={`flex items-start gap-1 text-[12px] ${ringView.tone}`}>
              {RingIcon && <RingIcon size={13} className="shrink-0 mt-[1px]" />}
              <span>{ringView.caption}</span>
            </div>
            <div className="text-[11px] text-dim mt-1">{t('day.taskCount', { count: taskCount })}</div>
          </div>
        )}
      </div>

      {layout === 'side' ? (
        // Tasks take the room they need and chores take what is left, rather
        // than a flat split: a chore is a line of text and a task carries a WBS,
        // a project and a progress bar behind it.
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 overflow-auto">{taskSections}</div>
          {/* Bounded at both ends. Uncapped below, the pane collapses to about
              two words as soon as it is the unfocused column; uncapped above, it
              runs away on a wide screen and leaves the tasks ragged. */}
          <div className="w-[34%] min-w-[240px] max-w-[320px] shrink-0 border-l border-border overflow-auto">
            {habitSection}
            {choreSection}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {taskSections}
          {habitSection}
          {choreSection}
        </div>
      )}

      <div className="shrink-0 p-3 border-t border-border">
        <button
          onClick={() => setLogsOpen(true)}
          disabled={summary.logCount === 0}
          className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 disabled:cursor-default rounded-[3px] hover:brightness-110"
        >
          <ScrollText size={14} /> {summary.logCount ? t('day.readLogsCount', { count: summary.logCount }) : t('day.readLogs')}
        </button>
      </div>

      {logFor && <LogDialog taskId={logFor} defaultDate={day} onClose={() => setLogFor(null)} />}
      {editLog && <LogDialog taskId={editLog.taskId} existing={editLog} onClose={() => setEditLog(null)} />}
      {logsOpen && (
        <DayLogsModal
          date={day}
          logs={dayLogs}
          tasks={tasks}
          projects={projects}
          onClose={() => setLogsOpen(false)}
          onEdit={(l) => { setLogsOpen(false); setEditLog(l) }}
          onDelete={deleteLog}
        />
      )}
    </div>
  )
}

function Section({
  title,
  count,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string
  /**
   * A number is how many are on the label; a string is for a section whose
   * subject is a fraction of itself — the habits' `3/5`.
   */
  count: number | string
  /** One line under the title, for what the section's contents mean. */
  hint?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-b border-border py-2">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-1.5 px-4 h-6 text-[10px] uppercase tracking-wider text-dim hover:text-fg"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
        <span className="font-mono normal-case tracking-normal">{count}</span>
      </button>
      {open && (
        <>
          {/* Under the title, aligned with it rather than with the rows: this
              explains the heading's subject, not any one row. */}
          {hint && <div className="px-4 pb-1 text-[11px] text-dim">{hint}</div>}
          <div className="mt-0.5 px-2 space-y-0.5">{children}</div>
        </>
      )}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-2 py-1 text-[12px] text-dim">{children}</div>
}

/**
 * How far one level of the task tree steps in.
 *
 * Smaller than the Gantt's 16: the day panel is 320px at its narrowest, and a
 * deep branch there would spend a fifth of the row on indentation alone.
 */
const INDENT = 12

function DayRowView({
  row,
  expanded,
  day,
  isFuture,
  onToggle,
  onWriteLog,
  onOpenTask,
  projectName,
}: {
  row: DayRow
  expanded: Record<string, boolean>
  /** The day this row is drawn for — the day a tick would be recorded against. */
  day: string
  isFuture: boolean
  onToggle: (id: string) => void
  onWriteLog: (id: string) => void
  onOpenTask: (id: string) => void
  projectName: (id: string) => string
}) {
  const t = useT()
  const toggleTaskDay = useStore((s) => s.toggleTaskDay)
  const meta = STATUS_META[row.status]
  const isOpen = expanded[row.task.id] === true
  const finished = row.status === 'completed'
  // Two kinds of row, and the strike means the thing each of them is about.
  //
  // A strict task is what the ring above is counting, so its strike tracks the
  // ring: written today, or not. Striking it on `finished` instead would leave
  // the list disagreeing with the ring printed over it — a logged task at 35%
  // would look untouched while the ring credited it, and an auto-completed
  // plain task would look handled while the ring had never heard of it.
  //
  // A plain task has no log to write, so it keeps the older meaning: struck
  // when the task is actually done.
  const struck = row.strict ? row.hasLog : finished
  // A strict task owes a log once it has come due and is not finished — which,
  // since an overdue task keeps owing one, is the same condition the ring
  // counts. A day that has not arrived cannot be behind on anything.
  const missingLog = row.strict && !row.hasLog && !row.pausedToday && !row.completedBefore && !finished && !isFuture

  return (
    <div className="group">
      {/* The log button sits a fixed gap after the name rather than in the far
          corner: parked at the right edge it got buried behind the badges, and
          read as part of them. Which is also why the name no longer stretches —
          "after the name" has to mean the name, not the space it was taking up.
          The badges keep to the right via `ml-auto`. */}
      <div
        onClick={() => onToggle(row.task.id)}
        style={{ paddingLeft: 8 + row.depth * INDENT }}
        className="flex items-center gap-1.5 pr-2 h-7 rounded-[3px] hover:bg-panel2"
      >
        <button
          aria-expanded={isOpen}
          className="min-w-0 flex items-center gap-1.5 text-left"
        >
          <span className="text-dim shrink-0">{isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sig(meta.token) }} />
          {/* The mark for "this one owes a log", explained by the legend under
              the list. Amber is the colour the ring above counts and the No log
              badge wears, so it is the same signal, not a new one. */}
          {row.strict && (
            <span className="shrink-0 text-[12px] font-semibold text-today" aria-hidden>
              *
            </span>
          )}
          <span
            className={`min-w-0 truncate text-[12px] ${struck ? 'line-through text-dim' : 'text-fg/90'}`}
            title={`${row.wbs} ${row.task.name}`}
          >
            {row.task.name}
          </span>
        </button>
        {row.strict && (
          <button
            onClick={(e) => {
              // The row as a whole toggles; writing a log is the one thing here
              // that must not also expand it.
              e.stopPropagation()
              onWriteLog(row.task.id)
            }}
            title={t('gantt.writeLogForDay')}
            aria-label={t('gantt.writeLogForDay')}
            className="ml-2 shrink-0 p-1 rounded-[3px] text-dim hover:text-accent opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <NotebookText size={12} />
          </button>
        )}
        {/* The counterpart of the log button: the one thing you can do to a
            simplified task, and the only thing that ever moves its number.
            Ticked by hand rather than written up, so it says done/not-done and
            nothing else — no amount to fill in, here or anywhere. Drawn like a
            chore's box so the two read as the same gesture. */}
        {row.plain && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleTaskDay(row.task.id, day)
            }}
            disabled={!row.tickable}
            role="checkbox"
            aria-checked={row.confirmedOnDay}
            aria-label={t('day.tick')}
            title={t('day.tick')}
            className="ml-2 mt-[1px] shrink-0 w-[14px] h-[14px] rounded-[2px] border border-border grid place-items-center transition-colors disabled:opacity-40"
            style={row.confirmedOnDay ? { background: sig('completed'), borderColor: sig('completed') } : undefined}
          >
            {row.confirmedOnDay && <Check size={10} strokeWidth={3} className="text-on-accent" />}
          </button>
        )}

        <span className="ml-auto shrink-0 flex items-center gap-1.5">
          {missingLog && (
            <span className="shrink-0 inline-flex items-center gap-0.5 px-1 h-4 text-[9px] font-medium rounded-[2px] bg-today/15 text-today border border-today/30">
              <TriangleAlert size={9} /> {t('day.noLog')}
            </span>
          )}
          {row.overdue && (
            <span className="shrink-0 px-1 h-4 inline-flex items-center text-[9px] font-medium rounded-[2px] bg-delayed/15 text-delayed border border-delayed/30">
              {t('manage.overdue')}
            </span>
          )}
          {row.pausedToday && (
            <span className="shrink-0 px-1 h-4 inline-flex items-center text-[9px] font-medium rounded-[2px] bg-paused/15 text-paused border border-paused/30">
              {t('status.paused')}
            </span>
          )}
        </span>
      </div>
      {/* The bar stays mounted and animates both axes, so it genuinely grows
          rightward from zero instead of appearing at full width. */}
      <div className={`overflow-hidden transition-[height] duration-300 ease-out ${isOpen ? 'h-[30px]' : 'h-0'}`}>
        <div style={{ paddingLeft: 32 + row.depth * INDENT }} className="pr-2 pt-1">
          <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${isOpen ? (row.progress ?? 0) : 0}%`, background: sig(meta.token), opacity: 0.85 }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 mt-1 leading-4">
            <span className="font-mono text-[10px] text-dim truncate">
              {row.wbs && <span className="text-dim/70">{row.wbs} · </span>}
              {row.progress != null ? `${row.progress}%` : t('day.noProgress')}
              <span className="text-dim/70"> · {projectName(row.task.projectId)}</span>
            </span>
            <button onClick={() => onOpenTask(row.task.id)} className="shrink-0 text-[10px] text-accent hover:text-fg">
              {t('day.viewTask')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The one-line field that adds a chore to this day. */
function ChoreComposer({ day, onAdd }: { day: string; onAdd: (title: string) => void }) {
  const t = useT()
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = text.trim()
    if (!title) return
    onAdd(title)
    setText('')
  }

  return (
    <form onSubmit={submit} className="px-2 pb-1.5">
      <input
        className={inputCls}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('chore.placeholder')}
        aria-label={t('chore.placeholder')}
        data-chore-input={day}
      />
    </form>
  )
}

function ChoreRow({ chore, today }: { chore: Chore; today: string }) {
  const t = useT()
  const lang = useLang()
  const toggleChore = useStore((s) => s.toggleChore)
  const [editing, setEditing] = useState(false)
  // Only an *open* chore can be carried: one finished after its day is done,
  // and badging it would be reading a deadline that no longer exists.
  const carried = !chore.done && chore.date < today

  return (
    <div className="group relative flex items-start gap-2 px-2 py-1.5 rounded-[3px] hover:bg-panel2">
      <button
        onClick={() => toggleChore(chore.id)}
        role="checkbox"
        aria-checked={chore.done}
        aria-label={chore.title}
        className="mt-[2px] shrink-0 w-[14px] h-[14px] rounded-[2px] border border-border grid place-items-center transition-colors"
        style={chore.done ? { background: sig('completed'), borderColor: sig('completed') } : undefined}
      >
        {chore.done && <Check size={10} strokeWidth={3} className="text-on-accent" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className={`text-[12px] break-words ${chore.done ? 'line-through text-dim' : 'text-fg/90'}`}>
          {chore.title}
        </div>
        {/* The badge sits on the meta line rather than beside the title. Sharing
            the first line with it, the two compete for a pane that is only ever
            a few hundred pixels wide, and the title — the part being read — is
            what loses. */}
        {(chore.note || carried) && (
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-dim">
            {chore.note && <span className="min-w-0 truncate">{chore.note}</span>}
            {carried && (
              <span
                title={t('chore.carriedTitle', { date: formatLongDate(lang, toDate(chore.date)) })}
                className="shrink-0 font-mono text-[10px] text-today"
              >
                ↺ {formatRelativeDay(lang, carriedSince(chore, today))}
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => setEditing(true)}
        title={t('chore.edit')}
        aria-label={t('chore.edit')}
        className="shrink-0 mt-[1px] p-0.5 rounded-[3px] text-dim hover:text-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        <Pencil size={12} />
      </button>

      {editing && <ChoreDialog chore={chore} onClose={() => setEditing(false)} />}
    </div>
  )
}

/**
 * A chore as a record rather than a control — the day panel's form of one.
 *
 * The box is drawn rather than being a disabled `<input>`, which would still
 * read as something to click and then refuse. Green is the same green every
 * other finished thing in the app carries: a chore being done is not a new kind
 * of done.
 */
function ChoreLine({ chore }: { chore: Chore }) {
  const done = sig('completed')
  return (
    <div className="px-2 py-1 rounded-[3px]">
      <div className="flex items-start gap-2">
        <span
          className="mt-[2px] shrink-0 w-[14px] h-[14px] rounded-[2px] border border-border grid place-items-center"
          style={chore.done ? { background: done, borderColor: done } : undefined}
        >
          {chore.done && <Check size={10} strokeWidth={3} className="text-on-accent" />}
        </span>
        <span className={`min-w-0 flex-1 text-[12px] break-words ${chore.done ? 'line-through text-dim' : 'text-fg/90'}`}>
          {chore.title}
        </span>
      </div>
      {chore.note && <div className="pl-6 text-[11px] text-dim break-words">{chore.note}</div>}
    </div>
  )
}

function ChoreDialog({ chore, onClose }: { chore: Chore; onClose: () => void }) {
  const t = useT()
  const today = useStore((s) => s.today)
  const updateChore = useStore((s) => s.updateChore)
  const deleteChore = useStore((s) => s.deleteChore)

  const tomorrow = toISO(addDays(toDate(today), 1))
  const [title, setTitle] = useState(chore.title)
  const [note, setNote] = useState(chore.note)
  // A carried-over chore is dated neither today nor tomorrow, so neither option
  // is really selected — it falls to `today` and stays there until the control
  // is actually used. `dateTouched` is what keeps that display-only default from
  // being written back as a silent reschedule.
  const [date, setDate] = useState(chore.date === tomorrow ? tomorrow : today)
  const [dateTouched, setDateTouched] = useState(false)

  const save = () => {
    const patch: Partial<Chore> = { title: title.trim() || chore.title, note }
    if (dateTouched && date !== chore.date) patch.date = date
    updateChore(chore.id, patch)
    onClose()
  }

  const onKey = (e: { key: string }) => {
    if (e.key === 'Enter') save()
  }

  return (
    <Modal title={t('chore.edit')} onClose={onClose} width={440}>
      <div className="space-y-3">
        <Field label={t('chore.title')}>
          <input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={onKey} />
        </Field>
        <Field label={t('chore.note')}>
          <input
            className={inputCls}
            value={note}
            placeholder={t('chore.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={onKey}
          />
        </Field>
        <Field label={t('chore.day')}>
          <Segmented
            value={date}
            onChange={(d) => {
              setDate(d)
              setDateTouched(true)
            }}
            options={[
              { value: today, label: t('time.today') },
              { value: tomorrow, label: t('time.tomorrow') },
            ]}
          />
        </Field>

        <div className="flex items-center gap-2 pt-1">
          {/* No confirm step: a chore is a line of text, and asking "are you
              sure" over one costs more than retyping it does. */}
          <button
            onClick={() => {
              deleteChore(chore.id)
              onClose()
            }}
            className="mr-auto h-8 px-3 text-[12px] text-delayed hover:text-fg border border-border rounded-[3px]"
          >
            {t('common.delete')}
          </button>
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
            {t('common.cancel')}
          </button>
          <button onClick={save} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px]">
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * A habit, as either a control or a record.
 *
 * One component for both, unlike the chore pair, because here the only
 * difference is whether the box and the pencil are live. `onToggle` absent means
 * the day panel is looking back at a day: the box is drawn rather than being a
 * disabled `<input>`, which would still read as something to click and then
 * refuse — the same choice `ChoreLine` makes. Deleting and renaming go with the
 * pencil, so they are absent on the same days.
 *
 * Keeping the tick and the strike in one place is the point of not splitting it.
 * They are what the section's `3/5` counts, and a second copy for the read-only
 * case would be a second answer to "was this done that day" — the exact drift
 * this file's other components are built to avoid.
 *
 * The pencil opens the shared `components/HabitDialog`, the same one the Manage
 * page opens; this row only holds the delete confirmation, because a question
 * has to outlive the dialog it was asked from.
 */
function HabitLine({
  habit,
  ticked,
  onToggle,
}: {
  habit: Habit
  /** Whether `day` — the day the board is showing — was one of its ticked days. */
  ticked: boolean
  onToggle?: () => void
}) {
  const t = useT()
  const deleteHabit = useStore((s) => s.deleteHabit)
  const [editing, setEditing] = useState(false)
  const { ask, element: dialogs } = useDialogs()
  const done = sig('completed')

  const boxCls =
    'mt-[2px] shrink-0 w-[14px] h-[14px] rounded-[2px] border border-border grid place-items-center transition-colors'
  const boxStyle = ticked ? { background: done, borderColor: done } : undefined
  const mark = ticked ? <Check size={10} strokeWidth={3} className="text-on-accent" /> : null

  return (
    <div
      className={`group relative flex items-start gap-2 px-2 py-1.5 rounded-[3px] ${onToggle ? 'hover:bg-panel2' : ''}`}
    >
      {onToggle ? (
        <button
          onClick={onToggle}
          role="checkbox"
          aria-checked={ticked}
          aria-label={habit.title}
          className={boxCls}
          style={boxStyle}
        >
          {mark}
        </button>
      ) : (
        <span className={boxCls} style={boxStyle}>
          {mark}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className={`text-[12px] break-words ${ticked ? 'line-through text-dim' : 'text-fg/90'}`}>
          {habit.title}
        </div>
        {/* The note goes on its own line rather than beside the title, for the
            reason `ChoreRow` puts its carried badge there: the pane is only ever
            a few hundred pixels wide, and the part being read is the name. */}
        {habit.note && <div className="text-[11px] text-dim break-words mt-0.5">{habit.note}</div>}
      </div>

      {onToggle && (
        <>
          <button
            onClick={() => setEditing(true)}
            title={t('habit.edit')}
            aria-label={t('habit.edit')}
            className="shrink-0 mt-[1px] p-0.5 rounded-[3px] text-dim hover:text-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <Pencil size={12} />
          </button>

          {editing && (
            <HabitDialog
              habit={habit}
              onClose={() => setEditing(false)}
              // The dialog closes before the question appears, so the two are
              // never stacked. A habit is the one thing here whose deletion costs
              // something: a chore takes at most one square off the heatmap with
              // it, while a habit takes every day it was ever ticked.
              onDelete={() => {
                setEditing(false)
                ask(t('habit.deleteAsk', { name: habit.title }), () => deleteHabit(habit.id))
              }}
            />
          )}
        </>
      )}

      {dialogs}
    </div>
  )
}

/** The one-line field that adds a habit. The chore composer's twin. */
function HabitComposer({ onAdd }: { onAdd: (title: string) => void }) {
  const t = useT()
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = text.trim()
    if (!title) return
    onAdd(title)
    setText('')
  }

  return (
    <form onSubmit={submit} className="px-2 pb-1.5">
      <input
        className={inputCls}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('habit.placeholder')}
        aria-label={t('habit.placeholder')}
      />
    </form>
  )
}


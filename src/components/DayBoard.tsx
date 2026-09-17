import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, NotebookPen, Pencil, ScrollText, TriangleAlert } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Chore, TaskLog } from '../types'
import { DayRow, daySummary } from '../lib/dayTasks'
import { carriedSince } from '../lib/chores'
import { STATUS_META, sig, sigAlpha } from '../lib/ui'
import { addDays, toDate, toISO } from '../lib/dates'
import { formatLongDate, formatRelativeDay } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { ProgressRing } from './ProgressRing'
import { LogDialog } from './LogDialog'
import { DayLogsModal } from './DayLogsModal'
import { Field, Modal, Segmented, Stat, inputCls } from './ui'

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
export function DayBoard({ day, dayChores, layout, onAddChore }: Props) {
  const t = useT()
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const projects = useStore((s) => s.projects)
  const today = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const deleteLog = useStore((s) => s.deleteLog)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState({ strict: true, nonStrict: true, chores: true })
  const [logFor, setLogFor] = useState<string | null>(null)
  const [editLog, setEditLog] = useState<TaskLog | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)

  const summary = useMemo(() => daySummary(tasks, logs, projects, day), [tasks, logs, projects, day])
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
    isFuture,
    onToggle: toggle,
    onWriteLog: (id: string) => setLogFor(id),
    onOpenTask: (id: string) => setSelected(id),
    projectName: (id: string) => projectOf(id)?.name ?? '',
  }

  const taskSections = (
    <>
      <Section
        title={t('day.strictTasks')}
        count={summary.strict.length}
        open={open.strict}
        onToggle={() => setOpen((o) => ({ ...o, strict: !o.strict }))}
      >
        {summary.strict.length === 0 ? (
          <Empty>{t('day.noStrictOnDay')}</Empty>
        ) : (
          summary.strict.map((r) => <DayRowView key={r.task.id} row={r} {...rowProps} />)
        )}
      </Section>

      <Section
        title={t('day.otherTasks')}
        count={summary.nonStrict.length}
        open={open.nonStrict}
        onToggle={() => setOpen((o) => ({ ...o, nonStrict: !o.nonStrict }))}
      >
        {summary.nonStrict.length === 0 ? (
          <Empty>{t('day.nothingElse')}</Empty>
        ) : (
          summary.nonStrict.map((r) => <DayRowView key={r.task.id} row={r} {...rowProps} />)
        )}
      </Section>
    </>
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
            {choreSection}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {taskSections}
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
  open,
  onToggle,
  children,
}: {
  title: string
  count: number
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
      {open && <div className="mt-0.5 px-2 space-y-0.5">{children}</div>}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="px-2 py-1 text-[12px] text-dim">{children}</div>
}

function DayRowView({
  row,
  expanded,
  isFuture,
  onToggle,
  onWriteLog,
  onOpenTask,
  projectName,
}: {
  row: DayRow
  expanded: Record<string, boolean>
  isFuture: boolean
  onToggle: (id: string) => void
  onWriteLog: (id: string) => void
  onOpenTask: (id: string) => void
  projectName: (id: string) => string
}) {
  const t = useT()
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
      <div className="relative">
        <button
          onClick={() => onToggle(row.task.id)}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-1.5 pl-2 pr-6 h-7 rounded-[3px] hover:bg-panel2 text-left"
        >
          <span className="text-dim shrink-0">{isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sig(meta.token) }} />
          <span
            className={`min-w-0 flex-1 truncate text-[12px] ${struck ? 'line-through text-dim' : 'text-fg/90'}`}
            title={`${row.wbs} ${row.task.name}`}
          >
            {row.task.name}
          </span>
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
        </button>
        {row.strict && (
          <button
            onClick={() => onWriteLog(row.task.id)}
            title={t('gantt.writeLogForDay')}
            aria-label={t('gantt.writeLogForDay')}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-[3px] text-dim hover:text-accent opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <NotebookPen size={12} />
          </button>
        )}
      </div>
      {/* The bar stays mounted and animates both axes, so it genuinely grows
          rightward from zero instead of appearing at full width. */}
      <div className={`overflow-hidden transition-[height] duration-300 ease-out ${isOpen ? 'h-[30px]' : 'h-0'}`}>
        <div className="pl-8 pr-2 pt-1">
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

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, NotebookPen, ScrollText, TriangleAlert, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { TaskLog } from '../types'
import { DayRow, daySummary } from '../lib/dayTasks'
import { STATUS_META, sig, sigAlpha } from '../lib/ui'
import { diffDays, toDate } from '../lib/dates'
import { formatLongDate, formatRelativeDay } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { ProgressRing } from './ProgressRing'
import { LogDialog } from './LogDialog'
import { DayLogsModal } from './DayLogsModal'

// The ring's empty track is the border token, which is what it always was —
// `#242c35` was that token written out by hand, and stayed put when a theme
// moved the border it was meant to match.
const TRACK = 'rgb(var(--c-border))'
const ACCENT = 'rgb(var(--c-accent))'

export function DayDetailPanel({ day }: { day: string }) {
  const t = useT()
  const lang = useLang()
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const projects = useStore((s) => s.projects)
  const today = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const setSelectedDay = useStore((s) => s.setSelectedDay)
  const deleteLog = useStore((s) => s.deleteLog)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState({ strict: true, nonStrict: true })
  const [logFor, setLogFor] = useState<string | null>(null)
  const [editLog, setEditLog] = useState<TaskLog | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)

  // `today` is deliberately absent from the deps: it is subscribed above only so
  // the relative label refreshes at midnight, while the summary keys off `day`.
  const summary = useMemo(
    () => daySummary(tasks, logs, projects, day),
    [tasks, logs, projects, day],
  )
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

  return (
    <>
      <aside className="w-[320px] shrink-0 border-l border-border bg-panel flex flex-col overflow-hidden">
        <div className="shrink-0 px-4 py-3 border-b border-border">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-fg">{formatRelativeDay(lang, diffDays(new Date(), toDate(day)))}</div>
              <div className="font-mono text-[11px] text-muted mt-0.5">{formatLongDate(lang, toDate(day))}</div>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-dim hover:text-fg shrink-0 mt-0.5"
              aria-label={t('common.close')}
              title={t('common.close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {/* strict log coverage */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-4">
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
              {!isFuture && ring.total > 0 && (
                <span className="font-mono text-[10px] text-dim mt-0.5">{ring.done}/{ring.total}</span>
              )}
            </ProgressRing>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('day.strictLogs')}</div>
              <div className={`flex items-start gap-1 text-[12px] ${ringView.tone}`}>
                {RingIcon && <RingIcon size={13} className="shrink-0 mt-[1px]" />}
                <span>{ringView.caption}</span>
              </div>
              <div className="text-[11px] text-dim mt-1">{t('day.taskCount', { count: summary.strict.length + summary.nonStrict.length })}</div>
            </div>
          </div>

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
        </div>

        <div className="shrink-0 p-3 border-t border-border">
          <button
            onClick={() => setLogsOpen(true)}
            disabled={summary.logCount === 0}
            className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 disabled:cursor-default rounded-[3px] hover:brightness-110"
          >
            <ScrollText size={14} /> {summary.logCount ? t('day.readLogsCount', { count: summary.logCount }) : t('day.readLogs')}
          </button>
        </div>
      </aside>

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
    </>
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
  const done = row.status === 'completed'
  // A strict task owes a log only while it is still open for the day. Once it
  // was already finished when the day started, or is paused, there is nothing
  // to chase — and a day that has not arrived cannot be behind on anything.
  const missingLog = row.strict && !row.hasLog && !row.pausedToday && !row.completedBefore && !done && !isFuture

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
            className={`min-w-0 flex-1 truncate text-[12px] ${done ? 'line-through text-dim' : 'text-fg/90'}`}
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

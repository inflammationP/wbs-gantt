import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, NotebookPen, ScrollText, TriangleAlert, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { TaskLog } from '../types'
import { DayRow, daySummary } from '../lib/dayTasks'
import { ACCENT_COLOR, STATUS_META, hexToRgba } from '../lib/ui'
import { diffDays, formatLong, toDate } from '../lib/dates'
import { ProgressRing } from './ProgressRing'
import { LogDialog } from './LogDialog'
import { DayLogsModal } from './DayLogsModal'

const WARN_COLOR = '#e3b341'

function relativeDay(day: string): string {
  const n = diffDays(new Date(), toDate(day))
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

export function DayDetailPanel({ day }: { day: string }) {
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
  // Three states, told apart by icon and wording as much as by colour: the
  // ring's green and amber are only ΔE 3.8 apart under protanopia.
  const ringView =
    ring.total === 0
      ? { fill: null, track: '#242c35', icon: null, caption: 'No strict work scheduled', tone: 'text-dim' }
      : ring.done === ring.total
        ? { fill: STATUS_META.completed.color, track: hexToRgba(STATUS_META.completed.color, 0.16), icon: Check, caption: 'All strict work logged', tone: 'text-[#3fb950]' }
        : {
            fill: ring.done === 0 ? WARN_COLOR : ACCENT_COLOR,
            track: hexToRgba(ring.done === 0 ? WARN_COLOR : ACCENT_COLOR, 0.16),
            icon: TriangleAlert,
            caption: ring.done === 0 ? 'Nothing logged yet' : `${ring.total - ring.done} still missing`,
            tone: 'text-today',
          }
  const RingIcon = ringView.icon

  const rowProps = {
    expanded,
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
              <div className="text-[15px] font-semibold text-fg">{relativeDay(day)}</div>
              <div className="font-mono text-[11px] text-muted mt-0.5">{formatLong(toDate(day))}</div>
            </div>
            <button onClick={() => setSelectedDay(null)} className="text-dim hover:text-fg shrink-0 mt-0.5" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {/* strict log coverage */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-4">
            <ProgressRing
              value={ring.pct}
              fill={ringView.fill}
              track={ringView.track}
              label={
                ring.total === 0
                  ? 'No strict tasks scheduled'
                  : `${ring.done} of ${ring.total} strict tasks logged`
              }
            >
              <span className="font-mono text-[19px] font-semibold leading-none text-fg">
                {ring.total === 0 ? '—' : `${ring.pct}%`}
              </span>
              {ring.total > 0 && (
                <span className="font-mono text-[10px] text-dim mt-0.5">{ring.done}/{ring.total}</span>
              )}
            </ProgressRing>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Strict logs</div>
              <div className={`flex items-start gap-1 text-[12px] ${ringView.tone}`}>
                {RingIcon && <RingIcon size={13} className="shrink-0 mt-[1px]" />}
                <span>{ringView.caption}</span>
              </div>
              <div className="text-[11px] text-dim mt-1">{summary.strict.length + summary.nonStrict.length} tasks on this day</div>
            </div>
          </div>

          <Section
            title="Strict tasks"
            count={summary.strict.length}
            open={open.strict}
            onToggle={() => setOpen((o) => ({ ...o, strict: !o.strict }))}
          >
            {summary.strict.length === 0 ? (
              <Empty>No strict tasks scheduled on this day.</Empty>
            ) : (
              summary.strict.map((r) => <DayRowView key={r.task.id} row={r} {...rowProps} />)
            )}
          </Section>

          <Section
            title="Other tasks"
            count={summary.nonStrict.length}
            open={open.nonStrict}
            onToggle={() => setOpen((o) => ({ ...o, nonStrict: !o.nonStrict }))}
          >
            {summary.nonStrict.length === 0 ? (
              <Empty>Nothing else scheduled on this day.</Empty>
            ) : (
              summary.nonStrict.map((r) => <DayRowView key={r.task.id} row={r} {...rowProps} />)
            )}
          </Section>
        </div>

        <div className="shrink-0 p-3 border-t border-border">
          <button
            onClick={() => setLogsOpen(true)}
            disabled={summary.logCount === 0}
            className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium bg-accent text-black disabled:opacity-40 disabled:cursor-default rounded-[3px] hover:brightness-110"
          >
            <ScrollText size={14} /> Read this day’s logs{summary.logCount ? ` (${summary.logCount})` : ''}
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
  onToggle,
  onWriteLog,
  onOpenTask,
  projectName,
}: {
  row: DayRow
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  onWriteLog: (id: string) => void
  onOpenTask: (id: string) => void
  projectName: (id: string) => string
}) {
  const meta = STATUS_META[row.status]
  const isOpen = expanded[row.task.id] === true
  const done = row.status === 'completed'
  // A strict task owes a log only while it is still open for the day. Once it
  // was already finished when the day started, or is paused, there is nothing
  // to chase.
  const missingLog = row.strict && !row.hasLog && !row.pausedToday && !row.completedBefore && !done

  return (
    <div className="group">
      <div className="relative">
        <button
          onClick={() => onToggle(row.task.id)}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-1.5 pl-2 pr-6 h-7 rounded-[3px] hover:bg-panel2 text-left"
        >
          <span className="text-dim shrink-0">{isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
          <span
            className={`min-w-0 flex-1 truncate text-[12px] ${done ? 'line-through text-dim' : 'text-fg/90'}`}
            title={`${row.wbs} ${row.task.name}`}
          >
            {row.task.name}
          </span>
          {missingLog && (
            <span className="shrink-0 inline-flex items-center gap-0.5 px-1 h-4 text-[9px] font-medium rounded-[2px] bg-today/15 text-today border border-today/30">
              <TriangleAlert size={9} /> No log
            </span>
          )}
          {row.overdue && (
            <span className="shrink-0 px-1 h-4 inline-flex items-center text-[9px] font-medium rounded-[2px] bg-[#f85149]/15 text-[#f85149] border border-[#f85149]/30">
              Overdue
            </span>
          )}
          {row.pausedToday && (
            <span className="shrink-0 px-1 h-4 inline-flex items-center text-[9px] font-medium rounded-[2px] bg-[#58a6ff]/15 text-[#58a6ff] border border-[#58a6ff]/30">
              Paused
            </span>
          )}
        </button>
        {row.strict && (
          <button
            onClick={() => onWriteLog(row.task.id)}
            title="Write a log for this day"
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
              style={{ width: `${isOpen ? (row.progress ?? 0) : 0}%`, background: meta.color, opacity: 0.85 }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 mt-1 leading-4">
            <span className="font-mono text-[10px] text-dim truncate">
              {row.wbs && <span className="text-dim/70">{row.wbs} · </span>}
              {row.progress != null ? `${row.progress}%` : 'No progress'}
              <span className="text-dim/70"> · {projectName(row.task.projectId)}</span>
            </span>
            <button onClick={() => onOpenTask(row.task.id)} className="shrink-0 text-[10px] text-accent hover:text-fg">
              View task →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

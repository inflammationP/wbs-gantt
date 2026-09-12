import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../store/useStore'
import { buildChildrenMap } from '../lib/tree'
import { groupLogsByDate, parseLogContent } from '../lib/logs'
import { toDate } from '../lib/dates'
import { monthAbbr, weekdayName } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { LogDialog } from '../components/LogDialog'
import { DayLogsModal } from '../components/DayLogsModal'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Task, TaskLog } from '../types'

type Filter = { kind: 'all' } | { kind: 'project'; id: string } | { kind: 'task'; id: string }

export function LogsPage() {
  const t = useT()
  const lang = useLang()
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const logs = useStore((s) => s.logs)
  const deleteLog = useStore((s) => s.deleteLog)

  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [logDialog, setLogDialog] = useState<{ taskId: string; existing?: TaskLog | null } | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const children = useMemo(() => buildChildrenMap(tasks), [tasks])

  const visibleTaskIds = useMemo(() => {
    if (filter.kind === 'all') return null
    if (filter.kind === 'project') return new Set(tasks.filter((task) => task.projectId === filter.id).map((task) => task.id))
    const ids = new Set<string>([filter.id])
    const walk = (pid: string) => {
      for (const c of children.get(pid) ?? []) {
        ids.add(c.id)
        walk(c.id)
      }
    }
    walk(filter.id)
    return ids
  }, [filter, tasks, children])

  const grouped = useMemo(() => {
    const ls = visibleTaskIds ? logs.filter((l) => visibleTaskIds.has(l.taskId)) : logs
    return groupLogsByDate(ls)
  }, [logs, visibleTaskIds])

  const renderTask = (task: Task, depth: number): ReactNode => {
    const active = filter.kind === 'task' && filter.id === task.id
    const kids = children.get(task.id) ?? []
    const isCollapsed = collapsed[task.id] === true
    return (
      <div key={task.id}>
        <div className="flex items-center" style={{ paddingLeft: 8 + depth * 14 }}>
          <button
            onClick={() => { if (kids.length) setCollapsed((c) => ({ ...c, [task.id]: !isCollapsed })) }}
            className="w-4 shrink-0 flex items-center justify-center text-dim hover:text-fg"
            title={kids.length ? (isCollapsed ? t('common.expand') : t('common.collapse')) : undefined}
          >
            {kids.length ? (isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />) : null}
          </button>
          <button
            onClick={() => setFilter({ kind: 'task', id: task.id })}
            className={`flex-1 min-w-0 flex items-center h-7 rounded-[3px] text-[12px] text-left pr-2 ${
              active ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
            }`}
          >
            <span className="truncate">{task.name}</span>
          </button>
        </div>
        {!isCollapsed && kids.map((c) => renderTask(c, depth + 1))}
      </div>
    )
  }

  const selectedLogs = useMemo(() => {
    if (!selectedDay) return null
    return grouped.find((g) => g.date === selectedDay)?.logs ?? []
  }, [selectedDay, grouped])

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* filter tree */}
      <aside className="w-60 shrink-0 border-r border-border overflow-auto py-3 px-2">
        <button
          onClick={() => setFilter({ kind: 'all' })}
          className={`w-full px-2 h-8 rounded-[3px] text-[12px] text-left mb-1 ${
            filter.kind === 'all' ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
          }`}
        >
          {t('logs.all')}
        </button>
        {projects.map((p) => (
          <div key={p.id} className="mb-1">
            <button
              onClick={() => setFilter({ kind: 'project', id: p.id })}
              className={`w-full flex items-center gap-2 px-2 h-8 rounded-[3px] text-[12px] text-left ${
                filter.kind === 'project' && filter.id === p.id ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="flex-1 truncate">{p.name}</span>
            </button>
            {tasks.filter((task) => task.projectId === p.id && task.parentId === null).map((task) => renderTask(task, 0))}
          </div>
        ))}
      </aside>

      {/* sticky-note grid */}
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-[18px] font-semibold mb-4">{t('nav.logs')}</h1>
        {grouped.length === 0 ? (
          <div className="text-[13px] text-dim">{t('logs.empty')}</div>
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]" style={{ maxWidth: 1120 }}>
            {grouped.map(({ date, logs: dayLogs }) => {
              const d = toDate(date)
              // Group by task; show only parent (depth-0) items in the thumbnail
              // so sub-items don't blur the hierarchy, and each task gets its own
              // dot + name so tasks stay distinguishable.
              const byTask = new Map<string, TaskLog[]>()
              for (const l of dayLogs) {
                if (!byTask.has(l.taskId)) byTask.set(l.taskId, [])
                byTask.get(l.taskId)!.push(l)
              }
              const taskEntries = [...byTask.entries()]
              const preview = taskEntries.slice(0, 2).map(([taskId, tlogs]) => {
                const task = tasks.find((x) => x.id === taskId)
                const p = task ? projects.find((x) => x.id === task.projectId) : null
                const items = tlogs
                  .flatMap((l) => parseLogContent(l.content))
                  .filter((it) => it.depth === 0)
                  .slice(0, 2)
                return { taskId, name: task?.name ?? t('common.unknownTask'), color: p?.color, items }
              })
              const moreTasks = taskEntries.length - preview.length
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDay(date)}
                  className="relative flex flex-col overflow-hidden rounded-2xl p-3.5 text-left bg-panel2 border border-border shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-accent/60 h-[230px]"
                >
                  <div className="flex items-baseline gap-2 mb-2.5 pr-2">
                    <span className="text-[26px] font-bold leading-none text-fg">{d.getDate()}</span>
                    <div className="leading-tight">
                      <div className="text-[11px] font-semibold text-muted">{weekdayName(lang, d.getDay())}</div>
                      <div className="text-[11px] text-dim">{monthAbbr(lang, d.getMonth())} {d.getFullYear()}</div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden space-y-2 pr-1">
                    {preview.map((tp) => (
                      <div key={tp.taskId}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {tp.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tp.color }} />}
                          <span className="text-[11px] font-medium text-fg truncate">{tp.name}</span>
                        </div>
                        <div className="space-y-0.5 pl-1">
                          {tp.items.map((it, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[12px] leading-snug">
                              <span className="text-dim shrink-0">·</span>
                              <span className="min-w-0 truncate text-muted">{it.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {moreTasks > 0 && (
                      <div className="text-[11px] text-dim">{t('logs.moreTasks', { count: moreTasks })}</div>
                    )}
                  </div>
                  <div className="text-[11px] mt-2 text-dim">
                    {t('logs.dayFooter', {
                      logs: t('common.logCount', { count: dayLogs.length }),
                      tasks: t('common.taskCount', { count: taskEntries.length }),
                    })}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* day detail */}
      {selectedDay && selectedLogs && (
        <DayLogsModal
          date={selectedDay}
          logs={selectedLogs}
          tasks={tasks}
          projects={projects}
          onClose={() => setSelectedDay(null)}
          onEdit={(log) => setLogDialog({ taskId: log.taskId, existing: log })}
          onDelete={deleteLog}
        />
      )}

      {logDialog && <LogDialog taskId={logDialog.taskId} existing={logDialog.existing} onClose={() => setLogDialog(null)} />}
    </div>
  )
}

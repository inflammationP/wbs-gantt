import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { NotebookPen, Pencil, Trash2, X } from 'lucide-react'
import { Task, TaskLog } from '../types'
import { useStore } from '../store/useStore'
import { computeWbs, effectiveStates } from '../lib/tree'
import { logsForTask, parseLogContent } from '../lib/logs'
import { STATUS_META, PRIORITY_META, TASK_TYPE_LABEL } from '../lib/ui'
import { toDate, MONTHS_SHORT, diffDays } from '../lib/dates'
import { LogDialog } from './LogDialog'

function formatDate(iso: string | null): string {
  if (!iso) return 'TBD'
  const d = toDate(iso)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function ReadOnlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{label}</div>
      <div className="h-8 px-2 flex items-center gap-1.5 bg-panel2 border border-border rounded-[3px] text-[12px] text-muted overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export function TaskDetailPanel({ taskId }: { taskId: string }) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const projects = useStore((s) => s.projects)
  const today = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const deleteLog = useStore((s) => s.deleteLog)
  const pauseTask = useStore((s) => s.pauseTask)
  const resumeTask = useStore((s) => s.resumeTask)

  const [logDialog, setLogDialog] = useState<{ existing?: TaskLog | null } | null>(null)
  const [showHistory, setShowHistory] = useState(true)
  const [showPauses, setShowPauses] = useState(false)

  const project = useMemo(() => projects.find((p) => p.id === task?.projectId), [projects, task])

  if (!task || !project) return null

  const subtasks = tasks.filter((t) => t.parentId === task.id)
  const hasKids = subtasks.length > 0
  const projectTasks = tasks.filter((t) => t.projectId === task.projectId)
  const wbs = computeWbs(projectTasks).get(task.id) ?? ''
  const effMap = effectiveStates(projectTasks, logs)
  const eff = effMap.get(task.id)
  const effProgress = eff?.progress ?? null
  const depTasks = task.dependencies
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as Task[]
  const taskLogs = logsForTask(logs, task.id)
  const taskStatus = eff?.status ?? 'not-started'
  const isLoggable = taskStatus === 'in-progress' || taskStatus === 'delayed'
  const pausedDays = task.paused && task.pauseDate ? Math.max(0, diffDays(toDate(task.pauseDate), new Date())) : 0

  return (
    <>
    <aside className="w-[320px] shrink-0 border-l border-border bg-panel flex flex-col overflow-hidden">
      {/* header */}
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[11px] text-dim">WBS {wbs || '—'}</span>
          <button onClick={() => setSelected(null)} className="text-dim hover:text-fg"><X size={16} /></button>
        </div>
        <div className="text-[15px] font-semibold text-fg">{task.name}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
          {project.name}
          {hasKids && <span className="text-dim">· {subtasks.length} subtasks</span>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isLoggable && (
          <button onClick={() => setLogDialog({ existing: null })} className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium bg-accent text-black rounded-[3px] hover:brightness-110">
            <NotebookPen size={14} /> Write log
          </button>
        )}

        {/* history — right below Write log so it's easy to find */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-dim">History</span>
            {taskLogs.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)} className="text-[11px] text-accent hover:text-fg">
                {showHistory ? 'Hide' : `${taskLogs.length} log${taskLogs.length > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
          {showHistory && taskLogs.length > 0 ? (
            <div className="space-y-2">
              {taskLogs.map((log) => (
                <div key={log.id} className="border border-border rounded-[3px] p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-dim">{formatDate(log.date)}</span>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setLogDialog({ existing: log })} title="Edit" className="p-0.5 text-dim hover:text-fg"><Pencil size={12} /></button>
                      <button onClick={() => deleteLog(log.id)} title="Delete" className="p-0.5 text-dim hover:text-[#f85149]"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {parseLogContent(log.content).map((it, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[12px] text-muted" style={{ paddingLeft: it.depth * 16 }}>
                      <span className="text-dim shrink-0">·</span>
                      <span className="whitespace-pre-wrap break-words">{it.text}</span>
                    </div>
                  ))}
                  {log.targetProgress != null && (
                    <div className="text-[11px] text-dim mt-1">Target progress: {log.targetProgress}%</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">{taskLogs.length ? 'Hidden.' : 'No logs yet.'}</div>
          )}
        </div>

        {/* type */}
        <ReadOnlyField label="Type">{TASK_TYPE_LABEL[task.type]}</ReadOnlyField>

        {task.type !== 'long-term' && (
          <ReadOnlyField label="Progress mode">{task.strictProgress ? 'Strict (log-based)' : 'Auto (date-based)'}</ReadOnlyField>
        )}

        {/* status + priority */}
        <div className="grid grid-cols-2 gap-3">
          <ReadOnlyField label="Status">
            <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: STATUS_META[taskStatus].color }} />
            <span className="truncate">{STATUS_META[taskStatus].label}</span>
          </ReadOnlyField>
          <ReadOnlyField label="Priority">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRIORITY_META[task.priority].color }} />
            <span>{PRIORITY_META[task.priority].label}</span>
          </ReadOnlyField>
        </div>

        {/* dates */}
        {task.paused ? (
          <div>
            <div className="text-[12px] text-muted leading-relaxed bg-panel2 border border-border rounded-[3px] p-2.5">
              Paused. Started {task.startDate ? formatDate(task.startDate) : '—'} · paused on {task.pauseDate ? formatDate(task.pauseDate) : '—'} · {pausedDays} day{pausedDays === 1 ? '' : 's'} elapsed.
            </div>
            <button onClick={() => resumeTask(task.id)} className="mt-2 w-full h-8 text-[12px] font-medium bg-accent text-black rounded-[3px] hover:brightness-110">
              Resume
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ReadOnlyField label="Start">{task.startDate ? formatDate(task.startDate) : '—'}</ReadOnlyField>
              <ReadOnlyField label={task.pauses.length ? 'End (postponed)' : 'End'}>
                {task.type === 'long-term' ? 'TBD' : formatDate(task.endDate)}
              </ReadOnlyField>
            </div>
            {task.type !== 'long-term' && taskStatus !== 'completed' && (
              <button onClick={() => pauseTask(task.id)} className="w-full h-7 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
                Pause task
              </button>
            )}
          </>
        )}

        {/* pause history */}
        {!task.paused && task.pauses.length > 0 && (
          <div>
            <button onClick={() => setShowPauses(!showPauses)} className="text-[11px] text-accent hover:text-fg">
              {showPauses ? '▾' : '▸'} Pause history ({task.pauses.length})
            </button>
            {showPauses && (
              <div className="mt-1.5 space-y-1">
                {task.pauses.map((p, i) => (
                  <div key={i} className="text-[11px] text-muted">
                    Paused {formatDate(p.pauseDate)} → resumed {formatDate(p.resumeDate)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* progress (static; long-term goals have none) */}
        {effProgress != null && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-dim">Progress</span>
              <span className="font-mono text-[11px] text-muted">{effProgress}%</span>
            </div>
            <div className="h-2 bg-panel2 rounded-full overflow-hidden">
              <div className="h-full" style={{ width: `${effProgress}%`, background: STATUS_META[taskStatus].color, opacity: 0.7 }} />
            </div>
          </div>
        )}

        {/* tags */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Tags</div>
          {task.tags.length ? (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((t) => (
                <span key={t} className="inline-flex items-center px-1.5 h-5 text-[11px] bg-panel2 border border-border rounded-[3px] text-muted">{t}</span>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">—</div>
          )}
        </div>

        {/* dependencies */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Dependencies</div>
          {depTasks.length ? (
            <div className="space-y-1">
              {depTasks.map((d) => (
                <div key={d.id} className="flex items-center px-2 h-7 bg-panel2 border border-border rounded-[3px] text-[11px] text-muted">
                  <span className="truncate">{d.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">—</div>
          )}
        </div>

        {/* subtasks */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Subtasks</div>
          {subtasks.length ? (
            <div className="space-y-1">
              {subtasks.map((st) => (
                <div key={st.id} className="flex items-center gap-2 px-2 h-7 bg-panel2 border border-border rounded-[3px] text-[11px] text-muted">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_META[effMap.get(st.id)?.status ?? 'not-started'].color }} />
                  <span className="truncate">{st.name}</span>
                  <span className="ml-auto font-mono text-dim">{effMap.get(st.id)?.progress != null ? `${effMap.get(st.id)?.progress}%` : '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">No subtasks.</div>
          )}
        </div>

        {/* description */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">Description</div>
          <div className="text-[12px] text-muted leading-relaxed whitespace-pre-wrap">{task.description || 'No description.'}</div>
        </div>
      </div>
    </aside>
    {logDialog && <LogDialog taskId={task.id} existing={logDialog.existing} onClose={() => setLogDialog(null)} />}
    </>
  )
}

import { Pencil, Trash2 } from 'lucide-react'
import { Modal } from './ui'
import { parseLogContent } from '../lib/logs'
import { toDate } from '../lib/dates'
import { formatLongDate } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { Project, Task, TaskLog } from '../types'

/** Every log written on one day, grouped by task. */
export function DayLogsModal({
  date,
  logs,
  tasks,
  projects,
  onClose,
  onEdit,
  onDelete,
}: {
  date: string
  logs: TaskLog[]
  tasks: Task[]
  projects: Project[]
  onClose: () => void
  onEdit: (log: TaskLog) => void
  onDelete: (id: string) => void
}) {
  const t = useT()
  const lang = useLang()
  const byTask = new Map<string, TaskLog[]>()
  for (const l of logs) {
    if (!byTask.has(l.taskId)) byTask.set(l.taskId, [])
    byTask.get(l.taskId)!.push(l)
  }
  return (
    <Modal title={formatLongDate(lang, toDate(date))} onClose={onClose} width={620}>
      <div className="space-y-5">
        {[...byTask.entries()].map(([taskId, tlogs]) => {
          const task = tasks.find((x) => x.id === taskId)
          const p = task ? projects.find((x) => x.id === task.projectId) : null
          return (
            <div key={taskId}>
              <div className="flex items-center gap-2 mb-2">
                {p && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />}
                <span className="text-[13px] font-semibold text-fg">{task?.name ?? t('common.unknownTask')}</span>
              </div>
              <div className="space-y-2">
                {tlogs.map((log) => (
                  <div key={log.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {parseLogContent(log.content).map((it, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[12px] text-muted" style={{ paddingLeft: it.depth * 16 }}>
                            <span className="text-dim shrink-0">·</span>
                            <span className="whitespace-pre-wrap break-words">{it.text}</span>
                          </div>
                        ))}
                        {log.targetProgress != null && (
                          <div className="text-[11px] text-dim mt-1.5">{t('common.targetProgress', { percent: log.targetProgress })}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => onEdit(log)} title={t('common.edit')} className="p-1 text-dim hover:text-fg"><Pencil size={13} /></button>
                        <button onClick={() => onDelete(log.id)} title={t('common.delete')} className="p-1 text-dim hover:text-delayed"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

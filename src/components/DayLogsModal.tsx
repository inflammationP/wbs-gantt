import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Modal } from './ui'
import { LogLines } from './LogLines'
import { NoteActions, NoteBox } from './NoteBox'
import { toDate } from '../lib/dates'
import { isLogDayOpen } from '../lib/logs'
import { formatLongDate } from '../lib/i18n'
import { useStore } from '../store/useStore'
import { useLang, useT } from '../lib/useT'
import { Note, Project, Task, TaskLog } from '../types'

/**
 * One day: the logs written on it, and the notebook for it.
 *
 * Two kinds of entry, one day, one panel — because the day is the thing the
 * user opened, and splitting it in two would mean the note written next to a
 * log is somewhere the log is not. The two sections are drawn differently on
 * purpose: a log is progress recorded against a task, a notebook is prose that
 * belongs to nobody, and the project dot on the first is what says so.
 */
export function DayLogsModal({
  date,
  logs,
  tasks,
  projects,
  onClose,
  onEdit,
  notes,
}: {
  date: string
  logs: TaskLog[]
  tasks: Task[]
  projects: Project[]
  onClose: () => void
  /**
   * Correct the figure on an entry that is already written. Offered per entry
   * and only where it can lead somewhere — today's, with a figure on it — so
   * the panel needs no idea of the rule beyond asking.
   */
  onEdit?: (log: TaskLog) => void
  /**
   * Whether to draw the notebook, and what is in it. The wrapper object is the
   * flag — absent means no section at all, which is not the same question as an
   * empty box (a `note?: Note | null` would make those two indistinguishable,
   * and one of them draws an editor).
   *
   * It stays off for the day panel on the Gantt and Calendar side, which opens
   * this modal from its "read logs" button: that panel already has the notebook
   * in it, and the same box in two places on one screen is a second place to
   * look for where the text went.
   */
  notes?: { note: Note | null }
}) {
  const t = useT()
  const lang = useLang()
  const today = useStore((s) => s.today)
  const [editingNote, setEditingNote] = useState(false)
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
                        <LogLines content={log.content} stamps={log.stamps} />
                        {log.targetProgress != null && (
                          <div className="text-[11px] text-dim mt-1.5 flex items-center gap-1.5">
                            {t('common.targetProgress', { percent: log.targetProgress })}
                            {/* The one thing about a written entry that can
                                still move, and only on the day it was written.
                                Nothing else here is a control — no edit, no
                                delete, because a record that can be rewritten
                                is not a record. */}
                            {onEdit && isLogDayOpen(log.date, today) && (
                              <button
                                onClick={() => onEdit(log)}
                                title={t('log.editProgress')}
                                aria-label={t('log.editProgress')}
                                className="text-dim hover:text-fg"
                              >
                                <Pencil size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {notes && (
          // The divider only goes in when there is something above it to divide
          // from — on a day that is a notebook and nothing else, a rule across
          // the top would be the panel's own edge drawn twice.
          <div className={byTask.size ? 'border-t border-border pt-4' : ''}>
            <div className="group flex items-center gap-2 mb-2">
              <span className="text-[13px] font-semibold text-fg">{t('notes.title')}</span>
              {/* Same pair, same row as the title, revealed on hovering it —
                  see `NoteSection` in DayBoard. */}
              <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 has-[:focus-visible]:opacity-100">
                <NoteActions day={date} editing={editingNote} onEdit={() => setEditingNote(true)} />
              </div>
            </div>
            <NoteBox day={date} rows={8} editing={editingNote} onDone={() => setEditingNote(false)} />
          </div>
        )}
      </div>
    </Modal>
  )
}

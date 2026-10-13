import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Modal } from './ui'
import { LogLines } from './LogLines'
import { NoteActions, NoteBox } from './NoteBox'
import { toDate } from '../lib/dates'
import { isLogDayOpen } from '../lib/logs'
import { itemLogSubject } from '../lib/itemLogs'
import { formatLongDate } from '../lib/i18n'
import { useStore } from '../store/useStore'
import { useLang, useT } from '../lib/useT'
import { ItemLog, Note, Project, Task, TaskLog } from '../types'

/**
 * One day: the logs written on it, the entries about its routines and chores,
 * and the notebook.
 *
 * Three kinds of entry, one day, one panel — because the day is the thing the
 * user opened, and splitting it up would mean the note written next to a log is
 * somewhere the log is not. They are drawn differently on purpose: a log is
 * progress recorded against a task, a routine's entry is a sentence about the
 * day with nothing measured, and a notebook is prose that belongs to nobody. The
 * project dot on the first is what says which is which there; the other two
 * carry no dot, and their headings are the item's own name.
 */
export function DayLogsModal({
  date,
  logs,
  tasks,
  projects,
  onClose,
  onEdit,
  notes,
  itemLogs,
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
  /**
   * The day's entries about routines and chores.
   *
   * Required and possibly empty, unlike `notes`: an empty list draws no section
   * at all, so there is nothing a caller would ever want to switch off — and the
   * day's slice is what it wants either way, which is the one thing this cannot
   * work out for itself.
   */
  itemLogs: ItemLog[]
}) {
  const t = useT()
  const lang = useLang()
  const today = useStore((s) => s.today)
  // For the names the entries are drawn under, and for nothing else — the
  // whole collections, not the day's slice: an entry written about a chore
  // that was carried over names a chore that `choresTouching` has no reason to
  // put on this day, and dropping the line for it would lose the writing.
  const habits = useStore((s) => s.habits)
  const chores = useStore((s) => s.chores)
  const [editingNote, setEditingNote] = useState(false)
  const byTask = new Map<string, TaskLog[]>()
  for (const l of logs) {
    if (!byTask.has(l.taskId)) byTask.set(l.taskId, [])
    byTask.get(l.taskId)!.push(l)
  }
  // Dropped when nothing answers to the id — see `itemLogSubject`.
  const itemRows = (kind: ItemLog['kind']) =>
    itemLogs
      .filter((log) => log.kind === kind)
      .flatMap((log) => {
        const title = itemLogSubject(log, habits, chores)
        return title == null ? [] : [{ log, title }]
      })
  // The three sources, in one order, each with its own heading and each drawn
  // only when it has something on this day. What a reader is looking for here is
  // "what got written about X", and which of the three X is is the first thing
  // they know — so the heading is the fastest way to the line, and it is what
  // tells two entries with the same name apart.
  const groups: { key: string; label: string; rows: { log: ItemLog; title: string }[] }[] = [
    { key: 'habit', label: t('habit.section'), rows: itemRows('habit') },
    { key: 'chore', label: t('chore.section'), rows: itemRows('chore') },
  ].filter((g) => g.rows.length > 0)
  return (
    <Modal title={formatLongDate(lang, toDate(date))} onClose={onClose} width={620}>
      <div className="space-y-5">
        {byTask.size > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-dim mb-2">{t('common.tasks')}</div>
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
                                    still move, and only on the day it was
                                    written. Nothing else here is a control — no
                                    edit, no delete, because a record that can be
                                    rewritten is not a record. */}
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
            </div>
          </div>
        )}

        {groups.map((g) => (
          // One block per item, headed by its own name — the same shape the task
          // sections above take, minus the project dot: an entry is about one
          // routine or one chore, and a name is what says which.
          <div key={g.key}>
            <div className="text-[11px] uppercase tracking-wider text-dim mb-2">{g.label}</div>
            <div className="space-y-3">
              {g.rows.map(({ log, title }) => (
                <div key={log.ownerId}>
                  <div className="text-[13px] font-semibold text-fg mb-2">{title}</div>
                  <div className="border border-border rounded-lg p-3">
                    <LogLines content={log.content} stamps={log.stamps} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {notes && (
          // The divider only goes in when there is something above it to divide
          // from — on a day that is a notebook and nothing else, a rule across
          // the top would be the panel's own edge drawn twice.
          <div className={byTask.size || groups.length ? 'border-t border-border pt-4' : ''}>
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

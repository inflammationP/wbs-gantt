import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FolderTree, NotebookText, Pencil, Trash2, X } from 'lucide-react'
import { Task, TaskLog } from '../types'
import { useStore } from '../store/useStore'
import { computeWbs, effectiveStates, isArchived, nameQualifiers, todoCascadeIds } from '../lib/tree'
import { logsForTask } from '../lib/logs'
import { LogLines } from './LogLines'
import { hasStrictLeafUnder, pendingLogsUnder } from '../lib/dayTasks'
import { STATUS_META, priorityMeta, sig, sigText } from '../lib/ui'
import { diffDays, toDate } from '../lib/dates'
import { formatDayMonthYear } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { CompletionHeatmap } from './CompletionHeatmap'
import { LogDialog } from './LogDialog'
import { TaskTreeDialog } from './TaskTreeDialog'
import { StartTodoDialog } from './StartTodoDialog'
import { useDialogs } from './dialogs'

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
  const t = useT()
  const lang = useLang()
  const { ask, element: dialogs } = useDialogs()
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const projects = useStore((s) => s.projects)
  // The store's own `today`, refreshed on a timer — anchoring the pending list
  // to it means the reminder rolls over at midnight like every other count.
  const today = useStore((s) => s.today)
  const setSelected = useStore((s) => s.setSelected)
  const deleteLog = useStore((s) => s.deleteLog)
  const pauseTask = useStore((s) => s.pauseTask)
  const resumeTask = useStore((s) => s.resumeTask)
  const setTaskTodo = useStore((s) => s.setTaskTodo)
  const unarchiveTasks = useStore((s) => s.unarchiveTasks)
  const withUndo = useStore((s) => s.withUndo)

  const [logDialog, setLogDialog] = useState<{ existing?: TaskLog | null } | null>(null)
  const [treeOpen, setTreeOpen] = useState(false)
  const [startTodo, setStartTodo] = useState<string[] | null>(null)
  const [showHistory, setShowHistory] = useState(true)
  const [showPauses, setShowPauses] = useState(false)

  const project = useMemo(() => projects.find((p) => p.id === task?.projectId), [projects, task])

  // The panel has no `key` in App.tsx, so opening another task from inside it —
  // which the "still to log" names now do — hands the same DOM node a different
  // subject while keeping its scroll offset. Left alone, clicking a name near
  // the top would swap the contents and leave the reader halfway down a task
  // they have not seen the beginning of.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0)
  }, [taskId])

  if (!task || !project) return null

  const formatDate = (iso: string | null) => (iso ? formatDayMonthYear(lang, toDate(iso)) : t('common.tbd'))

  const subtasks = tasks.filter((t) => t.parentId === task.id)
  const hasKids = subtasks.length > 0
  const projectTasks = tasks.filter((t) => t.projectId === task.projectId)
  // Numbered over the live tasks, matching the board: a filed-away task has
  // given its number up, and this is what keeps the panel from printing last
  // week's number beside a task the tree no longer counts. For the archived task
  // itself the answer is nothing, and the header prints a dash.
  const wbs = computeWbs(projectTasks.filter((t) => !isArchived(t))).get(task.id) ?? ''
  const effMap = effectiveStates(projectTasks, logs)
  const eff = effMap.get(task.id)
  const effProgress = eff?.progress ?? null
  const depTasks = task.dependencies
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as Task[]
  const taskLogs = logsForTask(logs, task.id)
  // The branch's logging, not this task's: a parent's own progress comes from
  // its children, so its children's gaps are the thing worth surfacing here.
  const branchPending = hasKids ? pendingLogsUnder(tasks, logs, today, task.id) : []
  const tracksLogs = hasKids && hasStrictLeafUnder(tasks, task.id)
  // Not `useMemo`: this sits below the early return above, and a hook after a
  // conditional return is a hook that sometimes does not run.
  const qualifiers = nameQualifiers(branchPending, tasks)
  const taskStatus = eff?.status ?? 'not-started'
  const meta = STATUS_META[taskStatus]
  const prio = priorityMeta(task.priority)
  // Filed away is read-only: every button below is either about the schedule it
  // no longer has or about writing something new into it, and the row is not on
  // the board for either. The way back is the one thing this panel offers, and
  // it is offered at the top.
  const filed = isArchived(task)
  const isLoggable = !filed && (taskStatus === 'in-progress' || taskStatus === 'delayed')
  const pausedDays = task.paused && task.pauseDate ? Math.max(0, diffDays(toDate(task.pauseDate), new Date())) : 0

  // Parking wipes the schedule of the whole unfinished branch, so the count goes
  // in the question.
  const handleSetTodo = () => {
    const extra = todoCascadeIds(tasks, logs, task.id).length - 1
    const message = extra > 0
      ? t('task.setAsTodoConfirmMany', { name: task.name, count: extra })
      : t('task.setAsTodoConfirm', { name: task.name })
    ask(message, () => withUndo(t('gantt.undoTodo', { what: task.name }), () => setTaskTodo(task.id)))
  }

  const handlePause = () => {
    ask(t('task.pauseConfirm', { name: task.name }), () =>
      withUndo(t('gantt.undoPause', { what: task.name }), () => pauseTask(task.id)),
    )
  }

  const handleResume = () => {
    ask(t('task.resumeConfirm', { name: task.name }), () =>
      withUndo(t('gantt.undoResume', { what: task.name }), () => resumeTask(task.id)),
    )
  }

  const handleUnarchive = () => {
    withUndo(t('gantt.undoUnarchive', { what: task.name }), () => unarchiveTasks([task.id]))
  }

  return (
    <>
    <aside className="w-[320px] shrink-0 border-l border-border bg-panel flex flex-col overflow-hidden">
      {/* header */}
      <div className="shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[11px] text-dim">{`WBS ${wbs || t('common.none')}`}</span>
          <button
            onClick={() => setSelected(null)}
            aria-label={t('common.close')}
            title={t('common.close')}
            className="text-dim hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>
        <div className="text-[15px] font-semibold text-fg">{task.name}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          <span className="w-2 h-2 rounded-full" style={{ background: project.color }} />
          {project.name}
          {hasKids && <span className="text-dim">· {t('task.subtaskCount', { count: subtasks.length })}</span>}
          {/* Dim and not a signal colour: "archived" is not a status, and the
              status this task has is already on the row it wears in the drawer. */}
          {filed && (
            <span className="shrink-0 px-1 h-4 inline-flex items-center text-[9px] font-medium rounded-[2px] bg-panel2 text-dim border border-border">
              {t('archive.badge')}
            </span>
          )}
        </div>
      </div>

      <div ref={bodyRef} className="flex-1 overflow-auto p-4 space-y-4">
        {/* Not on a parent. It grew children, so it is a folder now and its
            progress is theirs; there is nothing here for a log to move. What
            takes this button's place is the "still to log" list below, which is
            the thing a parent is actually for. */}
        {isLoggable && !hasKids && (
          <button onClick={() => setLogDialog({ existing: null })} className="w-full h-8 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] hover:brightness-110">
            <NotebookText size={14} /> {t('log.write')}
          </button>
        )}

        {/* Today's gaps in this branch — a readout, not an editor. It says which
            subtasks owe a log today and nothing more; the writing happens on
            each of them, which is where the button above leads once a name is
            clicked. Derived from `pendingLogsUnder`, so what is listed here is
            exactly what the day panel's ring is counting.

            Names are qualified only where they would otherwise collide with
            another name in this same list, and the qualification is the chain of
            parents above the row (see `nameQualifiers`): "which 联调 is this" is
            the question a flat list of names cannot otherwise answer, and it is
            the question that decides where the work gets recorded. */}
        {tracksLogs && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('task.pendingLogs')}</div>
            {branchPending.length ? (
              <div className="space-y-1">
                {branchPending.map((p) => {
                  const above = qualifiers.get(p.id) ?? []
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      title={[...above, p.name].join(t('common.pathSeparator'))}
                      className="w-full flex items-center px-2 h-7 bg-panel2 border border-border rounded-[3px] text-[11px] text-left hover:bg-panel2/60 hover:border-accent/50"
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-not-started" />
                      <span className="truncate ml-2 text-muted">
                        {above.length > 0 && <span className="text-dim">{above.join(t('common.listSeparator'))}{t('common.pathSeparator')}</span>}
                        {p.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-[12px] text-dim">{t('day.allLogged')}</div>
            )}
          </div>
        )}

        {/* history — right below Write log so it's easy to find */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-dim">{t('common.history')}</span>
            {taskLogs.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)} className="text-[11px] text-accent hover:text-fg">
                {showHistory ? t('task.hide') : t('common.logCount', { count: taskLogs.length })}
              </button>
            )}
          </div>
          {showHistory && taskLogs.length > 0 ? (
            <div className="space-y-2">
              {taskLogs.map((log) => (
                <div key={log.id} className="border border-border rounded-[3px] p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-dim">{formatDate(log.date)}</span>
                    {/* Pencil and bin stay on a parent's history. Only the
                        *new* entry is the folder's problem — the entries below
                        were written while this task was still a leaf, and
                        correcting or removing one is managing a record, not a
                        container doing its contents' work. */}
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setLogDialog({ existing: log })} title={t('common.edit')} className="p-0.5 text-dim hover:text-fg"><Pencil size={12} /></button>
                      <button onClick={() => deleteLog(log.id)} title={t('common.delete')} className="p-0.5 text-dim hover:text-delayed"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <LogLines content={log.content} stamps={log.stamps} />
                  {log.targetProgress != null && (
                    <div className="text-[11px] text-dim mt-1">{t('common.targetProgress', { percent: log.targetProgress })}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">{taskLogs.length ? t('task.hidden') : t('logs.empty')}</div>
          )}
        </div>

        {/* Not on a to-do. It has no type to report, and the row used to answer
            the question anyway — first with "Phase", which was the creation
            form's default read back as the user's decision, and then with a
            dash, which is a line of the panel spent saying "not applicable" to
            a question the header has already answered by saying "to-do".

            `task.type` is null exactly when `isTodo`, so the two branches left
            here are the only two this row can be drawn for. */}
        {!task.isTodo && (
          <ReadOnlyField label={t('common.type')}>
            {t(task.type === 'long-term' ? 'type.longTerm' : 'type.phase')}
          </ReadOnlyField>
        )}

        {task.type !== 'long-term' && !task.isTodo && (
          <ReadOnlyField label={t('task.progressMode')}>
            {/* A task with children takes its progress from them, so the strict
                flag is inert on it (`isStrictLeaf` requires no children). Saying
                "Strict (log-based)" here contradicted every other surface —
                the day ring, the Calendar, and the guide's own reminder, which
                all correctly ignore it — and made a strict parent look like a
                task that owed a daily log. */}
            {hasKids ? t('task.modeRolledUp') : task.strictProgress ? t('task.modeStrict') : t('task.modeAuto')}
          </ReadOnlyField>
        )}

        {/* status + priority — a to-do has no priority to show */}
        <div className={`grid ${task.isTodo ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
          <ReadOnlyField label={t('common.status')}>
            <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: sig(meta.token) }} />
            <span className="truncate" style={{ color: sigText(meta.token) }}>{t(meta.labelKey)}</span>
          </ReadOnlyField>
          {!task.isTodo && (
            <ReadOnlyField label={t('common.priority')}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sig(prio.token) }} />
              <span>{t(prio.labelKey)}</span>
            </ReadOnlyField>
          )}
        </div>

        {/* The schedule block, or whatever has taken its place: for a to-do the
            one button there is to press, for a filed-away task the way back and
            nothing else — not even a line saying so, because the button is the
            whole of it. There used to be a note above the to-do button
            explaining that it had no schedule yet and listing what it would be
            asked for when it started; the button says both. */}
        {filed ? (
          <button
            onClick={handleUnarchive}
            className="w-full h-8 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] hover:brightness-110"
          >
            {t('task.unarchive')}
          </button>
        ) : task.isTodo ? (
          <button
            onClick={() => setStartTodo([task.id])}
            className="w-full h-8 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] hover:brightness-110"
          >
            {t('todo.startTask')}
          </button>
        ) : task.paused ? (
          <div>
            <div className="text-[12px] text-muted leading-relaxed bg-panel2 border border-border rounded-[3px] p-2.5">
              {t('task.pausedNote', {
                start: task.startDate ? formatDate(task.startDate) : t('common.none'),
                paused: task.pauseDate ? formatDate(task.pauseDate) : t('common.none'),
                count: pausedDays,
              })}
            </div>
            <button onClick={handleResume} className="mt-2 w-full h-8 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] hover:brightness-110">
              {t('task.resume')}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ReadOnlyField label={t('common.start')}>{task.startDate ? formatDate(task.startDate) : t('common.none')}</ReadOnlyField>
              <ReadOnlyField label={task.pauses.length ? t('task.endPostponed') : t('common.end')}>
                {task.type === 'long-term' ? t('common.tbd') : formatDate(task.endDate)}
              </ReadOnlyField>
            </div>
            {task.type !== 'long-term' && taskStatus !== 'completed' && (
              // Two ways of putting the same work aside, and the pair is worth
              // seeing together: a pause keeps the schedule and hands back the
              // days it cost, parking drops the schedule entirely.
              //
              // "Not started" still gets no pause — there is no schedule to
              // interrupt yet, and a pause would only postpone nothing — but
              // parking is there in every state, which is what the pairing is
              // for. The two are tied together tighter than the body's usual
              // spacing, because they are one choice with two answers.
              <div className="space-y-1.5">
                {taskStatus !== 'not-started' && (
                  <button onClick={handlePause} className="w-full h-7 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
                    {t('task.pause')}
                  </button>
                )}
                <button onClick={handleSetTodo} className="w-full h-7 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
                  {t('task.setAsTodo')}
                </button>
              </div>
            )}
          </>
        )}

        {/* pause history — suppressed for to-dos: it is schedule history, and
            they have no schedule */}
        {!task.paused && !task.isTodo && task.pauses.length > 0 && (
          <div>
            <button onClick={() => setShowPauses(!showPauses)} className="text-[11px] text-accent hover:text-fg">
              {showPauses ? '▾' : '▸'} {t('task.pauseHistory', { count: task.pauses.length })}
            </button>
            {showPauses && (
              <div className="mt-1.5 space-y-1">
                {task.pauses.map((p, i) => (
                  <div key={i} className="text-[11px] text-muted">
                    {t('task.pauseEntry', { from: formatDate(p.pauseDate), to: formatDate(p.resumeDate) })}
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
              <span className="text-[10px] uppercase tracking-wider text-dim">{t('common.progress')}</span>
              <span className="font-mono text-[11px] text-muted">{effProgress}%</span>
            </div>
            <div className="h-2 bg-panel2 rounded-full overflow-hidden">
              <div className="h-full" style={{ width: `${effProgress}%`, background: sig(meta.token), opacity: 0.7 }} />
            </div>
          </div>
        )}

        {/* The same days the Calendar counts, drawn as squares. A to-do has no
            schedule to draw, so it is the one task kind left out. */}
        {!task.isTodo && (
          <CompletionHeatmap taskId={task.id} start={eff?.start ?? null} end={eff?.end ?? null} title={t('task.heat.title')} />
        )}

        {/* tags */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('common.tags')}</div>
          {task.tags.length ? (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center px-1.5 h-5 text-[11px] bg-panel2 border border-border rounded-[3px] text-muted">{tag}</span>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">{t('common.none')}</div>
          )}
        </div>

        {/* dependencies */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('common.dependencies')}</div>
          {depTasks.length ? (
            <div className="space-y-1">
              {depTasks.map((d) => (
                <div key={d.id} className="flex items-center px-2 h-7 bg-panel2 border border-border rounded-[3px] text-[11px] text-muted">
                  <span className="truncate">{d.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim">{t('common.none')}</div>
          )}
        </div>

        {/* The way into the tree diagram. A button rather than the drawing
            itself: the project's tree is long, and in a 320px column it is a
            wall of rows pushing everything below it off the screen. Hidden when
            the project has nothing else in it, which is the one case where the
            drawing would be a single name. */}
        {projectTasks.length > 1 && !filed && (
          <button
            onClick={() => setTreeOpen(true)}
            className="w-full h-7 inline-flex items-center justify-center gap-1.5 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]"
          >
            <FolderTree size={13} /> {t('task.tree')}
          </button>
        )}

        {/* description */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('common.description')}</div>
          <div className="text-[12px] text-muted leading-relaxed whitespace-pre-wrap">{task.description || t('common.noDescription')}</div>
        </div>
      </div>
    </aside>
    {logDialog && <LogDialog taskId={task.id} existing={logDialog.existing} onClose={() => setLogDialog(null)} />}
    {treeOpen && (
      <TaskTreeDialog
        taskId={task.id}
        // Closing on the way out, not staying open on the old task: the tree is
        // drawn around the task being read, and following a row puts you
        // somewhere else. A diagram centred on where you were, now showing
        // somewhere you are not, is worse than one you open again.
        onPick={(id) => {
          setSelected(id)
          setTreeOpen(false)
        }}
        onClose={() => setTreeOpen(false)}
      />
    )}
    {startTodo && <StartTodoDialog taskIds={startTodo} onClose={() => setStartTodo(null)} />}
    {dialogs}
    </>
  )
}

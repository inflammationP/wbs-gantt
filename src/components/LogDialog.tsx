import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useStore } from '../store/useStore'
import { Task, TaskLog } from '../types'
import { todayISO } from '../lib/dates'
import { pendingLogsUnder } from '../lib/dayTasks'
import { hasChildren } from '../lib/tree'
import { useT } from '../lib/useT'

interface Props {
  taskId: string
  existing?: TaskLog | null
  /** Date to prefill for a new log. Defaults to today. */
  defaultDate?: string
  onClose: () => void
}

/**
 * Write a log, or edit one.
 *
 * Writing on a task that has subtasks opens in *batch* mode: a picker of
 * everything under it that still owes a log today (see `pendingLogsUnder`), and
 * saving moves to the next one instead of closing. The point is that filling a
 * branch's gaps should be one pass, not one open-close per subtask — and that
 * the gaps come from the same six conditions the day ring is drawn from, so the
 * two can never disagree about what is owed.
 *
 * Editing is deliberately not batch: there is exactly one form to fill, and
 * nothing to advance to.
 */
export function LogDialog({ taskId, existing, defaultDate, onClose }: Props) {
  const t = useT()
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const today = useStore((s) => s.today)
  const addLog = useStore((s) => s.addLog)
  const updateLog = useStore((s) => s.updateLog)

  const task = tasks.find((x) => x.id === taskId)

  // What is still owed under this task today — the same list the parent's
  // reminder prints, from the same function, so the picker can never offer
  // something that list denies or hide something it shows.
  //
  // A task with children is never a strict leaf (`isStrictLeaf` requires none),
  // so the task itself cannot appear in its own pending list — the picker holds
  // leaves only. That is deliberate: the reminder goes to the end of each branch,
  // and offering the branch's own strict parent alongside them would put back
  // the higher-level task the reminder just declined to name.
  const pending = useMemo(
    () => (hasChildren(tasks, taskId) ? pendingLogsUnder(tasks, logs, today, taskId) : []),
    [tasks, logs, today, taskId],
  )

  // Batch only when there is a gap to walk. With none, this is the ordinary log
  // button it has always been, writing on the task it was opened from; a leaf
  // has no branch to fill, and an edit has nothing to advance to.
  const batch = !existing && pending.length > 0

  // `null` follows the gaps. Choosing from the picker pins it until the next save.
  const [picked, setPicked] = useState<string | null>(null)

  if (!task) return null

  const target = batch ? (picked ?? pending[0].id) : taskId
  const targetTask = tasks.find((x) => x.id === target) ?? task

  const save = (date: string, content: string, targetProgress: number | null) => {
    if (existing) {
      updateLog(existing.id, { date, content, targetProgress })
      onClose()
      return
    }
    addLog({ taskId: target, date, content, targetProgress })
    // What will still be owed once this lands: the pre-save list minus the one
    // just written, which is exactly what the store settles to. Reading it here
    // rather than after a re-render is what makes the last save close the dialog
    // and every earlier one stay open.
    const left = pending.filter((p) => p.id !== target)
    if (left.length === 0) onClose()
    else setPicked(null)
  }

  return (
    <Modal title={existing ? t('log.edit') : t('log.write')} onClose={onClose} width={560}>
      <div className="space-y-3">
        {batch ? (
          <Field label={t('log.task')}>
            <select className={inputCls} value={target} onChange={(e) => setPicked(e.target.value)}>
              {pending.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="text-[13px] font-medium text-fg">{task.name}</div>
        )}

        {/* Keyed by the task: switching target must not carry the previous
            entry's date, text or target progress across. */}
        <LogForm
          key={target}
          task={targetTask}
          existing={existing}
          defaultDate={defaultDate}
          // A target progress is only ever read back on a strict *leaf*
          // (`isStrictLeaf`), so offering the field on a task with children
          // would collect a number nothing reads — the same lie the detail
          // panel used to tell about a parent's progress mode.
          strict={targetTask.strictProgress === true && targetTask.type === 'phase' && !hasChildren(tasks, target)}
          saveLabel={batch && pending.some((p) => p.id !== target) ? t('log.saveNext') : t('common.save')}
          onSave={save}
          onCancel={onClose}
        />
      </div>
    </Modal>
  )
}

function LogForm({
  task,
  existing,
  defaultDate,
  strict,
  saveLabel,
  onSave,
  onCancel,
}: {
  task: Task
  existing?: TaskLog | null
  defaultDate?: string
  strict: boolean
  saveLabel: string
  onSave: (date: string, content: string, targetProgress: number | null) => void
  onCancel: () => void
}) {
  const t = useT()

  const [date, setDate] = useState(existing?.date ?? defaultDate ?? todayISO())
  const [content, setContent] = useState(existing?.content ?? '')
  const [targetProgress, setTargetProgress] = useState<number | null>(existing?.targetProgress ?? null)
  const [showTarget, setShowTarget] = useState(existing?.targetProgress != null)

  const taRef = useRef<HTMLTextAreaElement>(null)
  // Caret position to restore after the controlled re-render; setting
  // `.value` on a textarea resets the selection to the end.
  const pendingSel = useRef<[number, number] | null>(null)

  useLayoutEffect(() => {
    const sel = pendingSel.current
    if (!sel || !taRef.current) return
    pendingSel.current = null
    taRef.current.setSelectionRange(sel[0], sel[1])
  }, [content])

  // Tab must indent (the log format treats a leading tab as "sub-item"); the
  // browser default would move focus to the next control instead.
  const onLogKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    const el = taRef.current
    if (!el) return
    e.preventDefault()
    const { selectionStart: s, selectionEnd: en, value } = el

    if (e.shiftKey) {
      // Outdent: drop one leading tab from the caret's line.
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      if (value[lineStart] !== '\t') return
      pendingSel.current = [Math.max(lineStart, s - 1), Math.max(lineStart, en - 1)]
      setContent(value.slice(0, lineStart) + value.slice(lineStart + 1))
      return
    }

    pendingSel.current = [s + 1, en + 1]
    setContent(value.slice(0, s) + '\t' + value.slice(en))
  }

  const submit = () => {
    if (!content.trim()) return
    onSave(date, content, strict ? targetProgress : null)
  }

  return (
    <>
      <Field label={t('common.date')}>
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <Field label={t('log.label')}>
        <textarea
          ref={taRef}
          className={`${inputCls} h-32 py-2 resize-none`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onLogKeyDown}
          placeholder={t('log.contentPlaceholder')}
          autoFocus
        />
        <div className="text-[11px] text-dim mt-1">{t('log.hint')}</div>
      </Field>

      {strict && (
        <div className="border-t border-line pt-2">
          <button onClick={() => setShowTarget(!showTarget)} className="flex items-center gap-1 text-[12px] text-muted hover:text-fg">
            <span className="text-[10px]">{showTarget ? '▾' : '▸'}</span>
            {t('log.setTarget')}
          </button>
          {showTarget && (
            <div className="mt-2">
              <Field label={t('log.progressAfterDay')}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputCls}
                  value={targetProgress ?? ''}
                  onChange={(e) =>
                    setTargetProgress(e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))))
                  }
                  placeholder={t('log.targetPlaceholder')}
                />
              </Field>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">{t('common.cancel')}</button>
        <button onClick={submit} disabled={!content.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]">{saveLabel}</button>
      </div>
    </>
  )
}

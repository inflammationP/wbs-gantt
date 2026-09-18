import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useStore } from '../store/useStore'
import { Task, TaskLog } from '../types'
import { addDays, toDate, toISO, todayISO } from '../lib/dates'
import { isStrictLeaf, pendingLogsUnder } from '../lib/dayTasks'
import { buildChildrenMap, hasChildren } from '../lib/tree'
import { taskProgress } from '../lib/progress'
import { useT } from '../lib/useT'

// `inputCls` carries `border-border`, and a red box has to not race it in the
// stylesheet — swapping the token out is explicit about which one is in force.
const errCls = inputCls.replace('border-border', 'border-delayed')

// The same trick for the same reason: `inputCls` carries `h-8`, which suits a
// one-line input, and a textarea has to say its own height. Outweighing it does
// not work — both rules land in one layer, and Tailwind emits them in *name*
// order, where `h-56` comes before `h-8`, so the shorter one wins. The `h-32`
// this replaced had that bug too and never applied: the box was 32px tall the
// whole time, which is what "the log editor did not get any bigger" was.
const areaCls = inputCls.replace('h-8', '')

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

/** A half-typed number — `-`, `1.` — is not a number yet, and not 0 either. */
function parseNum(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

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

  const children = useMemo(() => buildChildrenMap(tasks), [tasks])

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
          logs={logs}
          // A target progress is only ever read back on a strict *leaf*
          // (`isStrictLeaf`), so offering the field on a task with children
          // would collect a number nothing reads — the same lie the detail
          // panel used to tell about a parent's progress mode.
          strict={isStrictLeaf(targetTask, children)}
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
  logs,
  strict,
  saveLabel,
  onSave,
  onCancel,
}: {
  task: Task
  existing?: TaskLog | null
  defaultDate?: string
  logs: TaskLog[]
  strict: boolean
  saveLabel: string
  onSave: (date: string, content: string, targetProgress: number | null) => void
  onCancel: () => void
}) {
  const t = useT()

  const [date, setDate] = useState(existing?.date ?? defaultDate ?? todayISO())
  const [content, setContent] = useState(existing?.content ?? '')
  const [error, setError] = useState<'missing' | 'backward' | null>(null)

  // The number the two boxes are measured from.
  //
  // Normally it is the task's progress at the start of this log's day — the
  // delta has to mean "how much since that morning" — clipped to the previous
  // day and to logs other than the one being edited, so pushing the date forward
  // cannot make a log its own baseline.
  //
  // A task that states no progress anywhere is the exception, and it is not a
  // small one: those are the logs written before the fields were mandatory, so
  // their number is whatever the retired logged-days rule derives. For them the
  // day-start baseline is a fiction — it can read 0% while the task reads 17%,
  // and stating a value on any one entry (the oldest included) becomes the whole
  // task's progress, which lets it be set to 0. So the boxes are held to where
  // the task reads *now* instead. That also makes the line under the boxes true,
  // which it was not: it said 0% next to a task wearing 17%.
  const base = useMemo(() => {
    if (!logs.some((l) => l.taskId === task.id && l.targetProgress != null)) {
      return taskProgress(task, logs, new Date()) ?? 0
    }
    // Writing another block into a day that already has one. What this write
    // replaces is *that* entry's number, so the boxes are measured from it —
    // otherwise the pair started at the morning's value and "add 5" to a day
    // already sitting at 35 landed the task on 5. Goes for a past day too, where
    // the panel's "write on this day" merges the same way.
    if (!existing && date) {
      const sameDay = logs.filter((l) => l.taskId === task.id && l.date === date)
      // The last one, which is the one `taskProgress` would count were the day
      // somehow carrying more than one entry.
      const stated = sameDay.length ? sameDay[sameDay.length - 1].targetProgress : null
      if (stated != null) return stated
    }
    if (!date) return 0
    const before = addDays(toDate(date), -1)
    const prior = logs.filter((l) => l.id !== existing?.id && l.date <= toISO(before))
    return taskProgress(task, prior, before) ?? 0
  }, [logs, task, date, existing?.id])

  // One number, two boxes. `src` is whichever the user typed into and stays the
  // master until they type into the other; the other is re-derived from `base`
  // on every render, so changing the date moves it with the baseline. Held as
  // the raw string rather than a number because "" is a state of its own — an
  // empty required box must not read as 0, and neither must a lone "-".
  const [prog, setProg] = useState<{ src: 'delta' | 'absolute'; input: string }>(() => {
    const stored = existing?.targetProgress
    if (stored != null) return { src: 'absolute', input: String(stored) }
    // A log written before the field became mandatory has no number of its own.
    // It opens at the baseline, so saving it untouched writes nothing new —
    // which is what "don't send the user back to fix old logs" has to mean.
    return { src: 'absolute', input: existing ? String(base) : '' }
  })
  // Frozen at mount: the number the user was shown, so "left it alone" can be
  // told apart from "typed the same thing back".
  const seed = useRef(prog.input).current
  const touched = prog.input !== seed

  const typed = parseNum(prog.input)
  const absolute = typed == null ? null : clampPct(prog.src === 'absolute' ? typed : base + typed)
  const delta = absolute == null ? null : absolute - base
  const deltaText = prog.src === 'delta' ? prog.input : delta == null ? '' : String(delta)
  const absoluteText = prog.src === 'absolute' ? prog.input : absolute == null ? '' : String(absolute)

  // Only one of the two is ever stored, so the clamp lives on the absolute and
  // the delta's own range is whatever lands inside it — [-base, 100 - base], of
  // which the lower half is rejected on save rather than clamped away (see
  // `submit`). Out of the top of the range, the typed box is brought back in
  // line on blur rather than mid-keystroke, which would rewrite it under the
  // caret.
  const settle = () => {
    if (absolute == null) return
    setProg((p) => ({ ...p, input: String(p.src === 'delta' ? absolute - base : absolute) }))
  }

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
    // A cleared date would be written as '' — which sorts before every real
    // date and so falls inside `logsUpTo` for every day there has ever been.
    if (!content.trim() || !date) return
    if (!strict) {
      onSave(date, content, null)
      return
    }
    if (absolute == null) {
      setError('missing')
      return
    }
    // A retreat is not a typo to be clamped away — the figure is a record of
    // work done, and lowering it rewrites history rather than reporting it.
    // Only checked on a value the user actually chose: an untouched row writes
    // back whatever it already carried, including the retreats old data has.
    if (touched && absolute < base) {
      setError('backward')
      return
    }
    // Never typed into: write back what the row already carried, so opening a
    // log and pressing save is a true no-op instead of stamping a number onto a
    // row that deliberately had none.
    onSave(date, content, touched ? absolute : (existing?.targetProgress ?? null))
  }

  return (
    <>
      <Field label={t('common.date')}>
        <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <Field label={t('log.label')}>
        <textarea
          ref={taRef}
          // Tall on purpose: a day's entry now carries everything written to it
          // that day, the divider lines included, so the box has to show a block
          // of text rather than a couple of lines of it.
          className={`${areaCls} h-56 resize-none`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onLogKeyDown}
          placeholder={t('log.contentPlaceholder')}
          autoFocus
        />
        <div className="text-[11px] text-dim mt-1">{t('log.hint')}</div>
      </Field>

      {strict && (
        <div className="border-t border-line pt-3">
          {/* Two boxes on one number: typing in either fills the other. "Did
              nothing today" is a 0 in the delta — one keystroke, no arithmetic
              against a total nobody remembers. */}
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('log.progressAdd')}>
              <input
                // Not `type="number"`: a lone "-" reports as "" there, so the
                // minus is swallowed on re-render and a retreat becomes
                // untypeable — which is the whole point of this box.
                type="text"
                inputMode="decimal"
                className={error ? errCls : inputCls}
                value={deltaText}
                onChange={(e) => {
                  setError(null)
                  setProg({ src: 'delta', input: e.target.value })
                }}
                onBlur={settle}
              />
            </Field>
            <Field label={t('log.progressAfterDay')}>
              <input
                type="text"
                inputMode="decimal"
                className={error ? errCls : inputCls}
                value={absoluteText}
                onChange={(e) => {
                  setError(null)
                  setProg({ src: 'absolute', input: e.target.value })
                }}
                onBlur={settle}
              />
            </Field>
          </div>
          <div className={`text-[11px] mt-1 ${error ? 'text-delayed' : 'text-dim'}`}>
            {error === 'backward'
              ? t('log.progressBackward')
              : error === 'missing'
                ? t('log.progressRequired', { add: t('log.progressAdd') })
                : t('log.currentProgress', { percent: base })}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">{t('common.cancel')}</button>
        <button onClick={submit} disabled={!content.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]">{saveLabel}</button>
      </div>
    </>
  )
}

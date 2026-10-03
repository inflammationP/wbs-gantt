import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useStore } from '../store/useStore'
import { Task, TaskLog } from '../types'
import { addDays, toDate, toISO } from '../lib/dates'
import { isStrictLeaf } from '../lib/dayTasks'
import { buildChildrenMap, isArchived } from '../lib/tree'
import { countableDays, taskProgress } from '../lib/progress'
import { isLogDayOpen, opensLogDay } from '../lib/logs'
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
  /**
   * An entry to correct the figure on, rather than writing a new one.
   *
   * Only today's can be passed — see `isLogDayOpen` — and only the figure is
   * open to change; the text above it is shown, not offered.
   */
  existing?: TaskLog | null
  onClose: () => void
}

/**
 * Write today's log — for one task, and only for the task it was opened on.
 *
 * Two things it can be doing, and they are both about one day. It writes today's
 * entry; or it corrects the figure on today's entry, which is the one thing
 * about an entry that can still move after it is written. The text is the
 * record and is read-only in both — more to say is another paragraph, added by
 * writing, not a rewrite. There is no deleting, and no reaching back past today:
 * once the day is over the entry says what it said.
 *
 * Writing on a task with subtasks used to open in *batch* mode: a picker of
 * everything under it that still owed a log today, saving advancing to the next
 * one instead of closing. It is gone. A parent is a container, and a container
 * does not do its contents' work — filling in another task's day from here
 * meant the box on screen was never the thing being written about, and the one
 * rule the whole tree is built on is that a task's work is recorded on the task.
 *
 * What a parent keeps is the readout: the "still to log" list in the detail
 * panel names every subtask that owes one today, and each name opens that
 * subtask, where this dialog is one click away. The list and the day's ring are
 * still built from the same six conditions (`pendingLogsUnder`, `strictLogRate`
 * in lib/dayTasks.ts), so the count on the ring and the names in the list cannot
 * drift apart — losing the picker cost nothing there.
 *
 * Then the parent's own write went too, which is what the guard below is. The
 * batch picker was already saying a container does not do its contents' work;
 * a button that writes one entry on the container itself says the smaller half
 * of the same wrong thing. A task that gains a child is a folder from that
 * moment, and a folder has no progress of its own for a log to move.
 *
 */
export function LogDialog({ taskId, existing, onClose }: Props) {
  const t = useT()
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const today = useStore((s) => s.today)
  const addLog = useStore((s) => s.addLog)
  const updateLog = useStore((s) => s.updateLog)

  const task = tasks.find((x) => x.id === taskId)

  if (!task) return null

  // A task with children is a folder, and a folder does not keep a log.
  //
  // A folder has no progress of its own for a log to move (`taskProgress` is
  // only ever read off leaves), so a write here would be a number nothing reads.
  // Every caller hides its own way in — the context menu's item, the panel's
  // button — and this is the line that makes the rule true rather than merely
  // well hidden. Without it the rule lives in each of those places, and the
  // fifth one added later will not remember.
  if (tasks.some((x) => x.parentId === task.id) || isArchived(task)) return null

  const task_ = task
  // A figure is only ever read back on a strict *leaf* (`isStrictLeaf`), so a
  // parent would collect a number nothing reads — the same lie the detail panel
  // used to tell about a parent's progress mode.
  const strict = isStrictLeaf(task_, buildChildrenMap(tasks))

  // The day is today's throughout — the dialog cannot be about another day at
  // all — so the date is not something the form carries and not something this
  // has to pass on. The store checks it again on the way in.
  //
  // A day that is over is a record, and correcting a figure is still a write:
  // it does not open on one, and the entry stays readable in the task's history
  // and in the Logs page either way.
  if (existing && (!isLogDayOpen(existing.date, today) || !strict)) return null

  const save = (content: string, targetProgress: number | null) => {
    if (existing) {
      updateLog(existing.id, targetProgress)
      onClose()
      return
    }
    addLog({ taskId, date: today, content, targetProgress })
    onClose()
  }

  return (
    <Modal title={existing ? t('log.editProgress') : t('log.write')} onClose={onClose} width={560}>
      <div className="space-y-3">
        <div className="text-[13px] font-medium text-fg">{task_.name}</div>

        <LogForm
          task={task_}
          existing={existing}
          today={today}
          logs={logs}
          strict={strict}
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
  today,
  logs,
  strict,
  onSave,
  onCancel,
}: {
  task: Task
  existing?: TaskLog | null
  /** The only day this form can be about. See `isLogDayOpen`. */
  today: string
  logs: TaskLog[]
  strict: boolean
  onSave: (content: string, targetProgress: number | null) => void
  onCancel: () => void
}) {
  const t = useT()

  const [content, setContent] = useState(existing?.content ?? '')
  const [error, setError] = useState<'missing' | 'backward' | null>(null)

  // Whether this dialog is the one that states where the day left the task.
  //
  // Only a day's *first* entry does. A second entry on the same day is more of
  // that day's writing — added hours later, about the same work — and it takes
  // no number, because a day has one figure and two boxes on the second entry
  // were two places to keep the same one in step. The figure is not unreachable
  // Correcting a figure that is already there, or writing the entry that states
  // the day's first one. A *second* write into a day that already has a figure
  // is more of the day's paragraphs and asks nothing — the figure is corrected
  // from the entry it belongs to, which is what `existing` is.
  const asksProgress = strict && (existing != null || opensLogDay(logs, task.id, today))

  // The number the two boxes are measured from.
  //
  // Normally it is the task's progress at the start of today — the delta has to
  // mean "how much since this morning".
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
    // Writing a *second* entry into a day already carrying one used to measure
    // its boxes from that day's own number, so that "add 5" to a day sitting at
    // 35 landed on 40. It does not any more, and the branch went with it: a
    // second entry asks for no number at all (`asksProgress`), so there are no
    // boxes to measure from — only the day's first entry states a figure.
    const before = addDays(toDate(today), -1)
    const prior = logs.filter((l) => l.date <= toISO(before))
    return taskProgress(task, prior, before) ?? 0
  }, [logs, task, today])

  // One number, two boxes. `src` is whichever the user typed into and stays the
  // master until they type into the other; the other is re-derived from `base`
  // on every render. Held as
  // the raw string rather than a number because "" is a state of its own — an
  // empty required box must not read as 0, and neither must a lone "-".
  const [prog, setProg] = useState<{ src: 'delta' | 'absolute'; input: string }>({
    // Opened on the figure the entry carries, so correcting it is a change to a
    // number rather than a question about which number it was.
    src: 'absolute',
    input: existing?.targetProgress != null ? String(existing.targetProgress) : '',
  })

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

  // What one day of this task is worth, when the span is split evenly: the
  // same number every day, fixed by the window rather than by how much has been
  // written so far.
  //
  // A shortcut, not a rule. Pressing it fills one of the two boxes with a
  // number and the user can then edit it like anything they typed — what gets
  // stored is still a plain figure, and nothing downstream knows this button
  // exists. That is the whole point: the same arithmetic the app already
  // derives for old data (see the auto-accumulate in `taskProgress`), offered
  // as a keystroke instead of as a fallback nobody can see.
  const dayShare = useMemo(() => {
    if (task.startDate == null || task.endDate == null) return null
    const days = countableDays(task, task.startDate, task.endDate)
    return days > 0 ? Math.round(100 / days) : null
  }, [task])

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
    // Nothing is asked, so nothing is written: `null` is the entry stating no
    // figure, and the day keeps the one its first entry gave it.
    if (!asksProgress) {
      onSave(content, null)
      return
    }
    if (absolute == null) {
      setError('missing')
      return
    }
    // A retreat is not a typo to be clamped away — the figure is a record of
    // work done, and lowering it rewrites history rather than reporting it.
    if (absolute < base) {
      setError('backward')
      return
    }
    onSave(content, absolute)
  }

  return (
    <>
      <Field label={t('log.label')}>
        <textarea
          ref={taRef}
          // Tall on purpose: a day's entry now carries everything written to it
          // that day, the divider lines included, so the box has to show a block
          // of text rather than a couple of lines of it.
          //
          // Read-only when correcting a figure, and shown rather than hidden:
          // the sentence you are correcting the number against is the one worth
          // having in front of you. Dimmed so that "you cannot type here" is
          // visible before the cursor is tried — the same reason it is not a
          // `disabled` box, which greys the text itself past reading.
          readOnly={!!existing}
          className={`${areaCls} h-56 resize-none ${existing ? 'text-muted' : ''}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onLogKeyDown}
          placeholder={t('log.contentPlaceholder')}
          autoFocus={!existing}
        />
        <div className="text-[11px] text-dim mt-1">{t('log.hint')}</div>
      </Field>

      {asksProgress && (
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
          <div className="flex items-start justify-between gap-2 mt-1">
            <div className={`text-[11px] ${error ? 'text-delayed' : 'text-dim'}`}>
              {error === 'backward'
                ? t('log.progressBackward')
                : error === 'missing'
                  ? t('log.progressRequired', { add: t('log.progressAdd') })
                  : t('log.currentProgress', { percent: base })}
            </div>
            {/* Splits the span across the window's days, and calls a remainder
                below a fifth of one a completion. Right of the line rather than
                under the boxes, because it is a way of filling one of them —
                not a third thing to fill in. */}
            {dayShare != null && (
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  // Advance one day = add (1 ÷ the task's days) × 100.
                  //
                  // What is left over after that is then read: a remainder
                  // below a *fifth* of a day's share is a rounding artifact,
                  // not work. On a 3-day task the shares are 33, 33, 33 — after
                  // two logs the task reads 66, and the last day would have to
                  // claim 34 to land on 100, or write a 1% log to clear the
                  // crumb. Past that threshold the task is taken as complete and
                  // the box is filled with 100 instead.
                  //
                  // A fifth, not a whole day, because the gap this closes is
                  // only ever the rounding's: it is a crumb left by 100 ÷ N not
                  // being a whole number, and one whole day is a day's work
                  // that still deserves its log.
                  const after = clampPct(base + dayShare)
                  setProg(
                    100 - after < dayShare / 5
                      ? { src: 'absolute', input: '100' }
                      : { src: 'delta', input: String(dayShare) },
                  )
                }}
                className="shrink-0 text-[11px] text-accent hover:text-fg"
              >
                {t('log.byDays')}
              </button>
            )}
          </div>
          {/* The rule in words, under the boxes. It used to be the button's
              `title`, which is the browser's own tooltip and cannot be made to
              appear any sooner than about a second — too slow to be read as an
              explanation of the thing the pointer is resting on. */}
          {dayShare != null && (
            <div className="mt-1 text-[11px] text-dim leading-snug">{t('log.byDaysHint')}</div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">{t('common.cancel')}</button>
        <button onClick={submit} disabled={!content.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]">{t('common.save')}</button>
      </div>
    </>
  )
}

import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useStore } from '../store/useStore'
import { Postponement } from '../types'
import { addDays, toDate, toISO } from '../lib/dates'
import { formatDayMonthYear } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'

/**
 * Push one task's end date later and write down why — or rewrite the record
 * that says it already was.
 *
 * The create form asks for the date as well as the reason because "postponed by
 * a week" is not the same decision as "postponed to the end of the month", and
 * only the person holding the task can say which one this is. The default is the
 * day after the current end — or tomorrow for a task already overdue, where the
 * old end is no longer a useful starting point.
 *
 * Only the latest record is offered for editing, and the whole of it is open:
 * the day it was written, the window it moved, and the reason. The end it moved
 * to is what the task's own end follows, so this form is also the way to take a
 * postponement back.
 */
export function PostponeDialog({
  taskId,
  existing,
  onClose,
}: {
  taskId: string
  /** The latest record to rewrite; omitted when writing a new one. */
  existing?: Postponement | null
  onClose: () => void
}) {
  const t = useT()
  const lang = useLang()
  const task = useStore((s) => s.tasks.find((x) => x.id === taskId))
  const postponeTask = useStore((s) => s.postponeTask)
  const editPostponement = useStore((s) => s.editPostponement)
  const withUndo = useStore((s) => s.withUndo)
  const today = useStore((s) => s.today)

  const [recordDate, setRecordDate] = useState(existing?.date ?? today)
  const [from, setFrom] = useState(existing?.from ?? task?.endDate ?? today)
  const [endDate, setEndDate] = useState(() => {
    if (existing) return existing.to
    const end = task?.endDate ?? null
    const base = end && end >= today ? end : today
    return toISO(addDays(toDate(base), 1))
  })
  const [reason, setReason] = useState(existing?.reason ?? '')

  if (!task || !task.endDate) return null

  const min = toISO(addDays(toDate(task.endDate), 1))
  // The reason is a memo, not a gate; the window still has to be a postponement.
  const valid = existing
    ? recordDate !== '' && from !== '' && endDate > from
    : endDate >= min

  const submit = () => {
    if (!valid) return
    if (existing) {
      withUndo(t('gantt.undoPostponeEdit', { what: task.name }), () =>
        editPostponement(task.id, { date: recordDate, from, to: endDate, reason }),
      )
    } else {
      withUndo(t('gantt.undoPostpone', { what: task.name }), () =>
        postponeTask(task.id, endDate, reason),
      )
    }
    onClose()
  }

  const revoke = () => {
    if (!existing) return
    withUndo(t('gantt.undoPostponeRevoke', { what: task.name }), () =>
      editPostponement(task.id, null),
    )
    onClose()
  }

  return (
    <Modal
      title={existing
        ? t('task.postponeEditTitle', { name: task.name })
        : t('task.postponeTitle', { name: task.name })}
      onClose={onClose}
      width={440}
    >
      <div className="space-y-3">
        {existing ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('task.postponeDate')}>
                <input
                  type="date"
                  className={inputCls}
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                />
              </Field>
              <Field label={t('task.postponeFrom')}>
                <input
                  type="date"
                  className={inputCls}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
            </div>
            <Field label={t('task.postponeNewEnd')}>
              <input
                type="date"
                className={inputCls}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
            {from !== '' && endDate <= from && (
              <div className="text-[11px] text-delayed">{t('task.postponeLaterFrom')}</div>
            )}
          </>
        ) : (
          <>
            <div className="text-[12px] text-muted bg-panel2 border border-border rounded-[3px] p-2.5">
              {t('task.postponeCurrent', { date: formatDayMonthYear(lang, toDate(task.endDate)) })}
            </div>

            <Field label={t('task.postponeNewEnd')}>
              <input
                type="date"
                className={inputCls}
                min={min}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
            {endDate < min && <div className="text-[11px] text-delayed">{t('task.postponeLater')}</div>}
          </>
        )}

        <Field label={t('task.postponeReason')}>
          <textarea
            autoFocus
            className={`${inputCls} h-20 py-1.5 resize-none`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          {existing && (
            <button
              onClick={revoke}
              className="mr-auto h-8 px-3 text-[12px] text-delayed hover:text-fg border border-border rounded-[3px]"
            >
              {t('task.postponeRevoke')}
            </button>
          )}
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
            {t('common.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!valid}
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]"
          >
            {existing ? t('common.save') : t('task.postponeConfirm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

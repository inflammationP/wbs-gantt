import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useStore } from '../store/useStore'
import { addDays, toDate, toISO } from '../lib/dates'
import { formatDayMonthYear } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'

/**
 * Push one task's end date later and write down why.
 *
 * The date is asked for as well as the reason because "postponed by a week" is
 * not the same decision as "postponed to the end of the month", and only the
 * person holding the task can say which one this is. The default is the day
 * after the current end — or tomorrow for a task already overdue, where the
 * old end is no longer a useful starting point.
 */
export function PostponeDialog({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const t = useT()
  const lang = useLang()
  const task = useStore((s) => s.tasks.find((x) => x.id === taskId))
  const postponeTask = useStore((s) => s.postponeTask)
  const withUndo = useStore((s) => s.withUndo)
  const today = useStore((s) => s.today)

  const [endDate, setEndDate] = useState(() => {
    const end = task?.endDate ?? null
    const base = end && end >= today ? end : today
    return toISO(addDays(toDate(base), 1))
  })
  const [reason, setReason] = useState('')

  if (!task || !task.endDate) return null

  const min = toISO(addDays(toDate(task.endDate), 1))
  const valid = endDate >= min && reason.trim() !== ''

  const submit = () => {
    if (!valid) return
    withUndo(t('gantt.undoPostpone', { what: task.name }), () =>
      postponeTask(task.id, endDate, reason),
    )
    onClose()
  }

  return (
    <Modal title={t('task.postponeTitle', { name: task.name })} onClose={onClose} width={440}>
      <div className="space-y-3">
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

        <Field label={t('task.postponeReason')}>
          <textarea
            autoFocus
            className={`${inputCls} h-20 py-1.5 resize-none`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
            {t('common.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!valid}
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]"
          >
            {t('task.postponeConfirm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

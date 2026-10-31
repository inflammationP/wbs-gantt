import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useT } from '../lib/useT'

/**
 * Pause one task — or one selection of tasks — and write down why.
 *
 * The same shape as `PostponeDialog` without the date: pausing already knows
 * when it starts, and only the reason is the user's to give. Bulk pausing uses
 * one dialog and one reason for the whole selection, because it is one decision;
 * a reason per row would turn the bulk action into a row of dialogs.
 */
export function PauseReasonDialog({
  title,
  onClose,
  onConfirm,
}: {
  title: string
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const t = useT()
  const [reason, setReason] = useState('')
  const valid = reason.trim() !== ''

  const submit = () => {
    if (!valid) return
    onConfirm(reason.trim())
    onClose()
  }

  return (
    <Modal title={title} onClose={onClose} width={440}>
      <div className="space-y-3">
        <Field label={t('task.pauseReason')}>
          <textarea
            autoFocus
            className={`${inputCls} h-20 resize-none py-1.5`}
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
            {t('task.pause')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

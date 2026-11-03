import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useT } from '../lib/useT'

/**
 * Ask for a memo before an action that keeps one — pausing a task, filing it
 * away.
 *
 * Optional on purpose: the reason is the user's note, not a gate. An empty box
 * submits, and the action simply carries no reason. Bulk pausing and bulk
 * archiving use one dialog and one memo for the whole selection, because it is
 * one decision; a memo per row would turn the bulk action into a row of dialogs.
 */
export function ReasonDialog({
  title,
  label,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string
  label: string
  confirmLabel: string
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const t = useT()
  const [reason, setReason] = useState('')

  return (
    <Modal title={title} onClose={onClose} width={440}>
      <div className="space-y-3">
        <Field label={label}>
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
            onClick={() => {
              onConfirm(reason.trim())
              onClose()
            }}
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

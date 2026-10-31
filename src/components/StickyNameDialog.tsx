import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useT } from '../lib/useT'

/**
 * Rename a sticky note. Right-clicking the note's name row (or its collapsed
 * chip) is the way in; the name row itself is the drag handle.
 */
export function StickyNameDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: string
  onSave: (name: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [name, setName] = useState(initial)
  const valid = name.trim() !== ''

  const submit = () => {
    if (!valid) return
    onSave(name.trim().slice(0, 80))
    onClose()
  }

  return (
    <Modal title={t('sticky.rename')} onClose={onClose} width={360}>
      <div className="space-y-3">
        <Field label={t('sticky.name')}>
          <input
            autoFocus
            className={inputCls}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
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
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { LogTextarea } from './LogTextarea'
import { useStore } from '../store/useStore'
import { ItemLog } from '../types'
import { useT } from '../lib/useT'

const areaCls = inputCls.replace('h-8', '')

/**
 * Write today's entry about a routine or a chore.
 *
 * `LogDialog`'s counterpart, and deliberately not the same dialog: what is left
 * out is the whole of the difference. No percentage boxes, because nothing here
 * has a figure to move — a routine log is a sentence about the day, and the app
 * measures none of it. No batch picker and no parent mode, because a routine
 * with children is a heading and a heading keeps no entry of its own (the store
 * refuses one; see `addItemLog`).
 *
 * It opens **empty**, like a task's second entry of the day: what is already
 * written is not shown, because this is not an editor for it — the store joins
 * what is typed onto the same day's entry as a further paragraph. Reading what
 * is there is the day's record, which is one button away on the row's own board.
 *
 * Fixed to today, and there is no date field to say otherwise: the store's
 * action takes no date at all, so "today" is not a default this could get wrong.
 */
export function ItemLogDialog({
  kind,
  ownerId,
  onClose,
}: {
  kind: ItemLog['kind']
  ownerId: string
  onClose: () => void
}) {
  const t = useT()
  const habits = useStore((s) => s.habits)
  const chores = useStore((s) => s.chores)
  const addItemLog = useStore((s) => s.addItemLog)

  const [content, setContent] = useState('')

  // Resolved here rather than passed in, as `LogDialog` does with a task: the
  // id is what the caller has, and a title handed down beside it is a second
  // thing that can be out of date by the time the dialog renders.
  const title =
    kind === 'habit'
      ? habits.find((h) => h.id === ownerId)?.title
      : chores.find((c) => c.id === ownerId)?.title

  // Gone from under the dialog — deleted in another window, or an id that never
  // named anything. The store would refuse the write anyway; this is the same
  // answer without an empty box on screen.
  if (title == null) return null

  const submit = () => {
    addItemLog(kind, ownerId, content)
    onClose()
  }

  return (
    <Modal title={t('log.write')} onClose={onClose} width={520}>
      <div className="space-y-3">
        <div className="text-[13px] font-medium text-fg">{title}</div>

        <Field label={t('log.label')}>
          <LogTextarea
            value={content}
            onChange={setContent}
            className={`${areaCls} h-40 resize-none`}
            placeholder={t('log.contentPlaceholder')}
            autoFocus
          />
          <div className="text-[11px] text-dim mt-1">{t('log.hint')}</div>
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!content.trim()}
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useStore } from '../store/useStore'
import { useT } from '../lib/useT'

const areaCls = inputCls.replace('h-8', '')

/**
 * Write something into a day, without standing in front of everything already
 * written there.
 *
 * Deliberately not the same thing as `NoteBox`'s editor, which opens holding
 * the day's whole text and saves over it. This one opens **empty** and adds what
 * it is given: it is the difference between "the note for this day is now this"
 * and "this goes on the end of the note for this day". Which of the two a user
 * means is not something to guess from where they clicked — so the entries are
 * separate, and each says what it does.
 *
 * The date is asked for rather than assumed. It defaults to the day the entry
 * was reached from, but this is the one writing surface not attached to a
 * particular day's panel, so the day has to be answerable here.
 */
export function NoteDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const t = useT()
  const appendNote = useStore((s) => s.appendNote)

  const [day, setDay] = useState(date)
  const [body, setBody] = useState('')

  const submit = () => {
    if (!body.trim() || !day) return
    appendNote(day, body)
    onClose()
  }

  return (
    <Modal title={t('notes.add')} onClose={onClose} width={520}>
      <div className="space-y-3">
        <Field label={t('common.date')}>
          <input type="date" className={inputCls} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>

        <Field label={t('notes.title')}>
          <textarea
            className={`${areaCls} h-52 resize-none leading-relaxed`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('notes.placeholder')}
            autoFocus
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
            {t('common.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!body.trim() || !day}
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

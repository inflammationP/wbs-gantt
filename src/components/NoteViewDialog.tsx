import { Modal } from './ui'
import { NoteCard } from './NoteCard'
import { useStore } from '../store/useStore'
import { toDate } from '../lib/dates'
import { formatLongDate } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'

/**
 * A day's notebook, at reading width.
 *
 * The day panel is 320px and the Today page's columns are narrower still, which
 * is enough to see that something is written and not much of a place to read it.
 * This is the same text in the same card, in a panel wide enough to take a
 * paragraph — no editing, no controls, just the thing itself.
 */
export function NoteViewDialog({ day, onClose }: { day: string; onClose: () => void }) {
  const t = useT()
  const lang = useLang()
  const note = useStore((s) => s.notes.find((n) => n.date === day) ?? null)

  return (
    <Modal title={formatLongDate(lang, toDate(day))} onClose={onClose} width={620}>
      <div className="text-[13px] font-semibold text-fg mb-2">{t('notes.title')}</div>
      <NoteCard body={note?.body ?? null} stamps={note?.stamps} />
    </Modal>
  )
}

import { Modal } from './ui'
import { parseEmphasis } from '../lib/emphasis'
import { useT } from '../lib/useT'
import type { Dict } from '../lib/i18n'

const PARAGRAPHS: (keyof Dict)[] = ['optOut.p1', 'optOut.p2', 'optOut.p3']

/**
 * The price of turning a task's logs off, said out loud before the flag moves.
 *
 * Its own dialog rather than a `useDialogs().ask`, which is one sentence and two
 * generic buttons: this one has three paragraphs, its own button wording, and a
 * recommended answer — the whole point is that the way back is the easy one, so
 * `Back` carries the accent and takes focus while the confirmation sits off to
 * the side, plain.
 *
 * The wording is the user's, and it is written in the emphasis markup
 * `lib/emphasis.ts` parses: he wrote the copy that way and goes on editing it
 * there, so the dictionary keeps the marks rather than rebuilding the emphasis
 * out of JSX. Closing the dialog — the backdrop, the X — is `onBack`: walking
 * away from a warning must never be what accepts it.
 */
export function LogOptOutDialog({ onBack, onConfirm }: { onBack: () => void; onConfirm: () => void }) {
  const t = useT()
  return (
    <Modal title={t('optOut.title')} onClose={onBack} width={440}>
      <div className="space-y-3">
        {PARAGRAPHS.map((key) => (
          <p key={key} className="text-[12px] leading-5 text-muted">
            {parseEmphasis(t(key)).map((r, i) => (
              <span key={i} className={r.bold ? 'font-semibold' : undefined} style={r.scale > 1 ? { fontSize: `${r.scale}em` } : undefined}>
                {r.text}
              </span>
            ))}
          </p>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onConfirm} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
          {t('optOut.confirm')}
        </button>
        <button onClick={onBack} autoFocus className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px]">
          {t('optOut.back')}
        </button>
      </div>
    </Modal>
  )
}

import { NoteBody } from './LogLines'
import { useT } from '../lib/useT'

import { Stamp } from '../types'

/**
 * How a note reads: a card with a rounded edge, the same shape a log is drawn
 * in (see `DayLogsModal`).
 *
 * One component because it is one answer. Bare text in a panel reads as
 * placeholder — there is nothing to say where the notebook begins or that it
 * has any substance — and two copies of this markup would be two chances for
 * the inline one and the modal one to come apart.
 *
 * Its own file rather than an export of `NoteBox.tsx`, which the view dialog
 * needs: reaching back the other way would make the two modules import each
 * other, which works until someone reads the binding at module scope.
 */
export function NoteCard({ body, stamps }: { body: string | null; stamps?: Stamp[] }) {
  const t = useT()
  if (!body) {
    // Nothing to frame, so nothing is drawn: an empty box is a container with a
    // border and a word in it, which reads as a control that failed.
    return <div className="py-0.5 text-[12px] text-dim">{t('notes.none')}</div>
  }
  return (
    // A paragraph at a time, under the readings that stamp them — the same
    // drawing a log gets, with the bullets left off because this is prose. The
    // readings are the note's own, so the box the writing happens in shows the
    // writing and nothing else.
    <div className="border border-border rounded-lg p-3 text-[12px] leading-relaxed text-muted">
      <NoteBody body={body} stamps={stamps} />
    </div>
  )
}

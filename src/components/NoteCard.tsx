import { useT } from '../lib/useT'

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
export function NoteCard({ body }: { body: string | null }) {
  const t = useT()
  if (!body) {
    // Nothing to frame, so nothing is drawn: an empty box is a container with a
    // border and a word in it, which reads as a control that failed.
    return <div className="py-0.5 text-[12px] text-dim">{t('notes.none')}</div>
  }
  return (
    // `whitespace-pre-wrap` because the newlines are the user's, and the only
    // structure this text has.
    <div className="border border-border rounded-lg p-3 text-[12px] leading-relaxed text-muted whitespace-pre-wrap break-words">
      {body}
    </div>
  )
}

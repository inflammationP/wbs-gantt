import { useState } from 'react'
import { useStore } from '../store/useStore'
import { inputCls } from './ui'
import { NoteCard } from './NoteCard'
import { NoteViewDialog } from './NoteViewDialog'
import { useT } from '../lib/useT'

// `inputCls` is a one-line input and a textarea has to say its own height;
// outweighing it does not work, because both rules land in one layer and
// Tailwind emits them in *name* order, where `h-56` comes before `h-8`.
const areaCls = inputCls.replace('h-8', '')
// The date sits in the editor's toolbar rather than above it in a `Field`, so it
// wants the input tokens without the full-width box and its 10px caption.
const dateCls = inputCls.replace('w-full h-8', 'h-7')

/**
 * A day's notebook. Read by default, edited on request, saved on a button.
 *
 * Three states, and the middle one is the point: a box that is *always* a
 * textarea — which this was — reads as unsaved work every time you glance at
 * it, and there is no moment that says the writing was kept. Here the text is
 * shown, Edit opens the editor, and Save is what ends it. Cancel is real: the
 * draft is local, so backing out costs nothing.
 *
 * **Controlled from outside.** `editing` and `onDone` are the caller's, because
 * the Edit button belongs in the section's heading — one row with the title,
 * not an affordance floating over the text — and the heading is drawn by
 * whoever owns the frame. Each caller supplies the row and the button; this
 * component supplies the box under it.
 *
 * The date is editable, and changing it **moves** the note. A note is filed
 * under a day and has no identity of its own, so "the same note, on another
 * day" can only mean clearing the old day and writing the new one. When the new
 * day already has writing the two are joined rather than the older text being
 * overwritten — moving onto an occupied day is rare, and it is the one outcome
 * with no way back.
 */
/**
 * View and Edit, as two buttons at the end of the notebook's heading — reading
 * before changing, which is the order the two are reached for in.
 *
 * Handed over as one node rather than two, because both callers draw the same
 * pair in the same row and the View half owns a modal — a caller that had to
 * place them itself would also have to own that modal's state, in two places.
 * The caller keeps only `editing`, which is the half its own box needs.
 */
export function NoteActions({ day, editing, onEdit }: { day: string; editing: boolean; onEdit: () => void }) {
  const t = useT()
  const [viewing, setViewing] = useState(false)
  const cls = 'h-6 px-2 text-[10px] text-muted hover:text-fg border border-border rounded-[3px]'

  return (
    <>
      <button onClick={() => setViewing(true)} className={cls}>
        {t('common.view')}
      </button>
      {/* Hidden while the editor is open — it has its own Save and Cancel, and
          a second Edit beside them would be a button that does nothing. */}
      {!editing && (
        <button onClick={onEdit} className={cls}>
          {t('common.edit')}
        </button>
      )}
      {viewing && <NoteViewDialog day={day} onClose={() => setViewing(false)} />}
    </>
  )
}

export function NoteBox({
  day,
  editing,
  onDone,
  rows,
}: {
  day: string
  editing: boolean
  onDone: () => void
  rows?: number
}) {
  // Remounted whenever the day or the editing state moves, so the draft is
  // seeded from the props on each of those instead of being watched for. Both
  // halves matter: an editor left open across a day change would still hold the
  // old day's text and would clear the day it *came from* on save, and an editor
  // opened later than mount would find no draft to type into.
  return <NoteEditor key={`${day}|${editing}`} day={day} editing={editing} onDone={onDone} rows={rows} />
}

function NoteEditor({
  day,
  editing,
  onDone,
  rows = 6,
}: {
  day: string
  editing: boolean
  onDone: () => void
  rows?: number
}) {
  const t = useT()
  const notes = useStore((s) => s.notes)
  const setNote = useStore((s) => s.setNote)
  const appendNote = useStore((s) => s.appendNote)

  const stored = notes.find((n) => n.date === day) ?? null
  const [draft, setDraft] = useState<{ date: string; body: string } | null>(() =>
    editing ? { date: day, body: stored?.body ?? '' } : null,
  )

  const save = () => {
    if (!draft) return
    if (draft.date === day) {
      setNote(day, draft.body)
    } else {
      setNote(day, '')
      // `notes` is the state as of this render, which is the one the box was
      // drawn from — no write has happened since, because both writes are here.
      if (draft.body.trim() && notes.some((n) => n.date === draft.date)) appendNote(draft.date, draft.body)
      else setNote(draft.date, draft.body)
    }
    onDone()
  }

  if (!draft) {
    // The empty state says "none", not "write here": the invitation is the Edit
    // button in the heading above, and two ways of saying the same thing is one
    // too many.
    return <NoteCard body={stored?.body ?? null} />
  }

  return (
    <div className="space-y-1.5 pb-1">
      <textarea
        className={`${areaCls} resize-none leading-relaxed`}
        rows={rows}
        value={draft.body}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        placeholder={t('notes.placeholder')}
        autoFocus
      />
      {/* The day and the two decisions on one line under the box, rather than a
          labelled field above it: the date is only ever the answer to "which day
          does this belong to", and that question comes after the writing, not
          before it. */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          className={dateCls}
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          title={t('common.date')}
          aria-label={t('common.date')}
        />
        <div className="flex-1" />
        <button
          onClick={onDone}
          className="h-7 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={save}
          disabled={!draft.date}
          className="h-7 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]"
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}

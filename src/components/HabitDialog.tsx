import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Habit } from '../types'
import { ALL_DAYS, pausePatch } from '../lib/habits'
import { weekdayLabels } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { todayISO } from '../lib/dates'
import { Field, Modal, inputCls } from './ui'

/**
 * The daily-item editor, used by both the Today column and the Manage page.
 *
 * One dialog for creating and for editing rather than two, because every field
 * but the pause switch means the same thing either way — the only difference is
 * that a habit which does not exist yet has nothing to suspend, and no delete
 * button to press. A pair of dialogs would be two answers to "what is a daily
 * item made of", and the second one drifts the first time a field is added.
 *
 * Deleting is the caller's, not this component's. A confirm has to outlive the
 * dialog it was opened from — the dialog closes, the question appears, and the
 * work happens on confirm — and a `useDialogs` owned here would be unmounted
 * along with the modal. So the parent holds the question and passes the answer
 * back down as `onDelete`. See `HabitRow` in `DayBoard.tsx` and `HabitListRow`
 * in `ManagePage.tsx`.
 */
export function HabitDialog({
  habit,
  onDelete,
  onClose,
}: {
  /** Absent means creating. */
  habit?: Habit
  /** Absent means no delete button — which is the case when creating. */
  onDelete?: () => void
  onClose: () => void
}) {
  const t = useT()
  const lang = useLang()
  const addHabit = useStore((s) => s.addHabit)
  const updateHabit = useStore((s) => s.updateHabit)

  const [title, setTitle] = useState(habit?.title ?? '')
  const [note, setNote] = useState(habit?.note ?? '')
  const [weekdays, setWeekdays] = useState<number[]>(habit?.weekdays ?? [...ALL_DAYS])
  // `''` rather than `null` throughout, because that is what an empty
  // `<input type="date">` reads and writes. It is turned back into `null` on the
  // way out, which is the shape the data actually wants.
  const [endDate, setEndDate] = useState(habit?.endDate ?? '')
  const [paused, setPaused] = useState(habit?.paused ?? false)

  const labels = weekdayLabels(lang)

  // At least one day always stays on. Every day off is not a habit that never
  // runs — it is someone who has not finished thinking, and the state it would
  // leave behind is one nothing downstream can make sense of.
  const toggleDay = (i: number) =>
    setWeekdays((days) => (days.includes(i) ? days.length > 1 ? days.filter((d) => d !== i) : days : [...days, i].sort((a, b) => a - b)))

  const valid = title.trim().length > 0

  const save = () => {
    if (!valid) return
    const values = { title: title.trim(), note, weekdays, endDate: endDate || null }
    if (habit) {
      // The pause switch rides along as a patch rather than acting when it is
      // flipped, so that Cancel really does cancel — see `pausePatch`.
      updateHabit(habit.id, { ...values, ...pausePatch(habit, paused, todayISO()) })
    } else {
      addHabit(values.title, values)
    }
    onClose()
  }

  return (
    <Modal title={habit ? t('habit.edit') : t('habit.new')} onClose={onClose} width={440}>
      <div className="space-y-3">
        <Field label={t('habit.title')}>
          <input
            autoFocus
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
          />
        </Field>

        <Field label={t('habit.note')}>
          <input
            className={inputCls}
            value={note}
            placeholder={t('habit.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {/* Seven buttons rather than a component. The app has no multi-select
            anywhere — tags are a comma-separated string and dependencies have no
            UI at all — so this is the first, and seven of them is less code than
            a component built for one caller. Styled after `Segmented`, which is
            the app's only existing "pick one of a few" control. */}
        <Field label={t('habit.weekdays')}>
          <div className="flex items-center gap-1">
            {labels.map((label, i) => {
              const on = weekdays.includes(i)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  aria-pressed={on}
                  className={`flex-1 h-7 text-[11px] font-medium rounded-[3px] border transition-colors ${
                    on
                      ? 'bg-accent/15 text-accent border-accent/40'
                      : 'bg-panel2 text-muted border-border hover:text-fg'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="text-[11px] text-dim mt-1">
            {weekdays.length === ALL_DAYS.length ? t('habit.everyDay') : ''}
          </div>
        </Field>

        <Field label={t('habit.endDate')}>
          <input
            type="date"
            className={inputCls}
            value={endDate}
            min={habit?.startDate ?? todayISO()}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <div className="text-[11px] text-dim mt-1">{t('habit.noEndDate')}</div>
        </Field>

        {/* Only on an existing habit: there is nothing to suspend about one that
            has not been created, and offering the switch would imply the thing
            to be made is itself already off. */}
        {habit && (
          <label className="flex items-center gap-2 text-[12px] text-fg/90 cursor-pointer">
            <input
              type="checkbox"
              className="accent-accent"
              checked={paused}
              onChange={(e) => setPaused(e.target.checked)}
            />
            {t('habit.paused')}
          </label>
        )}

        <div className="flex items-center gap-2 pt-1">
          {onDelete && (
            <button
              onClick={onDelete}
              className="mr-auto h-8 px-3 text-[12px] text-delayed hover:text-fg border border-border rounded-[3px]"
            >
              {t('common.delete')}
            </button>
          )}
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
            {t('common.cancel')}
          </button>
          <button
            onClick={save}
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

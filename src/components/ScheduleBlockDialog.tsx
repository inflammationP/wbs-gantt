import { useState } from 'react'
import { Modal, Field, Segmented, softInputCls } from './ui'
import { useStore } from '../store/useStore'
import { ScheduleBlock } from '../types'
import { isArchived } from '../lib/tree'
import { isHHMM, minutesOf, toHHMM } from '../lib/schedule'
import { toDate } from '../lib/dates'
import { formatDayMonthYear } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'

type Kind = 'task' | 'event' | 'deadline'

/** A routine or chore a block is being made for, from the day's work strip. */
export interface ScheduleItem {
  kind: 'habit' | 'chore'
  id: string
  title: string
}

export type ScheduleDraft =
  /**
   * `end` is given when the new block came from a drag across several slots.
   * `taskId` / `item` are given when it came from the day's "to schedule" strip:
   * the link is what keeps the strip from offering the same work twice.
   */
  | { kind: 'new'; date: string; start: string; end?: string; taskId?: string; item?: ScheduleItem }
  | { kind: 'edit'; block: ScheduleBlock }

/**
 * One timetable block.
 *
 * The date is not a field: a block belongs to the column it was clicked in.
 * Moving one means deleting it and drawing another, which is the same gesture
 * the grid already offers. That keeps the block's identity simple and means a
 * block can never be moved somewhere the current view cannot show it.
 */
export function ScheduleBlockDialog({
  draft,
  onClose,
}: {
  draft: ScheduleDraft
  onClose: () => void
}) {
  const t = useT()
  const lang = useLang()
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const addScheduleBlock = useStore((s) => s.addScheduleBlock)
  const updateScheduleBlock = useStore((s) => s.updateScheduleBlock)
  const deleteScheduleBlock = useStore((s) => s.deleteScheduleBlock)

  const existing = draft.kind === 'edit' ? draft.block : null
  const date = draft.kind === 'edit' ? draft.block.date : draft.date
  const firstStart = draft.kind === 'edit' ? draft.block.start : draft.start

  // A block made from the day's work keeps its link, so the strip knows the
  // item has been given a time. It shows as one read-only line instead of the
  // kind picker: the kind is already decided by where it came from.
  const item = draft.kind === 'new' ? draft.item : undefined
  const linkedKind = existing?.habitId ? 'habit' : existing?.choreId ? 'chore' : null
  const linkedId = existing?.habitId ?? existing?.choreId ?? null
  const linkedItem = item ?? (linkedKind && linkedId
    ? { kind: linkedKind, id: linkedId, title: existing?.title ?? '' }
    : null)
  const draftTask = draft.kind === 'new' && draft.taskId
    ? tasks.find((task) => task.id === draft.taskId)
    : undefined

  const initialKind: Kind = existing
    ? (existing.deadline ? 'deadline' : existing.taskId ? 'task' : 'event')
    : linkedItem ? 'event' : 'task'
  const [kind, setKind] = useState<Kind>(initialKind)
  const [taskId, setTaskId] = useState(existing?.taskId ?? draftTask?.id ?? '')
  const [title, setTitle] = useState(existing?.title ?? item?.title ?? draftTask?.name ?? '')
  const [start, setStart] = useState(firstStart)
  const [end, setEnd] = useState(
    existing && !existing.deadline
      ? existing.end
      : (draft.kind === 'new' ? draft.end : undefined) ??
          toHHMM(Math.min(24 * 60 - 1, (minutesOf(firstStart) ?? 9 * 60) + 60)),
  )

  const live = tasks.filter((task) => !task.isTodo && !isArchived(task))
  const linked = taskId ? tasks.find((task) => task.id === taskId) : undefined
  const linkedMissing = taskId !== '' && !live.some((task) => task.id === taskId)

  const nameValid = linkedItem
    ? true
    : kind === 'task' ? taskId !== '' : kind === 'event' ? title.trim() !== '' : title.trim() !== '' || taskId !== ''
  const timesValid =
    isHHMM(start) && (kind === 'deadline' || (isHHMM(end) && (minutesOf(end) ?? 0) > (minutesOf(start) ?? 0)))
  const error = !timesValid
    ? t('schedule.invalidTime')
    : !nameValid
      ? t('schedule.invalidName')
      : null

  const changeKind = (next: Kind) => {
    setKind(next)
    // The selected task is deliberately kept when switching away and back: it
    // is the form's memory, not a link on screen. `save` decides whether it is
    // written, so an event still saves without one. Clearing it here is what
    // made switching to Event and back to Task leave a task kind with no task,
    // which no amount of typing in the title could satisfy.
    if (next !== 'deadline' && (minutesOf(end) ?? 0) <= (minutesOf(start) ?? 0)) {
      setEnd(toHHMM(Math.min(24 * 60 - 1, (minutesOf(start) ?? 9 * 60) + 60)))
    }
  }

  const pickTask = (id: string) => {
    const previous = taskId ? tasks.find((task) => task.id === taskId)?.name : undefined
    setTaskId(id)
    const next = tasks.find((task) => task.id === id)
    // A title the user typed is theirs; an empty one, or the old task's name,
    // follows the task.
    if (next && (title.trim() === '' || title === previous)) setTitle(next.name)
  }

  const save = () => {
    if (error) return
    const task = taskId ? tasks.find((x) => x.id === taskId) : undefined
    const snapshot = title.trim() || task?.name || ''
    const input = {
      date,
      start,
      end: kind === 'deadline' ? start : end,
      // A linked block keeps the item's name; a free one keeps what the user
      // typed, or the task's name when the box was left empty.
      title: linkedItem ? linkedItem.title : snapshot,
      // Explicit `undefined`/`false` so an edit *clears* a link or a deadline
      // rather than leaving the old value behind the merge in the store.
      // A free event has no task link, whatever the picker remembers; the
      // remembered id comes back if the kind is switched to Task again.
      taskId: linkedItem || kind === 'event' ? undefined : taskId || undefined,
      habitId: linkedItem?.kind === 'habit' ? linkedItem.id : undefined,
      choreId: linkedItem?.kind === 'chore' ? linkedItem.id : undefined,
      deadline: kind === 'deadline',
    }
    if (existing) {
      const { date: _date, ...patch } = input
      updateScheduleBlock(existing.id, patch)
    } else {
      addScheduleBlock(input)
    }
    onClose()
  }

  return (
    <Modal
      soft
      title={t(existing ? 'schedule.editTitle' : 'schedule.addTitle')}
      onClose={onClose}
      width={440}
    >
      <div className="space-y-3">
        <div className="inline-flex items-center rounded-full bg-panel2/40 px-3 py-1 text-[11px] text-dim">
          {formatDayMonthYear(lang, toDate(date))}
        </div>

        {linkedItem ? (
          // The kind came from the row it was started on, so asking again would
          // only offer ways to contradict it. The name is the item's own.
          <Field label={t('schedule.name')}>
            <div className={`${softInputCls} flex items-center gap-2`}>
              <span className="shrink-0 text-[11px] text-dim">
                {t(linkedItem.kind === 'habit' ? 'habit.section' : 'chore.section')}
              </span>
              <span className="min-w-0 truncate text-fg/90">{linkedItem.title}</span>
            </div>
          </Field>
        ) : (
          <>
            <Field label={t('schedule.kind')}>
              <Segmented<Kind>
                pill
                value={kind}
                onChange={changeKind}
                options={[
                  { value: 'task', label: t('schedule.kind.task') },
                  { value: 'event', label: t('schedule.kind.event') },
                  { value: 'deadline', label: t('schedule.kind.deadline') },
                ]}
              />
            </Field>

            {kind !== 'event' && (
              <Field label={t('schedule.task')}>
                <select className={softInputCls} value={taskId} onChange={(e) => pickTask(e.target.value)} autoFocus>
                  <option value="">{t('schedule.noTask')}</option>
                  {linkedMissing && linked && <option value={linked.id} disabled>{linked.name}</option>}
                  {projects.map((project) => {
                    const list = live.filter((task) => task.projectId === project.id)
                    if (list.length === 0) return null
                    return (
                      <optgroup key={project.id} label={project.name}>
                        {list.map((task) => (
                          <option key={task.id} value={task.id}>{task.name}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </Field>
            )}

            <Field label={t('schedule.name')}>
              <input
                className={softInputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={linked?.name ?? t('schedule.name')}
                autoFocus={kind === 'event'}
              />
            </Field>
          </>
        )}

        <div className={`grid ${kind === 'deadline' ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
          <Field label={t('schedule.start')}>
            <input type="time" className={softInputCls} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          {kind !== 'deadline' && (
            <Field label={t('schedule.end')}>
              <input type="time" className={softInputCls} value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          )}
        </div>

        {error && <div className="pl-1 text-[11px] text-delayed">{error}</div>}

        <div className="flex items-center gap-2 pt-1">
          {existing && (
            <button
              onClick={() => {
                deleteScheduleBlock(existing.id)
                onClose()
              }}
              className="h-8 px-3.5 text-[12px] text-muted hover:text-fg border border-border/70 rounded-full"
            >
              {t('common.delete')}
            </button>
          )}
          <span className="mr-auto" />
          <button onClick={onClose} className="h-8 px-3.5 text-[12px] text-muted hover:text-fg border border-border/70 rounded-full">
            {t('common.cancel')}
          </button>
          <button
            onClick={save}
            disabled={!!error}
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-full"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

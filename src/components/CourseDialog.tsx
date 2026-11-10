import { useState } from 'react'
import { useStore } from '../store/useStore'
import { CourseSession } from '../types'
import { isHHMM, minutesOf } from '../lib/schedule'
import { useT } from '../lib/useT'
import { Field, Modal, softInputCls } from './ui'

/**
 * One imported class, opened from the timetable's right-click menu.
 *
 * A course is stored per week, so this edits that week's occurrence only; the
 * other weeks keep the times the import read.
 */
export function CourseDialog({ course, onClose }: { course: CourseSession; onClose: () => void }) {
  const t = useT()
  const updateCourse = useStore((s) => s.updateCourse)
  const [title, setTitle] = useState(course.title)
  const [location, setLocation] = useState(course.location)
  const [start, setStart] = useState(course.start)
  const [end, setEnd] = useState(course.end)

  const timesValid =
    isHHMM(start) && isHHMM(end) && (minutesOf(end) ?? 0) > (minutesOf(start) ?? 0)
  const error = !timesValid
    ? t('schedule.invalidTime')
    : title.trim()
      ? null
      : t('schedule.invalidName')

  const save = () => {
    if (error) return
    updateCourse(course, { title: title.trim(), location: location.trim(), start, end })
    onClose()
  }

  return (
    <Modal soft title={t('course.edit')} onClose={onClose} width={420}>
      <div className="space-y-3">
        <Field label={t('schedule.name')}>
          <input
            className={softInputCls}
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            autoFocus
          />
        </Field>
        <Field label={t('course.location')}>
          <input
            className={softInputCls}
            value={location}
            onChange={(e) => setLocation(e.currentTarget.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('schedule.start')}>
            <input
              type="time"
              className={softInputCls}
              value={start}
              onChange={(e) => setStart(e.currentTarget.value)}
            />
          </Field>
          <Field label={t('schedule.end')}>
            <input
              type="time"
              className={softInputCls}
              value={end}
              onChange={(e) => setEnd(e.currentTarget.value)}
            />
          </Field>
        </div>
        {error && <div className="pl-1 text-[11px] text-delayed">{error}</div>}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="h-8 px-3.5 text-[12px] text-muted hover:text-fg border border-border/70 rounded-full"
          >
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

import { useMemo, useState } from 'react'
import { Modal } from './ui'
import { useStore } from '../store/useStore'
import { DayPlan, Task, TaskStatus } from '../types'
import { DayRow, dayStates, daySummary } from '../lib/dayTasks'
import { isArchived } from '../lib/tree'
import { capacityOf, dayLoad, planOn } from '../lib/schedule'
import { STATUS_META, sig } from '../lib/ui'
import { toDate } from '../lib/dates'
import { formatDayMonthYear } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { LoadMeter } from './LoadMeter'

interface Candidate {
  id: string
  name: string
  projectId: string
  progress: number | null
  status: TaskStatus
  strict: boolean
  /** In the plan but no longer part of the day's automatic list. */
  stale?: boolean
}

/**
 * Choose the day's work, and how long each piece of it is expected to take.
 *
 * The candidate list is the old automatic list (everything the day would have
 * asked for), with the day's current plan ticked. With no plan yet everything
 * starts ticked: the selection is a narrowing of the old list, not a blank
 * form, which is how "I will do four of these eight" stays one gesture.
 *
 * The hours box is what makes the load meter answer the checkbox. A task's
 * hours are per day; ticking "default" remembers the value for the next time
 * the task is planned, and the field can still be changed then.
 *
 * Saving zero is a real answer — a rest day — and is kept apart from "restore
 * the automatic rules", which removes the plan entirely. `prompt` is the
 * start-of-day variant: it asks the free-hours question, offers "later"
 * instead of a cancel, and starts the day on save.
 */
export function PlanDialog({
  day,
  onClose,
  prompt = false,
}: {
  day: string
  onClose: () => void
  /** The start-of-day prompt rather than the Today page's adjust dialog. */
  prompt?: boolean
}) {
  const t = useT()
  const lang = useLang()
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const projects = useStore((s) => s.projects)
  const today = useStore((s) => s.today)
  const daySort = useStore((s) => s.daySort)
  const dayPlans = useStore((s) => s.dayPlans)
  const scheduleBlocks = useStore((s) => s.scheduleBlocks)
  const defaultHours = useStore((s) => s.taskDefaultHours)
  const setDayPlan = useStore((s) => s.setDayPlan)
  const setDayCapacity = useStore((s) => s.setDayCapacity)
  const setTaskDefaultHours = useStore((s) => s.setTaskDefaultHours)
  const openToday = useStore((s) => s.openToday)

  const plan = planOn(dayPlans, day)

  const rows = useMemo(() => {
    const summary = daySummary(tasks, logs, projects, day, today, daySort)
    const planned = new Set(plan?.taskIds ?? [])
    // A completed task is not something to plan for, unless it is already in
    // the plan — then it stays visible so it can be taken out.
    const base: Candidate[] = summary.all
      .filter((r) => r.status !== 'completed' || planned.has(r.task.id))
      .map((r: DayRow) => ({
        id: r.task.id,
        name: r.task.name,
        projectId: r.task.projectId,
        progress: r.progress,
        status: r.status,
        strict: r.strict,
      }))
    const shown = new Set(base.map((r) => r.id))
    // Keep a planned task visible even after its window changed or it became a
    // parent: without this a stale commitment could not be unchecked.
    const states = dayStates(tasks, logs, day)
    for (const id of plan?.taskIds ?? []) {
      if (shown.has(id)) continue
      const task: Task | undefined = tasks.find((x) => x.id === id)
      if (!task || task.isTodo || isArchived(task)) continue
      const state = states.get(id)
      base.push({
        id,
        name: task.name,
        projectId: task.projectId,
        progress: state?.progress ?? null,
        status: state?.status ?? 'not-started',
        strict: false,
        stale: true,
      })
      shown.add(id)
    }
    return base
  }, [tasks, logs, projects, day, today, daySort, plan?.taskIds])

  const [selected, setSelected] = useState<Set<string>>(() => {
    const existing = plan?.taskIds
    return new Set(
      existing === undefined
        ? rows.map((r) => r.id)
        : existing.filter((id) => rows.some((r) => r.id === id)),
    )
  })

  // The day's hours win over the remembered default; anything unset stays empty,
  // which the load reads as zero.
  const [hours, setHours] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const row of rows) {
      const value = plan?.hours?.[row.id] ?? defaultHours[row.id]
      if (value !== undefined) out[row.id] = value
    }
    return out
  })

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const setHour = (id: string, raw: string) =>
    setHours((h) => {
      const next = { ...h }
      const value = Number(raw)
      if (raw.trim() !== '' && Number.isFinite(value) && value > 0) next[id] = Math.min(24, value)
      else delete next[id]
      return next
    })

  const isDefault = (id: string) => hours[id] !== undefined && defaultHours[id] === hours[id]

  const toggleDefault = (id: string) => {
    if (isDefault(id)) setTaskDefaultHours(id, null)
    else if (hours[id] !== undefined) setTaskDefaultHours(id, hours[id])
  }

  const pickedIds = rows.filter((r) => selected.has(r.id)).map((r) => r.id)
  const pickedHours: Record<string, number> = {}
  for (const id of pickedIds) if (hours[id] !== undefined) pickedHours[id] = hours[id]

  // The meter follows the form, not the saved plan: checking a box or typing a
  // number has to move the bar before anything is written.
  const draft: DayPlan = { date: day, taskIds: pickedIds, capacityHours: capacityOf(plan), hours: pickedHours }
  const load = dayLoad(draft, scheduleBlocks, day)

  const save = () => {
    setDayPlan(day, pickedIds, pickedHours)
    if (prompt) openToday()
    onClose()
  }

  const projectOf = (id: string) => projects.find((p) => p.id === id)

  return (
    <Modal
      soft
      title={prompt ? t('plan.promptTitle') : t('plan.title', { date: formatDayMonthYear(lang, toDate(day)) })}
      onClose={onClose}
      width={520}
    >
      <div className="space-y-3">
        <div className="rounded-xl bg-panel2/40 p-3">
          {prompt && <div className="mb-1.5 text-[12px] font-medium text-fg">{t('plan.freeTime')}</div>}
          <LoadMeter
            used={load.used}
            capacity={load.capacity}
            onCapacity={prompt ? (value) => setDayCapacity(day, value) : undefined}
          />
        </div>
        <div className="text-[11px] text-dim">{t('plan.selectTasks')}</div>

        <div className="max-h-[46vh] overflow-auto rounded-2xl border border-border/70 bg-panel2/25 p-1">
          {rows.length === 0 ? (
            <div className="px-2.5 py-3 text-[12px] text-dim">{t('plan.noCandidates')}</div>
          ) : (
            rows.map((r) => {
              const project = projectOf(r.projectId)
              const meta = STATUS_META[r.status]
              const checked = selected.has(r.id)
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-2.5 h-9 px-2.5 rounded-xl ${
                    checked ? 'bg-panel2/40' : ''
                  } hover:bg-panel2/70`}
                >
                  <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.id)}
                      className="accent-accent"
                    />
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sig(meta.token) }} />
                    {project && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: project.color }} />}
                    <span className={`flex-1 min-w-0 truncate text-[12px] ${r.status === 'completed' ? 'line-through text-dim' : 'text-fg/90'}`}>
                      {r.name}
                    </span>
                    {r.strict && <span className="shrink-0 text-[11px] text-today">*</span>}
                    {r.stale && <span className="shrink-0 text-[10px] text-dim">{t('plan.notScheduled')}</span>}
                  </label>
                  {checked && (
                    <>
                      <label
                        className="inline-flex items-center gap-1 shrink-0 text-[10px] text-dim cursor-pointer"
                        title={t('plan.setDefault')}
                      >
                        <input
                          type="checkbox"
                          checked={isDefault(r.id)}
                          disabled={hours[r.id] === undefined}
                          onChange={() => toggleDefault(r.id)}
                          className="accent-accent"
                        />
                        {t('plan.default')}
                      </label>
                      <span className="inline-flex items-center gap-0.5 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          value={hours[r.id] ?? ''}
                          onChange={(e) => setHour(r.id, e.currentTarget.value)}
                          placeholder="0"
                          aria-label={t('plan.hours')}
                          title={t('plan.hours')}
                          className="w-12 h-7 rounded-lg bg-panel2/60 border border-border px-1 text-right font-mono text-[11px] text-fg outline-none focus:border-accent/70"
                        />
                        <span className="text-[10px] text-dim">h</span>
                      </span>
                    </>
                  )}
                  {r.progress != null && <span className="shrink-0 font-mono text-[10px] text-dim">{r.progress}%</span>}
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="mr-auto text-[11px] text-dim">{t('plan.selected', { count: selected.size })}</span>
          {prompt ? (
            <>
              <button
                onClick={onClose}
                className="h-8 px-3.5 text-[12px] text-muted hover:text-fg border border-border/70 rounded-full"
              >
                {t('plan.later')}
              </button>
              <button onClick={save} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-full">
                {t('plan.startToday')}
              </button>
            </>
          ) : (
            <>
              {plan?.taskIds !== undefined && (
                <button
                  onClick={() => {
                    setDayPlan(day, null)
                    onClose()
                  }}
                  className="h-8 px-3 text-[11px] text-muted hover:text-fg border border-border/70 rounded-full"
                >
                  {t('plan.restoreAuto')}
                </button>
              )}
              <button
                onClick={() => {
                  setDayPlan(day, [])
                  onClose()
                }}
                className="h-8 px-3 text-[11px] text-muted hover:text-fg border border-border/70 rounded-full"
              >
                {t('plan.restDay')}
              </button>
              <button onClick={onClose} className="h-8 px-3.5 text-[12px] text-muted hover:text-fg border border-border/70 rounded-full">
                {t('common.cancel')}
              </button>
              <button onClick={save} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-full">
                {t('plan.save')}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

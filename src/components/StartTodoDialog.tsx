import { useMemo, useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useStore } from '../store/useStore'
import { Task, TaskPriority } from '../types'
import { PRIORITY_META, PRIORITY_ORDER, sig } from '../lib/ui'
import { todayISO } from '../lib/dates'
import { useT, useTRich } from '../lib/useT'

interface Form {
  startDate: string
  endDate: string
  strictProgress: boolean
  priority: TaskPriority
}

interface Props {
  taskIds: string[]
  onClose: () => void
}

// Gives one or more to-dos a schedule again. Deliberately separate from the
// pause/resume flow, which is about interrupting scheduled work — this is about
// deciding when unscheduled work happens, and the two have nothing in common
// beyond a button.
//
// Each task gets its own tab and its own values, so restoring a whole folder
// doesn't force every task onto the same dates.
export function StartTodoDialog({ taskIds, onClose }: Props) {
  const t = useT()
  const tr = useTRich()
  const tasks = useStore((s) => s.tasks)
  const startTodoTasks = useStore((s) => s.startTodoTasks)

  const targets = useMemo(
    () => taskIds.map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => !!t && t.isTodo),
    [taskIds, tasks],
  )

  const [forms, setForms] = useState<Record<string, Form>>(() =>
    Object.fromEntries(
      targets.map((t) => [
        t.id,
        { startDate: todayISO(), endDate: todayISO(), strictProgress: false, priority: 'medium' as TaskPriority },
      ]),
    ),
  )
  const [activeId, setActiveId] = useState(() => targets[0]?.id ?? '')
  // Tabs the user has moved past with "Next", so it's clear which ones are done.
  const [visited, setVisited] = useState<Set<string>>(new Set())

  const active = targets.find((t) => t.id === activeId) ?? targets[0]

  if (!active) return null

  const idx = targets.findIndex((t) => t.id === active.id)
  const isLast = idx === targets.length - 1
  const form = forms[active.id]
  const activeHasKids = tasks.some((t) => t.parentId === active.id)
  const set = (patch: Partial<Form>) => setForms((f) => ({ ...f, [active.id]: { ...f[active.id], ...patch } }))

  // "Next" walks the tabs one at a time; only the last one commits them all.
  const goNext = () => {
    if (isLast) return
    setVisited((s) => new Set(s).add(active.id))
    setActiveId(targets[idx + 1].id)
  }

  const submit = () => {
    startTodoTasks(
      targets.map((t) => {
        const f = forms[t.id]
        // A parent's dates are derived from its children, so there is nothing
        // to ask for — it gets a placeholder day until they are restored too.
        if (tasks.some((x) => x.parentId === t.id)) {
          return { id: t.id, startDate: todayISO(), endDate: todayISO(), strictProgress: false, priority: f.priority }
        }
        return { id: t.id, ...f }
      }),
    )
    onClose()
  }

  return (
    <Modal
      title={targets.length === 1 ? t('todo.startTask') : t('todo.restoreMany', { count: targets.length })}
      onClose={onClose}
      width={520}
    >
      <div className="space-y-3">
        {/* one tab per task, so it's always clear which one is being edited */}
        {targets.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-1.5">
            {targets.map((target) => (
              <button
                key={target.id}
                onClick={() => setActiveId(target.id)}
                title={target.name}
                className={`shrink-0 max-w-[170px] h-7 px-2.5 text-[11px] truncate rounded-t-[3px] border-b-2 ${
                  target.id === active.id
                    ? 'text-fg bg-panel2'
                    : 'text-muted hover:text-fg border-transparent'
                }`}
                style={target.id === active.id ? { borderBottomColor: sig('todo') } : undefined}
              >
                {visited.has(target.id) && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: sig('todo') }} />
                )}
                {target.name}
              </button>
            ))}
          </div>
        )}

        {targets.length === 1 && <div className="text-[13px] font-medium text-fg">{active.name}</div>}

        {activeHasKids ? (
          <div className="text-[12px] text-muted leading-relaxed bg-panel2 border border-border rounded-[3px] p-2.5">
            {tr('todo.hasSubtasks', { name: <span className="text-fg">{active.name}</span> })}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('common.startDate')}>
                <input type="date" className={inputCls} value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              </Field>
              <Field label={t('common.endDate')}>
                <input type="date" className={inputCls} value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} />
              </Field>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="start-strict"
                checked={form.strictProgress}
                onChange={(e) => set({ strictProgress: e.target.checked })}
                className="accent-accent"
              />
              <label htmlFor="start-strict" className="text-[12px] text-fg cursor-pointer">
                {t('task.strictProgress')}
              </label>
            </div>
          </>
        )}

        <Field label={t('common.priority')}>
          <select className={inputCls} value={form.priority} onChange={(e) => set({ priority: e.target.value as TaskPriority })}>
            {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{t(PRIORITY_META[p].labelKey)}</option>)}
          </select>
        </Field>

        <div className="flex items-center justify-end gap-2 pt-1">
          {/* Walking the tabs one at a time reads better than a wall of fields,
              so everything is committed only from the last tab. */}
          {targets.length > 1 && (
            <span className="mr-auto text-[11px] text-dim">
              {idx + 1} / {targets.length}
            </span>
          )}
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">{t('common.cancel')}</button>
          {targets.length > 1 && !isLast ? (
            <button onClick={goNext} className="h-8 px-4 text-[12px] font-medium text-fg border border-border rounded-[3px] hover:bg-panel2">
              {t('todo.next')}
            </button>
          ) : (
            <button onClick={submit} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px]">
              {targets.length === 1 ? t('todo.start') : t('todo.saveAll', { count: targets.length })}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

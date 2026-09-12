import { useMemo, useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { Task, TaskPriority, TaskType } from '../types'
import { useStore } from '../store/useStore'
import { collectDescendants } from '../lib/tree'
import { PRIORITY_META, PRIORITY_ORDER } from '../lib/ui'
import { todayISO } from '../lib/dates'
import { useT, useTRich } from '../lib/useT'

interface Props {
  onClose: () => void
  existing?: Task
  defaultParentId?: string | null
}

export function TaskDialog({ onClose, existing, defaultParentId }: Props) {
  const t = useT()
  const tr = useTRich()
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const addTask = useStore((s) => s.addTask)
  const updateTask = useStore((s) => s.updateTask)
  const addLog = useStore((s) => s.addLog)

  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    projectId: existing?.projectId ?? projects[0]?.id ?? '',
    type: (existing?.type ?? 'phase') as TaskType,
    parentId: (existing?.parentId ?? defaultParentId ?? null) as string | null,
    isTodo: existing?.isTodo ?? false,
    startDate: existing?.startDate ?? todayISO(),
    endDate: existing?.endDate ?? todayISO(),
    strictProgress: existing?.strictProgress ?? false,
    priority: (existing?.priority ?? 'medium') as TaskPriority,
    tags: existing?.tags?.join(', ') ?? '',
  }))
  const [overdueChoice, setOverdueChoice] = useState<'delayed' | 'completed'>('delayed')

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const setType = (type: TaskType) => {
    if (type === 'long-term') {
      setForm((f) => ({ ...f, type, strictProgress: false, startDate: f.startDate || todayISO(), endDate: '' }))
    } else {
      setForm((f) => ({ ...f, type, startDate: f.startDate || todayISO(), endDate: f.endDate || todayISO() }))
    }
  }

  const excluded = useMemo(() => {
    if (!existing) return new Set<string>()
    return new Set(collectDescendants(tasks, existing.id).concat(existing.id))
  }, [existing, tasks])

  // A to-do is a holding pen, not a container, so it can't be a parent.
  const parentOptions = tasks.filter(
    (t) => t.projectId === form.projectId && !excluded.has(t.id) && !t.isTodo,
  )

  const isTodo = form.isTodo
  const isLT = form.type === 'long-term'
  const hasKids = existing ? tasks.some((t) => t.parentId === existing.id) : false
  const isOverdueStrict = !existing && !isTodo && !isLT && form.strictProgress && !!form.endDate && form.endDate < todayISO()

  // Turning the box on forces a phase (a to-do has no start, and long-term
  // goals are anchored to one) and drops the strict flag with the rest of the
  // schedule.
  const setTodo = (on: boolean) =>
    setForm((f) => (on ? { ...f, isTodo: on, type: 'phase', strictProgress: false } : { ...f, isTodo: on }))

  const submit = () => {
    const name = form.name.trim()
    if (!name) return
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)

    // Editing an existing to-do must not resurrect the schedule it doesn't have:
    // updateTask shallow-merges, so the scheduling keys are omitted entirely.
    // The to-do flag can only be cleared through the "Start task" flow.
    if (existing?.isTodo) {
      updateTask(existing.id, {
        name,
        description: form.description,
        projectId: form.projectId,
        parentId: form.parentId,
        tags,
      })
      onClose()
      return
    }

    if (isTodo) {
      // No dates, no strict flag, no priority — addTask forces the phase type.
      addTask({
        name,
        description: form.description,
        projectId: form.projectId,
        parentId: form.parentId,
        isTodo: true,
        startDate: null,
        endDate: null,
        tags,
      })
      onClose()
      return
    }

    let s: string | null = form.startDate || todayISO()
    let e: string | null = form.endDate || s
    if (isLT) {
      e = null
    } else if (s && e && s > e) {
      const tmp = s
      s = e
      e = tmp
    }
    const payload = {
      name,
      description: form.description,
      projectId: form.projectId,
      type: form.type,
      parentId: form.parentId,
      startDate: s,
      endDate: e,
      strictProgress: isLT ? false : form.strictProgress,
      priority: form.priority,
      tags,
    }
    if (existing) {
      updateTask(existing.id, payload)
    } else {
      const id = addTask(payload)
      if (isOverdueStrict && overdueChoice === 'completed') {
        // Written in the language on screen right now, and left that way: see
        // the note on `task.markedCompleted` in lib/i18n.ts.
        addLog({ taskId: id, date: todayISO(), content: t('task.markedCompleted'), targetProgress: 100 })
      }
    }
    onClose()
  }

  return (
    <Modal title={existing ? t('task.edit') : t('task.new')} onClose={onClose} width={560}>
      <div className="space-y-3">
        <Field label={t('common.name')}>
          <input className={inputCls} autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('task.namePlaceholder')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('common.type')}>
            <select className={inputCls} value={form.type} disabled={isTodo} onChange={(e) => setType(e.target.value as TaskType)}>
              <option value="phase">{t('type.phase')}</option>
              <option value="long-term">{t('type.longTerm')}</option>
            </select>
          </Field>
          <Field label={t('common.project')}>
            <select className={inputCls} value={form.projectId} onChange={(e) => { set('projectId', e.target.value); set('parentId', null) }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label={t('task.parent')}>
          <select className={inputCls} value={form.parentId ?? ''} onChange={(e) => set('parentId', e.target.value || null)}>
            <option value="">{t('task.topLevel')}</option>
            {parentOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>

        {/* Sits above the date fields: ticking it is what removes them. */}
        {!existing && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="create-todo"
              checked={form.isTodo}
              onChange={(e) => setTodo(e.target.checked)}
              className="accent-todo"
            />
            <label htmlFor="create-todo" className="text-[12px] text-fg cursor-pointer">
              {t('task.createAsTodo')}
            </label>
          </div>
        )}

        {isTodo && (
          <div className="text-[12px] text-muted leading-relaxed bg-panel2 border border-border rounded-[3px] p-2.5">
            {/* Emphasis sits in a different place in each language, so the parts
                are placed by the translation rather than concatenated here. */}
            {tr('task.todoNote', {
              toDos: <span className="text-todo">{t('todo.folderName')}</span>,
              startTask: <span className="text-fg">{t('todo.startTask')}</span>,
            })}
          </div>
        )}

        {/* Everything a to-do doesn't have: dates, strict flag, priority. */}
        {!isTodo && (
          <>
            {isLT ? (
              <Field label={t('common.startDate')}>
                <input type="date" className={inputCls} value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('common.startDate')}><input type="date" className={inputCls} value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} /></Field>
                <Field label={t('common.endDate')}>
                  <span className={hasKids ? 'block cursor-help' : 'block'} title={hasKids ? t('task.endDateLocked') : undefined}>
                    <input type="date" className={`${inputCls} ${hasKids ? 'opacity-50 cursor-not-allowed' : ''}`} value={form.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)} disabled={hasKids} />
                  </span>
                </Field>
              </div>
            )}

            <div className={`flex items-center gap-2 ${isLT ? 'opacity-50' : ''}`}>
              <input
                type="checkbox"
                id="strict-progress"
                checked={form.strictProgress}
                disabled={isLT}
                onChange={(e) => set('strictProgress', e.target.checked)}
                className="accent-accent"
              />
              <label htmlFor="strict-progress" className={`text-[12px] ${isLT ? 'text-dim cursor-not-allowed' : 'text-fg cursor-pointer'}`}>
                {t('task.strictProgress')}
              </label>
            </div>

            <Field label={t('common.priority')}>
              <select className={inputCls} value={form.priority} onChange={(e) => set('priority', e.target.value as TaskPriority)}>
                {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{t(PRIORITY_META[p].labelKey)}</option>)}
              </select>
            </Field>
          </>
        )}

        {isOverdueStrict && (
          <Field label={t('task.overdueMark')}>
            <select className={inputCls} value={overdueChoice} onChange={(e) => setOverdueChoice(e.target.value as 'delayed' | 'completed')}>
              <option value="delayed">{t('status.delayed')}</option>
              <option value="completed">{t('status.completed')}</option>
            </select>
          </Field>
        )}

        <Field label={t('task.tagsLabel')}>
          <input className={inputCls} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder={t('task.tagsPlaceholder')} />
        </Field>

        <Field label={t('common.description')}>
          <textarea className={`${inputCls} h-20 py-1.5 resize-none`} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('common.notes')} />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">{t('common.cancel')}</button>
          <button onClick={submit} disabled={!form.name.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]">{t('common.save')}</button>
        </div>
      </div>
    </Modal>
  )
}

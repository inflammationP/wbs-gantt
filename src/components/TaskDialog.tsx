import { useMemo, useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { Task, TaskStatus, TaskPriority, TaskType } from '../types'
import { useStore } from '../store/useStore'
import { collectDescendants } from '../lib/tree'
import { STATUS_META, PRIORITY_META, STATUS_ORDER, PRIORITY_ORDER, TASK_TYPE_LABEL } from '../lib/ui'
import { todayISO } from '../lib/dates'

interface Props {
  onClose: () => void
  existing?: Task
  defaultParentId?: string | null
}

export function TaskDialog({ onClose, existing, defaultParentId }: Props) {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const addTask = useStore((s) => s.addTask)
  const updateTask = useStore((s) => s.updateTask)

  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    projectId: existing?.projectId ?? projects[0]?.id ?? '',
    type: (existing?.type ?? 'phase') as TaskType,
    parentId: (existing?.parentId ?? defaultParentId ?? null) as string | null,
    startDate: existing?.startDate ?? todayISO(),
    endDate: existing?.endDate ?? todayISO(),
    progress: existing?.progress ?? 0,
    status: (existing?.status ?? 'not-started') as TaskStatus,
    priority: (existing?.priority ?? 'medium') as TaskPriority,
    tags: existing?.tags?.join(', ') ?? '',
  }))

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const setType = (type: TaskType) => {
    if (type === 'long-term') {
      setForm((f) => ({ ...f, type, startDate: f.startDate || todayISO(), endDate: '' }))
    } else {
      setForm((f) => ({ ...f, type, startDate: f.startDate || todayISO(), endDate: f.endDate || todayISO() }))
    }
  }

  const excluded = useMemo(() => {
    if (!existing) return new Set<string>()
    return new Set(collectDescendants(tasks, existing.id).concat(existing.id))
  }, [existing, tasks])

  const parentOptions = tasks.filter((t) => t.projectId === form.projectId && !excluded.has(t.id))

  const isLT = form.type === 'long-term'
  const hasKids = existing ? tasks.some((t) => t.parentId === existing.id) : false

  const submit = () => {
    const name = form.name.trim()
    if (!name) return
    let s: string | null = form.startDate || todayISO()
    let e: string | null = form.endDate || s
    if (isLT) {
      e = null
    } else if (s && e && s > e) {
      const tmp = s
      s = e
      e = tmp
    }
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    const payload = {
      name,
      description: form.description,
      projectId: form.projectId,
      type: form.type,
      parentId: form.parentId,
      startDate: s,
      endDate: e,
      progress: Math.max(0, Math.min(100, form.progress)),
      status: form.status,
      priority: form.priority,
      tags,
    }
    if (existing) updateTask(existing.id, payload)
    else addTask(payload)
    onClose()
  }

  return (
    <Modal title={existing ? 'Edit task' : 'New task'} onClose={onClose} width={560}>
      <div className="space-y-3">
        <Field label="Name">
          <input className={inputCls} autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Task name" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className={inputCls} value={form.type} onChange={(e) => setType(e.target.value as TaskType)}>
              <option value="phase">{TASK_TYPE_LABEL.phase}</option>
              <option value="long-term">{TASK_TYPE_LABEL['long-term']}</option>
            </select>
          </Field>
          <Field label="Project">
            <select className={inputCls} value={form.projectId} onChange={(e) => { set('projectId', e.target.value); set('parentId', null) }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Parent">
          <select className={inputCls} value={form.parentId ?? ''} onChange={(e) => set('parentId', e.target.value || null)}>
            <option value="">— Top level —</option>
            {parentOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>

        {isLT ? (
          <Field label="Start date">
            <input type="date" className={inputCls} value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date"><input type="date" className={inputCls} value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} /></Field>
            <Field label="End date">
              <span className={hasKids ? 'block cursor-help' : 'block'} title={hasKids ? '结束日期由最晚结束的子任务决定，请修改子任务的结束日期' : undefined}>
                <input type="date" className={`${inputCls} ${hasKids ? 'opacity-50 cursor-not-allowed' : ''}`} value={form.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)} disabled={hasKids} />
              </span>
            </Field>
          </div>
        )}

        <Field label={`Progress — ${form.progress}%`}>
          <input type="range" min={0} max={100} value={form.progress} onChange={(e) => set('progress', Number(e.target.value))} className="w-full accent-[#46b8e6]" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value as TaskStatus)}>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputCls} value={form.priority} onChange={(e) => set('priority', e.target.value as TaskPriority)}>
              {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Tags (comma separated)">
          <input className={inputCls} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="anki, health" />
        </Field>

        <Field label="Description">
          <textarea className={`${inputCls} h-20 py-1.5 resize-none`} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Notes…" />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">Cancel</button>
          <button onClick={submit} disabled={!form.name.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-black disabled:opacity-40 rounded-[3px]">Save</button>
        </div>
      </div>
    </Modal>
  )
}

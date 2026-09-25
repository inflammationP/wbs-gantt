import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Modal, Field, inputCls } from './ui'
import { LogOptOutDialog } from './LogOptOutDialog'
import { Task, TaskPriority, TaskType } from '../types'
import { useStore } from '../store/useStore'
import { buildChildrenMap, collectDescendants, computeWbs } from '../lib/tree'
import { PRIORITY_META, PRIORITY_ORDER } from '../lib/ui'
import { todayISO } from '../lib/dates'
import { useT, useTRich } from '../lib/useT'

interface Props {
  onClose: () => void
  existing?: Task
  defaultParentId?: string | null
  /**
   * Project to fall back to when `defaultParentId` is null — a sibling of a
   * top-level task has no parent to inherit from. Ignored when there is one.
   */
  defaultProjectId?: string | null
  /**
   * Create the new task as a to-do. Set only by the one path where that is
   * obvious rather than a guess: a to-do's sibling is another to-do.
   */
  defaultIsTodo?: boolean
}

export function TaskDialog({ onClose, existing, defaultParentId, defaultProjectId, defaultIsTodo }: Props) {
  const t = useT()
  const tr = useTRich()
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const addTask = useStore((s) => s.addTask)
  const updateTask = useStore((s) => s.updateTask)
  const addLog = useStore((s) => s.addLog)
  const todoNoteDismissed = useStore((s) => s.todoNoteDismissed)
  const dismissTodoNote = useStore((s) => s.dismissTodoNote)

  // A new task belongs where its parent does. Falling back to the first project
  // instead broke the parent field as well: `parentOptions` below is filtered by
  // the form's project, so the parent was not in the list, and the select sat on
  // its first option ("top level") while `parentId` quietly pointed elsewhere.
  const parent = defaultParentId ? tasks.find((t) => t.id === defaultParentId) : undefined

  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    projectId: existing?.projectId ?? parent?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '',
    type: (existing?.type ?? 'phase') as TaskType,
    parentId: (existing?.parentId ?? defaultParentId ?? null) as string | null,
    isTodo: existing?.isTodo ?? defaultIsTodo ?? false,
    startDate: existing?.startDate ?? todayISO(),
    endDate: existing?.endDate ?? todayISO(),
    // Logs are the default and the checkbox below is the way out of them, so a
    // task that has never been saved starts strict. An existing task keeps
    // whatever it was.
    strictProgress: existing ? existing.strictProgress : true,
    priority: (existing?.priority ?? 'medium') as TaskPriority,
    tags: existing?.tags?.join(', ') ?? '',
  }))
  const [overdueChoice, setOverdueChoice] = useState<'delayed' | 'completed'>('delayed')
  const [optOutAsk, setOptOutAsk] = useState(false)

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const setType = (type: TaskType) => {
    // `strictProgress` is left alone here — the payload forces it false for a
    // long-term goal anyway, and clearing it on the way through would silently
    // turn a task back to simplified for anyone who toggled the type and back.
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

  // A to-do is a holding pen, not a container, so it can't be a parent.
  const parentOptions = tasks.filter(
    (t) => t.projectId === form.projectId && !excluded.has(t.id) && !t.isTodo,
  )
  // Numbered off the whole project, not off `parentOptions`: these are the
  // numbers the Gantt prints, and the two must agree or the picker is a second
  // opinion about where a task sits in the tree.
  const wbs = useMemo(() => computeWbs(tasks.filter((t) => t.projectId === form.projectId)), [tasks, form.projectId])

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
          <ParentPicker options={parentOptions} wbs={wbs} value={form.parentId} onChange={(id) => set('parentId', id)} />
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

        {/* Acknowledged once, gone for good: it explains what a to-do is, and
            someone who has read it does not need it on every new to-do. */}
        {isTodo && !todoNoteDismissed && (
          <div className="text-[12px] text-muted leading-relaxed bg-panel2 border border-border rounded-[3px] p-2.5">
            {/* Emphasis sits in a different place in each language, so the parts
                are placed by the translation rather than concatenated here. */}
            <div>
              {tr('task.todoNote', {
                toDos: <span className="text-todo">{t('todo.folderName')}</span>,
                startTask: <span className="text-fg">{t('todo.startTask')}</span>,
              })}
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={dismissTodoNote}
                className="h-6 px-2 text-[11px] text-muted hover:text-fg border border-border rounded-[3px]"
              >
                {t('common.gotIt')}
              </button>
            </div>
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

        {/* Last, and set off by a rule, because it is a way *out* of the default
            rather than another thing to fill in. Ticking it does not take effect
            on the spot: it opens a dialog that says what the task gives up, and
            the flag only moves if that dialog is answered. Unticking needs no
            such ceremony — that direction is the recommendation. */}
        {!isTodo && !isLT && (
          <div className="border-t border-line pt-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="no-logs"
              checked={!form.strictProgress}
              onChange={(e) => (e.target.checked ? setOptOutAsk(true) : set('strictProgress', true))}
              className="accent-accent"
            />
            <label htmlFor="no-logs" className="text-[12px] text-fg cursor-pointer">
              {t('task.strictProgress')}
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">{t('common.cancel')}</button>
          <button onClick={submit} disabled={!form.name.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]">{t('common.save')}</button>
        </div>
      </div>

      {optOutAsk && (
        <LogOptOutDialog
          onBack={() => setOptOutAsk(false)}
          onConfirm={() => {
            set('strictProgress', false)
            setOptOutAsk(false)
          }}
        />
      )}
    </Modal>
  )
}

/**
 * The parent field: a tree you can fold, rather than a `<select>` of names.
 *
 * A flat list of names cannot say what the Gantt's WBS column says — which task
 * is inside which — so on a board with three levels the list reads as one rank
 * of equals and the wrong pick is silent. Folding is the other half of that: a
 * project with forty tasks shows its roots first and opens only the branch you
 * are putting the new task into.
 *
 * Portalled and `fixed` rather than absolute: the modal's body scrolls
 * (`overflow-auto` in `ui.tsx`), and a popover inside it would be clipped at
 * the first scroll. Same shape as `gantt/ContextMenu.tsx`, for the same reason.
 */
function ParentPicker({
  options,
  wbs,
  value,
  onChange,
}: {
  /** Every task that may be picked — the caller excludes to-dos and the edit's own branch. */
  options: Task[]
  wbs: Map<string, string>
  value: string | null
  onChange: (id: string | null) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  // Folded ids rather than unfolded: the tree opens the way the Gantt shows it.
  const [folded, setFolded] = useState<Set<string>>(() => new Set())
  const btnRef = useRef<HTMLButtonElement>(null)

  // `buildChildrenMap` is the Gantt's own grouping, sort and all, so siblings
  // here appear in the order their rows appear in the timeline.
  const children = useMemo(() => buildChildrenMap(options), [options])
  const offered = useMemo(() => new Set(options.map((o) => o.id)), [options])
  const rows = useMemo(() => {
    const out: { task: Task; depth: number }[] = []
    // `seen` is what makes the second walk below safe: hand-edited data can hold
    // a parent that is not on offer (a to-do) or even a cycle, and without it the
    // recursion would run forever. It is also how a reached task is recognised.
    const seen = new Set<string>()
    const visit = (list: Task[], depth: number) => {
      for (const task of list) {
        if (seen.has(task.id)) continue
        seen.add(task.id)
        out.push({ task, depth })
        if (!folded.has(task.id)) visit(children.get(task.id) ?? [], depth + 1)
      }
    }
    visit(children.get(null) ?? [], 0)
    // Everything the walk above could not reach has nowhere to hang, so it
    // stands at the top: dropping it would take a choice the data allows out of
    // the list, which is the one thing a picker must never do.
    visit(options, 0)
    return out
  }, [children, options, folded])

  const toggleFold = (id: string) =>
    setFolded((f) => {
      const n = new Set(f)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const pick = (id: string | null) => {
    onChange(id)
    setOpen(false)
    btnRef.current?.focus()
  }

  // Escape shuts the list, not the dialog behind it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const selected = options.find((o) => o.id === value)
  // Height of the panel below, roughly: max-h-64 plus its border and padding.
  const PANEL_H = 272

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        // `aria-expanded` only: the list below is a stack of real buttons, so
        // promising listbox semantics here would be a claim we don't implement.
        aria-expanded={open}
        onClick={() => {
          const r = btnRef.current?.getBoundingClientRect()
          if (r) setRect(r)
          setOpen((o) => !o)
        }}
        className={`${inputCls} flex items-center gap-1.5 text-left`}
      >
        <span className="flex-1 min-w-0 truncate">{selected ? selected.name : t('task.topLevel')}</span>
        <ChevronDown size={12} className="shrink-0 text-dim" />
      </button>

      {open && rect &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[69]" onMouseDown={() => setOpen(false)} />
            <div
              className="fixed z-[70] max-h-64 overflow-auto bg-panel border border-border rounded-[3px] shadow-2xl py-1"
              style={{
                left: rect.left,
                top: Math.min(rect.bottom + 4, window.innerHeight - PANEL_H),
                width: rect.width,
              }}
            >
              <button
                type="button"
                onClick={() => pick(null)}
                className={`w-full flex items-center h-7 text-[12px] text-left ${
                  value === null ? 'bg-accent/10 text-fg' : 'text-fg/90 hover:bg-panel2'
                }`}
                style={{ paddingLeft: 8 }}
              >
                {/* The two slots a numbered row has, empty, so this line's text
                    sits at the same x as every name below it. */}
                <span className="w-4 shrink-0" />
                <span className="w-9 shrink-0" />
                <span className="truncate">{t('task.topLevel')}</span>
              </button>
              {rows.length > 0 && <div className="my-1 border-t border-line" />}
              {rows.map(({ task, depth }) => {
                const kids = children.get(task.id) ?? []
                const isFolded = folded.has(task.id)
                return (
                  <div
                    key={task.id}
                    className={`flex items-center h-7 pr-2 ${task.id === value ? 'bg-accent/10' : 'hover:bg-panel2'}`}
                    style={{ paddingLeft: 8 + depth * 14 }}
                  >
                    {kids.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleFold(task.id)}
                        title={isFolded ? t('common.expand') : t('common.collapse')}
                        aria-label={isFolded ? t('common.expand') : t('common.collapse')}
                        className="w-4 shrink-0 flex items-center justify-center text-dim hover:text-fg"
                      >
                        {isFolded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className="w-9 shrink-0 pr-1.5 font-mono text-[11px] text-dim text-right">
                      {wbs.get(task.id) ?? ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => pick(task.id)}
                      className={`flex-1 min-w-0 truncate text-[12px] text-left ${task.id === value ? 'text-fg' : 'text-fg/90'}`}
                    >
                      {task.name}
                    </button>
                  </div>
                )
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}

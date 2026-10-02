import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import type { Project } from '../types'
import { useStore } from '../store/useStore'
import { PROJECT_COLORS } from '../lib/ui'
import { useT } from '../lib/useT'

/** What the form collects. The same three fields whether the project is new or old. */
export interface ProjectFields {
  name: string
  color: string
  description: string
}

/**
 * The project's three fields and the two buttons under them — no frame, no
 * title.
 *
 * Split out of `ProjectDialog` when creating a project needed the same form as
 * editing one. It used to be created by a one-line name prompt, which is a
 * second and thinner way to make the same thing: no colour, so the new project
 * took whatever the palette happened to be on, and nothing to explain what it
 * was for until you had already made it and gone back in to edit it.
 */
export function ProjectForm({
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: {
  initial: ProjectFields
  submitLabel: string
  onSubmit: (fields: ProjectFields) => void
  onClose: () => void
}) {
  const t = useT()
  const [form, setForm] = useState(initial)

  const submit = () => {
    const name = form.name.trim()
    if (!name) return
    onSubmit({ name, color: form.color, description: form.description })
    onClose()
  }

  return (
    <div className="space-y-3">
      <Field label={t('common.name')}>
        <input className={inputCls} autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </Field>

      <Field label={t('project.color')}>
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setForm((f) => ({ ...f, color: c }))}
              className={`w-6 h-6 rounded-[3px] border ${form.color === c ? 'border-accent' : 'border-transparent'}`}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </Field>

      <Field label={t('common.description')}>
        <textarea className={`${inputCls} h-24 py-1.5 resize-none`} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t('common.notes')} />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">{t('common.cancel')}</button>
        <button onClick={submit} disabled={!form.name.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]">{submitLabel}</button>
      </div>
    </div>
  )
}

export function ProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT()
  const updateProject = useStore((s) => s.updateProject)

  return (
    <Modal title={t('sidebar.editProject')} onClose={onClose} width={480}>
      <ProjectForm
        initial={{ name: project.name, color: project.color, description: project.description }}
        submitLabel={t('common.save')}
        onSubmit={(fields) => updateProject(project.id, fields)}
        onClose={onClose}
      />
    </Modal>
  )
}

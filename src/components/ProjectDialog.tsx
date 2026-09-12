import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import type { Project } from '../types'
import { useStore } from '../store/useStore'
import { PROJECT_COLORS } from '../lib/ui'
import { useT } from '../lib/useT'

export function ProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT()
  const updateProject = useStore((s) => s.updateProject)
  const [form, setForm] = useState({
    name: project.name,
    color: project.color,
    description: project.description,
  })

  const submit = () => {
    const name = form.name.trim()
    if (!name) return
    updateProject(project.id, { name, color: form.color, description: form.description })
    onClose()
  }

  return (
    <Modal title={t('sidebar.editProject')} onClose={onClose} width={480}>
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
          <button onClick={submit} disabled={!form.name.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]">{t('common.save')}</button>
        </div>
      </div>
    </Modal>
  )
}

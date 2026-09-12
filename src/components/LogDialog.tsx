import { useState } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useStore } from '../store/useStore'
import { TaskLog } from '../types'
import { todayISO } from '../lib/dates'

interface Props {
  taskId: string
  existing?: TaskLog | null
  onClose: () => void
}

export function LogDialog({ taskId, existing, onClose }: Props) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const addLog = useStore((s) => s.addLog)
  const updateLog = useStore((s) => s.updateLog)

  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [content, setContent] = useState(existing?.content ?? '')
  const [targetProgress, setTargetProgress] = useState<number | null>(existing?.targetProgress ?? null)
  const [showTarget, setShowTarget] = useState(existing?.targetProgress != null)

  const isStrict = task?.strictProgress === true && task.type === 'phase'

  const submit = () => {
    if (!content.trim()) return
    const tp = isStrict ? targetProgress : null
    if (existing) updateLog(existing.id, { date, content, targetProgress: tp })
    else addLog({ taskId, date, content, targetProgress: tp })
    onClose()
  }

  if (!task) return null

  return (
    <Modal title={existing ? 'Edit log' : 'Write log'} onClose={onClose} width={560}>
      <div className="space-y-3">
        <div className="text-[13px] font-medium text-fg">{task.name}</div>

        <Field label="Date">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label="Log">
          <textarea
            className={`${inputCls} h-32 py-2 resize-none`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What did you work on?"
            autoFocus
          />
          <div className="text-[11px] text-dim mt-1">Each line is an item; indent with Tab for sub-items.</div>
        </Field>

        {isStrict && (
          <div className="border-t border-line pt-2">
            <button onClick={() => setShowTarget(!showTarget)} className="flex items-center gap-1 text-[12px] text-muted hover:text-fg">
              <span className="text-[10px]">{showTarget ? '▾' : '▸'}</span>
              Set target progress (optional)
            </button>
            {showTarget && (
              <div className="mt-2">
                <Field label="Progress after this day">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={inputCls}
                    value={targetProgress ?? ''}
                    onChange={(e) =>
                      setTargetProgress(e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))))
                    }
                    placeholder="e.g. 40"
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">Cancel</button>
          <button onClick={submit} disabled={!content.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-black disabled:opacity-40 rounded-[3px]">Save</button>
        </div>
      </div>
    </Modal>
  )
}

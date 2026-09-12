import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Modal, Field, inputCls } from './ui'
import { useStore } from '../store/useStore'
import { TaskLog } from '../types'
import { todayISO } from '../lib/dates'
import { useT } from '../lib/useT'

interface Props {
  taskId: string
  existing?: TaskLog | null
  /** Date to prefill for a new log. Defaults to today. */
  defaultDate?: string
  onClose: () => void
}

export function LogDialog({ taskId, existing, defaultDate, onClose }: Props) {
  const t = useT()
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const addLog = useStore((s) => s.addLog)
  const updateLog = useStore((s) => s.updateLog)

  const [date, setDate] = useState(existing?.date ?? defaultDate ?? todayISO())
  const [content, setContent] = useState(existing?.content ?? '')
  const [targetProgress, setTargetProgress] = useState<number | null>(existing?.targetProgress ?? null)
  const [showTarget, setShowTarget] = useState(existing?.targetProgress != null)

  const taRef = useRef<HTMLTextAreaElement>(null)
  // Caret position to restore after the controlled re-render; setting
  // `.value` on a textarea resets the selection to the end.
  const pendingSel = useRef<[number, number] | null>(null)

  useLayoutEffect(() => {
    const sel = pendingSel.current
    if (!sel || !taRef.current) return
    pendingSel.current = null
    taRef.current.setSelectionRange(sel[0], sel[1])
  }, [content])

  const isStrict = task?.strictProgress === true && task.type === 'phase'

  // Tab must indent (the log format treats a leading tab as "sub-item"); the
  // browser default would move focus to the next control instead.
  const onLogKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return
    const el = taRef.current
    if (!el) return
    e.preventDefault()
    const { selectionStart: s, selectionEnd: en, value } = el

    if (e.shiftKey) {
      // Outdent: drop one leading tab from the caret's line.
      const lineStart = value.lastIndexOf('\n', s - 1) + 1
      if (value[lineStart] !== '\t') return
      pendingSel.current = [Math.max(lineStart, s - 1), Math.max(lineStart, en - 1)]
      setContent(value.slice(0, lineStart) + value.slice(lineStart + 1))
      return
    }

    pendingSel.current = [s + 1, en + 1]
    setContent(value.slice(0, s) + '\t' + value.slice(en))
  }

  const submit = () => {
    if (!content.trim()) return
    const tp = isStrict ? targetProgress : null
    if (existing) updateLog(existing.id, { date, content, targetProgress: tp })
    else addLog({ taskId, date, content, targetProgress: tp })
    onClose()
  }

  if (!task) return null

  return (
    <Modal title={existing ? t('log.edit') : t('log.write')} onClose={onClose} width={560}>
      <div className="space-y-3">
        <div className="text-[13px] font-medium text-fg">{task.name}</div>

        <Field label={t('common.date')}>
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <Field label={t('log.label')}>
          <textarea
            ref={taRef}
            className={`${inputCls} h-32 py-2 resize-none`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onLogKeyDown}
            placeholder={t('log.contentPlaceholder')}
            autoFocus
          />
          <div className="text-[11px] text-dim mt-1">{t('log.hint')}</div>
        </Field>

        {isStrict && (
          <div className="border-t border-line pt-2">
            <button onClick={() => setShowTarget(!showTarget)} className="flex items-center gap-1 text-[12px] text-muted hover:text-fg">
              <span className="text-[10px]">{showTarget ? '▾' : '▸'}</span>
              {t('log.setTarget')}
            </button>
            {showTarget && (
              <div className="mt-2">
                <Field label={t('log.progressAfterDay')}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={inputCls}
                    value={targetProgress ?? ''}
                    onChange={(e) =>
                      setTargetProgress(e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))))
                    }
                    placeholder={t('log.targetPlaceholder')}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">{t('common.cancel')}</button>
          <button onClick={submit} disabled={!content.trim()} className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent disabled:opacity-40 rounded-[3px]">{t('common.save')}</button>
        </div>
      </div>
    </Modal>
  )
}

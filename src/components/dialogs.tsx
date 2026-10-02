import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from './ui'
import { useT } from '../lib/useT'

/**
 * `confirm` and `alert`, rebuilt inside the app.
 *
 * The native dialogs are a dead end for a translated interface: their *message*
 * would follow the app's language, but their buttons are drawn by the operating
 * system and follow the OS locale — a French interface on a Chinese Windows
 * shows a French question with 确定 / 取消 under it. They also cannot be styled.
 *
 * These keep the synchronous shape of the originals: the caller passes the work
 * to do, and it runs on confirm. Nothing becomes `async`, so the destructive
 * paths read exactly as they did.
 *
 * `element` must be rendered by the caller, once. Everything is portalled, so
 * its position in the tree does not matter.
 */
export interface Dialogs {
  /** Confirm before doing something. Replaces `window.confirm`. */
  ask: (message: string, onConfirm: () => void) => void
  /** Report something. Replaces `window.alert`. */
  notice: (message: string) => void
  element: ReactNode
}

type Pending =
  | { kind: 'confirm'; message: string; onConfirm: () => void }
  | { kind: 'notice'; message: string }

export function useDialogs(): Dialogs {
  const t = useT()
  const [pending, setPending] = useState<Pending | null>(null)

  const ask = useCallback((message: string, onConfirm: () => void) => {
    setPending({ kind: 'confirm', message, onConfirm })
  }, [])

  const notice = useCallback((message: string) => {
    setPending({ kind: 'notice', message })
  }, [])

  const close = () => setPending(null)

  let element: ReactNode = null
  if (pending?.kind === 'confirm') {
    element = (
      <Modal title={t('common.confirmTitle')} onClose={close} width={420}>
        <div className="text-[13px] text-fg/90 leading-relaxed whitespace-pre-wrap">{pending.message}</div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={close} className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => {
              pending.onConfirm()
              close()
            }}
            autoFocus
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px]"
          >
            {t('common.confirm')}
          </button>
        </div>
      </Modal>
    )
  } else if (pending?.kind === 'notice') {
    element = (
      <Modal title={t('common.noticeTitle')} onClose={close} width={420}>
        <div className="text-[13px] text-fg/90 leading-relaxed whitespace-pre-wrap">{pending.message}</div>
        <div className="flex justify-end pt-4">
          <button
            onClick={close}
            autoFocus
            className="h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px]"
          >
            {t('common.ok')}
          </button>
        </div>
      </Modal>
    )
  }

  return { ask, notice, element }
}

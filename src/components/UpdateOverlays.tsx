import { useStore } from '../store/useStore'
import { useT } from '../lib/useT'
import { Modal } from './ui'

// The canonical button pair. Duplicated from `GettingStarted.tsx` because the
// repo has no button component and duplicates them per file; promoting them to
// `ui.tsx` would be a better home for both copies, but that is a separate
// change from this one.
const primaryBtn = 'h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px] disabled:opacity-40'
const secondaryBtn = 'h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px] disabled:opacity-40'

/**
 * Both update dialogs, mounted once beside the app shell.
 *
 * Here rather than inside `SettingsPage` because they have to survive
 * navigation: the nag appears over whatever view the user happens to be on, and
 * the update dialog must not disappear because they wandered off Settings while
 * reading the release notes.
 */
export function UpdateOverlays() {
  return (
    <>
      <UpdateNag />
      <UpdateDialog />
    </>
  )
}

/**
 * The once-a-month "it has been a while" prompt.
 *
 * Nothing to do with dismissing it: the throttle is stamped in the store at the
 * moment the modal opens, so both buttons here just close it.
 */
function UpdateNag() {
  const t = useT()
  const open = useStore((s) => s.nagOpen)
  const closeNag = useStore((s) => s.closeNag)
  const setActiveView = useStore((s) => s.setActiveView)

  if (!open) return null

  return (
    <Modal title={t('update.nagTitle')} onClose={closeNag} width={420}>
      <p className="text-[12px] text-muted leading-relaxed">{t('update.nagBody')}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className={secondaryBtn} onClick={closeNag}>
          {t('update.later')}
        </button>
        <button
          className={primaryBtn}
          onClick={() => {
            closeNag()
            setActiveView('settings')
          }}
        >
          {t('update.nagGo')}
        </button>
      </div>
    </Modal>
  )
}

/** Shown only for a manual check that found something. */
function UpdateDialog() {
  const t = useT()
  const info = useStore((s) => s.updateInfo)
  const installing = useStore((s) => s.updateInstalling)
  const error = useStore((s) => s.updateError)
  const installUpdate = useStore((s) => s.installUpdate)
  const closeUpdateDialog = useStore((s) => s.closeUpdateDialog)

  if (!info) return null

  return (
    <Modal
      title={t('update.availableTitle')}
      // Not closable mid-install: the download is already running and the
      // process is about to be replaced.
      onClose={() => {
        if (!installing) closeUpdateDialog()
      }}
      width={460}
    >
      <p className="text-[12px] text-fg">
        {t('update.availableBody', { version: info.version, current: info.current })}
      </p>

      <div className="mt-4 text-[10px] uppercase tracking-wider text-dim">{t('update.notes')}</div>
      {/* The notes are plain text from a single-line release prompt, so they are
          wrapped and never parsed. Capped in height, because a long note would
          otherwise push the buttons out of the modal. */}
      <div className="mt-1 max-h-[40vh] overflow-auto whitespace-pre-wrap leading-relaxed text-[12px] text-muted bg-panel2 border border-border rounded-[3px] p-3">
        {info.notes.trim() || t('update.noNotes')}
      </div>

      {error && <p className="mt-3 text-[11px] text-delayed">{t('update.installFailed', { message: error })}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button className={secondaryBtn} onClick={closeUpdateDialog} disabled={installing}>
          {t('update.later')}
        </button>
        <button className={primaryBtn} onClick={() => void installUpdate()} disabled={installing}>
          {installing ? t('update.installing') : t('update.downloadAndInstall')}
        </button>
      </div>
    </Modal>
  )
}

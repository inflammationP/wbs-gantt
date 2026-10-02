import { SNOOZE_DAYS, useStore } from '../store/useStore'
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
      <UpdateReadyDialog />
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

/**
 * "It is on disk — restart now, or later?"
 *
 * The question the download could not answer when it started, asked at the point
 * where it can be answered. Asking it up front would be asking the reader to
 * decide how long they are willing to wait, before anything has told them.
 *
 * Closing it is `dismissReady` and not `closeUpdateDialog`: what was fetched
 * stays fetched, and the version section offers the same button. Throwing the
 * handle away here would make "later" mean "never", and the download would
 * happen again on the next launch.
 */
function UpdateReadyDialog() {
  const t = useT()
  const ready = useStore((s) => s.updateReady)
  const info = useStore((s) => s.updateInfo)
  const applyUpdate = useStore((s) => s.applyUpdate)
  const dismissReady = useStore((s) => s.dismissReady)

  if (!ready || !info) return null

  return (
    <Modal title={t('update.readyTitle')} onClose={dismissReady} width={420}>
      <p className="text-[12px] text-fg leading-relaxed">
        {t('update.readyBody', { version: info.version })}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button className={secondaryBtn} onClick={dismissReady}>
          {t('update.later')}
        </button>
        <button className={primaryBtn} onClick={() => void applyUpdate()}>
          {t('update.now')}
        </button>
      </div>
    </Modal>
  )
}

/** Shown only for a manual check that found something. */
function UpdateDialog() {
  const t = useT()
  const info = useStore((s) => s.updateInfo)
  const history = useStore((s) => s.updateHistory)
  const installing = useStore((s) => s.updateInstalling)
  const error = useStore((s) => s.updateError)
  const installUpdate = useStore((s) => s.installUpdate)
  const closeUpdateDialog = useStore((s) => s.closeUpdateDialog)
  const snoozeUpdate = useStore((s) => s.snoozeUpdate)

  // **Out of the way the moment the download starts.** The install used to run
  // with this dialog up and every button in it disabled, which meant a slow
  // download — and GitHub is slow or unreachable from where a lot of this app's
  // users are — was time spent unable to use the app at all. The work is a
  // download and then a restart; neither needs the user watching it.
  //
  // Reopened by a failure, and only by one: `installUpdate` clears `installing`
  // and leaves `updateError` behind, so the dialog the reader was in comes back
  // with the reason and the button to try again. On success there is nothing to
  // come back to — the process is replaced.
  if (!info || installing) return null

  return (
    <Modal title={t('update.availableTitle')} onClose={closeUpdateDialog} width={460}
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

      {/* The versions stepped over on the way here. A native `<details>`: the
          open/closed state is the platform's, so there is nothing to keep in
          React. Absent entirely when nothing was skipped — and when the list is
          still in flight, which is why there is no loading state: an empty
          section and one that never loads look the same, deliberately.
          Collapsed by default because the release being offered is the one the
          user is deciding about; these are what they missed. */}
      {history.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-dim hover:text-fg">
            {t('update.history', { count: history.length })}
          </summary>
          <div className="mt-2 max-h-[30vh] overflow-auto space-y-3">
            {history.map((r) => (
              <div key={r.version}>
                <div className="text-[11px] font-semibold text-fg">v{r.version}</div>
                <div className="mt-0.5 whitespace-pre-wrap leading-relaxed text-[12px] text-muted">
                  {r.notes || t('update.noNotes')}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {error && <p className="mt-3 text-[11px] text-delayed">{t('update.installFailed', { message: error })}</p>}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button className={secondaryBtn} onClick={closeUpdateDialog}>
          {t('update.later')}
        </button>
        {/* Names its span rather than saying "for a while", so the cost of the
            click is known before it is made. The number comes from the store
            constant, so changing it changes the copy with it. */}
        <button className={secondaryBtn} onClick={snoozeUpdate}>
          {t('update.snooze', { days: SNOOZE_DAYS })}
        </button>
        <button className={primaryBtn} onClick={() => void installUpdate()}>
          {t('update.downloadAndInstall')}
        </button>
      </div>
    </Modal>
  )
}

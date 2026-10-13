import type { State, StoreSet } from './useStore'
import { addDays, diffDays } from '../lib/dates'
import { checkForUpdate, fetchReleaseHistory, isTauri } from '../lib/updater'

const NAG_AFTER_DAYS = 30
export const SNOOZE_DAYS = 7

type Actions = Pick<State, 'runUpdateCheck' | 'hideUnreachable' | 'installUpdate' | 'applyUpdate' | 'dismissReady' | 'closeUpdateDialog' | 'snoozeUpdate' | 'closeNag'>

export function createUpdateActions(set: StoreSet, get: () => State, persistPrefs: () => void): Actions {
  /** Is a snooze currently running? */
  function isSnoozed(): boolean {
    const { updateSnoozeUntil } = get()
    return updateSnoozeUntil !== null && Date.parse(updateSnoozeUntil) > Date.now()
  }

  /**
   * Show the "it has been a while" nag, if the clock says so.
   *
   * Evaluated at the tail of *every* failed check, whichever button started it.
   * It states a fact about the anchor — "we have not reached GitHub in over a
   * month" — and that fact does not depend on who asked, so making it depend on
   * the caller would be the one way left for an automatic check to behave
   * differently from a manual one. A successful check has just moved the anchor
   * to now, so the condition is false by construction; and a user who cannot
   * reach GitHub keeps their stale anchor, so they are nagged even though the
   * notice on the settings page already explained why.
   *
   * `new Date(iso)`, not `toDate(iso)`: `toDate` splits on '-' and expects
   * 'yyyy-MM-dd', so a full instant would parse as the 1st of the month.
   */
  function maybeNag(): void {
    if (!isTauri()) return
    const { updateAnchorAt, nagShownAt } = get()
    if (updateAnchorAt === null) return

    const now = new Date()
    if (diffDays(new Date(updateAnchorAt), now) < NAG_AFTER_DAYS) return
    if (nagShownAt !== null && diffDays(new Date(nagShownAt), now) < NAG_AFTER_DAYS) return

    // Stamped on display rather than on dismissal: a user who kills the app with
    // the modal still open never dismisses it, and would otherwise be nagged on
    // every single launch.
    set({ nagOpen: true, nagShownAt: now.toISOString() })
    persistPrefs()
  }

  return {
    hideUnreachable: () => set({ unreachableHidden: true }),
    // One check, run for two reasons, and the outcome does not depend on which:
    // the launch check *is* a manual check fired on the app's behalf, so anything
    // that varied the answer by who asked would be a difference the user could
    // see — down to the prompt, which is why there is no second entry point.
    //
    // `manual` is the single exception, and it is not about the answer. It only
    // decides whether a failure may *re-show* a notice the reader has already put
    // away: putting it away says "I have read this", not "never tell me again",
    // and pressing the button is asking a fresh question, so the answer has to be
    // visible. A silent automatic retry later that night stays silent, because
    // that is exactly what was asked for.
    runUpdateCheck: async (manual = false) => {
      // Doubles as the double-click guard and as StrictMode's: the launch effect
      // fires twice in development, and a second check while one is in flight is
      // never what anyone wanted.
      if (get().updatePhase === 'checking') return
      // Emptied up front, not when the answer arrives: checking again against a
      // different version would otherwise leave the previous version's history
      // sitting under the new release's notes until the fetch came back.
      set({ updatePhase: 'checking', updateError: null, updateHistory: [] })

      const result = await checkForUpdate()

      if (result.kind === 'unsupported') {
        set({ updatePhase: 'unsupported' })
        return
      }

      if (result.kind === 'error') {
        set(manual ? { updatePhase: 'unreachable', unreachableHidden: false } : { updatePhase: 'unreachable' })
        maybeNag()
        return
      }

      // Reaching GitHub is the event the 30-day clock measures, whichever answer
      // it gave. Recorded before anything else can go wrong.
      const anchorAt = new Date().toISOString()

      if (result.kind === 'current') {
        set({ updatePhase: 'current', updateAnchorAt: anchorAt, updateInfo: null })
        persistPrefs()
        return
      }

      set({ updatePhase: 'available', updateAnchorAt: anchorAt })
      persistPrefs()

      // Never install unasked. An app that restarts itself under the user's
      // cursor is not a courtesy, and the release notes are worth reading *before*
      // the decision rather than after the restart — which is what the dialog is
      // for. The cost is a prompt on every launch until the update is taken; that
      // is the trade being made.
      //
      // A running snooze suppresses the dialog only. The phase still becomes
      // `available`, so the settings page keeps reporting that an update exists —
      // silencing the prompt must never amount to hiding the update.
      const snoozed = isSnoozed()
      if (!snoozed) set({ updateInfo: result })

      // The skipped versions are a second request, fetched after the dialog is
      // already up rather than before: the version number, the notes and the
      // install button do not wait behind it, and the folded section appears when
      // — or never — it arrives. Nothing is fetched for a snoozed update, since
      // nobody is looking at a dialog.
      if (!snoozed) {
        const history = await fetchReleaseHistory(result.current, result.version)
        // Unless a check that started while this one was in flight has taken over.
        if (get().updateInfo === result) set({ updateHistory: history })
      }
    },

    /**
     * Fetch the installer, in the background.
     *
     * The dialog disappears the moment this is called and the app carries on: a
     * download is a download, and it does not need the user watching it. What
     * comes back is `updateReadyOpen`, which raises the question the download
     * cannot answer — whether to restart now.
     */
    installUpdate: async () => {
      const info = get().updateInfo
      if (!info) return
      // Stamp the anchor before anything is written downstream: on Windows the
      // installer exits the process, so anything written after that may never land.
      set({ updateInstalling: true, updateError: null, updateAnchorAt: new Date().toISOString() })
      persistPrefs()
      try {
        await info.download()
        set({ updateInstalling: false, updateReady: true, updateReadyOpen: true })
      } catch (err) {
        set({
          updateInstalling: false,
          updateError: err instanceof Error ? err.message : String(err),
        })
      }
    },

    applyUpdate: async () => {
      const info = get().updateInfo
      if (!info) return
      // `updateReady` stays true: the installer does not stop being on disk
      // because launching it failed, and a failure is answered by the offer
      // dialog with the reason on it.
      set({ updateInstalling: true, updateReadyOpen: false, updateError: null })
      try {
        await info.install()
      } catch (err) {
        set({
          updateInstalling: false,
          updateError: err instanceof Error ? err.message : String(err),
        })
      }
    },

    // The handle stays: what was downloaded is still downloaded, and the way back
    // to it is the version section, which shows the same offer. Dropping the
    // handle here would make "later" mean "never", and the whole download would
    // happen again on the next launch. Only the question goes.
    dismissReady: () => set({ updateReadyOpen: false }),

    closeUpdateDialog: () => {
      const info = get().updateInfo
      set({
        updateInfo: null,
        updateInstalling: false,
        updateReady: false,
        updateReadyOpen: false,
        updateError: null,
      })
      // Release the Tauri resource. Nothing is lost: checking again re-fetches it.
      void info?.dismiss()
    },

    snoozeUpdate: () => {
      const info = get().updateInfo
      set({
        updateInfo: null,
        updateInstalling: false,
        // Snoozing drops the handle, so it drops what the handle held: leaving
        // `updateReady` set would keep the version section offering a restart
        // through an installer that has been released.
        updateReady: false,
        updateReadyOpen: false,
        updateError: null,
        updateSnoozeUntil: addDays(new Date(), SNOOZE_DAYS).toISOString(),
      })
      persistPrefs()
      void info?.dismiss()
    },

    closeNag: () => set({ nagOpen: false }),

  }
}

import type { StoreApi } from 'zustand'
import type { State, StoreSet } from './useStore'
import { todayISO } from '../lib/dates'
import { translate } from '../lib/i18n'
import { liveTasks } from '../lib/tree'
import { isTauri } from '../lib/updater'
import { syncReminderFile, installReminderTask as installTask, removeReminderTask as removeTask, isReminderTaskInstalled, setAutostart as enableAutostart, isAutostartEnabled } from '../lib/notify'

type Actions = Pick<State, 'setReminderWechat' | 'setReminderRules' | 'setReminderTopic' | 'setReminderLeadDays' | 'setCopyOverride' | 'markReportSeen' | 'setReminderToken' | 'installReminderTask' | 'removeReminderTask' | 'refreshReminderTask' | 'setAutostart' | 'setCloseToTray'>

export function createReminderActions(set: StoreSet, get: () => State, persistPrefs: () => void): Actions {
  return {
    setReminderWechat: (on) => {
      set({ reminderWechat: on })
      persistPrefs()
      scheduleReminderSync(0)
    },
    setReminderRules: (rules) => {
      set({ reminderRules: rules })
      persistPrefs()
      scheduleReminderSync(0)
    },
    setReminderTopic: (category, on) => {
      const current = get().reminderTopics
      const next = on ? [...current, category] : current.filter((c) => c !== category)
      set({ reminderTopics: next })
      persistPrefs()
      scheduleReminderSync(0)
    },
    setReminderLeadDays: (days) => {
      set({ reminderLeadDays: days })
      persistPrefs()
      scheduleReminderSync(0)
    },
    setCopyOverride: (key, text) => {
      const { reminderCopy, lang } = get()
      const forLang = { ...(reminderCopy[lang] ?? {}) }
      // Empty means no opinion, not render nothing — see copy() in reminder.ts.
      if (text.trim() === '') delete forLang[key]
      else forLang[key] = text
      set({ reminderCopy: { ...reminderCopy, [lang]: forLang } })
      persistPrefs()
      scheduleReminderSync(0)
    },
    markReportSeen: () => {
      set({ reportSeenDay: todayISO() })
      persistPrefs()
    },
    setReminderToken: (token) => {
      set({ reminderToken: token })
      persistPrefs()
      scheduleReminderSync(0)
    },

    installReminderTask: async () => {
      try {
        await installTask()
        set({ reminderTaskInstalled: true, reminderError: null })
      } catch (err) {
        console.warn('Reminder task install failed:', err)
        set({ reminderError: err instanceof Error ? err.message : String(err) })
      }
    },
    removeReminderTask: async () => {
      try {
        await removeTask()
        set({ reminderTaskInstalled: false, reminderError: null })
      } catch (err) {
        console.warn('Reminder task removal failed:', err)
        set({ reminderError: err instanceof Error ? err.message : String(err) })
      }
    },
    refreshReminderTask: async () => {
      set({ reminderTaskInstalled: await isReminderTaskInstalled() })
    },

    setAutostart: async (on) => {
      try {
        const actual = await enableAutostart(on)
        set({ autostart: actual })
        persistPrefs()
      } catch (err) {
        console.warn('Autostart change failed:', err)
        set({ reminderError: err instanceof Error ? err.message : String(err) })
      }
    },

    setCloseToTray: (on) => {
      set({ closeToTray: on })
      persistPrefs()
    },
  }
}

let reminderStore: StoreApi<State> | null = null
const REMINDER_SETTLE_MS = 30_000

let reminderTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Rewrite the reminder file from the board as it stands, coalescing bursts.
 *
 * `delay = 0` is for settings the user has just changed by hand: they are about
 * to close the window and have every right to expect it stuck.
 */
export function scheduleReminderSync(delay = REMINDER_SETTLE_MS): void {
  if (!reminderStore || !isTauri()) return
  if (reminderTimer !== null) clearTimeout(reminderTimer)
  reminderTimer = setTimeout(() => {
    reminderTimer = null
    const s = reminderStore!.getState()
    if (s.storageIssue?.kind === 'load') return
    // Filed-away work is not pushed: the digest is a list of what is coming, and
    // an archived task is finished work that has been put down. The one place
    // the live-only rule is applied at the source rather than at a screen.
    void syncReminderFile(
      {
        tasks: liveTasks(s.tasks),
        logs: s.logs,
        chores: s.chores,
        habits: s.habits,
      },
      s.lang,
      {
        wechat: s.reminderWechat,
        token: s.reminderToken.trim(),
        ack: translate(s.lang, 'reminder.ack'),
        rules: s.reminderRules,
        topics: s.reminderTopics,
        leadDays: s.reminderLeadDays,
        overrides: s.reminderCopy[s.lang],
      },
    )
  }, delay)
}

export function startReminderRuntime(store: StoreApi<State>): void {
  reminderStore = store
  // Everything the digest is made of, plus the language it is written in. Keyed on
  // the same identity comparisons as the data subscriber above — a set of new
  // arrays is a change, a re-render is not.
  store.subscribe((state, prev) => {
    if (
      state.tasks !== prev.tasks ||
      state.logs !== prev.logs ||
      state.chores !== prev.chores ||
      state.habits !== prev.habits ||
      state.lang !== prev.lang ||
      state.today !== prev.today
    ) {
      scheduleReminderSync()
    }
  })

  // The first run, and with it the recovery path for every launch after: whatever
  // the file happens to hold, rewrite it from the board that was just loaded.
  scheduleReminderSync(0)

  // Two questions only the operating system can answer, asked once at startup.
  // Neither is guessable from our own preferences: the scheduled task can be
  // deleted from Task Scheduler and autostart turned off from Task Manager, and a
  // toggle that keeps saying "on" after that is worse than no toggle at all.
  if (isTauri()) {
    void (async () => {
      // The scheduled task is registered here, on the first launch, rather than by
      // a button someone has to find. The whole point of the feature is that it
      // works without being attended to, and a reminder that waits for its owner to
      // finish setting it up is one that has already failed at that.
      //
      // Deliberately not in a dev build: the task would be registered against
      // `target/debug/app.exe`, which the next `cargo clean` deletes, leaving a
      // scheduled task aimed at a path that no longer exists — and one the user
      // never asked for and cannot account for.
      let installed = await isReminderTaskInstalled()
      if (!installed && !import.meta.env.DEV) {
        try {
          await installTask()
          installed = await isReminderTaskInstalled()
        } catch (err) {
          console.warn('Could not register the reminder task:', err)
        }
      }
      store.setState({ reminderTaskInstalled: installed })

      // The preference is the source of truth here, not the registry — that is the
      // opposite of how this read before, and it is what makes the default a
      // default. Reconciling the other way would let the very first launch flip
      // "start with Windows" straight back off, since a fresh install is by
      // definition not yet registered. The cost is that switching it off from Task
      // Manager is undone on the next launch; switching it off in the app is not.
      const auto = await isAutostartEnabled()
      const wants = store.getState().autostart
      // `null` means the question could not be put to Windows at all, which is not
      // the same answer as "off" and must not be acted on either way.
      if (auto !== null && auto !== wants) {
        try {
          await enableAutostart(wants)
        } catch (err) {
          console.warn('Could not apply the autostart preference:', err)
        }
      }
    })()
  }

}

import { Chore, Habit, Note, Project, Stamp, Task, TaskLog, TaskPriority } from '../types'
import { DEFAULT_LANG, isLang, Lang } from '../lib/i18n'
import { liftTimes, paragraphs } from '../lib/logs'
import { isArchived } from '../lib/tree'
import { DEFAULT_THEME, isThemeId, ThemeId } from '../lib/theme'
import { ALL_DAYS } from '../lib/habits'
import { PRIORITY_ORDER } from '../lib/ui'
import {
  CopyOverrides,
  DigestCategory,
  DIGEST_CATEGORIES,
  ReminderRule,
  isDigestCategory,
} from '../lib/reminder'

export interface PersistedData {
  projects: Project[]
  tasks: Task[]
  logs: TaskLog[]
  /**
   * Chores, habits and notes, kept apart from `tasks` on purpose — see `Chore`,
   * `Habit` and `Note` in types.ts.
   *
   * Optional in the type, unlike the three above: every blob written before
   * chores — or before habits, or before notes — has no such field, and
   * `normalize` is what turns that into an empty array. Declaring it required
   * would only move the same admission to a cast at each read.
   *
   * The cost of that optionality is that `normalize` is the *only* place the
   * compiler insists a new collection be named. Every other drop point —
   * `exportJson`, `parseImport`, the store's save literal and its subscriber —
   * compiles clean while quietly omitting it, which is why they are worth
   * checking by hand when one is added.
   */
  chores?: Chore[]
  habits?: Habit[]
  notes?: Note[]
  /**
   * What the user calls each to-do folder, by folder id.
   *
   * A folder is a *run of consecutive to-do siblings*, synthesized by
   * `buildRows` and recomputed on every render — there is no record of it to
   * hang a name on, which is the whole reason this is a map beside the tasks
   * rather than a field on one. The key is `todoGroupId(parentId, projectId)`,
   * the identity the tree already gives a folder, so the name survives the run
   * being split, re-ordered or dragged out and back.
   *
   * Sparse: a folder nobody named has no entry, and the row falls back to the
   * count it has always shown.
   */
  todoFolders?: Record<string, string>
}

/**
 * What `normalize` guarantees: every collection present, whatever the blob had.
 *
 * The distinction from `PersistedData` is the whole point of these two types.
 * On the way in, a field may be absent — old blobs, hand-edited files. On the
 * way out it may not, so the store never has to write `?? []` and a future
 * collection cannot be half-adopted.
 */
export type LoadedData = Required<PersistedData>

const KEY = 'wbs-gantt.v2'

/**
 * Interface preferences.
 *
 * Deliberately a separate key from the data. `parseImport` produces a
 * `PersistedData` and `importData` replaces the store with it wholesale, so
 * anything filed under `KEY` is destroyed by importing a file — a user would
 * lose their language and theme by opening someone else's project. Exports
 * carry work, not preferences.
 */
export interface Prefs {
  lang: Lang
  theme: ThemeId
  /**
   * The "create as to-do" note has been read and acknowledged.
   *
   * A preference, not work data, and the split is what makes it work:
   * `importData` replaces everything under `KEY` wholesale, so a flag filed
   * there would come back the moment someone opened a file a friend sent them.
   * The note explains a feature rather than recording work.
   */
  todoNoteDismissed: boolean
  /**
   * When the app last successfully reached GitHub, as an ISO instant.
   *
   * This is the anchor for the "it has been a while" nag. `null` means we have
   * never managed it — either a fresh install or a blob from before this field
   * existed. The store heals that to "now" and writes it back exactly once, so
   * a missing value cannot restart the 30-day clock on every launch (which
   * would mean the nag never fires for the user who most needs it).
   */
  updateAnchorAt: string | null
  /**
   * When the nag was last *shown* — written on display, not on dismissal.
   *
   * Display is what has to be rate-limited: a user who kills the app with the
   * modal still open never dismisses it, and a dismiss-time stamp would let
   * that user be nagged on every single launch.
   */
  nagShownAt: string | null
  /**
   * Until when the update prompt has been silenced, as an ISO instant.
   *
   * Set by the dialog's "ignore for a while" button. `null` means no snooze is
   * running. A snooze only suppresses the **prompt** — the check still runs and
   * still reports its result on the settings page, so silencing the dialog
   * never hides the fact that an update exists.
   */
  updateSnoozeUntil: string | null
  /**
   * Whether a copy also goes to WeChat, through PushPlus.
   *
   * There used to be a channel list here, and a Windows notification alongside
   * it as a peer. That was the wrong shape: the desktop notification is not a
   * choice the app offers, it is what the app does, so the only thing left to
   * decide is whether a second copy leaves the machine.
   */
  reminderWechat: boolean
  /**
   * When to send, as a list the user builds.
   *
   * Times are local and not instants, because a time of day repeats — "eight in
   * the morning" survives a trip across time zones and a change of daylight
   * saving, and a stored UTC instant would not. The sender compares each rule
   * against the clock every time it wakes, which is also what makes them
   * editable without touching the scheduled task.
   *
   * One rule ships by default. The sender treats the list as the whole of
   * "reminders are on": an empty list is silence, and there is no separate switch
   * that could disagree with it.
   */
  reminderRules: ReminderRule[]
  /**
   * Which categories a message may report at all.
   *
   * The user's standing preference, as opposed to what a given hour is for — an
   * unticked category never appears, whichever slot is speaking. Defaults to
   * every category, and an empty list means the same as "only what the slot
   * says", so a hand-edited file cannot accidentally silence everything.
   */
  reminderTopics: DigestCategory[]
  /** How many days ahead counts as "coming up". */
  reminderLeadDays: number
  /**
   * The last day the in-app daily report was opened.
   *
   * `null` until it is opened once. The mark in the sidebar lives off this being
   * behind today's date, so it comes back every morning and goes away when the
   * report is actually read — which is the only sense in which it means anything.
   */
  reportSeenDay: string | null
  /**
   * Wording the user has replaced, per language.
   *
   * Per language rather than one set, because the alternative produces a state
   * nobody can read: an English interface sending Chinese notifications, with
   * nothing on screen to say whether that is a bug or a setting. An absent key
   * falls back to the built-in string, so this is sparse and never has to be
   * complete.
   */
  reminderCopy: Partial<Record<Lang, CopyOverrides>>
  /**
   * The PushPlus token the digest is posted with.
   *
   * A preference rather than work data, and so outside `KEY` — importing
   * somebody else's board must not adopt their token, nor hand them ours.
   * Plainly stored: it is a bearer credential for one push channel, in the same
   * local profile as the board it describes, and encrypting it against an
   * attacker who can already read `localStorage` would buy nothing.
   */
  reminderToken: string
  /**
   * Whether the app starts with Windows.
   *
   * A pref, though the autostart plugin can answer it itself, because the answer
   * has to be readable during render and the plugin's is a promise. The store
   * writes what the plugin reports after every change, so the two cannot drift.
   */
  autostart: boolean
  /**
   * Whether the window's close button hides the window instead of quitting.
   *
   * Read from the frontend, which is where the close request arrives: the
   * preference lives in `localStorage` and Rust cannot reach it, so the handler
   * in `App.tsx` decides. Off means the button quits, as every window's does.
   */
  closeToTray: boolean
}

const PREF_KEY = 'wbs-gantt.prefs'

/**
 * The three moments the day gets a notification: morning, noon and dusk.
 *
 * Not a default the user adjusts — there is no longer any surface that adjusts
 * it. These three *are* the feature, and each time sits inside the slot it is
 * named for (`SLOTS` in `reminder.ts`), so the rule and the greeting it opens
 * with cannot come apart: a rule moved outside its slot would say "good morning"
 * at noon.
 *
 * The shapes differ, and that is the other half. The first send of the day is
 * the whole picture; the two after it are one line about what is left. A late
 * send keeps its own shape and takes the hour's greeting, so the noon rule
 * arriving at eleven at night is still the noon rule.
 *
 * Every day, all three. A weekday filter would be a configuration, and there is
 * nothing left that could set one.
 */
const DEFAULT_RULES: ReminderRule[] = [
  { id: 'r-early', time: '07:00', weekdays: [...ALL_DAYS], shape: 'day', enabled: true },
  { id: 'r-noon', time: '12:30', weekdays: [...ALL_DAYS], shape: 'nudge', enabled: true },
  { id: 'r-dusk', time: '18:30', weekdays: [...ALL_DAYS], shape: 'nudge', enabled: true },
]

export const DEFAULT_PREFS: Prefs = {
  lang: DEFAULT_LANG,
  theme: DEFAULT_THEME,
  todoNoteDismissed: false,
  updateAnchorAt: null,
  nagShownAt: null,
  updateSnoozeUntil: null,
  reminderWechat: false,
  reminderRules: DEFAULT_RULES,
  reminderTopics: [...DIGEST_CATEGORIES],
  reminderLeadDays: 3,
  reportSeenDay: null,
  reminderCopy: {},
  reminderToken: '',
  // On by default. The desktop notification is the channel that costs nothing
  // and needs no account, so the app ships ready to remind — and a machine that
  // starts the app is the half of that the user would otherwise have to arrange.
  autostart: true,
  // On by default: the app is a reminder service as much as a board, and one
  // that quits when its window is closed stops reminding.
  closeToTray: true,
}

// An instant this module wrote itself. Anything else — absent, from an older
// build, hand-edited — reads as "never", which the store then heals. Parsing
// rather than pattern-matching because `Date.parse` is the operation that
// actually has to succeed later.
function isInstant(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v))
}

// A `HH:mm` this module wrote itself. Range-checked rather than pattern-matched,
// for the same reason `isInstant` parses: the value is compared against a clock
// later, and a stored "25:00" would quietly mean "never due" — a reminder that
// silently stops arriving, which is the one failure this feature cannot afford.
/**
 * Wording overrides, keyed by language.
 *
 * Only the shape is checked, not the keys: an unknown key is inert (nothing
 * looks it up) and dropping it would silently throw away someone's writing the
 * day a block is renamed. Values are kept as strings and trimmed by `copy` at
 * read time, so whitespace-only text falls back rather than rendering blank.
 */
function isCopyOverrides(v: unknown): v is Partial<Record<Lang, CopyOverrides>> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  return Object.entries(v as Record<string, unknown>).every(([lang, entries]) => {
    if (!isLang(lang)) return false
    if (typeof entries !== 'object' || entries === null || Array.isArray(entries)) return false
    return Object.values(entries as Record<string, unknown>).every((s) => typeof s === 'string')
  })
}

// Anything unrecognised falls back to the default rather than propagating: a
// theme id left over from an older build, or a hand-edited file, must not leave
// the app painting a palette that no longer exists or looking up keys in a
// dictionary that was never loaded. A field a build no longer writes — a blob
// from before this one, carrying the getting-started card's own two keys — is
// simply not read.
export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      lang: typeof parsed.lang === 'string' && isLang(parsed.lang) ? parsed.lang : DEFAULT_PREFS.lang,
      theme: typeof parsed.theme === 'string' && isThemeId(parsed.theme) ? parsed.theme : DEFAULT_THEME,
      todoNoteDismissed:
        typeof parsed.todoNoteDismissed === 'boolean'
          ? parsed.todoNoteDismissed
          : DEFAULT_PREFS.todoNoteDismissed,
      updateAnchorAt: isInstant(parsed.updateAnchorAt)
        ? parsed.updateAnchorAt
        : DEFAULT_PREFS.updateAnchorAt,
      nagShownAt: isInstant(parsed.nagShownAt) ? parsed.nagShownAt : DEFAULT_PREFS.nagShownAt,
      updateSnoozeUntil: isInstant(parsed.updateSnoozeUntil)
        ? parsed.updateSnoozeUntil
        : DEFAULT_PREFS.updateSnoozeUntil,
      // Forced off while the WeChat route is withdrawn. The preference and the
      // sender's PushPlus branch are still here so that bringing it back is a
      // one-line change — but a stored `true` with no switch on screen would
      // keep posting to a third party the user can neither see nor stop.
      // TODO(wechat): restore `parsed.reminderWechat` when the UI comes back.
      reminderWechat: false,
      // Forced, not read. There is no longer anything that edits the schedule, so
      // a stored value could only be one from a build that had such a screen —
      // and it would go on governing when reminders arrive with nothing on
      // screen to explain where they came from or how to stop them. The three
      // times are the feature now; `DEFAULT_RULES` says which three.
      // TODO(settings): read `parsed.reminderRules` again if the screen comes back.
      reminderRules: DEFAULT_PREFS.reminderRules,
      reminderTopics: Array.isArray(parsed.reminderTopics)
        ? parsed.reminderTopics.filter(isDigestCategory)
        : DEFAULT_PREFS.reminderTopics,
      reminderLeadDays:
        typeof parsed.reminderLeadDays === 'number' &&
        Number.isInteger(parsed.reminderLeadDays) &&
        parsed.reminderLeadDays >= 0 &&
        parsed.reminderLeadDays <= 30
          ? parsed.reminderLeadDays
          : DEFAULT_PREFS.reminderLeadDays,
      reportSeenDay: typeof parsed.reportSeenDay === 'string' ? parsed.reportSeenDay : null,
      reminderCopy: isCopyOverrides(parsed.reminderCopy) ? parsed.reminderCopy : DEFAULT_PREFS.reminderCopy,
      reminderToken:
        typeof parsed.reminderToken === 'string' ? parsed.reminderToken : DEFAULT_PREFS.reminderToken,
      autostart: typeof parsed.autostart === 'boolean' ? parsed.autostart : DEFAULT_PREFS.autostart,
      closeToTray:
        typeof parsed.closeToTray === 'boolean' ? parsed.closeToTray : DEFAULT_PREFS.closeToTray,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/**
 * One notebook per day, out of whatever the blob holds.
 *
 * A day is a single box now, so several entries for one date can only be
 * leftovers from the shape this used to have — notes were a collection of
 * entries with ids, several to a day, before that was recognised as the wrong
 * model. Their text is **joined** rather than all but the last dropped. This is
 * the user's writing, it is the one thing in the blob that cannot be
 * reconstructed from anything else, and the cost of a stray blank line between
 * two paragraphs is nothing against the cost of losing one of them.
 *
 * An absent `date` is left as the empty string rather than guessed at, which
 * files the note under no day and hides it — where inventing one would drop it
 * into some day's card on a date nobody chose.
 */
function collapseNotes(raw: { date?: string; body?: string; updatedAt?: string; stamps?: unknown }[]): Note[] {
  const byDate = new Map<string, Note>()
  for (const n of raw) {
    const date = n.date ?? ''
    const body = (n.body ?? '').trim()
    if (!body) continue
    const seen = byDate.get(date)
    // The readings come through with the body they belong to, in the same
    // paragraph order. This function *rebuilds* the note, so whatever it does
    // not copy is not merely unread — the next save writes the rebuilt entry
    // back, and a reading dropped here is gone from the file too. It is also
    // the one part of an entry the user cannot type again: the clock is not
    // something they can retype after the fact.
    const stamps = [...(seen?.stamps ?? []), ...readStamps(n.stamps)]
    byDate.set(date, {
      date,
      body: seen ? `${seen.body}\n\n${body}` : body,
      // The later of the two, so a collapsed pair keeps saying when the day was
      // last written rather than when its first half was.
      updatedAt: seen && seen.updatedAt > (n.updatedAt ?? '') ? seen.updatedAt : (n.updatedAt ?? ''),
      stamps,
    })
  }
  return [...byDate.values()]
}

/**
 * A live task under a filed-away parent, put back into the shape the app keeps.
 *
 * Archiving always takes the whole branch — `archiveTasks` cascades, and the
 * panel and the menus offer it on a branch and on nothing else — so this can
 * only arrive from a hand-edited file or a JSON export someone assembled. It
 * still has to be repaired rather than tolerated, because the cost of tolerating
 * it is not a strange-looking row: the tree only walks down from the roots, so
 * a task whose parent is filed away is a task that appears on no screen at all,
 * with nothing to say it was there. Filed away is the reading that keeps it.
 *
 * The nearest archived ancestor's own moment is copied down rather than a fresh
 * one, so the branch says it was archived together.
 */
function repairArchive(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  let changed = false
  const next = tasks.map((t) => {
    if (isArchived(t)) return t
    // `seen` because a hand-edited file can hold a cycle, and this walk would
    // not return — the same guard `ancestorNames` and the store's unarchive use.
    const seen = new Set<string>([t.id])
    let parentId = t.parentId
    while (parentId != null && !seen.has(parentId)) {
      seen.add(parentId)
      const parent = byId.get(parentId)
      if (!parent) break
      if (isArchived(parent)) {
        changed = true
        return { ...t, archivedAt: parent.archivedAt }
      }
      parentId = parent.parentId
    }
    return t
  })
  return changed ? next : tasks
}

/**
 * The stamps out of a saved entry, keeping only the ones that are readings.
 *
 * Shared by the log and the notebook, both of which arrive from a hand-edited
 * file or a JSON export: `at` is drawn as text and indexed by paragraph, so a
 * value that is not a string is not a wrong clock — it is the first `TimeRule`
 * of the entry throwing on render.
 */
function readStamps(v: unknown): Stamp[] {
  return Array.isArray(v)
    ? v.filter((s): s is Stamp => !!s && typeof s === 'object' && typeof (s as Stamp).at === 'string')
    : []
}

// Normalize data loaded from disk or import: backfill `type`/`strictProgress`,
// coerce missing dates to null, and default missing collections. This is also
// the invariant repair point for to-dos — a task marked `isTodo` always comes
// back unscheduled, however it was written.
function normalize(data: PersistedData): LoadedData {
  return {
    projects: data.projects,
    chores: (Array.isArray(data.chores) ? data.chores : []).map((c) => {
      const date = c.date ?? ''
      const done = c.done === true
      return {
        ...c,
        title: c.title ?? '',
        note: c.note ?? '',
        date,
        done,
        // `done` is authoritative in both directions. An open chore carrying a
        // completion date would credit the heatmap for work that is not done,
        // and a checked one from a blob written before the field existed falls
        // back to its own date — the best guess available, and one the heatmap
        // can use, where a null it would silently skip.
        completedDate: done ? (c.completedDate ?? date) : null,
      }
    }),
    // Unlike a chore's `done`, nothing here is coerced in either direction: a
    // habit has no finished state to keep in step with, and `doneDays` is the
    // whole of what it knows. An empty `startDate` is left alone rather than
    // guessed at — it makes the habit invisible until a real date is written,
    // where inventing one would drop it into some day's record on a date nobody
    // chose. Absent for every blob written before habits existed, which is the
    // whole reason the field is optional in the type.
    habits: (Array.isArray(data.habits) ? data.habits : []).map((h) => ({
      ...h,
      title: h.title ?? '',
      note: h.note ?? '',
      // Every routine written before there were routine trees stands at the
      // top, which is what null says. A non-string is not filtered out here:
      // `routineRows` cannot hang a child under a parent it cannot find, so a
      // bad value leaves the routine on the list rather than off it.
      parentId: typeof h.parentId === 'string' ? h.parentId : null,
      startDate: h.startDate ?? '',
      endDate: h.endDate ?? null,
      // Every habit written before this field existed ran every day, which is
      // what all seven says. Defaulting to an empty array would read as "never"
      // under a membership test — a silent way to delete somebody's list.
      weekdays: Array.isArray(h.weekdays) && h.weekdays.length ? ALL_DAYS.filter((d) => h.weekdays.includes(d)) : [...ALL_DAYS],
      paused: h.paused === true,
      pauseDate: h.pauseDate ?? null,
      pauses: Array.isArray(h.pauses) ? h.pauses : [],
      doneDays: Array.isArray(h.doneDays) ? h.doneDays : [],
    })),
    notes: collapseNotes(Array.isArray(data.notes) ? data.notes : []),
    // Written out rather than cast through: this one arrives from a hand-edited
    // file or a JSON export, and a value that is not a string would be rendered
    // as a folder name and stored back on the next save.
    todoFolders: readFolderNames(data.todoFolders),
    tasks: repairArchive(data.tasks.map((t) => {
      const isLT = t.type === 'long-term'
      const isTodo = t.isTodo === true
      return {
        ...t,
        // A to-do keeps no type, and that has to survive a round trip: this
        // line is what the app writes back on every load, so normalising a
        // to-do to 'phase' here would re-answer the question the start dialog
        // is supposed to ask.
        type: isTodo ? null : isLT ? 'long-term' : 'phase',
        isTodo,
        startDate: isTodo ? null : (t.startDate ?? null),
        endDate: isTodo || isLT ? null : (t.endDate ?? null),
        strictProgress: isTodo ? false : (t.strictProgress ?? false),
        paused: isTodo ? false : (t.paused ?? false),
        pauseDate: isTodo ? null : (t.pauseDate ?? null),
        pauses: Array.isArray(t.pauses) ? t.pauses : [],
        // Kept through a to-do rather than cleared with the other scheduling
        // fields: logs survive that trip too, and a task that comes back should
        // not come back with its work forgotten.
        confirmedDays: Array.isArray(t.confirmedDays) ? t.confirmedDays : [],
        priority: isTodo ? null : readPriority(t.priority),
        // A hand-edited file can put anything here, and the sibling comparator
        // subtracts two of them — a string would compare as `NaN` and leave the
        // order implementation-defined. Anything that is not a finite number
        // reads as "no opinion", which is the state every task starts in.
        order: Number.isFinite(t.order) ? (t.order as number) : undefined,
        // Read as a moment or as nothing. Only ever truth-tested — but it is
        // also written straight back to disk on the next save, so a value that
        // is not one the app wrote has to be dropped here rather than carried.
        archivedAt: isInstant(t.archivedAt) ? t.archivedAt : undefined,
      }
    })),
    logs: (data.logs ?? []).map((l) => ({
      ...l,
      date: l.date ?? '',
      // The stamps move out of the text the first time a board written before
      // they had a field is read, and the call does nothing after that. See
      // `liftTimes`.
      ...stampsOf(l),
      targetProgress: l.targetProgress ?? null,
    })),
  }
}

/**
 * A priority out of a saved file, or the ordinary one.
 *
 * This is a trust boundary and the check is not decoration. `priorityMeta` reads
 * `PRIORITY_META[p]` and then `.token` off it, so a value with no entry there is
 * not a wrong colour — it is a thrown exception on the first render that shows
 * the task. Anything unrecognised therefore falls back rather than through.
 *
 * The `'urgent'` line is the other half: that level was renamed to `'top'`, and
 * every board saved before the rename still says the old word. It has no entry
 * in `PRIORITY_META` any more, which is exactly the crash above — so it is read
 * as what it is now. Removing this line would look like clearing out a dead
 * string, and would take the priority off every task on every existing board.
 * `scripts/check-task-tree.mjs` is what holds that.
 */
export function readPriority(v: unknown): TaskPriority {
  if (v === 'urgent') return 'top'
  return PRIORITY_ORDER.includes(v as TaskPriority) ? (v as TaskPriority) : 'medium'
}

/**
 * An entry's stamps, wherever the board on disk was written.
 *
 * Three shapes to read: the reading typed into the content as a `— HH:MM —`
 * line (everything before stamps were a field), a plain `times` list from the
 * build that lifted the readings out but had nowhere to put *which* paragraph
 * each one opened, and the field itself. All three resolve to one stamp per
 * paragraph here, which is the only shape the rest of the app knows.
 *
 * The lift runs on every load, not only on the shape that has no field yet.
 * The first build to *have* the field lifted the readings but left the lines in
 * the text, so every entry read by it now carries both — and a board saved
 * since has both on disk. Running it again is what takes those lines out; on a
 * body already through it, there is nothing to lift and the text comes back
 * unchanged, which is what makes it safe here every time. What it must not do
 * is leave `— 14:05 —` sitting in a paragraph while the paragraph above it wears
 * the reading: that is the same clock drawn twice.
 *
 * Exported for `scripts/check-notes.mjs`, which is where the three shapes are
 * pinned.
 */
export function stampsOf(l: { content?: string; times?: unknown; stamps?: unknown }): { content: string; stamps: Stamp[] } {
  const { text, stamps: lifted } = liftTimes(l.content ?? '')
  const stored = readStamps(l.stamps)
  // The order is the order they were written in, and every write opened a
  // paragraph — so the list lines up with the blocks, shortest wins.
  const times = Array.isArray(l.times) ? l.times.filter((t): t is string => typeof t === 'string') : null
  return {
    content: text,
    // Read in that order of preference, because the oldest shape is also the
    // one that lost the most: a reading already in the field knows which
    // paragraph it opened, a lifted one only knows the line it came out of, and
    // a `times` list knows neither — it just counts. Whichever answers, the
    // count has to match the paragraphs or the readings are drawn against the
    // wrong text.
    stamps: paragraphs(text).map((_, i) => {
      const kept = stored[i]
      if (kept?.at) return kept
      const line = lifted[i]
      return line?.at ? line : { at: times?.[i] ?? '' }
    }),
  }
}

/**
 * The folder names out of a saved file, keeping only the ones that are names.
 *
 * Blank is not a name: a folder called "" has to read as unnamed, or the row
 * would print an empty label instead of the count it falls back to.
 */
function readFolderNames(v: unknown): Record<string, string> {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string> = {}
  for (const [id, name] of Object.entries(v as Record<string, unknown>)) {
    if (typeof name === 'string' && name.trim()) out[id] = name
  }
  return out
}

export function loadData(): LoadedData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedData
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.tasks)) return null
    return normalize(parsed)
  } catch {
    return null
  }
}

export function saveData(data: PersistedData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export function exportJson(data: PersistedData): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: data.projects,
      tasks: data.tasks,
      logs: data.logs,
      chores: data.chores ?? [],
      habits: data.habits ?? [],
      notes: data.notes ?? [],
      todoFolders: data.todoFolders ?? {},
    },
    null,
    2,
  )
}

export function parseImport(json: string): LoadedData {
  const parsed = JSON.parse(json) as PersistedData
  if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid file: expected { projects, tasks } arrays')
  }
  return normalize({
    projects: parsed.projects,
    tasks: parsed.tasks,
    logs: parsed.logs ?? [],
    chores: parsed.chores ?? [],
    habits: parsed.habits ?? [],
    notes: parsed.notes ?? [],
    todoFolders: parsed.todoFolders ?? {},
  })
}

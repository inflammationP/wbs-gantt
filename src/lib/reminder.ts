import { Chore, Habit, Task, TaskLog } from '../types'
import { Lang, Params, formatShortDate, interpolate, translate } from './i18n'
import { addDays, toDate, toISO, weekdayIndex } from './dates'
import { buildChildrenMap } from './tree'
import { dayStates, milestonesOnDay, strictLogObligations } from './dayTasks'
import { todaysChores } from './chores'
import { habitsOn, tickedOn } from './habits'

/**
 * The message that gets pushed, already rendered.
 *
 * Rendered here and not at send time, because the sender is a separate process
 * on the far side of a process boundary (see `sendReminder` in `notify.ts`). Hand
 * it plain strings and it needs no idea what a strict leaf is.
 */
export interface Digest {
  title: string
  body: string
}

/** What `composeDigest` reads. The four collections, nothing else. */
export interface Board {
  tasks: Task[]
  logs: TaskLog[]
  chores: Chore[]
  habits: Habit[]
}

/**
 * How many days ahead are rendered in one pass.
 *
 * This is the freshness window, and it is load-bearing rather than decorative:
 * the reminders are written out while the app is open and sent later by a
 * scheduled task that cannot compute anything. So a day with no pre-rendered
 * digest is a day that gets no reminder. Fourteen days of slack is why the
 * window is not a problem in practice — and with "start with Windows" on, the
 * file is rewritten at every boot anyway.
 */
export const DIGEST_WINDOW_DAYS = 14

type Key = Parameters<typeof translate>[1]

// ─────────────────────────────────────────────────────────────────────────────
// 栏目 —— 一条通知里可以报告的七件事
// ─────────────────────────────────────────────────────────────────────────────

export type DigestCategory =
  | 'overdue'
  | 'dueToday'
  | 'starting'
  | 'dueSoon'
  | 'logsOwed'
  | 'chores'
  | 'habits'

export const DIGEST_CATEGORIES: DigestCategory[] = [
  'overdue',
  'dueToday',
  'starting',
  'dueSoon',
  'logsOwed',
  'chores',
  'habits',
]

/**
 * One thing worth a line in a message.
 *
 * `date` is null exactly when there is no deadline to print — a chore and a
 * habit carry none. Which of the two item formats applies is therefore a
 * property of the item, not of the category it came from, and the renderer never
 * needs a table saying which categories are dated.
 *
 * Deliberately no id. Nothing downstream of a digest looks anything up: the
 * sender posts text and a person reads it. An id here would be a field with no
 * reader, and it would be the field that invites the next person to make this
 * list clickable and turn it into a second Today page.
 */
export interface DigestItem {
  name: string
  /** yyyy-MM-dd, or null when there is nothing to date it with. */
  date: string | null
}

/** Every category's items for one day, computed once. */
export type DayCats = Record<DigestCategory, DigestItem[]> & {
  /**
   * How many of the day's tasks owe a log — written or not.
   *
   * The report's 任务清单 figure, and the denominator its 完成率 is a percentage
   * of. `logsOwed` is the other half of the same set: the ones still unwritten.
   * Both are kept because the report asks for the whole and a nudge asks for the
   * remainder, and neither can be derived from the other without a count of what
   * has been logged, which nothing here holds.
   */
  obligations: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 时段 —— 决定"怎么说"和"说什么"
// ─────────────────────────────────────────────────────────────────────────────

export type Slot = 'dawn' | 'early' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'evening' | 'night'

/**
 * When a slot runs, what it is for, and which categories it reports.
 *
 * **This table is the whole of the slot logic.** Nothing anywhere else repeats
 * these boundaries or this selection — `slotAt` reads it, `composeDigest` reads
 * it, the settings page reads it to label its sections, and the check script
 * reads it to know what to expect. Adding a slot, moving a boundary or moving a
 * tick between columns is an edit to one row here and nothing else.
 *
 * Slots are half-open, `[from, to)`, and they must tile the day end to end with
 * no gap and no overlap — `check-reminder.mjs` asserts that, because a gap would
 * silently mean "a rule set in this hour never fires" and an overlap would mean
 * "this hour is ambiguous".
 *
 * What a slot is *not*: a decision about whether to send. A rule set for 03:00
 * fires at 03:00; it just speaks with the `dawn` voice.
 */
export interface SlotDef {
  id: Slot
  /** `HH:mm`, inclusive. */
  from: string
  /** `HH:mm` or `24:00`, exclusive. */
  to: string
  /** The tone of this hour's greeting, and what a rule set here should expect. */
  purpose: string
}

/**
 * What a message says, as opposed to how it says it.
 *
 * A property of the *rule*, not of the hour. The clock decides the greeting and
 * nothing else: 早上好 at seven, 夜深了 at eleven, whether the day is being
 * opened or nudged about. Two earlier versions of this had it the other way
 * round — the slot chose the content — and both were wrong for the same reason,
 * that a fixed send landing late then changed shape. A rule that arrives at
 * eleven at night is still the noon rule, and still has the noon rule's job.
 *
 * Two shapes, and they are the whole of it:
 *
 * - **`day`** — the four figures the day report's 今天 section lists. 任务清单,
 *   到期与逾期, 临时事务, 日常安排: the same four rows, the same numbers, because
 *   "第一条固定消息完完全全按日报里的发" is a statement about *content* and the
 *   report has never named a task.
 * - **`nudge`** — one line, and which line is a fact about the day rather than
 *   about the hour. While none of today's logs are written the message is that;
 *   once any is, it is the breakdown of what is still open. A day with neither
 *   says nothing.
 *
 * There is deliberately no shape that lists tasks by name. There was one, and it
 * is what put task names into a notification that was supposed to carry four
 * numbers — see `docs/notification-copy.md` §二.
 */
export type SlotShape = 'day' | 'nudge'

/**
 * The three categories the report's 到期与逾期 row adds together.
 *
 * Named because both shapes need the same three — the opening send as one figure
 * against the four the report prints, the nudge as the first line of its
 * breakdown — and 今天该开始 is deliberately not among them: nothing anywhere
 * asks that question.
 */
const DEADLINES: DigestCategory[] = ['overdue', 'dueToday', 'dueSoon']

export const SLOTS: SlotDef[] = [
  {
    id: 'dawn',
    from: '00:00',
    to: '06:00',
    purpose: '没睡，或者刚醒。说句话就够，不催',
  },
  {
    id: 'early',
    from: '06:00',
    to: '08:00',
    purpose: '起床、通勤',
  },
  {
    id: 'morning',
    from: '08:00',
    to: '12:00',
    purpose: '开始干活',
  },
  {
    id: 'noon',
    from: '12:00',
    to: '13:30',
    purpose: '午休。半天过去了',
  },
  {
    id: 'afternoon',
    from: '13:30',
    to: '18:00',
    purpose: '干活',
  },
  {
    id: 'dusk',
    from: '18:00',
    to: '19:00',
    purpose: '收工，结算',
  },
  {
    id: 'evening',
    from: '19:00',
    to: '22:00',
    purpose: '在家，晚上还有没有没交代的',
  },
  {
    id: 'night',
    from: '22:00',
    to: '24:00',
    purpose: '睡前。说句收场的话',
  },
]

/**
 * Which slot `HH:mm` falls in.
 *
 * Compared as strings, which is what zero-padded `HH:mm` is for: `"08:00" <
 * "09:30"` holds without parsing either. The fallthrough to the last slot is not
 * defensive padding — it is `24:00`, the one boundary that cannot be matched by a
 * `HH:mm` the clock can produce, and the tiling assertion in the check script is
 * what makes it unreachable otherwise.
 */
export function slotAt(hhmm: string): Slot {
  for (const s of SLOTS) {
    if (hhmm >= s.from && hhmm < s.to) return s.id
  }
  return SLOTS[SLOTS.length - 1].id
}

// ─────────────────────────────────────────────────────────────────────────────
// 文案 —— 内置默认，可被用户覆盖
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A block of wording the user may replace.
 *
 * Short names, mapped to dictionary keys by `COPY_I18N` below, because the two
 * are deliberately not the same: the dictionary keys are namespaced for lookup
 * and these are the identifiers stored in a preference and shown in the settings
 * editor. Keeping them separate means either side can be renamed without
 * rewriting everyone's saved copy.
 */
export type CopyKey =
  | `greeting.${Slot}`
  | `closing.${Slot}`
  | `topic.${DigestCategory}`
  | 'nudge.logs'
  | 'nudge.debt'
  | 'nudge.debtLine'
  | 'nudge.tasks'
  | 'group.tasks'
  | 'group.deadlines'
  | 'report.title'
  | 'report.empty'

/** What the user has replaced, in one language. Absent keys fall back. */
export type CopyOverrides = Partial<Record<CopyKey, string>>

/**
 * The mapping, written out rather than derived from a template literal.
 *
 * `reminder.${key}` would be shorter and would type-check with one cast — and it
 * would also mean a typo in either half is a string that silently renders as
 * itself. This table makes both halves compiler-checked, so a block added to
 * `CopyKey` without a dictionary entry (or the reverse) fails the build.
 */
const COPY_I18N: Record<CopyKey, Key> = {
  'greeting.dawn': 'reminder.greeting.dawn',
  'greeting.early': 'reminder.greeting.early',
  'greeting.morning': 'reminder.greeting.morning',
  'greeting.noon': 'reminder.greeting.noon',
  'greeting.afternoon': 'reminder.greeting.afternoon',
  'greeting.dusk': 'reminder.greeting.dusk',
  'greeting.evening': 'reminder.greeting.evening',
  'greeting.night': 'reminder.greeting.night',
  'closing.dawn': 'reminder.closing.dawn',
  'closing.early': 'reminder.closing.early',
  'closing.morning': 'reminder.closing.morning',
  'closing.noon': 'reminder.closing.noon',
  'closing.afternoon': 'reminder.closing.afternoon',
  'closing.dusk': 'reminder.closing.dusk',
  'closing.evening': 'reminder.closing.evening',
  'closing.night': 'reminder.closing.night',
  'topic.overdue': 'reminder.overdue',
  'topic.dueToday': 'reminder.dueToday',
  'topic.starting': 'reminder.starting',
  'topic.dueSoon': 'reminder.dueSoon',
  'topic.logsOwed': 'reminder.logsOwed',
  'topic.chores': 'reminder.chores',
  'topic.habits': 'reminder.habits',
  'nudge.logs': 'reminder.nudgeLogs',
  'nudge.debt': 'reminder.nudgeDebt',
  'nudge.debtLine': 'reminder.nudgeDebtLine',
  'nudge.tasks': 'reminder.nudgeTasks',
  'group.tasks': 'reminder.groupTasks',
  'group.deadlines': 'reminder.groupDeadlines',
  'report.title': 'reminder.reportTitle',
  'report.empty': 'reminder.reportEmpty',
}

/** Every key the copy editor offers, in the order it shows them. */
export const COPY_KEYS: CopyKey[] = Object.keys(COPY_I18N) as CopyKey[]

/**
 * One block of wording: the user's if they wrote one, the built-in otherwise.
 *
 * A block left empty counts as unsaid, not as "render nothing" — clearing a box
 * in the settings editor is how you undo an edit, so it has to land back on the
 * default rather than on a blank line in a notification.
 *
 * Placeholders are filled by `interpolate`, the same function `translate` uses,
 * so `{name}` behaves identically whether the string came from the dictionary or
 * from the user.
 */
export function copy(key: CopyKey, lang: Lang, overrides?: CopyOverrides, params?: Params): string {
  const custom = overrides?.[key]?.trim()
  if (custom) return interpolate(custom, params)
  return translate(lang, COPY_I18N[key], params)
}

// ─────────────────────────────────────────────────────────────────────────────
// 渲染
// ─────────────────────────────────────────────────────────────────────────────

/** Same order the Gantt uses: deadlines first, then alphabetically. */
function byDateThenName(a: Task, b: Task): number {
  return (
    (a.endDate ?? '').localeCompare(b.endDate ?? '') ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  )
}

/**
 * Every category's items for one day.
 *
 * Split out from rendering because it is the expensive half — `dayStates` and
 * `strictLogObligations` each walk the whole task tree — and it depends only on
 * the day, never on the slot. A fortnight of eight slots is a hundred and twelve
 * messages from fourteen of these calls; calling the helpers per message instead
 * would be a hundred and twelve tree walks to produce the same seven lists.
 *
 * Every category is read from the function that already answers it elsewhere, so
 * the calendar, the Today page and the notification cannot disagree:
 * `milestonesOnDay` for what starts and what lands, `strictLogObligations` for
 * the log debt the day's ring is drawn from.
 */
export function collectDay(board: Board, day: string, leadDays: number): DayCats {
  const { tasks, logs, chores, habits } = board

  // A parent's dates and status are rolled up from its children, so listing the
  // phase next to the child that produced the roll-up spends a line saying the
  // same thing twice. Every other count in the app is taken over leaves too.
  const states = dayStates(tasks, logs, day)
  const children = buildChildrenMap(tasks)
  const isLeaf = (x: Task) => (children.get(x.id) ?? []).length === 0

  const date = (d: string | null) => d ?? day
  const overdues = tasks
    .filter((x) => isLeaf(x) && states.get(x.id)?.status === 'delayed')
    .sort(byDateThenName)
    .map((x): DigestItem => ({ name: x.name, date: date(x.endDate) }))

  const milestones = milestonesOnDay(tasks, states, day)
  const dated = (list: Task[]): DigestItem[] => list.map((x) => ({ name: x.name, date: date(x.endDate) }))

  // Lead-window deadlines: anything landing inside the next `leadDays` days that
  // is not already covered by `dueToday`. Excludes today deliberately — the same
  // task in both "due today" and "due soon" would read as two separate problems.
  const soon: DigestItem[] = isFinite(leadDays) && leadDays > 0
    ? tasks
        .filter(
          (x) =>
            isLeaf(x) &&
            !x.isTodo &&
            x.endDate != null &&
            x.endDate > day &&
            x.endDate <= toISO(addDays(toDate(day), leadDays)) &&
            states.get(x.id)?.status !== 'completed',
        )
        .sort(byDateThenName)
        .map((x): DigestItem => ({ name: x.name, date: date(x.endDate) }))
    : []

  const plain = (names: string[]): DigestItem[] => names.map((name) => ({ name, date: null }))

  // Called once, read twice: the whole set is the report's 任务清单 figure and the
  // unwritten half is this slot-row's `logsOwed`. Two calls would be two tree
  // walks answering the same question.
  const obligations = strictLogObligations(tasks, logs, day)

  return {
    overdue: overdues,
    dueToday: dated(milestones.due),
    starting: dated(milestones.starts),
    dueSoon: soon,
    logsOwed: plain(obligations.filter((o) => !o.logged).map((o) => o.task.name)),
    chores: plain(todaysChores(chores, day).filter((c) => !c.done).map((c) => c.title)),
    habits: plain(
      habitsOn(habits, day)
        .filter((h) => !tickedOn(h, day))
        .map((h) => h.title),
    ),
    obligations: obligations.length,
  }
}

export interface DigestOptions {
  /** The hour, which decides the greeting and nothing else. */
  slot: Slot
  /** The rule's job, which decides the content and nothing else. */
  shape: SlotShape
  /** The user's global filter. A category not in here is never reported. */
  topics: DigestCategory[]
  leadDays: number
  overrides?: CopyOverrides
}

/**
 * The board in one message for one day, one hour and one shape — or `null` if
 * there is nothing to say.
 *
 * `null` rather than an empty message is the important half. A notification that
 * arrives saying nothing is how a person learns to swipe these away unread, and
 * the whole point of the feature is that reaching for it *means* something. It
 * is also why a quiet noon is the normal case rather than a failure: there is
 * often nothing to nudge about.
 */
export function composeDigest(
  board: Board,
  day: string,
  lang: Lang,
  opts: DigestOptions,
): Digest | null {
  return renderFrom(collectDay(board, day, opts.leadDays), day, lang, opts)
}

/**
 * When to send, and what the message is.
 *
 * The shape lives here rather than on the hour, and the clock decides only the
 * greeting — see `SlotShape`. Everything else about a rule is timing: a rule is
 * a moment, and what it says is derived from the day it lands on.
 */
export interface ReminderRule {
  id: string
  /** `HH:mm`, local time. */
  time: string
  /** 0 = Monday … 6 = Sunday, same convention as `Habit.weekdays`. */
  weekdays: number[]
  shape: SlotShape
  enabled: boolean
}

/** As rendering needs it. Kept separate so a disabled rule need not be filtered out twice. */
export type RenderRule = Pick<ReminderRule, 'id' | 'weekdays' | 'shape'>

/**
 * Whether a message can come out of this rule and this hour at all.
 *
 * The `day` shape is for the send that opens the day, and it is the one message
 * that arrives whatever the day holds — see `renderFrom`. Asked here rather than
 * trusted, because the two live in different files and a rule with the wrong
 * shape would produce a plausible message rather than an error.
 */
export function isSlotShape(v: unknown): v is SlotShape {
  return v === 'day' || v === 'nudge'
}

export function isDigestCategory(v: unknown): v is DigestCategory {
  return typeof v === 'string' && (DIGEST_CATEGORIES as string[]).includes(v)
}

/**
 * One message, and the hours it is for.
 *
 * The window travels with the message rather than staying behind in `SLOTS` and
 * being re-derived on the far side. The sender is a different program in a
 * different language, and the only alternative to shipping `from`/`to` is a
 * second copy of the slot table over there — eight boundaries, kept in step by
 * nobody, going wrong the first time one of them moves.
 */
export interface SlotDigest extends Digest {
  /** `HH:mm`, inclusive. */
  from: string
  /** `HH:mm` or `24:00`, exclusive. */
  to: string
}

/** Every message for a day, in the order the slots run. */
export type DayMessages = SlotDigest[]

/**
 * The whole file's worth of messages: day → rule → the day's messages in order.
 *
 * Every slot is rendered rather than only the rule's nominal one, because the
 * sender picks by the clock at the moment it actually sends. A machine that was
 * off at 07:00 and comes on at 20:00 must not be greeted with "good morning" —
 * and pre-rendering is what lets it choose without knowing what a slot is.
 *
 * Days the rule does not run are skipped, and a slot with nothing to say is
 * absent rather than empty — the same convention this has always used, and what
 * keeps the file's size tracking the number of things worth saying rather than
 * the calendar.
 *
 * One exception, and it is why a quiet fortnight is no longer an empty file: the
 * day's opening send reports even a day with nothing on it, because silence and
 * a broken channel look identical at the hour you are checking whether reminders
 * work. So every day the rule runs carries at least that one short line — and it
 * is the only one, on a day with nothing else to say.
 */
export function upcomingDigests(
  board: Board,
  from: string,
  days: number,
  lang: Lang,
  rules: RenderRule[],
  opts: Omit<DigestOptions, 'slot' | 'shape'>,
): Record<string, Record<string, DayMessages>> {
  const out: Record<string, Record<string, DayMessages>> = {}
  for (let i = 0; i < days; i++) {
    const day = toISO(addDays(toDate(from), i))
    const weekday = weekdayIndex(toDate(day))
    const cats = collectDay(board, day, opts.leadDays)
    for (const rule of rules) {
      if (!rule.weekdays.includes(weekday)) continue
      const messages: DayMessages = []
      for (const def of SLOTS) {
        // The cheap half: slice `cats` by the rule's shape and render under this
        // hour's greeting. No tree walking — see `collectDay`.
        const digest = renderFrom(cats, day, lang, { ...opts, slot: def.id, shape: rule.shape })
        if (!digest) continue
        messages.push({ from: def.from, to: def.to, ...digest })
      }
      if (!messages.length) continue
      ;(out[day] ??= {})[rule.id] = messages
    }
  }
  return out
}

/** `composeDigest` for a day whose categories are already collected. */
function renderFrom(
  cats: DayCats,
  day: string,
  lang: Lang,
  opts: DigestOptions,
): Digest | null {
  const allowed = new Set(opts.topics)
  const lines: string[] = []
  /** How many of these categories are ticked, added up. */
  const sum = (of: DigestCategory[]) =>
    of.filter((c) => allowed.has(c)).reduce((n, c) => n + cats[c].length, 0)

  if (opts.shape === 'day') {
    // The report's 今天 section, and only its four rows: 任务清单, 到期与逾期,
    // 临时事务, 日常安排. The first is the day's obligations counted, the second
    // is the three deadline categories added together — which is exactly how the
    // report folds them, into one row that opens on demand.
    //
    // Names never appear. That is the whole difference between this and a `list`
    // slot, and it is the difference that matters: the report answers "how big is
    // today", and a task's name is what you go to the board to find.
    // The user's global filter still applies, and it applies to the *parts* of
    // a figure rather than to the figure: unticking 已逾期 leaves 到期与逾期
    // standing with the other two in it. A row is dropped only when every
    // category under it is.
    const figures: [CopyKey, number][] = []
    // 任务清单 is the day's log obligations, so it goes with the log categories.
    if (allowed.has('logsOwed')) figures.push(['group.tasks', cats.obligations])
    // Every row is gated, including this one, which is the easy one to leave
    // ungated — it is always pushed, so an untick-everything would find a row
    // sitting there with a zero in it and read as a quiet day rather than as
    // the request to be left alone that it was.
    if (DEADLINES.some((c) => allowed.has(c))) figures.push(['group.deadlines', sum(DEADLINES)])
    if (allowed.has('chores')) figures.push(['topic.chores', cats.chores.length])
    if (allowed.has('habits')) figures.push(['topic.habits', cats.habits.length])

    // Everything unticked is not a quiet day, it is a request to be left alone.
    if (!figures.length) return null
    // A quiet day still gets said, in the report's own words for one. The
    // opening send is the one that has to arrive whatever the day holds —
    // silence is indistinguishable from a broken channel at the hour you are
    // checking it.
    if (!figures.some(([, v]) => v)) lines.push(copy('report.empty', lang, opts.overrides))
    else for (const [key, value] of figures) lines.push(`${copy(key, lang, opts.overrides)} · ${value}`)
  } else {
    // "The day's logs are not updated" means *nothing has been written today*,
    // not "not everything has been". The difference is the whole of whether this
    // ever stops: a board with five long-running strict tasks owes five logs
    // every single day of their lives, so the stricter reading leaves the nudge
    // lit no matter how much gets written — which is indistinguishable from it
    // being broken, and is how it was reported.
    const written = cats.obligations - cats.logsOwed.length
    if (!written && cats.logsOwed.length) {
      lines.push(copy('nudge.logs', lang, opts.overrides))
    } else {
      // Three groups, the same three the report's 今天 lists under its log row:
      // the day's dated work, its chores and its routines. Logs are not among
      // them — this is the branch where the log has been attended to, and the
      // one above already had its say about it.
      //
      // A group with nothing in it is dropped rather than printed as a zero: a
      // breakdown is read by adding it up, and a line contributing nothing to
      // that sum is a line the reader has to work out is nothing.
      const groups: [CopyKey, number][] = [
        ['nudge.tasks', sum(DEADLINES)],
        ['topic.chores', allowed.has('chores') ? cats.chores.length : 0],
        ['topic.habits', allowed.has('habits') ? cats.habits.length : 0],
      ]
      const total = groups.reduce((n, [, v]) => n + v, 0)
      if (!total) return null
      lines.push(copy('nudge.debt', lang, opts.overrides, { count: total }))
      for (const [key, value] of groups) {
        if (!value) continue
        lines.push(
          copy('nudge.debtLine', lang, opts.overrides, { count: value, label: copy(key, lang, opts.overrides) }),
        )
      }
    }
  }

  const closing = copy(`closing.${opts.slot}` as CopyKey, lang, opts.overrides).trim()
  if (closing) lines.push('', closing)

  return {
    title: copy(`greeting.${opts.slot}` as CopyKey, lang, opts.overrides),
    body: lines.join('\n'),
  }
}

/**
 * A message that always has something in it.
 *
 * For the "send a test" button only. `composeDigest` returns `null` on a quiet
 * day, which is right for a push and useless for proving a channel works — the
 * one moment the user most needs a message is the one moment their board is most
 * likely to be empty. The caller prefers the real digest when there is one.
 */
export function testDigest(lang: Lang, overrides?: CopyOverrides): Digest {
  return {
    title: translate(lang, 'reminder.testTitle'),
    body: copy('report.empty', lang, overrides) || translate(lang, 'reminder.testBody'),
  }
}

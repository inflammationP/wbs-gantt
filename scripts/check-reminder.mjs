/**
 * The checks on what a notification says and when — run with
 * `node scripts/check-reminder.mjs`.
 *
 * `composeDigest` is the whole of what leaves the machine: it decides which of
 * seven categories an hour reports, reads each from the function that already
 * answers it elsewhere, and renders the text. Nothing downstream inspects the
 * result — it is posted to a screen and read by a person — so a category that
 * silently emptied, or a slot that started reporting the wrong things, would look
 * like nothing at all until someone noticed their reminders had gone strange.
 *
 * Four groups, and each is here because its failure is quiet:
 *
 * **The slot table tiles the day.** A gap means "a rule set in this hour never
 * fires"; an overlap means "this hour is ambiguous". Neither is visible by
 * reading the table.
 *
 * **A quiet hour says nothing.** `null` rather than an empty message, because a
 * notification that says "nothing today" is how a person learns to swipe these
 * away unread — and the whole point of the feature is that reaching for the
 * screen *means* something.
 *
 * **An hour reports what its row says, and only that.** The midday slots report
 * one category on purpose; a change that made them report everything would still
 * look plausible on screen.
 *
 * **The user's wording wins, and an empty box is not wording.** Clearing a box in
 * the settings editor has to land back on the built-in string, not on a blank
 * line in someone's notification.
 *
 * No framework, nothing mocked: `src/lib/reminder.ts` is loaded straight from
 * source by Vite, the same way the other checks load theirs.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const mod = await server.ssrLoadModule('/src/lib/reminder.ts')
const { SLOTS, slotAt, composeDigest, upcomingDigests, copy, testDigest, collectDay, DIGEST_CATEGORIES, DIGEST_WINDOW_DAYS } = mod

const DAY = '2026-09-26'
const LEAD = 3

// ── the slot table tiles the day ────────────────────────────────────────────
assert.equal(SLOTS[0].from, '00:00', 'the first slot must start at midnight')
assert.equal(SLOTS[SLOTS.length - 1].to, '24:00', 'the last slot must end at midnight')
for (let i = 0; i < SLOTS.length - 1; i++) {
  assert.equal(SLOTS[i].to, SLOTS[i + 1].from, `slot ${SLOTS[i].id} must end where ${SLOTS[i + 1].id} begins`)
}
// Every slot is a greeting and a window, and nothing else. The shape used to
// live here and that is exactly what went wrong: a fixed send landing in a
// backstop slot changed its content with the hour, which is how task names got
// into a notification that was supposed to carry four numbers.
for (const s of SLOTS) {
  assert.equal(s.topics, undefined, `slot ${s.id} must not choose what is reported`)
  assert.equal(s.shape, undefined, `slot ${s.id} must not choose the shape`)
}

// Boundaries land on the slot that starts there, not the one that ended.
assert.equal(slotAt('00:00'), SLOTS[0].id)
for (const s of SLOTS.slice(1)) assert.equal(slotAt(s.from), s.id, `${s.from} must fall in ${s.id}`)
assert.equal(slotAt('23:59'), SLOTS[SLOTS.length - 1].id)

// ── fixtures ────────────────────────────────────────────────────────────────
const task = (over) => ({
  id: 'x', name: 'x', description: '', parentId: null, projectId: 'p',
  type: 'phase', isTodo: false,
  startDate: '2026-09-01', endDate: '2026-09-30',
  strictProgress: true, confirmedDays: [],
  paused: false, pauseDate: null, pauses: [],
  priority: null, tags: [], dependencies: [],
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
})
const chore = (over) => ({
  id: 'c', title: 'c', note: '', date: '2026-09-20',
  done: false, completedDate: null,
  createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z',
  ...over,
})
const habit = (over) => ({
  id: 'h', title: 'h', note: '',
  startDate: '2026-01-01', endDate: null,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  paused: false, pauseDate: null, pauses: [], doneDays: [],
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})
const log = (over) => ({
  id: 'l', taskId: 'x', date: DAY, content: '',
  targetProgress: null,
  createdAt: `${DAY}T00:00:00.000Z`, updatedAt: `${DAY}T00:00:00.000Z`,
  ...over,
})
const board = (over) => ({ tasks: [], logs: [], chores: [], habits: [], ...over })

/** A board with exactly one item in each of the seven categories. */
const FULL = board({
  tasks: [
    task({ id: 'late', name: '已逾期的事', startDate: '2026-09-01', endDate: '2026-09-20' }),
    task({ id: 'lands', name: '今天到期的事', startDate: '2026-09-01', endDate: DAY, strictProgress: false }),
    task({ id: 'starts', name: '今天开始的事', startDate: DAY, endDate: '2026-10-20', strictProgress: false }),
    task({ id: 'soon', name: '快到期的事', startDate: '2026-09-01', endDate: '2026-09-28', strictProgress: false }),
  ],
  chores: [chore({ title: '待办的事' })],
  habits: [habit({ title: '习惯的事' })],
})

const opts = (over) => ({ slot: 'early', shape: 'day', topics: [...DIGEST_CATEGORIES], leadDays: LEAD, ...over })

/** The heading lines a message contains — the shape the opening send has. */
const headings = (body) => body.split('\n').filter((l) => l.includes(' · '))

// ── a quiet day says nothing, except to the send that opens it ──────────────
// The hour no longer decides any of this, so every hour is asked the same two
// questions and must give the same two answers.
for (const s of SLOTS) {
  assert.equal(
    composeDigest(board({}), DAY, 'zh', opts({ slot: s.id, shape: 'nudge' })),
    null,
    `${s.id} must be silent when there is nothing to nudge about`,
  )
}

// The day's opening send is the one exception, and on purpose: at the hour you
// are checking whether reminders work at all, silence and a broken channel look
// exactly alike. It says the report's own line for an empty day instead.
{
  const d = composeDigest(board({}), DAY, 'zh', opts({ slot: 'early' }))
  assert.ok(d, 'the opening send must arrive whatever the day holds')
  assert.equal(d.body, copy('report.empty', 'zh'), 'and use the report’s words for a day with nothing on it')
}
// A strict task that has come due owes a log whatever its deadline is, so
// "outside every deadline window" is not the same question as "silent" — a day
// with an unwritten log is a day with something to nudge about. The pair is told
// apart by the obligation.
{
  const far = (strict) =>
    board({ tasks: [task({ id: 'later', name: '很久以后', endDate: '2026-12-01', strictProgress: strict })] })
  assert.equal(
    composeDigest(far(false), DAY, 'fr', opts({ shape: 'nudge' })),
    null,
    'a task outside every window, owing no log, must not produce a message',
  )
  assert.equal(
    composeDigest(far(true), DAY, 'fr', opts({ shape: 'nudge' })).body,
    copy('nudge.logs', 'fr'),
    'a strict task that has come due owes a log, however far off its deadline',
  )
}

// ── the opening send is the report's four figures, and no names ─────────────
// "完完全全按日报里的发" is a statement about content, and the report has never
// named a task. So the assertion that matters most here is the one about what is
// *absent*: a name anywhere in the body means this has quietly gone back to
// being a listing, which is a different message wearing the same title.
{
  const d = composeDigest(FULL, DAY, 'zh', opts({ slot: 'early' }))
  assert.ok(d)
  assert.deepEqual(
    d.body.split('\n'),
    [
      `${copy('group.tasks', 'zh')} · 1`,
      `${copy('group.deadlines', 'zh')} · 3`,
      `${copy('topic.chores', 'zh')} · 1`,
      `${copy('topic.habits', 'zh')} · 1`,
    ],
    'the opening send must be the report’s four rows, in its order',
  )
  for (const named of ['已逾期的事', '今天到期的事', '待办的事', '习惯的事']) {
    assert.ok(!d.body.includes(named), `the opening send must not name ${named}`)
  }
}

// ── a nudge says one thing about the whole day ──────────────────────────────
// One line, and which line is a fact about the day rather than about the hour.
// Asserted in *every* hour, because that is the regression: the shape used to
// come from the slot, so a nudge that landed at eleven at night came out as a
// backstop slot's message with a list of task names in it.
{
  for (const s of SLOTS) {
    const nudge = { slot: s.id, shape: 'nudge' }

    const owed = composeDigest(FULL, DAY, 'zh', opts(nudge))
    assert.ok(owed, `${s.id} must say something while logs are owed`)
    assert.equal(owed.body, copy('nudge.logs', 'zh'), `${s.id} must ask for the log and nothing else`)
    assert.deepEqual(headings(owed.body), [], `${s.id} must not list anything`)

    // Five: the overdue task, the one due today, the one coming up, the chore
    // and the habit. Not the task starting today — that is not in any of the
    // three groups. Written out in full, because the breakdown *is* the message:
    // a header alone, or a header whose parts do not add up to it, is the
    // failure this shape can actually have.
    const settled = composeDigest(board({ ...FULL, logs: [log({ taskId: 'late' })] }), DAY, 'zh', opts(nudge))
    assert.deepEqual(
      settled.body.split('\n'),
      [
        copy('nudge.debt', 'zh', undefined, { count: 5 }),
        copy('nudge.debtLine', 'zh', undefined, { count: 3, label: copy('nudge.tasks', 'zh') }),
        copy('nudge.debtLine', 'zh', undefined, { count: 1, label: copy('topic.chores', 'zh') }),
        copy('nudge.debtLine', 'zh', undefined, { count: 1, label: copy('topic.habits', 'zh') }),
      ],
      `${s.id} must break the count down into the three groups`,
    )

    // One log written and others still owed is *not* "the logs are unwritten" —
    // the case the shape turns on, and the one that was wrong: the nudge stayed
    // lit after the day had been worked on, which reads as the app not noticing.
    const partly = board({
      ...FULL,
      tasks: [...FULL.tasks, task({ id: 'other', name: '另一件事', startDate: '2026-09-02', endDate: '2026-09-30' })],
      logs: [log({ taskId: 'late' })],
    })
    const after = composeDigest(partly, DAY, 'zh', opts(nudge))
    assert.ok(!after.body.includes(copy('nudge.logs', 'zh')), `${s.id} must stop asking for a log once one is written`)
    assert.ok(after.body.startsWith(copy('nudge.debt', 'zh', undefined, { count: 5 })), `${s.id} must count what is left`)

    // A group with nothing in it is left out rather than printed as a zero —
    // a line contributing nothing to a sum is a line the reader has to work out
    // is nothing.
    const noChores = board({ ...FULL, chores: [], logs: [log({ taskId: 'late' })] })
    assert.deepEqual(
      composeDigest(noChores, DAY, 'zh', opts(nudge)).body.split('\n'),
      [
        copy('nudge.debt', 'zh', undefined, { count: 4 }),
        copy('nudge.debtLine', 'zh', undefined, { count: 3, label: copy('nudge.tasks', 'zh') }),
        copy('nudge.debtLine', 'zh', undefined, { count: 1, label: copy('topic.habits', 'zh') }),
      ],
      `${s.id} must drop an empty group rather than print a zero`,
    )

    // Nothing owed and nothing open: nothing to say, and it says nothing rather
    // than arriving with an empty line.
    const clear = board({ logs: [log({ taskId: 'only', date: DAY })] })
    assert.equal(composeDigest(clear, DAY, 'zh', opts(nudge)), null, `${s.id} must be silent on a clear day`)
  }
}

// ── the greeting is the hour's, the content is the rule's ───────────────────
// The whole point of the split. The same nudge in two different hours must carry
// two different titles and one identical body; a change that let the hour back
// into the content would show up here first.
{
  const a = composeDigest(FULL, DAY, 'zh', opts({ slot: 'dawn', shape: 'nudge' }))
  const b = composeDigest(FULL, DAY, 'zh', opts({ slot: 'night', shape: 'nudge' }))
  assert.equal(a.body, b.body, 'the hour must not change what a nudge says')
  assert.notEqual(a.title, b.title, 'but it must change how it opens')
  assert.equal(a.title, copy('greeting.dawn', 'zh'))
  assert.equal(b.title, copy('greeting.night', 'zh'))
}

// ── the user's filter wins over the shape ───────────────────────────────────
{
  const d = composeDigest(FULL, DAY, 'zh', opts({ topics: ['chores'] }))
  assert.ok(d)
  assert.deepEqual(
    headings(d.body).map((h) => h.split(' · ')[0]),
    [copy('topic.chores', 'zh')],
    'an unticked category must never appear',
  )
  assert.equal(
    composeDigest(FULL, DAY, 'zh', opts({ topics: [] })),
    null,
    'unticking everything must silence the send rather than post an empty message',
  )
}

// ── …and it reaches inside a figure rather than dropping the whole row ──────
{
  const d = composeDigest(FULL, DAY, 'zh', opts({ slot: 'early', topics: ['overdue', 'chores'] }))
  assert.ok(d)
  assert.deepEqual(
    d.body.split('\n'),
    [`${copy('group.deadlines', 'zh')} · 1`, `${copy('topic.chores', 'zh')} · 1`],
    'a figure counts only the categories still ticked, and a row with none left goes',
  )

  // The one case where the opening send is allowed to say nothing: not a quiet
  // day, but a request not to be told about any of it.
  assert.equal(composeDigest(FULL, DAY, 'zh', opts({ slot: 'early', topics: [] })), null)
}

// ── the lead window is inclusive of day N, exclusive of N+1 ─────────────────
// Asked of the categories rather than of a message, because the opening send
// folds 快到期 in with the other two and answers the same for all three: what
// used to be read off a heading is now inside a figure, and the figure is the
// wrong place to look.
{
  const at = (endDate) => board({ tasks: [task({ id: 'e', name: '边界', endDate, strictProgress: false })] })
  const soon = (endDate) => collectDay(at(endDate), DAY, LEAD).dueSoon.length
  assert.equal(soon('2026-09-29'), 1, 'day + leadDays must be inside the window')
  assert.equal(soon('2026-09-30'), 0, 'day + leadDays + 1 must not be')
  assert.equal(soon(DAY), 0, 'today belongs to "due today", not to "coming up"')
  assert.equal(collectDay(at(DAY), DAY, LEAD).dueToday.length, 1, 'and it is due today')
}

// ── done work drops out ─────────────────────────────────────────────────────
{
  const d = composeDigest(
    board({
      chores: [chore({ title: '交电费', done: true, completedDate: DAY })],
      habits: [habit({ title: '跑步', doneDays: [DAY] })],
    }),
    DAY,
    'zh',
    opts({ shape: 'nudge' }),
  )
  assert.equal(d, null, 'finished work must not be reported as outstanding')
}

// ── a parent never appears beside the child that produced its dates ─────────
{
  // A listing slot, and one of the backstops rather than the opening send: the
  // opening send and the nudges only ever count, so neither could tell a leaf
  // from a roll-up if it wanted to. Asserted on the categories themselves, which
  // is where the distinction is actually made — no message names a task now.
  const cats = collectDay(
    board({
      tasks: [
        task({ id: 'parent', name: '阶段任务', endDate: DAY, strictProgress: false }),
        task({ id: 'child', name: '子任务', parentId: 'parent', endDate: DAY, strictProgress: false }),
      ],
    }),
    DAY,
    LEAD,
  )
  assert.deepEqual(
    cats.dueToday.map((i) => i.name),
    ['子任务'],
    'the leaf is counted and the roll-up parent is not',
  )
}

// ── the user's wording wins; a blank box does not ───────────────────────────
{
  assert.equal(copy('topic.overdue', 'zh'), '已逾期', 'with no override the built-in string is used')
  assert.equal(copy('topic.overdue', 'zh', { 'topic.overdue': '拖了很久' }), '拖了很久', 'an override wins')
  assert.equal(copy('topic.overdue', 'zh', { 'topic.overdue': '   ' }), '已逾期', 'whitespace is an empty box, not wording')
  assert.equal(copy('topic.overdue', 'en'), 'Overdue', 'the fallback follows the language')

  const d = composeDigest(FULL, DAY, 'zh', opts({ slot: 'evening', overrides: { 'greeting.evening': '收工了' } }))
  assert.equal(d.title, '收工了', 'the greeting is overridable')
  assert.ok(d.body.includes('拖了很久') === false, 'an override for one key does not leak into another')

  // A renamed category reaches a message through a group label, not through a
  // heading of its own — there are no per-category headings any more. 到期与逾期
  // is the one group that carries a category's name into the nudge's breakdown.
  // The log has to be written first: until it is, the nudge is still on its
  // opening line and the breakdown — the only place a group label appears — has
  // not been reached.
  const settled = board({ ...FULL, logs: [log({ taskId: 'late' })] })
  const renamed = composeDigest(settled, DAY, 'zh', opts({ shape: 'nudge', overrides: { 'nudge.tasks': '拖了很久' } }))
  assert.ok(renamed.body.includes('拖了很久'), 'a renamed group label carries its count')
}

// ── closings ship empty, and an empty closing leaves no trailing blank ─────
{
  const d = composeDigest(FULL, DAY, 'zh', opts({ slot: 'early' }))
  assert.ok(!d.body.endsWith('\n'), 'no trailing newline')
  assert.ok(!d.body.endsWith('\n\n'), 'and no trailing blank line')
  const withClosing = composeDigest(FULL, DAY, 'zh', opts({ slot: 'early', overrides: { 'closing.early': '加油' } }))
  assert.ok(withClosing.body.endsWith('\n\n加油'), 'a closing is set off by a blank line')
  assert.equal(withClosing.title, d.title, 'and does not disturb the greeting')
}

// ── the file the sender reads ───────────────────────────────────────────────
{
  const rules = [
    { id: 'r-allday', weekdays: [0, 1, 2, 3, 4, 5, 6], shape: 'day' },
    { id: 'r-monday', weekdays: [0], shape: 'nudge' },
  ]
  const tree = upcomingDigests(FULL, DAY, DIGEST_WINDOW_DAYS, 'zh', rules, { topics: [...DIGEST_CATEGORIES], leadDays: LEAD })

  assert.ok(tree[DAY], 'today must be rendered')
  assert.ok(tree[DAY]['r-allday'], 'an every-day rule must have today')
  assert.equal(Object.keys(tree[DAY]).length, 1, 'and nothing under a rule name it does not have')

  // 0 = Monday, the same convention `Habit.weekdays` uses.
  const weekday = (iso) => (new Date(`${iso}T00:00:00`).getDay() + 6) % 7
  assert.equal(
    Boolean(tree[DAY]['r-monday']),
    weekday(DAY) === 0,
    'a Monday-only rule appears on Monday and on no other day',
  )
  assert.ok(
    Object.keys(tree).some((d) => tree[d]['r-monday']),
    'and the window is long enough that some Monday falls inside it',
  )

  // Each message carries the hours it is for, in order and never overlapping —
  // which is the whole of what the sender needs to pick one, and the reason it
  // can pick without knowing what a slot is. Gaps are fine and are the quiet
  // hours: a window with nothing in it is a window nothing is sent in.
  const messages = tree[DAY]['r-allday']
  assert.ok(messages.length > 0, 'a busy board must produce at least one message')
  assert.equal(messages[0].from, '00:00', 'the first message must start at midnight')
  assert.equal(messages[messages.length - 1].to, '24:00', 'the last must run to midnight')
  for (let i = 0; i < messages.length - 1; i++) {
    assert.ok(messages[i].to <= messages[i + 1].from, 'a message must not overlap the next')
  }
  for (const m of messages) {
    assert.ok(/^\d{2}:\d{2}$/.test(m.from) && /^\d{2}:\d{2}$/.test(m.to), `${m.from}–${m.to} must be clock times`)
    assert.ok(m.title && m.body, 'every message must have something to say')
  }

  // A quiet fortnight is not empty, and that is the opening send doing its job —
  // it is the one that arrives whatever the day holds. What must still hold is
  // that the *nudge* rules write nothing at all.
  //
  // The opening send is written once per hour rather than once per day, because
  // it is the same body under eight different greetings and the sender picks by
  // the clock — which is the whole reason the hours are in the file. Eight short
  // lines a day is the price of a message that still knows what time it is when
  // it finally goes out.
  const quiet = upcomingDigests(board({}), DAY, DIGEST_WINDOW_DAYS, 'zh', rules, { topics: [...DIGEST_CATEGORIES], leadDays: LEAD })
  assert.equal(Object.keys(quiet).length, DIGEST_WINDOW_DAYS, 'the opening send must reach every day in the window')
  for (const [day, byRule] of Object.entries(quiet)) {
    assert.deepEqual(Object.keys(byRule), ['r-allday'], `${day} must hold the opening send and nothing else`)
    const quietMessages = byRule['r-allday']
    assert.equal(quietMessages.length, SLOTS.length, `${day} must hold one message per hour`)
    for (const m of quietMessages) {
      assert.equal(m.body, copy('report.empty', 'zh'), `${day} must carry the report’s empty-day line`)
    }
  }
}

// ── the test message is never blank ─────────────────────────────────────────
{
  const t = testDigest('zh')
  assert.ok(t.title && t.body, 'the test message must not be blank')
}

await server.close()
console.log('check-reminder: ok')

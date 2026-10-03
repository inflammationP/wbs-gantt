/**
 * The one check on the chore day rules, run with
 * `node scripts/check-chores.mjs`.
 *
 * No framework, and nothing mocked: `src/lib/chores.ts` is loaded straight from
 * source by Vite, the same way `check-heatmap.mjs` loads the heatmap.
 *
 * What is being pinned down is the rollover rule, which is the subtle part of
 * the whole feature. A chore's `date` records the day it was *put on* and is
 * never rewritten, so "what is on today" is answered at read time instead of by
 * a nightly rewrite — which is what lets a slipped chore still say how long it
 * has slipped, and keeps the day it was originally meant for readable.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { todaysChores, plannedFor, choresTouching, carriedSince, choreGroups, slotOfTime, parseChoreTime } =
  await server.ssrLoadModule('/src/lib/chores.ts')

const TODAY = '2026-09-17'
const TOMORROW = '2026-09-18'

// `createdAt` is written out per chore rather than generated: the order two
// chores of the same day come back in is part of what is being checked, and a
// counter would hide a sort that had stopped reading it.
const chore = (id, date, over = {}) => ({
  id,
  title: id,
  note: '',
  date,
  done: false,
  completedDate: null,
  createdAt: `${date}T09:00:00Z`,
  updatedAt: '',
  ...over,
})

const ids = (list) => list.map((c) => c.id)

const ALL = [
  // Written Monday, never finished — the case the whole feature exists for.
  chore('a', '2026-09-15'),
  // Two put on today, in the order they were added.
  chore('b', TODAY),
  chore('c', TODAY, { createdAt: `${TODAY}T10:00:00Z` }),
  // Written Monday and finished Monday: a closed fact, not today's business.
  chore('d', '2026-09-15', { done: true, completedDate: '2026-09-15' }),
  // Put on today and finished today: stays as today's tally.
  chore('e', TODAY, { createdAt: `${TODAY}T11:00:00Z`, done: true, completedDate: TODAY }),
  // Lined up for tomorrow.
  chore('f', TOMORROW),
  // Written for tomorrow, ticked early, today.
  chore('g', TOMORROW, { createdAt: `${TODAY}T12:00:00Z`, done: true, completedDate: TODAY }),
]

// Today holds what has come due and is still open, plus what was finished
// today — `a` carried in, `b`/`c` put on, `e` ticked off, `g` ticked early.
// `d` is out because it was closed before today; `f` because it is not due yet.
// Carried work leads, because the sort is by the day each was put on.
assert.deepEqual(ids(todaysChores(ALL, TODAY)), ['a', 'b', 'c', 'e', 'g'])

// Carrying forward is a read, not a write: the slipped chore is listed under
// today while still saying it was written on the 15th. This is the assertion
// that would fail if anything ever "helpfully" restamped the date.
const carried = todaysChores(ALL, TODAY).find((c) => c.id === 'a')
assert.equal(carried.date, '2026-09-15')
assert.deepEqual(ids(ALL), ['a', 'b', 'c', 'd', 'e', 'f', 'g']) // input untouched

// Tomorrow: a plan, so strictly the chores written for it and still open. `g`
// was ticked early and is gone; `a` and `b` are not pulled forward into a day
// that has not happened.
assert.deepEqual(ids(plannedFor(ALL, TOMORROW)), ['f'])

// The day after that: yesterday's tally is over. `e` was finished today, so by
// tomorrow it is a closed fact like `d` — this is what makes a ticked chore
// leave on its own without anything having to sweep it away.
assert.deepEqual(ids(todaysChores(ALL, TOMORROW)), ['a', 'b', 'c', 'f'])
// ...and `g`, ticked early, does not come back around when its day arrives.
assert.equal(todaysChores(ALL, TOMORROW).some((c) => c.id === 'g'), false)

// A day's account of itself: what was put on it, and what was finished on it —
// two different sets, since work slips. `g` belongs to the 17th because that is
// when the work happened, not the 18th it was written for, which is the same
// choice the heatmap's shading makes.
assert.deepEqual(ids(choresTouching(ALL, TODAY)), ['b', 'c', 'e', 'g'])
assert.deepEqual(ids(choresTouching(ALL, '2026-09-15')), ['a', 'd'])
// The 18th has what was written for it — `g` included, because it *was* the
// 18th's, however early it got done. This is where the panel and the page part
// ways on purpose: `plannedFor` leaves `g` out, being a plan, and a plan has no
// room for something already finished. A record does.
assert.deepEqual(ids(choresTouching(ALL, TOMORROW)), ['g', 'f'])
// A day nothing touches is empty rather than absent, so the panel can tell a
// quiet day from a failed lookup.
assert.deepEqual(choresTouching(ALL, '2026-01-01'), [])

// Carried-ness runs backwards: a chore put on four days ago is -4, so it reads
// "4 days ago" rather than "in 4 days". The wrong sign here does not look like a
// bug, it looks like a chore that is due later this week.
assert.equal(carriedSince(chore('a', '2026-09-13'), TODAY), -4)
assert.equal(carriedSince(chore('a', TODAY), TODAY), 0)
// Still negative for a chore put on for tomorrow — it has not been carried at
// all, and nothing renders this for it, but the sign must not flip.
assert.equal(carriedSince(chore('a', TOMORROW), TODAY), 1)

// An empty board is not a special case anywhere.
assert.deepEqual(todaysChores([], TODAY), [])
assert.deepEqual(plannedFor([], TOMORROW), [])
assert.deepEqual(choresTouching([], TODAY), [])


// --- the time of day -------------------------------------------------------

// Both clocks, because both are typed. `pm` is the whole difference between
// them: with no suffix the hour is read as it stands, so `9:30` is nine in the
// morning and `21:30` is the same instant as `9:30pm`. What comes back is
// always the `HH:MM` that gets stored.
assert.equal(parseChoreTime('9:30'), '09:30')
assert.equal(parseChoreTime('09:30'), '09:30')
assert.equal(parseChoreTime('21:30'), '21:30')
assert.equal(parseChoreTime('9:30pm'), '21:30')
assert.equal(parseChoreTime('9:30 PM'), '21:30')
assert.equal(parseChoreTime('9:30pm.'), '21:30')
assert.equal(parseChoreTime('12am'), '00:00')
assert.equal(parseChoreTime('12pm'), '12:00')
assert.equal(parseChoreTime('12:00am'), '00:00')
// `点`/`时`/`半`, which is what a hand reaches for in a text field.
// Case, spaces and full-width are all folded before anything is read: a time
// typed on a Chinese IME in 全角 mode is the same time, and someone typing
// `9 : 30 PM` means one thing by it. Spaces are dropped wherever they fall,
// including around the colon and in front of the suffix.
assert.equal(parseChoreTime('9:30PM'), '21:30')
assert.equal(parseChoreTime('9:30Pm'), '21:30')
assert.equal(parseChoreTime('9 : 30 pm'), '21:30')
assert.equal(parseChoreTime(String.fromCharCode(9) + '9:30' + String.fromCharCode(10)), '09:30')
// Half-width digits and colon come back as half-width, so what is stored is
// `HH:MM` and nothing else — the displayed value must not keep the wide forms.
assert.equal(parseChoreTime('９：３０'), '09:30')
assert.equal(parseChoreTime('９：３０ＰＭ'), '21:30')
assert.equal(parseChoreTime('９点３０'), '09:30')
// The ideographic space is whitespace like any other, so a time pasted from
// somewhere that uses it is still a time.
assert.equal(parseChoreTime('　9:30　'), '09:30')

assert.equal(parseChoreTime('9点'), '09:00')
assert.equal(parseChoreTime('9点半'), '09:30')
assert.equal(parseChoreTime('21时15'), '21:15')
// Nothing typed and nothing readable are both null — the caller tells them
// apart by the text being empty, since only the second is worth refusing a save
// over.
assert.equal(parseChoreTime(''), null)
assert.equal(parseChoreTime('   '), null)
assert.equal(parseChoreTime('morning'), null)
assert.equal(parseChoreTime('25:00'), null)
assert.equal(parseChoreTime('13pm'), null)
assert.equal(parseChoreTime('9:70'), null)

// The boundaries, each asserted on both sides: an hour belongs to the slot it
// starts, so the four tile the day with no minute in two of them and none in
// none. This is the whole content of `slotOfTime`, and a boundary moved by one
// here is a chore filed a slot away from where the reader put it.
assert.equal(slotOfTime('00:00'), 'dawn')
assert.equal(slotOfTime('06:59'), 'dawn')
assert.equal(slotOfTime('07:00'), 'am')
assert.equal(slotOfTime('11:59'), 'am')
assert.equal(slotOfTime('12:00'), 'pm')
assert.equal(slotOfTime('17:59'), 'pm')
assert.equal(slotOfTime('18:00'), 'eve')
assert.equal(slotOfTime('23:59'), 'eve')
// Asked of the same lenient reading, so a hand-written time answers here too.
assert.equal(slotOfTime('9:30pm'), 'eve')
assert.equal(slotOfTime(''), null)
assert.equal(slotOfTime(null), null)

// --- the day's slots -------------------------------------------------------

// Deliberately out of slot order, and with the two chores that share a slot
// listed so that neither the input order nor the id order is the answer — what
// puts `m` first inside `am` is that it has a time and `q` does not.
const GROUPED = [
  chore('n', TODAY, { slot: 'am' }),
  chore('m', TODAY, { slot: 'am', time: '09:30' }),
  chore('q', TODAY, { slot: 'am' }),
  chore('o', TODAY, { slot: 'eve', time: '19:00' }),
  // A slot word nothing knows, from a hand-edited file. It keeps the chore on
  // the day, in the unnamed group, rather than dropping it over a typo.
  chore('r', TODAY, { slot: 'noon' }),
  chore('p', TODAY),
]

// A day runs dawn, am, pm, eve, and only then what nobody said. Empty slots are
// dropped rather than drawn empty, which is why `dawn` and `pm` are absent.
const groups = choreGroups(GROUPED)
assert.deepEqual(
  groups.map((g) => g.slot),
  ['am', 'eve', null],
)
// Inside `am`: the timed chore first, then the untimed ones in the order they
// were added. `m` has the latest id of the three and still leads, so this is
// the time deciding and not the tiebreak.
assert.deepEqual(ids(groups[0].chores), ['m', 'n', 'q'])
assert.deepEqual(ids(groups[1].chores), ['o'])
// `p` (no slot at all) and `r` (a slot word nothing knows) land together here:
// neither was given a part of the day, and the unnamed group is what "nobody
// said" means — including "said something unreadable". Same createdAt, so the
// id breaks the tie exactly as `byPlan` broke it before there were any slots.
assert.deepEqual(ids(groups[2].chores), ['p', 'r'])

// Times order the block, but only *within* it: a chore that says 06:00 is not
// pulled out of the evening it was filed under, because the slot was the answer
// to a question the time does not get to overrule. This is the pair the dialog
// asks about when both are on screen at once.
const disagreed = choreGroups([chore('a', TODAY, { slot: 'eve', time: '06:00' })])
assert.deepEqual(
  disagreed.map((g) => g.slot),
  ['eve'],
)

// Nothing slotted anywhere: one unnamed group, which is the section's cue to
// draw the flat list it has always drawn.
const plain = choreGroups(ALL)
assert.deepEqual(
  plain.map((g) => g.slot),
  [null],
)
assert.equal(plain[0].chores.length, ALL.length)
// One group, but a *named* one — the case the feature exists for ("these just
// need doing in the morning"), and the reason the heading rule the section uses
// is not `groups.length > 1`.
assert.deepEqual(
  choreGroups([chore('m', TODAY, { slot: 'am' })]).map((g) => g.slot),
  ['am'],
)
assert.deepEqual(choreGroups([]), [])

await server.close()
console.log('chores: ok')

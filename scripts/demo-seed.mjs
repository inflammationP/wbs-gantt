/**
 * Writes the demo board out as a JSON file you can import, run with
 * `node scripts/demo-seed.mjs`.
 *
 * `src/lib/seed.ts` on `main` stays the empty stub it is — nothing here is
 * imported by the app, so none of this data reaches a new install, and the file
 * it writes is gitignored. This is a way to put a filled board in front of
 * yourself locally, not a way to ship one.
 *
 * The dataset is `seed-v0.5.0.ts` at the repo root, which is a copy of `seed.ts`
 * parked there the last time it was taken off `main`. It knows nothing about
 * habits — those postdate it — so `HABIT_SPECS` below is added on top.
 *
 * That archive imports `'../types'` and `'./dates'`, written as though it still
 * sat in `src/lib/`. Rather than move or rewrite it, the two specifiers are
 * aliased back to where they point. For everything under `src/` the alias lands
 * on the same file the relative path already reached, so it changes nothing
 * there — it only rescues the archive.
 *
 * Import the result from the sidebar's import button. It replaces the whole
 * board, so do it on an empty one.
 */
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

// The archive's two specifiers, pointed back at the files they were written for.
const alias = [
  { find: '../types', replacement: resolve('src/types.ts') },
  { find: './dates', replacement: resolve('src/lib/dates.ts') },
]

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  resolve: { alias },
  // Nothing is served here, only transformed on demand. Without this the entry
  // scan walks `index.html` and every HTML file `src-tauri/target` has ever
  // generated, then complains about being shut down mid-scan.
  optimizeDeps: { entries: [] },
})
const { buildSeed } = await server.ssrLoadModule('/seed-v0.5.0.ts')
const { parseImport } = await server.ssrLoadModule('/src/store/storage.ts')
const { habitsOn, runsOn } = await server.ssrLoadModule('/src/lib/habits.ts')
const { toDate, weekdayIndex } = await server.ssrLoadModule('/src/lib/dates.ts')
const { archiveCascade, buildRows, effectiveStates, isArchived, liveTasks } = await server.ssrLoadModule('/src/lib/tree.ts')
const { paragraphs } = await server.ssrLoadModule('/src/lib/logs.ts')
const { timelineRange } = await server.ssrLoadModule('/src/lib/timeline.ts')

/** yyyy-MM-dd, `offset` days from today — the same arithmetic the archive uses. */
function isoOffset(offset) {
  const t = new Date()
  t.setDate(t.getDate() + offset)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** Monday-first, the order `Habit.weekdays` uses: 0 = Mon … 6 = Sun. */
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

/**
 * Four habits, spread over the last three weeks, covering all four of the
 * fields the daily list has beyond a name.
 *
 * `start` is a day offset from today — the day it was put on, never rewritten.
 * `done` is the offsets it was ticked on, ascending, which is the order the
 * store appends in; nothing reads the order, but a shuffled one would be the
 * first sign of something having rewritten the list. Every `done` offset has to
 * fall on one of that habit's `days` and inside its range — the store would
 * refuse to record one that did not, so an inconsistent fixture here would be
 * data the app can no longer produce.
 */
const HABIT_SPECS = [
  {
    // Mondays, Wednesdays and Fridays, ticked on every one of them since it
    // started. Derived rather than listed: which offsets are Mondays depends on
    // what day the script is run, and a written-out list would be right exactly
    // once.
    id: 'hb-run',
    title: 'Run 20 min',
    note: 'Easy pace, 3 km is enough',
    start: -21,
    days: [0, 2, 4],
    done: offsetsMatching([0, 2, 4], -21, -1),
  },
  {
    // Every day, ticked today: the one struck line in today's column.
    id: 'hb-deck',
    title: 'Review the Anki deck',
    note: 'Green cards only, 20 min',
    start: -21,
    days: EVERY_DAY,
    done: [-19, -18, -16, -13, -11, -9, -7, -4, -2, 0],
  },
  {
    // Started a week ago — absent from every day before that.
    id: 'hb-read',
    title: 'Read one paper section',
    note: '',
    start: -7,
    days: EVERY_DAY,
    done: [-6, -5, -2],
  },
  {
    // Already over. It ran its three weeks and stopped: gone from today, still
    // in the record of every day it covered.
    id: 'hb-sprint',
    title: 'Ship the demo build',
    note: 'Three weeks, then done',
    start: -21,
    end: -1,
    days: EVERY_DAY,
    done: [-20, -18, -16, -14, -12, -11, -9, -7, -5, -4, -2, -1],
  },
  {
    // Suspended a week ago, and away for four days a fortnight back. Both
    // stretches are days it must *not* appear on — open the day panel on one of
    // them and the habit is simply not in that day's list, rather than sitting
    // there as a line that looks skipped. The `done` offsets below deliberately
    // avoid both: the store could not have recorded a tick on any of them.
    id: 'hb-stretch',
    title: 'Stretch before bed',
    note: '',
    start: -21,
    days: EVERY_DAY,
    done: [-21, -19, -17, -15, -10, -8],
    pauses: [{ from: -14, to: -10 }],
    pausedSince: -7,
  },
]

/** Day offsets in `[from, to]` that fall on one of `days`. */
function offsetsMatching(days, from, to) {
  const out = []
  for (let o = from; o <= to; o++) if (days.includes(weekdayIndex(toDate(isoOffset(o))))) out.push(o)
  return out
}

const seed = buildSeed()

// A second apart each, so the display order within a shared start date is the
// order written here rather than an accident of id ordering.
const habits = HABIT_SPECS.map((s, i) => {
  const at = new Date(`${isoOffset(s.start)}T09:00:0${i}`).toISOString()
  return {
    id: s.id,
    title: s.title,
    note: s.note,
    startDate: isoOffset(s.start),
    endDate: s.end === undefined ? null : isoOffset(s.end),
    weekdays: s.days,
    paused: s.pausedSince !== undefined,
    pauseDate: s.pausedSince === undefined ? null : isoOffset(s.pausedSince),
    pauses: (s.pauses ?? []).map((p) => ({ pauseDate: isoOffset(p.from), resumeDate: isoOffset(p.to) })),
    doneDays: s.done.map(isoOffset),
    createdAt: at,
    updatedAt: at,
  }
})

const json = JSON.stringify(
  {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: seed.projects,
    tasks: seed.tasks,
    logs: seed.logs,
    chores: seed.chores,
    habits,
  },
  null,
  2,
)

// The point of the check is that this goes in through the app's own importer, so
// `normalize` is what has to accept it. Asserting on its output rather than on
// the JSON here is the difference between "the file parses" and "the app will
// take it".
const loaded = parseImport(json)
assert.equal(loaded.projects.length, seed.projects.length)
assert.equal(loaded.tasks.length, seed.tasks.length)
assert.equal(loaded.logs.length, seed.logs.length)
assert.equal(loaded.chores.length, seed.chores.length)
assert.deepEqual(
  loaded.habits.map((h) => [h.id, h.startDate, h.doneDays.length]),
  habits.map((h) => [h.id, h.startDate, h.doneDays.length]),
)
// Every tick in this file has to be a day the habit actually ran on. A tick on a
// Tuesday of a Mon/Wed/Fri habit, or one under a pause, is data the app can no
// longer produce — `toggleHabit` refuses to write it — so a fixture containing
// one would be demonstrating a state that cannot occur. This is the assertion
// that catches a hand-written `done` list gone stale against its schedule.
for (const h of loaded.habits) {
  for (const day of h.doneDays) {
    assert.ok(runsOn(h, day), `${h.id} is ticked on ${day}, which is not a day it runs`)
  }
}

// What the Today column will actually show on the day this was generated: at
// least one struck row and at least one unstruck, so both states are visible,
// and neither the finished habit nor the suspended one in it at all.
const today = isoOffset(0)
const shown = habitsOn(loaded.habits, today)
const ticked = shown.filter((h) => h.doneDays.includes(today))
assert.ok(ticked.length > 0, 'nothing is ticked today, so the header reads 0/N')
assert.ok(ticked.length < shown.length, 'everything is ticked today, so no row shows unticked')
assert.ok(!shown.some((h) => h.id === 'hb-sprint'), 'the finished habit is back')
assert.ok(!shown.some((h) => h.id === 'hb-stretch'), 'the suspended habit is back')

// --- what the dataset is for -----------------------------------------------
//
// The board carries the two cases the archive needs to be visible at all, and
// this is where they are held to it. A fixture that stopped being archivable —
// because a status rule moved, or a date offset drifted out of range — would
// still import perfectly, and would demonstrate nothing.

const byId = new Map(loaded.tasks.map((t) => [t.id, t]))

// Already filed away: the whole branch, though only its root says so in the file.
// The children are archived on the way in, by the same repair that rescues a
// hand-edited file, so this assertion is about `normalize` as much as about the
// dataset.
for (const id of ['co-found', 'co-found-git', 'co-todo-notes']) {
  assert.ok(isArchived(byId.get(id)), `${id} should be filed away after import`)
}
// ...and the drawer therefore has something in it on an empty board.
const rows = buildRows(loaded.tasks, {}, loaded.projects, loaded.logs)
const drawer = rows.find((r) => r.kind === 'archiveGroup')
assert.ok(drawer, 'nothing is filed away, so the demo board shows no archive at all')
assert.equal(drawer.count, 3, 'the drawer counts the branch, not the lines it draws')
assert.deepEqual(drawer.taskIds, ['co-found'], 'one branch → one row, and only the root has the way back')

// Ready to be filed away: complete, still on the board, and carrying one
// unfinished to-do — which is what the confirmation has to own up to.
const eff = effectiveStates(loaded.tasks, loaded.logs)
assert.equal(eff.get('team-proto').status, 'completed', 'the press-archive case is not complete')
assert.deepEqual(archiveCascade(loaded.tasks, ['team-proto']).sort(), ['team-proto', 'team-proto-frame', 'team-todo-bom'].sort())

// A finished child of a live parent, for the rule that a file-away moves no
// number: this one is the demo's "archive me and watch the parent" case.
assert.equal(eff.get('stm-motor-sch').status, 'completed')
assert.equal(eff.get('stm-motor').status !== 'completed', true, 'its parent has to still be running')

// The timeline is measured over the live tasks, so the branch filed away at -60
// — further back than the axis reaches — must not stretch it. Import this board
// and the axis still starts where it always did.
const axis = (list) => timelineRange('day', list, isoOffset(0), 900)
assert.deepEqual(axis(liveTasks(loaded.tasks)), axis(loaded.tasks), 'an archived task moved the timeline')

// Both shapes a log's reading comes in, one entry each. The old one has the
// clock in its body and no field: on the way in the line leaves the text and
// becomes the reading, and the paragraph it opened survives. Get that wrong and
// the entry draws the same clock twice.
const oldShape = loaded.logs.find((l) => l.id === 'log-fr-u4-29')
assert.ok(!oldShape.content.includes('—'), 'the reading is still sitting in the body')
assert.equal(oldShape.content.split('\n')[0], '- Leçon 1: passé composé', 'the line it opened is gone with it')
assert.deepEqual(oldShape.stamps.map((s) => s.at), ['08:40'])
const newShape = loaded.logs.find((l) => l.id === 'log-stm-can-0')
assert.deepEqual(newShape.stamps.map((s) => s.at), ['11:20'])
assert.equal(paragraphs(newShape.content).length, newShape.stamps.length, 'and one reading per paragraph')

const out = resolve('demo-board.local.json')
writeFileSync(out, json, 'utf8')

await server.close()
console.log(`wrote ${out}`)
console.log(
  `${loaded.projects.length} projects · ${loaded.tasks.length} tasks · ${loaded.logs.length} logs · ${loaded.chores.length} chores · ${loaded.habits.length} habits`,
)
console.log(`${drawer.count} of those tasks are filed away (drawer: ${drawer.taskIds.join(', ')})`)
console.log('import it from the sidebar, on an empty board')
process.exit(0)

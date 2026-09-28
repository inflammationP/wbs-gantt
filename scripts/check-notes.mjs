/**
 * The one check on the note day rules, run with
 * `node scripts/check-notes.mjs`.
 *
 * No framework, and nothing mocked: `src/lib/notes.ts` is loaded straight from
 * source by Vite, the same way `check-chores.mjs` loads the chore rules. The
 * store's `setNote` is loaded too, because "one note per day" is enforced by
 * *two* things — the shape, and the write path — and only one of them is the
 * one people think of.
 *
 * What is being pinned down is the day union, which is the load-bearing half of
 * putting notes in the Logs page. The page is a wall of day cards built from
 * logs; a note has no task and no project, so the only reason a day that has a
 * note and no log gets a card at all is that `withNotes` says it does. Get that
 * wrong and notes are writable and unreadable — the failure the whole feature
 * would be.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Read at `useStore.ts` module load: the theme writes an attribute, and the
// persistence layer reads and writes localStorage. Neither is what this script
// is about, so both are stubbed rather than emulated — the same two lines
// `check-habits.mjs` opens with, for the same reason.
globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // Without this the entry scan walks every HTML file `src-tauri/target` has
  // ever generated and buries the one line this prints.
  optimizeDeps: { entries: [] },
})
const { withNotes, noteOn } = await server.ssrLoadModule('/src/lib/notes.ts')

const D1 = '2026-09-15'
const D2 = '2026-09-16'
const D3 = '2026-09-17'

const note = (date, over = {}) => ({ date, body: date, updatedAt: `${date}T09:00:00Z`, ...over })

const dates = (days) => days.map((d) => d.date)

// --- days are the union of both kinds -------------------------------------

// A day with a note and no log. This is the case the feature exists for: it has
// to come back with a card, and with `logs` empty rather than missing.
const onlyNote = withNotes([], [note(D2)])
assert.deepEqual(dates(onlyNote), [D2], 'a day with only a note must still be a day')
assert.deepEqual(onlyNote[0].logs, [], 'its logs are an empty array, not undefined')
assert.equal(onlyNote[0].note.body, D2)

// The mirror: a day with a log and no note comes back with `note: null`, so the
// page can branch on the value everywhere and never on `undefined`.
const logDays = [
  { date: D1, logs: [{ id: 'l1' }] },
  { date: D3, logs: [{ id: 'l2' }] },
]
const onlyLogs = withNotes(logDays, [])
assert.deepEqual(dates(onlyLogs), [D3, D1], 'days are newest first')
assert.equal(onlyLogs[0].note, null, 'a day with no note carries null')
assert.deepEqual(onlyLogs[0].logs, [{ id: 'l2' }], 'the logs are passed through untouched')

// Both kinds on one day — what the card's second edge is drawn for — and the
// two are joined onto the one day rather than split across two.
const both = withNotes(logDays, [note(D1), note(D3)])
assert.deepEqual(dates(both), [D3, D1])
assert.deepEqual(both[0].logs, [{ id: 'l2' }])
assert.equal(both[0].note.body, D3)
assert.equal(both[1].note.body, D1)
assert.equal(both.length, 2, 'a day appears once however many kinds it holds')

// Neither input is modified.
const logsIn = [{ date: D1, logs: [{ id: 'l1' }] }]
const notesIn = [note(D1)]
const logsBefore = JSON.stringify(logsIn)
const notesBefore = JSON.stringify(notesIn)
withNotes(logsIn, notesIn)
assert.equal(JSON.stringify(logsIn), logsBefore, 'the log days are not written to')
assert.equal(JSON.stringify(notesIn), notesBefore, 'the notes are not written to')

// --- one note per day -----------------------------------------------------

assert.equal(noteOn([note(D1)], D1).body, D1)
assert.equal(noteOn([note(D1)], D2), null, 'a day with nothing written is null, not a blank note')
assert.equal(noteOn([], D1), null)

assert.deepEqual(withNotes([], []), [], 'nothing on the board is no days at all')

// --- the write path -------------------------------------------------------

// `setNote` is where a day's box is upserted, cleared and no-op'd, so it runs
// against the real store rather than against a copy of the rule.
const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')
const { setNote, appendNote } = useStore.getState()
const read = () => useStore.getState().notes

setNote(D1, 'first')
assert.equal(read().length, 1)
setNote(D1, 'first, then more')
assert.equal(read().length, 1, 'writing again on the same day replaces, it does not append')
assert.equal(read()[0].body, 'first, then more')

// A second day is a second note; the first is untouched.
setNote(D2, 'another day')
assert.deepEqual(read().map((n) => n.date).sort(), [D1, D2])

// Whitespace-only clears, and a cleared day leaves nothing behind — a note of
// newlines would draw a card claiming the user had written something.
setNote(D2, '   \n  ')
assert.deepEqual(read().map((n) => n.date), [D1], 'a blank body removes the note')
assert.equal(read()[0].date, D1)

// Clearing a day that has nothing is not an error and changes nothing.
const before = read()
setNote(D3, '')
assert.equal(read(), before, 'clearing an unwritten day is a no-op, identity and all')

// Writing the same text back is a no-op too — otherwise every blur that changed
// nothing would bump `updatedAt` and write the whole board to disk.
const stamped = read()[0]
setNote(D1, 'first, then more')
assert.equal(read()[0], stamped, 'an unchanged write keeps the same object')

// --- adding, which is not the same as editing ------------------------------

// The distinction the two entries into the notebook are built on: an edit says
// "the note for this day is now this", an append says "this goes on the end".
setNote(D1, 'the note')
appendNote(D1, 'and then some more')
assert.equal(read()[0].body, 'the note\n\nand then some more', 'an append keeps what was there')

appendNote(D1, '   \n  ')
assert.equal(read()[0].body, 'the note\n\nand then some more', 'a blank append adds nothing')

// Onto a day with nothing written, an append is just a write.
appendNote(D3, 'fresh')
assert.equal(read().find((n) => n.date === D3).body, 'fresh')
assert.equal(read().length, 2, 'still one note per day after an append')

// --- moving a note to another day ------------------------------------------
//
// A note has no identity apart from its date, so changing the date can only
// mean clearing the old day and writing the new one. What the component does,
// in the same order — and the point of pinning it here is the occupied case,
// where the alternative to joining is overwriting writing that has no backup.

const move = (from, to, body) => {
  setNote(from, '')
  if (body.trim() && useStore.getState().notes.some((n) => n.date === to)) appendNote(to, body)
  else setNote(to, body)
}

setNote(D1, 'monday')
setNote(D2, 'tuesday')
move(D1, D2, 'monday')
assert.equal(noteOn(read(), D1), null, 'the day it came off is left empty, not holding a copy')
assert.equal(noteOn(read(), D2).body, 'tuesday\n\nmonday', 'the day it lands on keeps its own text')

move(D2, D3, 'tuesday\n\nmonday')
assert.equal(noteOn(read(), D2), null)
assert.equal(noteOn(read(), D3).body, 'fresh\n\ntuesday\n\nmonday', 'and onto an occupied day too')

await server.close()
console.log('notes: ok')
process.exit(0)

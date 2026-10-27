/**
 * The check on the two-step update's window sequence — run with
 * `node scripts/check-update-flow.mjs`.
 *
 * What it pins down is that **one window is up at a time**, and which one. The
 * two dialogs were mounted independently with a guard each, so the download
 * landing satisfied both at once: "restart now or later?" opened in front of the
 * offer that had asked for the download, still on screen behind it. Nothing in
 * either component was wrong on its own — which is why the answer has to be one
 * function over the state, and why this file drives the store through the whole
 * sequence rather than reading either guard.
 *
 * The rest of the sequence is here because each step fails silently in the same
 * way: a dialog that never closes or never reopens is not an error anywhere, it
 * is just a window that is (or is not) there. "Later" quietly taking the
 * installer with it is the expensive one — that turns "later" into "never", and
 * the download happens again on the next launch.
 *
 * Loaded from source by Vite, like the other checks, so what is asserted is the
 * store's own actions and not a copy of them. The globals the store touches at
 * module load are stubbed the way `check-habits.mjs` stubs them.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// Read at `useStore.ts` module load: the theme writes an attribute, and the
// persistence layer reads and writes localStorage. Neither is what this script
// is about, so both are stubbed rather than emulated.
globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // Without this the entry scan walks every HTML file `src-tauri/target` has
  // ever generated.
  optimizeDeps: { entries: [] },
})
const { updateOverlay, splitReleaseNotes } = await server.ssrLoadModule('/src/lib/updater.ts')
const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')
await server.close()

/** Which dialog the app is showing, as the overlay computes it. */
const up = () => updateOverlay(useStore.getState())

/** A stand-in for the handle `checkForUpdate` hands over, with the hooks filled. */
const handle = (hooks = {}) => ({
  kind: 'available',
  version: '0.16.0',
  current: '0.15.0',
  notes: '- something',
  date: null,
  download: async () => {},
  install: async () => {},
  dismiss: async () => {},
  ...hooks,
})

/** Back to "a check found something", which is where every path below starts. */
const offer = (hooks) =>
  useStore.setState({
    updateInfo: handle(hooks),
    updateInstalling: false,
    updateReady: false,
    updateReadyOpen: false,
    updateError: null,
  })

// --- the offer, and the download that follows it ----------------------------

offer()
assert.equal(up(), 'offer', 'a fresh offer is the dialog that asks for the download')

// Held open so the middle of the download can be looked at: the app is usable
// in that window, which is the entire reason the download is a separate step.
let landing
const held = new Promise((resolve) => {
  landing = resolve
})
offer({ download: () => held })
const downloading = useStore.getState().installUpdate()
assert.equal(up(), null, 'nothing is asked while the download is in flight')

landing()
await downloading
assert.equal(up(), 'ready', 'the question that the download cannot answer')

// --- "later", which is the whole point of the split -------------------------

useStore.getState().dismissReady()
assert.equal(up(), null, 'later closes the question and does not reopen the offer')
// The installer stays fetched: the version section's restart button is what
// "later" leaves behind. Clearing this would make later mean never.
assert.equal(useStore.getState().updateReady, true, 'later keeps the installer on disk')
assert.equal(useStore.getState().updateInfo !== null, true, 'and the handle that owns it')

// --- and the ways out of a waiting installer --------------------------------

let dismissed = false
offer({ dismiss: async () => { dismissed = true } })
useStore.getState().closeUpdateDialog()
assert.equal(up(), null, 'closing the offer leaves nothing up')
assert.equal(useStore.getState().updateReady, false, 'and takes the installer with it')
// The handle is a Tauri resource; dropping it without closing it leaks.
await Promise.resolve()
assert.equal(dismissed, true, 'the handle is released, not leaked')

// Snoozing drops the handle too, so it cannot leave the version section
// offering a restart through an installer that has been released.
offer({ dismiss: async () => {} })
useStore.setState({ updateReady: true, updateReadyOpen: true })
useStore.getState().snoozeUpdate()
assert.equal(up(), null, 'a snoozed update says nothing')
assert.equal(useStore.getState().updateReady, false, 'and holds no waiting installer')

// --- the failure paths, which are the only thing that reopens anything ------

// A download that fails: the offer comes back with the reason on it and the
// button to try again, and nothing was fetched.
useStore.setState({ updateReady: false, updateReadyOpen: false })
offer({ download: async () => { throw new Error('connection reset') } })
await useStore.getState().installUpdate()
assert.equal(up(), 'offer', 'a failed download reopens the offer')
assert.match(useStore.getState().updateError ?? '', /connection reset/)
assert.equal(useStore.getState().updateReady, false, 'nothing landed, so nothing is waiting')

// A restart that fails: the question was answered by pressing the button, so
// the offer is what carries the reason. The installer is still on disk.
offer()
await useStore.getState().installUpdate()
assert.equal(up(), 'ready')
offer({ install: async () => { throw new Error('installer refused') } })
await useStore.getState().installUpdate()
await useStore.getState().applyUpdate()
assert.equal(up(), 'offer', 'a failed restart reopens the offer with the reason')
assert.equal(useStore.getState().updateReady, true, 'and the installer is still on disk')

// --- the invariant behind all of the above ----------------------------------

// One value, so "both are up" is not a state that can be described. Asserted
// rather than assumed because it is the entire content of the fix: every field
// combination the store can be left in has to answer with at most one window.
for (const info of [null, handle()]) {
  for (const updateInstalling of [false, true]) {
    for (const updateError of [null, 'boom']) {
      for (const updateReady of [false, true]) {
        for (const updateReadyOpen of [false, true]) {
          const which = updateOverlay({ updateInfo: info, updateInstalling, updateError, updateReady, updateReadyOpen })
          assert.ok(['offer', 'ready', null].includes(which), `not a window: ${which}`)
          // An error is always the offer's to report: it is the one with the
          // notes, the retry button and the version section behind it.
          if (updateError && info && !updateInstalling) {
            assert.equal(which, 'offer', 'a failure is never the restart question')
          }
        }
      }
    }
  }
}

// --- the important-release marker ------------------------------------------

// The app is reading a note written for a release newer than itself, so the
// only place the answer can live is the note. The marker owns its line and is
// gone before the dialog reads anything.
assert.deepEqual(splitReleaseNotes('[重要]\n- one'), { important: true, notes: '- one' })
assert.deepEqual(splitReleaseNotes('[important]\r\n- one'), { important: true, notes: '- one' })
assert.deepEqual(splitReleaseNotes('[重要]\n'), { important: true, notes: '' })
assert.deepEqual(
  splitReleaseNotes('[重要] 数据迁移'),
  { important: false, notes: '[重要] 数据迁移' },
  'a line that merely starts with the marker is a note, not a flag',
)
assert.deepEqual(splitReleaseNotes('- [重要] a real bullet'), {
  important: false,
  notes: '- [重要] a real bullet',
})
assert.deepEqual(splitReleaseNotes(''), { important: false, notes: '' })

console.log('update flow: all assertions passed')
// Loading the store leaves a handle open — the same reason every check that
// loads it ends this way — so the process would otherwise sit at the prompt.
process.exit(0)

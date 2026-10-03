/**
 * The check on the release history — run with
 * `node scripts/check-update-history.mjs`.
 *
 * Two silent failures, on the two halves of the same list. The first is which
 * releases the update dialog shows as stepped over: a version missing from it
 * looks exactly like a version that had nothing to say, and one wrongly
 * included looks exactly like one that was missed. Nobody would ever file it.
 * The second is reading GitHub's answer at all — see the bottom of this file.
 *
 * The specific trap is that these are version numbers, not strings. `'0.9.0' >
 * '0.10.0'` character by character, so a string compare promotes the older
 * release into the list and drops the newer one — which is the release the user
 * is most likely to care about, since it is the one right in front of them.
 *
 * Loaded from source by Vite, like the other checks. `updater.ts` pulls in the
 * Tauri plugins at import time, but only calls them inside functions, so the
 * pure half is testable here.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // Without this the entry scan walks every HTML file `src-tauri/target` has
  // ever generated.
  optimizeDeps: { entries: [] },
})
const { releasesBetween, parseReleases } = await server.ssrLoadModule('/src/lib/updater.ts')
await server.close()

const rel = (version) => ({ version, notes: `notes for ${version}` })
const versions = (list, current, target) =>
  releasesBetween(list, current, target).map((r) => r.version)

// The list the dialog is built from, deliberately out of order.
const RELEASES = [rel('0.9.0'), rel('0.11.0'), rel('0.12.0'), rel('0.10.0'), rel('0.2.0')]

// The one this file exists for: 0.9.0 sorts after 0.10.0 as a string, and the
// whole 0.x line has that shape.
assert.deepEqual(versions(RELEASES, '0.9.0', '0.12.0'), ['0.11.0', '0.10.0'])

// Strictly between: the version being offered is already in the notes box above
// this list, and the version being run needs no introduction.
assert.deepEqual(versions(RELEASES, '0.11.0', '0.12.0'), [])
assert.deepEqual(versions(RELEASES, '0.10.0', '0.12.0'), ['0.11.0'])
assert.deepEqual(versions(RELEASES, '0.2.0', '0.12.0'), ['0.11.0', '0.10.0', '0.9.0'])

// Nothing skipped, and nothing to skip.
assert.deepEqual(versions(RELEASES, '0.12.0', '0.12.0'), [])
assert.deepEqual(versions([], '0.9.0', '0.12.0'), [])

// Newest first, whatever order the API answered in.
assert.deepEqual(versions(RELEASES, '0.9.0', '0.13.0'), ['0.12.0', '0.11.0', '0.10.0'])

// The two sides arrive with different shapes: tags are `v0.11.0`, the running
// version is `0.9.0`. Whatever each one carries, the comparison has to be about
// the numbers. (`fetchReleaseHistory` strips the tag's `v` on the way in, so
// what lands in the store is display-ready; this is the half of that contract
// that has a branch in it.)
const tagged = [rel('v0.10.0'), rel('v0.11.0')]
assert.deepEqual(versions(tagged, '0.9.0', 'v0.12.0'), ['v0.11.0', 'v0.10.0'])

// A version deeper than the comparison: the missing tail reads as zeroes, not
// as a shorter string.
assert.deepEqual(versions([rel('0.12.1'), rel('0.12.0.1')], '0.12.0', '0.13.0'), [
  '0.12.1',
  '0.12.0.1',
])

// --- reading the API's answer ----------------------------------------------

// Three rules, each of which fails silently: a draft that gets through is a
// release nobody was told about; a tag left as `v0.10.0` stops comparing
// against the `0.9.0` the app calls itself; and a body that is the placeholder
// shows an English sentence in the middle of someone's Chinese notes.
const RAW = [
  { tag_name: 'v0.12.0', body: 'twelve' },
  { tag_name: 'v0.11.0', body: 'No release notes.' },
  { tag_name: 'v0.11.0-rc', body: 'draft', draft: true },
  { tag_name: 'v0.10.0', body: '  ten  ' },
  { body: 'a tagless release' },
  { tag_name: 'v0.9.0' },
]
assert.deepEqual(parseReleases(RAW), [
  { version: '0.12.0', notes: 'twelve' },
  { version: '0.11.0', notes: '' },
  { version: '0.10.0', notes: 'ten' },
  { version: '0.9.0', notes: '' },
])
// The `v` is the whole point of the strip, so it is asserted on its own: what
// comes out of here is fed straight to `releasesBetween`, which compares
// numbers and would drop a tagged version rather than misplace it.
assert.equal(parseReleases([{ tag_name: '10.0.0' }])[0].version, '10.0.0')
assert.deepEqual(parseReleases([]), [])

console.log('update history: all assertions passed')

import { Stamp, TaskLog } from '../types'
import { pad } from './dates'

export interface LogItem {
  /** A divider is the line that separates two writes made on the same day. */
  kind: 'item' | 'divider'
  depth: number
  text: string
}

/**
 * The clock reading that stamps one write, as it is stored and as it is drawn.
 *
 * Deliberately not in the text. It used to be written into the content as a
 * `— HH:MM —` line, on the grounds that the content is the user's and they
 * could edit around it — and the cost of that was a stamp they could edit,
 * delete or mistype, in a place where the only right answer is the clock. It is
 * a field on the entry now (`TaskLog.times`), one reading per write in order,
 * and the editor never sees it.
 *
 * What still separates one write from the next is the blank line between them,
 * which is the user's own paragraph break — the structure their text already
 * has, and the one thing in here they are allowed to change.
 */
export function logStamp(at: Date): string {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** A body as the paragraphs it is made of: blank lines separate them. */
export function paragraphs(body: string): string[] {
  return body.split(/\n[^\S\n]*\n/).map((b) => b.trim()).filter((b) => b !== '')
}

/**
 * The stamps out of a stored body, and the body without them.
 *
 * The migration, and it runs on every load — which is what makes it safe: once
 * a body has been through here there is nothing left to lift, so it does
 * nothing on the second pass. A blank line is left where each stamp was, so the
 * boundary it marked survives as the paragraph break it is now.
 *
 * The stamps come back in block order because a stamp always preceded the text
 * it belongs to. A block with no stamp in front of it — the app used to stamp
 * every write, but a hand-edited file need not — gets none, rather than
 * borrowing the one above it.
 *
 * A stamp the user typed by hand is lifted like any other. That is the one
 * behaviour the old design allowed on purpose that this one cannot keep: there
 * are no longer two kinds of stamp, only the ones the app wrote.
 */
export function liftTimes(body: string): { text: string; stamps: Stamp[] } {
  const stamps: Stamp[] = []
  const out: string[] = []
  let pending: string | null = null

  for (const line of body.split('\n')) {
    const m = line.trim().match(DIVIDER)
    if (m) {
      // A second stamp with nothing written between them: the first one had no
      // text, so there is no block to hang it on.
      if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('')
      pending = m[1]
      continue
    }
    const blank = line.trim() === ''
    if (!blank && pending != null) {
      stamps.push({ at: pending })
      pending = null
    }
    out.push(line)
  }

  const text = out.join('\n')
  // One stamp per paragraph, padded or trimmed so the caller can index the two
  // together without checking — a body whose count of stamps disagrees with its
  // paragraphs is a body that would otherwise draw its readings against the
  // wrong text.
  const paras = paragraphs(text)
  return {
    text,
    stamps: paras.map((_, i) => stamps[i] ?? { at: '' }),
  }
}

/**
 * What a save did, paragraph by paragraph.
 *
 * The editor is one textarea, so "which paragraph did this edit change" is not
 * something the app is told — it is something it works out, by comparing what
 * was there with what came back. Unchanged paragraphs keep their history;
 * everything left over is paired up in order, and a pair is a paragraph that
 * was *edited* rather than replaced, while an unpaired new paragraph is one
 * that was started.
 *
 * The pairing is by position within a run of leftovers, because that is how
 * people edit: the second paragraph comes back changed in place rather than
 * deleted with a stranger inserted in its slot. So a paragraph's identity here
 * is its *slot*, not its text — rewriting one wholesale reads as an edit of
 * that paragraph, which is what it is, and the alternative (matching text by
 * similarity) needs a threshold and gets the near-misses wrong. True insertions
 * and deletions are still told apart, because the paragraphs that did not
 * change are matched and anchor everything around them.
 *
 * `now` is stamped onto every paragraph this save created or changed, so one
 * visit to the box leaves one reading, however much it touched.
 */
export function restamp(before: string, beforeStamps: Stamp[], after: string, now: string): Stamp[] {
  const was = paragraphs(before)
  const nowParas = paragraphs(after)
  const n = was.length
  const m = nowParas.length

  // The longest common subsequence of the two paragraph lists, as index pairs:
  // everything not in it is either new or gone. A subsequence rather than a set
  // because the same line written twice is two paragraphs with two histories,
  // and matching them by text alone would collapse them into one.
  const pairs: [number, number][] = []
  {
    const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i][j] =
          was[i] === nowParas[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
      }
    }
    for (let i = 0, j = 0; i < n && j < m; ) {
      if (was[i] === nowParas[j]) {
        pairs.push([i, j])
        i++
        j++
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
      else j++
    }
  }

  const out: Stamp[] = nowParas.map(() => ({ at: now }))
  let wasAt = 0
  let nowAt = 0
  for (const [i, j] of [...pairs, [n, m]]) {
    // The run of leftovers between the previous match and this one. Paired up
    // in order: a paragraph that came back changed stands where it stood.
    const gone = i - wasAt
    const fresh = j - nowAt
    for (let k = 0; k < Math.min(gone, fresh); k++) {
      const old = beforeStamps[wasAt + k]
      const at = old?.at ?? ''
      // An edited paragraph keeps the reading it was written under and gains
      // this one — and the pairing only holds if it had one to keep.
      out[nowAt + k] = at ? { at, edited: [...(old.edited ?? []), now] } : { at: now }
    }
    // The matched paragraph itself comes through untouched.
    if (j < m && i < n) {
      const old = beforeStamps[i]
      if (old?.at) out[j] = old.edited ? { at: old.at, edited: old.edited } : { at: old.at }
    }
    wasAt = i + 1
    nowAt = j + 1
  }
  return out
}

/** Matches what `editDivider` writes, and nothing much else. */
const DIVIDER = /^—\s*(\d{1,2}:\d{2})\s*—$/

// Parse raw log text into a bullet list: newline = item, leading tabs = nesting.
// A divider comes back as itself rather than as an item, so nothing downstream
// has to guess from the text.
export function parseLogContent(content: string): LogItem[] {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^(\t*)(.*)$/)
      const depth = (m?.[1] ?? '').length
      const text = (m?.[2] ?? '').trimEnd()
      const divider = text.trim().match(DIVIDER)
      return divider
        ? { kind: 'divider' as const, depth: 0, text: divider[1] }
        : { kind: 'item' as const, depth, text }
    })
    .filter((it) => it.text.trim() !== '')
}

// Group logs by date (descending).
export function groupLogsByDate(logs: TaskLog[]): { date: string; logs: TaskLog[] }[] {
  const m = new Map<string, TaskLog[]>()
  for (const l of logs) {
    if (!m.has(l.date)) m.set(l.date, [])
    m.get(l.date)!.push(l)
  }
  return [...m.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({ date, logs: list }))
}

// Logs for a given task, newest first.
export function logsForTask(logs: TaskLog[], taskId: string): TaskLog[] {
  return logs.filter((l) => l.taskId === taskId).sort((a, b) => b.date.localeCompare(a.date))
}

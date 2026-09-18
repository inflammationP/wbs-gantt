/**
 * The little markup the copy is written in: an asterisk for bold, slashes for
 * size, and both at once. (Spelled out here rather than shown, because writing
 * the closing half of a bold-slash pair inside a block comment would end this
 * comment — which is the same trap the parser itself has to survive, see the
 * unmatched-mark cases in the check.)
 *
 * It exists because the confirmation dialog that talks someone out of the log
 * system has to land certain phrases, and where those phrases sit is a decision
 * about the wording — not something to be rebuilt out of JSX fragments every
 * time a sentence is reworded. The dictionary keeps the marks, so the person
 * who wrote the copy can go on editing it in the notation they wrote it in.
 *
 * The number of slashes is the degree: one is a nudge, three is the cap. Bold
 * has no degrees — `**` and `*` say the same thing, and doubling them is just
 * how people write emphasis by hand.
 *
 * Returns data rather than elements so the rule can be checked without React;
 * see `scripts/check-emphasis.mjs`.
 */

export interface EmphRun {
  text: string
  bold: boolean
  /** Multiplier on the surrounding font size. 1 = unchanged. */
  scale: number
}

/** Slash count → enlargement, indexing from one slash. Three is the ceiling. */
const SCALES = [1.08, 1.14, 1.2]

export const MAX_SCALE = SCALES[SCALES.length - 1]

const isMark = (c: string) => c === '*' || c === '/'

export function parseEmphasis(input: string): EmphRun[] {
  const runs: EmphRun[] = []
  let plain = ''
  const flush = () => {
    if (plain) runs.push({ text: plain, bold: false, scale: 1 })
    plain = ''
  }

  let i = 0
  while (i < input.length) {
    if (!isMark(input[i])) {
      plain += input[i++]
      continue
    }

    // The opening run — how bold it asks for, and how many degrees bigger.
    let j = i
    while (j < input.length && isMark(input[j])) j++
    const open = input.slice(i, j)
    const bold = open.includes('*')
    const slashes = (open.match(/\//g) ?? []).length

    // Its closer has to carry the same marks, so a `*` inside a `*/…*/` span
    // cannot close it early. No closer means the mark is just a character: a
    // lone `*` must not swallow the rest of the sentence.
    let k = j
    let close = -1
    while (k < input.length) {
      if (!isMark(input[k])) {
        k++
        continue
      }
      let m = k
      while (m < input.length && isMark(input[m])) m++
      const candidate = input.slice(k, m)
      if ((!bold || candidate.includes('*')) && (slashes === 0 || candidate.includes('/'))) {
        close = m
        break
      }
      k = m
    }

    if (close === -1) {
      plain += open
      i = j
      continue
    }

    flush()
    runs.push({
      text: input.slice(j, k),
      bold,
      scale: slashes === 0 ? 1 : SCALES[Math.min(slashes, SCALES.length) - 1],
    })
    i = close
  }

  flush()
  return runs
}

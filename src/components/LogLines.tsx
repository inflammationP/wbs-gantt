import { Fragment } from 'react'
import { paragraphs, parseLogContent } from '../lib/logs'
import { Stamp } from '../types'
import { useT } from '../lib/useT'

/**
 * The rule that separates two writes, with the clock reading that stamps the
 * one under it.
 *
 * Shared with the notebook, which stamps an entry the same way and has to draw
 * it the same: two copies of this markup is how one of them ends up with the
 * line on the wrong side of the time.
 */
export function TimeRule({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <span className="h-px flex-1 bg-line" />
      <span className="shrink-0 font-mono text-[11px] text-dim">{time}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

/**
 * The corner reading a paragraph wears once something has come back and changed
 * it: small, dim, and at the end of the paragraph rather than in front of it,
 * because it is about the text above it and not about what follows.
 *
 * The latest edit, and only that one. The paragraph is one piece of writing
 * with one "last touched", and a row of readings in a corner is a history
 * nobody asked to read — the entry's own paragraphs already say what changed
 * and when they were written.
 */
function EditedAt({ times }: { times: string[] }) {
  const t = useT()
  const latest = times[times.length - 1]
  if (!latest) return null
  return (
    <div className="text-right text-[10px] text-dim/70 leading-none pt-0.5">
      {t('log.editedAt', { time: latest })}
    </div>
  )
}

/**
 * A body, paragraph by paragraph, under the readings that stamp them.
 *
 * Shared by the log and the notebook, which differ only in how a paragraph's
 * lines are drawn — bullets in one, prose in the other. Everything else is the
 * same question asked twice: which block is this, when was it written, and has
 * anything come back for it since.
 *
 * The readings are the entry's own (`TaskLog.stamps`, `Note.stamps`), not lines
 * in the text, so the text is only ever the writer's. A paragraph with no
 * reading gets no rule — a hand-edited file, or a body from before stamps were
 * a field — and one whose `at` repeats the paragraph above it is opening
 * nothing new, because a save that added three paragraphs stamped all three.
 */
function StampedBody({ content, stamps, prose }: { content: string; stamps: Stamp[]; prose?: boolean }) {
  const blocks = paragraphs(content)
  return (
    <>
      {blocks.map((block, i) => {
        const stamp = stamps[i]
        const opened = stamp?.at && stamp.at !== stamps[i - 1]?.at
        return (
          <Fragment key={i}>
            {opened && <TimeRule time={stamp.at} />}
            {prose ? (
              <div className="whitespace-pre-wrap break-words">{block}</div>
            ) : (
              parseLogContent(block).map((it, j) =>
                it.kind === 'divider' ? (
                  // Still drawn, for a stamp someone typed by hand — the app no
                  // longer writes these into the text, but a body that has one
                  // is not a body to silently reformat.
                  <TimeRule key={j} time={it.text} />
                ) : (
                  <div
                    key={j}
                    className="flex items-start gap-1.5 text-[12px] text-muted"
                    style={{ paddingLeft: it.depth * 16 }}
                  >
                    <span className="text-dim shrink-0">·</span>
                    <span className="whitespace-pre-wrap break-words">{it.text}</span>
                  </div>
                ),
              )
            )}
            {stamp?.edited?.length ? <EditedAt times={stamp.edited} /> : null}
          </Fragment>
        )
      })}
    </>
  )
}

/** A log's text, as bullets, under the stamps of the writes that made it. */
export function LogLines({ content, stamps = [] }: { content: string; stamps?: Stamp[] }) {
  return <StampedBody content={content} stamps={stamps} />
}

/** The same thing for the notebook, whose paragraphs are prose, not bullets. */
export function NoteBody({ body, stamps = [] }: { body: string; stamps?: Stamp[] }) {
  return <StampedBody content={body} stamps={stamps} prose />
}

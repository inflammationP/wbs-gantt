import { parseLogContent } from '../lib/logs'

/**
 * A log's text, as bullets.
 *
 * Shared, because the two places that show a log inline — the day's log dialog
 * and the task panel's history — were already carrying identical copies of this
 * markup, and a copy is exactly how the day's divider ends up drawn as a bullet
 * in one of them and correctly in the other.
 */
export function LogLines({ content }: { content: string }) {
  return (
    <>
      {parseLogContent(content).map((it, i) =>
        it.kind === 'divider' ? (
          <div key={i} className="flex items-center gap-2 pt-2 pb-1">
            <span className="h-px flex-1 bg-line" />
            <span className="shrink-0 font-mono text-[11px] text-dim">{it.text}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ) : (
          <div key={i} className="flex items-start gap-1.5 text-[12px] text-muted" style={{ paddingLeft: it.depth * 16 }}>
            <span className="text-dim shrink-0">·</span>
            <span className="whitespace-pre-wrap break-words">{it.text}</span>
          </div>
        ),
      )}
    </>
  )
}

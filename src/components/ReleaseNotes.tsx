import { ReleaseNotes, allReleases } from '../lib/updater'
import { useT } from '../lib/useT'
import { Modal } from './ui'

/**
 * One release's notes: the version, then what it had to say under it.
 *
 * A component rather than markup written out twice, because the same list is
 * drawn in two places — folded into the update dialog as "what this update
 * brings along", and opened from Settings as the whole history — and the point
 * of the second one is that it reads exactly like the first. Two copies of this
 * would be two answers to what a release note looks like, and the one nobody
 * was looking at would drift first.
 *
 * The notes themselves are the plain text of a release body, wrapped and never
 * parsed, which is what `release.mjs` collects and what `latest.json` carries.
 */
export function ReleaseNotesList({ releases }: { releases: ReleaseNotes[] }) {
  const t = useT()
  return (
    <>
      {releases.map((r) => (
        <div key={r.version}>
          <div className="text-[11px] font-semibold text-fg">v{r.version}</div>
          <div className="mt-0.5 whitespace-pre-wrap leading-relaxed text-[12px] text-muted">
            {r.notes || t('update.noNotes')}
          </div>
        </div>
      ))}
    </>
  )
}

/**
 * The whole release history, opened from Settings.
 *
 * Reads the list that ships with the build, so it opens at once and works
 * offline — the one screen it used to need GitHub for. The list ends at the
 * version that built it; versions published afterwards are the update dialog's
 * business, and that one still fetches.
 */
export function ReleaseHistoryDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  return (
    <Modal title={t('update.historyTitle')} onClose={onClose} width={520}>
      <div className="space-y-3">
        <ReleaseNotesList releases={allReleases()} />
      </div>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { ReleaseNotes, fetchAllReleases } from '../lib/updater'
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
 * Fetched when it is opened rather than when Settings mounts: this is the one
 * screen in the app that needs the network and nothing on the page behind it
 * does, so asking on the way past would be a request most visits never use.
 * `loadReleases` caches for the session, so the second open costs nothing.
 *
 * Three states and no fourth: still reading, read and there is nothing (which
 * can only mean the fetch failed, since the app has shipped at least the
 * version that is running), and the list. A blank panel in the last case would
 * be indistinguishable from a panel that never arrived.
 */
export function ReleaseHistoryDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [releases, setReleases] = useState<ReleaseNotes[] | null>(null)

  useEffect(() => {
    let live = true
    void fetchAllReleases().then((r) => {
      if (live) setReleases(r)
    })
    return () => {
      live = false
    }
  }, [])

  return (
    <Modal title={t('update.historyTitle')} onClose={onClose} width={520}>
      <div className="space-y-3">
        {releases == null ? (
          <div className="text-[12px] text-muted">{t('update.historyLoading')}</div>
        ) : releases.length === 0 ? (
          <div className="text-[12px] text-muted">{t('update.historyFailed')}</div>
        ) : (
          <ReleaseNotesList releases={releases} />
        )}
      </div>
    </Modal>
  )
}

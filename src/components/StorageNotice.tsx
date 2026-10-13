import { useStore } from '../store/useStore'
import { useT } from '../lib/useT'
import { todayISO } from '../lib/dates'

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export function StorageNotice() {
  const t = useT()
  const issue = useStore((s) => s.storageIssue)
  const retrySave = useStore((s) => s.retrySave)
  const exportData = useStore((s) => s.exportData)
  if (!issue) return null
  const button = 'px-2 py-1 border border-delayed/40 rounded-[3px] hover:bg-delayed/10'
  return (
    <div role="alert" className="shrink-0 border-b border-delayed/40 bg-delayed/10 p-3 text-[12px] text-delayed">
      <p>{t(issue.kind === 'load' ? 'storage.loadFailed' : 'storage.saveFailed')}</p>
      <details className="mt-1">
        <summary className="cursor-pointer">{t('storage.details')}</summary>
        <p className="mt-1 whitespace-pre-wrap break-words">{issue.message}</p>
      </details>
      <div className="mt-2 flex flex-wrap gap-2">
        {issue.raw !== null && (
          <button className={button} onClick={() => download(issue.raw!, `wbs-gantt-original-${todayISO()}.json`)}>
            {t('storage.original')}
          </button>
        )}
        <button className={button} onClick={() => download(exportData(), `wbs-gantt-${todayISO()}.json`)}>
          {t('storage.export')}
        </button>
        <button className={button} onClick={retrySave}>
          {t(issue.kind === 'load' ? 'storage.backupAndSave' : 'storage.retry')}
        </button>
      </div>
    </div>
  )
}

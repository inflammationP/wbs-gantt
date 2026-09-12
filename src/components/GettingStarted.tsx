import { useState } from 'react'
import { Check, HelpCircle, X } from 'lucide-react'
import { GuideExplainId, TOUR_PAGES, TourPage, currentStepIndex, guideSteps, tourVisitKey } from '../lib/guide'
import { LANGS, LANG_LABEL } from '../lib/i18n'
import { sigText } from '../lib/ui'
import { useT } from '../lib/useT'
import { useStore } from '../store/useStore'
import { Modal } from './ui'

/**
 * The getting-started card, and the dialogs it opens.
 *
 * A card rather than a tour, and derived rather than tracked: every step that
 * asks the user to *do* something is read straight off the board (see
 * `lib/guide.ts`), so it survives a reload, can never tick something the board
 * does not actually contain, and needs no DOM anchors — which is what a
 * spotlight-style overlay would need, and what would break silently the first
 * time a button moved.
 *
 * Rendered by `App` but subscribing to the store itself. Inlining it into App's
 * body would hand App a `logs` subscription it does not have today, and every
 * log saved would then re-render the whole tree — App draws the sidebar, the
 * main area and all three detail panels, none of them memoised.
 */
export function GettingStarted() {
  const t = useT()
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const lang = useStore((s) => s.lang)
  const guideDone = useStore((s) => s.guideDone)
  const guideDismissed = useStore((s) => s.guideDismissed)
  const dismissGuide = useStore((s) => s.dismissGuide)
  const markGuideDone = useStore((s) => s.markGuideDone)
  const addSample = useStore((s) => s.addSample)
  const setSelected = useStore((s) => s.setSelected)
  const setActiveView = useStore((s) => s.setActiveView)
  const [open, setOpen] = useState<GuideExplainId | null>(null)

  if (guideDismissed) return null

  const steps = guideSteps(projects, tasks, logs, lang, guideDone)
  const current = currentStepIndex(steps)
  const allDone = current === steps.length
  // Steps that tell the user where to click name the page the way the sidebar
  // names it, so "in {manage}" is the same word the user will be looking for.
  const pages = { manage: t('nav.manage'), settings: t('nav.settings') }

  const openExplain = (id: GuideExplainId) => {
    if (id === 'tour') {
      // The last step's dialog is about pages that are only worth a look once
      // the board has something on it, so the sample arrives as it opens.
      // Appended, not imported: the user built a project, a task and a subtask
      // in steps 2-4 and replacing would delete all three.
      addSample()
    } else {
      markGuideDone(id)
    }
    setOpen(id)
  }

  // Visiting a page is what finishes the last step, not opening its dialog —
  // otherwise the first "take me there" would complete the step, and completing
  // it collapses the card along with the three places still to see.
  const goToPage = (page: TourPage) => {
    markGuideDone(tourVisitKey(page))
    setActiveView(page)
    setOpen(null)
  }

  return (
    <div className="absolute bottom-4 right-4 z-[50] w-[300px] bg-panel border border-border rounded-[3px] shadow-2xl">
      <div className="flex items-center justify-between pl-3 pr-2 h-9 border-b border-border">
        <div className="flex items-center gap-1.5 min-w-0">
          <HelpCircle size={13} className="shrink-0 text-accent" />
          <span className="text-[11px] font-semibold tracking-wider text-fg truncate">
            {t('guide.title')}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!allDone && (
            <span className="text-[10px] font-mono text-dim">
              {current + 1} / {steps.length}
            </span>
          )}
          <button
            onClick={dismissGuide}
            aria-label={t('guide.dismiss')}
            title={t('guide.dismiss')}
            className="text-dim hover:text-fg transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="p-1.5">
        {allDone ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Check size={13} style={{ color: sigText('completed') }} />
            <span className="text-[11px] text-muted">{t('guide.done')}</span>
          </div>
        ) : (
          steps.map((step, i) => {
            const isCurrent = i === current
            // Only on the step being worked on: the user has just made whatever
            // it points at, and one of these under every finished row buries the
            // card in links. Reading an explanation is the opposite — worth
            // coming back to, so those stay.
            const taskId = isCurrent ? step.taskId : null
            // Same again: opened early, a dialog describes things that are not
            // on the board yet.
            const explain = i <= current ? step.explain : null
            return (
              <div
                key={step.id}
                className={`flex items-start gap-2 px-2 py-1.5 rounded-[3px] ${isCurrent ? 'bg-panel2' : ''}`}
              >
                <span className="mt-[3px] shrink-0 w-3 h-3 grid place-items-center">
                  {step.done ? (
                    <Check size={12} style={{ color: sigText('completed') }} />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-accent' : 'bg-border'}`} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <div
                      className={`flex-1 text-[11px] leading-snug ${
                        step.done ? 'text-dim' : isCurrent ? 'text-fg' : 'text-muted'
                      }`}
                    >
                      {t(`guide.step.${step.id}`, pages)}
                    </div>
                    {step.progress && (
                      <span className="shrink-0 text-[10px] font-mono text-dim">
                        {step.progress.done} / {step.progress.total}
                      </span>
                    )}
                  </div>

                  {(taskId || explain) && (
                    <div className="flex items-center gap-3 mt-1">
                      {taskId && (
                        <button
                          onClick={() => setSelected(taskId)}
                          className="text-[10px] text-accent hover:underline"
                        >
                          {t('guide.goThere')}
                        </button>
                      )}
                      {explain && (
                        <button
                          onClick={() => openExplain(explain)}
                          className="text-[10px] text-accent hover:underline"
                        >
                          {t('guide.read')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {open && <ExplainDialog id={open} onClose={() => setOpen(null)} onGoToPage={goToPage} />}
    </div>
  )
}

const primaryBtn = 'h-8 px-4 text-[12px] font-medium bg-accent text-on-accent rounded-[3px]'
const secondaryBtn = 'h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]'

function ExplainDialog({
  id,
  onClose,
  onGoToPage,
}: {
  id: GuideExplainId
  onClose: () => void
  onGoToPage: (page: TourPage) => void
}) {
  const t = useT()
  const seen = useStore((s) => s.guideDone)
  const setActiveView = useStore((s) => s.setActiveView)

  // The language names a visitor recognises on sight, whatever language the
  // surrounding text happens to be in.
  const langs = LANGS.map((l) => LANG_LABEL[l]).join(' / ')

  return (
    <Modal title={t(`guide.explain.${id}.title`)} onClose={onClose} width={520}>
      <div className="space-y-3 text-[12px] leading-relaxed text-muted">
        {id === 'language' && <p>{t('guide.explain.language.p1', { langs })}</p>}

        {id === 'endDate' && (
          <>
            <p>{t('guide.explain.endDate.p1')}</p>
            <p>{t('guide.explain.endDate.p2')}</p>
          </>
        )}

        {id === 'strict' && (
          <>
            <p className="text-fg">{t('guide.explain.strict.p1')}</p>
            <p>{t('guide.explain.strict.p2')}</p>
            <p>{t('guide.explain.strict.p3')}</p>
            <p>{t('guide.explain.strict.p4')}</p>
          </>
        )}

        {id === 'tour' && (
          <>
            <p>{t('guide.explain.tour.intro')}</p>
            <ul className="space-y-2">
              {TOUR_PAGES.map((page) => (
                <li key={page} className="flex items-start gap-2">
                  {/* Ticked once visited, so it is clear what is left without
                      counting the card's own "1 / 4". */}
                  <span className="mt-[3px] shrink-0 w-3 grid place-items-center">
                    {seen.includes(tourVisitKey(page)) && (
                      <Check size={12} style={{ color: sigText('completed') }} />
                    )}
                  </span>
                  <span className="flex-1">{t(`guide.explain.tour.${page}`)}</span>
                  <button
                    onClick={() => onGoToPage(page)}
                    className="shrink-0 text-[11px] text-accent hover:underline"
                  >
                    {t('guide.goThere')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        {id === 'language' ? (
          <>
            <button onClick={onClose} className={secondaryBtn}>
              {t('guide.explain.language.skip')}
            </button>
            <button
              onClick={() => {
                setActiveView('settings')
                onClose()
              }}
              className={primaryBtn}
            >
              {t('guide.goThere')}
            </button>
          </>
        ) : (
          <button onClick={onClose} className={primaryBtn}>
            {t('guide.close')}
          </button>
        )}
      </div>
    </Modal>
  )
}

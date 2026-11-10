import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { Modal } from './ui'
import { useT } from '../lib/useT'
import { buildSystemPrompt } from '../lib/ai/appGuide'
import { AI_TOOLS, AiProposal, ToolContext, executeTool } from '../lib/ai/tools'
import { runAiTurn } from '../lib/ai/agent'
import { createDeepSeekProvider } from '../lib/ai/deepseek'
import { applyProposal } from '../lib/ai/apply'
import { aiErrorMessage } from '../lib/ai/errors'
import { AiMessage } from '../lib/ai/types'
import { formatHours } from '../lib/schedule'

type TimelineItem =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'proposal'; proposal: AiProposal; status: 'pending' | 'applied' | 'cancelled' | 'failed' }

/**
 * The assistant panel.
 *
 * The model sees no screen and no store: this component hands it the app guide
 * and the tool schemas, executes reads, and shows a proposal card for every
 * write. The store is only touched when the user presses Apply, and a second
 * turn then asks the model for the short "what changed / next time" explanation.
 */
export function AiCopilot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const aiApiKey = useStore((s) => s.aiApiKey)
  const setActiveView = useStore((s) => s.setActiveView)
  const configured = aiApiKey.trim() !== ''

  const [items, setItems] = useState<TimelineItem[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const messagesRef = useRef<AiMessage[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [items, busy])

  const close = () => {
    abortRef.current?.abort()
    onClose()
  }

  const stop = () => {
    abortRef.current?.abort()
  }

  const clear = () => {
    abortRef.current?.abort()
    messagesRef.current = []
    setItems([])
    setInput('')
    setError(null)
    setActiveTool(null)
    setBusy(false)
  }

  const push = (item: TimelineItem) => setItems((list) => [...list, item])

  const lastAssistantText = (messages: AiMessage[]): string | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message.role === 'assistant' && typeof message.content === 'string' && message.content.trim()) {
        return message.content.trim()
      }
    }
    return null
  }

  const run = async (history: AiMessage[]) => {
    const state = useStore.getState()
    if (!state.aiApiKey.trim()) {
      setError(t('ai.error.noKey'))
      return
    }
    setBusy(true)
    setError(null)
    setActiveTool(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const provider = createDeepSeekProvider({ apiKey: state.aiApiKey, model: state.aiModel })
      const system = buildSystemPrompt({
        lang: state.lang,
        today: state.today,
        projects: state.projects.map((project) => ({ id: project.id, name: project.name })),
      })
      const ctx: ToolContext = {
        tasks: state.tasks,
        projects: state.projects,
        logs: state.logs,
        dayPlans: state.dayPlans,
        habits: state.habits,
        chores: state.chores,
        today: state.today,
      }
      const result = await runAiTurn({
        provider,
        messages: history,
        system,
        tools: AI_TOOLS,
        execute: (call, input) => executeTool(call.function.name, input, ctx, call.id),
        signal: controller.signal,
        onTool: (name, phase) => setActiveTool(phase === 'start' ? name : null),
      })
      messagesRef.current = result.messages
      if (result.stopped === 'error') {
        if (controller.signal.aborted) return
        setError(aiErrorMessage(t, result.error))
        return
      }
      if (result.stopped === 'max_steps') {
        setError(t('ai.error.maxSteps'))
        return
      }
      const fresh = result.messages.slice(history.length)
      const text = lastAssistantText(fresh)
      if (text) push({ kind: 'assistant', text })
      for (const proposal of result.proposals) push({ kind: 'proposal', proposal, status: 'pending' })
    } catch (err) {
      if (!controller.signal.aborted) setError(aiErrorMessage(t, err))
    } finally {
      setBusy(false)
      setActiveTool(null)
      abortRef.current = null
    }
  }

  const send = () => {
    const text = input.trim()
    if (!text || busy) return
    if (!configured) {
      setError(t('ai.error.noKey'))
      return
    }
    setInput('')
    setError(null)
    push({ kind: 'user', text })
    const history = [...messagesRef.current, { role: 'user' as const, content: text }]
    void run(history)
  }

  const apply = async (item: Extract<TimelineItem, { kind: 'proposal' }>) => {
    if (item.status !== 'pending' || busy) return
    const state = useStore.getState()
    const result = applyProposal(
      item.proposal,
      {
        addProject: state.addProject,
        addTask: state.addTask,
        setDayPlan: state.setDayPlan,
        setDayCapacity: state.setDayCapacity,
        withUndo: state.withUndo,
      },
      t('ai.undo.taskTree'),
    )
    if (!result.ok) {
      setItems((list) =>
        list.map((entry) =>
          entry.kind === 'proposal' && entry.proposal.id === item.proposal.id
            ? { ...entry, status: 'failed' as const }
            : entry,
        ),
      )
      setError(t('ai.applyFailed', { message: result.message }))
      messagesRef.current = [
        ...messagesRef.current,
        { role: 'user', content: `The proposal was not applied: ${result.message}` },
      ]
      return
    }
    setItems((list) =>
      list.map((entry) =>
        entry.kind === 'proposal' && entry.proposal.id === item.proposal.id
          ? { ...entry, status: 'applied' as const }
          : entry,
      ),
    )
    const prompt = t('ai.appliedPrompt', { summary: item.proposal.summary, result: result.summary })
    const history = [...messagesRef.current, { role: 'user' as const, content: prompt }]
    await run(history)
  }

  const cancel = (item: Extract<TimelineItem, { kind: 'proposal' }>) => {
    if (item.status !== 'pending') return
    setItems((list) =>
      list.map((entry) =>
        entry.kind === 'proposal' && entry.proposal.id === item.proposal.id
          ? { ...entry, status: 'cancelled' as const }
          : entry,
      ),
    )
    push({ kind: 'note', text: t('ai.cancelled') })
    messagesRef.current = [
      ...messagesRef.current,
      { role: 'user', content: 'The user cancelled the proposal. Nothing was written.' },
    ]
  }

  const goSettings = () => {
    setActiveView('settings')
    close()
  }

  if (!open) return null

  return (
    <Modal title={t('ai.title')} onClose={close} width={680}>
      <div className="flex flex-col h-[60vh] min-h-[360px]">
        <div className="flex-1 min-h-0 overflow-auto space-y-3 pr-1">
          {items.length === 0 && <p className="text-[12px] text-dim">{t('ai.empty')}</p>}
          {items.map((item, index) => {
            if (item.kind === 'user') {
              return (
                <div key={index} className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl bg-accent/10 border border-accent/25 px-3 py-2 text-[12px] text-fg whitespace-pre-wrap">
                    {item.text}
                  </div>
                </div>
              )
            }
            if (item.kind === 'assistant') {
              return (
                <div key={index} className="text-[12px] leading-relaxed text-fg/90 whitespace-pre-wrap">
                  {item.text}
                </div>
              )
            }
            if (item.kind === 'note') {
              return (
                <div key={index} className="text-[11px] text-dim">
                  {item.text}
                </div>
              )
            }
            return (
              <ProposalCard
                key={`${item.proposal.id}-${index}`}
                item={item}
                busy={busy}
                onApply={() => void apply(item)}
                onCancel={() => cancel(item)}
              />
            )
          })}
          {busy && (
            <div className="text-[11px] text-dim">
              {activeTool ? t('ai.toolRunning', { name: activeTool }) : t('ai.thinking')}
            </div>
          )}
          {error && <div className="text-[12px] text-delayed">{error}</div>}
          <div ref={bottomRef} />
        </div>

        {!configured && (
          <div className="mt-2 rounded-[4px] border border-border bg-panel2/40 p-3 flex items-center gap-3">
            <p className="flex-1 text-[12px] text-muted">{t('ai.notConfigured')}</p>
            <button
              onClick={goSettings}
              className="shrink-0 h-7 px-2.5 text-[11px] font-medium bg-accent text-on-accent rounded-[3px]"
            >
              {t('ai.goSettings')}
            </button>
          </div>
        )}

        <div className="shrink-0 border-t border-line pt-2 mt-2 space-y-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            disabled={!configured || busy}
            placeholder={t('ai.placeholder')}
            rows={2}
            className="w-full resize-none rounded-[4px] bg-panel2 border border-border px-2.5 py-2 text-[12px] text-fg placeholder:text-dim outline-none focus:border-accent disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={clear}
              disabled={busy || items.length === 0}
              className="h-7 px-2.5 text-[11px] text-muted hover:text-fg border border-border rounded-[3px] disabled:opacity-40"
            >
              {t('ai.clear')}
            </button>
            <div className="flex-1" />
            {busy ? (
              <button onClick={stop} className="h-7 px-3 text-[11px] font-medium text-fg border border-border rounded-[3px] hover:bg-panel2">
                {t('ai.stop')}
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim() || !configured}
                className="h-7 px-3 text-[11px] font-medium bg-accent text-on-accent rounded-[3px] disabled:opacity-40"
              >
                {t('ai.send')}
              </button>
            )}
          </div>
          <p className="text-[10px] leading-relaxed text-dim">{t('ai.disclosure')}</p>
        </div>
      </div>
    </Modal>
  )
}

function ProposalCard({
  item,
  busy,
  onApply,
  onCancel,
}: {
  item: Extract<TimelineItem, { kind: 'proposal' }>
  busy: boolean
  onApply: () => void
  onCancel: () => void
}) {
  const t = useT()
  const proposal = item.proposal
  const pending = item.status === 'pending'
  return (
    <div className="rounded-xl border border-border bg-panel2/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-fg">
          {proposal.kind === 'task_tree' ? t('ai.proposal.taskTree') : t('ai.proposal.dayPlan')}
        </span>
        <span className={`ml-auto text-[10px] ${item.status === 'failed' ? 'text-delayed' : 'text-dim'}`}>
          {item.status === 'pending'
            ? t('ai.proposal.pending')
            : item.status === 'applied'
              ? t('ai.proposal.applied')
              : item.status === 'cancelled'
                ? t('ai.proposal.cancelled')
                : t('ai.error.unknown')}
        </span>
      </div>

      {proposal.kind === 'task_tree' ? (
        <>
          <div className="text-[11px] text-muted">
            {t('ai.proposal.project')}:{' '}
            {proposal.project.kind === 'new'
              ? `${t('ai.proposal.newProject')} · ${proposal.project.name}`
              : proposal.project.name}
            {proposal.parent ? ` · ${t('ai.proposal.parent')} ${proposal.parent.name}` : ''}
          </div>
          <div className="max-h-48 overflow-auto rounded-[4px] border border-line bg-panel px-2 py-1">
            {proposal.rows.map((row) => (
              <div
                key={row.key}
                className="flex items-center gap-2 h-6 text-[11px] whitespace-nowrap"
                style={{ paddingLeft: 4 + row.depth * 14 }}
              >
                <span className="min-w-0 truncate text-fg/90">{row.name}</span>
                {row.isTodo ? (
                  <span className="shrink-0 text-[10px] text-dim">{t('todo.folderName')}</span>
                ) : (
                  <span className="shrink-0 font-mono text-[9px] text-dim">
                    {row.startDate ?? '—'} → {row.endDate ?? '—'}
                    {row.deadline ? ` · ddl ${row.deadline}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="text-[11px] text-muted">
            {proposal.date} ·{' '}
            {proposal.mode === 'rest'
              ? t('ai.proposal.rest')
              : proposal.mode === 'clear'
                ? t('ai.proposal.clear')
                : t('common.taskCount', { count: proposal.rows.length })}
          </div>
          {proposal.mode === 'tasks' && (
            <div className="max-h-40 overflow-auto rounded-[4px] border border-line bg-panel px-2 py-1">
              {proposal.rows.map((row) => (
                <div key={row.id} className="flex items-center gap-2 h-6 text-[11px]">
                  <span className="min-w-0 truncate text-fg/90">{row.name}</span>
                  {row.hours != null && (
                    <span className="ml-auto shrink-0 font-mono text-[9px] text-dim">
                      {formatHours(row.hours)}h
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="text-[10px] text-today">{t('ai.proposal.noUndo')}</div>
        </>
      )}

      {pending && (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="h-7 px-2.5 text-[11px] text-muted hover:text-fg border border-border rounded-[3px] disabled:opacity-40"
          >
            {t('ai.proposal.cancel')}
          </button>
          <button
            onClick={onApply}
            disabled={busy}
            className="h-7 px-3 text-[11px] font-medium bg-accent text-on-accent rounded-[3px] disabled:opacity-40"
          >
            {t('ai.proposal.apply')}
          </button>
        </div>
      )}
    </div>
  )
}

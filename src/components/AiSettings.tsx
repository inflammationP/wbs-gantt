import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { listDeepSeekModels, testDeepSeekConnection } from '../lib/ai/deepseek'
import { aiErrorMessage } from '../lib/ai/errors'
import { DEFAULT_AI_MODEL } from '../lib/ai/constants'
import { useT } from '../lib/useT'
import { Field, inputCls } from './ui'

/**
 * The AI section on Settings.
 *
 * The key is deliberately a local preference, not board data: exporting a board
 * must never carry a credential. The field is a password input, and the copy
 * says where it is stored; this is the same trade-off the reminder token makes.
 */
export function AiSettingsSection() {
  const t = useT()
  const aiApiKey = useStore((s) => s.aiApiKey)
  const aiModel = useStore((s) => s.aiModel)
  const setAiConfig = useStore((s) => s.setAiConfig)

  const [key, setKey] = useState(aiApiKey)
  const [model, setModel] = useState(aiModel || DEFAULT_AI_MODEL)
  const [models, setModels] = useState<string[]>([])
  const [custom, setCustom] = useState(false)
  const [testing, setTesting] = useState(false)

  // Fetched ids first; the known aliases keep the dropdown usable without a key.
  const options = [...new Set([...models, DEFAULT_AI_MODEL, 'deepseek-reasoner', model])]

  // Suggestions only: a failed lookup leaves the field as plain free text.
  useEffect(() => {
    if (!aiApiKey.trim()) return
    void listDeepSeekModels({ apiKey: aiApiKey }).then(setModels)
  }, [aiApiKey])
  const [result, setResult] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const save = () => {
    setAiConfig({ apiKey: key, model })
    setResult(null)
    setFailed(false)
  }

  const test = async () => {
    const apiKey = key.trim()
    const chosen = model.trim() || DEFAULT_AI_MODEL
    setAiConfig({ apiKey, model: chosen })
    setTesting(true)
    setResult(null)
    setFailed(false)
    try {
      await testDeepSeekConnection({ apiKey, model: chosen })
      setResult(t('ai.settings.success'))
      void listDeepSeekModels({ apiKey }).then(setModels)
    } catch (err) {
      setFailed(true)
      setResult(t('ai.settings.failure', { message: aiErrorMessage(t, err) }))
    } finally {
      setTesting(false)
    }
  }

  return (
    <section>
      <h2 className="text-[14px] font-semibold text-fg mb-1">{t('ai.settings.title')}</h2>
      <p className="text-[12px] text-muted mb-3">{t('ai.settings.hint')}</p>

      <div className="space-y-3">
        <Field label={t('ai.settings.key')}>
          <input
            type="password"
            className={inputCls}
            value={key}
            onChange={(e) => setKey(e.currentTarget.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Field label={t('ai.settings.model')}>
          {custom ? (
            <input
              className={inputCls}
              value={model}
              onChange={(e) => setModel(e.currentTarget.value)}
              onBlur={() => {
                if (model.trim()) return
                setModel(DEFAULT_AI_MODEL)
                setCustom(false)
              }}
              spellCheck={false}
              autoFocus
            />
          ) : (
            <select
              className={inputCls}
              value={model}
              onChange={(e) => {
                if (e.currentTarget.value === '__custom__') {
                  setCustom(true)
                  return
                }
                setModel(e.currentTarget.value)
              }}
            >
              {options.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
              <option value="__custom__">{t('ai.settings.customModel')}</option>
            </select>
          )}
        </Field>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={save}
          className="h-8 px-3 text-[12px] text-muted hover:text-fg border border-border rounded-[3px]"
        >
          {t('common.save')}
        </button>
        <button
          onClick={() => void test()}
          disabled={testing}
          className="h-8 px-3 text-[12px] text-fg border border-border rounded-[3px] hover:bg-panel2 disabled:opacity-40"
        >
          {testing ? t('ai.settings.testing') : t('ai.settings.test')}
        </button>
      </div>

      {result && (
        <p className={`mt-2 text-[12px] ${failed ? 'text-delayed' : 'text-completed'}`}>{result}</p>
      )}
      <p className="mt-2 text-[11px] text-dim">{t('ai.settings.fixed')}</p>
      <p className="mt-1 text-[11px] text-dim">{t('ai.settings.storage')}</p>
    </section>
  )
}

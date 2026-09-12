import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import { LANGS, LANG_LABEL, Lang, formatLongDate } from '../lib/i18n'
import { CHROME_TOKENS, SIGNAL_TOKENS, THEME_ORDER, ThemeId, tripletToHex } from '../lib/theme'
import { STATUS_META } from '../lib/ui'
import { useT } from '../lib/useT'

export function SettingsPage() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-[18px] font-semibold text-fg">{t('nav.settings')}</h1>

        {/* ---- Language ---- */}
        <section>
          <h2 className="text-[14px] font-semibold text-fg mb-1">{t('settings.language')}</h2>
          <p className="text-[12px] text-muted mb-3">{t('settings.languageHint')}</p>
          <div className="grid grid-cols-3 gap-3">
            {LANGS.map((code) => (
              <LanguageCard key={code} code={code} active={code === lang} onSelect={() => setLang(code)} />
            ))}
          </div>
        </section>

        {/* ---- Theme ---- */}
        <section>
          <h2 className="text-[14px] font-semibold text-fg mb-1">{t('settings.theme')}</h2>
          <p className="text-[12px] text-muted mb-1">{t('settings.themeHint')}</p>
          <p className="text-[11px] text-dim mb-3">{t('settings.themeNote')}</p>
          <div className="space-y-3">
            {THEME_ORDER.map((id) => (
              <ThemeCard key={id} id={id} active={id === theme} onSelect={() => setTheme(id)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function LanguageCard({ code, active, onSelect }: { code: Lang; active: boolean; onSelect: () => void }) {
  const t = useT()
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={`text-left px-4 py-3 bg-panel border rounded-[3px] transition-colors ${
        active ? 'border-accent ring-1 ring-inset ring-accent' : 'border-border hover:border-muted'
      }`}
    >
      <div className="text-[14px] font-semibold text-fg">{LANG_LABEL[code]}</div>
      {/* A real date in that language, which is what actually tells the three
          apart — the names alone look like three words, not three formats. */}
      <div className="text-[11px] text-muted mt-1 font-mono">{formatLongDate(code, new Date())}</div>
      <div className="text-[10px] text-dim mt-1.5">{active ? t('settings.active') : ''}</div>
    </button>
  )
}

/**
 * One palette, shown as the palette.
 *
 * Three parts, and the middle one is the point. The miniature says what the
 * theme looks like; the swatch boards say what it *is* — every token with its
 * hex — and the header names it.
 *
 * The swatch colours are not copied into TypeScript. The board carries
 * `data-theme`, so the same `--c-*` variables the app reads resolve inside it,
 * and the hex printed under each chip is that variable read back out of the
 * cascade. One source of truth, and a board that cannot advertise a colour the
 * app does not actually use.
 */
function ThemeCard({ id, active, onSelect }: { id: ThemeId; active: boolean; onSelect: () => void }) {
  const t = useT()
  const { ref, hex } = useSwatches(id)

  const chip = (token: string, label: string) => (
    <div key={token} className="flex-1 min-w-0" title={`--c-${token} · ${label}`}>
      <div className="h-7 rounded-[2px] border border-border" style={{ background: `rgb(var(--c-${token}))` }} />
      <div className="mt-1 text-[10px] text-muted truncate leading-tight">{label}</div>
      <div className="text-[9px] font-mono text-muted truncate leading-tight">{hex[token] || ' '}</div>
    </div>
  )

  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full text-left p-3 bg-panel border rounded-[3px] transition-colors ${
        active ? 'border-accent ring-1 ring-inset ring-accent' : 'border-border hover:border-muted'
      }`}
    >
      <div className="flex items-baseline gap-2 mb-2.5">
        <span className="text-[14px] font-semibold text-fg">{t(`theme.${id}.name`)}</span>
        <span className="text-[11px] text-muted">{t(`theme.${id}.hint`)}</span>
        {active && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-accent">
            <Check size={12} /> {t('settings.active')}
          </span>
        )}
      </div>

      <div data-theme={id} ref={ref} className="flex gap-3">
        <Preview />

        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('swatch.groupChrome')}</div>
            <div className="flex gap-1">
              {CHROME_TOKENS.map((token) => chip(token, t(`swatch.${token}`)))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-dim mb-1">{t('swatch.groupSignals')}</div>
            <div className="flex gap-1">
              {/* Labels come from STATUS_META so the board and the app agree on
                  which token carries which meaning, and translate it once. */}
              {SIGNAL_TOKENS.map((token) => chip(token, t(STATUS_META[token].labelKey)))}
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

/**
 * A miniature of the Gantt, painted from the palette's own variables — sidebar,
 * column header, and one bar per signal, which is where a theme's character
 * actually shows up.
 */
function Preview() {
  return (
    <div className="w-[196px] shrink-0 rounded-[3px] border border-border bg-bg p-1.5 flex gap-1.5">
      <div className="w-[52px] shrink-0 rounded-[2px] border border-border bg-panel p-1 space-y-1">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-[1px] bg-accent" />
          <span className="h-1 flex-1 rounded-full bg-muted" />
        </div>
        <div className="h-1.5 rounded-[1px] bg-accent/15" />
        <div className="h-1 w-8 rounded-full bg-muted" />
        <div className="h-1 w-9 rounded-full bg-dim" />
        <div className="h-1 w-7 rounded-full bg-dim" />
      </div>
      <div className="flex-1 rounded-[2px] border border-border bg-panel p-1 space-y-1">
        <div className="flex items-center gap-1 pb-0.5 border-b border-line">
          <div className="h-1 w-4 rounded-full bg-muted" />
          <div className="h-1 w-4 rounded-full bg-muted" />
          <div className="h-1 w-3 rounded-full bg-dim" />
        </div>
        <div className="h-2.5 rounded-[2px] border bg-completed/20 border-completed" />
        <div className="h-2.5 w-4/5 rounded-[2px] border bg-in-progress/20 border-in-progress" />
        <div className="h-2.5 rounded-[2px] border bg-paused/20 border-paused" />
        <div className="h-2.5 w-3/5 rounded-[2px] border bg-delayed/20 border-delayed" />
        <div className="h-2.5 w-2/5 rounded-[2px] border bg-todo/20 border-todo" />
      </div>
    </div>
  )
}

/**
 * The palette's values, as hex.
 *
 * Read out of the cascade rather than kept in a second table: the element
 * carrying `data-theme` already resolves every `--c-*`, so this only has to
 * format what the browser reports. A renamed token blanks its swatch label,
 * which is a visible failure rather than a silent lie.
 */
function useSwatches(id: ThemeId) {
  const ref = useRef<HTMLDivElement>(null)
  const [hex, setHex] = useState<Record<string, string>>({})

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const cs = getComputedStyle(el)
    const next: Record<string, string> = {}
    for (const token of [...CHROME_TOKENS, ...SIGNAL_TOKENS]) {
      next[token] = tripletToHex(cs.getPropertyValue(`--c-${token}`))
    }
    setHex(next)
  }, [id])

  return { ref, hex }
}

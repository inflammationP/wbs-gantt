import { Fragment, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../store/useStore'
import { Dict, Lang, Params, template, translate } from './i18n'

export type TFunc = (key: keyof Dict, params?: Params) => string

/** The active language, for the `lib/` formatters that take one as an argument. */
export function useLang(): Lang {
  return useStore((s) => s.lang)
}

/**
 * Translate.
 *
 * The returned function keeps its identity until the language changes. That
 * matters more than it looks: this codebase memoises heavily, and a `t` that
 * changed on every render would churn every memo that ever took it as a
 * dependency. Depend on `t` freely — it only moves when the text does.
 */
export function useT(): TFunc {
  const lang = useLang()
  return useCallback<TFunc>((key, params) => translate(lang, key, params), [lang])
}

/**
 * Translate a sentence that carries markup inside it.
 *
 * A handful of sentences emphasise part of themselves — the task name at the
 * start of a warning, the folder a to-do lands in — and those cannot be built by
 * concatenation, because the emphasised part sits in a different position in
 * each language. Passing elements as parameters lets the translation place them
 * wherever its own grammar wants them.
 */
export function useTRich(): (key: keyof Dict, nodes: Record<string, ReactNode>) => ReactNode {
  const lang = useLang()
  return useCallback(
    (key, nodes) => {
      const tpl = template(lang, key)
      const parts: ReactNode[] = []
      const placeholder = /\{(\w+)\}/g
      let cursor = 0
      let match: RegExpExecArray | null
      while ((match = placeholder.exec(tpl)) !== null) {
        if (match.index > cursor) parts.push(tpl.slice(cursor, match.index))
        parts.push(<Fragment key={parts.length}>{nodes[match[1]] ?? match[0]}</Fragment>)
        cursor = match.index + match[0].length
      }
      if (cursor < tpl.length) parts.push(tpl.slice(cursor))
      return <>{parts}</>
    },
    [lang],
  )
}

import { useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'

/**
 * The log editor's textarea: Tab indents, Shift+Tab outdents.
 *
 * A leading tab is a sub-item in the log format (`parseLogContent`), so Tab has
 * to do that here rather than move focus to the next control — which is the
 * browser's default, and the one behaviour this format cannot survive.
 *
 * A component rather than a hook because the key handling is not the whole of
 * it: setting `.value` on a controlled textarea resets the selection to the end,
 * so the caret has to be put back after the re-render the keystroke caused. That
 * ref dance is why this is written down once — a second copy would be a second
 * place for the caret to jump to the end of the box.
 *
 * Two callers, and they are the same box: `LogDialog`, for a task, and
 * `ItemLogDialog`, for a routine or a chore. The same text in the same shape is
 * read back by the same `LogLines`, so the two were always the same editor.
 */
export function LogTextarea({
  value,
  onChange,
  className,
  placeholder,
  autoFocus,
  readOnly,
}: {
  value: string
  onChange: (next: string) => void
  className: string
  placeholder: string
  autoFocus?: boolean
  readOnly?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // Caret position to restore after the controlled re-render.
  const pendingSel = useRef<[number, number] | null>(null)

  useLayoutEffect(() => {
    const sel = pendingSel.current
    if (!sel || !ref.current) return
    pendingSel.current = null
    ref.current.setSelectionRange(sel[0], sel[1])
  }, [value])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || readOnly) return
    const el = ref.current
    if (!el) return
    e.preventDefault()
    const { selectionStart: s, selectionEnd: en, value: text } = el

    if (e.shiftKey) {
      // Outdent: drop one leading tab from the caret's line.
      const lineStart = text.lastIndexOf('\n', s - 1) + 1
      if (text[lineStart] !== '\t') return
      pendingSel.current = [Math.max(lineStart, s - 1), Math.max(lineStart, en - 1)]
      onChange(text.slice(0, lineStart) + text.slice(lineStart + 1))
      return
    }

    pendingSel.current = [s + 1, en + 1]
    onChange(text.slice(0, s) + '\t' + text.slice(en))
  }

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
      readOnly={readOnly}
    />
  )
}

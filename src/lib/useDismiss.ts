import { useEffect } from 'react'

/**
 * Put a floating thing away when the reader presses somewhere else, or hits
 * Escape.
 *
 * `keep` is a selector for what a press must *not* dismiss on: the popup itself,
 * and the button that opened it. That second one is the whole reason this is a
 * listener rather than the full-screen backdrop the context menu uses. A popup
 * with a button behind it has to let the press on that button through, or the
 * button could only ever open — the second press would be eaten, and "press it
 * again to put it away" would never arrive. And a backdrop swallows the press
 * that was aimed at the row underneath, which is a click the reader made on
 * purpose: with the listener, that click still lands, and the popup simply gets
 * out of the way on the way.
 *
 * The context menu is the case where a backdrop *is* right, and it is the one
 * without a button: nothing behind it was waiting to be clicked, and the
 * right-click that follows its own closing press has to be swallowed.
 *
 * Each popup carries its own marks for this — `data-daily-bubble` beside
 * `data-daily-toggle`, `data-add-menu` beside `data-add-toggle` — and passes the
 * pair in.
 */
export function useDismiss(keep: string, onClose: () => void): void {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // `instanceof` rather than a cast: the target of a press can be the
      // document itself, and `closest` is only on elements.
      const el = e.target
      if (el instanceof Element && el.closest(keep)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [keep, onClose])
}

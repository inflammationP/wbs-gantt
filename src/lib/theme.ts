/**
 * Which palette the app paints with.
 *
 * The colours themselves live in `src/index.css`, one `[data-theme='…']` block
 * each, because every consumer is a CSS variable — Tailwind classes and inline
 * `rgb(var(--c-x))` strings alike. Nothing in the app needs a palette value as a
 * JavaScript string, so there is no second copy to drift out of step. (The
 * Settings page reads the values back out of the cascade when it wants to print
 * them as hex; see `useSwatches` there.)
 *
 * Names are deliberately one word each, and all four are substances: graphite,
 * slate and embers are what a fire leaves behind, paper is what graphite is
 * drawn on.
 */
export type ThemeId = 'graphite' | 'slate' | 'ember' | 'paper'

/** Display order: the default, then progressively further from it. */
export const THEME_ORDER: ThemeId[] = ['graphite', 'slate', 'ember', 'paper']

export const DEFAULT_THEME: ThemeId = 'graphite'

export function isThemeId(value: string): value is ThemeId {
  return (THEME_ORDER as string[]).includes(value)
}

/** The chrome tokens, in the order the Settings page lays them out. */
export const CHROME_TOKENS = [
  'bg', 'panel', 'panel2', 'stripe', 'border', 'line', 'fg', 'muted', 'dim', 'accent',
] as const

/** The signal tokens, likewise. */
export const SIGNAL_TOKENS = [
  'todo', 'not-started', 'in-progress', 'completed', 'paused', 'delayed',
] as const

/**
 * Point the document at a palette.
 *
 * The attribute drives the whole app: every colour reads `var(--c-…)`, so this
 * one write repaints everything, with no React involvement at all. It is also how
 * the Settings page shows a palette — the same `[data-theme]` selector applies to
 * any element, not just the root, so a swatch board resolves the variables it is
 * advertising.
 *
 * The document does not depend on this having run: `:root` carries graphite, and
 * `body` reads its background from `var(--c-bg)`. That matters, because a `var()`
 * with no fallback that resolves to nothing invalidates the declaration instead
 * of degrading — a missing default would leave the app showing the bare canvas.
 *
 * Set directly rather than through an effect: an effect would render, paint, and
 * only then restyle, so every switch would show one frame of the old palette.
 */
export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id
}

/** `10 13 16` (the stored triplet) as `#0a0d10`, for display. */
export function tripletToHex(triplet: string): string {
  const [r, g, b] = triplet.trim().split(/\s+/).map(Number)
  if ([r, g, b].some((n) => !Number.isFinite(n))) return ''
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

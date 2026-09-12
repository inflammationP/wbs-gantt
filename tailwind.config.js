/** @type {import('tailwindcss').Config} */
// Every colour resolves through a CSS variable declared in `src/index.css`, so a
// theme switch is one attribute change on <html> rather than a re-render. The
// `R G B` triplet + `<alpha-value>` form is required, not cosmetic: the app uses
// alpha modifiers in 28 places (`bg-panel2/50`, `text-fg/90`, `bg-accent/[0.07]`,
// `ring-accent`, `border-accent/60`, …) and this is what makes them compose.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // chrome
        bg: v('bg'),
        panel: v('panel'),
        panel2: v('panel2'),
        stripe: v('stripe'),
        border: v('border'),
        line: v('line'),
        fg: v('fg'),
        muted: v('muted'),
        dim: v('dim'),
        accent: v('accent'),
        'on-accent': v('on-accent'),
        // `today` is the amber signal under another name: it marks today's date
        // and the day panel's warning tone, both of which are that same amber.
        today: v('in-progress'),
        // signals — solid form. Dots, bar borders and fills, and the wash on a
        // badge (`bg-delayed/15`). The readable variant is `-text`, reached
        // through `sigText()` in lib/ui.ts rather than a class.
        todo: v('todo'),
        'not-started': v('not-started'),
        'in-progress': v('in-progress'),
        completed: v('completed'),
        paused: v('paused'),
        delayed: v('delayed'),
      },
    },
  },
  plugins: [],
}

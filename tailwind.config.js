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
      // One-off, when the day's ring reaches 100%. Two halves: the ring gives a
      // short pop, and a halo it throws off fades as it widens.
      keyframes: {
        cheer: {
          '0%': { transform: 'scale(1)', filter: 'none' },
          '30%': { transform: 'scale(1.06)', filter: 'drop-shadow(0 0 12px rgb(var(--c-completed) / 0.55))' },
          '100%': { transform: 'scale(1)', filter: 'none' },
        },
        'cheer-halo': {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
      },
      animation: {
        cheer: 'cheer 1s ease-out',
        'cheer-halo': 'cheer-halo 900ms ease-out forwards',
      },
    },
  },
  plugins: [],
}

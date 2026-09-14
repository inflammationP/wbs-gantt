import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const host = process.env.TAURI_DEV_HOST

// `tauri.conf.json`'s version, not package.json's — the former is what
// `scripts/release.mjs` bumps and what the updater compares against, so it is
// the only one that can honestly answer "which build am I running". Read here
// rather than at runtime so the browser bundle gets it too; it has no Tauri API
// to ask. Consequence: the dev server does not watch `src-tauri/**`, so after a
// release the number on screen is stale until the server restarts.
const appVersion: string = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).version

// Published through `import.meta.env`, not `define`.
//
// `define` is substituted only when building: Vite's define plugin returns
// early for client modules in dev, so a `define`d constant survives into the
// dev server as a bare identifier and throws `ReferenceError` the moment the
// component renders. `loadEnv` reads prefixed keys straight out of
// `process.env` — and the config file is evaluated before it runs — so setting
// it here reaches both dev and build. Verified in both.
process.env.VITE_APP_VERSION = appVersion

export default defineConfig({
  plugins: [react()],
  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,
  // Tauri expects a fixed port; fail if it's unavailable.
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // Env vars with these prefixes are exposed to the frontend via import.meta.env.
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
})

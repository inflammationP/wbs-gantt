/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The running build's version, published by `vite.config.ts` from
   * `src-tauri/tauri.conf.json`.
   *
   * An injected constant rather than `getVersion()` from `@tauri-apps/api`,
   * because the browser bundle has no Tauri to ask — and `@tauri-apps/api` is
   * only a transitive dependency here, not a declared one.
   */
  readonly VITE_APP_VERSION: string
}

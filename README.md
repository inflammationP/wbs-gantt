# WBS · Gantt

![GitHub release](https://img.shields.io/github/v/release/inflammationP/wbs-gantt)

A work breakdown structure (WBS) + Gantt chart task manager. Multi-level tasks, a draggable timeline, long-term goals, and local data storage. Available as a web app and a Windows desktop app.

## Features

- Multi-level task tree with automatic WBS numbering (`1` / `1.1` / `1.1.1`)
- Gantt timeline at five granularities: Day / Week / Month / Quarter / Year
- Drag bars to move tasks or resize their start/end dates
- Long-term goals without an end date
- Project filtering, plus task and project detail panels
- Import / export JSON

## Install

Pre-built Windows installer: [Releases](https://github.com/inflammationP/wbs-gantt/releases).

## Getting Started

### Web

```bash
npm install
npm run dev        # dev server
npm run build      # production build (dist/)
npm run deploy     # deploy to Cloudflare
```

### Desktop (Windows)

Requires the [Rust](https://rustup.rs) toolchain and the MSVC build tools.

```bash
npm run tauri dev      # desktop dev mode
npm run tauri build    # build the NSIS installer
```

`npm run release` builds, signs, and publishes a GitHub Release with auto-update.

## Tech Stack

React · TypeScript · Vite · Zustand · Tailwind CSS · Tauri 2

## Data

Data is stored locally (localStorage on web, WebView localStorage on desktop), with JSON import/export.

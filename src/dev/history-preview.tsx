/**
 * The history tree over a fabricated board.
 *
 * `npm run dev`, then http://localhost:1420/preview-history.html — the real
 * `HistoryDialog`, driven through the real store actions so the labels, the
 * times and the branch are the ones the app would produce. No Tauri build, no
 * app, and no board of the user's own: every name on screen is a string written
 * below.
 *
 * The shape it builds on purpose is a **fork**: five steps, then two of them
 * undone, then new work — so the abandoned branch is on screen next to the live
 * one and the grey against the lit can be judged. `?lang=fr` / `?theme=paper`
 * for the other languages and palettes.
 *
 * Nothing imports this file, and `vite build` takes `index.html` alone, so
 * neither this page nor its board reaches an installer. Same footing as
 * `preview-merge.html`.
 */
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore'
import { HistoryDialog } from '../components/HistoryDialog'
import { applyLang, isLang } from '../lib/i18n'
import { applyTheme, isThemeId } from '../lib/theme'
import { PROJECT_COLORS } from '../lib/ui'
import { Task } from '../types'
import '../index.css'

const params = new URLSearchParams(location.search)
const lang = params.get('lang') ?? 'zh'
const theme = params.get('theme') ?? 'graphite'
if (isLang(lang)) applyLang(lang)
if (isThemeId(theme)) applyTheme(theme)

const task = (over: Pick<Task, 'id' | 'name' | 'projectId'> & Partial<Task>): Task => ({
  description: '',
  parentId: null,
  type: 'phase',
  isTodo: false,
  startDate: '2026-10-01',
  endDate: '2026-10-20',
  strictProgress: false,
  confirmedDays: [],
  paused: false,
  pauseDate: null,
  pauses: [],
  priority: 'medium',
  tags: [],
  dependencies: [],
  createdAt: '',
  updatedAt: '',
  ...over,
})

const P1 = { id: 'p1', name: '工作', color: PROJECT_COLORS[0], description: '' }
const P2 = { id: 'p2', name: '学习', color: PROJECT_COLORS[1], description: '' }

// Straight into the store, the same way the app loads a board. Through
// `importData` because that is also what clears the history, so the fixture
// below starts from step zero.
useStore.getState().importData({
  projects: [P1, P2],
  tasks: [
    task({ id: 'a', name: '需求评审', projectId: 'p1', order: 0 }),
    task({ id: 'b', name: '接口设计', projectId: 'p1', order: 1 }),
    task({ id: 'c', name: '联调', projectId: 'p1', order: 2 }),
    task({ id: 'd', name: '读完《SICP》', projectId: 'p2', order: 0 }),
  ],
  logs: [],
})

const s = () => useStore.getState()

// --- five steps, each one the kind of thing the tree is meant to show ------

s().addTask({ name: '压测', projectId: 'p1', startDate: '2026-10-01', endDate: '2026-10-05' })
s().withUndo('重命名 联调', () => s().updateTask('c', { name: '联调与压测' }))
s().withUndo('归档 需求评审', () => s().archiveTasks(['a']))
s().mergeProjects(['p2'], 'p1', true)
s().withUndo('删除 接口设计', () => s().deleteTask('b'))

// --- a fork: two presses back, then new work ------------------------------

s().undoLast()
s().undoLast()
s().withUndo('暂停 联调与压测', () => s().pauseTask('c'))

createRoot(document.getElementById('root')!).render(<HistoryDialog onClose={() => {}} />)

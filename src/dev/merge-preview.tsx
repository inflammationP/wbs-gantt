/**
 * The project dialog over a fabricated board.
 *
 * `npm run dev`, then http://localhost:1420/preview-merge.html — the real
 * `ProjectManageDialog`, with three made-up projects and enough nesting under
 * them that the preview's connector lines have something to say. No Tauri build,
 * no app, and no board of the user's own: every name on screen is a string
 * written below.
 *
 * `?mode=flat` renders the other placement; `?lang=en` / `?theme=paper` the
 * other languages and palettes. Language and theme go through `applyLang` /
 * `applyTheme` rather than the store's setters, because those persist — looking
 * at the dialog must not change what the app opens in tomorrow.
 *
 * Nothing imports this file, and `vite build` takes `index.html` alone, so
 * neither this page nor its fabricated board reaches an installer. Same footing
 * as `preview-update.html` and `scripts/demo-seed.mjs`.
 */
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore'
import { ProjectManageDialog } from '../components/ProjectManageDialog'
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

const PROJECTS = [
  { id: 'p1', name: '工作', color: PROJECT_COLORS[0], description: '' },
  { id: 'p2', name: '学习', color: PROJECT_COLORS[1], description: '' },
  { id: 'p3', name: '生活', color: PROJECT_COLORS[2], description: '' },
]

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

/** Two levels deep, and an order hand-set on both sides, so nothing is a tie. */
const TASKS: Task[] = [
  task({ id: 'a1', name: '需求评审', projectId: 'p1', order: 0 }),
  task({ id: 'a2', name: '竞品调研', projectId: 'p1', parentId: 'a1', order: 0 }),
  task({ id: 'a3', name: '用户访谈', projectId: 'p1', parentId: 'a1', order: 1 }),
  task({ id: 'a4', name: '接口设计', projectId: 'p1', order: 1 }),
  task({ id: 'a5', name: '联调', projectId: 'p1', order: 2 }),
  task({ id: 'b1', name: '读完《SICP》', projectId: 'p2', order: 0 }),
  task({ id: 'b2', name: '第 1 章', projectId: 'p2', parentId: 'b1', order: 0 }),
  task({ id: 'b3', name: '第 2 章', projectId: 'p2', parentId: 'b1', order: 1 }),
  task({ id: 'b4', name: '每天背单词', projectId: 'p2', order: 1 }),
  task({ id: 'c1', name: '体检', projectId: 'p3', order: 0 }),
]

useStore.setState({ projects: PROJECTS, tasks: TASKS, logs: [], lang: isLang(lang) ? lang : 'zh' })

createRoot(document.getElementById('root')!).render(<ProjectManageDialog onClose={() => {}} />)

/**
 * Which projects to merge away, and which placement, belong to the dialog's own
 * state and cannot be handed in — so they are poked after the fact, and polled,
 * because React commits on its own schedule. Same footing as `?open` in
 * `update-preview.tsx`.
 *
 * Each tick re-queries, so a node React replaced under an earlier tick is never
 * clicked. The first two projects are read as a state and as a name: `?mode=flat`
 * picks the second placement button after both sources are ticked.
 */
const ensureTicked = (name: string) => {
  for (const label of document.querySelectorAll('label')) {
    const box = label.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (!box || !(label.textContent ?? '').includes(name)) continue
    if (!box.disabled && !box.checked) box.click()
    return true
  }
  return false
}

const placeFlat = () =>
  [...document.querySelectorAll('button')].some((b) => {
    if (b.textContent?.trim() !== '直接铺平' && b.textContent?.trim() !== 'At the top level') return false
    b.click()
    return true
  })

const wantFlat = params.get('mode') === 'flat'
let ticks = 0
let settled = false
const timer = setInterval(() => {
  if (++ticks > 200) return clearInterval(timer)
  // The mode is clicked a tick *after* the ticks, not in the same one. Three
  // clicks in one turn made the screenshot disagree with the DOM — the dialog
  // rendered the second mode while the toggle still painted the first — because
  // React flushes each discrete click separately and the capture can land between
  // them. One turn each is all it takes to be sure.
  if (!settled) {
    if (!ensureTicked('学习') || !ensureTicked('生活')) return
    settled = true
    return
  }
  if (wantFlat && !placeFlat()) return
  clearInterval(timer)
}, 50)

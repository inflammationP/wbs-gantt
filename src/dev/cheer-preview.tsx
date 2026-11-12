/**
 * The day ring's 100% cheer, over a fabricated one-task day.
 *
 * `npm run dev`, then http://localhost:1420/preview-cheer.html — the real
 * `DayBoard` in its narrow layout, reading a store that holds one strict leaf
 * scheduled for today. 「完成」 writes the log through the real `addLog`, which
 * is the crossing the effect watches; 「重播」 puts the board back to 0 and fires
 * it again. No board of the user's own, and no clicking a day's worth of tasks
 * to see the effect once.
 *
 * `?lang=fr` / `?theme=paper` for the other language and palette.
 *
 * Nothing imports this file, and `vite build` takes `index.html` alone, so
 * neither this page nor its fixture reaches an installer.
 */
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore'
import { DayBoard } from '../components/DayBoard'
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

const FIXTURE_TASK = 'cheer-preview-task'
const FIXTURE_PROJECT = 'cheer-preview-project'

function seed(): void {
  const { today, importData } = useStore.getState()
  const task: Task = {
    id: FIXTURE_TASK,
    name: '今天这一项',
    description: '',
    parentId: null,
    projectId: FIXTURE_PROJECT,
    type: 'phase',
    isTodo: false,
    startDate: today,
    endDate: today,
    strictProgress: true,
    confirmedDays: [],
    paused: false,
    pauseDate: null,
    pauses: [],
    postponements: [],
    priority: 'medium',
    tags: [],
    dependencies: [],
    createdAt: '',
    updatedAt: '',
  }
  importData({
    projects: [{ id: FIXTURE_PROJECT, name: '预览', color: PROJECT_COLORS[0], description: '' }],
    tasks: [task],
    logs: [],
  })
}

function complete(): void {
  const { today, addLog } = useStore.getState()
  addLog({ taskId: FIXTURE_TASK, date: today, content: '预览：把这一项做完。', targetProgress: 100 })
}

function replay(): void {
  seed()
  // Let the board paint at 0 first, so the effect sees a real crossing rather
  // than a re-seed that lands on 100 in the same render.
  setTimeout(complete, 400)
}

seed()

function Preview() {
  const today = useStore((s) => s.today)
  const done = useStore((s) => s.logs.some((l) => l.taskId === FIXTURE_TASK))

  return (
    <div className="min-h-screen bg-bg text-fg p-6 flex flex-col items-start gap-4">
      <div className="text-[12px] text-muted">当天圆环到 100% 的祝贺预览</div>
      <div className="w-[340px] h-[520px] flex flex-col rounded-2xl border border-border/70 bg-panel overflow-hidden shadow-sm">
        <DayBoard day={today} dayChores={[]} habits={[]} layout="stack" />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={complete}
          disabled={done}
          className="h-8 px-3 text-[12px] rounded-[3px] bg-accent text-on-accent font-medium disabled:opacity-40"
        >
          完成（触发）
        </button>
        <button
          onClick={replay}
          className="h-8 px-3 text-[12px] rounded-[3px] border border-border text-muted hover:text-fg"
        >
          重播
        </button>
      </div>
      <div className="text-[11px] text-dim">先点「完成」看一次；「重播」会自动复位并再放一次。</div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Preview />)

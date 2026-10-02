/**
 * The update dialog with nothing behind it.
 *
 * `npm run dev`, then http://localhost:1420/preview-update.html — the real
 * `UpdateOverlays`, showing a fabricated update and two fabricated older
 * releases pushed straight into the store. No release, no Tauri build, no
 * network, and no copy of the app that is genuinely a version behind: the
 * numbers on screen are the strings written below.
 *
 * `?lang=fr` and `?theme=paper` to see the other two languages and the other
 * three palettes; `?open` to start with the folded section already unfolded.
 * Language and theme are set through `applyLang` / `applyTheme` rather than the
 * store's `setLang` / `setTheme`, because those persist — looking at the dialog
 * must not change what the app opens in tomorrow. Closing the dialog leaves an
 * empty page; reload to bring it back.
 *
 * Nothing imports this file, and `vite build` takes `index.html` alone, so
 * neither this page nor its fabricated releases reach an installer. Same
 * footing as `scripts/demo-seed.mjs`.
 */
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore'
import { UpdateOverlays } from '../components/UpdateOverlays'
import { applyLang, isLang } from '../lib/i18n'
import { applyTheme, isThemeId } from '../lib/theme'
import '../index.css'

const params = new URLSearchParams(location.search)
const lang = params.get('lang') ?? 'zh'
const theme = params.get('theme') ?? 'graphite'
if (isLang(lang)) applyLang(lang)
if (isThemeId(theme)) applyTheme(theme)

/** Deliberately one short, one long: the fold has to hold both. */
const NOTES: Record<string, string[]> = {
  '0.12.0': ['项目颜色增加到 12 个，不够用的那几个人不用再和同事撞色了。'],
  '0.11.0': [
    '优化了使用体验：展开最下面的折叠项后页面会自动下滚。',
    '增加了任务归档功能。现在你可以在任务名右侧的悬浮菜单栏中找到归档按钮并点击将任务归档，随后任务会出现在甘特图最下方的已归档文件夹中。',
    '增加了撤回功能。现在你对任务进行某些操作后，下面会弹出一个撤回选项。',
    '增加了甘特图里一些操作的弹窗确认防止误触。',
    '删除了非编辑模式下待办任务的多选功能。',
  ],
  '0.10.0': [
    '同一时间只跑一个实例。',
    '待办文件夹可以起名。',
    '任务树（系谱图）弹窗。',
  ],
}

const asNotes = (version: string) => NOTES[version].map((line) => `- ${line}`).join('\n')

useStore.setState({
  lang: isLang(lang) ? lang : 'zh',
  updatePhase: 'available',
  updateHistory: [
    { version: '0.11.0', notes: asNotes('0.11.0') },
    { version: '0.10.0', notes: asNotes('0.10.0') },
  ],
  updateInfo: {
    kind: 'available',
    version: '0.12.0',
    current: '0.9.0',
    notes: asNotes('0.12.0'),
    date: null,
    download: async () => {},
    install: async () => {},
    dismiss: async () => {},
  },
})

createRoot(document.getElementById('root')!).render(<UpdateOverlays />)

// `?open` starts with the folded section already unfolded. Its open state
// belongs to the platform and is not something this page can pass down, so it is
// poked after the fact — and polled, because React commits the dialog on its own
// schedule. Makes the expanded layout reachable without a click.
if (params.has('open')) {
  const timer = setInterval(() => {
    const folded = document.querySelector('details')
    if (!folded) return
    clearInterval(timer)
    folded.setAttribute('open', '')
  }, 50)
}

import { useRef, useState } from 'react'
import {
  BarChart2, Calendar, ClipboardList, Download, HelpCircle, LayoutDashboard, Minus, Pencil, Plus,
  Settings, Upload,
} from 'lucide-react'
import { AppView, Project } from '../types'
import { useStore } from '../store/useStore'
import { exportJson, parseImport } from '../store/storage'
import { todayISO } from '../lib/dates'
import { averageProgress } from '../lib/progress'
import { Dict } from '../lib/i18n'
import { useT } from '../lib/useT'
import { ProjectDialog } from './ProjectDialog'
import { useDialogs } from './dialogs'

// Labels are keys rather than text: this table is built once at module scope, so
// a string in it would be frozen in whichever language loaded first.
const NAV: { id: AppView; labelKey: keyof Dict; icon: typeof BarChart2 }[] = [
  { id: 'gantt', labelKey: 'nav.gantt', icon: BarChart2 },
  { id: 'logs', labelKey: 'nav.logs', icon: ClipboardList },
  { id: 'manage', labelKey: 'nav.manage', icon: LayoutDashboard },
  { id: 'calendar', labelKey: 'nav.calendar', icon: Calendar },
  { id: 'settings', labelKey: 'nav.settings', icon: Settings },
]

export function Sidebar() {
  const t = useT()
  const { notice, element: dialogs } = useDialogs()
  const activeView = useStore((s) => s.activeView)
  const setActiveView = useStore((s) => s.setActiveView)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const logs = useStore((s) => s.logs)
  const projectFilter = useStore((s) => s.projectFilter)
  const setProjectFilter = useStore((s) => s.setProjectFilter)
  const setSelected = useStore((s) => s.setSelected)
  const setSelectedProject = useStore((s) => s.setSelectedProject)
  const expandAll = useStore((s) => s.expandAll)
  const collapseAll = useStore((s) => s.collapseAll)
  const importData = useStore((s) => s.importData)
  const showGuide = useStore((s) => s.showGuide)
  const fileRef = useRef<HTMLInputElement>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const projectProgress = (pid: string) => {
    const leaves = tasks.filter((t) => t.projectId === pid && !tasks.some((x) => x.parentId === t.id))
    return averageProgress(leaves, logs)
  }

  const handleExport = () => {
    const blob = new Blob([exportJson({ projects, tasks, logs })], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wbs-gantt-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (file: File) => {
    file.text().then((text) => {
      try {
        importData(parseImport(text))
      } catch (e) {
        notice(t('sidebar.importFailed', { message: (e as Error).message }))
      }
    })
  }

  return (
    <>
    <aside className="w-[190px] shrink-0 bg-panel border-r border-border flex flex-col">
      {/* Brand */}
      <div className="h-12 flex items-center gap-2 px-4 border-b border-border">
        <div className="w-5 h-5 rounded-[3px] bg-accent/20 border border-accent/50 grid place-items-center">
          <div className="w-2 h-2 bg-accent" />
        </div>
        <div className="text-[12px] font-semibold tracking-[0.18em] text-fg">WBS·GANTT</div>
      </div>

      {/* Nav */}
      <nav className="py-2">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-2.5 px-4 h-9 text-[12px] transition-colors border-l-2 ${
                active
                  ? 'bg-panel2 text-fg border-accent'
                  : 'text-muted hover:text-fg hover:bg-panel2/50 border-transparent'
              }`}
            >
              <Icon size={15} className={active ? 'text-accent' : ''} />
              {t(item.labelKey)}
            </button>
          )
        })}
      </nav>

      <div className="mx-4 my-2 border-t border-line" />

      {/* Projects */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        <div className="flex items-center justify-between px-2 h-8">
          <div className="text-[10px] uppercase tracking-wider text-dim">{t('sidebar.projects')}</div>
          <div className="flex items-center gap-0.5">
            <button onClick={expandAll} title={t('sidebar.expandAll')} className="p-1 text-dim hover:text-fg"><Plus size={12} /></button>
            <button onClick={collapseAll} title={t('sidebar.collapseAll')} className="p-1 text-dim hover:text-fg"><Minus size={12} /></button>
          </div>
        </div>
        <button
          onClick={() => { setSelectedProject(null); setProjectFilter('all'); setActiveView('gantt') }}
          className={`w-full flex items-center gap-2 px-2 h-8 rounded-[3px] text-[12px] ${
            projectFilter === 'all' ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
          }`}
        >
          <span className="w-2 h-2 rounded-full border border-muted" />
          <span className="flex-1 text-left">{t('sidebar.allProjects')}</span>
          <span className="text-[10px] text-dim">{tasks.length}</span>
        </button>
        {projects.map((p) => {
          const pct = projectProgress(p.id)
          return (
            <div
              key={p.id}
              onClick={() => { setSelected(null); setSelectedProject(p.id); setProjectFilter(p.id); setActiveView('gantt') }}
              className={`group w-full flex items-center gap-2 px-2 h-8 rounded-[3px] text-[12px] cursor-pointer ${
                projectFilter === p.id ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="flex-1 text-left truncate">{p.name}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-6 h-1 rounded-full bg-panel2 overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                </span>
                <span className="text-[10px] font-mono text-muted w-7 text-right">{pct}%</span>
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingProject(p) }}
                className="shrink-0 p-0.5 text-dim hover:text-fg opacity-0 group-hover:opacity-100 transition-opacity"
                title={t('sidebar.editProject')}
              >
                <Pencil size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Data */}
      <div className="border-t border-border p-2 flex gap-1">
        <button
          onClick={handleExport}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 text-[11px] text-muted hover:text-fg hover:bg-panel2 rounded-[3px]"
          title={t('sidebar.exportTitle')}
        >
          <Download size={13} /> {t('sidebar.export')}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 text-[11px] text-muted hover:text-fg hover:bg-panel2 rounded-[3px]"
          title={t('sidebar.importTitle')}
        >
          <Upload size={13} /> {t('sidebar.import')}
        </button>
        {/* The way back to the getting-started card, which is otherwise only
            dismissible. Sits with Export/Import because it is the same kind of
            thing: a control over the whole board rather than over one project. */}
        <button
          onClick={showGuide}
          className="shrink-0 flex items-center justify-center w-8 h-8 text-dim hover:text-fg hover:bg-panel2 rounded-[3px]"
          title={t('guide.title')}
          aria-label={t('guide.title')}
        >
          <HelpCircle size={13} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleImport(f)
            e.target.value = ''
          }}
        />
      </div>

      {editingProject && <ProjectDialog project={editingProject} onClose={() => setEditingProject(null)} />}
    </aside>
    {dialogs}
    </>
  )
}

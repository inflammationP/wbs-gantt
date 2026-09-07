import { useRef } from 'react'
import {
  BarChart2, BarChart3, Calendar, Download, Folder, LayoutDashboard, ListTodo, Minus, Plus, Upload,
} from 'lucide-react'
import { AppView } from '../types'
import { useStore } from '../store/useStore'
import { exportJson, parseImport } from '../store/storage'
import { todayISO } from '../lib/dates'

const NAV: { id: AppView; label: string; icon: typeof BarChart2 }[] = [
  { id: 'gantt', label: 'Gantt', icon: BarChart2 },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'projects', label: 'Projects', icon: Folder },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
]

export function Sidebar() {
  const activeView = useStore((s) => s.activeView)
  const setActiveView = useStore((s) => s.setActiveView)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const projectFilter = useStore((s) => s.projectFilter)
  const setProjectFilter = useStore((s) => s.setProjectFilter)
  const expandAll = useStore((s) => s.expandAll)
  const collapseAll = useStore((s) => s.collapseAll)
  const importData = useStore((s) => s.importData)
  const fileRef = useRef<HTMLInputElement>(null)

  const taskCount = (pid: string) => tasks.filter((t) => t.projectId === pid).length

  const handleExport = () => {
    const blob = new Blob([exportJson({ projects, tasks })], { type: 'application/json' })
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
        alert('Import failed: ' + (e as Error).message)
      }
    })
  }

  return (
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
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="mx-4 my-2 border-t border-line" />

      {/* Projects */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        <div className="flex items-center justify-between px-2 h-8">
          <div className="text-[10px] uppercase tracking-wider text-dim">Projects</div>
          <div className="flex items-center gap-0.5">
            <button onClick={expandAll} title="Expand all" className="p-1 text-dim hover:text-fg"><Plus size={12} /></button>
            <button onClick={collapseAll} title="Collapse all" className="p-1 text-dim hover:text-fg"><Minus size={12} /></button>
          </div>
        </div>
        <button
          onClick={() => { setProjectFilter('all'); setActiveView('gantt') }}
          className={`w-full flex items-center gap-2 px-2 h-8 rounded-[3px] text-[12px] ${
            projectFilter === 'all' ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
          }`}
        >
          <span className="w-2 h-2 rounded-full border border-muted" />
          <span className="flex-1 text-left">All projects</span>
          <span className="text-[10px] text-dim">{tasks.length}</span>
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => { setProjectFilter(p.id); setActiveView('gantt') }}
            className={`w-full flex items-center gap-2 px-2 h-8 rounded-[3px] text-[12px] ${
              projectFilter === p.id ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="flex-1 text-left truncate">{p.name}</span>
            <span className="text-[10px] text-dim">{taskCount(p.id)}</span>
          </button>
        ))}
      </div>

      {/* Data */}
      <div className="border-t border-border p-2 flex gap-1">
        <button
          onClick={handleExport}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 text-[11px] text-muted hover:text-fg hover:bg-panel2 rounded-[3px]"
          title="Export JSON"
        >
          <Download size={13} /> Export
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 text-[11px] text-muted hover:text-fg hover:bg-panel2 rounded-[3px]"
          title="Import JSON"
        >
          <Upload size={13} /> Import
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
    </aside>
  )
}

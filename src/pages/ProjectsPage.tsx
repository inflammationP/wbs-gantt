import { useState } from 'react'
import { useStore } from '../store/useStore'
import { PROJECT_COLORS } from '../lib/ui'
import { effectiveStates } from '../lib/tree'
import { Plus, Trash2, Pencil } from 'lucide-react'

export function ProjectsPage() {
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const addProject = useStore((s) => s.addProject)
  const updateProject = useStore((s) => s.updateProject)
  const deleteProject = useStore((s) => s.deleteProject)
  const setProjectFilter = useStore((s) => s.setProjectFilter)
  const setActiveView = useStore((s) => s.setActiveView)
  const [editing, setEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  const statsFor = (pid: string) => {
    const ptasks = tasks.filter((t) => t.projectId === pid)
    const leaves = ptasks.filter((t) => !tasks.some((x) => x.parentId === t.id))
    const eff = effectiveStates(ptasks)
    const pct = leaves.length ? Math.round(leaves.reduce((s, t) => s + (eff.get(t.id)?.progress ?? 0), 0) / leaves.length) : 0
    const done = leaves.filter((t) => t.status === 'completed').length
    return { total: ptasks.length, leaves: leaves.length, pct, done }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[18px] font-semibold">Projects</h1>
          <button
            onClick={() => {
              const name = prompt('Project name')
              if (name?.trim()) addProject(name.trim(), PROJECT_COLORS[projects.length % PROJECT_COLORS.length])
            }}
            className="h-8 px-3 inline-flex items-center gap-1.5 text-[12px] font-medium bg-accent text-black rounded-[3px]"
          >
            <Plus size={14} /> New project
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {projects.map((p) => {
            const s = statsFor(p.id)
            return (
              <div key={p.id} className="bg-panel border border-border rounded-[3px] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                  {editing === p.id ? (
                    <input
                      className="flex-1 h-7 px-2 bg-panel2 border border-border rounded-[3px] text-[13px]"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') { updateProject(p.id, { name: newName.trim() || p.name }); setEditing(null) } }}
                      onBlur={() => { updateProject(p.id, { name: newName.trim() || p.name }); setEditing(null) }}
                    />
                  ) : (
                    <span className="flex-1 text-[14px] font-semibold">{p.name}</span>
                  )}
                  <button onClick={() => { setEditing(p.id); setNewName(p.name) }} className="p-1 text-dim hover:text-fg"><Pencil size={13} /></button>
                  <button onClick={() => { if (confirm(`Delete project "${p.name}" and all its tasks?`)) deleteProject(p.id) }} className="p-1 text-dim hover:text-[#f85149]"><Trash2 size={13} /></button>
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-2 bg-panel2 rounded-full overflow-hidden"><div className="h-full" style={{ width: `${s.pct}%`, background: p.color }} /></div>
                  <span className="font-mono text-[12px] text-fg">{s.pct}%</span>
                </div>
                <div className="flex gap-4 text-[11px] text-muted">
                  <span>{s.total} tasks</span>
                  <span>{s.done} completed</span>
                  <span>{s.leaves - s.done} open</span>
                </div>
                <button onClick={() => { setProjectFilter(p.id); setActiveView('gantt') }} className="mt-3 text-[11px] text-accent hover:text-fg">Open in Gantt →</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

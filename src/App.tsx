import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { GanttPage } from './pages/GanttPage'
import { DashboardPage } from './pages/DashboardPage'
import { TasksPage } from './pages/TasksPage'
import { CalendarPage } from './pages/CalendarPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { StatisticsPage } from './pages/StatisticsPage'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { ProjectDetailPanel } from './components/ProjectDetailPanel'
import { useStore } from './store/useStore'

export default function App() {
  const view = useStore((s) => s.activeView)
  const selectedTaskId = useStore((s) => s.selectedTaskId)
  const selectedExists = useStore((s) => s.tasks.some((t) => t.id === s.selectedTaskId))
  const selectedProject = useStore((s) => s.projects.find((p) => p.id === s.selectedProjectId))
  const tasks = useStore((s) => s.tasks)
  const syncParentEnds = useStore((s) => s.syncParentEnds)

  // Keep each phase parent's end date synced to its latest child's end date.
  useEffect(() => {
    syncParentEnds()
  }, [tasks, syncParentEnds])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {view === 'gantt' && <GanttPage />}
        {view === 'dashboard' && <DashboardPage />}
        {view === 'tasks' && <TasksPage />}
        {view === 'calendar' && <CalendarPage />}
        {view === 'projects' && <ProjectsPage />}
        {view === 'statistics' && <StatisticsPage />}
      </main>
      {selectedProject
        ? <ProjectDetailPanel projectId={selectedProject.id} />
        : (selectedExists && selectedTaskId ? <TaskDetailPanel taskId={selectedTaskId} /> : null)}
    </div>
  )
}

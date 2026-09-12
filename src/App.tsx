import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { GanttPage } from './pages/GanttPage'
import { CalendarPage } from './pages/CalendarPage'
import { LogsPage } from './pages/LogsPage'
import { ManagePage } from './pages/ManagePage'
import { SettingsPage } from './pages/SettingsPage'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { ProjectDetailPanel } from './components/ProjectDetailPanel'
import { DayDetailPanel } from './components/DayDetailPanel'
import { GettingStarted } from './components/GettingStarted'
import { useStore } from './store/useStore'

export default function App() {
  const view = useStore((s) => s.activeView)
  const selectedDay = useStore((s) => s.selectedDay)
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
      {/* `relative` is what the getting-started card positions against. It has to
          sit inside `main` rather than fixed to the viewport: the detail panels
          below are in-flow siblings that already occupy the window's right edge,
          so a viewport-anchored card would land on top of the panel the guide
          just told the user to open. Anchored here, it stops where they begin. */}
      <main className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
        {view === 'gantt' && <GanttPage />}
        {view === 'logs' && <LogsPage />}
        {view === 'manage' && <ManagePage />}
        {view === 'calendar' && <CalendarPage />}
        {view === 'settings' && <SettingsPage />}
        <GettingStarted />
      </main>
      {/* Sits left of the task panel, so opening a task from a day keeps the
          day's list on screen. Opened from the timeline header in the Gantt and
          from a day cell in the Calendar. */}
      {(view === 'gantt' || view === 'calendar') && selectedDay && <DayDetailPanel day={selectedDay} />}
      {selectedProject
        ? <ProjectDetailPanel projectId={selectedProject.id} />
        : (selectedExists && selectedTaskId ? <TaskDetailPanel taskId={selectedTaskId} /> : null)}
    </div>
  )
}

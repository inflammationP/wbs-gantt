import { useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { GanttPage } from './pages/GanttPage'
import { TodayPage } from './pages/TodayPage'
import { CalendarPage } from './pages/CalendarPage'
import { LogsPage } from './pages/LogsPage'
import { ManagePage } from './pages/ManagePage'
import { SettingsPage } from './pages/SettingsPage'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import { ProjectDetailPanel } from './components/ProjectDetailPanel'
import { DayDetailPanel } from './components/DayDetailPanel'
import { GettingStarted } from './components/GettingStarted'
import { UpdateOverlays } from './components/UpdateOverlays'
import { useStore } from './store/useStore'
import { useT } from './lib/useT'
import { setTrayLabels } from './lib/notify'

export default function App() {
  const t = useT()
  const view = useStore((s) => s.activeView)
  // Re-keyed on every click of the nav's Gantt item, so the page remounts (and
  // scrolls back to today) instead of resuming where it was left.
  const ganttKey = useStore((s) => s.ganttKey)
  const selectedDay = useStore((s) => s.selectedDay)
  const selectedTaskId = useStore((s) => s.selectedTaskId)
  const selectedExists = useStore((s) => s.tasks.some((t) => t.id === s.selectedTaskId))
  const selectedProject = useStore((s) => s.projects.find((p) => p.id === s.selectedProjectId))
  const tasks = useStore((s) => s.tasks)
  const syncParentDates = useStore((s) => s.syncParentDates)
  const runUpdateCheck = useStore((s) => s.runUpdateCheck)

  // Keep each phase parent's dates on the span of its children. Both ends: a
  // parent is a container, so its window is where its contents are.
  useEffect(() => {
    syncParentDates()
  }, [tasks, syncParentDates])

  // The update check the app fires on the user's behalf at startup — the same
  // call the Settings button makes, with nothing to tell them apart. In
  // development StrictMode mounts twice; the `checking` guard inside the action
  // makes the second call a no-op rather than a second request. It lives here
  // rather than in `main.tsx` so that the entry point stays pure bootstrap.
  useEffect(() => {
    void runUpdateCheck()
  }, [runUpdateCheck])

  // The tray menu is built in Rust, where the dictionaries are not — so its two
  // labels are pushed down from here, and re-pushed when the language changes.
  // Without this the menu would be the one part of the app that stayed English.
  useEffect(() => {
    void setTrayLabels(t('tray.open'), t('tray.quit'))
  }, [t])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-fg">
      <Sidebar />
      {/* `relative` is what the getting-started card positions against. It has to
          sit inside `main` rather than fixed to the viewport: the detail panels
          below are in-flow siblings that already occupy the window's right edge,
          so a viewport-anchored card would land on top of the panel the guide
          just told the user to open. Anchored here, it stops where they begin. */}
      <main className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
        {view === 'gantt' && <GanttPage key={ganttKey} />}
        {view === 'today' && <TodayPage />}
        {view === 'logs' && <LogsPage />}
        {view === 'manage' && <ManagePage />}
        {view === 'calendar' && <CalendarPage />}
        {view === 'settings' && <SettingsPage />}
        <GettingStarted />
        <UpdateOverlays />
      </main>
      {/* Sits left of the task panel, so opening a task from a day keeps the
          day's list on screen. Opened from the timeline header in the Gantt and
          from a day cell in the Calendar.

          The wrapper takes them out of the shell's flex row — they float over
          the board's right edge rather than narrowing it (see `index.css`).
          Panels are things you look into and close; a board that re-flows every
          time one opens is a board that never holds still. */}
      <div className="side-panels">
        {(view === 'gantt' || view === 'calendar') && selectedDay && <DayDetailPanel day={selectedDay} />}
        {selectedProject
          ? <ProjectDetailPanel projectId={selectedProject.id} />
          : (selectedExists && selectedTaskId ? <TaskDetailPanel taskId={selectedTaskId} /> : null)}
      </div>
    </div>
  )
}

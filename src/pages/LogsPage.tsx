import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from '../store/useStore'
import { buildChildrenMap } from '../lib/tree'
import { groupLogsByDate, parseLogContent } from '../lib/logs'
import { withNotes } from '../lib/notes'
import { itemLogSubject, withItemLogs } from '../lib/itemLogs'
import { toDate } from '../lib/dates'
import { monthAbbr, weekdayName } from '../lib/i18n'
import { useLang, useT } from '../lib/useT'
import { Segmented } from '../components/ui'
import { LogDialog } from '../components/LogDialog'
import { DayLogsModal } from '../components/DayLogsModal'
import { NoteDialog } from '../components/NoteDialog'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Task, TaskLog } from '../types'

type Filter = { kind: 'all' } | { kind: 'project'; id: string } | { kind: 'task'; id: string }
type Mode = 'logs' | 'notes'

export function LogsPage() {
  const t = useT()
  const lang = useLang()
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const logs = useStore((s) => s.logs)
  const notes = useStore((s) => s.notes)
  const itemLogs = useStore((s) => s.itemLogs)
  // Read here only for the names the day cards draw their entries under — see
  // `itemLogSubject`.
  const habits = useStore((s) => s.habits)
  const chores = useStore((s) => s.chores)
  const today = useStore((s) => s.today)

  // Which of the two the page is showing. Not persisted: the nav entry is one
  // entry, so re-entering it should land where it always lands — on the logs.
  const [mode, setMode] = useState<Mode>('logs')
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [fixLog, setFixLog] = useState<TaskLog | null>(null)
  // Any day can be opened, not only one the grid has a card for.
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  // The day the "write something" box is composing for, or null when it is
  // shut. A separate thing from `selectedDay`: this adds a paragraph to a day
  // without opening the day, which is the whole point of having it.
  const [compose, setCompose] = useState<string | null>(null)

  const children = useMemo(() => buildChildrenMap(tasks), [tasks])

  const visibleTaskIds = useMemo(() => {
    if (filter.kind === 'all') return null
    if (filter.kind === 'project') return new Set(tasks.filter((task) => task.projectId === filter.id).map((task) => task.id))
    const ids = new Set<string>([filter.id])
    const walk = (pid: string) => {
      for (const c of children.get(pid) ?? []) {
        ids.add(c.id)
        walk(c.id)
      }
    }
    walk(filter.id)
    return ids
  }, [filter, tasks, children])

  // The union of both kinds, so a day that has a note and no log still gets a
  // card — which is the whole of "manage notes in the logs page". The mode then
  // picks which half is drawn and which days appear at all.
  //
  // The project filter is dropped in notes mode rather than applied to the log
  // half. It would thin the logs of a day the notes are still shown for, and the
  // one thing reading both halves is the "this day has both" edge — so a filter
  // with no visible control and no effect on what is listed would still be
  // deciding whether that edge is drawn. The filter is kept, not cleared, so
  // switching back lands where the user left.
  // The entries about routines and chores join the union unfiltered, as the
  // notes do: a routine belongs to no project, so a project filter has nothing
  // to say about one, and quietly dropping them would mean a day card that
  // changes its contents for a filter with no bearing on them.
  const days = useMemo(() => {
    const ls = mode === 'logs' && visibleTaskIds ? logs.filter((l) => visibleTaskIds.has(l.taskId)) : logs
    return withItemLogs(withNotes(groupLogsByDate(ls), notes), itemLogs)
  }, [logs, notes, itemLogs, visibleTaskIds, mode])

  // A day is a day in logs mode when it has any entry at all — a task's log or
  // one about a routine. The card is where a day's writing is found, and the
  // kind of thing written is what the card is for reading.
  const visible = useMemo(
    () =>
      mode === 'logs'
        ? days.filter((d) => d.logs.length > 0 || d.itemLogs.length > 0)
        : days.filter((d) => d.note != null),
    [days, mode],
  )

  // A day the grid has no card for still opens — an empty one, which is exactly
  // what writing on a day for the first time needs.
  const selected = useMemo(
    () =>
      selectedDay
        ? days.find((d) => d.date === selectedDay) ?? { date: selectedDay, logs: [], note: null, itemLogs: [] }
        : null,
    [days, selectedDay],
  )

  const renderTask = (task: Task, depth: number): ReactNode => {
    const active = filter.kind === 'task' && filter.id === task.id
    const kids = children.get(task.id) ?? []
    const isCollapsed = collapsed[task.id] === true
    return (
      <div key={task.id}>
        <div className="flex items-center" style={{ paddingLeft: 8 + depth * 14 }}>
          <button
            onClick={() => { if (kids.length) setCollapsed((c) => ({ ...c, [task.id]: !isCollapsed })) }}
            className="w-4 shrink-0 flex items-center justify-center text-dim hover:text-fg"
            title={kids.length ? (isCollapsed ? t('common.expand') : t('common.collapse')) : undefined}
          >
            {kids.length ? (isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />) : null}
          </button>
          <button
            onClick={() => setFilter({ kind: 'task', id: task.id })}
            className={`flex-1 min-w-0 flex items-center h-7 rounded-[3px] text-[12px] text-left pr-2 ${
              active ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
            }`}
          >
            <span className="truncate">{task.name}</span>
          </button>
        </div>
        {!isCollapsed && kids.map((c) => renderTask(c, depth + 1))}
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* filter tree — logs only. A note belongs to no project, so this tree
          would answer nothing while sitting there looking clickable. */}
      {mode === 'logs' && (
        <aside className="w-60 shrink-0 border-r border-border overflow-auto py-3 px-2">
          <button
            onClick={() => setFilter({ kind: 'all' })}
            className={`w-full px-2 h-8 rounded-[3px] text-[12px] text-left mb-1 ${
              filter.kind === 'all' ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
            }`}
          >
            {t('logs.all')}
          </button>
          {projects.map((p) => (
            <div key={p.id} className="mb-1">
              <button
                onClick={() => setFilter({ kind: 'project', id: p.id })}
                className={`w-full flex items-center gap-2 px-2 h-8 rounded-[3px] text-[12px] text-left ${
                  filter.kind === 'project' && filter.id === p.id ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg hover:bg-panel2/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <span className="flex-1 truncate">{p.name}</span>
              </button>
              {tasks.filter((task) => task.projectId === p.id && task.parentId === null).map((task) => renderTask(task, 0))}
            </div>
          ))}
        </aside>
      )}

      {/* sticky-note grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-[18px] font-semibold">{t('nav.logs')}</h1>
          <div className="flex items-center gap-2">
            {/* Adds to a day rather than opening one. It is the only way in on
                a day the grid has no card for — and "today I want to jot
                something down" is exactly that day, since a card only exists
                once something has been written. */}
            {mode === 'notes' && (
              <button
                onClick={() => setCompose(today)}
                className="flex items-center gap-1 h-7 px-2 text-[11px] text-muted hover:text-fg border border-border rounded-[3px]"
              >
                <Plus size={12} /> {t('notes.add')}
              </button>
            )}
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'logs', label: t('logs.tabLogs') },
                { value: 'notes', label: t('notes.title') },
              ]}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="text-[13px] text-dim">{mode === 'logs' ? t('logs.empty') : t('notes.empty')}</div>
        ) : (
          // Keyed on the mode so the swap remounts the grid and replays the
          // animation — a transition cannot express "the contents were replaced".
          <div key={mode} className="swap-in grid items-start gap-x-4 gap-y-6 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]" style={{ maxWidth: 1120 }}>
            {visible.map(({ date, logs: dayLogs, note, itemLogs: dayItemLogs }) => {
              const d = toDate(date)
              // Group by task; show only parent (depth-0) items in the thumbnail
              // so sub-items don't blur the hierarchy, and each task gets its own
              // dot + name so tasks stay distinguishable.
              const byTask = new Map<string, TaskLog[]>()
              for (const l of dayLogs) {
                if (!byTask.has(l.taskId)) byTask.set(l.taskId, [])
                byTask.get(l.taskId)!.push(l)
              }
              const lines = (content: string) =>
                parseLogContent(content)
                  // A divider is punctuation, not a line of the entry: letting
                  // one through would spend a preview slot saying nothing.
                  .filter((it) => it.kind === 'item' && it.depth === 0)
                  .slice(0, 2)
              const taskEntries = [...byTask.entries()]
              const taskPreview = taskEntries.slice(0, 2).map(([taskId, tlogs]) => {
                const task = tasks.find((x) => x.id === taskId)
                const p = task ? projects.find((x) => x.id === task.projectId) : null
                return {
                  key: taskId,
                  name: task?.name ?? t('common.unknownTask'),
                  color: p?.color,
                  tag: undefined,
                  items: tlogs.flatMap((l) => lines(l.content)),
                }
              })
              // The day's entries about routines and chores, in the same shape
              // and in the same list — a name with its lines under it. No colour:
              // the dot beside a task is what claims a project, and neither of
              // these belongs to one. A word stands where the dot would, because
              // a bare name in this list says nothing about which of the three
              // sources the entry came from.
              const itemPreview = dayItemLogs.slice(0, 2).flatMap((l) => {
                const name = itemLogSubject(l, habits, chores)
                return name == null
                  ? []
                  : [
                      {
                        key: `${l.kind}:${l.ownerId}`,
                        name,
                        color: undefined,
                        tag: t(l.kind === 'habit' ? 'habit.section' : 'chore.section'),
                        items: lines(l.content),
                      },
                    ]
              })
              const preview = [...taskPreview, ...itemPreview]
              const moreTasks = taskEntries.length - taskPreview.length
              // "This day has both kinds" — the one thing neither mode's own
              // contents can say, since a mode only ever draws its own half. An
              // entry about a routine is one of the logs for this purpose: it is
              // drawn in the same mode and is hidden by the same switch to notes.
              const hasEntries = dayLogs.length > 0 || dayItemLogs.length > 0
              const hasBoth = hasEntries && note != null
              // Composed here rather than through `logs.dayFooter`, which was a
              // fixed two-part template and would have printed "0 logs · 0 tasks"
              // on a day that is a note and nothing else.
              //
              // One "logs" figure for both kinds: what the line is counting is
              // how much was written on the day, and to the reader a line about a
              // routine is a log like any other. The tasks figure beside it stays
              // what it always was — how many tasks the day's logs are about.
              const footer = [
                hasEntries ? t('common.logCount', { count: dayLogs.length + dayItemLogs.length }) : null,
                taskEntries.length ? t('common.taskCount', { count: taskEntries.length }) : null,
                note ? t('common.noteCount', { count: 1 }) : null,
              ].filter(Boolean).join(' · ')
              return (
                <div key={date} className="relative">
                  {/* The other day's card, lying under this one and askew. A
                      sliver peeking out square-on read as a drop shadow; turned
                      a few degrees and pushed off-centre it reads as a second
                      card, which is what it is saying.

                      Decorative only. It repeats what the footer already says in
                      words, so a reader who cannot see it is not told less, and
                      the row gap is wider to give the hanging corner somewhere
                      to go rather than over the card below. */}
                  {hasBoth && (
                    <div
                      aria-hidden
                      className="absolute inset-0 rounded-2xl bg-panel2 border border-border"
                      style={{ transform: 'rotate(3deg) translate(4px, 5px)' }}
                    />
                  )}
                  <button
                    onClick={() => setSelectedDay(date)}
                    className="relative w-full flex flex-col overflow-hidden rounded-2xl p-3.5 text-left bg-panel2 border border-border shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-accent/60 min-h-[230px]"
                  >
                    <div className="flex items-baseline gap-2 mb-2.5 pr-2">
                      <span className="text-[26px] font-bold leading-none text-fg">{d.getDate()}</span>
                      <div className="leading-tight">
                        <div className="text-[11px] font-semibold text-muted">{weekdayName(lang, d.getDay())}</div>
                        <div className="text-[11px] text-dim">{monthAbbr(lang, d.getMonth())} {d.getFullYear()}</div>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 pr-1">
                      {mode === 'logs'
                        ? preview.map((tp) => (
                            <div key={tp.key}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {/* The dot says "this log belongs to a task",
                                    and the project colour says which. The word
                                    says which of the other two sources, there
                                    being no colour to spend on either — one
                                    colour, one meaning. */}
                                {tp.color ? (
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tp.color }} />
                                ) : (
                                  <span className="text-[10px] text-dim shrink-0">{tp.tag}</span>
                                )}
                                <span className="text-[11px] font-medium text-fg truncate">{tp.name}</span>
                              </div>
                              <div className="space-y-0.5 pl-1">
                                {tp.items.map((it, i) => (
                                  <div key={i} className="flex items-start gap-1.5 text-[12px] leading-snug">
                                    <span className="text-dim shrink-0">·</span>
                                    {/* Wrapped, not clipped. An item is the
                                        thing the card is made of, and half of
                                        one says less than the rest of it —
                                        `break-words` because a pasted URL is
                                        one word and would push the card open. */}
                                    <span className="min-w-0 break-words text-muted">{it.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        : (
                            // No dot, no bullet, no project colour: a note is
                            // prose, and the dot beside a log is what claims it
                            // belongs to a task. The left rule is the whole mark.
                            <div className="border-l border-line pl-2">
                              <div className="text-[12px] leading-snug text-muted line-clamp-3 whitespace-pre-wrap break-words">
                                {note?.body}
                              </div>
                            </div>
                          )}
                      {mode === 'logs' && moreTasks > 0 && (
                        <div className="text-[11px] text-dim">{t('logs.moreTasks', { count: moreTasks })}</div>
                      )}
                    </div>
                    <div className="text-[11px] mt-2 text-dim">{footer}</div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* The day detail, **of the half that is on screen**. The panel can hold
          three kinds of entry and the page shows one at a time, so opening a day
          from here hands over that one: in logs mode the entries — the tasks'
          and the routines' alike — and no notebook; in notes mode the notebook
          and nothing else. The day panel on the Gantt side still gets all three,
          because that panel is the day rather than one of its halves. */}
      {selected && (
        <DayLogsModal
          date={selected.date}
          logs={mode === 'logs' ? selected.logs : []}
          tasks={tasks}
          projects={projects}
          onClose={() => setSelectedDay(null)}
          onEdit={mode === 'logs' ? (log) => setFixLog(log) : undefined}
          notes={mode === 'notes' ? { note: selected.note } : undefined}
          itemLogs={mode === 'logs' ? selected.itemLogs : []}
        />
      )}

      {fixLog && <LogDialog taskId={fixLog.taskId} existing={fixLog} onClose={() => setFixLog(null)} />}
      {compose && <NoteDialog date={compose} onClose={() => setCompose(null)} />}
    </div>
  )
}

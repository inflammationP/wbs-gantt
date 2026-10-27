import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Flag } from 'lucide-react'
import { useStore } from '../store/useStore'
import {
  blockMinutes,
  blocksOn,
  dayLoad,
  minutesOf,
  packBlocks,
  planOn,
  toHHMM,
} from '../lib/schedule'
import { isWeekend, toDate, toISO } from '../lib/dates'
import { formatShortDate, weekdayName } from '../lib/i18n'
import { sig } from '../lib/ui'
import { useLang } from '../lib/useT'
import { LoadMeter } from './LoadMeter'
import { ScheduleBlockDialog, ScheduleDraft } from './ScheduleBlockDialog'

const GUTTER = 46

/**
 * A vertical 24-hour grid, for one day or for a week.
 *
 * The two views are the same drawing with a different column count — building
 * a second one for the week would be two answers to where a block sits and how
 * a load reads. A single day gets more room per hour; the week fits seven.
 *
 * Interaction is click-to-create and click-to-edit. There is no drag: a
 * timetable that can be read and written is the feature; moving a block is a
 * later one (see the roadmap on the desktop).
 */
export function Timetable({ days, className = '' }: { days: string[]; className?: string }) {
  const lang = useLang()
  const today = useStore((s) => s.today)
  const blocks = useStore((s) => s.scheduleBlocks)
  const plans = useStore((s) => s.dayPlans)
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const setDayCapacity = useStore((s) => s.setDayCapacity)

  const [draft, setDraft] = useState<ScheduleDraft | null>(null)
  const [now, setNow] = useState(() => new Date())
  /** The half-hour slot under the pointer, for the hover band. */
  const [hover, setHover] = useState<{ date: string; minutes: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const single = days.length === 1
  // The single-day view is a calendar, not a strip: 44px an hour, scrolled to
  // 7:00, so the working day fills the pane and the night hours are a scroll
  // away. The week is a macro read, so it keeps a smaller scale and the whole
  // day in view.
  const hourH = single ? 44 : 32
  const bodyH = 24 * hourH
  const template = `${GUTTER}px repeat(${days.length}, minmax(${single ? 0 : 96}px, 1fr))`

  useEffect(() => {
    if (!scrollRef.current) return
    // The day opens on the working morning; the week is a whole-day picture.
    scrollRef.current.scrollTop = single ? 7 * hourH : 0
  }, [hourH, single])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  /** The half-hour boundary under the pointer, from the column's own geometry. */
  const slotAt = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientY - rect.top) / rect.height
    return Math.max(0, Math.min(23 * 60 + 30, Math.floor((ratio * 1440) / 30) * 30))
  }

  const createAt = (day: string, e: MouseEvent<HTMLDivElement>) => {
    setDraft({ kind: 'new', date: day, start: toHHMM(slotAt(e)) })
  }

  const hoverAt = (day: string, e: MouseEvent<HTMLDivElement>) => {
    const minutes = slotAt(e)
    setHover((h) => (h?.date === day && h.minutes === minutes ? h : { date: day, minutes }))
  }

  const nowIso = toISO(now)
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * hourH
  const hoveredHour = hover ? Math.floor(hover.minutes / 60) : -1
  const line = 'rgb(var(--c-line) / 0.55)'
  const half = 'rgb(var(--c-line) / 0.22)'
  const hourLines = {
    backgroundImage: [
      `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourH - 1}px, ${line} ${hourH - 1}px, ${line} ${hourH}px)`,
      ...(single
        ? [
            `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourH / 2 - 1}px, ${half} ${hourH / 2 - 1}px, ${half} ${hourH / 2}px)`,
          ]
        : []),
    ].join(', '),
  }

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div style={{ minWidth: single ? undefined : GUTTER + days.length * 96 }}>
          {/* Header. Inside the scroll box so it travels with the columns
              horizontally, and sticky so the dates stay put vertically. */}
          <div
            className="sticky top-0 z-20 grid bg-panel/95 backdrop-blur-sm border-b border-border/70"
            style={{ gridTemplateColumns: template }}
          >
            <div className="sticky left-0 z-30 bg-panel" />
            {days.map((day) => {
              const plan = planOn(plans, day)
              const load = dayLoad(plan, blocks, day)
              const weekend = isWeekend(toDate(day))
              const isToday = day === today
              return (
                <div
                  key={day}
                  className={`px-2 pt-2 pb-1.5 border-l border-line/70 transition-shadow ${
                    isToday ? 'bg-accent/[0.045]' : weekend ? 'bg-stripe/20' : ''
                  } ${hover?.date === day ? 'ring-1 ring-inset ring-accent/25' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-1 text-[10px]">
                    <span className={`truncate font-medium ${isToday ? 'text-today' : 'text-muted'}`}>
                      {weekdayName(lang, toDate(day).getDay())}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] text-dim">{formatShortDate(lang, toDate(day))}</span>
                  </div>
                  <LoadMeter
                    className="mt-1.5"
                    used={load.used}
                    capacity={load.capacity}
                    onCapacity={(hours) => setDayCapacity(day, hours)}
                    compact={!single}
                  />
                </div>
              )
            })}
          </div>

          {/* Body. */}
          <div className="grid" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-20 bg-panel relative" style={{ height: bodyH }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className={`absolute right-1.5 font-mono transition-colors ${
                    h === hoveredHour ? 'text-fg' : 'text-dim/80'
                  } ${single ? 'text-[10px]' : 'text-[9px]'}`}
                  style={{ top: h === 0 ? 0 : h * hourH - 6 }}
                >
                  {toHHMM(h * 60)}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayBlocks = blocksOn(blocks, day)
              const lanes = packBlocks(dayBlocks)
              const weekend = isWeekend(toDate(day))
              const isToday = day === today
              return (
                <div
                  key={day}
                  onClick={(e) => createAt(day, e)}
                  onMouseMove={(e) => hoverAt(day, e)}
                  onMouseLeave={() => setHover((h) => (h?.date === day ? null : h))}
                  className={`relative border-l border-line/60 cursor-crosshair ${
                    isToday ? 'bg-accent/[0.035]' : weekend ? 'bg-stripe/15' : ''
                  }`}
                  style={{ height: bodyH, ...hourLines }}
                >
                  {/* The half-hour cell under the pointer: where a click would
                      create the block, shown before the click. */}
                  {hover?.date === day && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-1 z-[5] rounded-md border-y border-accent/25 bg-accent/[0.06]"
                      style={{ top: (hover.minutes / 60) * hourH, height: hourH / 2 }}
                    />
                  )}

                  {dayBlocks.map((block) => {
                    const startMin = minutesOf(block.start) ?? 0
                    const top = (startMin / 60) * hourH
                    const task = block.taskId ? tasks.find((x) => x.id === block.taskId) : undefined
                    const project = task ? projects.find((p) => p.id === task.projectId) : undefined
                    const label = task?.name ?? block.title

                    if (block.deadline) {
                      return (
                        <button
                          key={block.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDraft({ kind: 'edit', block })
                          }}
                          className="group absolute inset-x-0 z-20 h-[16px] flex items-center gap-1 text-left"
                          style={{ top: Math.max(0, Math.min(bodyH - 16, top - 8)) }}
                          title={`${label} · ${block.start}`}
                        >
                          <span className="h-px flex-1" style={{ background: 'rgb(var(--c-fg) / 0.28)' }} />
                          <span className="inline-flex max-w-[75%] items-center gap-1 rounded-full border border-border/70 bg-panel px-1.5 py-0.5 text-[9px] text-muted shadow-sm transition-colors group-hover:border-accent/40 group-hover:text-fg">
                            <Flag size={8} className="shrink-0" />
                            <span className="truncate">{label}</span>
                          </span>
                        </button>
                      )
                    }

                    const lane = lanes.get(block.id) ?? { lane: 0, lanes: 1 }
                    const width = 100 / lane.lanes
                    const height = Math.max(14, (blockMinutes(block) / 60) * hourH - 1)
                    const tint = project && /^#[0-9a-f]{6}$/i.test(project.color) ? `${project.color}22` : undefined
                    return (
                      <button
                        key={block.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDraft({ kind: 'edit', block })
                        }}
                        className={`absolute z-10 overflow-hidden rounded-lg border border-border/70 text-left px-2 py-1 font-medium leading-tight text-fg/90 shadow-sm transition-shadow hover:shadow-md hover:brightness-110 hover:ring-1 hover:ring-accent/40 ${
                          single ? 'text-[11px]' : 'text-[10px]'
                        } ${project ? 'border-l-[3px]' : 'bg-panel2/80'}`}
                        style={{
                          top,
                          height,
                          left: `calc(${lane.lane * width}% + 1px)`,
                          width: `calc(${width}% - 2px)`,
                          ...(project ? { background: tint, borderLeftColor: project.color } : {}),
                        }}
                        title={`${label} · ${block.start}–${block.end}`}
                      >
                        <div className="truncate">{label}</div>
                        {height >= 28 && (
                          <div className="truncate font-mono text-[9px] font-normal text-dim">
                            {block.start}–{block.end}
                          </div>
                        )}
                      </button>
                    )
                  })}

                  {isToday && nowIso === today && (
                    <div
                      className="absolute inset-x-0 z-20 pointer-events-none"
                      style={{ top: nowTop }}
                      aria-hidden
                    >
                      <div className="h-px" style={{ background: sig('in-progress') }} />
                      <div
                        className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                        style={{ background: sig('in-progress') }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {draft && <ScheduleBlockDialog draft={draft} onClose={() => setDraft(null)} />}
    </div>
  )
}

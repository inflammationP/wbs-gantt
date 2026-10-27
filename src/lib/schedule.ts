import { DayPlan, ScheduleBlock } from '../types'

/**
 * Time-of-day arithmetic for the timetable and the day plans that sit beside
 * it. Pure: no React, no store, no clock — `today` is always an argument.
 *
 * Times are `HH:MM` strings, matching the rest of the app (`Chore.time`,
 * `Stamp.at`). Storage is strict here, unlike `parseChoreTime` in chores.ts,
 * which deliberately accepts "9pm" and "下午三点" because it reads typed input.
 * A stored block is machine-written, so anything else is discarded rather than
 * guessed at.
 */

export const DEFAULT_CAPACITY_HOURS = 8
export const MINUTES_PER_DAY = 24 * 60

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export function isHHMM(value: unknown): value is string {
  return typeof value === 'string' && HHMM.test(value)
}

/** Minutes past midnight, or null when the string is not a stored `HH:MM`. */
export function minutesOf(value: string): number | null {
  if (!isHHMM(value)) return null
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function toHHMM(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(minutes)))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

/** How long a block occupies the day. Deadlines are points, so zero. */
export function blockMinutes(block: ScheduleBlock): number {
  if (block.deadline) return 0
  const start = minutesOf(block.start)
  const end = minutesOf(block.end)
  if (start === null || end === null || end <= start) return 0
  return end - start
}

export function blocksOn(blocks: ScheduleBlock[], date: string): ScheduleBlock[] {
  return blocks.filter((b) => b.date === date)
}

/** Scheduled time on a day. Overlapping blocks count twice — that is overload. */
export function dayLoadMinutes(blocks: ScheduleBlock[], date: string): number {
  return blocksOn(blocks, date).reduce((sum, b) => sum + blockMinutes(b), 0)
}

export function planOn(plans: DayPlan[], date: string): DayPlan | undefined {
  return plans.find((p) => p.date === date)
}

/**
 * The day's chosen ids, or undefined for "never planned".
 *
 * Kept separate from `planOn` because every caller wants this one value and the
 * absent/empty distinction is the whole feature. `[]` must stay `[]`.
 */
export function plannedIds(plan: DayPlan | undefined): string[] | undefined {
  return plan?.taskIds
}

export function capacityOf(plan: DayPlan | undefined): number {
  const hours = plan?.capacityHours
  return typeof hours === 'number' && Number.isFinite(hours) && hours >= 0 && hours <= 24
    ? hours
    : DEFAULT_CAPACITY_HOURS
}

export interface DayLoad {
  /** Hours scheduled, deadlines excluded. */
  used: number
  capacity: number
  ratio: number
  over: boolean
}

/**
 * Time spoken for on a day, in hours.
 *
 * Two layers say the same thing at different precision: a plan says how long a
 * task is expected to take, and a timetable block says when it happens. A
 * planned task counts once, as the larger of the two — blocking two hours for a
 * four-hour job has not made the job smaller. Free events and the blocks of
 * tasks the plan leaves out count as scheduled: time already on the clock does
 * not empty again because it is not in the day's list.
 *
 * With no plan this is the sum of every block, exactly as before the plan
 * existed.
 */
export function dayLoad(plan: DayPlan | undefined, blocks: ScheduleBlock[], date: string): DayLoad {
  const ids = plannedIds(plan)
  const byTask = new Map<string, number>()
  let minutes = 0
  for (const block of blocksOn(blocks, date)) {
    const m = blockMinutes(block)
    if (!block.taskId) minutes += m
    else byTask.set(block.taskId, (byTask.get(block.taskId) ?? 0) + m)
  }
  if (ids !== undefined) {
    for (const id of ids) {
      const blocked = byTask.get(id) ?? 0
      byTask.delete(id)
      minutes += Math.max(blocked, (plan?.hours?.[id] ?? 0) * 60)
    }
  }
  for (const m of byTask.values()) minutes += m
  const used = minutes / 60
  const capacity = capacityOf(plan)
  return {
    used,
    capacity,
    ratio: capacity > 0 ? used / capacity : used > 0 ? Number.POSITIVE_INFINITY : 0,
    over: used > capacity,
  }
}

/**
 * Whether the start-of-day prompt is due: the day was never planned, and the
 * user has not already put it off today. `skippedOn` is a date, not a flag, so
 * the same answer holds all day and expires by itself at midnight.
 */
export function promptDue(
  plan: DayPlan | undefined,
  skippedOn: string | null,
  today: string,
): boolean {
  return plannedIds(plan) === undefined && skippedOn !== today
}

/** `3.5` / `8` — no trailing zeros, for a header with very little room. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '0'
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, '')
}

export interface BlockLane {
  lane: number
  lanes: number
}

/**
 * Side-by-side placement for overlapping blocks.
 *
 * Sorted by start and greedily given the first lane whose last block has ended.
 * A cluster ends where the furthest end so far is passed; the cluster's lane
 * count is what every block in it divides its width by, so the column reads as
 * one tidy stack rather than blocks that half-overlap. Deadlines are not in
 * here: they are lines, and they draw across the full column.
 */
export function packBlocks(blocks: ScheduleBlock[]): Map<string, BlockLane> {
  const timed = blocks
    .filter((b) => !b.deadline)
    .map((b) => ({ block: b, start: minutesOf(b.start), end: minutesOf(b.end) }))
    .filter((x): x is { block: ScheduleBlock; start: number; end: number } =>
      x.start !== null && x.end !== null && x.end > x.start,
    )
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const out = new Map<string, BlockLane>()
  let cluster: typeof timed = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    const laneEnds: number[] = []
    const laneOf = new Map<string, number>()
    for (const x of cluster) {
      let lane = laneEnds.findIndex((end) => end <= x.start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(x.end)
      } else {
        laneEnds[lane] = x.end
      }
      laneOf.set(x.block.id, lane)
    }
    for (const x of cluster) out.set(x.block.id, { lane: laneOf.get(x.block.id)!, lanes: laneEnds.length })
    cluster = []
  }

  for (const x of timed) {
    if (cluster.length > 0 && x.start >= clusterEnd) {
      flush()
      clusterEnd = -1
    }
    cluster.push(x)
    clusterEnd = Math.max(clusterEnd, x.end)
  }
  flush()
  return out
}

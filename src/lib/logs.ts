import { TaskLog } from '../types'

export interface LogItem {
  depth: number
  text: string
}

// Parse raw log text into a bullet list: newline = item, leading tabs = nesting.
export function parseLogContent(content: string): LogItem[] {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^(\t*)(.*)$/)
      const depth = (m?.[1] ?? '').length
      const text = (m?.[2] ?? '').trimEnd()
      return { depth, text }
    })
    .filter((it) => it.text.trim() !== '')
}

// Group logs by date (descending).
export function groupLogsByDate(logs: TaskLog[]): { date: string; logs: TaskLog[] }[] {
  const m = new Map<string, TaskLog[]>()
  for (const l of logs) {
    if (!m.has(l.date)) m.set(l.date, [])
    m.get(l.date)!.push(l)
  }
  return [...m.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({ date, logs: list }))
}

// Logs for a given task, newest first.
export function logsForTask(logs: TaskLog[], taskId: string): TaskLog[] {
  return logs.filter((l) => l.taskId === taskId).sort((a, b) => b.date.localeCompare(a.date))
}

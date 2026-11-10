import { TaskPriority, TaskType } from '../../types'
import { AiProposal } from './tools'

export interface ApplyActions {
  addProject: (name: string, color: string, description?: string) => string
  addTask: (input: {
    name: string
    description: string
    projectId: string
    parentId: string | null
    startDate: string | null
    endDate: string | null
    deadline: string | null
    priority: TaskPriority
    type: TaskType
    strictProgress: boolean
    tags: string[]
    isTodo?: boolean
  }) => string
  setDayPlan: (date: string, taskIds: string[] | null, hours?: Record<string, number>) => void
  setDayCapacity: (date: string, hours: number) => void
  withUndo: (label: string, run: () => void) => void
}

export type ApplyResult = { ok: true; summary: string } | { ok: false; message: string }

/**
 * Turn a confirmed proposal into store writes.
 *
 * Task trees go through one outer `withUndo`, so a rejected result is one undo
 * step. A day plan has no undo in this app; the proposal card says so before
 * this function is called.
 */
export function applyProposal(
  proposal: AiProposal,
  actions: ApplyActions,
  undoLabel: string,
): ApplyResult {
  try {
    if (proposal.kind === 'day_plan') {
      if (proposal.capacityHours !== undefined) {
        actions.setDayCapacity(proposal.date, proposal.capacityHours)
      }
      const ids = proposal.mode === 'clear' ? null : proposal.mode === 'rest' ? [] : proposal.taskIds
      actions.setDayPlan(proposal.date, ids, proposal.mode === 'tasks' ? proposal.hours : undefined)
      return { ok: true, summary: proposal.summary }
    }

    let created = 0
    actions.withUndo(undoLabel, () => {
      const projectId =
        proposal.project.kind === 'new'
          ? actions.addProject(proposal.project.name, proposal.project.color)
          : proposal.project.id

      const idOf = new Map<string, string>()
      const pending = [...proposal.tasks]
      let guard = pending.length + 1
      while (pending.length > 0 && guard-- > 0) {
        const ready = pending.filter((task) => !task.parentKey || idOf.has(task.parentKey))
        if (ready.length === 0) throw new Error('The task tree has an unresolved parent.')
        for (const task of ready) {
          const id = actions.addTask({
            name: task.name,
            description: task.description ?? '',
            projectId,
            parentId: task.parentKey ? (idOf.get(task.parentKey) ?? null) : (proposal.parent?.id ?? null),
            startDate: task.startDate,
            endDate: task.endDate,
            deadline: task.deadline,
            priority: task.priority,
            type: task.type,
            strictProgress: task.strictProgress,
            tags: task.tags,
            ...(task.isTodo ? { isTodo: true } : {}),
          })
          idOf.set(task.key, id)
          created++
          pending.splice(pending.indexOf(task), 1)
        }
      }
      if (pending.length > 0) throw new Error('The task tree has an unresolved parent.')
    })
    return { ok: true, summary: `${proposal.summary}（${created} 个任务）` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Applying the proposal failed' }
  }
}

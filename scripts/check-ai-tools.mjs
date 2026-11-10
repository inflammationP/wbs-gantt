/**
 * The check on the assistant's tools and proposal application.
 *
 * The tools are pure over a supplied board; the apply step is exercised with a
 * fake action set, so neither the store nor the network is involved. The cases
 * that matter are the validations: a write is only a proposal, missing dates
 * are sent back to the model, a to-do cannot become a parent, and the day plan
 * distinguishes a rest day from restoring automatic.
 */
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
})
const { executeTool } = await server.ssrLoadModule('/src/lib/ai/tools.ts')
const { buildSystemPrompt } = await server.ssrLoadModule('/src/lib/ai/appGuide.ts')
const { applyProposal } = await server.ssrLoadModule('/src/lib/ai/apply.ts')

const task = (over) => ({
  id: 'a',
  name: 'a',
  description: '',
  parentId: null,
  projectId: 'p1',
  type: 'phase',
  isTodo: false,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  deadline: null,
  strictProgress: true,
  confirmedDays: [],
  paused: false,
  pauseDate: null,
  pauses: [],
  priority: 'medium',
  tags: [],
  dependencies: [],
  createdAt: '',
  updatedAt: '',
  ...over,
})

const projects = [
  { id: 'p1', name: 'Project', color: '#60a5fa', description: '' },
  { id: 'p2', name: 'Other', color: '#4ade80', description: '' },
]
const ctx = {
  tasks: [
    task({ id: 'phase', name: 'Phase', startDate: '2026-09-01', endDate: '2026-09-30' }),
    task({ id: 'alpha', name: 'Alpha', parentId: 'phase', startDate: '2026-09-01', endDate: '2026-09-10' }),
    task({ id: 'beta', name: 'Beta', parentId: 'phase', startDate: '2026-09-05', endDate: '2026-09-20' }),
    task({ id: 'todo', name: 'Todo', isTodo: true, startDate: null, endDate: null, type: null }),
    task({ id: 'old', name: 'Old', archivedAt: '2026-09-01T00:00:00.000Z' }),
  ],
  projects,
  logs: [],
  dayPlans: [],
  habits: [],
  chores: [],
  today: '2026-09-15',
}

const call = (name, input) => executeTool(name, input, ctx)
const json = (result) => JSON.parse(result.content)

// --- reads -----------------------------------------------------------------

assert.equal(json(call('list_projects', {})).projects.length, 2)
assert.deepEqual(json(call('search_tasks', { query: 'alph' })).tasks.map((t) => t.id), ['alpha'])
assert.deepEqual(json(call('search_tasks', { projectId: 'p2' })).tasks, [])
assert.deepEqual(json(call('search_tasks', { status: 'todo' })).tasks.map((t) => t.id), ['todo'])
assert.deepEqual(json(call('search_tasks', { status: 'archived' })).tasks.map((t) => t.id), ['old'])
assert.equal(json(call('get_task', { taskId: 'phase' })).children.length, 2)
assert.equal(json(call('get_project', { projectId: 'p1' })).project.name, 'Project')
assert.equal(json(call('get_day', { date: '2026-09-15' })).date, '2026-09-15')

// --- task tree proposals ---------------------------------------------------

const baseTree = {
  projectId: 'p1',
  tasks: [
    { key: 'a', name: 'A', startDate: '2026-10-01', endDate: '2026-10-05' },
    { key: 'b', name: 'B', parentKey: 'a', startDate: '2026-10-02', endDate: '2026-10-05' },
  ],
}
const treeResult = call('propose_task_tree', baseTree)
const tree = json(treeResult)
assert.equal(tree.ok, true)
assert.equal(tree.status, 'pending_confirmation')
assert.equal(treeResult.proposal.tasks.length, 2)
assert.equal(treeResult.proposal.tasks[0].strictProgress, true)
assert.equal(treeResult.proposal.rows[1].depth, 1)

assert.equal(json(call('propose_task_tree', { projectId: 'p1', tasks: [{ key: 'a', name: 'A' }] })).error, 'missing_date')
assert.equal(
  json(call('propose_task_tree', {
    projectId: 'p1',
    tasks: [
      { key: 'a', name: 'A', parentKey: 'b', startDate: '2026-10-01', endDate: '2026-10-05' },
      { key: 'b', name: 'B', parentKey: 'a', startDate: '2026-10-01', endDate: '2026-10-05' },
    ],
  })).error,
  'cycle',
)
assert.equal(
  json(call('propose_task_tree', {
    projectId: 'p1',
    tasks: [
      { key: 'a', name: 'A', isTodo: true, startDate: '2026-10-01', endDate: '2026-10-05' },
      { key: 'b', name: 'B', parentKey: 'a', startDate: '2026-10-01', endDate: '2026-10-05' },
    ],
  })).error,
  'invalid_parent',
)
assert.equal(
  json(call('propose_task_tree', { projectId: 'p1', parentId: 'old', tasks: [{ key: 'a', name: 'A' }] })).error,
  'invalid_parent',
)
const newProjectTree = call('propose_task_tree', {
  projectName: 'New',
  tasks: [{ key: 'a', name: 'A', startDate: '2026-10-01', endDate: '2026-10-05' }],
})
assert.equal(newProjectTree.proposal.project.kind, 'new')
assert.match(newProjectTree.proposal.project.color, /^#[0-9a-f]{6}$/i)

// --- day plan proposals ----------------------------------------------------

const plan = call('propose_day_plan', {
  mode: 'tasks',
  taskIds: ['alpha', 'beta'],
  hours: { alpha: 2 },
})
assert.equal(json(plan).ok, true)
assert.deepEqual(plan.proposal.taskIds, ['alpha', 'beta'])
assert.equal(plan.proposal.hours.alpha, 2)
assert.equal(json(call('propose_day_plan', { mode: 'rest' })).ok, true)
assert.equal(call('propose_day_plan', { mode: 'rest' }).proposal.mode, 'rest')
assert.equal(call('propose_day_plan', { mode: 'clear' }).proposal.mode, 'clear')
assert.equal(json(call('propose_day_plan', { mode: 'tasks', taskIds: ['todo'] })).error, 'not_found')
assert.equal(json(call('propose_day_plan', { mode: 'tasks', taskIds: ['old'] })).error, 'not_found')
assert.equal(json(call('propose_day_plan', { mode: 'tasks', taskIds: ['alpha'], hours: { beta: 2 } })).error, 'invalid_hours')

// --- applying --------------------------------------------------------------

{
  const created = []
  let project = null
  let undone = null
  const actions = {
    addProject: () => 'new-project',
    addTask: (input) => {
      created.push(input)
      return `id-${input.name}`
    },
    setDayPlan: () => {},
    setDayCapacity: () => {},
    withUndo: (label, run) => {
      undone = label
      run()
    },
  }
  const applied = applyProposal(newProjectTree.proposal, actions, 'undo')
  assert.equal(applied.ok, true)
  assert.equal(undone, 'undo')
  assert.equal(project, null) // the fake records through created only
  assert.equal(created.length, 1)
  assert.equal(created[0].projectId, 'new-project')
  assert.equal(created[0].strictProgress, true)
}

{
  const created = []
  const actions = {
    addProject: () => 'new-project',
    addTask: (input) => {
      created.push(input)
      return `id-${input.name}`
    },
    setDayPlan: () => {},
    setDayCapacity: () => {},
    withUndo: (_label, run) => run(),
  }
  const applied = applyProposal(treeResult.proposal, actions, 'undo')
  assert.equal(applied.ok, true)
  assert.deepEqual(created.map((t) => t.name), ['A', 'B'])
  assert.equal(created[1].parentId, 'id-A')
}

{
  const calls = []
  const actions = {
    addProject: () => '',
    addTask: () => '',
    setDayPlan: (...args) => calls.push(['plan', ...args]),
    setDayCapacity: (...args) => calls.push(['capacity', ...args]),
    withUndo: (_label, run) => run(),
  }
  const rest = call('propose_day_plan', { mode: 'rest' })
  assert.equal(applyProposal(rest.proposal, actions, 'undo').ok, true)
  assert.deepEqual(calls, [['plan', '2026-09-15', [], undefined]])
}

// --- the guide says the important things ----------------------------------

const prompt = buildSystemPrompt({ lang: 'zh', today: '2026-09-15', projects: [{ id: 'p1', name: 'Project' }] })
assert.match(prompt, /甘特图/)
assert.match(prompt, /今天/)
assert.match(prompt, /课表/)
assert.match(prompt, /不写日志/)
assert.match(prompt, /这个软件现在做不到/)
assert.match(prompt, /最多 3 步/)
assert.match(prompt, /第 1 周周一/)
assert.match(prompt, /PDF/)

await server.close()
console.log('ai tools: ok')

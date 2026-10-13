import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

// Use the real store, serializers and UI notice, with controllable storage.
const values = new Map([['wbs-gantt.v2', '{damaged save']])
const writes = []
let failWrites = false
let failReads = false
globalThis.document = { documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.localStorage = {
  getItem(key) {
    if (failReads) throw new Error('storage unavailable')
    return values.get(key) ?? null
  },
  setItem(key, value) {
    if (failWrites) throw new Error('quota exceeded')
    writes.push([key, value])
    values.set(key, value)
  },
}
const RealDate = Date
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [2026, 9, 13, 12])) }
  static now() { return new RealDate(2026, 9, 13, 12).getTime() }
}
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { entries: [] } })
try {
  const { useStore } = await server.ssrLoadModule('/src/store/useStore.ts')
  const { loadData, parseImport } = await server.ssrLoadModule('/src/store/storage.ts')
  const { buildRows, effectiveStates } = await server.ssrLoadModule('/src/lib/tree.ts')
  const { dayStates } = await server.ssrLoadModule('/src/lib/dayTasks.ts')
  const { taskProgress } = await server.ssrLoadModule('/src/lib/progress.ts')
  const { StorageNotice } = await server.ssrLoadModule('/src/components/StorageNotice.tsx')
  const { translate } = await server.ssrLoadModule('/src/lib/i18n.ts')
  const state = () => useStore.getState()
  const task = (id, over = {}) => ({
    id, name: id, description: '', projectId: 'p', parentId: null,
    type: 'phase', isTodo: false, startDate: '2026-10-01', endDate: '2026-10-30',
    strictProgress: true, confirmedDays: [], paused: false, pauseDate: null, pauses: [],
    priority: 'medium', tags: [], dependencies: [], createdAt: '', updatedAt: '', ...over,
  })
  const projects = ['p', 'q'].map((id) => ({ id, name: id, description: '', color: '#888' }))
  const seed = (tasks = [], extra = {}) => state().importData({ projects, tasks, logs: [], ...extra })

  assert.equal(state().storageIssue.kind, 'load')
  assert.equal(values.get('wbs-gantt.v2'), '{damaged save', 'startup preserves damaged bytes')
  state().addProject('temporary', '#888')
  assert.equal(values.get('wbs-gantt.v2'), '{damaged save', 'edits cannot overwrite an unreadable save')
  const notice = renderToStaticMarkup(createElement(StorageNotice))
  assert.ok(notice.includes('role="alert"'))
  assert.ok(notice.includes(translate(state().lang, 'storage.original')))
  assert.ok(notice.includes(translate(state().lang, 'storage.backupAndSave')))

  failWrites = true
  state().retrySave()
  assert.equal(state().storageIssue.kind, 'load', 'a failed backup never unlocks overwriting')
  assert.equal(values.get('wbs-gantt.v2'), '{damaged save')
  assert.throws(() => seed(), /quota exceeded/)
  failWrites = false
  seed()
  assert.ok([...values].some(([key, raw]) => key.startsWith('wbs-gantt.v2.recovery.') && raw === '{damaged save'))
  assert.equal(state().storageIssue, null)

  failWrites = true
  state().addProject('unsaved', '#888')
  assert.equal(state().storageIssue.kind, 'save')
  assert.ok(JSON.parse(state().exportData()).projects.some((p) => p.name === 'unsaved'))
  failWrites = false
  state().retrySave()
  assert.equal(state().storageIssue, null)
  assert.ok(JSON.parse(values.get('wbs-gantt.v2')).projects.some((p) => p.name === 'unsaved'))
  failReads = true
  assert.equal(loadData().kind, 'error', 'read failure is distinct from an empty installation')
  failReads = false

  seed([task('root'), task('child', { parentId: 'root' }), task('grandchild', { parentId: 'child' })])
  const beforeMove = structuredClone(state().tasks)
  state().updateTask('root', { projectId: 'q', parentId: null, name: 'moved' })
  assert.ok(state().tasks.every((t) => t.projectId === 'q'))
  assert.deepEqual(buildRows(state().tasks.filter((t) => t.projectId === 'q'), {}, projects, []).filter((r) => r.kind === 'task').map((r) => r.id), ['root', 'child', 'grandchild'])
  state().undoLast()
  assert.deepEqual(state().tasks, beforeMove)
  state().setTaskParent('root', 'grandchild')
  assert.deepEqual(state().tasks, beforeMove, 'a cycle is rejected by the same command used by editing')
  state().addTask({ name: 'destination', projectId: 'q', startDate: '2026-10-01', endDate: '2026-10-30' })
  const destination = state().tasks.find((t) => t.name === 'destination').id
  state().setTaskParent('root', destination)
  assert.ok(['root', 'child', 'grandchild'].every((id) => state().tasks.find((t) => t.id === id).projectId === 'q'))

  seed([task('a')])
  const before = structuredClone(state().tasks)
  const writeCount = writes.length
  state().withUndo('two edits', () => {
    state().updateTask('a', { name: 'first', description: 'kept' })
    state().updateTask('a', { name: 'second' })
  })
  assert.equal(writes.length - writeCount, 1, 'one gesture saves one settled board')
  const tip = state().history.cursor
  state().undoLast()
  assert.deepEqual(state().tasks, before)
  state().historyGoTo(tip)
  assert.equal(state().tasks[0].name, 'second')
  assert.equal(state().tasks[0].description, 'kept', 'disjoint fields survive replay too')

  seed([task('a', { dependencies: ['b', 'c'] }), task('b'), task('c')])
  state().withUndo('bulk delete', () => { state().deleteTask('b'); state().deleteTask('c') })
  state().undoLast()
  assert.deepEqual(state().tasks.find((t) => t.id === 'a').dependencies, ['b', 'c'])
  seed()
  state().withUndo('create edit delete', () => {
    const id = state().addTask({ name: 'temporary', projectId: 'p', startDate: '2026-10-01', endDate: '2026-10-30' })
    state().updateTask(id, { name: 'edited' })
    state().deleteTask(id)
  })
  assert.equal(state().history.steps.length, 0, 'a cancelled gesture adds no fake history step')
  state().withUndo('folder rename', () => { state().setTodoFolderName('folder', 'one'); state().setTodoFolderName('folder', 'two') })
  state().undoLast()
  assert.deepEqual(state().todoFolders, {})

  // This is the action the Sidebar's export button calls, not a handcrafted
  // literal passed directly to the serializer.
  seed([task('a')], {
    chores: [{ id: 'c', title: 'chore', note: '', date: '2026-10-13', done: false, completedDate: null }],
    habits: [{ id: 'h', title: 'habit', note: '', parentId: null, startDate: '2026-10-13', endDate: null, weekdays: [0, 1], paused: false, pauseDate: null, pauses: [], doneDays: [] }],
    notes: [{ date: '2026-10-13', body: 'note', updatedAt: '', stamps: [{ at: '12:00' }] }],
    itemLogs: [{ kind: 'chore', ownerId: 'c', date: '2026-10-13', content: 'entry', createdAt: '', updatedAt: '' }],
    todoFolders: { folder: 'custom name' },
  })
  const roundTrip = parseImport(state().exportData())
  assert.equal(roundTrip.todoFolders.folder, 'custom name')
  for (const field of ['chores', 'habits', 'notes', 'itemLogs']) assert.equal(roundTrip[field].length, 1)

  const importing = (tasks, over = {}) => parseImport(JSON.stringify({ projects, tasks, logs: [], ...over }))
  assert.throws(() => importing([task('a', { parentId: 'b' }), task('b', { parentId: 'a' })]), /cycle/)
  assert.throws(() => importing([task('a', { parentId: 'missing' })]), /parent does not exist/)
  assert.throws(() => importing([task('a'), task('a')]), /duplicate/)
  assert.throws(() => importing([task('a', { projectId: 'missing' })]), /project does not exist/)
  assert.throws(() => importing([task('a'), task('b', { projectId: 'q', parentId: 'a' })]), /another project/)
  assert.throws(() => importing([], { logs: {} }), /Invalid logs/)
  assert.equal(importing([task('legacy', { tags: undefined, dependencies: undefined })]).tasks[0].dependencies.length, 0)

  const paused = task('a', { paused: true, pauseDate: '2026-10-10' })
  assert.equal(dayStates([paused], [], '2026-10-05').get('a').status, 'in-progress')
  assert.equal(dayStates([paused], [], '2026-10-10').get('a').status, 'paused')
  const resumed = { ...paused, paused: false, pauseDate: null, pauses: [{ pauseDate: '2026-10-10', resumeDate: '2026-10-12' }] }
  assert.equal(dayStates([resumed], [], '2026-10-11').get('a').status, 'paused')
  assert.equal(dayStates([resumed], [], '2026-10-12').get('a').status, 'in-progress')
  const future = { id: 'l', taskId: 'a', date: '2026-10-20', content: 'future', targetProgress: 100 }
  assert.equal(taskProgress(task('a'), [future], new Date(2026, 9, 13)), 0)
  assert.equal(effectiveStates([task('a')], [future]).get('a').status, 'in-progress')

  seed([task('parent'), task('child', { parentId: 'parent', endDate: '2026-10-20' })])
  state().updateTask('child', { endDate: '2026-10-25' })
  assert.equal(state().tasks.find((t) => t.id === 'parent').endDate, '2026-10-25', 'dates settle without mounting App')
  state().addLog({ taskId: 'child', date: state().today, content: 'finished', targetProgress: 100 })
  assert.equal(state().tasks.find((t) => t.id === 'parent').endDate, state().today, 'log changes also settle dates atomically')
  assert.equal(JSON.parse(values.get('wbs-gantt.v2')).tasks.find((t) => t.id === 'parent').endDate, state().today)
  console.log('data integrity: all assertions passed')
} finally {
  await server.close()
}
process.exit(0)

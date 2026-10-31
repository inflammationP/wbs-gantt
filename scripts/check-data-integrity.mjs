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
  seed([task('a', { deadline: '2026-10-20' })], {
    chores: [{ id: 'c', title: 'chore', note: '', date: '2026-10-13', done: false, completedDate: null }],
    habits: [{ id: 'h', title: 'habit', note: '', parentId: null, startDate: '2026-10-13', endDate: null, weekdays: [0, 1], paused: false, pauseDate: null, pauses: [], doneDays: [] }],
    notes: [{ date: '2026-10-13', body: 'note', updatedAt: '', stamps: [{ at: '12:00' }] }],
    itemLogs: [{ kind: 'chore', ownerId: 'c', date: '2026-10-13', content: 'entry', createdAt: '', updatedAt: '' }],
    todoFolders: { folder: 'custom name' },
    dayPlans: [
      { date: '2026-10-13', taskIds: ['a'], capacityHours: 6, hours: { a: 2.5 } },
      { date: '2026-10-14', taskIds: [] },
    ],
    scheduleBlocks: [{ id: 'b1', date: '2026-10-13', start: '09:00', end: '10:30', title: 'block' }],
    stickyNotes: [
      { id: 's1', name: '标签 1', text: 'remember', x: 100, y: 120, w: 300, h: 260, z: 3, docked: false, rich: true, createdAt: '', updatedAt: '' },
      { id: 's2', name: '标签 2', text: '', x: 0, y: 0, z: 4, docked: false, snapped: 'left', snapAt: 120, createdAt: '', updatedAt: '' },
    ],
  })
  const roundTrip = parseImport(state().exportData())
  assert.equal(roundTrip.todoFolders.folder, 'custom name')
  for (const field of ['chores', 'habits', 'notes', 'itemLogs']) assert.equal(roundTrip[field].length, 1)
  // The two day-scoped collections ride through the same snapshot. A missing
  // registration site shows up here as a zero, not as a silent loss on save.
  assert.equal(roundTrip.dayPlans.length, 2)
  assert.deepEqual(roundTrip.dayPlans[0].hours, { a: 2.5 })
  assert.equal(roundTrip.scheduleBlocks.length, 1)
  assert.equal(roundTrip.stickyNotes.length, 2)
  assert.equal(roundTrip.stickyNotes[0].text, 'remember')
  assert.equal(roundTrip.stickyNotes[0].docked, false)
  assert.equal(roundTrip.stickyNotes[0].w, 300)
  assert.equal(roundTrip.stickyNotes[0].h, 260)
  assert.equal(roundTrip.stickyNotes[0].rich, true, 'the rich flag rides with the card')
  assert.equal(roundTrip.stickyNotes[0].name, '标签 1')
  assert.equal(roundTrip.stickyNotes[1].snapped, 'left')
  assert.equal(roundTrip.stickyNotes[1].snapAt, 120)
  assert.equal(roundTrip.tasks[0].deadline, '2026-10-20', 'the DDL rides through the task')

  const importing = (tasks, over = {}) => parseImport(JSON.stringify({ projects, tasks, logs: [], ...over }))

  // Bad rows are dropped by `normalize`, not rejected: a typo must not make a
  // save unopenable.
  const sanitized = importing([task('a')], {
    dayPlans: [
      { date: '2026-10-13', taskIds: ['a'], hours: { a: 2 } },
      { date: '2026-10-13', taskIds: [], hours: { a: 2 } },
      { date: '2026-10-14', taskIds: 'bad' },
      { date: '2026-10-15', capacityHours: 25 },
      { date: '2026-10-16', capacityHours: 6 },
      { date: '2026-10-17', taskIds: ['a'], hours: { a: 2, stranger: 3, neg: -1, str: '2', huge: 30 } },
      { date: '2026-10-18', hours: { a: 2 } },
    ],
    scheduleBlocks: [
      { id: 'ok', date: '2026-10-13', start: '09:00', end: '10:00', title: 'ok' },
      { id: 'dead', date: '2026-10-13', start: '17:00', end: '10:00', title: 'deadline', deadline: true },
      { id: 'bad', date: '2026-10-13', start: '9:00', end: '10:00', title: 'bad' },
      { id: 'empty', date: '2026-10-13', start: '09:00', end: '10:00', title: '' },
    ],
    stickyNotes: [
      { id: 'ok', text: 'keep', x: 10, y: 20, z: 2, docked: true, createdAt: '', updatedAt: '' },
      { id: 'ok', text: 'duplicate', x: 0, y: 0, z: 0, docked: true },
      { id: 'bad-coords', text: 'kept', x: 'nope', y: null, z: -5 },
      { id: 'blank', text: '', x: 1, y: 2, w: 300, h: 260, z: 1, docked: false, rich: true },
      { id: 'bad-size', name: 'named', text: 'kept', x: 3, y: 4, w: 'wide', h: -5, rich: 'yes', snapped: 'diagonal', snapAt: 'x' },
      'not a row',
      { text: 'no id' },
    ],
  })
  assert.deepEqual(sanitized.dayPlans.map((p) => p.date), ['2026-10-13', '2026-10-16', '2026-10-17'])
  assert.deepEqual(sanitized.dayPlans[0].taskIds, [], 'last duplicate wins; [] is a rest day')
  assert.equal(sanitized.dayPlans[0].hours, undefined, 'a rest day keeps no per-task hours')
  assert.equal(sanitized.dayPlans[1].capacityHours, 6)
  assert.deepEqual(
    sanitized.dayPlans[2].hours,
    { a: 2 },
    'hours outside the plan, out of range, or unreadable are dropped',
  )
  assert.equal(sanitized.dayPlans.length, 3, 'hours alone are not a plan')
  assert.deepEqual(sanitized.scheduleBlocks.map((b) => b.id), ['ok', 'dead'])
  assert.equal(sanitized.scheduleBlocks[1].end, '17:00', 'a deadline is forced to a point')
  assert.deepEqual(sanitized.stickyNotes.map((n) => n.id), ['ok', 'bad-coords', 'blank', 'bad-size'])
  assert.equal(sanitized.stickyNotes[1].text, 'kept', 'a bad coordinate keeps the text')
  assert.equal(sanitized.stickyNotes[1].x, 16, 'and falls back to a visible point')
  assert.equal(sanitized.stickyNotes[1].z, 0, 'a negative number floors at zero')
  assert.equal(sanitized.stickyNotes[1].docked, true, 'an absent docked reads as on the board')
  assert.equal(sanitized.stickyNotes[2].text, '', 'a blank card is still a card')
  assert.equal(sanitized.stickyNotes[2].docked, false)
  assert.equal(sanitized.stickyNotes[2].w, 300, 'a size rides through')
  assert.equal(sanitized.stickyNotes[2].rich, true)
  assert.equal(sanitized.stickyNotes[3].w, undefined, 'an unreadable size is dropped')
  assert.equal(sanitized.stickyNotes[3].h, 120, 'a negative size is floored')
  assert.equal(sanitized.stickyNotes[3].rich, false, 'only a real true is rich')
  assert.equal(sanitized.stickyNotes[3].name, 'named', 'a real name is kept')
  assert.equal(sanitized.stickyNotes[3].snapped, null, 'an unknown edge is dropped')
  assert.equal(sanitized.stickyNotes[3].snapAt, 0)
  assert.equal(sanitized.stickyNotes[0].name, '标签 1', 'an old note gets a numbered name')

  assert.throws(() => importing([task('a', { parentId: 'b' }), task('b', { parentId: 'a' })]), /cycle/)
  assert.throws(() => importing([task('a', { parentId: 'missing' })]), /parent does not exist/)
  assert.throws(() => importing([task('a'), task('a')]), /duplicate/)
  assert.throws(() => importing([task('a', { projectId: 'missing' })]), /project does not exist/)
  assert.throws(() => importing([task('a'), task('b', { projectId: 'q', parentId: 'a' })]), /another project/)
  assert.throws(() => importing([], { logs: {} }), /Invalid logs/)
  assert.deepEqual(importing([task('a')]).stickyNotes, [], 'a save from before the corkboard has none')
  assert.equal(importing([task('a')]).tasks[0].deadline, null, 'a save from before the DDL has none')
  assert.equal(importing([task('a', { deadline: '2026-10-20' })]).tasks[0].deadline, '2026-10-20')
  assert.throws(() => importing([task('a', { deadline: 42 })]), /invalid deadline/)
  assert.equal(
    importing([task('a', { isTodo: true, startDate: null, endDate: null, deadline: '2026-10-20' })]).tasks[0].deadline,
    null,
    'a to-do holds no deadline',
  )
  const withReason = importing([task('a', {
    paused: true,
    pauseDate: '2026-10-10',
    pauseReason: 'waiting',
    pauses: [{ pauseDate: '2026-10-01', resumeDate: '2026-10-02', reason: 'parts' }],
  })])
  assert.equal(withReason.tasks[0].pauseReason, 'waiting', 'an open pause keeps its reason')
  assert.equal(withReason.tasks[0].pauses[0].reason, 'parts', 'a closed pair keeps its own')
  assert.throws(
    () => importing([task('a', { pauses: [{ pauseDate: '2026-10-01', resumeDate: '2026-10-02', reason: 5 }] })]),
    /invalid pauses/,
  )
  assert.throws(() => importing([task('a', { paused: true, pauseReason: 5 })]), /invalid pauseReason/)
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

  // Pauses now ask for a reason. The store is the trust boundary: it trims,
  // refuses an empty one, and closes the pair with the reason on resume.
  seed([task('a'), task('b')])
  state().pauseTask('a', '  waiting  ')
  assert.equal(state().tasks.find((t) => t.id === 'a').pauseReason, 'waiting')
  state().pauseTask('b', '   ')
  assert.equal(state().tasks.find((t) => t.id === 'b').paused, false, 'an empty reason is refused')
  state().resumeTask('a')
  const closed = state().tasks.find((t) => t.id === 'a')
  assert.equal(closed.pauseReason, null, 'resuming clears the open reason')
  assert.deepEqual(closed.pauses.at(-1), {
    pauseDate: state().today,
    resumeDate: state().today,
    reason: 'waiting',
  })

  // A pause opened before reasons existed closes without inventing one.
  seed([task('a', { paused: true, pauseDate: '2026-09-10' })])
  state().resumeTask('a')
  const legacy = state().tasks.find((t) => t.id === 'a')
  assert.equal(legacy.pauseReason, null)
  assert.equal('reason' in legacy.pauses.at(-1), false, 'a legacy pause invents no reason')

  // Default note names count up across the list, whatever their language.
  seed([])
  const firstSticky = state().addStickyNote({ x: 10, y: 10 })
  assert.equal(
    state().stickyNotes.find((n) => n.id === firstSticky).name,
    translate(state().lang, 'sticky.defaultName', { n: 1 }),
  )
  const secondSticky = state().addStickyNote({ x: 20, y: 20 })
  assert.equal(
    state().stickyNotes.find((n) => n.id === secondSticky).name,
    translate(state().lang, 'sticky.defaultName', { n: 2 }),
  )

  console.log('data integrity: all assertions passed')
} finally {
  await server.close()
}
process.exit(0)

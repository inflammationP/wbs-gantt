/**
 * The app's three languages.
 *
 * Deliberately dependency-free: a flat dictionary and a two-form plural
 * resolver, no i18n library. The `react / react-dom / zustand / lucide-react`
 * dependency list is a standing constraint of this project and three languages
 * do not justify breaking it.
 *
 * Completeness is enforced by the compiler rather than by review. `Dict` is
 * derived from the English dictionary, and `zh` and `fr` are annotated with it,
 * so a key present in one and missing from another fails `tsc --noEmit` — which
 * `npm run build` runs first.
 *
 * Two rules keep that guarantee alive, and both are easy to break by accident:
 *
 *   1. `en` must stay a bare object literal. Adding `as const` narrows each
 *      property to its literal string, so `Dict['nav.gantt']` becomes `'Gantt'`
 *      and every translation is then required to spell 'Gantt' exactly — the
 *      whole mechanism silently inverts. Same for `Object.freeze` / `satisfies`.
 *   2. `zh` and `fr` must be assigned directly, not built. Writing
 *      `const zh: Dict = { ...en, 'x': '…' }` satisfies the type trivially,
 *      because the spread supplies every missing key.
 *
 * Terminology, fixed across the dictionary so the same concept never appears
 * under two names:
 *
 *   task       任务            tâche
 *   subtask    子任务          sous-tâche
 *   phase      阶段            phase
 *   long-term  长期            long terme
 *   to-do      待办            tâche à faire
 *   log        日志            journal
 *   strict     严格            strict
 *   progress   进度            avancement
 *   project    项目            projet
 */
export type Lang = 'en' | 'zh' | 'fr'

export const LANGS: Lang[] = ['en', 'zh', 'fr']

/**
 * What the app opens in, before anyone has chosen.
 *
 * Lives here rather than in `store/storage.ts` so that `DEFAULT_PREFS` and any
 * reader that needs to ask "is this still the default?" agree by construction.
 * The getting-started guide is such a reader: its first step asks the user to
 * pick a language, and someone who has already switched has answered it without
 * ever opening the dialog.
 */
export const DEFAULT_LANG: Lang = 'en'

/**
 * Each language names itself, so the picker needs no translation of its own —
 * a Chinese speaker looking for French should find « Français », not "French".
 */
export const LANG_LABEL: Record<Lang, string> = {
  en: 'English',
  zh: '中文',
  fr: 'Français',
}

export function isLang(value: string): value is Lang {
  return (LANGS as string[]).includes(value)
}

const en = {
  'app.title': 'WBS · Gantt — Project Control',

  // --- navigation and shell ---
  'nav.gantt': 'Gantt',
  'nav.logs': 'Logs',
  'nav.manage': 'Manage',
  'nav.calendar': 'Calendar',
  'nav.settings': 'Settings',
  'sidebar.projects': 'Projects',
  'sidebar.allProjects': 'All projects',
  'sidebar.expandAll': 'Expand all',
  'sidebar.collapseAll': 'Collapse all',
  'sidebar.editProject': 'Edit project',
  'sidebar.export': 'Export',
  'sidebar.exportTitle': 'Export JSON',
  'sidebar.import': 'Import',
  'sidebar.importTitle': 'Import JSON',
  'sidebar.importFailed': 'Import failed: {message}',

  // --- shared vocabulary ---
  'common.none': '—',
  'common.tbd': 'TBD',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.ok': 'OK',
  'common.confirm': 'Confirm',
  'common.confirmTitle': 'Please confirm',
  'common.noticeTitle': 'Notice',
  'common.name': 'Name',
  'common.date': 'Date',
  'common.type': 'Type',
  'common.project': 'Project',
  'common.status': 'Status',
  'common.priority': 'Priority',
  'common.progress': 'Progress',
  'common.description': 'Description',
  'common.noDescription': 'No description.',
  'common.tags': 'Tags',
  'common.tasks': 'Tasks',
  'common.task': 'Task',
  'common.start': 'Start',
  'common.end': 'End',
  'common.startDate': 'Start date',
  'common.endDate': 'End date',
  'common.history': 'History',
  'common.dependencies': 'Dependencies',
  'common.subtasks': 'Subtasks',
  'common.wbs': 'WBS',
  'common.prog': 'Prog',
  'common.expand': 'Expand',
  'common.collapse': 'Collapse',
  'common.select': 'Select',
  'common.deselect': 'Deselect',
  'common.selectAll': 'Select all',
  'common.deselectAll': 'Deselect all',
  'common.unknownTask': 'Unknown task',
  'common.notes': 'Notes…',
  'common.targetProgress': 'Target progress: {percent}%',
  'common.taskCount': { one: '{count} task', other: '{count} tasks' },
  'common.logCount': { one: '{count} log', other: '{count} logs' },

  // --- statuses, priorities, task types ---
  'status.todo': 'To-do',
  'status.notStarted': 'Not started',
  'status.inProgress': 'In progress',
  'status.completed': 'Completed',
  'status.paused': 'Paused',
  'status.delayed': 'Delayed',
  'priority.low': 'Low',
  'priority.medium': 'Medium',
  'priority.high': 'High',
  'priority.urgent': 'Urgent',
  'priority.title': '{level} priority',
  'type.phase': 'Phase',
  'type.longTerm': 'Long-Term',

  // --- dates and periods ---
  'time.today': 'Today',
  'time.tomorrow': 'Tomorrow',
  'time.yesterday': 'Yesterday',
  'time.inDays': { one: 'in {count} day', other: 'in {count} days' },
  'time.daysAgo': { one: '{count} day ago', other: '{count} days ago' },
  'time.week': 'W{count}',
  'time.quarter': 'Q{count}',
  'time.monthYear': '{month} {year}',
  'time.quarterYear': 'Q{count} {year}',
  'time.rangeSeparator': ' – ',

  // --- gantt ---
  'gantt.view.day': 'Day',
  'gantt.view.week': 'Week',
  'gantt.view.month': 'Month',
  'gantt.view.quarter': 'Quarter',
  'gantt.view.year': 'Year',
  'gantt.backToToday': 'Back to Today',
  'gantt.newTask': 'New task',
  'gantt.deleteTask': 'Delete "{name}"?',
  'gantt.deleteTaskWithSubtasks': 'Delete "{name}" and all its subtasks?',
  'gantt.deleteTodos': {
    one: 'Delete {count} to-do task?',
    other: 'Delete {count} to-do tasks?',
  },
  'gantt.deleteTodosWithSubtasks': {
    one: 'Delete {count} to-do task and its subtasks?',
    other: 'Delete {count} to-do tasks and their subtasks?',
  },
  'gantt.ongoingTitle': '{wbs} {name} — ongoing',
  'gantt.pickDate': 'Click any date to open its day detail',
  'gantt.writeLogForDay': 'Write a log for this day',
  'gantt.moveToTopLevel': 'Move to top level',

  // --- to-dos ---
  'todo.folderName': 'To-dos',
  'todo.folder': 'To-dos ({count})',
  'todo.startTask': 'Start task',
  'todo.start': 'Start',
  'todo.next': 'Next →',
  'todo.restoreMany': { one: 'Restore {count} to-do', other: 'Restore {count} to-dos' },
  'todo.saveAll': 'Save all ({count})',
  'todo.hasSubtasks':
    '{name} has subtasks, so its dates are decided by them. Restore those first, or set a priority here and let the dates follow.',
  'todo.restoreSelected': 'Restore {count} selected',
  'todo.restoreAll': 'Restore all {count}',
  'todo.deleteSelected': 'Delete {count} selected',
  'todo.deleteAll': 'Delete all {count}',

  // --- tasks ---
  'task.addSubtask': 'Add subtask',
  'task.addSibling': 'Add sibling task',
  'task.new': 'New task',
  'task.edit': 'Edit task',
  'task.namePlaceholder': 'Task name',
  'task.parent': 'Parent',
  'task.topLevel': '— Top level —',
  'task.createAsTodo': 'Create as to-do — no dates, priority or progress mode needed',
  'task.todoNote':
    'This is a to-do: unscheduled work. It sits last among its siblings inside a {toDos} folder until you give it a schedule with {startTask} in the detail panel.',
  'task.endDateLocked':
    'The end date is decided by the subtask that ends last — change that subtask’s end date instead.',
  'task.strictProgress': 'Strict progress (progress only advances via daily logs)',
  'task.overdueMark': 'This task is already overdue — mark as',
  'task.tagsPlaceholder': 'study, health',
  'task.tagsLabel': 'Tags (comma separated)',
  'task.subtaskCount': { one: '{count} subtask', other: '{count} subtasks' },
  'task.hide': 'Hide',
  'task.hidden': 'Hidden.',
  'task.noSubtasks': 'No subtasks.',
  'task.progressMode': 'Progress mode',
  'task.modeStrict': 'Strict (log-based)',
  'task.modeAuto': 'Auto (date-based)',
  'task.noSchedule':
    'No schedule yet. Give it dates, a priority and a progress mode when you start it.',
  'task.pausedNote': {
    one: 'Paused. Started {start} · paused on {paused} · {count} day elapsed.',
    other: 'Paused. Started {start} · paused on {paused} · {count} days elapsed.',
  },
  'task.resume': 'Resume',
  'task.endPostponed': 'End (postponed)',
  'task.setAsTodo': 'Set as to-do',
  'task.pause': 'Pause task',
  'task.pauseHistory': 'Pause history ({count})',
  'task.pauseEntry': 'Paused {from} → resumed {to}',
  'task.setAsTodoConfirm': 'Mark "{name}" as to-do?\n\nIts dates, priority and progress are cleared.',
  'task.setAsTodoConfirmMany': {
    one:
      'Mark "{name}" and its {count} unfinished subtask as to-do?\n\n' +
      'Their dates, priorities and progress are cleared. Completed subtasks are left untouched.',
    other:
      'Mark "{name}" and its {count} unfinished subtasks as to-do?\n\n' +
      'Their dates, priorities and progress are cleared. Completed subtasks are left untouched.',
  },
  // Written into the log at the moment a task is created already overdue, and
  // translated in whatever language was on screen then. It reads back later as
  // part of the task's history, which is user content: like a note the user
  // typed, it keeps the language it was written in. Do not "fix" this by
  // re-translating it at render time.
  'task.markedCompleted': 'Marked as completed',

  // --- logs ---
  'log.write': 'Write log',
  'log.edit': 'Edit log',
  'log.label': 'Log',
  'log.contentPlaceholder': 'What did you work on?',
  'log.hint': 'Each line is an item; Tab indents a sub-item, Shift+Tab outdents.',
  'log.setTarget': 'Set target progress (optional)',
  'log.progressAfterDay': 'Progress after this day',
  'log.targetPlaceholder': 'e.g. 40',
  'logs.all': 'All logs',
  'logs.empty': 'No logs yet.',
  'logs.moreTasks': { one: '+{count} more task', other: '+{count} more tasks' },
  'logs.dayFooter': '{logs} · {tasks}',

  // --- calendar ---
  'calendar.prevMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.cellLabel': '{date}: {due}, {starting}; {coverage}',
  'calendar.dueCount': { one: '{count} due', other: '{count} due' },
  'calendar.startingCount': { one: '{count} starting', other: '{count} starting' },
  'calendar.coverage.future': 'not yet due',
  'calendar.coverage.clear': 'no strict work scheduled',
  'calendar.coverage.partial': '{count} of {total} strict tasks logged',
  'calendar.coverage.full': 'all {count} strict tasks logged',
  'calendar.more': '+{count} more',
  'calendar.milestoneTitle': '{kind}{strict} — {name}{logged}',
  'calendar.milestone.due': 'Due',
  'calendar.milestone.starts': 'Starts',
  'calendar.milestone.strict': ' · strict',
  'calendar.milestone.logged': ' · logged this day',

  // --- day detail ---
  'day.strictLogs': 'Strict logs',
  'day.notYetDue': 'Not yet due',
  'day.noStrictScheduled': 'No strict work scheduled',
  'day.allLogged': 'All strict work logged',
  'day.nothingLogged': 'Nothing logged yet',
  'day.stillMissing': { one: '{count} still missing', other: '{count} still missing' },
  'day.noStrictTasksScheduled': 'No strict tasks scheduled',
  'day.ringPartial': '{count} of {total} strict tasks logged',
  'day.taskCount': { one: '{count} task on this day', other: '{count} tasks on this day' },
  'day.strictTasks': 'Strict tasks',
  'day.otherTasks': 'Other tasks',
  'day.noStrictOnDay': 'No strict tasks scheduled on this day.',
  'day.nothingElse': 'Nothing else scheduled on this day.',
  'day.readLogs': 'Read this day’s logs',
  'day.readLogsCount': 'Read this day’s logs ({count})',
  'day.noLog': 'No log',
  'day.noProgress': 'No progress',
  'day.viewTask': 'View task →',

  // --- manage ---
  'manage.overall': 'Overall',
  'manage.totalTasks': 'Total tasks',
  'manage.leafTasks': { one: '{count} leaf task', other: '{count} leaf tasks' },
  'manage.upcoming': 'Upcoming (7 days)',
  'manage.overdue': 'Overdue',
  'manage.newProject': 'New project',
  'manage.projectNamePrompt': 'Project name',
  'manage.deleteProject': 'Delete project "{name}" and all its tasks?',
  'manage.openInGantt': 'Open in Gantt →',
  'manage.comingSoon': 'Coming soon',
  'manage.allStatuses': 'All statuses',
  'manage.filteredCount': {
    one: '{filtered} of {count} task',
    other: '{filtered} of {count} tasks',
  },
  'manage.empty': 'Nothing here.',
  'manage.sub.active': 'active',
  // The Projects card's caption. Deliberately not "active": on the Tasks band
  // below, the same word labels the in-progress count, and two different numbers
  // both reading "active" invites reading one as the other.
  'manage.sub.tracked': 'tracked',
  'manage.sub.done': 'done',
  'manage.sub.paused': 'paused',
  'manage.sub.startsIn7': 'starts in 7 days',
  'manage.sub.pastDue': 'past due',
  'manage.sub.pastDueDueSoon': 'past due · {count} due soon',
  'manage.sub.unscheduled': 'unscheduled',
  'manage.countCompleted': { one: '{count} completed', other: '{count} completed' },
  'manage.countOpen': { one: '{count} open', other: '{count} open' },

  // --- projects ---
  'project.heading': 'Project',
  'project.color': 'Color',
  'project.done': 'Done',
  'project.open': 'Open',

  // --- settings ---
  'settings.language': 'Language',
  'settings.languageHint': 'The language of the interface.',
  'settings.theme': 'Theme',
  'settings.themeHint': 'A whole colour scheme — surfaces, text and the colours that carry meaning.',
  'settings.themeNote':
    'Green means done and red means late in every theme; the palettes differ in their surfaces and accent, so a status keeps its meaning whichever one you pick.',
  'settings.active': 'Current',
  'theme.graphite.name': 'Graphite',
  'theme.graphite.hint': 'Near-black, neutral',
  'theme.slate.name': 'Slate',
  'theme.slate.hint': 'Mid grey-blue, cool',
  'theme.ember.name': 'Ember',
  'theme.ember.hint': 'Hazel-black, warm',
  'theme.paper.name': 'Paper',
  'theme.paper.hint': 'Light, crisp',
  // Colour names for the Settings swatch board.
  'swatch.groupChrome': 'Interface',
  'swatch.groupSignals': 'Meaning',
  'swatch.bg': 'Background',
  'swatch.panel': 'Panel',
  'swatch.panel2': 'Field',
  'swatch.stripe': 'Alt. row',
  'swatch.border': 'Border',
  'swatch.line': 'Divider',
  'swatch.fg': 'Text',
  'swatch.muted': 'Secondary text',
  'swatch.dim': 'Faint text',
  'swatch.accent': 'Accent',

  // --- getting started ---
  // The six-step card. Step labels are instructions rather than descriptions:
  // they are read by someone looking at a nearly empty board.
  'guide.title': 'Getting started',
  'guide.dismiss': 'Hide this',
  'guide.done': 'You are set up.',
  'guide.read': 'Read this',
  'guide.close': 'Got it',
  'guide.goThere': 'Take me there',
  // `{settings}` / `{manage}` are the sidebar's own words for those pages, passed
  // in by the card — a step that says where to click must name the page the way
  // the navigation names it, and this reprases itself in three languages.
  'guide.step.language': 'Pick your language in {settings}',
  'guide.step.project': 'Create a project in {manage}',
  'guide.step.parentTask': 'Add a parent task inside it',
  'guide.step.strictChild': 'Nest a strict subtask under that task',
  'guide.step.endDate': 'How a parent’s end date is worked out',
  'guide.step.log': 'Write a log on the strict subtask',
  'guide.step.tour': 'Look around: Logs, Manage, Calendar, Settings',
  // The explanation dialogs. The two about derivation have to stay true to
  // src/lib/tree.ts (`syncParentEnds`) and src/lib/progress.ts (`autoProgress` /
  // `taskProgress`) — a guide that describes the rules wrongly is worse than no
  // guide, so change the copy when the rule changes.
  // The language names ride in as a parameter rather than being written into each
  // translation: someone who has landed in a language they do not read needs to
  // recognise their own on sight, and English / 中文 / Français do that in any
  // surrounding language.
  'guide.explain.language.title': 'Interface language',
  'guide.explain.language.p1':
    'The interface comes in {langs}. It opens in English — if that is not your language, switch it in Settings, under Language. Everything follows at once, this card included.',
  'guide.explain.language.skip': 'Not now',
  'guide.explain.endDate.title': 'How a parent’s end date is worked out',
  'guide.explain.endDate.p1':
    'A parent task keeps no schedule of its own — its end date is decided by its subtasks, and it is always the latest of them. The subtask you just added ends after the parent did, so the parent has moved out to meet it.',
  'guide.explain.endDate.p2':
    'The interface says as much: open the parent for editing and the end-date field is greyed out, and hovering it reads “decided by the subtask that ends last”. Drag any subtask and the parent follows. Its progress works the same way — the average of its subtasks’ — which is why the parent will not let you type one in either.',
  'guide.explain.strict.title': 'Strict and non-strict: where progress comes from',
  'guide.explain.strict.p1': 'The difference is where the number comes from, not how it is drawn.',
  'guide.explain.strict.p2':
    'An ordinary task follows the calendar: the share of its window that has elapsed is its progress. A task that has not started reads 0%, and a window that has closed reads 100% of its own accord — you need do nothing for it to move.',
  'guide.explain.strict.p3':
    'A strict task counts only logs. With no log at all it stays at 0%, long after its window has closed. Once there are logs, one of two things decides the number: the latest log that carries a target progress is taken at its word; if none carries one, progress accrues as logged days ÷ the window’s days — so a day you skip is a day genuinely lost.',
  'guide.explain.strict.p4':
    'That is what a strict task is for: progress that reports what you actually did, instead of letting the calendar finish the work on your behalf.',
  'guide.explain.tour.title': 'A look around',
  'guide.explain.tour.intro':
    'The sample board has been added alongside your own work, so Logs, Manage and Calendar all have something to show. One line on each:',
  'guide.explain.tour.logs':
    'Logs — everything written, collected by day; a strict task’s entries carry their target progress too.',
  'guide.explain.tour.manage':
    'Manage — the overview: what is on today, what is coming, what has slipped, then projects and tasks broken out below.',
  'guide.explain.tour.calendar':
    'Calendar — the month at a glance. A cell’s shade is how much of that day’s strict work was logged, and days carrying milestones or overdue work are marked.',
  'guide.explain.tour.settings':
    'Settings — three languages and four colour schemes, switchable whenever you like.',
}

export type Dict = typeof en

const zh: Dict = {
  'app.title': 'WBS · Gantt —— 项目管控',

  'nav.gantt': '甘特图',
  'nav.logs': '日志',
  'nav.manage': '管理',
  'nav.calendar': '日历',
  'nav.settings': '设置',
  'sidebar.projects': '项目',
  'sidebar.allProjects': '全部项目',
  'sidebar.expandAll': '全部展开',
  'sidebar.collapseAll': '全部折叠',
  'sidebar.editProject': '编辑项目',
  'sidebar.export': '导出',
  'sidebar.exportTitle': '导出 JSON',
  'sidebar.import': '导入',
  'sidebar.importTitle': '导入 JSON',
  'sidebar.importFailed': '导入失败：{message}',

  'common.none': '—',
  'common.tbd': '待定',
  'common.cancel': '取消',
  'common.save': '保存',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.close': '关闭',
  'common.ok': '确定',
  'common.confirm': '确认',
  'common.confirmTitle': '请确认',
  'common.noticeTitle': '提示',
  'common.name': '名称',
  'common.date': '日期',
  'common.type': '类型',
  'common.project': '项目',
  'common.status': '状态',
  'common.priority': '优先级',
  'common.progress': '进度',
  'common.description': '描述',
  'common.noDescription': '暂无描述。',
  'common.tags': '标签',
  'common.tasks': '任务',
  'common.task': '任务',
  'common.start': '开始',
  'common.end': '结束',
  'common.startDate': '开始日期',
  'common.endDate': '结束日期',
  'common.history': '历史',
  'common.dependencies': '依赖',
  'common.subtasks': '子任务',
  'common.wbs': 'WBS',
  'common.prog': '进度',
  'common.expand': '展开',
  'common.collapse': '折叠',
  'common.select': '选择',
  'common.deselect': '取消选择',
  'common.selectAll': '全选',
  'common.deselectAll': '取消全选',
  'common.unknownTask': '未知任务',
  'common.notes': '备注…',
  'common.targetProgress': '目标进度：{percent}%',
  'common.taskCount': { one: '{count} 项任务', other: '{count} 项任务' },
  'common.logCount': { one: '{count} 条日志', other: '{count} 条日志' },

  'status.todo': '待办',
  'status.notStarted': '未开始',
  'status.inProgress': '进行中',
  'status.completed': '已完成',
  'status.paused': '已暂停',
  'status.delayed': '已逾期',
  'priority.low': '低',
  'priority.medium': '中',
  'priority.high': '高',
  'priority.urgent': '紧急',
  'priority.title': '{level}优先级',
  'type.phase': '阶段',
  'type.longTerm': '长期',

  'time.today': '今天',
  'time.tomorrow': '明天',
  'time.yesterday': '昨天',
  'time.inDays': { one: '{count} 天后', other: '{count} 天后' },
  'time.daysAgo': { one: '{count} 天前', other: '{count} 天前' },
  'time.week': '{count}周',
  'time.quarter': '{count}季度',
  'time.monthYear': '{year}年{month}',
  'time.quarterYear': '{year}年第{count}季度',
  'time.rangeSeparator': ' – ',

  'gantt.view.day': '日',
  'gantt.view.week': '周',
  'gantt.view.month': '月',
  'gantt.view.quarter': '季',
  'gantt.view.year': '年',
  'gantt.backToToday': '回到今天',
  'gantt.newTask': '新建任务',
  'gantt.deleteTask': '确定删除“{name}”？',
  'gantt.deleteTaskWithSubtasks': '确定删除“{name}”及其所有子任务？',
  'gantt.deleteTodos': {
    one: '确定删除 {count} 项待办任务？',
    other: '确定删除 {count} 项待办任务？',
  },
  'gantt.deleteTodosWithSubtasks': {
    one: '确定删除 {count} 项待办任务及其子任务？',
    other: '确定删除 {count} 项待办任务及其子任务？',
  },
  'gantt.ongoingTitle': '{wbs} {name} —— 长期进行中',
  'gantt.pickDate': '点击任意日期查看当天详情',
  'gantt.writeLogForDay': '为这一天写日志',
  'gantt.moveToTopLevel': '移到顶层',

  'todo.folderName': '待办',
  'todo.folder': '待办（{count}）',
  'todo.startTask': '开始任务',
  'todo.start': '开始',
  'todo.next': '下一个 →',
  'todo.restoreMany': { one: '恢复 {count} 项待办', other: '恢复 {count} 项待办' },
  'todo.saveAll': '全部保存（{count}）',
  'todo.hasSubtasks': '{name} 有子任务，它的日期由子任务决定。请先恢复那些子任务；也可以只在此设定优先级，让日期随后自动跟进。',
  'todo.restoreSelected': '恢复已选的 {count} 项',
  'todo.restoreAll': '恢复全部 {count} 项',
  'todo.deleteSelected': '删除已选的 {count} 项',
  'todo.deleteAll': '删除全部 {count} 项',

  'task.addSubtask': '添加子任务',
  'task.addSibling': '添加同级任务',
  'task.new': '新建任务',
  'task.edit': '编辑任务',
  'task.namePlaceholder': '任务名称',
  'task.parent': '父任务',
  'task.topLevel': '— 顶层 —',
  'task.createAsTodo': '创建为待办 —— 无需日期、优先级或进度模式',
  'task.todoNote':
    '这是一项待办：尚未排期的工作。它会排在同级任务末尾的 {toDos} 文件夹中，直到你在详情面板里用 {startTask} 为它安排时间。',
  'task.endDateLocked': '结束日期由最晚结束的子任务决定，请改为修改那个子任务的结束日期。',
  'task.strictProgress': '严格进度（进度仅通过每日日志推进）',
  'task.overdueMark': '该任务已逾期 —— 标记为',
  'task.tagsPlaceholder': '学习, 健康',
  'task.tagsLabel': '标签（用逗号分隔）',
  'task.subtaskCount': { one: '{count} 项子任务', other: '{count} 项子任务' },
  'task.hide': '收起',
  'task.hidden': '已收起。',
  'task.noSubtasks': '暂无子任务。',
  'task.progressMode': '进度模式',
  'task.modeStrict': '严格（按日志推进）',
  'task.modeAuto': '自动（按日期推进）',
  'task.noSchedule': '尚未排期。开始这项任务时，再为它设定日期、优先级和进度模式。',
  'task.pausedNote': {
    one: '已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。',
    other: '已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。',
  },
  'task.resume': '恢复',
  'task.endPostponed': '结束（已顺延）',
  'task.setAsTodo': '设为待办',
  'task.pause': '暂停任务',
  'task.pauseHistory': '暂停记录（{count}）',
  'task.pauseEntry': '暂停于 {from} → 恢复于 {to}',
  'task.setAsTodoConfirm': '确定将“{name}”设为待办？\n\n它的日期、优先级和进度将被清除。',
  'task.setAsTodoConfirmMany': {
    one: '确定将“{name}”及其 {count} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。',
    other: '确定将“{name}”及其 {count} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。',
  },
  'task.markedCompleted': '已标记为完成',

  'log.write': '写日志',
  'log.edit': '编辑日志',
  'log.label': '日志',
  'log.contentPlaceholder': '今天做了什么？',
  'log.hint': '每行是一个条目；Tab 键缩进为子条目，Shift+Tab 反向缩进。',
  'log.setTarget': '设置目标进度（可选）',
  'log.progressAfterDay': '当天结束后的进度',
  'log.targetPlaceholder': '例如 40',
  'logs.all': '全部日志',
  'logs.empty': '暂无日志。',
  'logs.moreTasks': { one: '还有 {count} 项任务', other: '还有 {count} 项任务' },
  'logs.dayFooter': '{logs} · {tasks}',

  'calendar.prevMonth': '上个月',
  'calendar.nextMonth': '下个月',
  'calendar.cellLabel': '{date}：{due}，{starting}；{coverage}',
  'calendar.dueCount': { one: '{count} 项到期', other: '{count} 项到期' },
  'calendar.startingCount': { one: '{count} 项开始', other: '{count} 项开始' },
  'calendar.coverage.future': '尚未到期',
  'calendar.coverage.clear': '没有严格任务',
  'calendar.coverage.partial': '已记录 {count}/{total} 项严格任务',
  'calendar.coverage.full': '{count} 项严格任务已全部记录',
  'calendar.more': '还有 {count} 项',
  'calendar.milestoneTitle': '{kind}{strict} —— {name}{logged}',
  'calendar.milestone.due': '到期',
  'calendar.milestone.starts': '开始',
  'calendar.milestone.strict': ' · 严格',
  'calendar.milestone.logged': ' · 当天已记录',

  'day.strictLogs': '严格日志',
  'day.notYetDue': '尚未到期',
  'day.noStrictScheduled': '没有严格任务排期',
  'day.allLogged': '严格任务已全部记录',
  'day.nothingLogged': '尚未记录任何日志',
  'day.stillMissing': { one: '还差 {count} 项', other: '还差 {count} 项' },
  'day.noStrictTasksScheduled': '当天没有严格任务',
  'day.ringPartial': '已记录 {count}/{total} 项严格任务',
  'day.taskCount': { one: '当天有 {count} 项任务', other: '当天有 {count} 项任务' },
  'day.strictTasks': '严格任务',
  'day.otherTasks': '其他任务',
  'day.noStrictOnDay': '当天没有排期的严格任务。',
  'day.nothingElse': '当天没有其他安排。',
  'day.readLogs': '查看当天的日志',
  'day.readLogsCount': '查看当天的日志（{count}）',
  'day.noLog': '未填日志',
  'day.noProgress': '无进度',
  'day.viewTask': '查看任务 →',

  'manage.overall': '总览',
  'manage.totalTasks': '任务总数',
  'manage.leafTasks': { one: '{count} 项末级任务', other: '{count} 项末级任务' },
  'manage.upcoming': '未来 7 天',
  'manage.overdue': '已逾期',
  'manage.newProject': '新建项目',
  'manage.projectNamePrompt': '项目名称',
  'manage.deleteProject': '确定删除项目“{name}”及其全部任务？',
  'manage.openInGantt': '在甘特图中打开 →',
  'manage.comingSoon': '即将开始',
  'manage.allStatuses': '全部状态',
  'manage.filteredCount': {
    one: '共 {count} 项任务，显示 {filtered} 项',
    other: '共 {count} 项任务，显示 {filtered} 项',
  },
  'manage.empty': '暂无内容。',
  'manage.sub.active': '进行中',
  'manage.sub.tracked': '在跟踪',
  'manage.sub.done': '已完成',
  'manage.sub.paused': '已暂停',
  'manage.sub.startsIn7': '7 天内开始',
  'manage.sub.pastDue': '已过期',
  'manage.sub.pastDueDueSoon': '已过期 · {count} 项即将到期',
  'manage.sub.unscheduled': '未排期',
  'manage.countCompleted': { one: '{count} 项已完成', other: '{count} 项已完成' },
  'manage.countOpen': { one: '{count} 项未完成', other: '{count} 项未完成' },

  'project.heading': '项目',
  'project.color': '颜色',
  'project.done': '已完成',
  'project.open': '未完成',

  'settings.language': '语言',
  'settings.languageHint': '界面显示所用的语言。',
  'settings.theme': '主题',
  'settings.themeHint': '一整套配色方案 —— 包括底面、文字，以及承载含义的状态色。',
  'settings.themeNote':
    '在每一套主题里，绿都代表完成、红都代表逾期。各套之间变化的是底面与强调色，所以无论选哪套，状态的含义都不变。',
  'settings.active': '当前',
  'theme.graphite.name': '石墨',
  'theme.graphite.hint': '近黑 · 中性',
  'theme.slate.name': '板岩',
  'theme.slate.hint': '中灰蓝 · 偏冷',
  'theme.ember.name': '余烬',
  'theme.ember.hint': '榛黑 · 偏暖',
  'theme.paper.name': '纸张',
  'theme.paper.hint': '浅色 · 清爽',
  'swatch.groupChrome': '界面',
  'swatch.groupSignals': '语义',
  'swatch.bg': '底色',
  'swatch.panel': '面板',
  'swatch.panel2': '输入框',
  'swatch.stripe': '斑马行',
  'swatch.border': '边框',
  'swatch.line': '分隔线',
  'swatch.fg': '正文',
  'swatch.muted': '次要文字',
  'swatch.dim': '弱化文字',
  'swatch.accent': '强调色',

  'guide.title': '开始使用',
  'guide.dismiss': '收起',
  'guide.done': '已经上手了。',
  'guide.read': '看说明',
  'guide.close': '知道了',
  'guide.goThere': '带我去',
  'guide.step.language': '在{settings}里选界面语言',
  'guide.step.project': '在{manage}里新建一个项目',
  'guide.step.parentTask': '在这个项目下新建一个父任务',
  'guide.step.strictChild': '在父任务下挂一个严格子任务',
  'guide.step.endDate': '父任务的结束日期是怎么来的',
  'guide.step.log': '给严格子任务写一条任务日志',
  'guide.step.tour': '逛一圈：日志 · 管理 · 日历 · 设置',
  'guide.explain.language.title': '界面语言',
  'guide.explain.language.p1':
    '界面有 {langs} 三种。默认打开是 English —— 如果你不读英文，到设置里的「语言」换一下。换完立刻生效，这张卡片也会跟着变。',
  'guide.explain.language.skip': '先不用',
  'guide.explain.endDate.title': '父任务的结束日期是怎么来的',
  'guide.explain.endDate.p1':
    '父任务自己不排期 —— 它的结束日期由子任务决定，永远是所有子任务里最晚的那个。你刚挂上去的子任务结束得更晚，所以父任务刚刚挪出去跟上了它。',
  'guide.explain.endDate.p2':
    '这一点界面上就写着：打开父任务的编辑框，结束日期那一栏是灰的，鼠标停上去写着「由结束最晚的子任务决定」。你拖动任何一个子任务，父任务都会跟着走。进度同理 —— 父任务的进度是子任务进度的平均，所以它也不让你手填。',
  'guide.explain.strict.title': '严格与非严格：进度从哪来',
  'guide.explain.strict.p1': '差别在于这个数字从哪来，而不在于它怎么画。',
  'guide.explain.strict.p2':
    '普通任务看日历：窗口过去了多少比例，进度就是多少。还没开始的任务读 0%，窗口一结束就自己读满 100% —— 你什么都不用做，它也会动。',
  'guide.explain.strict.p3':
    '严格任务只认日志。一条日志都没有，它就一直是 0%，哪怕窗口早就过去了。有了日志之后，两种情况决定这个数字：最新一条日志填了目标进度，就以它为准；一条都没填，就按「写过日志的天数 ÷ 窗口总天数」累积 —— 所以漏掉一天，就是实打实地少一格。',
  'guide.explain.strict.p4':
    '这就是严格任务的意义：让进度如实反映你做了什么，而不是让日历替你干完。',
  'guide.explain.tour.title': '逛一圈',
  'guide.explain.tour.intro':
    '示例数据已经追加到你的看板上（你自己建的东西都还在），所以日志、管理和日历页都有东西可看了。四个页面各一句：',
  'guide.explain.tour.logs': '日志 —— 所有写过的内容按天汇总；严格任务的条目还带着目标进度。',
  'guide.explain.tour.manage':
    'Manage —— 整体概览：今天该做什么、接下来是什么、哪些逾期了，下面再按项目和任务分列。',
  'guide.explain.tour.calendar':
    '日历 —— 整月一屏。每格的深浅是当天严格任务的日志覆盖率，有里程碑或逾期任务的日子会标出来。',
  'guide.explain.tour.settings': '设置 —— 三种语言、四套配色，随时可切。',
}

const fr: Dict = {
  'app.title': 'WBS · Gantt — Contrôle de projet',

  'nav.gantt': 'Gantt',
  'nav.logs': 'Journaux',
  'nav.manage': 'Gestion',
  'nav.calendar': 'Calendrier',
  'nav.settings': 'Paramètres',
  'sidebar.projects': 'Projets',
  'sidebar.allProjects': 'Tous les projets',
  'sidebar.expandAll': 'Tout déplier',
  'sidebar.collapseAll': 'Tout replier',
  'sidebar.editProject': 'Modifier le projet',
  'sidebar.export': 'Exporter',
  'sidebar.exportTitle': 'Exporter en JSON',
  'sidebar.import': 'Importer',
  'sidebar.importTitle': 'Importer un JSON',
  'sidebar.importFailed': 'Échec de l’import : {message}',

  'common.none': '—',
  'common.tbd': 'À définir',
  'common.cancel': 'Annuler',
  'common.save': 'Enregistrer',
  'common.delete': 'Supprimer',
  'common.edit': 'Modifier',
  'common.close': 'Fermer',
  'common.ok': 'OK',
  'common.confirm': 'Confirmer',
  'common.confirmTitle': 'Confirmation',
  'common.noticeTitle': 'Information',
  'common.name': 'Nom',
  'common.date': 'Date',
  'common.type': 'Type',
  'common.project': 'Projet',
  'common.status': 'Statut',
  'common.priority': 'Priorité',
  'common.progress': 'Avancement',
  'common.description': 'Description',
  'common.noDescription': 'Aucune description.',
  'common.tags': 'Étiquettes',
  'common.tasks': 'Tâches',
  'common.task': 'Tâche',
  'common.start': 'Début',
  'common.end': 'Fin',
  'common.startDate': 'Date de début',
  'common.endDate': 'Date de fin',
  'common.history': 'Historique',
  'common.dependencies': 'Dépendances',
  'common.subtasks': 'Sous-tâches',
  'common.wbs': 'WBS',
  'common.prog': 'Avanc.',
  'common.expand': 'Déplier',
  'common.collapse': 'Replier',
  'common.select': 'Sélectionner',
  'common.deselect': 'Désélectionner',
  'common.selectAll': 'Tout sélectionner',
  'common.deselectAll': 'Tout désélectionner',
  'common.unknownTask': 'Tâche inconnue',
  'common.notes': 'Notes…',
  'common.targetProgress': 'Avancement visé : {percent} %',
  'common.taskCount': { one: '{count} tâche', other: '{count} tâches' },
  'common.logCount': { one: '{count} journal', other: '{count} journaux' },

  'status.todo': 'À faire',
  // "Non commencée" is the usual term and reads better, but it needs 90px in the
  // Gantt's 82px status cell and clips. "À démarrer" fits with room to spare, and
  // matches the wording of the to-do action ("Démarrer la tâche").
  'status.notStarted': 'À démarrer',
  'status.inProgress': 'En cours',
  'status.completed': 'Terminée',
  'status.paused': 'En pause',
  'status.delayed': 'En retard',
  'priority.low': 'Basse',
  'priority.medium': 'Moyenne',
  'priority.high': 'Haute',
  'priority.urgent': 'Urgente',
  'priority.title': 'Niveau de priorité : {level}',
  'type.phase': 'Phase',
  'type.longTerm': 'Long terme',

  'time.today': 'Aujourd’hui',
  'time.tomorrow': 'Demain',
  'time.yesterday': 'Hier',
  'time.inDays': { one: 'dans {count} jour', other: 'dans {count} jours' },
  'time.daysAgo': { one: 'il y a {count} jour', other: 'il y a {count} jours' },
  'time.week': 'S{count}',
  'time.quarter': 'T{count}',
  'time.monthYear': '{month} {year}',
  'time.quarterYear': 'T{count} {year}',
  'time.rangeSeparator': ' – ',

  'gantt.view.day': 'Jour',
  'gantt.view.week': 'Semaine',
  'gantt.view.month': 'Mois',
  'gantt.view.quarter': 'Trimestre',
  'gantt.view.year': 'Année',
  'gantt.backToToday': 'Revenir à aujourd’hui',
  'gantt.newTask': 'Nouvelle tâche',
  'gantt.deleteTask': 'Supprimer « {name} » ?',
  'gantt.deleteTaskWithSubtasks': 'Supprimer « {name} » et toutes ses sous-tâches ?',
  'gantt.deleteTodos': {
    one: 'Supprimer {count} tâche à faire ?',
    other: 'Supprimer {count} tâches à faire ?',
  },
  'gantt.deleteTodosWithSubtasks': {
    one: 'Supprimer {count} tâche à faire et ses sous-tâches ?',
    other: 'Supprimer {count} tâches à faire et leurs sous-tâches ?',
  },
  'gantt.ongoingTitle': '{wbs} {name} — en cours',
  'gantt.pickDate': 'Cliquez sur une date pour ouvrir le détail du jour',
  'gantt.writeLogForDay': 'Écrire un journal pour ce jour',
  'gantt.moveToTopLevel': 'Déplacer au niveau supérieur',

  'todo.folderName': 'À faire',
  'todo.folder': 'À faire ({count})',
  'todo.startTask': 'Démarrer la tâche',
  'todo.start': 'Démarrer',
  'todo.next': 'Suivant →',
  'todo.restoreMany': {
    one: 'Restaurer {count} tâche à faire',
    other: 'Restaurer {count} tâches à faire',
  },
  'todo.saveAll': 'Tout enregistrer ({count})',
  'todo.hasSubtasks':
    '{name} a des sous-tâches, ce sont donc elles qui décident de ses dates. Restaurez-les d’abord, ou fixez seulement une priorité ici et laissez les dates suivre.',
  'todo.restoreSelected': 'Restaurer les {count} sélectionnées',
  'todo.restoreAll': 'Restaurer tout ({count})',
  'todo.deleteSelected': 'Supprimer les {count} sélectionnées',
  'todo.deleteAll': 'Supprimer tout ({count})',

  'task.addSubtask': 'Ajouter une sous-tâche',
  'task.addSibling': 'Ajouter une tâche au même niveau',
  'task.new': 'Nouvelle tâche',
  'task.edit': 'Modifier la tâche',
  'task.namePlaceholder': 'Nom de la tâche',
  'task.parent': 'Parent',
  'task.topLevel': '— Niveau supérieur —',
  'task.createAsTodo': 'Créer comme tâche à faire — aucune date, priorité ni mode d’avancement',
  'task.todoNote':
    'Ceci est une tâche à faire : du travail non planifié. Elle se place en dernier parmi ses voisines, dans un dossier {toDos}, jusqu’à ce que vous lui donniez un planning avec {startTask} dans le panneau de détail.',
  'task.endDateLocked':
    'La date de fin est déterminée par la sous-tâche qui se termine le plus tard — modifiez plutôt la date de fin de cette sous-tâche.',
  'task.strictProgress': 'Avancement strict (l’avancement ne progresse que via les journaux quotidiens)',
  'task.overdueMark': 'Cette tâche est déjà en retard — la marquer comme',
  'task.tagsPlaceholder': 'étude, santé',
  'task.tagsLabel': 'Étiquettes (séparées par des virgules)',
  'task.subtaskCount': { one: '{count} sous-tâche', other: '{count} sous-tâches' },
  'task.hide': 'Masquer',
  'task.hidden': 'Masqué.',
  'task.noSubtasks': 'Aucune sous-tâche.',
  'task.progressMode': 'Mode d’avancement',
  'task.modeStrict': 'Strict (par journaux)',
  'task.modeAuto': 'Automatique (par dates)',
  'task.noSchedule':
    'Pas encore planifiée. Donnez-lui des dates, une priorité et un mode d’avancement au moment de la démarrer.',
  'task.pausedNote': {
    one: 'En pause. Débutée le {start} · mise en pause le {paused} · {count} jour écoulé.',
    other: 'En pause. Débutée le {start} · mise en pause le {paused} · {count} jours écoulés.',
  },
  'task.resume': 'Reprendre',
  'task.endPostponed': 'Fin (reportée)',
  'task.setAsTodo': 'Marquer comme à faire',
  'task.pause': 'Mettre en pause',
  'task.pauseHistory': 'Historique des pauses ({count})',
  'task.pauseEntry': 'En pause le {from} → reprise le {to}',
  'task.setAsTodoConfirm':
    'Marquer « {name} » comme tâche à faire ?\n\nSes dates, sa priorité et son avancement seront effacés.',
  'task.setAsTodoConfirmMany': {
    one: 'Marquer « {name} » et sa {count} sous-tâche inachevée comme tâches à faire ?\n\nLeurs dates, priorités et avancements seront effacés. Les sous-tâches terminées ne sont pas touchées.',
    other: 'Marquer « {name} » et ses {count} sous-tâches inachevées comme tâches à faire ?\n\nLeurs dates, priorités et avancements seront effacés. Les sous-tâches terminées ne sont pas touchées.',
  },
  'task.markedCompleted': 'Marquée comme terminée',

  'log.write': 'Écrire un journal',
  'log.edit': 'Modifier le journal',
  'log.label': 'Journal',
  'log.contentPlaceholder': 'Sur quoi avez-vous travaillé ?',
  'log.hint': 'Chaque ligne est un élément ; Tab l’indente en sous-élément, Maj+Tab le désindente.',
  'log.setTarget': 'Définir un avancement visé (facultatif)',
  'log.progressAfterDay': 'Avancement après ce jour',
  'log.targetPlaceholder': 'ex. 40',
  'logs.all': 'Tous les journaux',
  'logs.empty': 'Aucun journal pour l’instant.',
  'logs.moreTasks': { one: '+{count} autre tâche', other: '+{count} autres tâches' },
  'logs.dayFooter': '{logs} · {tasks}',

  'calendar.prevMonth': 'Mois précédent',
  'calendar.nextMonth': 'Mois suivant',
  'calendar.cellLabel': '{date} : {due}, {starting} ; {coverage}',
  'calendar.dueCount': { one: '{count} échéance', other: '{count} échéances' },
  'calendar.startingCount': { one: '{count} début', other: '{count} débuts' },
  'calendar.coverage.future': 'pas encore échu',
  'calendar.coverage.clear': 'aucune tâche stricte prévue',
  'calendar.coverage.partial': '{count} sur {total} tâches strictes journalisées',
  'calendar.coverage.full': 'les {count} tâches strictes journalisées',
  'calendar.more': '+{count} autres',
  'calendar.milestoneTitle': '{kind}{strict} — {name}{logged}',
  'calendar.milestone.due': 'Échéance',
  'calendar.milestone.starts': 'Début',
  'calendar.milestone.strict': ' · stricte',
  'calendar.milestone.logged': ' · journalisée ce jour',

  'day.strictLogs': 'Journaux stricts',
  'day.notYetDue': 'Pas encore échu',
  'day.noStrictScheduled': 'Aucun travail strict prévu',
  'day.allLogged': 'Tout le travail strict est journalisé',
  'day.nothingLogged': 'Rien de journalisé pour l’instant',
  'day.stillMissing': { one: '{count} encore manquant', other: '{count} encore manquants' },
  'day.noStrictTasksScheduled': 'Aucune tâche stricte prévue',
  'day.ringPartial': '{count} sur {total} tâches strictes journalisées',
  'day.taskCount': { one: '{count} tâche ce jour', other: '{count} tâches ce jour' },
  'day.strictTasks': 'Tâches strictes',
  'day.otherTasks': 'Autres tâches',
  'day.noStrictOnDay': 'Aucune tâche stricte prévue ce jour.',
  'day.nothingElse': 'Rien d’autre de prévu ce jour.',
  'day.readLogs': 'Lire les journaux du jour',
  'day.readLogsCount': 'Lire les journaux du jour ({count})',
  'day.noLog': 'Aucun journal',
  'day.noProgress': 'Aucun avancement',
  'day.viewTask': 'Voir la tâche →',

  'manage.overall': 'Vue d’ensemble',
  'manage.totalTasks': 'Tâches au total',
  'manage.leafTasks': { one: '{count} tâche feuille', other: '{count} tâches feuilles' },
  'manage.upcoming': 'À venir (7 jours)',
  'manage.overdue': 'En retard',
  'manage.newProject': 'Nouveau projet',
  'manage.projectNamePrompt': 'Nom du projet',
  'manage.deleteProject': 'Supprimer le projet « {name} » et toutes ses tâches ?',
  'manage.openInGantt': 'Ouvrir dans le Gantt →',
  'manage.comingSoon': 'Bientôt',
  'manage.allStatuses': 'Tous les statuts',
  'manage.filteredCount': {
    one: '{filtered} sur {count} tâche',
    other: '{filtered} sur {count} tâches',
  },
  'manage.empty': 'Rien pour l’instant.',
  'manage.sub.active': 'actifs',
  'manage.sub.tracked': 'suivis',
  'manage.sub.done': 'terminées',
  'manage.sub.paused': 'en pause',
  'manage.sub.startsIn7': 'démarre sous 7 jours',
  'manage.sub.pastDue': 'échéance dépassée',
  'manage.sub.pastDueDueSoon': 'échéance dépassée · {count} à échéance proche',
  'manage.sub.unscheduled': 'non planifiées',
  'manage.countCompleted': { one: '{count} terminée', other: '{count} terminées' },
  'manage.countOpen': { one: '{count} non terminée', other: '{count} non terminées' },

  'project.heading': 'Projet',
  'project.color': 'Couleur',
  'project.done': 'Terminées',
  'project.open': 'Non terminées',

  'settings.language': 'Langue',
  'settings.languageHint': 'La langue de l’interface.',
  'settings.theme': 'Thème',
  'settings.themeHint': 'Un jeu de couleurs complet — surfaces, texte et couleurs porteuses de sens.',
  'settings.themeNote':
    'Le vert signifie terminé et le rouge en retard dans tous les thèmes ; les palettes diffèrent par leurs surfaces et leur accent, si bien qu’un statut garde son sens quel que soit votre choix.',
  'settings.active': 'Actuel',
  'theme.graphite.name': 'Graphite',
  'theme.graphite.hint': 'Presque noir, neutre',
  'theme.slate.name': 'Ardoise',
  'theme.slate.hint': 'Gris-bleu moyen, froid',
  'theme.ember.name': 'Braise',
  'theme.ember.hint': 'Noir noisette, chaud',
  'theme.paper.name': 'Papier',
  'theme.paper.hint': 'Clair, net',
  'swatch.groupChrome': 'Interface',
  'swatch.groupSignals': 'Signification',
  'swatch.bg': 'Fond',
  'swatch.panel': 'Panneau',
  'swatch.panel2': 'Champ',
  'swatch.stripe': 'Ligne alt.',
  'swatch.border': 'Bordure',
  'swatch.line': 'Séparateur',
  'swatch.fg': 'Texte',
  'swatch.muted': 'Texte secondaire',
  'swatch.dim': 'Texte estompé',
  'swatch.accent': 'Accent',

  'guide.title': 'Premiers pas',
  'guide.dismiss': 'Masquer',
  'guide.done': 'Vous voilà paré.',
  'guide.read': 'Lire l’explication',
  'guide.close': 'Compris',
  'guide.goThere': 'M’y emmener',
  'guide.step.language': 'Choisir la langue dans {settings}',
  'guide.step.project': 'Créer un projet dans {manage}',
  'guide.step.parentTask': 'Ajouter une tâche parente dedans',
  'guide.step.strictChild': 'Rattacher une sous-tâche stricte à cette tâche',
  'guide.step.endDate': 'D’où vient la date de fin d’une tâche parente',
  'guide.step.log': 'Écrire un journal sur la sous-tâche stricte',
  'guide.step.tour': 'Un tour : Journaux · Gestion · Calendrier · Paramètres',
  'guide.explain.language.title': 'Langue de l’interface',
  'guide.explain.language.p1':
    'L’interface existe en {langs}. Elle s’ouvre en anglais — si ce n’est pas votre langue, changez-la dans Paramètres, à la rubrique Langue. Tout suit aussitôt, cette carte comprise.',
  'guide.explain.language.skip': 'Plus tard',
  'guide.explain.endDate.title': 'D’où vient la date de fin d’une tâche parente',
  'guide.explain.endDate.p1':
    'Une tâche parente ne porte pas de planning à elle : sa date de fin est déterminée par ses sous-tâches, et c’est toujours la plus tardive d’entre elles. La sous-tâche que vous venez d’ajouter se termine après la fin du parent, qui vient donc de s’allonger pour la rejoindre.',
  'guide.explain.endDate.p2':
    'L’interface le dit elle-même : ouvrez le parent en édition et le champ de date de fin est grisé, avec « déterminée par la sous-tâche qui se termine le plus tard » au survol. Déplacez une sous-tâche et le parent suit. Son avancement fonctionne de même — la moyenne de celui de ses sous-tâches — et c’est pourquoi il ne vous laisse pas non plus le saisir.',
  'guide.explain.strict.title': 'Stricte ou non : d’où vient l’avancement',
  'guide.explain.strict.p1': 'La différence tient à l’origine du nombre, pas à sa représentation.',
  'guide.explain.strict.p2':
    'Une tâche ordinaire suit le calendrier : la part écoulée de sa fenêtre est son avancement. Une tâche qui n’a pas commencé affiche 0 %, et une fenêtre refermée affiche 100 % d’elle-même — vous n’avez rien à faire pour qu’elle bouge.',
  'guide.explain.strict.p3':
    'Une tâche stricte ne compte que les journaux. Sans aucun journal, elle reste à 0 %, longtemps après la fermeture de sa fenêtre. Dès qu’il y en a, deux choses décident du nombre : le dernier journal portant un avancement cible fait foi ; si aucun n’en porte, l’avancement s’accumule en jours journalisés ÷ jours de la fenêtre — un jour sauté est donc un jour réellement perdu.',
  'guide.explain.strict.p4':
    'C’est là l’objet d’une tâche stricte : un avancement qui dit ce que vous avez réellement fait, au lieu de laisser le calendrier terminer le travail à votre place.',
  'guide.explain.tour.title': 'Un tour rapide',
  'guide.explain.tour.intro':
    'Le tableau d’exemple a été ajouté à côté de votre propre travail, si bien que Journaux, Gestion et Calendrier ont désormais de quoi montrer. Une ligne pour chacun :',
  'guide.explain.tour.logs':
    'Journaux — tout ce qui a été écrit, rassemblé par jour ; les entrées d’une tâche stricte portent aussi leur avancement cible.',
  'guide.explain.tour.manage':
    'Gestion — la vue d’ensemble : ce qui est au programme aujourd’hui, ce qui arrive, ce qui a glissé, puis les projets et les tâches détaillés en dessous.',
  'guide.explain.tour.calendar':
    'Calendrier — le mois d’un coup d’œil. La nuance d’une case indique la part du travail strict journalisée ce jour-là, et les jours portant un jalon ou du retard sont signalés.',
  'guide.explain.tour.settings':
    'Paramètres — trois langues et quatre jeux de couleurs, à changer quand vous voulez.',
}

const DICTS: Record<Lang, Dict> = { en, zh, fr }

/** A dictionary entry: either one string, or the two plural forms. */
export type Entry = string | { one: string; other: string }

export type Params = Record<string, string | number>

// Built once per language rather than once per lookup: `buildTimeline` labels
// every cell on every render of the Gantt header.
const PLURALS: Record<Lang, Intl.PluralRules> = {
  en: new Intl.PluralRules('en'),
  zh: new Intl.PluralRules('zh'),
  fr: new Intl.PluralRules('fr'),
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

/**
 * Look up `key` in `lang`, resolving plurals against `params.count`.
 *
 * `?? entry.other` is not defensive padding: CLDR has a `many` category for
 * French, and `select()` can return it for large magnitudes. Indexing the entry
 * with that name would render `undefined` into the interface.
 */
export function translate(lang: Lang, key: keyof Dict, params?: Params): string {
  const entry: Entry = DICTS[lang][key] ?? en[key]
  if (typeof entry === 'string') return interpolate(entry, params)
  const count = Number(params?.count ?? 1)
  const form = PLURALS[lang].select(count) as 'one' | 'other'
  return interpolate(entry[form] ?? entry.other, params)
}

/**
 * The unresolved template for `key`, placeholders and all.
 *
 * For the two sentences that wrap part of themselves in styled markup — a task
 * name, a folder name — where substituting plain strings would lose the
 * emphasis. Callers split on the placeholders and interleave real elements; see
 * `useTRich` in `lib/useT.ts`. Everything else should use `translate`.
 */
export function template(lang: Lang, key: keyof Dict): string {
  const entry: Entry = DICTS[lang][key] ?? en[key]
  return typeof entry === 'string' ? entry : entry.other
}

/**
 * Point the document at a language.
 *
 * The `lang` attribute is not decoration: it selects the CJK font stack and
 * tells a screen reader how to pronounce the page. The title lives outside React
 * but is still part of the interface, so it is set from the dictionary too.
 */
export function applyLang(lang: Lang): void {
  document.documentElement.lang = lang
  document.title = translate(lang, 'app.title')
}

/* ------------------------------------------------------------------ *
 * Dates
 *
 * Names, and the order they go in. `Aug 13` / `13 août` / `8月13日` is not a
 * word-for-word substitution — the date's parts are re-sequenced and its
 * separators change — so each format is written out per language rather than
 * assembled from a shared template.
 * ------------------------------------------------------------------ */

const MONTHS: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  // French month abbreviations take a full stop; the longer ones are not
  // abbreviated at all, which is why this list is not a uniform length.
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
}

const MONTHS_ABBR: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  zh: MONTHS.zh,
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
}

/** Sunday-first, to index directly with `Date.getDay()`. */
const WEEKDAYS: Record<Lang, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  fr: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
}

function weekdayMonFirst(lang: Lang): string[] {
  const w = WEEKDAYS[lang]
  return [w[1], w[2], w[3], w[4], w[5], w[6], w[0]]
}

/** The month names themselves, for callers that index by month. */
export function monthName(lang: Lang, month: number): string {
  return MONTHS[lang][month]
}

/** The abbreviated month name, for a timeline column narrow enough to need it. */
export function monthAbbr(lang: Lang, month: number): string {
  return MONTHS_ABBR[lang][month]
}

/** A weekday name, indexed the way `Date.getDay()` is: Sunday is 0. */
export function weekdayName(lang: Lang, weekday: number): string {
  return WEEKDAYS[lang][weekday]
}

/** `4 janv.` — for a table cell or a panel field, where space is tight. */
export function formatShortDate(lang: Lang, date: Date): string {
  const month = MONTHS_ABBR[lang][date.getMonth()]
  if (lang === 'zh') return `${month}${date.getDate()}日`
  if (lang === 'fr') return `${date.getDate()} ${month}`
  return `${month} ${date.getDate()}`
}

/**
 * With the year but without the weekday — for the detail panel's start and end
 * fields, where the year is part of the fact and the weekday is noise.
 */
export function formatDayMonthYear(lang: Lang, date: Date): string {
  const month = MONTHS_ABBR[lang][date.getMonth()]
  const year = date.getFullYear()
  if (lang === 'zh') return `${year}年${MONTHS.zh[date.getMonth()]}${date.getDate()}日`
  if (lang === 'fr') return `${date.getDate()} ${month} ${year}`
  return `${month} ${date.getDate()}, ${year}`
}

/** The long form, for a panel header or a modal title. */
export function formatLongDate(lang: Lang, date: Date): string {
  const month = MONTHS[lang][date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  if (lang === 'zh') return `${year}年${month}${day}日 ${WEEKDAYS.zh[date.getDay()]}`
  if (lang === 'fr') return `${WEEKDAYS.fr[date.getDay()]} ${day} ${month} ${year}`
  return `${WEEKDAYS.en[date.getDay()]}, ${MONTHS_ABBR.en[date.getMonth()]} ${day}, ${year}`
}

/**
 * `Aug 13 – Dec 21, 2026`. The end is inclusive, and the year is stated once
 * when both ends share it.
 */
export function formatDateRange(lang: Lang, start: Date, endInclusive: Date): string {
  const sep = translate(lang, 'time.rangeSeparator')
  if (lang === 'zh') {
    const left = `${start.getFullYear()}年${MONTHS.zh[start.getMonth()]}${start.getDate()}日`
    const right = start.getFullYear() === endInclusive.getFullYear()
      ? `${MONTHS.zh[endInclusive.getMonth()]}${endInclusive.getDate()}日`
      : `${endInclusive.getFullYear()}年${MONTHS.zh[endInclusive.getMonth()]}${endInclusive.getDate()}日`
    return `${left}${sep}${right}`
  }
  const left = formatShortDate(lang, start)
  const right = formatShortDate(lang, endInclusive)
  return start.getFullYear() === endInclusive.getFullYear()
    ? `${left}${sep}${right}, ${endInclusive.getFullYear()}`
    : `${left}, ${start.getFullYear()}${sep}${right}, ${endInclusive.getFullYear()}`
}

/** A whole week's span, for the Gantt header's group row. */
export function formatWeekRange(lang: Lang, monday: Date, sunday: Date): string {
  const sep = translate(lang, 'time.rangeSeparator')
  if (lang === 'zh') {
    const left = `${MONTHS.zh[monday.getMonth()]}${monday.getDate()}日`
    const right = `${MONTHS.zh[sunday.getMonth()]}${sunday.getDate()}日`
    return monday.getFullYear() === sunday.getFullYear()
      ? `${left}${sep}${right}`
      : `${monday.getFullYear()}年${left}${sep}${sunday.getFullYear()}年${right}`
  }
  // A week straddling 1 January states both years, as it does in English already.
  if (monday.getFullYear() !== sunday.getFullYear()) {
    return `${formatShortDate(lang, monday)}, ${monday.getFullYear()}${sep}${formatShortDate(lang, sunday)}, ${sunday.getFullYear()}`
  }
  // French elides the repeated month: `10 – 16 août`, not `10 août – 16 août`.
  if (lang === 'fr' && monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()}${sep}${formatShortDate(lang, sunday)}`
  }
  return `${formatShortDate(lang, monday)}${sep}${formatShortDate(lang, sunday)}`
}

/** `August 2026`, `2026年8月`, `août 2026`. */
export function formatMonthGroup(lang: Lang, date: Date): string {
  return translate(lang, 'time.monthYear', {
    month: MONTHS[lang][date.getMonth()],
    year: date.getFullYear(),
  })
}

/** `Q3 2026`, `2026年第3季度`, `T3 2026`. */
export function formatQuarterGroup(lang: Lang, date: Date): string {
  return translate(lang, 'time.quarterYear', {
    count: Math.floor(date.getMonth() / 3) + 1,
    year: date.getFullYear(),
  })
}

/** `W34`, `34周`, `S34`. */
export function formatWeekLabel(lang: Lang, week: number): string {
  return translate(lang, 'time.week', { count: week })
}

/** `Q3`, `3季度`, `T3`. */
export function formatQuarterLabel(lang: Lang, quarter: number): string {
  return translate(lang, 'time.quarter', { count: quarter })
}

/**
 * `Today` / `2 days ago`, for a panel heading.
 *
 * `days` is signed: positive is in the future.
 */
export function formatRelativeDay(lang: Lang, days: number): string {
  if (days === 0) return translate(lang, 'time.today')
  if (days === 1) return translate(lang, 'time.tomorrow')
  if (days === -1) return translate(lang, 'time.yesterday')
  return days > 0
    ? translate(lang, 'time.inDays', { count: days })
    : translate(lang, 'time.daysAgo', { count: -days })
}

export { weekdayMonFirst as weekdayLabels }

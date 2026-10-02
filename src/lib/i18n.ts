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
 */
export const DEFAULT_LANG: Lang = 'zh'

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
  'nav.logs': 'Logs / Notes',
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
  'common.view': 'View',
  'common.close': 'Close',
  'common.ok': 'OK',
  // Acknowledging an explanation, which is a different act from confirming a
  // question — and this one is remembered, so it says so.
  'common.gotIt': 'Got it',
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
  'common.wbs': 'WBS',
  'common.prog': 'Prog',
  'common.expand': 'Expand',
  'common.collapse': 'Collapse',
  'common.select': 'Select',
  'common.deselect': 'Deselect',
  /** Between the names in a list read out in running text. */
  'common.listSeparator': ', ',
  /** Between a chain of ancestors and the name it qualifies — see `nameQualifiers`. */
  'common.pathSeparator': ' › ',
  'common.unknownTask': 'Unknown task',
  'common.notes': 'Notes…',
  'common.targetProgress': 'Target progress: {percent}%',
  'common.taskCount': { one: '{count} task', other: '{count} tasks' },
  'common.logCount': { one: '{count} log', other: '{count} logs' },
  'common.noteCount': { one: '{count} note', other: '{count} notes' },

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
  'priority.top': 'Top',
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
  // Shown in place of the task dialog when the board has no project yet. A task
  // has to live in one, so the dialog's project picker would have nothing to
  // offer and a saved task would be a row nothing can place.
  'gantt.noProject': 'A task has to live in a project — create one first, in {manage}, on the left sidebar.',
  // The same dialog's two explainer paragraphs: what the tree is, and what a
  // project is for.
  'gantt.noProject.p1':
    'WBS-gantt manages projects and tasks much the way an operating system manages files — a directory tree. A project is the root directory at the very top, and every task filed under one is a file or a folder. A file has to live under a root, so a task needs a project chosen for it before it can be created. I do recommend reading the network of tasks you are about to build this way, because… that is how the software is designed.',
  'gantt.noProject.p2':
    'Beyond giving a task somewhere to exist, a project is only a label for sorting. Read it as the “topic” of the tasks created under it: it gives them a category, so that they can be managed by category — which is the other reason to file your tasks under projects.',
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
  // "Organize" rather than "Manage tasks": `nav.manage` is already "Manage", and
  // two entries a word apart in the same language would read as the same place.
  'gantt.manageTasks': 'Organize',
  'gantt.editDone': 'Done',
  'gantt.editMode': 'Editing',
  'gantt.selected': { one: '{count} selected', other: '{count} selected' },
  'gantt.clearSelection': 'Clear selection',
  'gantt.setTodoMany': {
    one: 'Mark {count} task as to-do?\n\nIts dates, priority and progress are cleared.',
    other: 'Mark {count} tasks as to-do?\n\nTheir dates, priorities and progress are cleared.',
  },
  'gantt.setTodoManyWithSubtasks': {
    one:
      'Mark {count} task and its {subs} unfinished subtask as to-do?\n\n' +
      'Their dates, priorities and progress are cleared. Completed subtasks are left untouched.',
    other:
      'Mark {count} tasks and their {subs} unfinished subtasks as to-do?\n\n' +
      'Their dates, priorities and progress are cleared. Completed subtasks are left untouched.',
  },
  'gantt.deleteSelected': {
    one: 'Delete {count} task?',
    other: 'Delete {count} tasks?',
  },
  'gantt.deleteSelectedWithSubtasks': {
    one: 'Delete {count} task and its subtasks?',
    other: 'Delete {count} tasks and their subtasks?',
  },
  'gantt.pauseMany': {
    one: 'Pause {count} task?',
    other: 'Pause {count} tasks?',
  },
  'gantt.resumeMany': {
    one: 'Resume {count} task?',
    other: 'Resume {count} tasks?',
  },
  'gantt.archiveMany': {
    one: 'Archive {count} task?',
    other: 'Archive {count} tasks?',
  },
  'gantt.archiveManyWithSubtasks': {
    one: 'Archive {count} task? Its subtasks are filed away with it.',
    other: 'Archive {count} tasks? Their subtasks are filed away with them.',
  },
  'gantt.dragMany': { one: '{count} task', other: '{count} tasks' },
  // The pill that follows the pointer. `{what}` is the dragged task's own name,
  // or the `gantt.dragMany` phrase when several are on the move.
  'gantt.moved': 'Moved {what}',
  // The strip under the board: what the step just did, and the way back. One
  // phrase per action, because "Undo" alone says what will happen but not what
  // is being offered — and the offer expires in ten seconds.
  'gantt.undoTodo': 'Marked {what} as to-do',
  'gantt.undoStart': 'Started {what}',
  'gantt.undoPause': 'Paused {what}',
  'gantt.undoResume': 'Resumed {what}',
  'gantt.undoDelete': 'Deleted {what}',
  'gantt.undoArchive': 'Archived {what}',
  'gantt.undoUnarchive': 'Brought back {what}',
  'gantt.undo': 'Undo',
  // The seconds left on the offer, beside the button. Two digits always (`{seconds}`
  // arrives padded), so the strip does not twitch as it counts down.
  'gantt.undoSeconds': '({seconds})',

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
  'todo.renameFolder': 'Name this folder',
  'todo.folderPlaceholder': 'Folder name',
  'todo.restoreAll': 'Restore all {count}',
  'todo.deleteAll': 'Delete all {count}',

  // --- archive ---
  'archive.title': 'Archived ({count})',
  'archive.badge': 'Archived',
  'archive.restoreAll': 'Unarchive all {count}',
  'archive.empty': 'Nothing archived yet.',

  // --- tasks ---
  'task.addSubtask': 'Add subtask',
  'task.addSibling': 'Add sibling task',
  'task.new': 'New task',
  'task.edit': 'Edit task',
  'task.namePlaceholder': 'Task name',
  'task.parent': 'Parent',
  'task.topLevel': '— Top level —',
  'task.createAsTodo': 'Create as to-do',
  'task.todoNote':
    'This is a to-do: unscheduled work. It sits last among its siblings inside a {toDos} folder until you give it a schedule with {startTask} in the detail panel.',
  'task.endDateLocked':
    'The end date is decided by the subtask that ends last — change that subtask’s end date instead.',
  'task.startDateLocked':
    'The start date is decided by the subtask that starts first — change that subtask’s start date instead.',
  'task.strictProgress': 'Turn off daily logs (not recommended)',
  'task.overdueMark': 'This task is already overdue — mark as',
  'task.tagsPlaceholder': 'study, health',
  'task.tagsLabel': 'Tags (comma separated)',
  'task.subtaskCount': { one: '{count} subtask', other: '{count} subtasks' },
  'task.hide': 'Hide',
  'task.hidden': 'Hidden.',
  'task.tree': 'Task tree',
  'task.treeFocus': 'Show one branch',
  // The parent's reminder. Names only — what is missing, not what was written.
  'task.pendingLogs': 'Still to log',
  'task.progressMode': 'Progress mode',
  'task.modeStrict': 'Log-based',
  'task.modeAuto': 'Simplified (ticked per day)',
  // A parent's progress is the average of its children's, so neither of the two
  // above applies to it — see `isStrictLeaf`.
  'task.modeRolledUp': 'From subtasks',

  // The dialog that stands between the checkbox and a task that stops owing
  // logs. Written in the emphasis markup `lib/emphasis.ts` parses — asterisks
  // for bold, slashes for size, the count of slashes being the degree.
  'optOut.title': 'Go without log supervision?',
  'optOut.p1':
    'Without the log system this task will *keep no history at all*, and the Logs page will not manage it.',
  'optOut.p2':
    'It will use a *deliberately crude* way of counting progress: each day you only have to *click a button by hand* to confirm you did it, and the system then accumulates progress as elapsed days ÷ total days. No click, no accumulation. If you miss a day, later daily reports will remind you, and you can leave it for now or put the confirmation in — which is one more click.',
  'optOut.p3':
    'This also means the task */may not reflect its real progress*/, and the supervision over whether you did a given day’s work is */close to zero*/. **//Please make sure you have enough self-discipline to go without the log system’s supervision**//.',
  'optOut.back': 'Back',
  'optOut.confirm': 'Turn logs off anyway',

  // The tick that stands in for a log on a simplified task.
  'day.tick': 'Mark this day as done',
  'task.pausedNote': {
    one: 'Paused. Started {start} · paused on {paused} · {count} day elapsed.',
    other: 'Paused. Started {start} · paused on {paused} · {count} days elapsed.',
  },
  'task.resume': 'Resume',
  'task.endPostponed': 'End (postponed)',
  'task.setAsTodo': 'Set as to-do',
  // Archiving. The confirmation says two things the press itself does not show:
  // that the number is given up, and where the row can be found again — a
  // reversible action with no visible way back reads as a destructive one.
  'task.pauseConfirm': 'Pause "{name}"?',
  'task.resumeConfirm': 'Resume "{name}"?',
  'task.archive': 'Archive',
  'task.unarchive': 'Unarchive',
  'task.archiveConfirm': 'Archive "{name}"?',
  'task.archiveWithSubtasks': {
    one: 'Archive "{name}"? Its subtasks are filed away with it.',
    other: 'Archive "{name}"? Its subtasks are filed away with it.',
  },
  'task.pause': 'Pause task',
  'task.pauseHistory': 'Pause history ({count})',
  'task.pauseEntry': 'Paused {from} → resumed {to}',
  'task.heat.title': 'Completion',
  'task.heat.done': 'Done',
  'task.heat.pending': 'Not done',
  'task.heat.none': 'Not scheduled',
  'task.heat.count': { one: '{count} task done', other: '{count} tasks done' },
  'task.heat.less': 'Less',
  'task.heat.more': 'More',
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
  'log.editedAt': 'edited {time}',
  'log.hint': 'Each line is an item; Tab indents a sub-item, Shift+Tab outdents.',
  'log.progressAdd': 'Progress added (%)',
  'log.progressAfterDay': 'Progress becomes (%)',
  'log.currentProgress': 'Currently at {percent}%',
  'log.byDays': 'Advance one day',
  'log.byDaysHint': 'Advance one day = add (1 ÷ total days) × 100% of the progress. If less than a fifth of a day’s share is left after that, the task is taken as complete.',
  'log.progressRequired': 'Fill in at least one of the two — put 0 under “{add}” if nothing moved.',
  'log.progressBackward': 'Progress cannot go backwards — that lands below the figure it started the day at.',
  // Writing on a task that has subtasks: the label above the picker, and the
  // save button while more are still owed.
  'log.task': 'Task',
  'logs.all': 'All logs',
  'logs.empty': 'No logs yet.',
  'logs.moreTasks': { one: '+{count} more task', other: '+{count} more tasks' },
  // The switcher's first half. `nav.logs` cannot serve here — it now names both.
  'logs.tabLogs': 'Logs',

  // --- notes ---
  // The Logs page holds two kinds of entry; these name the second one, which is
  // written and never ticked off.
  'notes.title': 'Notes',
  'notes.empty': 'Nothing written yet.',
  'notes.add': 'Write something',
  'notes.placeholder': 'Whatever you want to keep.',
  // The notebook's own empty state, worded like the other day sections' ("none
  // on this day") rather than as an invitation: the invitation is the Edit
  // button beside it, and two ways of saying "write here" is one too many.
  'notes.none': 'None yet.',

  // --- calendar ---
  'calendar.prevMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.cellLabel': '{date}: {due}, {starting}; {coverage}',
  'calendar.dueCount': { one: '{count} due', other: '{count} due' },
  'calendar.startingCount': { one: '{count} starting', other: '{count} starting' },
  'calendar.coverage.future': 'not yet due',
  'calendar.coverage.clear': 'no logs due',
  'calendar.coverage.partial': '{count} of {total} logs written',
  'calendar.coverage.full': 'all {count} logs written',
  'calendar.more': '+{count} more',
  'calendar.milestoneTitle': '{kind}{strict} — {name}{logged}',
  'calendar.milestone.due': 'Due',
  'calendar.milestone.starts': 'Starts',
  'calendar.milestone.strict': ' *',
  'calendar.milestone.logged': ' · logged this day',

  // --- day detail ---
  //
  // Nothing in here calls a task "strict" any more. The division the interface
  // shows is not between two kinds of task — it is between the tasks that owe a
  // log and the rest, and that is said with a `*` on the row plus the one line
  // of legend under the list (`day.logMark`), not by naming the kind.
  'day.strictLogs': 'Logs',
  'day.notYetDue': 'Not yet due',
  'day.noStrictScheduled': 'No logs due',
  'day.allLogged': 'Everything logged',
  'day.nothingLogged': 'Nothing logged yet',
  'day.stillMissing': { one: '{count} still missing', other: '{count} still missing' },
  'day.noStrictTasksScheduled': 'No logs due',
  'day.ringPartial': '{count} of {total} logs written',
  'day.taskCount': { one: '{count} task on this day', other: '{count} tasks on this day' },
  'day.tasksBreakdown': '{strict} with logs · {other} other',
  'day.taskList': 'Tasks',
  'day.nothingScheduled': 'Nothing scheduled on this day.',
  'day.logMark': 'A * marks a task that owes a daily log.',
  'day.readLogs': 'Read this day’s logs',
  'day.readLogsCount': 'Read this day’s logs ({count})',
  'day.noProgress': 'No progress',
  'day.belongsTo': 'in',
  'day.parentPath': 'Show the whole path',
  'day.viewTask': 'View task →',

  // --- chores (the Today page) ---
  // The nav entry reuses `time.today` rather than getting a key of its own: it
  // says the same word meaning the same thing, and a second key would only be a
  // second place for the three languages to drift apart.
  'chore.section': 'Chores',
  'chore.placeholder': 'Add a chore…',
  'chore.emptyToday': 'Nothing on hand today.',
  'chore.emptyTomorrow': 'Nothing lined up for tomorrow.',
  'chore.noneOnDay': 'No chores on this day.',
  'chore.stillOpen': { one: '{count} still open', other: '{count} still open' },
  'chore.allDone': 'All done',
  'chore.edit': 'Edit chore',
  'chore.title': 'Chore',
  'chore.note': 'Note',
  'chore.notePlaceholder': 'Optional',
  'chore.day': 'Day',
  'chore.carriedTitle': 'Meant for {date}',

  'habit.section': 'Routine',
  'habit.none': 'Nothing daily yet.',
  'habit.edit': 'Edit daily item',
  'habit.title': 'Item',
  'habit.deleteAsk': 'Delete "{name}"? Every day you ticked it goes with it.',
  'habit.new': 'New routine',
  'habit.note': 'Note',
  'habit.notePlaceholder': 'Optional',
  'habit.weekdays': 'Days',
  'habit.everyDay': 'Every day',
  'habit.endDate': 'Ends',
  'habit.noEndDate': 'Leave empty to keep going.',
  'habit.paused': 'Suspended',

  // --- manage ---
  'manage.overall': 'Overall',
  'manage.heat': 'Completion heatmap',
  'manage.subtasks': 'Subtasks',
  'manage.parentTasks': { one: '{count} parent task', other: '{count} parent tasks' },
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
  'manage.sub.tracked': 'in total',
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
  'settings.version': 'Version',
  'settings.versionHint': 'The desktop app checks for updates on every launch.',

  // --- reminders ---
  'settings.reminder': 'Reminders',
  'settings.reminderWebNote':
    'Reminders are sent by the desktop app — it is the only build that can post to PushPlus. In a browser there is nothing here to set up.',
  'settings.reminderOn':
    'Desktop notifications are on by default. Keep WBS Gantt running in the background.',
  'settings.reminderWechat': 'Sync notifications to personal WeChat',
  'settings.reminderTime': 'Send at',
  'settings.reminderToken': 'PushPlus token',
  'settings.reminderPushplusNote':
    'WBS Gantt relies on PushPlus to sync notifications to WeChat.\nActivating that route means paying PushPlus ¥3.50 for real-name verification, so skipping it is entirely reasonable.',
  'settings.reminderTokenHint':
    'Sign in at pushplus.plus and paste the token from the top of the page here.',
  'settings.reminderOpen': 'Open pushplus.plus',
  'settings.reminderTest': 'Send a test',
  'settings.reminderPreview': 'Preview noon’s',
  'settings.reminderSending': 'Sending…',
  'settings.reminderSent': 'Sent.',
  'settings.backgroundAppOnly':
    'Without it, reminders only go out while this window happens to be open.',
  'settings.autostart': 'Start with Windows',
  'settings.closeToTray': 'Minimize to tray on close',

  'tray.open': 'Open WBS Gantt',
  'tray.quit': 'Quit',
  'reminder.greeting.dawn': 'Still up',
  'reminder.greeting.early': 'Good morning',
  'reminder.greeting.morning': 'Good morning',
  'reminder.greeting.noon': 'Midday',
  'reminder.greeting.afternoon': 'Good afternoon',
  'reminder.greeting.dusk': 'End of the day',
  'reminder.greeting.evening': 'Good evening',
  'reminder.greeting.night': 'Late night',
  'reminder.closing.dawn': '',
  'reminder.closing.early': '',
  'reminder.closing.morning': '',
  'reminder.closing.noon': '',
  'reminder.closing.afternoon': '',
  'reminder.closing.dusk': '',
  'reminder.closing.evening': '',
  'reminder.closing.night': '',
  'reminder.starting': 'Starting today',
  'reminder.dueSoon': 'Coming up',
  'reminder.reportTitle': 'Daily report',
  'reminder.reportEmpty': 'Nothing outstanding today.',
  'reminder.reportYesterday': 'Yesterday',
  'reminder.reportToday': 'Today',
  'reminder.reportRate': 'Completion',
  'reminder.groupTasks': 'Tasks',
  'reminder.groupDeadlines': 'Due & overdue',
  'reminder.testTitle': 'WBS Gantt — test message',
  'reminder.testBody': 'If you are reading this in WeChat, reminders are working.',
  'reminder.nudgeLogs': 'Remember to write logs for the tasks you have finished.',
  'reminder.nudgeDebt': '{count} waiting on you —',
  'reminder.nudgeDebtLine': '- {count} {label}',
  'reminder.nudgeTasks': 'tasks',
  'reminder.ack': 'Got it',
  'slot.early': 'Morning',
  'slot.noon': 'Noon',
  'slot.dusk': 'Evening',
  'reminder.overdue': 'Overdue',
  'reminder.dueToday': 'Due today',
  'reminder.logsOwed': 'Logs owed',
  'reminder.chores': 'Chores',
  'reminder.habits': 'Routine',

  'update.check': 'Check for updates',
  'update.checking': 'Checking…',
  'update.upToDate': 'You are on the latest version.',
  'update.availableShort': 'An update is available.',
  'update.unreachable': 'Automatic updates are unavailable because GitHub cannot be reached.',
  'update.webNote': 'Automatic updates apply to the desktop app. In a browser you always load the latest build.',
  'update.availableTitle': 'Update available',
  'update.availableBody': 'Version {version} has been released. You are on {current}.',
  'update.notes': 'Release notes',
  'update.history': 'Older releases this update brings along ({count})',
  'update.noNotes': 'This release came with no release notes.',
  'update.downloadAndInstall': 'Download and install',
  'update.installing': 'Downloading…',
  'update.installFailed': 'The update could not be installed: {message}',
  'update.later': 'Later',
  'update.snooze': 'Ignore for {days} days',
  'update.nagTitle': 'It has been a while',
  'update.nagBody':
    'It has been over a month since this app last reached GitHub. Take a look for bug fixes and new features?',
  'update.nagGo': 'Go to Settings',
  'update.connectTitle': 'Want a stable GitHub connection?',
  'update.connectBody':
    'Watt Toolkit (formerly Steam++) is a free, open-source network accelerator. It speeds up both the GitHub website and Release downloads.',
  'update.connectLink': 'Download from steampp.net',
  'update.opensource':
    'GitHub is the largest home of open-source software — operating systems, frameworks, ready-made tools, most of it free to use, study and build on. This project’s source and releases live there too.',
  'update.openRepo': 'View on GitHub',
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
}

export type Dict = typeof en

const zh: Dict = {
  'app.title': 'WBS · Gantt —— 项目管控',

  'nav.gantt': '甘特图',
  'nav.logs': '日志 / 记事本',
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
  'common.view': '查看',
  'common.close': '关闭',
  'common.ok': '确定',
  'common.gotIt': '我知道了',
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
  'common.wbs': 'WBS',
  'common.prog': '进度',
  'common.expand': '展开',
  'common.collapse': '折叠',
  'common.select': '选择',
  'common.deselect': '取消选择',
  'common.listSeparator': '、',
  'common.pathSeparator': ' › ',
  'common.unknownTask': '未知任务',
  'common.notes': '备注…',
  'common.targetProgress': '目标进度：{percent}%',
  'common.taskCount': { one: '{count} 项任务', other: '{count} 项任务' },
  'common.logCount': { one: '{count} 条日志', other: '{count} 条日志' },
  'common.noteCount': { one: '{count} 条笔记', other: '{count} 条笔记' },

  'status.todo': '待办',
  'status.notStarted': '未开始',
  'status.inProgress': '进行中',
  'status.completed': '已完成',
  'status.paused': '已暂停',
  'status.delayed': '已逾期',
  'priority.low': '低',
  'priority.medium': '中',
  'priority.high': '高',
  'priority.top': '最高',
  'priority.title': '{level}优先级',
  'type.phase': '阶段性任务',
  'type.longTerm': '长期任务',

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
  'gantt.noProject': '任务要放在项目里 —— 请先在左侧导航栏「{manage}」中新建一个项目。',
  'gantt.noProject.p1':
    'WBS-gantt 管理项目和任务的方式与电脑操作系统管理文件的方式（目录树）很像。在这里，项目（project）是最顶层的根目录，而每个项目下属的所有任务都可以视作一个文件 / 文件夹。显然文件得存放在根目录下，所以在新建任务前，需要为其指定一个项目。我十分推荐你这样理解你未来即将构建的任务网络，因为……软件就是这么设计的。',
  'gantt.noProject.p2':
    '除了为任务的存在提供一个地基之外，项目只是一个分类用的标签。不妨把它理解为在它下面建立的任务的「主题」。它为这些任务定义了一个类别，以便按类管理。所以从管理的角度来看，将任务分类在项目下也是十分必要的。',
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
  'gantt.manageTasks': '管理任务',
  'gantt.editDone': '完成',
  'gantt.editMode': '编辑模式',
  'gantt.selected': { one: '已选 {count} 项', other: '已选 {count} 项' },
  'gantt.clearSelection': '取消选择',
  'gantt.setTodoMany': {
    one: '确定将这 {count} 个任务设为待办？\n\n它们的日期、优先级和进度将被清除。',
    other: '确定将这 {count} 个任务设为待办？\n\n它们的日期、优先级和进度将被清除。',
  },
  'gantt.setTodoManyWithSubtasks': {
    one: '确定将这 {count} 个任务及其 {subs} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。',
    other: '确定将这 {count} 个任务及其 {subs} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。',
  },
  'gantt.deleteSelected': {
    one: '确定删除这 {count} 个任务？',
    other: '确定删除这 {count} 个任务？',
  },
  'gantt.deleteSelectedWithSubtasks': {
    one: '确定删除这 {count} 个任务及其子任务？',
    other: '确定删除这 {count} 个任务及其子任务？',
  },
  'gantt.pauseMany': {
    one: '确定暂停 {count} 项任务？',
    other: '确定暂停 {count} 项任务？',
  },
  'gantt.resumeMany': {
    one: '确定恢复 {count} 项任务？',
    other: '确定恢复 {count} 项任务？',
  },
  'gantt.archiveMany': {
    one: '确定归档 {count} 项任务？',
    other: '确定归档 {count} 项任务？',
  },
  'gantt.archiveManyWithSubtasks': {
    one: '确定归档 {count} 项任务？属于它们的子任务也会连带归档。',
    other: '确定归档 {count} 项任务？属于它们的子任务也会连带归档。',
  },
  'gantt.dragMany': { one: '{count} 个任务', other: '{count} 个任务' },
  'gantt.moved': '已移动 {what}',
  'gantt.undoTodo': '已将 {what}设为待办',
  'gantt.undoStart': '已开始 {what}',
  'gantt.undoPause': '已暂停 {what}',
  'gantt.undoResume': '已恢复 {what}',
  'gantt.undoDelete': '已删除 {what}',
  'gantt.undoArchive': '已归档 {what}',
  'gantt.undoUnarchive': '已取消归档 {what}',
  'gantt.undo': '撤销',
  'gantt.undoSeconds': '（{seconds}）',

  'todo.folderName': '待办',
  'todo.folder': '待办（{count}）',
  'todo.startTask': '开始任务',
  'todo.start': '开始',
  'todo.next': '下一个 →',
  'todo.restoreMany': { one: '恢复 {count} 项待办', other: '恢复 {count} 项待办' },
  'todo.saveAll': '全部保存（{count}）',
  'todo.hasSubtasks': '{name} 有子任务，它的日期由子任务决定。请先恢复那些子任务；也可以只在此设定优先级，让日期随后自动跟进。',
  'todo.renameFolder': '给文件夹起名',
  'todo.folderPlaceholder': '文件夹名',
  'todo.restoreAll': '恢复全部 {count} 项',
  'todo.deleteAll': '删除全部 {count} 项',

  // --- archive ---
  'archive.title': '已归档（{count}）',
  'archive.badge': '已归档',
  'archive.restoreAll': '全部取消归档（{count} 项）',
  'archive.empty': '还没有归档的任务',

  'task.addSubtask': '添加子任务',
  'task.addSibling': '添加同级任务',
  'task.new': '新建任务',
  'task.edit': '编辑任务',
  'task.namePlaceholder': '任务名称',
  'task.parent': '父任务',
  'task.topLevel': '最顶层任务',
  'task.createAsTodo': '创建为待办',
  'task.todoNote':
    '这是一项待办：尚未排期的工作。它会排在同级任务末尾的 {toDos} 文件夹中，直到你在详情面板里用 {startTask} 为它安排时间。',
  'task.endDateLocked': '结束日期由最晚结束的子任务决定，请改为修改那个子任务的结束日期。',
  'task.startDateLocked': '开始日期由最早开始的子任务决定，请改为修改那个子任务的开始日期。',
  'task.strictProgress': '取消日志限制（不推荐）',
  'task.overdueMark': '该任务已逾期 —— 标记为',
  'task.tagsPlaceholder': '学习, 健康',
  'task.tagsLabel': '标签（用逗号分隔）',
  'task.subtaskCount': { one: '{count} 项子任务', other: '{count} 项子任务' },
  'task.hide': '收起',
  'task.hidden': '已收起',
  'task.tree': '所在任务树',
  'task.treeFocus': '只展示一支',
  'task.pendingLogs': '今日待填',
  'task.progressMode': '进度模式',
  'task.modeStrict': '严格模式',
  'task.modeAuto': '简化模式',
  'task.modeRolledUp': '由子任务汇总',

  'optOut.title': '确定采取简化模式(脱离日志系统)吗？',
  'optOut.p1': '脱离日志系统则该任务将*不会拥有历史日志*，且不会在 log 页面里被统一管理。',
  'optOut.p2':
    '本任务将采用一种*极度简化*的进度计算方式，即每日只需要*手动点击按钮*来确认完成，然后系统自动按已过日期 ÷ 总日期进行进度累计，否则不予累计进度。如果你有某日忘了点按钮，则会在以后的日报里对你进行提醒，你可以按实际需求暂时忽略／将确认补上，也就是再点一下按钮的事。',
  'optOut.p3':
    '这也就意味着，本任务可能将*/无法精确反应任务实际进度*/，且确认某日本任务完成的*/监督力度几乎为 0 */。**//请确保你有足够的自律能力脱离日志系统监督**//。',
  'optOut.back': '返回',
  'optOut.confirm': '仍要取消',

  'day.tick': '把这一天标记为完成',
  'task.pausedNote': {
    one: '已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。',
    other: '已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。',
  },
  'task.resume': '恢复',
  'task.endPostponed': '结束（已顺延）',
  'task.setAsTodo': '设为待办',
  'task.pauseConfirm': '确定暂停“{name}”？',
  'task.resumeConfirm': '确定恢复“{name}”？',
  'task.archive': '归档',
  'task.unarchive': '取消归档',
  'task.archiveConfirm': '确定归档“{name}”？',
  'task.archiveWithSubtasks': {
    one: '确定归档“{name}”？属于它的子任务也会连带归档。',
    other: '确定归档“{name}”？属于它的子任务也会连带归档。',
  },
  'task.pause': '暂停任务',
  'task.pauseHistory': '暂停记录（{count}）',
  'task.pauseEntry': '暂停于 {from} → 恢复于 {to}',
  'task.heat.title': '完成情况',
  'task.heat.done': '已完成',
  'task.heat.pending': '未完成',
  'task.heat.none': '无排期',
  'task.heat.count': { one: '完成 {count} 项任务', other: '完成 {count} 项任务' },
  'task.heat.less': '少',
  'task.heat.more': '多',
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
  'log.editedAt': '编辑于 {time}',
  'log.hint': '每行是一个条目；Tab 键缩进为子条目，Shift+Tab 反向缩进。',
  'log.progressAdd': '进度增加（%）',
  'log.progressAfterDay': '进度累积至（%）',
  'log.currentProgress': '目前进度 {percent}%',
  'log.byDays': '自动推进一日',
  'log.byDaysHint': '自动推进一日＝增加（1 ÷ 总日数）× 100% 的进度。如果自动推进一日后剩余进度小于一日进度的 1/5，则会默认任务完成。',
  'log.progressRequired': '两个格子至少填一个 —— 没进展就在「{add}」里填 0。',
  'log.progressBackward': '进度不能往回填',
  'log.task': '任务',
  'logs.all': '全部日志',
  'logs.empty': '暂无日志。',
  'logs.moreTasks': { one: '以及 {count} 项任务', other: '以及 {count} 项任务' },
  'logs.tabLogs': '日志',

  'notes.title': '记事本',
  'notes.empty': '空空如也',
  'notes.add': '写点什么',
  'notes.placeholder': '写点随想',
  'notes.none': '暂无',

  'calendar.prevMonth': '上个月',
  'calendar.nextMonth': '下个月',
  'calendar.cellLabel': '{date}：{due}，{starting}；{coverage}',
  'calendar.dueCount': { one: '{count} 项到期', other: '{count} 项到期' },
  'calendar.startingCount': { one: '{count} 项开始', other: '{count} 项开始' },
  'calendar.coverage.future': '尚未到期',
  'calendar.coverage.clear': '无日志义务',
  'calendar.coverage.partial': '已记录 {count}/{total} 项日志',
  'calendar.coverage.full': '{count} 项日志已全部记录',
  'calendar.more': '还有 {count} 项',
  'calendar.milestoneTitle': '{kind}{strict} —— {name}{logged}',
  'calendar.milestone.due': '到期',
  'calendar.milestone.starts': '开始',
  'calendar.milestone.strict': ' *',
  'calendar.milestone.logged': ' · 当天已记录',

  'day.strictLogs': '日志',
  'day.notYetDue': '尚未到期',
  'day.noStrictScheduled': '当天无日志义务',
  'day.allLogged': '已完成所有日志填写',
  'day.nothingLogged': '尚未记录任何日志',
  'day.stillMissing': { one: '还差 {count} 项', other: '还差 {count} 项' },
  'day.noStrictTasksScheduled': '当天没有日志义务',
  'day.ringPartial': '已记录 {count}/{total} 项日志',
  'day.taskCount': { one: '当天有 {count} 项任务', other: '当天有 {count} 项任务' },
  'day.tasksBreakdown': '{strict} 有日志 · {other} 其他',
  'day.taskList': '任务清单',
  'day.nothingScheduled': '当天没有排期。',
  'day.logMark': '带 * 的任务有日志义务。',
  'day.readLogs': '查看当天的日志',
  'day.readLogsCount': '查看当天的日志（{count}）',
  'day.noProgress': '无进度',
  'day.belongsTo': '属于',
  'day.parentPath': '展开完整路径',
  'day.viewTask': '查看任务 →',

  'chore.section': '临时事务',
  'chore.placeholder': '添加临时事务…',
  'chore.emptyToday': '今天没有临时事务。',
  'chore.emptyTomorrow': '明天还没有安排。',
  'chore.noneOnDay': '当天没有临时事务。',
  'chore.stillOpen': { one: '还有 {count} 项', other: '还有 {count} 项' },
  'chore.allDone': '全部完成',
  'chore.edit': '编辑临时事务',
  'chore.title': '内容',
  'chore.note': '备注',
  'chore.notePlaceholder': '可不填',
  'chore.day': '日期',
  'chore.carriedTitle': '原本定于 {date}',

  'habit.section': '日常安排',
  'habit.none': '还没有每日项。',
  'habit.edit': '编辑每日项',
  'habit.title': '内容',
  'habit.deleteAsk': '确定删除“{name}”？它的历史完成等记录也会一并删除',
  'habit.new': '新建日常安排',
  'habit.note': '备注',
  'habit.notePlaceholder': '可不填',
  'habit.weekdays': '星期几',
  'habit.everyDay': '每天',
  'habit.endDate': '结束日期',
  'habit.noEndDate': '选填。',
  'habit.paused': '停用',

  'manage.overall': '总览',
  'manage.heat': '完成热力图',
  'manage.subtasks': '子任务',
  'manage.parentTasks': { one: '{count} 项父任务', other: '{count} 项父任务' },
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
  'manage.sub.tracked': '全部项目',
  'manage.sub.done': '已完成',
  'manage.sub.paused': '已暂停',
  'manage.sub.startsIn7': '将在 7 天内开始',
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
  'settings.version': '版本',
  'settings.versionHint': '桌面版每次启动会自动检查更新。',

  // --- reminders ---
  'settings.reminder': '提醒',
  'settings.reminderWebNote':
    '提醒由桌面版发出 —— 只有桌面版能把消息送到 PushPlus。浏览器版这里没有可设置的东西。',
  'settings.reminderOn': '桌面弹窗通知默认开启，请保持 WBS-gantt 在电脑后台运行。',
  'settings.reminderWechat': '将通知/提醒同步到个人微信',
  'settings.reminderTime': '发送时间',
  'settings.reminderToken': 'PushPlus 令牌',
  'settings.reminderPushplusNote':
    'WBS-gantt 依赖 pushplus 在微信同步通知。\n不过，激活该途径需要向 pushplus 支付 3.5 元以完成实名认证。因而放弃配置该途径也是完全可行的。',
  'settings.reminderTokenHint': '在 pushplus.plus 扫码登录，并把页面顶部的令牌(token)复制在这里',
  'settings.reminderOpen': '打开 pushplus.plus',
  'settings.reminderTest': '发一条试试',
  'settings.reminderPreview': '预览中午的',
  'settings.reminderSending': '发送中…',
  'settings.reminderSent': '已发出。',
  'settings.backgroundAppOnly': '不装的话，只有这个窗口开着的时候才会发。',
  'settings.autostart': '开机自启动',
  'settings.closeToTray': '关闭时最小化到托盘',

  'tray.open': '打开看板',
  'tray.quit': '退出',
  'reminder.greeting.dawn': '强啊传奇耐熬王',
  'reminder.greeting.early': '早上好',
  'reminder.greeting.morning': '上午好',
  'reminder.greeting.noon': '中午好',
  'reminder.greeting.afternoon': '下午好',
  'reminder.greeting.dusk': '傍晚了',
  'reminder.greeting.evening': '晚上好',
  'reminder.greeting.night': '夜深了',
  'reminder.closing.dawn': '',
  'reminder.closing.early': '',
  'reminder.closing.morning': '',
  'reminder.closing.noon': '',
  'reminder.closing.afternoon': '',
  'reminder.closing.dusk': '',
  'reminder.closing.evening': '',
  'reminder.closing.night': '',
  'reminder.starting': '今天该开始',
  'reminder.dueSoon': '即将到期',
  'reminder.reportTitle': '日报',
  'reminder.reportEmpty': '今日无事',
  'reminder.reportYesterday': '昨日',
  'reminder.reportToday': '今天',
  'reminder.reportRate': '完成率',
  'reminder.groupTasks': '任务清单',
  'reminder.groupDeadlines': '到期与逾期',
  'reminder.testTitle': '看板 —— 测试消息',
  'reminder.testBody': '你能在微信里看到这条，就说明提醒已经配好了。',
  'reminder.nudgeLogs': '记得为已经完成的任务填写日志。',
  'reminder.nudgeDebt': '还有 {count} 项事项待处理，其中：',
  'reminder.nudgeDebtLine': '- {count} 项{label}',
  'reminder.nudgeTasks': '任务',
  'reminder.ack': '我知道了',
  'slot.early': '早上',
  'slot.noon': '中午',
  'slot.dusk': '傍晚',
  'reminder.overdue': '已逾期',
  'reminder.dueToday': '今天到期',
  'reminder.logsOwed': '日志缺少',
  'reminder.chores': '临时事务',
  'reminder.habits': '日常安排',

  'update.check': '检查更新',
  'update.checking': '检查中…',
  'update.upToDate': '已是最新版本。',
  'update.availableShort': '有可用更新。',
  'update.unreachable': '由于无法连接到 GitHub，自动更新不可用。',
  'update.webNote': '自动更新只适用于桌面版；在浏览器里打开的始终是最新版本。',
  'update.availableTitle': '发现新版本',
  'update.availableBody': '新版本 {version} 已发布，当前版本为 {current}。',
  'update.notes': '更新说明',
  'update.history': '本次将连带更新的历史版本内容（{count} 个版本）',
  'update.noNotes': '本次发布未填写更新说明。',
  'update.downloadAndInstall': '下载并安装',
  'update.installing': '正在下载…',
  'update.installFailed': '更新安装失败：{message}',
  'update.later': '以后再说',
  'update.snooze': '{days} 天内不再提醒',
  'update.nagTitle': '已经很久没有更新了',
  'update.nagBody': '要不要连上 GitHub 看一眼有没有 bug 修复和新功能呢？',
  'update.nagGo': '去设置看看',
  'update.connectTitle': '想稳定连接 GitHub？',
  'update.connectBody':
    'Watt Toolkit（原 Steam++）是免费开源的多平台网络加速工具，可以加速 GitHub 网页和 Release 下载。',
  'update.connectLink': '前往官网下载（steampp.net）',
  'update.opensource':
    'GitHub 是全球最大的开源社区，托管着数以亿计的开源项目 —— 从操作系统、开发框架到各类现成工具，绝大多数都可以免费使用、学习和二次开发。本项目的源码和版本更新也发布在这里。',
  'update.openRepo': '在 GitHub 上查看',
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
}

const fr: Dict = {
  'app.title': 'WBS · Gantt — Contrôle de projet',

  'nav.gantt': 'Gantt',
  'nav.logs': 'Journaux / Notes',
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
  'common.view': 'Voir',
  'common.close': 'Fermer',
  'common.ok': 'OK',
  'common.gotIt': 'Compris',
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
  'common.wbs': 'WBS',
  'common.prog': 'Avanc.',
  'common.expand': 'Déplier',
  'common.collapse': 'Replier',
  'common.select': 'Sélectionner',
  'common.deselect': 'Désélectionner',
  'common.listSeparator': ', ',
  'common.pathSeparator': ' › ',
  'common.unknownTask': 'Tâche inconnue',
  'common.notes': 'Notes…',
  'common.targetProgress': 'Avancement visé : {percent} %',
  'common.taskCount': { one: '{count} tâche', other: '{count} tâches' },
  'common.logCount': { one: '{count} journal', other: '{count} journaux' },
  'common.noteCount': { one: '{count} note', other: '{count} notes' },

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
  'priority.top': 'Maximale',
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
  'gantt.noProject': 'Une tâche doit vivre dans un projet — créez-en un d’abord, dans {manage}, sur la barre latérale de gauche.',
  'gantt.noProject.p1':
    'WBS-gantt gère les projets et les tâches à peu près comme un système d’exploitation gère ses fichiers : une arborescence. Un projet est le dossier racine, tout en haut, et chaque tâche qu’il contient est un fichier ou un dossier. Un fichier se range bien sous une racine : une tâche a donc besoin d’un projet avant de pouvoir être créée. Je vous conseille vraiment de lire ainsi le réseau de tâches que vous allez bâtir, parce que… c’est comme ça que le logiciel est conçu.',
  'gantt.noProject.p2':
    'À part donner aux tâches un endroit où exister, un projet n’est qu’une étiquette de classement. Voyez-le comme le « thème » des tâches créées en dessous : il leur donne une catégorie, donc une façon de les gérer par catégorie. Classer ses tâches dans des projets est donc nécessaire aussi du point de vue de la gestion.',
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
  'gantt.manageTasks': 'Organiser',
  'gantt.editDone': 'Terminé',
  'gantt.editMode': 'Édition',
  'gantt.selected': { one: '{count} sélectionnée', other: '{count} sélectionnées' },
  'gantt.clearSelection': 'Tout désélectionner',
  'gantt.setTodoMany': {
    one: 'Marquer {count} tâche comme à faire ?\n\nSes dates, sa priorité et sa progression seront effacées.',
    other: 'Marquer {count} tâches comme à faire ?\n\nLeurs dates, priorités et progressions seront effacées.',
  },
  'gantt.setTodoManyWithSubtasks': {
    one:
      'Marquer {count} tâche et sa {subs} sous-tâche inachevée comme à faire ?\n\n' +
      'Leurs dates, priorités et progressions seront effacées. Les sous-tâches terminées ne sont pas touchées.',
    other:
      'Marquer {count} tâches et leurs {subs} sous-tâches inachevées comme à faire ?\n\n' +
      'Leurs dates, priorités et progressions seront effacées. Les sous-tâches terminées ne sont pas touchées.',
  },
  'gantt.deleteSelected': {
    one: 'Supprimer {count} tâche ?',
    other: 'Supprimer {count} tâches ?',
  },
  'gantt.deleteSelectedWithSubtasks': {
    one: 'Supprimer {count} tâche et ses sous-tâches ?',
    other: 'Supprimer {count} tâches et leurs sous-tâches ?',
  },
  'gantt.pauseMany': {
    one: 'Mettre {count} tâche en pause ?',
    other: 'Mettre {count} tâches en pause ?',
  },
  'gantt.resumeMany': {
    one: 'Reprendre {count} tâche ?',
    other: 'Reprendre {count} tâches ?',
  },
  'gantt.archiveMany': {
    one: 'Archiver {count} tâche ?',
    other: 'Archiver {count} tâches ?',
  },
  'gantt.archiveManyWithSubtasks': {
    one: 'Archiver {count} tâche ? Ses sous-tâches seront archivées avec elle.',
    other: 'Archiver {count} tâches ? Leurs sous-tâches seront archivées avec elles.',
  },
  'gantt.dragMany': { one: '{count} tâche', other: '{count} tâches' },
  'gantt.moved': '{what} déplacé',
  'gantt.undoTodo': '« {what} » marqué comme à faire',
  'gantt.undoStart': '« {what} » démarré',
  'gantt.undoPause': '« {what} » mis en pause',
  'gantt.undoResume': '« {what} » repris',
  'gantt.undoDelete': '« {what} » supprimé',
  'gantt.undoArchive': '« {what} » archivé',
  'gantt.undoUnarchive': '« {what} » désarchivé',
  'gantt.undo': 'Annuler',
  'gantt.undoSeconds': '({seconds})',

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
  'todo.renameFolder': 'Nommer ce dossier',
  'todo.folderPlaceholder': 'Nom du dossier',
  'todo.restoreAll': 'Restaurer tout ({count})',
  'todo.deleteAll': 'Supprimer tout ({count})',

  // --- archive ---
  'archive.title': 'Archivées ({count})',
  'archive.badge': 'Archivée',
  'archive.restoreAll': 'Tout désarchiver ({count})',
  'archive.empty': 'Rien d’archivé pour l’instant.',

  'task.addSubtask': 'Ajouter une sous-tâche',
  'task.addSibling': 'Ajouter une tâche au même niveau',
  'task.new': 'Nouvelle tâche',
  'task.edit': 'Modifier la tâche',
  'task.namePlaceholder': 'Nom de la tâche',
  'task.parent': 'Parent',
  'task.topLevel': '— Niveau supérieur —',
  'task.createAsTodo': 'Créer comme tâche à faire',
  'task.todoNote':
    'Ceci est une tâche à faire : du travail non planifié. Elle se place en dernier parmi ses voisines, dans un dossier {toDos}, jusqu’à ce que vous lui donniez un planning avec {startTask} dans le panneau de détail.',
  'task.endDateLocked':
    'La date de fin est déterminée par la sous-tâche qui se termine le plus tard — modifiez plutôt la date de fin de cette sous-tâche.',
  'task.startDateLocked':
    'La date de début est déterminée par la sous-tâche qui commence le plus tôt — modifiez plutôt la date de début de cette sous-tâche.',
  'task.strictProgress': 'Désactiver les journaux (non recommandé)',
  'task.overdueMark': 'Cette tâche est déjà en retard — la marquer comme',
  'task.tagsPlaceholder': 'étude, santé',
  'task.tagsLabel': 'Étiquettes (séparées par des virgules)',
  'task.subtaskCount': { one: '{count} sous-tâche', other: '{count} sous-tâches' },
  'task.hide': 'Masquer',
  'task.hidden': 'Masqué.',
  'task.tree': 'Arbre des tâches',
  'task.treeFocus': 'Une seule branche',
  'task.pendingLogs': 'Reste à journaliser',
  'task.progressMode': 'Mode d’avancement',
  'task.modeStrict': 'Par journaux',
  'task.modeAuto': 'Simplifié (coché au jour le jour)',
  'task.modeRolledUp': 'D’après les sous-tâches',

  'optOut.title': 'Se passer de la supervision des journaux ?',
  'optOut.p1':
    'Sans le système de journaux, cette tâche *ne conservera aucun historique* et ne sera pas gérée dans la page Journaux.',
  'optOut.p2':
    'Elle utilisera une manière *délibérément rudimentaire* de compter l’avancement : chaque jour, il vous suffit de *cliquer un bouton à la main* pour confirmer que vous l’avez faite, et le système cumule alors l’avancement selon jours écoulés ÷ jours au total. Pas de clic, pas de cumul. Si vous oubliez un jour, les rapports quotidiens suivants vous le rappelleront : vous pouvez le laisser de côté ou remettre la confirmation, ce qui est un clic de plus.',
  'optOut.p3':
    'Cela signifie aussi que la tâche */risque de ne pas refléter son avancement réel*/, et que la supervision de la réalisation d’un jour donné est */proche de zéro*/. **//Assurez-vous d’avoir assez de discipline pour vous passer de la supervision des journaux**//.',
  'optOut.back': 'Retour',
  'optOut.confirm': 'Désactiver quand même',

  'day.tick': 'Marquer ce jour comme fait',
  'task.pausedNote': {
    one: 'En pause. Débutée le {start} · mise en pause le {paused} · {count} jour écoulé.',
    other: 'En pause. Débutée le {start} · mise en pause le {paused} · {count} jours écoulés.',
  },
  'task.resume': 'Reprendre',
  'task.endPostponed': 'Fin (reportée)',
  'task.setAsTodo': 'Marquer comme à faire',
  'task.pauseConfirm': 'Mettre « {name} » en pause ?',
  'task.resumeConfirm': 'Reprendre « {name} » ?',
  'task.archive': 'Archiver',
  'task.unarchive': 'Désarchiver',
  'task.archiveConfirm': 'Archiver « {name} » ?',
  'task.archiveWithSubtasks': {
    one: 'Archiver « {name} » ? Ses sous-tâches seront archivées avec elle.',
    other: 'Archiver « {name} » ? Ses sous-tâches seront archivées avec elle.',
  },
  'task.pause': 'Mettre en pause',
  'task.pauseHistory': 'Historique des pauses ({count})',
  'task.pauseEntry': 'En pause le {from} → reprise le {to}',
  'task.heat.title': 'Complétion',
  'task.heat.done': 'Fait',
  'task.heat.pending': 'Non fait',
  'task.heat.none': 'Non planifié',
  'task.heat.count': { one: '{count} tâche faite', other: '{count} tâches faites' },
  'task.heat.less': 'Moins',
  'task.heat.more': 'Plus',
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
  'log.editedAt': 'modifié à {time}',
  'log.hint': 'Chaque ligne est un élément ; Tab l’indente en sous-élément, Maj+Tab le désindente.',
  'log.progressAdd': 'Avancement ajouté (%)',
  'log.progressAfterDay': 'Avancement cumulé (%)',
  'log.currentProgress': 'Actuellement à {percent} %',
  'log.byDays': 'Avancer d’un jour',
  'log.byDaysHint': 'Avancer d’un jour = ajouter (1 ÷ nombre total de jours) × 100 % de l’avancement. S’il reste moins d’un cinquième d’une journée après cela, la tâche est considérée comme terminée.',
  'log.progressRequired': 'Remplissez au moins l’un des deux — mettez 0 dans « {add} » si rien n’a bougé.',
  'log.progressBackward': 'L’avancement ne peut pas reculer — la valeur passe sous celle du début de journée.',
  'log.task': 'Tâche',
  'logs.all': 'Tous les journaux',
  'logs.empty': 'Aucun journal pour l’instant.',
  'logs.moreTasks': { one: '+{count} autre tâche', other: '+{count} autres tâches' },
  'logs.tabLogs': 'Journaux',

  'notes.title': 'Notes',
  'notes.empty': 'Rien d’écrit pour l’instant.',
  'notes.add': 'Écrire quelque chose',
  'notes.placeholder': 'Ce que vous voulez garder.',
  'notes.none': 'Aucune pour l’instant.',

  'calendar.prevMonth': 'Mois précédent',
  'calendar.nextMonth': 'Mois suivant',
  'calendar.cellLabel': '{date} : {due}, {starting} ; {coverage}',
  'calendar.dueCount': { one: '{count} échéance', other: '{count} échéances' },
  'calendar.startingCount': { one: '{count} début', other: '{count} débuts' },
  'calendar.coverage.future': 'pas encore échu',
  'calendar.coverage.clear': 'aucun journal à écrire',
  'calendar.coverage.partial': '{count} journaux sur {total} écrits',
  'calendar.coverage.full': 'les {count} journaux écrits',
  'calendar.more': '+{count} autres',
  'calendar.milestoneTitle': '{kind}{strict} — {name}{logged}',
  'calendar.milestone.due': 'Échéance',
  'calendar.milestone.starts': 'Début',
  'calendar.milestone.strict': ' *',
  'calendar.milestone.logged': ' · journalisée ce jour',

  'day.strictLogs': 'Journaux',
  'day.notYetDue': 'Pas encore échu',
  'day.noStrictScheduled': 'Aucun journal à écrire',
  'day.allLogged': 'Tout est journalisé',
  'day.nothingLogged': 'Rien de journalisé pour l’instant',
  'day.stillMissing': { one: '{count} encore manquant', other: '{count} encore manquants' },
  'day.noStrictTasksScheduled': 'Aucun journal à écrire',
  'day.ringPartial': '{count} journaux sur {total} écrits',
  'day.taskCount': { one: '{count} tâche ce jour', other: '{count} tâches ce jour' },
  'day.tasksBreakdown': '{strict} avec journal · {other} autres',
  'day.taskList': 'Liste des tâches',
  'day.nothingScheduled': 'Rien de prévu ce jour.',
  'day.logMark': 'Un * marque une tâche qui doit un journal quotidien.',
  'day.readLogs': 'Lire les journaux du jour',
  'day.readLogsCount': 'Lire les journaux du jour ({count})',
  'day.noProgress': 'Aucun avancement',
  'day.belongsTo': 'dans',
  'day.parentPath': 'Afficher tout le chemin',
  'day.viewTask': 'Voir la tâche →',

  'chore.section': 'Menues tâches',
  'chore.placeholder': 'Ajouter une menue tâche…',
  'chore.emptyToday': 'Rien à faire aujourd’hui.',
  'chore.emptyTomorrow': 'Rien de prévu pour demain.',
  'chore.noneOnDay': 'Aucune menue tâche ce jour.',
  'chore.stillOpen': { one: '{count} encore ouverte', other: '{count} encore ouvertes' },
  'chore.allDone': 'Tout est fait',
  'chore.edit': 'Modifier la menue tâche',
  'chore.title': 'Intitulé',
  'chore.note': 'Remarque',
  'chore.notePlaceholder': 'Facultatif',
  'chore.day': 'Jour',
  'chore.carriedTitle': 'Prévu le {date}',

  'habit.section': 'Routine',
  'habit.none': 'Rien de quotidien pour l’instant.',
  'habit.edit': 'Modifier l’habitude',
  'habit.title': 'Intitulé',
  'habit.deleteAsk': 'Supprimer « {name} » ? Tous les jours cochés partiront avec.',
  'habit.new': 'Nouvelle routine',
  'habit.note': 'Remarque',
  'habit.notePlaceholder': 'Facultatif',
  'habit.weekdays': 'Jours',
  'habit.everyDay': 'Tous les jours',
  'habit.endDate': 'Fin',
  'habit.noEndDate': 'Vide pour continuer sans fin.',
  'habit.paused': 'Suspendu',

  'manage.overall': 'Vue d’ensemble',
  'manage.heat': 'Carte de complétion',
  'manage.subtasks': 'Sous-tâches',
  'manage.parentTasks': { one: '{count} tâche parente', other: '{count} tâches parentes' },
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
  'manage.sub.tracked': 'au total',
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
  'settings.version': 'Version',
  'settings.versionHint': 'L’application de bureau vérifie les mises à jour à chaque lancement.',

  // --- reminders ---
  'settings.reminder': 'Rappels',
  'settings.reminderWebNote':
    'Les rappels sont envoyés par l’application de bureau — c’est le seul build qui peut publier vers PushPlus. Dans un navigateur, il n’y a rien à configurer ici.',
  'settings.reminderOn':
    'Les notifications de bureau sont activées par défaut. Gardez WBS Gantt en arrière-plan.',
  'settings.reminderWechat': 'Synchroniser les notifications vers WeChat personnel',
  'settings.reminderTime': 'Heure d’envoi',
  'settings.reminderToken': 'Jeton PushPlus',
  'settings.reminderPushplusNote':
    'WBS Gantt s’appuie sur PushPlus pour synchroniser les notifications vers WeChat.\nActiver cette voie implique de payer 3,50 ¥ à PushPlus pour la vérification d’identité ; y renoncer est donc parfaitement raisonnable.',
  'settings.reminderTokenHint':
    'Connectez-vous sur pushplus.plus et collez ici le jeton affiché en haut de la page.',
  'settings.reminderOpen': 'Ouvrir pushplus.plus',
  'settings.reminderTest': 'Envoyer un test',
  'settings.reminderPreview': 'Aperçu de midi',
  'settings.reminderSending': 'Envoi…',
  'settings.reminderSent': 'Envoyé.',
  'settings.backgroundAppOnly':
    'Sans lui, les rappels ne partent que pendant que cette fenêtre est ouverte.',
  'settings.autostart': 'Lancer avec Windows',
  'settings.closeToTray': 'Réduire dans la zone de notification à la fermeture',

  'tray.open': 'Ouvrir WBS Gantt',
  'tray.quit': 'Quitter',
  'reminder.greeting.dawn': 'Encore debout',
  'reminder.greeting.early': 'Bonjour',
  'reminder.greeting.morning': 'Bonjour',
  'reminder.greeting.noon': 'Midi',
  'reminder.greeting.afternoon': 'Bon après-midi',
  'reminder.greeting.dusk': 'Fin de journée',
  'reminder.greeting.evening': 'Bonsoir',
  'reminder.greeting.night': 'Tard dans la nuit',
  'reminder.closing.dawn': '',
  'reminder.closing.early': '',
  'reminder.closing.morning': '',
  'reminder.closing.noon': '',
  'reminder.closing.afternoon': '',
  'reminder.closing.dusk': '',
  'reminder.closing.evening': '',
  'reminder.closing.night': '',
  'reminder.starting': 'À commencer',
  'reminder.dueSoon': 'Bientôt dû',
  'reminder.reportTitle': 'Rapport du jour',
  'reminder.reportEmpty': 'Rien en attente aujourd’hui.',
  'reminder.reportYesterday': 'Hier',
  'reminder.reportToday': 'Aujourd’hui',
  'reminder.reportRate': 'Achèvement',
  'reminder.groupTasks': 'Tâches',
  'reminder.groupDeadlines': 'Échéances',
  'reminder.testTitle': 'WBS Gantt — message de test',
  'reminder.testBody': 'Si vous lisez ceci dans WeChat, les rappels fonctionnent.',
  'reminder.nudgeLogs': 'Pensez à écrire les journaux des tâches terminées.',
  'reminder.nudgeDebt': '{count} choses en attente, dont :',
  'reminder.nudgeDebtLine': '- {count} {label}',
  'reminder.nudgeTasks': 'tâches',
  'reminder.ack': 'Compris',
  'slot.early': 'Matin',
  'slot.noon': 'Midi',
  'slot.dusk': 'Soir',
  'reminder.overdue': 'En retard',
  'reminder.dueToday': 'Échéance aujourd’hui',
  'reminder.logsOwed': 'Journaux dus',
  'reminder.chores': 'Menues tâches',
  'reminder.habits': 'Routine',

  'update.check': 'Rechercher des mises à jour',
  'update.checking': 'Vérification…',
  'update.upToDate': 'Vous avez la dernière version.',
  'update.availableShort': 'Une mise à jour est disponible.',
  'update.unreachable':
    'Les mises à jour automatiques sont indisponibles : GitHub est injoignable.',
  'update.webNote':
    'Les mises à jour concernent l’application de bureau ; dans un navigateur vous chargez toujours la dernière version.',
  'update.availableTitle': 'Mise à jour disponible',
  'update.availableBody': 'La version {version} est disponible. Vous avez la {current}.',
  'update.notes': 'Nouveautés',
  'update.history': 'Versions plus anciennes incluses ({count})',
  'update.noNotes': 'Cette version n’est accompagnée d’aucune note.',
  'update.downloadAndInstall': 'Télécharger et installer',
  'update.installing': 'Téléchargement…',
  'update.installFailed': 'L’installation a échoué : {message}',
  'update.later': 'Plus tard',
  'update.snooze': 'Ignorer pendant {days} jours',
  'update.nagTitle': 'Ça fait un moment',
  'update.nagBody':
    'Cela fait plus d’un mois que l’application n’a pas joint GitHub. Voulez-vous voir s’il y a des correctifs ou des nouveautés ?',
  'update.nagGo': 'Ouvrir les réglages',
  'update.connectTitle': 'Une connexion GitHub stable ?',
  'update.connectBody':
    'Watt Toolkit (ex-Steam++) est un accélérateur réseau libre et gratuit. Il accélère le site GitHub comme le téléchargement des versions.',
  'update.connectLink': 'Télécharger sur steampp.net',
  'update.opensource':
    'GitHub est la plus grande maison du logiciel libre : systèmes d’exploitation, frameworks, outils prêts à l’emploi — la plupart gratuits, à étudier et à réutiliser. Le code source et les versions de ce projet y sont publiés.',
  'update.openRepo': 'Voir sur GitHub',
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

/**
 * Fill `{name}` placeholders.
 *
 * Exported because notification copy can be overridden by the user, and an
 * override has to go through the same substitution as the built-in string. Two
 * implementations of `{name}` would drift the first time one of them learned
 * about a new placeholder, and the drift would show as a literal `{date}` on
 * someone's phone.
 */
export function interpolate(text: string, params?: Params): string {
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

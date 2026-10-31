# 界面中文：全部文案

这份表是**核对用的**，由 `node scripts/zh-copy.mjs` 从 `src/lib/i18n.ts` 生成。
顺序就是代码里的顺序，左边是英文原文，右边是中文。要改哪一条，把**最后一列**写成你要的文字就行，
改完跟我说，我照着写回 `src/lib/i18n.ts`。

**注意**：重跑脚本会覆盖这份文件。所以改完先告诉我，不要自己再跑一遍。

几条约定，照着填不会出错：

- 空着 = 保持现在的样子
- `{count}` `{name}` `{date}` 这类花括号是占位符，**必须原样留着**，位置可以挪
- 单元格里的 `\n` 是换行，`\|` 是竖线，都照原样抄
- `*……*`、`/……/` 是粗细和字号的排版标记，不要丢
- `⟨空⟩` 表示这一条现在就是空的；想清空别的条目，也写 `⟨空⟩`
- 首尾的空格（`›` 这类连接符两边有）在表里看不出来，要动那种单独跟我说一声
- `one / other` 是单复数两套（中文里通常一样，重复的已经合并成一条）

---

| # | key | English | 中文 |
|---|-----|---------|------|
| 1 | `storage.loadFailed` | Your saved data could not be opened. The original is preserved; automatic saving is paused. You can import a valid backup using the sidebar. | 无法打开已有存档。原始数据已保留，自动保存已暂停；可使用侧边栏导入有效备份。 |
| 2 | `storage.saveFailed` | Changes are only in memory because saving failed. Export your work or retry before closing the app. | 保存失败，当前修改仅在内存中。关闭应用前请导出数据或重试保存。 |
| 3 | `storage.details` | Error details | 错误详情 |
| 4 | `storage.original` | Download original save | 下载原始存档 |
| 5 | `storage.export` | Export current work | 导出当前数据 |
| 6 | `storage.backupAndSave` | Back up original and save current work | 备份原存档并保存当前数据 |
| 7 | `storage.retry` | Retry saving | 重试保存 |
| 8 | `app.title` | WBS · Gantt — Project Control | WBS · Gantt —— 项目管控 |

## navigation and shell

| # | key | English | 中文 |
|---|-----|---------|------|
| 9 | `nav.gantt` | Gantt | 甘特图 |
| 10 | `nav.logs` | Logs / Notes | 日志 / 记事本 |
| 11 | `nav.manage` | Manage | 管理 |
| 12 | `nav.calendar` | Calendar | 日历 |
| 13 | `nav.settings` | Settings | 设置 |
| 14 | `sidebar.projects` | Projects | 项目 |
| 15 | `sidebar.allProjects` | All projects | 全部项目 |
| 16 | `sidebar.expandAll` | Expand all | 全部展开 |
| 17 | `sidebar.collapseAll` | Collapse all | 全部折叠 |
| 18 | `sidebar.editProject` | Edit project | 编辑项目 |
| 19 | `sidebar.export` | Export | 导出 |
| 20 | `sidebar.exportTitle` | Export JSON | 导出 JSON |
| 21 | `sidebar.import` | Import | 导入 |
| 22 | `sidebar.importTitle` | Import JSON | 导入 JSON |
| 23 | `sidebar.importFailed` | Import failed: {message} | 导入失败：{message} |

## shared vocabulary

| # | key | English | 中文 |
|---|-----|---------|------|
| 24 | `common.none` | — | — |
| 25 | `common.tbd` | TBD | 待定 |
| 26 | `common.cancel` | Cancel | 取消 |
| 27 | `common.save` | Save | 保存 |
| 28 | `common.create` | Create | 新建 |
| 29 | `common.delete` | Delete | 删除 |
| 30 | `common.edit` | Edit | 编辑 |
| 31 | `common.view` | View | 查看 |
| 32 | `common.close` | Close | 关闭 |
| 33 | `common.ok` | OK | 确定 |
| 34 | `common.gotIt` | Got it | 我知道了 |
| 35 | `common.confirm` | Confirm | 确认 |
| 36 | `common.confirmTitle` | Please confirm | 请确认 |
| 37 | `common.markDoneAsk` | Mark "{name}" as done? | 确认完成“{name}”？ |
| 38 | `common.unmarkDoneAsk` | Mark "{name}" as not done? | 确认取消完成“{name}”？ |
| 39 | `common.noticeTitle` | Notice | 提示 |
| 40 | `common.name` | Name | 名称 |
| 41 | `common.date` | Date | 日期 |
| 42 | `common.type` | Type | 类型 |
| 43 | `common.project` | Project | 项目 |
| 44 | `common.status` | Status | 状态 |
| 45 | `common.priority` | Priority | 优先级 |
| 46 | `common.progress` | Progress | 进度 |
| 47 | `common.description` | Description | 描述 |
| 48 | `common.noDescription` | No description. | 暂无描述。 |
| 49 | `common.tags` | Tags | 标签 |
| 50 | `common.tasks` | Tasks | 任务 |
| 51 | `common.task` | Task | 任务 |
| 52 | `common.start` | Start | 开始 |
| 53 | `common.end` | End | 结束 |
| 54 | `common.startDate` | Start date | 开始日期 |
| 55 | `common.endDate` | End date | 结束日期 |
| 56 | `common.history` | History | 历史 |
| 57 | `common.dependencies` | Dependencies | 依赖 |
| 58 | `common.wbs` | WBS | WBS |
| 59 | `common.prog` | Prog | 进度 |
| 60 | `common.expand` | Expand | 展开 |
| 61 | `common.collapse` | Collapse | 折叠 |
| 62 | `common.select` | Select | 选择 |
| 63 | `common.deselect` | Deselect | 取消选择 |
| 64 | `common.listSeparator` | ,  | 、 |
| 65 | `common.pathSeparator` |  ›  |  ›  |
| 66 | `common.unknownTask` | Unknown task | 未知任务 |
| 67 | `common.notes` | Notes… | 备注… |
| 68 | `common.targetProgress` | Target progress: {percent}% | 目标进度：{percent}% |
| 69 | `common.taskCount` | one: {count} task / other: {count} tasks | {count} 项任务 |
| 70 | `common.logCount` | one: {count} log / other: {count} logs | {count} 条日志 |
| 71 | `common.noteCount` | one: {count} note / other: {count} notes | {count} 条笔记 |

## statuses, priorities, task types

| # | key | English | 中文 |
|---|-----|---------|------|
| 72 | `status.todo` | To-do | 待办 |
| 73 | `status.notStarted` | Not started | 未开始 |
| 74 | `status.inProgress` | In progress | 进行中 |
| 75 | `status.completed` | Completed | 已完成 |
| 76 | `status.paused` | Paused | 已暂停 |
| 77 | `status.delayed` | Delayed | 已逾期 |
| 78 | `priority.low` | Low | 低 |
| 79 | `priority.medium` | Medium | 中 |
| 80 | `priority.high` | High | 高 |
| 81 | `priority.top` | Top | 最高 |
| 82 | `priority.title` | {level} priority | {level}优先级 |
| 83 | `type.phase` | Phase | 阶段性任务 |
| 84 | `type.longTerm` | Long-Term | 长期任务 |

## dates and periods

| # | key | English | 中文 |
|---|-----|---------|------|
| 85 | `time.today` | Today | 今天 |
| 86 | `time.tomorrow` | Tomorrow | 明天 |
| 87 | `time.thisWeek` | This week | 本周 |
| 88 | `time.yesterday` | Yesterday | 昨天 |
| 89 | `time.inDays` | one: in {count} day / other: in {count} days | {count} 天后 |
| 90 | `time.daysAgo` | one: {count} day ago / other: {count} days ago | {count} 天前 |
| 91 | `time.week` | W{count} | {count}周 |
| 92 | `time.quarter` | Q{count} | {count}季度 |
| 93 | `time.monthYear` | {month} {year} | {year}年{month} |
| 94 | `time.quarterYear` | Q{count} {year} | {year}年第{count}季度 |
| 95 | `time.rangeSeparator` |  –  |  –  |

## gantt

| # | key | English | 中文 |
|---|-----|---------|------|
| 96 | `gantt.view.day` | Day | 日 |
| 97 | `gantt.view.week` | Week | 周 |
| 98 | `gantt.view.month` | Month | 月 |
| 99 | `gantt.view.quarter` | Quarter | 季 |
| 100 | `gantt.view.year` | Year | 年 |
| 101 | `gantt.backToToday` | Back to Today | 回到今天 |
| 102 | `gantt.newTask` | New task | 新建任务 |

## the new-thing dialog

| # | key | English | 中文 |
|---|-----|---------|------|
| 103 | `new.title` | New | 新建 |
| 104 | `new.task` | Task | 任务 |
| 105 | `new.project` | Project | 项目 |
| 106 | `gantt.newTaskOrProject` | New task / project | 新建任务/项目 |
| 107 | `gantt.noProject` | A task has to live in a project — create one first. | 任务要放在项目里 —— 请先新建一个项目。 |
| 108 | `gantt.noProject.p1` | WBS-gantt manages projects and tasks much the way an operating system manages files — a directory tree. A project is the root directory at the very top, and every task filed under one is a file or a folder. A file has to live under a root, so a task needs a project chosen for it before it can be created. I do recommend reading the network of tasks you are about to build this way, because… that is how the software is designed. | WBS-gantt 管理项目和任务的方式与电脑操作系统管理文件的方式（目录树）很像。在这里，项目（project）是最顶层的根目录，而每个项目下属的所有任务都可以视作一个文件 / 文件夹。显然文件得存放在根目录下，所以在新建任务前，需要为其指定一个项目。我十分推荐你这样理解你未来即将构建的任务网络，因为……软件就是这么设计的。 |
| 109 | `gantt.noProject.p2` | Beyond giving a task somewhere to exist, a project is only a label for sorting. Read it as the “topic” of the tasks created under it: it gives them a category, so that they can be managed by category — which is the other reason to file your tasks under projects. | 除了为任务的存在提供一个地基之外，项目只是一个分类用的标签。不妨把它理解为在它下面建立的任务的「主题」。它为这些任务定义了一个类别，以便按类管理。所以从管理的角度来看，将任务分类在项目下也是十分必要的。 |
| 110 | `gantt.deleteTask` | Delete "{name}"? | 确定删除“{name}”？ |
| 111 | `gantt.deleteTaskWithSubtasks` | Delete "{name}" and all its subtasks? | 确定删除“{name}”及其所有子任务？ |
| 112 | `gantt.deleteTodos` | one: Delete {count} to-do task? / other: Delete {count} to-do tasks? | 确定删除 {count} 项待办任务？ |
| 113 | `gantt.deleteTodosWithSubtasks` | one: Delete {count} to-do task and its subtasks? / other: Delete {count} to-do tasks and their subtasks? | 确定删除 {count} 项待办任务及其子任务？ |
| 114 | `gantt.ongoingTitle` | {wbs} {name} — ongoing | {wbs} {name} —— 长期进行中 |
| 115 | `gantt.deadlineTitle` | ddl {date} | ddl {date} |
| 116 | `gantt.pickDate` | Click any date to open its day detail | 点击任意日期查看当天详情 |
| 117 | `gantt.writeLogForDay` | Write a log for this day | 为这一天写日志 |
| 118 | `gantt.moveToTopLevel` | Move to top level | 移到顶层 |
| 119 | `gantt.taskTree` | Task tree | 任务树 |
| 120 | `taskTree.taskCount` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 121 | `taskTree.subtasks` | one: {count} subtask / other: {count} subtasks | {count} 个子任务 |
| 122 | `gantt.editDone` | Done | 完成 |
| 123 | `gantt.editMode` | Edit mode | 编辑模式 |
| 124 | `gantt.todoEditMode` | To-do edit mode | 待办编辑模式 |
| 125 | `gantt.selected` | {count} selected | 已选 {count} 项 |
| 126 | `gantt.clearSelection` | Clear selection | 取消选择 |
| 127 | `gantt.setTodoMany` | one: Mark {count} task as to-do?\n\nIts dates, priority and progress are cleared. / other: Mark {count} tasks as to-do?\n\nTheir dates, priorities and progress are cleared. | 确定将这 {count} 个任务设为待办？\n\n它们的日期、优先级和进度将被清除。 |
| 128 | `gantt.setTodoManyWithSubtasks` | one: Mark {count} task and its {subs} unfinished subtask as to-do?\n\n / other: Mark {count} tasks and their {subs} unfinished subtasks as to-do?\n\n | 确定将这 {count} 个任务及其 {subs} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 129 | `gantt.deleteSelected` | one: Delete {count} task? / other: Delete {count} tasks? | 确定删除这 {count} 个任务？ |
| 130 | `gantt.deleteSelectedWithSubtasks` | one: Delete {count} task and its subtasks? / other: Delete {count} tasks and their subtasks? | 确定删除这 {count} 个任务及其子任务？ |
| 131 | `gantt.pauseMany` | one: Pause {count} task? / other: Pause {count} tasks? | 确定暂停 {count} 项任务？ |
| 132 | `gantt.resumeMany` | one: Resume {count} task? / other: Resume {count} tasks? | 确定恢复 {count} 项任务？ |
| 133 | `gantt.archiveMany` | one: Archive {count} task? / other: Archive {count} tasks? | 确定归档 {count} 项任务？ |
| 134 | `gantt.archiveManyWithSubtasks` | one: Archive {count} task? Its subtasks are filed away with it. / other: Archive {count} tasks? Their subtasks are filed away with them. | 确定归档 {count} 项任务？属于它们的子任务也会连带归档。 |
| 135 | `gantt.dragMany` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 136 | `gantt.moved` | Moved {what} | 已移动 {what} |
| 137 | `gantt.undoTodo` | Marked {what} as to-do | 已将 {what}设为待办 |
| 138 | `gantt.undoStart` | Started {what} | 已开始 {what} |
| 139 | `gantt.undoPause` | Paused {what} | 已暂停 {what} |
| 140 | `gantt.undoPostpone` | Postponed {what} | 已延期 {what} |
| 141 | `gantt.undoResume` | Resumed {what} | 已恢复 {what} |
| 142 | `gantt.undoDelete` | Deleted {what} | 已删除 {what} |
| 143 | `gantt.undoArchive` | Archived {what} | 已归档 {what} |
| 144 | `gantt.undoUnarchive` | Brought back {what} | 已取消归档 {what} |
| 145 | `gantt.undo` | Undo | 撤销 |
| 146 | `gantt.undoSeconds` | ({seconds}) | （{seconds}） |

## history

| # | key | English | 中文 |
|---|-----|---------|------|
| 147 | `history.title` | History | 操作历史 |
| 148 | `history.now` | Opened the app | 本次打开 |
| 149 | `history.empty` | Nothing has changed the board yet. | 还没有改动过看板。 |
| 150 | `history.count` | one: {count} item / other: {count} items | {count} 项 |
| 151 | `history.autoAdd` | Added {count} | 新增 {count} 项 |
| 152 | `history.autoRemove` | Removed {count} | 删除 {count} 项 |
| 153 | `history.autoChange` | Changed {count} | 改动 {count} 项 |
| 154 | `history.added` | Added | 新增 |
| 155 | `history.removed` | Removed | 删除 |
| 156 | `history.changed` | Changed | 改动 |
| 157 | `history.projectAdded` | Projects added | 新增项目 |
| 158 | `history.projectRemoved` | Projects removed | 删除项目 |
| 159 | `history.projectChanged` | Projects changed | 项目改动 |
| 160 | `history.more` | … and {count} more | …… 还有 {count} 项 |
| 161 | `history.newTask` | Added {what} | 新建 {what} |
| 162 | `history.editTask` | Edited {what} | 编辑 {what} |
| 163 | `history.newProject` | Added project {what} | 新建项目 {what} |
| 164 | `history.editProject` | Edited project {what} | 编辑项目 {what} |
| 165 | `history.deleteProject` | Deleted project {what} | 删除项目 {what} |
| 166 | `history.move` | Moved {what} | 移动 {what} |
| 167 | `history.moveNewProject` | Moved {what} into a new project | 把 {what} 放进新建的项目 |
| 168 | `history.promoteTask` | Made {what} a project | 把 {what} 升为项目 |
| 169 | `history.outdent` | Moved {what} to top level | 把 {what} 移到顶层 |
| 170 | `history.folderRename` | Renamed a to-do folder | 待办文件夹改名 |

## to-dos

| # | key | English | 中文 |
|---|-----|---------|------|
| 171 | `todo.folderName` | To-dos | 待办 |
| 172 | `todo.folder` | To-dos ({count}) | 待办（{count}） |
| 173 | `todo.startTask` | Start task | 开始任务 |
| 174 | `todo.start` | Start | 开始 |
| 175 | `todo.next` | Next → | 下一个 → |
| 176 | `todo.restoreMany` | one: Restore {count} to-do / other: Restore {count} to-dos | 恢复 {count} 项待办 |
| 177 | `todo.saveAll` | Save all ({count}) | 全部保存（{count}） |
| 178 | `todo.hasSubtasks` | {name} has subtasks, so its dates are decided by them. Restore those first, or set a priority here and let the dates follow. | {name} 有子任务，它的日期由子任务决定。请先恢复那些子任务；也可以只在此设定优先级，让日期随后自动跟进。 |
| 179 | `todo.renameFolder` | Name this folder | 给文件夹起名 |
| 180 | `todo.folderPlaceholder` | Folder name | 文件夹名 |
| 181 | `todo.restoreAll` | Restore all {count} | 恢复全部 {count} 项 |
| 182 | `todo.deleteAll` | Delete all {count} | 删除全部 {count} 项 |

## archive

| # | key | English | 中文 |
|---|-----|---------|------|
| 183 | `archive.title` | Archived ({count}) | 已归档（{count}） |
| 184 | `archive.badge` | Archived | 已归档 |
| 185 | `archive.restoreAll` | Unarchive all {count} | 全部取消归档（{count} 项） |
| 186 | `archive.empty` | Nothing archived yet. | 还没有归档的任务 |

## tasks

| # | key | English | 中文 |
|---|-----|---------|------|
| 187 | `task.add` | Add | 添加 |
| 188 | `task.addSubtask` | Add subtask | 添加子任务 |
| 189 | `task.addSibling` | Add sibling task | 添加同级任务 |
| 190 | `task.new` | New task | 新建任务 |
| 191 | `task.edit` | Edit task | 编辑任务 |
| 192 | `task.namePlaceholder` | Task name | 任务名称 |
| 193 | `task.parent` | Parent | 父任务 |
| 194 | `task.topLevel` | — Top level — | 最顶层任务 |
| 195 | `task.createAsTodo` | Create as to-do | 创建为待办 |
| 196 | `task.todoNote` | This is a to-do: unscheduled work. It sits last among its siblings inside a {toDos} folder until you give it a schedule with {startTask} in the detail panel. | 这是一项待办：尚未排期的工作。它会排在同级任务末尾的 {toDos} 文件夹中，直到你在详情面板里用 {startTask} 为它安排时间。 |
| 197 | `task.endDateLocked` | The end date is decided by the subtask that ends last — change that subtask’s end date instead. | 结束日期由最晚结束的子任务决定，请改为修改那个子任务的结束日期。 |
| 198 | `task.startDateLocked` | The start date is decided by the subtask that starts first — change that subtask’s start date instead. | 开始日期由最早开始的子任务决定，请改为修改那个子任务的开始日期。 |
| 199 | `task.strictProgress` | Turn off daily logs (not recommended) | 取消日志限制（不推荐） |
| 200 | `task.deadline` | ddl | ddl |
| 201 | `task.deadlineOptional` | ddl (optional) | ddl（可选） |
| 202 | `task.deadlineHint` | The end date is the finish you plan for; the ddl is the literal deadline. A ddl adds a hard constraint and is used by the overdue checks and reminders elsewhere. | 结束日期是用户根据规划自定义的任务期望结束日期，而 ddl 是字面意义上的 ddl。填写 ddl 之后会为任务提供更详细的信息，并在其它地方纳入计算或进行提示。 |
| 203 | `task.overdueMark` | This task is already overdue — mark as | 该任务已逾期 —— 标记为 |
| 204 | `task.tagsPlaceholder` | study, health | 学习, 健康 |
| 205 | `task.tagsLabel` | Tags (comma separated) | 标签（用逗号分隔） |
| 206 | `task.subtaskCount` | one: {count} subtask / other: {count} subtasks | {count} 项子任务 |
| 207 | `task.hide` | Hide | 收起 |
| 208 | `task.hidden` | Hidden. | 已收起 |
| 209 | `task.tree` | Task tree | 所在任务树 |
| 210 | `task.treeFocus` | Show one branch | 只展示一支 |
| 211 | `task.pendingLogs` | Still to log | 今日待填 |
| 212 | `task.progressMode` | Progress mode | 进度模式 |
| 213 | `task.modeStrict` | Log-based | 严格模式 |
| 214 | `task.modeAuto` | Simplified (ticked per day) | 简化模式 |
| 215 | `task.modeRolledUp` | From subtasks | 由子任务汇总 |
| 216 | `optOut.title` | Go without log supervision? | 确定采取简化模式(脱离日志系统)吗？ |
| 217 | `optOut.p1` | Without the log system this task will *keep no history at all*, and the Logs page will not manage it. | 脱离日志系统则该任务将*不会拥有历史日志*，且不会在 log 页面里被统一管理。 |
| 218 | `optOut.p2` | It will use a *deliberately crude* way of counting progress: each day you only have to *click a button by hand* to confirm you did it, and the system then accumulates progress as elapsed days ÷ total days. No click, no accumulation. If you miss a day, later daily reports will remind you, and you can leave it for now or put the confirmation in — which is one more click. | 本任务将采用一种*极度简化*的进度计算方式，即每日只需要*手动点击按钮*来确认完成，然后系统自动按已过日期 ÷ 总日期进行进度累计，否则不予累计进度。如果你有某日忘了点按钮，则会在以后的日报里对你进行提醒，你可以按实际需求暂时忽略／将确认补上，也就是再点一下按钮的事。 |
| 219 | `optOut.p3` | This also means the task */may not reflect its real progress*/, and the supervision over whether you did a given day’s work is */close to zero*/. **//Please make sure you have enough self-discipline to go without the log system’s supervision**//. | 这也就意味着，本任务可能将*/无法精确反应任务实际进度*/，且确认某日本任务完成的*/监督力度几乎为 0 */。**//请确保你有足够的自律能力脱离日志系统监督**//。 |
| 220 | `optOut.back` | Back | 返回 |
| 221 | `optOut.confirm` | Turn logs off anyway | 仍要取消 |
| 222 | `day.tick` | Mark this day as done | 把这一天标记为完成 |
| 223 | `task.pausedNote` | one: Paused. Started {start} · paused on {paused} · {count} day elapsed. / other: Paused. Started {start} · paused on {paused} · {count} days elapsed. | 已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。 |
| 224 | `task.resume` | Resume | 恢复 |
| 225 | `task.endPostponed` | End (postponed) | 结束（已顺延） |
| 226 | `task.setAsTodo` | Set as to-do | 设为待办 |
| 227 | `task.pauseConfirm` | Pause "{name}"? | 确定暂停“{name}”？ |
| 228 | `task.resumeConfirm` | Resume "{name}"? | 确定恢复“{name}”？ |
| 229 | `task.archive` | Archive | 归档 |
| 230 | `task.unarchive` | Unarchive | 取消归档 |
| 231 | `task.archiveConfirm` | Archive "{name}"? | 确定归档“{name}”？ |
| 232 | `task.archiveWithSubtasks` | Archive "{name}"? Its subtasks are filed away with it. | 确定归档“{name}”？属于它的子任务也会连带归档。 |
| 233 | `task.pause` | Pause task | 暂停任务 |
| 234 | `task.pauseReason` | Pause reason | 暂停理由 |
| 235 | `task.pauseHistory` | Pause history ({count}) | 暂停记录（{count}） |
| 236 | `task.pauseEntry` | Paused {from} → resumed {to} | 暂停于 {from} → 恢复于 {to} |
| 237 | `task.postpone` | Postpone task | 延期任务 |
| 238 | `task.postponeTitle` | Postpone "{name}" | 延期“{name}” |
| 239 | `task.postponeCurrent` | Current end: {date} | 当前结束于 {date} |
| 240 | `task.postponeNewEnd` | New end date | 新的结束日期 |
| 241 | `task.postponeReason` | Reason | 延期理由 |
| 242 | `task.postponeLater` | The new end date must be later than the current one. | 新的结束日期必须晚于当前结束日期。 |
| 243 | `task.postponeConfirm` | Postpone | 确认延期 |
| 244 | `task.postponeHistory` | Postpone history ({count}) | 延期记录（{count}） |
| 245 | `task.heat.title` | Completion | 完成情况 |
| 246 | `task.heat.done` | Done | 已完成 |
| 247 | `task.heat.pending` | Not done | 未完成 |
| 248 | `task.heat.none` | Not scheduled | 无排期 |
| 249 | `task.heat.count` | one: {count} task done / other: {count} tasks done | 完成 {count} 项任务 |
| 250 | `task.heat.less` | Less | 少 |
| 251 | `task.heat.more` | More | 多 |
| 252 | `task.setAsTodoConfirm` | Mark "{name}" as to-do?\n\nIts dates, priority and progress are cleared. | 确定将“{name}”设为待办？\n\n它的日期、优先级和进度将被清除。 |
| 253 | `task.setAsTodoConfirmMany` | one: Mark "{name}" and its {count} unfinished subtask as to-do?\n\n / other: Mark "{name}" and its {count} unfinished subtasks as to-do?\n\n | 确定将“{name}”及其 {count} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 254 | `task.markedCompleted` | Marked as completed | 已标记为完成 |

## logs

| # | key | English | 中文 |
|---|-----|---------|------|
| 255 | `log.write` | Write log | 写日志 |
| 256 | `log.editProgress` | Correct progress | 修改进度 |
| 257 | `log.label` | Log | 日志 |
| 258 | `log.contentPlaceholder` | What did you work on? | 今天做了什么？ |
| 259 | `log.editedAt` | edited {time} | 编辑于 {time} |
| 260 | `log.hint` | Each line is an item; Tab indents a sub-item, Shift+Tab outdents. | 每行是一个条目；Tab 键缩进为子条目，Shift+Tab 反向缩进。 |
| 261 | `log.progressAdd` | Progress added (%) | 进度增加（%） |
| 262 | `log.progressAfterDay` | Progress becomes (%) | 进度累积至（%） |
| 263 | `log.currentProgress` | Currently at {percent}% | 目前进度 {percent}% |
| 264 | `log.byDays` | Advance one day | 自动推进一日 |
| 265 | `log.byDaysHint` | Advance one day = add (1 ÷ total days) × 100% of the progress. If less than a fifth of a day’s share is left after that, the task is taken as complete. | 自动推进一日＝增加（1 ÷ 总日数）× 100% 的进度。如果自动推进一日后剩余进度小于一日进度的 1/5，则会默认任务完成。 |
| 266 | `log.progressRequired` | Fill in at least one of the two — put 0 under “{add}” if nothing moved. | 两个格子至少填一个 —— 没进展就在「{add}」里填 0。 |
| 267 | `log.progressBackward` | Progress cannot go backwards — that lands below the figure it started the day at. | 进度不能往回填 |
| 268 | `log.task` | Task | 任务 |
| 269 | `logs.all` | All logs | 全部日志 |
| 270 | `logs.empty` | No logs yet. | 暂无日志。 |
| 271 | `logs.moreTasks` | one: +{count} more task / other: +{count} more tasks | 以及 {count} 项任务 |
| 272 | `logs.tabLogs` | Logs | 日志 |

## notes

| # | key | English | 中文 |
|---|-----|---------|------|
| 273 | `notes.title` | Notes | 记事本 |
| 274 | `notes.empty` | Nothing written yet. | 空空如也 |
| 275 | `notes.add` | Write something | 写点什么 |
| 276 | `notes.placeholder` | Whatever you want to keep. | 写点随想 |
| 277 | `notes.none` | None yet. | 暂无 |

## sticky notes (the corkboard)

| # | key | English | 中文 |
|---|-----|---------|------|
| 278 | `sticky.title` | Notes | 便签 |
| 279 | `sticky.defaultName` | Label {n} | 标签 {n} |
| 280 | `sticky.name` | Name | 名称 |
| 281 | `sticky.rename` | Rename note | 重命名便签 |
| 282 | `sticky.expandNote` | Expand note | 展开便签 |
| 283 | `sticky.add` | New note | 新建便签 |
| 284 | `sticky.placeholder` | Write something… | 写点什么… |
| 285 | `sticky.delete` | Delete note | 删除便签 |
| 286 | `sticky.deleteConfirm` | Delete this note? Its text cannot be recovered. | 删除这张便签？文字无法恢复。 |
| 287 | `sticky.collapse` | Collapse notes | 收起便签 |
| 288 | `sticky.expand` | Open notes | 展开便签 |
| 289 | `sticky.empty` | No notes on the board yet. | 板上还没有便签。 |
| 290 | `sticky.drag` | Drag this note | 拖动这张便签 |
| 291 | `sticky.bold` | Bold | 粗体 |
| 292 | `sticky.sizeSmall` | Smaller text | 小字号 |
| 293 | `sticky.sizeDefault` | Default text size | 默认字号 |
| 294 | `sticky.sizeLarge` | Larger text | 大字号 |
| 295 | `sticky.textColor` | Text colour | 文字颜色 |
| 296 | `sticky.resize` | Resize note | 调整便签大小 |

## calendar

| # | key | English | 中文 |
|---|-----|---------|------|
| 297 | `calendar.prevMonth` | Previous month | 上个月 |
| 298 | `calendar.nextMonth` | Next month | 下个月 |
| 299 | `calendar.cellLabel` | {date}: {due}, {starting}; {coverage} | {date}：{due}，{starting}；{coverage} |
| 300 | `calendar.dueCount` | {count} due | {count} 项到期 |
| 301 | `calendar.startingCount` | {count} starting | {count} 项开始 |
| 302 | `calendar.coverage.future` | not yet due | 尚未到期 |
| 303 | `calendar.coverage.clear` | no logs due | 无日志义务 |
| 304 | `calendar.coverage.partial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 305 | `calendar.coverage.full` | all {count} logs written | {count} 项日志已全部记录 |
| 306 | `calendar.more` | +{count} more | 还有 {count} 项 |
| 307 | `calendar.milestoneTitle` | {kind}{strict} — {name}{logged} | {kind}{strict} —— {name}{logged} |
| 308 | `calendar.milestone.due` | Due | 到期 |
| 309 | `calendar.milestone.starts` | Starts | 开始 |
| 310 | `calendar.milestone.strict` |  * |  * |
| 311 | `calendar.milestone.logged` |  · logged this day |  · 当天已记录 |

## day detail

| # | key | English | 中文 |
|---|-----|---------|------|
| 312 | `day.strictLogs` | Logs | 日志 |
| 313 | `day.notYetDue` | Not yet due | 尚未到期 |
| 314 | `day.noStrictScheduled` | No logs due | 当天无日志义务 |
| 315 | `day.allLogged` | Everything logged | 已完成所有日志填写 |
| 316 | `day.nothingLogged` | Nothing logged yet | 尚未记录任何日志 |
| 317 | `day.stillMissing` | {count} still missing | 还差 {count} 项 |
| 318 | `day.noStrictTasksScheduled` | No logs due | 当天没有日志义务 |
| 319 | `day.ringPartial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 320 | `day.taskCount` | one: {count} task on this day / other: {count} tasks on this day | 当天有 {count} 项任务 |
| 321 | `day.tasksBreakdown` | {strict} with logs · {other} other | {strict} 有日志 · {other} 其他 |
| 322 | `day.taskList` | Tasks | 任务清单 |
| 323 | `day.sort` | Sort | 排序 |
| 324 | `day.sortStatus` | Status | 按状态 |
| 325 | `day.sortPriority` | Priority | 按优先级 |
| 326 | `day.nothingScheduled` | Nothing scheduled on this day. | 当天没有排期。 |
| 327 | `day.logMark` | A * marks a task that owes a daily log. | 带 * 的任务有日志义务。 |
| 328 | `day.readLogs` | Read this day’s logs | 查看当天的日志 |
| 329 | `day.readLogsCount` | Read this day’s logs ({count}) | 查看当天的日志（{count}） |
| 330 | `day.noProgress` | No progress | 无进度 |
| 331 | `day.viewTask` | View task → | 查看任务 → |

## the day's plan and the timetable (Today page)

| # | key | English | 中文 |
|---|-----|---------|------|
| 332 | `plan.button` | Plan | 规划 |
| 333 | `plan.adjust` | Adjust | 调整 |
| 334 | `plan.title` | Plan {date} | 规划 {date} |
| 335 | `plan.selectTasks` | Tick the tasks for today and fill in the hours | 勾选今天要做的任务，填上预计小时 |
| 336 | `plan.save` | Save plan | 保存安排 |
| 337 | `plan.restDay` | Rest day | 休息日 |
| 338 | `plan.restDayEmpty` | Nothing planned for this day. | 今天没有安排任务。 |
| 339 | `plan.restoreAuto` | Back to automatic | 恢复自动 |
| 340 | `plan.load` | {used} / {capacity} h scheduled | 已排 {used} / {capacity} 小时 |
| 341 | `plan.over` | over | 超载 |
| 342 | `plan.notScheduled` | not scheduled | 当天未排期 |
| 343 | `plan.noCandidates` | No tasks to choose from for this day. | 当天没有可安排的任务。 |
| 344 | `plan.selected` | {count} selected | 已选 {count} 项 |
| 345 | `plan.promptTitle` | Today’s plan | 今天的安排 |
| 346 | `plan.freeTime` | How much free time do you have today? | 今天有多少空闲时间？ |
| 347 | `plan.later` | Fill in later | 稍后再填 |
| 348 | `plan.startToday` | Start today | 开启今日 |
| 349 | `plan.promptTag` | Today is not planned yet — click to plan | 今天还没有安排，点击规划 |
| 350 | `plan.promptTab` | Plan today | 今日待规划 |
| 351 | `plan.hours` | Hours today | 今天几小时 |
| 352 | `plan.default` | default | 默认 |
| 353 | `plan.setDefault` | Use this as the default hours | 设为默认工时 |
| 354 | `load.label` | Load | 负载 |
| 355 | `load.used` | {hours} h scheduled | 已排 {hours} 小时 |
| 356 | `load.available` | Available | 可用 |
| 357 | `load.left` | {hours} h left | 还剩 {hours} 小时 |
| 358 | `load.overBy` | {hours} h over | 超载 {hours} 小时 |
| 359 | `load.unfilled` | Not set | 未填写 |
| 360 | `load.unknown` | Cannot calculate | 无法计算 |
| 361 | `load.reference` | Reference | 参考值 |
| 362 | `schedule.title` | Schedule | 日程 |
| 363 | `schedule.capacity` | Available hours | 可用小时 |
| 364 | `schedule.load` | {used} / {capacity} h | {used} / {capacity} 小时 |
| 365 | `schedule.over` | over | 超载 |
| 366 | `schedule.addTitle` | New block | 新建日程 |
| 367 | `schedule.editTitle` | Edit block | 编辑日程 |
| 368 | `schedule.kind` | Type | 类型 |
| 369 | `schedule.kind.task` | Task | 任务时段 |
| 370 | `schedule.kind.event` | Event | 自由事件 |
| 371 | `schedule.kind.deadline` | Deadline | 截止时间 |
| 372 | `schedule.task` | Task | 任务 |
| 373 | `schedule.noTask` | No task | 不关联任务 |
| 374 | `schedule.name` | Title | 标题 |
| 375 | `schedule.start` | Start | 开始 |
| 376 | `schedule.end` | End | 结束 |
| 377 | `schedule.invalidTime` | The end must be later than the start. | 结束时间必须晚于开始时间。 |
| 378 | `schedule.invalidName` | Add a title or choose a task. | 填标题或选一个任务。 |
| 379 | `schedule.openTask` | Open task | 打开任务 |

## chores (the Today page)

| # | key | English | 中文 |
|---|-----|---------|------|
| 380 | `chore.section` | Chores | 临时事务 |
| 381 | `chore.placeholder` | Add a chore… | 添加临时事务… |
| 382 | `chore.enterHint` | Type the name in the box and press Enter to create it. | 请在文本框内直接输入事项名称，按回车确认创建。 |
| 383 | `chore.emptyToday` | Nothing on hand today. | 今天没有临时事务。 |
| 384 | `chore.emptyTomorrow` | Nothing lined up for tomorrow. | 明天还没有安排。 |
| 385 | `chore.noneOnDay` | No chores on this day. | 当天没有临时事务。 |
| 386 | `chore.stillOpen` | {count} still open | 还有 {count} 项 |
| 387 | `chore.allDone` | All done | 全部完成 |
| 388 | `chore.edit` | Edit chore | 编辑临时事务 |
| 389 | `chore.title` | Chore | 内容 |
| 390 | `chore.note` | Note | 备注 |
| 391 | `chore.notePlaceholder` | Optional | 可不填 |
| 392 | `chore.day` | Day | 日期 |
| 393 | `chore.slot` | Part of day | 时段 |
| 394 | `chore.slot.none` | Anytime | 不限 |
| 395 | `chore.slot.dawn` | Early morning | 凌晨 |
| 396 | `chore.slot.am` | Morning | 上午 |
| 397 | `chore.slot.pm` | Afternoon | 下午 |
| 398 | `chore.slot.eve` | Evening | 晚上 |
| 399 | `chore.time` | Exact time | 时间点 |
| 400 | `chore.timePlaceholder` | e.g. 9:30 / 9:30pm / 21:30 | 如 9:30 / 9:30pm / 21:30 |
| 401 | `chore.timeHint` | 12-hour with am/pm, or 24-hour | 12 小时制带 am/pm，或直接写 24 小时制 |
| 402 | `chore.timeUnreadable` | Not a time we can read | 看不懂这个时间 |
| 403 | `chore.timeMismatch` | {time} is in {timeSlot}, not the {slot} picked above. Which should it use? | {time} 属于「{timeSlot}」，和上面选的「{slot}」不一致。以哪个为准？ |
| 404 | `chore.preferTime` | Switch to {slot} | 改为{slot} |
| 405 | `chore.preferSlot` | Keep {slot} | 保持{slot} |
| 406 | `chore.carriedTitle` | Meant for {date} | 原本定于 {date} |
| 407 | `habit.section` | Routine | 日常安排 |
| 408 | `habit.none` | Nothing daily yet. | 还没有每日项。 |
| 409 | `habit.edit` | Edit daily item | 编辑每日项 |
| 410 | `habit.title` | Item | 内容 |
| 411 | `habit.deleteAsk` | Delete "{name}"? Every day you ticked it goes with it. | 确定删除“{name}”？它的历史完成等记录也会一并删除 |
| 412 | `habit.new` | New routine | 新建日常安排 |
| 413 | `habit.note` | Note | 备注 |
| 414 | `habit.notePlaceholder` | Optional | 可不填 |
| 415 | `habit.weekdays` | Days | 星期几 |
| 416 | `habit.everyDay` | Every day | 每天 |
| 417 | `habit.endDate` | Ends | 结束日期 |
| 418 | `habit.noEndDate` | Leave empty to keep going. | 选填。 |
| 419 | `habit.paused` | Suspended | 停用 |
| 420 | `habit.parent` | Parent | 上级日常安排 |
| 421 | `habit.topLevel` | — Top level — | 最顶层日常安排 |
| 422 | `habit.addSubtask` | Add sub-routine | 添加子日常安排 |

## manage

| # | key | English | 中文 |
|---|-----|---------|------|
| 423 | `manage.overall` | Overall | 总览 |
| 424 | `manage.heat` | Completion heatmap | 完成热力图 |
| 425 | `manage.subtasks` | Subtasks | 子任务 |
| 426 | `manage.parentTasks` | one: {count} parent task / other: {count} parent tasks | {count} 项父任务 |
| 427 | `manage.upcoming` | Upcoming (7 days) | 未来 7 天 |
| 428 | `manage.overdue` | Overdue | 已逾期 |
| 429 | `manage.deleteProject` | Delete project "{name}" and all its tasks? | 确定删除项目“{name}”及其全部任务？ |
| 430 | `manage.openInGantt` | Open in Gantt → | 在甘特图中打开 → |
| 431 | `manage.comingSoon` | Coming soon | 即将开始 |
| 432 | `manage.allStatuses` | All statuses | 全部状态 |
| 433 | `manage.filteredCount` | one: {filtered} of {count} task / other: {filtered} of {count} tasks | 共 {count} 项任务，显示 {filtered} 项 |
| 434 | `manage.empty` | Nothing here. | 暂无内容。 |
| 435 | `manage.sub.active` | active | 进行中 |
| 436 | `manage.sub.tracked` | in total | 全部项目 |
| 437 | `manage.sub.done` | done | 已完成 |
| 438 | `manage.sub.paused` | paused | 已暂停 |
| 439 | `manage.sub.startsIn7` | starts in 7 days | 将在 7 天内开始 |
| 440 | `manage.sub.pastDue` | past due | 已过期 |
| 441 | `manage.sub.pastDueDueSoon` | past due · {count} due soon | 已过期 · {count} 项即将到期 |
| 442 | `manage.sub.unscheduled` | unscheduled | 未排期 |
| 443 | `manage.countCompleted` | {count} completed | {count} 项已完成 |
| 444 | `manage.countOpen` | {count} open | {count} 项未完成 |

## projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 445 | `project.heading` | Project | 项目 |
| 446 | `project.color` | Color | 颜色 |
| 447 | `project.done` | Done | 已完成 |
| 448 | `project.open` | Open | 未完成 |

## merging projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 449 | `project.manage` | Hierarchy | 层级管理器 |
| 450 | `project.moveMode` | Project move mode (if any) | 项目移动方式（如涉及） |
| 451 | `project.moveModeFolder` | A parent task | 变成父任务 |
| 452 | `project.moveModeFlat` | At the top level | 直接铺平 |

## the move dialog

| # | key | English | 中文 |
|---|-----|---------|------|
| 453 | `move.sources` | Move | 将 |
| 454 | `move.target` | Into | 放到 |
| 455 | `move.newProject` | New project | 创建为新项目 |
| 456 | `move.newProjectOr` | or | 或 |
| 457 | `move.newProjectName` | New project | 新项目 |
| 458 | `move.confirm` | Move | 移动 |

## settings

| # | key | English | 中文 |
|---|-----|---------|------|
| 459 | `settings.language` | Language | 语言 |
| 460 | `settings.languageHint` | The language of the interface. | 界面显示所用的语言。 |
| 461 | `settings.theme` | Theme | 主题 |
| 462 | `settings.themeHint` | A whole colour scheme — surfaces, text and the colours that carry meaning. | 一整套配色方案 —— 包括底面、文字，以及承载含义的状态色。 |
| 463 | `settings.themeNote` | Green means done and red means late in every theme; the palettes differ in their surfaces and accent, so a status keeps its meaning whichever one you pick. | 在每一套主题里，绿都代表完成、红都代表逾期。各套之间变化的是底面与强调色，所以无论选哪套，状态的含义都不变。 |
| 464 | `settings.active` | Current | 当前 |
| 465 | `settings.version` | Version | 版本 |
| 466 | `settings.versionHint` | The desktop app checks for updates on every launch. | 桌面版每次启动会自动检查更新。 |
| 467 | `settings.releaseHistory` | Release history | 历史版本 |

## feedback

| # | key | English | 中文 |
|---|-----|---------|------|
| 468 | `feedback.title` | Feedback | 意见反馈 |
| 469 | `feedback.hint` | Found a bug, want a feature, or something just feels wrong? Write it here. The app version and OS are attached to the message to help narrow it down. | 遇到 bug、想加功能，或者哪里用着别扭，写在这里。发送时会附上应用版本和系统信息，方便定位。 |
| 470 | `feedback.placeholder` | What is on your mind? | 写下你的想法… |
| 471 | `feedback.copy` | Copy | 复制内容 |
| 472 | `feedback.copied` | Copied | 已复制 |
| 473 | `feedback.copyFailed` | Could not copy — select the text manually | 复制失败，请手动选中文字 |
| 474 | `feedback.address` | Or write to | 也可以直接发到 |
| 475 | `feedback.subject` | Feedback for WBS · Gantt | 对 WBS · Gantt 的意见 |
| 476 | `feedback.github` | Submit on GitHub | 在 GitHub 上提交 |
| 477 | `feedback.githubHint` | Needs a GitHub account, and you must stay signed in in your browser. | 需要 GitHub 账号，并在浏览器里保持登录。 |

## reminders

| # | key | English | 中文 |
|---|-----|---------|------|
| 478 | `settings.reminder` | Reminders | 提醒 |
| 479 | `settings.reminderWebNote` | Reminders are sent by the desktop app — it is the only build that can post to PushPlus. In a browser there is nothing here to set up. | 提醒由桌面版发出 —— 只有桌面版能把消息送到 PushPlus。浏览器版这里没有可设置的东西。 |
| 480 | `settings.reminderOn` | Desktop notifications are on by default. Keep WBS Gantt running in the background. | 桌面弹窗通知默认开启，请保持 WBS-gantt 在电脑后台运行。 |
| 481 | `settings.reminderWechat` | Sync notifications to personal WeChat | 将通知/提醒同步到个人微信 |
| 482 | `settings.reminderTime` | Send at | 发送时间 |
| 483 | `settings.reminderToken` | PushPlus token | PushPlus 令牌 |
| 484 | `settings.reminderPushplusNote` | WBS Gantt relies on PushPlus to sync notifications to WeChat.\nActivating that route means paying PushPlus ¥3.50 for real-name verification, so skipping it is entirely reasonable. | WBS-gantt 依赖 pushplus 在微信同步通知。\n不过，激活该途径需要向 pushplus 支付 3.5 元以完成实名认证。因而放弃配置该途径也是完全可行的。 |
| 485 | `settings.reminderTokenHint` | Sign in at pushplus.plus and paste the token from the top of the page here. | 在 pushplus.plus 扫码登录，并把页面顶部的令牌(token)复制在这里 |
| 486 | `settings.reminderOpen` | Open pushplus.plus | 打开 pushplus.plus |
| 487 | `settings.reminderTest` | Send a test | 发一条试试 |
| 488 | `settings.reminderPreview` | Preview noon’s | 预览中午的 |
| 489 | `settings.reminderSending` | Sending… | 发送中… |
| 490 | `settings.reminderSent` | Sent. | 已发出。 |
| 491 | `settings.backgroundAppOnly` | Without it, reminders only go out while this window happens to be open. | 不装的话，只有这个窗口开着的时候才会发。 |
| 492 | `settings.autostart` | Start with Windows | 开机自启动 |
| 493 | `settings.closeToTray` | Minimize to tray on close | 关闭时最小化到托盘 |
| 494 | `tray.open` | Open WBS Gantt | 打开看板 |
| 495 | `tray.quit` | Quit | 退出 |
| 496 | `reminder.greeting.dawn` | Still up | 强啊传奇耐熬王 |
| 497 | `reminder.greeting.early` | Good morning | 早上好 |
| 498 | `reminder.greeting.morning` | Good morning | 上午好 |
| 499 | `reminder.greeting.noon` | Midday | 中午好 |
| 500 | `reminder.greeting.afternoon` | Good afternoon | 下午好 |
| 501 | `reminder.greeting.dusk` | End of the day | 傍晚了 |
| 502 | `reminder.greeting.evening` | Good evening | 晚上好 |
| 503 | `reminder.greeting.night` | Late night | 夜深了 |
| 504 | `reminder.closing.dawn` |  | ⟨空⟩ |
| 505 | `reminder.closing.early` |  | ⟨空⟩ |
| 506 | `reminder.closing.morning` |  | ⟨空⟩ |
| 507 | `reminder.closing.noon` |  | ⟨空⟩ |
| 508 | `reminder.closing.afternoon` |  | ⟨空⟩ |
| 509 | `reminder.closing.dusk` |  | ⟨空⟩ |
| 510 | `reminder.closing.evening` |  | ⟨空⟩ |
| 511 | `reminder.closing.night` |  | ⟨空⟩ |
| 512 | `reminder.starting` | Starting today | 今天该开始 |
| 513 | `reminder.dueSoon` | Coming up | 即将到期 |
| 514 | `reminder.reportTitle` | Daily report | 日报 |
| 515 | `reminder.reportEmpty` | Nothing outstanding today. | 今日无事 |
| 516 | `reminder.reportYesterday` | Yesterday | 昨日 |
| 517 | `reminder.reportToday` | Today | 今天 |
| 518 | `reminder.reportRate` | Completion | 完成率 |
| 519 | `reminder.groupTasks` | Tasks | 任务清单 |
| 520 | `reminder.groupDeadlines` | Due & overdue | 到期与逾期 |
| 521 | `reminder.testTitle` | WBS Gantt — test message | 看板 —— 测试消息 |
| 522 | `reminder.testBody` | If you are reading this in WeChat, reminders are working. | 你能在微信里看到这条，就说明提醒已经配好了。 |
| 523 | `reminder.nudgeLogs` | Remember to write logs for the tasks you have finished. | 记得为已经完成的任务填写日志。 |
| 524 | `reminder.nudgeDebt` | {count} waiting on you — | 还有 {count} 项事项待处理，其中： |
| 525 | `reminder.nudgeDebtLine` | - {count} {label} | - {count} 项{label} |
| 526 | `reminder.nudgeTasks` | tasks | 任务 |
| 527 | `reminder.ack` | Got it | 我知道了 |
| 528 | `slot.early` | Morning | 早上 |
| 529 | `slot.noon` | Noon | 中午 |
| 530 | `slot.dusk` | Evening | 傍晚 |
| 531 | `reminder.overdue` | Overdue | 已逾期 |
| 532 | `reminder.dueToday` | Due today | 今天到期 |
| 533 | `reminder.logsOwed` | Logs owed | 日志缺少 |
| 534 | `reminder.chores` | Chores | 临时事务 |
| 535 | `reminder.habits` | Routine | 日常安排 |
| 536 | `update.check` | Check for updates | 检查更新 |
| 537 | `update.checking` | Checking… | 检查中… |
| 538 | `update.upToDate` | You are on the latest version. | 已是最新版本。 |
| 539 | `update.availableShort` | An update is available. | 有可用更新。 |
| 540 | `update.unreachable` | Automatic updates are unavailable because GitHub cannot be reached. | 由于无法连接到 GitHub，自动更新不可用。 |
| 541 | `update.unreachableHide` | Hide for this run | 本次运行不显示 |
| 542 | `update.webNote` | Automatic updates apply to the desktop app. In a browser you always load the latest build. | 自动更新只适用于桌面版；在浏览器里打开的始终是最新版本。 |
| 543 | `update.availableTitle` | Update available | 发现新版本 |
| 544 | `update.availableBody` | Version {version} has been released. You are on {current}. | 新版本 {version} 已发布，当前版本为 {current}。 |
| 545 | `update.importantTitle` | Important update | 重要更新 |
| 546 | `update.importantBody` | This update ships new features or other important changes. Please read the release notes before updating. | 本次更新涉及新功能上线或其它重要改动，请确保阅读过更新文件之后再进行更新。 |
| 547 | `update.notes` | Release notes | 更新说明 |
| 548 | `update.history` | Older releases this update brings along ({count}) | 本次将连带更新的历史版本内容（{count} 个版本） |
| 549 | `update.historyTitle` | Release history | 历史版本更新说明 |
| 550 | `update.noNotes` | This release came with no release notes. | 本次发布未填写更新说明。 |
| 551 | `update.downloadAndInstall` | Update in background | 后台更新 |
| 552 | `update.readyTitle` | Update downloaded | 更新已下载 |
| 553 | `update.readyBody` | Version {version} has been downloaded. Restart now? | 新版本 {version} 已下载完成。立刻重启？ |
| 554 | `update.now` | Restart now | 立刻重启 |
| 555 | `update.installing` | Downloading… | 正在下载… |
| 556 | `update.installFailed` | The update could not be installed: {message} | 更新安装失败：{message} |
| 557 | `update.later` | Later | 以后再说 |
| 558 | `update.snooze` | Ignore for {days} days | {days} 天内不再提醒 |
| 559 | `update.nagTitle` | It has been a while | 已经很久没有更新了 |
| 560 | `update.nagBody` | It has been over a month since this app last reached GitHub. Take a look for bug fixes and new features? | 要不要连上 GitHub 看一眼有没有 bug 修复和新功能呢？ |
| 561 | `update.nagGo` | Go to Settings | 去设置看看 |
| 562 | `update.connectTitle` | Want a stable GitHub connection? | 想稳定连接 GitHub？ |
| 563 | `update.connectBody` | Watt Toolkit (formerly Steam++) is a free, open-source network accelerator. It speeds up both the GitHub website and Release downloads. | Watt Toolkit（原 Steam++）是免费开源的多平台网络加速工具，可以加速 GitHub 网页和 Release 下载。 |
| 564 | `update.connectLink` | Download from steampp.net | 前往官网下载（steampp.net） |
| 565 | `update.opensource` | GitHub is the largest home of open-source software — operating systems, frameworks, ready-made tools, most of it free to use, study and build on. This project’s source and releases live there too. | GitHub 是全球最大的开源社区，托管着数以亿计的开源项目 —— 从操作系统、开发框架到各类现成工具，绝大多数都可以免费使用、学习和二次开发。本项目的源码和版本更新也发布在这里。 |
| 566 | `update.openRepo` | View on GitHub | 在 GitHub 上查看 |
| 567 | `theme.graphite.name` | Graphite | 石墨 |
| 568 | `theme.graphite.hint` | Near-black, neutral | 近黑 · 中性 |
| 569 | `theme.slate.name` | Slate | 板岩 |
| 570 | `theme.slate.hint` | Mid grey-blue, cool | 中灰蓝 · 偏冷 |
| 571 | `theme.ember.name` | Ember | 余烬 |
| 572 | `theme.ember.hint` | Hazel-black, warm | 榛黑 · 偏暖 |
| 573 | `theme.paper.name` | Paper | 纸张 |
| 574 | `theme.paper.hint` | Light, crisp | 浅色 · 清爽 |
| 575 | `swatch.groupChrome` | Interface | 界面 |
| 576 | `swatch.groupSignals` | Meaning | 语义 |
| 577 | `swatch.bg` | Background | 底色 |
| 578 | `swatch.panel` | Panel | 面板 |
| 579 | `swatch.panel2` | Field | 输入框 |
| 580 | `swatch.stripe` | Alt. row | 斑马行 |
| 581 | `swatch.border` | Border | 边框 |
| 582 | `swatch.line` | Divider | 分隔线 |
| 583 | `swatch.fg` | Text | 正文 |
| 584 | `swatch.muted` | Secondary text | 次要文字 |
| 585 | `swatch.dim` | Faint text | 弱化文字 |
| 586 | `swatch.accent` | Accent | 强调色 |

---

## 另外几处（不在字典里，结构不同）

### 月份名 MONTHS.zh

```js
['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
```

### 星期名 WEEKDAYS.zh（周日在前）

```js
['周日', '周一', '周二', '周三', '周四', '周五', '周六']
```

### 语言名的自称 LANG_LABEL.zh

```js
'中文'
```

`src-tauri/src/toast.rs` 里还有一个：`ACK_FALLBACK = "我知道了"` ——
定时提醒进程没有前端，取不到字典，只能写死这一个按钮字。

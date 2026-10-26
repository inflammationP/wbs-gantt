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
| 87 | `time.yesterday` | Yesterday | 昨天 |
| 88 | `time.inDays` | one: in {count} day / other: in {count} days | {count} 天后 |
| 89 | `time.daysAgo` | one: {count} day ago / other: {count} days ago | {count} 天前 |
| 90 | `time.week` | W{count} | {count}周 |
| 91 | `time.quarter` | Q{count} | {count}季度 |
| 92 | `time.monthYear` | {month} {year} | {year}年{month} |
| 93 | `time.quarterYear` | Q{count} {year} | {year}年第{count}季度 |
| 94 | `time.rangeSeparator` |  –  |  –  |

## gantt

| # | key | English | 中文 |
|---|-----|---------|------|
| 95 | `gantt.view.day` | Day | 日 |
| 96 | `gantt.view.week` | Week | 周 |
| 97 | `gantt.view.month` | Month | 月 |
| 98 | `gantt.view.quarter` | Quarter | 季 |
| 99 | `gantt.view.year` | Year | 年 |
| 100 | `gantt.backToToday` | Back to Today | 回到今天 |
| 101 | `gantt.newTask` | New task | 新建任务 |

## the new-thing dialog

| # | key | English | 中文 |
|---|-----|---------|------|
| 102 | `new.title` | New | 新建 |
| 103 | `new.task` | Task | 任务 |
| 104 | `new.project` | Project | 项目 |
| 105 | `gantt.newTaskOrProject` | New task / project | 新建任务/项目 |
| 106 | `gantt.noProject` | A task has to live in a project — create one first. | 任务要放在项目里 —— 请先新建一个项目。 |
| 107 | `gantt.noProject.p1` | WBS-gantt manages projects and tasks much the way an operating system manages files — a directory tree. A project is the root directory at the very top, and every task filed under one is a file or a folder. A file has to live under a root, so a task needs a project chosen for it before it can be created. I do recommend reading the network of tasks you are about to build this way, because… that is how the software is designed. | WBS-gantt 管理项目和任务的方式与电脑操作系统管理文件的方式（目录树）很像。在这里，项目（project）是最顶层的根目录，而每个项目下属的所有任务都可以视作一个文件 / 文件夹。显然文件得存放在根目录下，所以在新建任务前，需要为其指定一个项目。我十分推荐你这样理解你未来即将构建的任务网络，因为……软件就是这么设计的。 |
| 108 | `gantt.noProject.p2` | Beyond giving a task somewhere to exist, a project is only a label for sorting. Read it as the “topic” of the tasks created under it: it gives them a category, so that they can be managed by category — which is the other reason to file your tasks under projects. | 除了为任务的存在提供一个地基之外，项目只是一个分类用的标签。不妨把它理解为在它下面建立的任务的「主题」。它为这些任务定义了一个类别，以便按类管理。所以从管理的角度来看，将任务分类在项目下也是十分必要的。 |
| 109 | `gantt.deleteTask` | Delete "{name}"? | 确定删除“{name}”？ |
| 110 | `gantt.deleteTaskWithSubtasks` | Delete "{name}" and all its subtasks? | 确定删除“{name}”及其所有子任务？ |
| 111 | `gantt.deleteTodos` | one: Delete {count} to-do task? / other: Delete {count} to-do tasks? | 确定删除 {count} 项待办任务？ |
| 112 | `gantt.deleteTodosWithSubtasks` | one: Delete {count} to-do task and its subtasks? / other: Delete {count} to-do tasks and their subtasks? | 确定删除 {count} 项待办任务及其子任务？ |
| 113 | `gantt.ongoingTitle` | {wbs} {name} — ongoing | {wbs} {name} —— 长期进行中 |
| 114 | `gantt.pickDate` | Click any date to open its day detail | 点击任意日期查看当天详情 |
| 115 | `gantt.writeLogForDay` | Write a log for this day | 为这一天写日志 |
| 116 | `gantt.moveToTopLevel` | Move to top level | 移到顶层 |
| 117 | `gantt.taskTree` | Task tree | 任务树 |
| 118 | `taskTree.taskCount` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 119 | `taskTree.subtasks` | one: {count} subtask / other: {count} subtasks | {count} 个子任务 |
| 120 | `gantt.editDone` | Done | 完成 |
| 121 | `gantt.editMode` | Edit mode | 编辑模式 |
| 122 | `gantt.todoEditMode` | To-do edit mode | 待办编辑模式 |
| 123 | `gantt.selected` | {count} selected | 已选 {count} 项 |
| 124 | `gantt.clearSelection` | Clear selection | 取消选择 |
| 125 | `gantt.setTodoMany` | one: Mark {count} task as to-do?\n\nIts dates, priority and progress are cleared. / other: Mark {count} tasks as to-do?\n\nTheir dates, priorities and progress are cleared. | 确定将这 {count} 个任务设为待办？\n\n它们的日期、优先级和进度将被清除。 |
| 126 | `gantt.setTodoManyWithSubtasks` | one: Mark {count} task and its {subs} unfinished subtask as to-do?\n\n / other: Mark {count} tasks and their {subs} unfinished subtasks as to-do?\n\n | 确定将这 {count} 个任务及其 {subs} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 127 | `gantt.deleteSelected` | one: Delete {count} task? / other: Delete {count} tasks? | 确定删除这 {count} 个任务？ |
| 128 | `gantt.deleteSelectedWithSubtasks` | one: Delete {count} task and its subtasks? / other: Delete {count} tasks and their subtasks? | 确定删除这 {count} 个任务及其子任务？ |
| 129 | `gantt.pauseMany` | one: Pause {count} task? / other: Pause {count} tasks? | 确定暂停 {count} 项任务？ |
| 130 | `gantt.resumeMany` | one: Resume {count} task? / other: Resume {count} tasks? | 确定恢复 {count} 项任务？ |
| 131 | `gantt.archiveMany` | one: Archive {count} task? / other: Archive {count} tasks? | 确定归档 {count} 项任务？ |
| 132 | `gantt.archiveManyWithSubtasks` | one: Archive {count} task? Its subtasks are filed away with it. / other: Archive {count} tasks? Their subtasks are filed away with them. | 确定归档 {count} 项任务？属于它们的子任务也会连带归档。 |
| 133 | `gantt.dragMany` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 134 | `gantt.moved` | Moved {what} | 已移动 {what} |
| 135 | `gantt.undoTodo` | Marked {what} as to-do | 已将 {what}设为待办 |
| 136 | `gantt.undoStart` | Started {what} | 已开始 {what} |
| 137 | `gantt.undoPause` | Paused {what} | 已暂停 {what} |
| 138 | `gantt.undoResume` | Resumed {what} | 已恢复 {what} |
| 139 | `gantt.undoDelete` | Deleted {what} | 已删除 {what} |
| 140 | `gantt.undoArchive` | Archived {what} | 已归档 {what} |
| 141 | `gantt.undoUnarchive` | Brought back {what} | 已取消归档 {what} |
| 142 | `gantt.undo` | Undo | 撤销 |
| 143 | `gantt.undoSeconds` | ({seconds}) | （{seconds}） |

## history

| # | key | English | 中文 |
|---|-----|---------|------|
| 144 | `history.title` | History | 操作历史 |
| 145 | `history.now` | Opened the app | 本次打开 |
| 146 | `history.empty` | Nothing has changed the board yet. | 还没有改动过看板。 |
| 147 | `history.count` | one: {count} item / other: {count} items | {count} 项 |
| 148 | `history.autoAdd` | Added {count} | 新增 {count} 项 |
| 149 | `history.autoRemove` | Removed {count} | 删除 {count} 项 |
| 150 | `history.autoChange` | Changed {count} | 改动 {count} 项 |
| 151 | `history.added` | Added | 新增 |
| 152 | `history.removed` | Removed | 删除 |
| 153 | `history.changed` | Changed | 改动 |
| 154 | `history.projectAdded` | Projects added | 新增项目 |
| 155 | `history.projectRemoved` | Projects removed | 删除项目 |
| 156 | `history.projectChanged` | Projects changed | 项目改动 |
| 157 | `history.more` | … and {count} more | …… 还有 {count} 项 |
| 158 | `history.newTask` | Added {what} | 新建 {what} |
| 159 | `history.editTask` | Edited {what} | 编辑 {what} |
| 160 | `history.newProject` | Added project {what} | 新建项目 {what} |
| 161 | `history.editProject` | Edited project {what} | 编辑项目 {what} |
| 162 | `history.deleteProject` | Deleted project {what} | 删除项目 {what} |
| 163 | `history.move` | Moved {what} | 移动 {what} |
| 164 | `history.moveNewProject` | Moved {what} into a new project | 把 {what} 放进新建的项目 |
| 165 | `history.promoteTask` | Made {what} a project | 把 {what} 升为项目 |
| 166 | `history.outdent` | Moved {what} to top level | 把 {what} 移到顶层 |
| 167 | `history.folderRename` | Renamed a to-do folder | 待办文件夹改名 |

## to-dos

| # | key | English | 中文 |
|---|-----|---------|------|
| 168 | `todo.folderName` | To-dos | 待办 |
| 169 | `todo.folder` | To-dos ({count}) | 待办（{count}） |
| 170 | `todo.startTask` | Start task | 开始任务 |
| 171 | `todo.start` | Start | 开始 |
| 172 | `todo.next` | Next → | 下一个 → |
| 173 | `todo.restoreMany` | one: Restore {count} to-do / other: Restore {count} to-dos | 恢复 {count} 项待办 |
| 174 | `todo.saveAll` | Save all ({count}) | 全部保存（{count}） |
| 175 | `todo.hasSubtasks` | {name} has subtasks, so its dates are decided by them. Restore those first, or set a priority here and let the dates follow. | {name} 有子任务，它的日期由子任务决定。请先恢复那些子任务；也可以只在此设定优先级，让日期随后自动跟进。 |
| 176 | `todo.renameFolder` | Name this folder | 给文件夹起名 |
| 177 | `todo.folderPlaceholder` | Folder name | 文件夹名 |
| 178 | `todo.restoreAll` | Restore all {count} | 恢复全部 {count} 项 |
| 179 | `todo.deleteAll` | Delete all {count} | 删除全部 {count} 项 |

## archive

| # | key | English | 中文 |
|---|-----|---------|------|
| 180 | `archive.title` | Archived ({count}) | 已归档（{count}） |
| 181 | `archive.badge` | Archived | 已归档 |
| 182 | `archive.restoreAll` | Unarchive all {count} | 全部取消归档（{count} 项） |
| 183 | `archive.empty` | Nothing archived yet. | 还没有归档的任务 |

## tasks

| # | key | English | 中文 |
|---|-----|---------|------|
| 184 | `task.add` | Add | 添加 |
| 185 | `task.addSubtask` | Add subtask | 添加子任务 |
| 186 | `task.addSibling` | Add sibling task | 添加同级任务 |
| 187 | `task.new` | New task | 新建任务 |
| 188 | `task.edit` | Edit task | 编辑任务 |
| 189 | `task.namePlaceholder` | Task name | 任务名称 |
| 190 | `task.parent` | Parent | 父任务 |
| 191 | `task.topLevel` | — Top level — | 最顶层任务 |
| 192 | `task.createAsTodo` | Create as to-do | 创建为待办 |
| 193 | `task.todoNote` | This is a to-do: unscheduled work. It sits last among its siblings inside a {toDos} folder until you give it a schedule with {startTask} in the detail panel. | 这是一项待办：尚未排期的工作。它会排在同级任务末尾的 {toDos} 文件夹中，直到你在详情面板里用 {startTask} 为它安排时间。 |
| 194 | `task.endDateLocked` | The end date is decided by the subtask that ends last — change that subtask’s end date instead. | 结束日期由最晚结束的子任务决定，请改为修改那个子任务的结束日期。 |
| 195 | `task.startDateLocked` | The start date is decided by the subtask that starts first — change that subtask’s start date instead. | 开始日期由最早开始的子任务决定，请改为修改那个子任务的开始日期。 |
| 196 | `task.strictProgress` | Turn off daily logs (not recommended) | 取消日志限制（不推荐） |
| 197 | `task.overdueMark` | This task is already overdue — mark as | 该任务已逾期 —— 标记为 |
| 198 | `task.tagsPlaceholder` | study, health | 学习, 健康 |
| 199 | `task.tagsLabel` | Tags (comma separated) | 标签（用逗号分隔） |
| 200 | `task.subtaskCount` | one: {count} subtask / other: {count} subtasks | {count} 项子任务 |
| 201 | `task.hide` | Hide | 收起 |
| 202 | `task.hidden` | Hidden. | 已收起 |
| 203 | `task.tree` | Task tree | 所在任务树 |
| 204 | `task.treeFocus` | Show one branch | 只展示一支 |
| 205 | `task.pendingLogs` | Still to log | 今日待填 |
| 206 | `task.progressMode` | Progress mode | 进度模式 |
| 207 | `task.modeStrict` | Log-based | 严格模式 |
| 208 | `task.modeAuto` | Simplified (ticked per day) | 简化模式 |
| 209 | `task.modeRolledUp` | From subtasks | 由子任务汇总 |
| 210 | `optOut.title` | Go without log supervision? | 确定采取简化模式(脱离日志系统)吗？ |
| 211 | `optOut.p1` | Without the log system this task will *keep no history at all*, and the Logs page will not manage it. | 脱离日志系统则该任务将*不会拥有历史日志*，且不会在 log 页面里被统一管理。 |
| 212 | `optOut.p2` | It will use a *deliberately crude* way of counting progress: each day you only have to *click a button by hand* to confirm you did it, and the system then accumulates progress as elapsed days ÷ total days. No click, no accumulation. If you miss a day, later daily reports will remind you, and you can leave it for now or put the confirmation in — which is one more click. | 本任务将采用一种*极度简化*的进度计算方式，即每日只需要*手动点击按钮*来确认完成，然后系统自动按已过日期 ÷ 总日期进行进度累计，否则不予累计进度。如果你有某日忘了点按钮，则会在以后的日报里对你进行提醒，你可以按实际需求暂时忽略／将确认补上，也就是再点一下按钮的事。 |
| 213 | `optOut.p3` | This also means the task */may not reflect its real progress*/, and the supervision over whether you did a given day’s work is */close to zero*/. **//Please make sure you have enough self-discipline to go without the log system’s supervision**//. | 这也就意味着，本任务可能将*/无法精确反应任务实际进度*/，且确认某日本任务完成的*/监督力度几乎为 0 */。**//请确保你有足够的自律能力脱离日志系统监督**//。 |
| 214 | `optOut.back` | Back | 返回 |
| 215 | `optOut.confirm` | Turn logs off anyway | 仍要取消 |
| 216 | `day.tick` | Mark this day as done | 把这一天标记为完成 |
| 217 | `task.pausedNote` | one: Paused. Started {start} · paused on {paused} · {count} day elapsed. / other: Paused. Started {start} · paused on {paused} · {count} days elapsed. | 已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。 |
| 218 | `task.resume` | Resume | 恢复 |
| 219 | `task.endPostponed` | End (postponed) | 结束（已顺延） |
| 220 | `task.setAsTodo` | Set as to-do | 设为待办 |
| 221 | `task.pauseConfirm` | Pause "{name}"? | 确定暂停“{name}”？ |
| 222 | `task.resumeConfirm` | Resume "{name}"? | 确定恢复“{name}”？ |
| 223 | `task.archive` | Archive | 归档 |
| 224 | `task.unarchive` | Unarchive | 取消归档 |
| 225 | `task.archiveConfirm` | Archive "{name}"? | 确定归档“{name}”？ |
| 226 | `task.archiveWithSubtasks` | Archive "{name}"? Its subtasks are filed away with it. | 确定归档“{name}”？属于它的子任务也会连带归档。 |
| 227 | `task.pause` | Pause task | 暂停任务 |
| 228 | `task.pauseHistory` | Pause history ({count}) | 暂停记录（{count}） |
| 229 | `task.pauseEntry` | Paused {from} → resumed {to} | 暂停于 {from} → 恢复于 {to} |
| 230 | `task.heat.title` | Completion | 完成情况 |
| 231 | `task.heat.done` | Done | 已完成 |
| 232 | `task.heat.pending` | Not done | 未完成 |
| 233 | `task.heat.none` | Not scheduled | 无排期 |
| 234 | `task.heat.count` | one: {count} task done / other: {count} tasks done | 完成 {count} 项任务 |
| 235 | `task.heat.less` | Less | 少 |
| 236 | `task.heat.more` | More | 多 |
| 237 | `task.setAsTodoConfirm` | Mark "{name}" as to-do?\n\nIts dates, priority and progress are cleared. | 确定将“{name}”设为待办？\n\n它的日期、优先级和进度将被清除。 |
| 238 | `task.setAsTodoConfirmMany` | one: Mark "{name}" and its {count} unfinished subtask as to-do?\n\n / other: Mark "{name}" and its {count} unfinished subtasks as to-do?\n\n | 确定将“{name}”及其 {count} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 239 | `task.markedCompleted` | Marked as completed | 已标记为完成 |

## logs

| # | key | English | 中文 |
|---|-----|---------|------|
| 240 | `log.write` | Write log | 写日志 |
| 241 | `log.editProgress` | Correct progress | 修改进度 |
| 242 | `log.label` | Log | 日志 |
| 243 | `log.contentPlaceholder` | What did you work on? | 今天做了什么？ |
| 244 | `log.editedAt` | edited {time} | 编辑于 {time} |
| 245 | `log.hint` | Each line is an item; Tab indents a sub-item, Shift+Tab outdents. | 每行是一个条目；Tab 键缩进为子条目，Shift+Tab 反向缩进。 |
| 246 | `log.progressAdd` | Progress added (%) | 进度增加（%） |
| 247 | `log.progressAfterDay` | Progress becomes (%) | 进度累积至（%） |
| 248 | `log.currentProgress` | Currently at {percent}% | 目前进度 {percent}% |
| 249 | `log.byDays` | Advance one day | 自动推进一日 |
| 250 | `log.byDaysHint` | Advance one day = add (1 ÷ total days) × 100% of the progress. If less than a fifth of a day’s share is left after that, the task is taken as complete. | 自动推进一日＝增加（1 ÷ 总日数）× 100% 的进度。如果自动推进一日后剩余进度小于一日进度的 1/5，则会默认任务完成。 |
| 251 | `log.progressRequired` | Fill in at least one of the two — put 0 under “{add}” if nothing moved. | 两个格子至少填一个 —— 没进展就在「{add}」里填 0。 |
| 252 | `log.progressBackward` | Progress cannot go backwards — that lands below the figure it started the day at. | 进度不能往回填 |
| 253 | `log.task` | Task | 任务 |
| 254 | `logs.all` | All logs | 全部日志 |
| 255 | `logs.empty` | No logs yet. | 暂无日志。 |
| 256 | `logs.moreTasks` | one: +{count} more task / other: +{count} more tasks | 以及 {count} 项任务 |
| 257 | `logs.tabLogs` | Logs | 日志 |

## notes

| # | key | English | 中文 |
|---|-----|---------|------|
| 258 | `notes.title` | Notes | 记事本 |
| 259 | `notes.empty` | Nothing written yet. | 空空如也 |
| 260 | `notes.add` | Write something | 写点什么 |
| 261 | `notes.placeholder` | Whatever you want to keep. | 写点随想 |
| 262 | `notes.none` | None yet. | 暂无 |

## calendar

| # | key | English | 中文 |
|---|-----|---------|------|
| 263 | `calendar.prevMonth` | Previous month | 上个月 |
| 264 | `calendar.nextMonth` | Next month | 下个月 |
| 265 | `calendar.cellLabel` | {date}: {due}, {starting}; {coverage} | {date}：{due}，{starting}；{coverage} |
| 266 | `calendar.dueCount` | {count} due | {count} 项到期 |
| 267 | `calendar.startingCount` | {count} starting | {count} 项开始 |
| 268 | `calendar.coverage.future` | not yet due | 尚未到期 |
| 269 | `calendar.coverage.clear` | no logs due | 无日志义务 |
| 270 | `calendar.coverage.partial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 271 | `calendar.coverage.full` | all {count} logs written | {count} 项日志已全部记录 |
| 272 | `calendar.more` | +{count} more | 还有 {count} 项 |
| 273 | `calendar.milestoneTitle` | {kind}{strict} — {name}{logged} | {kind}{strict} —— {name}{logged} |
| 274 | `calendar.milestone.due` | Due | 到期 |
| 275 | `calendar.milestone.starts` | Starts | 开始 |
| 276 | `calendar.milestone.strict` |  * |  * |
| 277 | `calendar.milestone.logged` |  · logged this day |  · 当天已记录 |

## day detail

| # | key | English | 中文 |
|---|-----|---------|------|
| 278 | `day.strictLogs` | Logs | 日志 |
| 279 | `day.notYetDue` | Not yet due | 尚未到期 |
| 280 | `day.noStrictScheduled` | No logs due | 当天无日志义务 |
| 281 | `day.allLogged` | Everything logged | 已完成所有日志填写 |
| 282 | `day.nothingLogged` | Nothing logged yet | 尚未记录任何日志 |
| 283 | `day.stillMissing` | {count} still missing | 还差 {count} 项 |
| 284 | `day.noStrictTasksScheduled` | No logs due | 当天没有日志义务 |
| 285 | `day.ringPartial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 286 | `day.taskCount` | one: {count} task on this day / other: {count} tasks on this day | 当天有 {count} 项任务 |
| 287 | `day.tasksBreakdown` | {strict} with logs · {other} other | {strict} 有日志 · {other} 其他 |
| 288 | `day.taskList` | Tasks | 任务清单 |
| 289 | `day.sort` | Sort | 排序 |
| 290 | `day.sortStatus` | Status | 按状态 |
| 291 | `day.sortPriority` | Priority | 按优先级 |
| 292 | `day.nothingScheduled` | Nothing scheduled on this day. | 当天没有排期。 |
| 293 | `day.logMark` | A * marks a task that owes a daily log. | 带 * 的任务有日志义务。 |
| 294 | `day.readLogs` | Read this day’s logs | 查看当天的日志 |
| 295 | `day.readLogsCount` | Read this day’s logs ({count}) | 查看当天的日志（{count}） |
| 296 | `day.noProgress` | No progress | 无进度 |
| 297 | `day.viewTask` | View task → | 查看任务 → |

## chores (the Today page)

| # | key | English | 中文 |
|---|-----|---------|------|
| 298 | `chore.section` | Chores | 临时事务 |
| 299 | `chore.placeholder` | Add a chore… | 添加临时事务… |
| 300 | `chore.enterHint` | Type the name in the box and press Enter to create it. | 请在文本框内直接输入事项名称，按回车确认创建。 |
| 301 | `chore.emptyToday` | Nothing on hand today. | 今天没有临时事务。 |
| 302 | `chore.emptyTomorrow` | Nothing lined up for tomorrow. | 明天还没有安排。 |
| 303 | `chore.noneOnDay` | No chores on this day. | 当天没有临时事务。 |
| 304 | `chore.stillOpen` | {count} still open | 还有 {count} 项 |
| 305 | `chore.allDone` | All done | 全部完成 |
| 306 | `chore.edit` | Edit chore | 编辑临时事务 |
| 307 | `chore.title` | Chore | 内容 |
| 308 | `chore.note` | Note | 备注 |
| 309 | `chore.notePlaceholder` | Optional | 可不填 |
| 310 | `chore.day` | Day | 日期 |
| 311 | `chore.slot` | Part of day | 时段 |
| 312 | `chore.slot.none` | Anytime | 不限 |
| 313 | `chore.slot.dawn` | Early morning | 凌晨 |
| 314 | `chore.slot.am` | Morning | 上午 |
| 315 | `chore.slot.pm` | Afternoon | 下午 |
| 316 | `chore.slot.eve` | Evening | 晚上 |
| 317 | `chore.time` | Exact time | 时间点 |
| 318 | `chore.timePlaceholder` | e.g. 9:30 / 9:30pm / 21:30 | 如 9:30 / 9:30pm / 21:30 |
| 319 | `chore.timeHint` | 12-hour with am/pm, or 24-hour | 12 小时制带 am/pm，或直接写 24 小时制 |
| 320 | `chore.timeUnreadable` | Not a time we can read | 看不懂这个时间 |
| 321 | `chore.timeMismatch` | {time} is in {timeSlot}, not the {slot} picked above. Which should it use? | {time} 属于「{timeSlot}」，和上面选的「{slot}」不一致。以哪个为准？ |
| 322 | `chore.preferTime` | Switch to {slot} | 改为{slot} |
| 323 | `chore.preferSlot` | Keep {slot} | 保持{slot} |
| 324 | `chore.carriedTitle` | Meant for {date} | 原本定于 {date} |
| 325 | `habit.section` | Routine | 日常安排 |
| 326 | `habit.none` | Nothing daily yet. | 还没有每日项。 |
| 327 | `habit.edit` | Edit daily item | 编辑每日项 |
| 328 | `habit.title` | Item | 内容 |
| 329 | `habit.deleteAsk` | Delete "{name}"? Every day you ticked it goes with it. | 确定删除“{name}”？它的历史完成等记录也会一并删除 |
| 330 | `habit.new` | New routine | 新建日常安排 |
| 331 | `habit.note` | Note | 备注 |
| 332 | `habit.notePlaceholder` | Optional | 可不填 |
| 333 | `habit.weekdays` | Days | 星期几 |
| 334 | `habit.everyDay` | Every day | 每天 |
| 335 | `habit.endDate` | Ends | 结束日期 |
| 336 | `habit.noEndDate` | Leave empty to keep going. | 选填。 |
| 337 | `habit.paused` | Suspended | 停用 |
| 338 | `habit.parent` | Parent | 上级日常安排 |
| 339 | `habit.topLevel` | — Top level — | 最顶层日常安排 |
| 340 | `habit.addSubtask` | Add sub-routine | 添加子日常安排 |

## manage

| # | key | English | 中文 |
|---|-----|---------|------|
| 341 | `manage.overall` | Overall | 总览 |
| 342 | `manage.heat` | Completion heatmap | 完成热力图 |
| 343 | `manage.subtasks` | Subtasks | 子任务 |
| 344 | `manage.parentTasks` | one: {count} parent task / other: {count} parent tasks | {count} 项父任务 |
| 345 | `manage.upcoming` | Upcoming (7 days) | 未来 7 天 |
| 346 | `manage.overdue` | Overdue | 已逾期 |
| 347 | `manage.deleteProject` | Delete project "{name}" and all its tasks? | 确定删除项目“{name}”及其全部任务？ |
| 348 | `manage.openInGantt` | Open in Gantt → | 在甘特图中打开 → |
| 349 | `manage.comingSoon` | Coming soon | 即将开始 |
| 350 | `manage.allStatuses` | All statuses | 全部状态 |
| 351 | `manage.filteredCount` | one: {filtered} of {count} task / other: {filtered} of {count} tasks | 共 {count} 项任务，显示 {filtered} 项 |
| 352 | `manage.empty` | Nothing here. | 暂无内容。 |
| 353 | `manage.sub.active` | active | 进行中 |
| 354 | `manage.sub.tracked` | in total | 全部项目 |
| 355 | `manage.sub.done` | done | 已完成 |
| 356 | `manage.sub.paused` | paused | 已暂停 |
| 357 | `manage.sub.startsIn7` | starts in 7 days | 将在 7 天内开始 |
| 358 | `manage.sub.pastDue` | past due | 已过期 |
| 359 | `manage.sub.pastDueDueSoon` | past due · {count} due soon | 已过期 · {count} 项即将到期 |
| 360 | `manage.sub.unscheduled` | unscheduled | 未排期 |
| 361 | `manage.countCompleted` | {count} completed | {count} 项已完成 |
| 362 | `manage.countOpen` | {count} open | {count} 项未完成 |

## projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 363 | `project.heading` | Project | 项目 |
| 364 | `project.color` | Color | 颜色 |
| 365 | `project.done` | Done | 已完成 |
| 366 | `project.open` | Open | 未完成 |

## merging projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 367 | `project.manage` | Hierarchy | 层级管理器 |
| 368 | `project.moveMode` | Project move mode (if any) | 项目移动方式（如涉及） |
| 369 | `project.moveModeFolder` | A parent task | 变成父任务 |
| 370 | `project.moveModeFlat` | At the top level | 直接铺平 |

## the move dialog

| # | key | English | 中文 |
|---|-----|---------|------|
| 371 | `move.sources` | Move | 将 |
| 372 | `move.target` | Into | 放到 |
| 373 | `move.newProject` | New project | 创建为新项目 |
| 374 | `move.newProjectOr` | or | 或 |
| 375 | `move.newProjectName` | New project | 新项目 |
| 376 | `move.confirm` | Move | 移动 |

## settings

| # | key | English | 中文 |
|---|-----|---------|------|
| 377 | `settings.language` | Language | 语言 |
| 378 | `settings.languageHint` | The language of the interface. | 界面显示所用的语言。 |
| 379 | `settings.theme` | Theme | 主题 |
| 380 | `settings.themeHint` | A whole colour scheme — surfaces, text and the colours that carry meaning. | 一整套配色方案 —— 包括底面、文字，以及承载含义的状态色。 |
| 381 | `settings.themeNote` | Green means done and red means late in every theme; the palettes differ in their surfaces and accent, so a status keeps its meaning whichever one you pick. | 在每一套主题里，绿都代表完成、红都代表逾期。各套之间变化的是底面与强调色，所以无论选哪套，状态的含义都不变。 |
| 382 | `settings.active` | Current | 当前 |
| 383 | `settings.version` | Version | 版本 |
| 384 | `settings.versionHint` | The desktop app checks for updates on every launch. | 桌面版每次启动会自动检查更新。 |
| 385 | `settings.releaseHistory` | Release history | 历史版本 |

## reminders

| # | key | English | 中文 |
|---|-----|---------|------|
| 386 | `settings.reminder` | Reminders | 提醒 |
| 387 | `settings.reminderWebNote` | Reminders are sent by the desktop app — it is the only build that can post to PushPlus. In a browser there is nothing here to set up. | 提醒由桌面版发出 —— 只有桌面版能把消息送到 PushPlus。浏览器版这里没有可设置的东西。 |
| 388 | `settings.reminderOn` | Desktop notifications are on by default. Keep WBS Gantt running in the background. | 桌面弹窗通知默认开启，请保持 WBS-gantt 在电脑后台运行。 |
| 389 | `settings.reminderWechat` | Sync notifications to personal WeChat | 将通知/提醒同步到个人微信 |
| 390 | `settings.reminderTime` | Send at | 发送时间 |
| 391 | `settings.reminderToken` | PushPlus token | PushPlus 令牌 |
| 392 | `settings.reminderPushplusNote` | WBS Gantt relies on PushPlus to sync notifications to WeChat.\nActivating that route means paying PushPlus ¥3.50 for real-name verification, so skipping it is entirely reasonable. | WBS-gantt 依赖 pushplus 在微信同步通知。\n不过，激活该途径需要向 pushplus 支付 3.5 元以完成实名认证。因而放弃配置该途径也是完全可行的。 |
| 393 | `settings.reminderTokenHint` | Sign in at pushplus.plus and paste the token from the top of the page here. | 在 pushplus.plus 扫码登录，并把页面顶部的令牌(token)复制在这里 |
| 394 | `settings.reminderOpen` | Open pushplus.plus | 打开 pushplus.plus |
| 395 | `settings.reminderTest` | Send a test | 发一条试试 |
| 396 | `settings.reminderPreview` | Preview noon’s | 预览中午的 |
| 397 | `settings.reminderSending` | Sending… | 发送中… |
| 398 | `settings.reminderSent` | Sent. | 已发出。 |
| 399 | `settings.backgroundAppOnly` | Without it, reminders only go out while this window happens to be open. | 不装的话，只有这个窗口开着的时候才会发。 |
| 400 | `settings.autostart` | Start with Windows | 开机自启动 |
| 401 | `settings.closeToTray` | Minimize to tray on close | 关闭时最小化到托盘 |
| 402 | `tray.open` | Open WBS Gantt | 打开看板 |
| 403 | `tray.quit` | Quit | 退出 |
| 404 | `reminder.greeting.dawn` | Still up | 强啊传奇耐熬王 |
| 405 | `reminder.greeting.early` | Good morning | 早上好 |
| 406 | `reminder.greeting.morning` | Good morning | 上午好 |
| 407 | `reminder.greeting.noon` | Midday | 中午好 |
| 408 | `reminder.greeting.afternoon` | Good afternoon | 下午好 |
| 409 | `reminder.greeting.dusk` | End of the day | 傍晚了 |
| 410 | `reminder.greeting.evening` | Good evening | 晚上好 |
| 411 | `reminder.greeting.night` | Late night | 夜深了 |
| 412 | `reminder.closing.dawn` |  | ⟨空⟩ |
| 413 | `reminder.closing.early` |  | ⟨空⟩ |
| 414 | `reminder.closing.morning` |  | ⟨空⟩ |
| 415 | `reminder.closing.noon` |  | ⟨空⟩ |
| 416 | `reminder.closing.afternoon` |  | ⟨空⟩ |
| 417 | `reminder.closing.dusk` |  | ⟨空⟩ |
| 418 | `reminder.closing.evening` |  | ⟨空⟩ |
| 419 | `reminder.closing.night` |  | ⟨空⟩ |
| 420 | `reminder.starting` | Starting today | 今天该开始 |
| 421 | `reminder.dueSoon` | Coming up | 即将到期 |
| 422 | `reminder.reportTitle` | Daily report | 日报 |
| 423 | `reminder.reportEmpty` | Nothing outstanding today. | 今日无事 |
| 424 | `reminder.reportYesterday` | Yesterday | 昨日 |
| 425 | `reminder.reportToday` | Today | 今天 |
| 426 | `reminder.reportRate` | Completion | 完成率 |
| 427 | `reminder.groupTasks` | Tasks | 任务清单 |
| 428 | `reminder.groupDeadlines` | Due & overdue | 到期与逾期 |
| 429 | `reminder.testTitle` | WBS Gantt — test message | 看板 —— 测试消息 |
| 430 | `reminder.testBody` | If you are reading this in WeChat, reminders are working. | 你能在微信里看到这条，就说明提醒已经配好了。 |
| 431 | `reminder.nudgeLogs` | Remember to write logs for the tasks you have finished. | 记得为已经完成的任务填写日志。 |
| 432 | `reminder.nudgeDebt` | {count} waiting on you — | 还有 {count} 项事项待处理，其中： |
| 433 | `reminder.nudgeDebtLine` | - {count} {label} | - {count} 项{label} |
| 434 | `reminder.nudgeTasks` | tasks | 任务 |
| 435 | `reminder.ack` | Got it | 我知道了 |
| 436 | `slot.early` | Morning | 早上 |
| 437 | `slot.noon` | Noon | 中午 |
| 438 | `slot.dusk` | Evening | 傍晚 |
| 439 | `reminder.overdue` | Overdue | 已逾期 |
| 440 | `reminder.dueToday` | Due today | 今天到期 |
| 441 | `reminder.logsOwed` | Logs owed | 日志缺少 |
| 442 | `reminder.chores` | Chores | 临时事务 |
| 443 | `reminder.habits` | Routine | 日常安排 |
| 444 | `update.check` | Check for updates | 检查更新 |
| 445 | `update.checking` | Checking… | 检查中… |
| 446 | `update.upToDate` | You are on the latest version. | 已是最新版本。 |
| 447 | `update.availableShort` | An update is available. | 有可用更新。 |
| 448 | `update.unreachable` | Automatic updates are unavailable because GitHub cannot be reached. | 由于无法连接到 GitHub，自动更新不可用。 |
| 449 | `update.unreachableHide` | Hide for this run | 本次运行不显示 |
| 450 | `update.webNote` | Automatic updates apply to the desktop app. In a browser you always load the latest build. | 自动更新只适用于桌面版；在浏览器里打开的始终是最新版本。 |
| 451 | `update.availableTitle` | Update available | 发现新版本 |
| 452 | `update.availableBody` | Version {version} has been released. You are on {current}. | 新版本 {version} 已发布，当前版本为 {current}。 |
| 453 | `update.notes` | Release notes | 更新说明 |
| 454 | `update.history` | Older releases this update brings along ({count}) | 本次将连带更新的历史版本内容（{count} 个版本） |
| 455 | `update.historyTitle` | Release history | 历史版本更新说明 |
| 456 | `update.noNotes` | This release came with no release notes. | 本次发布未填写更新说明。 |
| 457 | `update.downloadAndInstall` | Update in background | 后台更新 |
| 458 | `update.readyTitle` | Update downloaded | 更新已下载 |
| 459 | `update.readyBody` | Version {version} has been downloaded. Restart now? | 新版本 {version} 已下载完成。立刻重启？ |
| 460 | `update.now` | Restart now | 立刻重启 |
| 461 | `update.installing` | Downloading… | 正在下载… |
| 462 | `update.installFailed` | The update could not be installed: {message} | 更新安装失败：{message} |
| 463 | `update.later` | Later | 以后再说 |
| 464 | `update.snooze` | Ignore for {days} days | {days} 天内不再提醒 |
| 465 | `update.nagTitle` | It has been a while | 已经很久没有更新了 |
| 466 | `update.nagBody` | It has been over a month since this app last reached GitHub. Take a look for bug fixes and new features? | 要不要连上 GitHub 看一眼有没有 bug 修复和新功能呢？ |
| 467 | `update.nagGo` | Go to Settings | 去设置看看 |
| 468 | `update.connectTitle` | Want a stable GitHub connection? | 想稳定连接 GitHub？ |
| 469 | `update.connectBody` | Watt Toolkit (formerly Steam++) is a free, open-source network accelerator. It speeds up both the GitHub website and Release downloads. | Watt Toolkit（原 Steam++）是免费开源的多平台网络加速工具，可以加速 GitHub 网页和 Release 下载。 |
| 470 | `update.connectLink` | Download from steampp.net | 前往官网下载（steampp.net） |
| 471 | `update.opensource` | GitHub is the largest home of open-source software — operating systems, frameworks, ready-made tools, most of it free to use, study and build on. This project’s source and releases live there too. | GitHub 是全球最大的开源社区，托管着数以亿计的开源项目 —— 从操作系统、开发框架到各类现成工具，绝大多数都可以免费使用、学习和二次开发。本项目的源码和版本更新也发布在这里。 |
| 472 | `update.openRepo` | View on GitHub | 在 GitHub 上查看 |
| 473 | `theme.graphite.name` | Graphite | 石墨 |
| 474 | `theme.graphite.hint` | Near-black, neutral | 近黑 · 中性 |
| 475 | `theme.slate.name` | Slate | 板岩 |
| 476 | `theme.slate.hint` | Mid grey-blue, cool | 中灰蓝 · 偏冷 |
| 477 | `theme.ember.name` | Ember | 余烬 |
| 478 | `theme.ember.hint` | Hazel-black, warm | 榛黑 · 偏暖 |
| 479 | `theme.paper.name` | Paper | 纸张 |
| 480 | `theme.paper.hint` | Light, crisp | 浅色 · 清爽 |
| 481 | `swatch.groupChrome` | Interface | 界面 |
| 482 | `swatch.groupSignals` | Meaning | 语义 |
| 483 | `swatch.bg` | Background | 底色 |
| 484 | `swatch.panel` | Panel | 面板 |
| 485 | `swatch.panel2` | Field | 输入框 |
| 486 | `swatch.stripe` | Alt. row | 斑马行 |
| 487 | `swatch.border` | Border | 边框 |
| 488 | `swatch.line` | Divider | 分隔线 |
| 489 | `swatch.fg` | Text | 正文 |
| 490 | `swatch.muted` | Secondary text | 次要文字 |
| 491 | `swatch.dim` | Faint text | 弱化文字 |
| 492 | `swatch.accent` | Accent | 强调色 |

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

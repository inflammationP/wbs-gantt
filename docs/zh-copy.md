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
| 37 | `common.noticeTitle` | Notice | 提示 |
| 38 | `common.name` | Name | 名称 |
| 39 | `common.date` | Date | 日期 |
| 40 | `common.type` | Type | 类型 |
| 41 | `common.project` | Project | 项目 |
| 42 | `common.status` | Status | 状态 |
| 43 | `common.priority` | Priority | 优先级 |
| 44 | `common.progress` | Progress | 进度 |
| 45 | `common.description` | Description | 描述 |
| 46 | `common.noDescription` | No description. | 暂无描述。 |
| 47 | `common.tags` | Tags | 标签 |
| 48 | `common.tasks` | Tasks | 任务 |
| 49 | `common.task` | Task | 任务 |
| 50 | `common.start` | Start | 开始 |
| 51 | `common.end` | End | 结束 |
| 52 | `common.startDate` | Start date | 开始日期 |
| 53 | `common.endDate` | End date | 结束日期 |
| 54 | `common.history` | History | 历史 |
| 55 | `common.dependencies` | Dependencies | 依赖 |
| 56 | `common.wbs` | WBS | WBS |
| 57 | `common.prog` | Prog | 进度 |
| 58 | `common.expand` | Expand | 展开 |
| 59 | `common.collapse` | Collapse | 折叠 |
| 60 | `common.select` | Select | 选择 |
| 61 | `common.deselect` | Deselect | 取消选择 |
| 62 | `common.listSeparator` | ,  | 、 |
| 63 | `common.pathSeparator` |  ›  |  ›  |
| 64 | `common.unknownTask` | Unknown task | 未知任务 |
| 65 | `common.notes` | Notes… | 备注… |
| 66 | `common.targetProgress` | Target progress: {percent}% | 目标进度：{percent}% |
| 67 | `common.taskCount` | one: {count} task / other: {count} tasks | {count} 项任务 |
| 68 | `common.logCount` | one: {count} log / other: {count} logs | {count} 条日志 |
| 69 | `common.noteCount` | one: {count} note / other: {count} notes | {count} 条笔记 |

## statuses, priorities, task types

| # | key | English | 中文 |
|---|-----|---------|------|
| 70 | `status.todo` | To-do | 待办 |
| 71 | `status.notStarted` | Not started | 未开始 |
| 72 | `status.inProgress` | In progress | 进行中 |
| 73 | `status.completed` | Completed | 已完成 |
| 74 | `status.paused` | Paused | 已暂停 |
| 75 | `status.delayed` | Delayed | 已逾期 |
| 76 | `priority.low` | Low | 低 |
| 77 | `priority.medium` | Medium | 中 |
| 78 | `priority.high` | High | 高 |
| 79 | `priority.top` | Top | 最高 |
| 80 | `priority.title` | {level} priority | {level}优先级 |
| 81 | `type.phase` | Phase | 阶段性任务 |
| 82 | `type.longTerm` | Long-Term | 长期任务 |

## dates and periods

| # | key | English | 中文 |
|---|-----|---------|------|
| 83 | `time.today` | Today | 今天 |
| 84 | `time.tomorrow` | Tomorrow | 明天 |
| 85 | `time.yesterday` | Yesterday | 昨天 |
| 86 | `time.inDays` | one: in {count} day / other: in {count} days | {count} 天后 |
| 87 | `time.daysAgo` | one: {count} day ago / other: {count} days ago | {count} 天前 |
| 88 | `time.week` | W{count} | {count}周 |
| 89 | `time.quarter` | Q{count} | {count}季度 |
| 90 | `time.monthYear` | {month} {year} | {year}年{month} |
| 91 | `time.quarterYear` | Q{count} {year} | {year}年第{count}季度 |
| 92 | `time.rangeSeparator` |  –  |  –  |

## gantt

| # | key | English | 中文 |
|---|-----|---------|------|
| 93 | `gantt.view.day` | Day | 日 |
| 94 | `gantt.view.week` | Week | 周 |
| 95 | `gantt.view.month` | Month | 月 |
| 96 | `gantt.view.quarter` | Quarter | 季 |
| 97 | `gantt.view.year` | Year | 年 |
| 98 | `gantt.backToToday` | Back to Today | 回到今天 |
| 99 | `gantt.newTask` | New task | 新建任务 |

## the new-thing dialog

| # | key | English | 中文 |
|---|-----|---------|------|
| 100 | `new.title` | New | 新建 |
| 101 | `new.task` | Task | 任务 |
| 102 | `new.project` | Project | 项目 |
| 103 | `gantt.newTaskOrProject` | New task / project | 新建任务/项目 |
| 104 | `gantt.noProject` | A task has to live in a project — create one first. | 任务要放在项目里 —— 请先新建一个项目。 |
| 105 | `gantt.noProject.p1` | WBS-gantt manages projects and tasks much the way an operating system manages files — a directory tree. A project is the root directory at the very top, and every task filed under one is a file or a folder. A file has to live under a root, so a task needs a project chosen for it before it can be created. I do recommend reading the network of tasks you are about to build this way, because… that is how the software is designed. | WBS-gantt 管理项目和任务的方式与电脑操作系统管理文件的方式（目录树）很像。在这里，项目（project）是最顶层的根目录，而每个项目下属的所有任务都可以视作一个文件 / 文件夹。显然文件得存放在根目录下，所以在新建任务前，需要为其指定一个项目。我十分推荐你这样理解你未来即将构建的任务网络，因为……软件就是这么设计的。 |
| 106 | `gantt.noProject.p2` | Beyond giving a task somewhere to exist, a project is only a label for sorting. Read it as the “topic” of the tasks created under it: it gives them a category, so that they can be managed by category — which is the other reason to file your tasks under projects. | 除了为任务的存在提供一个地基之外，项目只是一个分类用的标签。不妨把它理解为在它下面建立的任务的「主题」。它为这些任务定义了一个类别，以便按类管理。所以从管理的角度来看，将任务分类在项目下也是十分必要的。 |
| 107 | `gantt.deleteTask` | Delete "{name}"? | 确定删除“{name}”？ |
| 108 | `gantt.deleteTaskWithSubtasks` | Delete "{name}" and all its subtasks? | 确定删除“{name}”及其所有子任务？ |
| 109 | `gantt.deleteTodos` | one: Delete {count} to-do task? / other: Delete {count} to-do tasks? | 确定删除 {count} 项待办任务？ |
| 110 | `gantt.deleteTodosWithSubtasks` | one: Delete {count} to-do task and its subtasks? / other: Delete {count} to-do tasks and their subtasks? | 确定删除 {count} 项待办任务及其子任务？ |
| 111 | `gantt.ongoingTitle` | {wbs} {name} — ongoing | {wbs} {name} —— 长期进行中 |
| 112 | `gantt.pickDate` | Click any date to open its day detail | 点击任意日期查看当天详情 |
| 113 | `gantt.writeLogForDay` | Write a log for this day | 为这一天写日志 |
| 114 | `gantt.moveToTopLevel` | Move to top level | 移到顶层 |
| 115 | `gantt.taskTree` | Task tree | 任务树 |
| 116 | `taskTree.taskCount` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 117 | `taskTree.subtasks` | one: {count} subtask / other: {count} subtasks | {count} 个子任务 |
| 118 | `gantt.editDone` | Done | 完成 |
| 119 | `gantt.editMode` | Edit mode | 编辑模式 |
| 120 | `gantt.selected` | {count} selected | 已选 {count} 项 |
| 121 | `gantt.clearSelection` | Clear selection | 取消选择 |
| 122 | `gantt.setTodoMany` | one: Mark {count} task as to-do?\n\nIts dates, priority and progress are cleared. / other: Mark {count} tasks as to-do?\n\nTheir dates, priorities and progress are cleared. | 确定将这 {count} 个任务设为待办？\n\n它们的日期、优先级和进度将被清除。 |
| 123 | `gantt.setTodoManyWithSubtasks` | one: Mark {count} task and its {subs} unfinished subtask as to-do?\n\n / other: Mark {count} tasks and their {subs} unfinished subtasks as to-do?\n\n | 确定将这 {count} 个任务及其 {subs} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 124 | `gantt.deleteSelected` | one: Delete {count} task? / other: Delete {count} tasks? | 确定删除这 {count} 个任务？ |
| 125 | `gantt.deleteSelectedWithSubtasks` | one: Delete {count} task and its subtasks? / other: Delete {count} tasks and their subtasks? | 确定删除这 {count} 个任务及其子任务？ |
| 126 | `gantt.pauseMany` | one: Pause {count} task? / other: Pause {count} tasks? | 确定暂停 {count} 项任务？ |
| 127 | `gantt.resumeMany` | one: Resume {count} task? / other: Resume {count} tasks? | 确定恢复 {count} 项任务？ |
| 128 | `gantt.archiveMany` | one: Archive {count} task? / other: Archive {count} tasks? | 确定归档 {count} 项任务？ |
| 129 | `gantt.archiveManyWithSubtasks` | one: Archive {count} task? Its subtasks are filed away with it. / other: Archive {count} tasks? Their subtasks are filed away with them. | 确定归档 {count} 项任务？属于它们的子任务也会连带归档。 |
| 130 | `gantt.dragMany` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 131 | `gantt.moved` | Moved {what} | 已移动 {what} |
| 132 | `gantt.undoTodo` | Marked {what} as to-do | 已将 {what}设为待办 |
| 133 | `gantt.undoStart` | Started {what} | 已开始 {what} |
| 134 | `gantt.undoPause` | Paused {what} | 已暂停 {what} |
| 135 | `gantt.undoResume` | Resumed {what} | 已恢复 {what} |
| 136 | `gantt.undoDelete` | Deleted {what} | 已删除 {what} |
| 137 | `gantt.undoArchive` | Archived {what} | 已归档 {what} |
| 138 | `gantt.undoUnarchive` | Brought back {what} | 已取消归档 {what} |
| 139 | `gantt.undo` | Undo | 撤销 |
| 140 | `gantt.undoSeconds` | ({seconds}) | （{seconds}） |

## history

| # | key | English | 中文 |
|---|-----|---------|------|
| 141 | `history.title` | History | 操作历史 |
| 142 | `history.now` | Opened the app | 本次打开 |
| 143 | `history.empty` | Nothing has changed the board yet. | 还没有改动过看板。 |
| 144 | `history.count` | one: {count} item / other: {count} items | {count} 项 |
| 145 | `history.autoAdd` | Added {count} | 新增 {count} 项 |
| 146 | `history.autoRemove` | Removed {count} | 删除 {count} 项 |
| 147 | `history.autoChange` | Changed {count} | 改动 {count} 项 |
| 148 | `history.added` | Added | 新增 |
| 149 | `history.removed` | Removed | 删除 |
| 150 | `history.changed` | Changed | 改动 |
| 151 | `history.projectAdded` | Projects added | 新增项目 |
| 152 | `history.projectRemoved` | Projects removed | 删除项目 |
| 153 | `history.projectChanged` | Projects changed | 项目改动 |
| 154 | `history.more` | … and {count} more | …… 还有 {count} 项 |
| 155 | `history.newTask` | Added {what} | 新建 {what} |
| 156 | `history.editTask` | Edited {what} | 编辑 {what} |
| 157 | `history.newProject` | Added project {what} | 新建项目 {what} |
| 158 | `history.editProject` | Edited project {what} | 编辑项目 {what} |
| 159 | `history.deleteProject` | Deleted project {what} | 删除项目 {what} |
| 160 | `history.move` | Moved {what} | 移动 {what} |
| 161 | `history.moveNewProject` | Moved {what} into a new project | 把 {what} 放进新建的项目 |
| 162 | `history.promoteTask` | Made {what} a project | 把 {what} 升为项目 |
| 163 | `history.outdent` | Moved {what} to top level | 把 {what} 移到顶层 |
| 164 | `history.folderRename` | Renamed a to-do folder | 待办文件夹改名 |

## to-dos

| # | key | English | 中文 |
|---|-----|---------|------|
| 165 | `todo.folderName` | To-dos | 待办 |
| 166 | `todo.folder` | To-dos ({count}) | 待办（{count}） |
| 167 | `todo.startTask` | Start task | 开始任务 |
| 168 | `todo.start` | Start | 开始 |
| 169 | `todo.next` | Next → | 下一个 → |
| 170 | `todo.restoreMany` | one: Restore {count} to-do / other: Restore {count} to-dos | 恢复 {count} 项待办 |
| 171 | `todo.saveAll` | Save all ({count}) | 全部保存（{count}） |
| 172 | `todo.hasSubtasks` | {name} has subtasks, so its dates are decided by them. Restore those first, or set a priority here and let the dates follow. | {name} 有子任务，它的日期由子任务决定。请先恢复那些子任务；也可以只在此设定优先级，让日期随后自动跟进。 |
| 173 | `todo.renameFolder` | Name this folder | 给文件夹起名 |
| 174 | `todo.folderPlaceholder` | Folder name | 文件夹名 |
| 175 | `todo.restoreAll` | Restore all {count} | 恢复全部 {count} 项 |
| 176 | `todo.deleteAll` | Delete all {count} | 删除全部 {count} 项 |

## archive

| # | key | English | 中文 |
|---|-----|---------|------|
| 177 | `archive.title` | Archived ({count}) | 已归档（{count}） |
| 178 | `archive.badge` | Archived | 已归档 |
| 179 | `archive.restoreAll` | Unarchive all {count} | 全部取消归档（{count} 项） |
| 180 | `archive.empty` | Nothing archived yet. | 还没有归档的任务 |

## tasks

| # | key | English | 中文 |
|---|-----|---------|------|
| 181 | `task.add` | Add | 添加 |
| 182 | `task.addSubtask` | Add subtask | 添加子任务 |
| 183 | `task.addSibling` | Add sibling task | 添加同级任务 |
| 184 | `task.new` | New task | 新建任务 |
| 185 | `task.edit` | Edit task | 编辑任务 |
| 186 | `task.namePlaceholder` | Task name | 任务名称 |
| 187 | `task.parent` | Parent | 父任务 |
| 188 | `task.topLevel` | — Top level — | 最顶层任务 |
| 189 | `task.createAsTodo` | Create as to-do | 创建为待办 |
| 190 | `task.todoNote` | This is a to-do: unscheduled work. It sits last among its siblings inside a {toDos} folder until you give it a schedule with {startTask} in the detail panel. | 这是一项待办：尚未排期的工作。它会排在同级任务末尾的 {toDos} 文件夹中，直到你在详情面板里用 {startTask} 为它安排时间。 |
| 191 | `task.endDateLocked` | The end date is decided by the subtask that ends last — change that subtask’s end date instead. | 结束日期由最晚结束的子任务决定，请改为修改那个子任务的结束日期。 |
| 192 | `task.startDateLocked` | The start date is decided by the subtask that starts first — change that subtask’s start date instead. | 开始日期由最早开始的子任务决定，请改为修改那个子任务的开始日期。 |
| 193 | `task.strictProgress` | Turn off daily logs (not recommended) | 取消日志限制（不推荐） |
| 194 | `task.overdueMark` | This task is already overdue — mark as | 该任务已逾期 —— 标记为 |
| 195 | `task.tagsPlaceholder` | study, health | 学习, 健康 |
| 196 | `task.tagsLabel` | Tags (comma separated) | 标签（用逗号分隔） |
| 197 | `task.subtaskCount` | one: {count} subtask / other: {count} subtasks | {count} 项子任务 |
| 198 | `task.hide` | Hide | 收起 |
| 199 | `task.hidden` | Hidden. | 已收起 |
| 200 | `task.tree` | Task tree | 所在任务树 |
| 201 | `task.treeFocus` | Show one branch | 只展示一支 |
| 202 | `task.pendingLogs` | Still to log | 今日待填 |
| 203 | `task.progressMode` | Progress mode | 进度模式 |
| 204 | `task.modeStrict` | Log-based | 严格模式 |
| 205 | `task.modeAuto` | Simplified (ticked per day) | 简化模式 |
| 206 | `task.modeRolledUp` | From subtasks | 由子任务汇总 |
| 207 | `optOut.title` | Go without log supervision? | 确定采取简化模式(脱离日志系统)吗？ |
| 208 | `optOut.p1` | Without the log system this task will *keep no history at all*, and the Logs page will not manage it. | 脱离日志系统则该任务将*不会拥有历史日志*，且不会在 log 页面里被统一管理。 |
| 209 | `optOut.p2` | It will use a *deliberately crude* way of counting progress: each day you only have to *click a button by hand* to confirm you did it, and the system then accumulates progress as elapsed days ÷ total days. No click, no accumulation. If you miss a day, later daily reports will remind you, and you can leave it for now or put the confirmation in — which is one more click. | 本任务将采用一种*极度简化*的进度计算方式，即每日只需要*手动点击按钮*来确认完成，然后系统自动按已过日期 ÷ 总日期进行进度累计，否则不予累计进度。如果你有某日忘了点按钮，则会在以后的日报里对你进行提醒，你可以按实际需求暂时忽略／将确认补上，也就是再点一下按钮的事。 |
| 210 | `optOut.p3` | This also means the task */may not reflect its real progress*/, and the supervision over whether you did a given day’s work is */close to zero*/. **//Please make sure you have enough self-discipline to go without the log system’s supervision**//. | 这也就意味着，本任务可能将*/无法精确反应任务实际进度*/，且确认某日本任务完成的*/监督力度几乎为 0 */。**//请确保你有足够的自律能力脱离日志系统监督**//。 |
| 211 | `optOut.back` | Back | 返回 |
| 212 | `optOut.confirm` | Turn logs off anyway | 仍要取消 |
| 213 | `day.tick` | Mark this day as done | 把这一天标记为完成 |
| 214 | `task.pausedNote` | one: Paused. Started {start} · paused on {paused} · {count} day elapsed. / other: Paused. Started {start} · paused on {paused} · {count} days elapsed. | 已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。 |
| 215 | `task.resume` | Resume | 恢复 |
| 216 | `task.endPostponed` | End (postponed) | 结束（已顺延） |
| 217 | `task.setAsTodo` | Set as to-do | 设为待办 |
| 218 | `task.pauseConfirm` | Pause "{name}"? | 确定暂停“{name}”？ |
| 219 | `task.resumeConfirm` | Resume "{name}"? | 确定恢复“{name}”？ |
| 220 | `task.archive` | Archive | 归档 |
| 221 | `task.unarchive` | Unarchive | 取消归档 |
| 222 | `task.archiveConfirm` | Archive "{name}"? | 确定归档“{name}”？ |
| 223 | `task.archiveWithSubtasks` | Archive "{name}"? Its subtasks are filed away with it. | 确定归档“{name}”？属于它的子任务也会连带归档。 |
| 224 | `task.pause` | Pause task | 暂停任务 |
| 225 | `task.pauseHistory` | Pause history ({count}) | 暂停记录（{count}） |
| 226 | `task.pauseEntry` | Paused {from} → resumed {to} | 暂停于 {from} → 恢复于 {to} |
| 227 | `task.heat.title` | Completion | 完成情况 |
| 228 | `task.heat.done` | Done | 已完成 |
| 229 | `task.heat.pending` | Not done | 未完成 |
| 230 | `task.heat.none` | Not scheduled | 无排期 |
| 231 | `task.heat.count` | one: {count} task done / other: {count} tasks done | 完成 {count} 项任务 |
| 232 | `task.heat.less` | Less | 少 |
| 233 | `task.heat.more` | More | 多 |
| 234 | `task.setAsTodoConfirm` | Mark "{name}" as to-do?\n\nIts dates, priority and progress are cleared. | 确定将“{name}”设为待办？\n\n它的日期、优先级和进度将被清除。 |
| 235 | `task.setAsTodoConfirmMany` | one: Mark "{name}" and its {count} unfinished subtask as to-do?\n\n / other: Mark "{name}" and its {count} unfinished subtasks as to-do?\n\n | 确定将“{name}”及其 {count} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 236 | `task.markedCompleted` | Marked as completed | 已标记为完成 |

## logs

| # | key | English | 中文 |
|---|-----|---------|------|
| 237 | `log.write` | Write log | 写日志 |
| 238 | `log.editProgress` | Correct progress | 修改进度 |
| 239 | `log.label` | Log | 日志 |
| 240 | `log.contentPlaceholder` | What did you work on? | 今天做了什么？ |
| 241 | `log.editedAt` | edited {time} | 编辑于 {time} |
| 242 | `log.hint` | Each line is an item; Tab indents a sub-item, Shift+Tab outdents. | 每行是一个条目；Tab 键缩进为子条目，Shift+Tab 反向缩进。 |
| 243 | `log.progressAdd` | Progress added (%) | 进度增加（%） |
| 244 | `log.progressAfterDay` | Progress becomes (%) | 进度累积至（%） |
| 245 | `log.currentProgress` | Currently at {percent}% | 目前进度 {percent}% |
| 246 | `log.byDays` | Advance one day | 自动推进一日 |
| 247 | `log.byDaysHint` | Advance one day = add (1 ÷ total days) × 100% of the progress. If less than a fifth of a day’s share is left after that, the task is taken as complete. | 自动推进一日＝增加（1 ÷ 总日数）× 100% 的进度。如果自动推进一日后剩余进度小于一日进度的 1/5，则会默认任务完成。 |
| 248 | `log.progressRequired` | Fill in at least one of the two — put 0 under “{add}” if nothing moved. | 两个格子至少填一个 —— 没进展就在「{add}」里填 0。 |
| 249 | `log.progressBackward` | Progress cannot go backwards — that lands below the figure it started the day at. | 进度不能往回填 |
| 250 | `log.task` | Task | 任务 |
| 251 | `logs.all` | All logs | 全部日志 |
| 252 | `logs.empty` | No logs yet. | 暂无日志。 |
| 253 | `logs.moreTasks` | one: +{count} more task / other: +{count} more tasks | 以及 {count} 项任务 |
| 254 | `logs.tabLogs` | Logs | 日志 |

## notes

| # | key | English | 中文 |
|---|-----|---------|------|
| 255 | `notes.title` | Notes | 记事本 |
| 256 | `notes.empty` | Nothing written yet. | 空空如也 |
| 257 | `notes.add` | Write something | 写点什么 |
| 258 | `notes.placeholder` | Whatever you want to keep. | 写点随想 |
| 259 | `notes.none` | None yet. | 暂无 |

## calendar

| # | key | English | 中文 |
|---|-----|---------|------|
| 260 | `calendar.prevMonth` | Previous month | 上个月 |
| 261 | `calendar.nextMonth` | Next month | 下个月 |
| 262 | `calendar.cellLabel` | {date}: {due}, {starting}; {coverage} | {date}：{due}，{starting}；{coverage} |
| 263 | `calendar.dueCount` | {count} due | {count} 项到期 |
| 264 | `calendar.startingCount` | {count} starting | {count} 项开始 |
| 265 | `calendar.coverage.future` | not yet due | 尚未到期 |
| 266 | `calendar.coverage.clear` | no logs due | 无日志义务 |
| 267 | `calendar.coverage.partial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 268 | `calendar.coverage.full` | all {count} logs written | {count} 项日志已全部记录 |
| 269 | `calendar.more` | +{count} more | 还有 {count} 项 |
| 270 | `calendar.milestoneTitle` | {kind}{strict} — {name}{logged} | {kind}{strict} —— {name}{logged} |
| 271 | `calendar.milestone.due` | Due | 到期 |
| 272 | `calendar.milestone.starts` | Starts | 开始 |
| 273 | `calendar.milestone.strict` |  * |  * |
| 274 | `calendar.milestone.logged` |  · logged this day |  · 当天已记录 |

## day detail

| # | key | English | 中文 |
|---|-----|---------|------|
| 275 | `day.strictLogs` | Logs | 日志 |
| 276 | `day.notYetDue` | Not yet due | 尚未到期 |
| 277 | `day.noStrictScheduled` | No logs due | 当天无日志义务 |
| 278 | `day.allLogged` | Everything logged | 已完成所有日志填写 |
| 279 | `day.nothingLogged` | Nothing logged yet | 尚未记录任何日志 |
| 280 | `day.stillMissing` | {count} still missing | 还差 {count} 项 |
| 281 | `day.noStrictTasksScheduled` | No logs due | 当天没有日志义务 |
| 282 | `day.ringPartial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 283 | `day.taskCount` | one: {count} task on this day / other: {count} tasks on this day | 当天有 {count} 项任务 |
| 284 | `day.tasksBreakdown` | {strict} with logs · {other} other | {strict} 有日志 · {other} 其他 |
| 285 | `day.taskList` | Tasks | 任务清单 |
| 286 | `day.nothingScheduled` | Nothing scheduled on this day. | 当天没有排期。 |
| 287 | `day.logMark` | A * marks a task that owes a daily log. | 带 * 的任务有日志义务。 |
| 288 | `day.readLogs` | Read this day’s logs | 查看当天的日志 |
| 289 | `day.readLogsCount` | Read this day’s logs ({count}) | 查看当天的日志（{count}） |
| 290 | `day.noProgress` | No progress | 无进度 |
| 291 | `day.viewTask` | View task → | 查看任务 → |

## chores (the Today page)

| # | key | English | 中文 |
|---|-----|---------|------|
| 292 | `chore.section` | Chores | 临时事务 |
| 293 | `chore.placeholder` | Add a chore… | 添加临时事务… |
| 294 | `chore.enterHint` | Type the name in the box and press Enter to create it. | 请在文本框内直接输入事项名称，按回车确认创建。 |
| 295 | `chore.emptyToday` | Nothing on hand today. | 今天没有临时事务。 |
| 296 | `chore.emptyTomorrow` | Nothing lined up for tomorrow. | 明天还没有安排。 |
| 297 | `chore.noneOnDay` | No chores on this day. | 当天没有临时事务。 |
| 298 | `chore.stillOpen` | {count} still open | 还有 {count} 项 |
| 299 | `chore.allDone` | All done | 全部完成 |
| 300 | `chore.edit` | Edit chore | 编辑临时事务 |
| 301 | `chore.title` | Chore | 内容 |
| 302 | `chore.note` | Note | 备注 |
| 303 | `chore.notePlaceholder` | Optional | 可不填 |
| 304 | `chore.day` | Day | 日期 |
| 305 | `chore.slot` | Part of day | 时段 |
| 306 | `chore.slot.none` | Anytime | 不限 |
| 307 | `chore.slot.dawn` | Early morning | 凌晨 |
| 308 | `chore.slot.am` | Morning | 上午 |
| 309 | `chore.slot.pm` | Afternoon | 下午 |
| 310 | `chore.slot.eve` | Evening | 晚上 |
| 311 | `chore.time` | Exact time | 时间点 |
| 312 | `chore.timePlaceholder` | e.g. 9:30 / 9:30pm / 21:30 | 如 9:30 / 9:30pm / 21:30 |
| 313 | `chore.timeHint` | 12-hour with am/pm, or 24-hour | 12 小时制带 am/pm，或直接写 24 小时制 |
| 314 | `chore.timeUnreadable` | Not a time we can read | 看不懂这个时间 |
| 315 | `chore.timeMismatch` | {time} is in {timeSlot}, not the {slot} picked above. Which should it use? | {time} 属于「{timeSlot}」，和上面选的「{slot}」不一致。以哪个为准？ |
| 316 | `chore.preferTime` | Switch to {slot} | 改为{slot} |
| 317 | `chore.preferSlot` | Keep {slot} | 保持{slot} |
| 318 | `chore.carriedTitle` | Meant for {date} | 原本定于 {date} |
| 319 | `habit.section` | Routine | 日常安排 |
| 320 | `habit.none` | Nothing daily yet. | 还没有每日项。 |
| 321 | `habit.edit` | Edit daily item | 编辑每日项 |
| 322 | `habit.title` | Item | 内容 |
| 323 | `habit.deleteAsk` | Delete "{name}"? Every day you ticked it goes with it. | 确定删除“{name}”？它的历史完成等记录也会一并删除 |
| 324 | `habit.new` | New routine | 新建日常安排 |
| 325 | `habit.note` | Note | 备注 |
| 326 | `habit.notePlaceholder` | Optional | 可不填 |
| 327 | `habit.weekdays` | Days | 星期几 |
| 328 | `habit.everyDay` | Every day | 每天 |
| 329 | `habit.endDate` | Ends | 结束日期 |
| 330 | `habit.noEndDate` | Leave empty to keep going. | 选填。 |
| 331 | `habit.paused` | Suspended | 停用 |
| 332 | `habit.parent` | Parent | 上级日常安排 |
| 333 | `habit.topLevel` | — Top level — | 最顶层日常安排 |
| 334 | `habit.addSubtask` | Add sub-routine | 添加子日常安排 |

## manage

| # | key | English | 中文 |
|---|-----|---------|------|
| 335 | `manage.overall` | Overall | 总览 |
| 336 | `manage.heat` | Completion heatmap | 完成热力图 |
| 337 | `manage.subtasks` | Subtasks | 子任务 |
| 338 | `manage.parentTasks` | one: {count} parent task / other: {count} parent tasks | {count} 项父任务 |
| 339 | `manage.upcoming` | Upcoming (7 days) | 未来 7 天 |
| 340 | `manage.overdue` | Overdue | 已逾期 |
| 341 | `manage.deleteProject` | Delete project "{name}" and all its tasks? | 确定删除项目“{name}”及其全部任务？ |
| 342 | `manage.openInGantt` | Open in Gantt → | 在甘特图中打开 → |
| 343 | `manage.comingSoon` | Coming soon | 即将开始 |
| 344 | `manage.allStatuses` | All statuses | 全部状态 |
| 345 | `manage.filteredCount` | one: {filtered} of {count} task / other: {filtered} of {count} tasks | 共 {count} 项任务，显示 {filtered} 项 |
| 346 | `manage.empty` | Nothing here. | 暂无内容。 |
| 347 | `manage.sub.active` | active | 进行中 |
| 348 | `manage.sub.tracked` | in total | 全部项目 |
| 349 | `manage.sub.done` | done | 已完成 |
| 350 | `manage.sub.paused` | paused | 已暂停 |
| 351 | `manage.sub.startsIn7` | starts in 7 days | 将在 7 天内开始 |
| 352 | `manage.sub.pastDue` | past due | 已过期 |
| 353 | `manage.sub.pastDueDueSoon` | past due · {count} due soon | 已过期 · {count} 项即将到期 |
| 354 | `manage.sub.unscheduled` | unscheduled | 未排期 |
| 355 | `manage.countCompleted` | {count} completed | {count} 项已完成 |
| 356 | `manage.countOpen` | {count} open | {count} 项未完成 |

## projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 357 | `project.heading` | Project | 项目 |
| 358 | `project.color` | Color | 颜色 |
| 359 | `project.done` | Done | 已完成 |
| 360 | `project.open` | Open | 未完成 |

## merging projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 361 | `project.manage` | Hierarchy | 层级管理器 |
| 362 | `project.moveMode` | Project move mode (if any) | 项目移动方式（如涉及） |
| 363 | `project.moveModeFolder` | A parent task | 变成父任务 |
| 364 | `project.moveModeFlat` | At the top level | 直接铺平 |

## the move dialog

| # | key | English | 中文 |
|---|-----|---------|------|
| 365 | `move.sources` | Move | 将 |
| 366 | `move.target` | Into | 放到 |
| 367 | `move.newProject` | New project | 创建为新项目 |
| 368 | `move.newProjectOr` | or | 或 |
| 369 | `move.newProjectName` | New project | 新项目 |
| 370 | `move.confirm` | Move | 移动 |

## settings

| # | key | English | 中文 |
|---|-----|---------|------|
| 371 | `settings.language` | Language | 语言 |
| 372 | `settings.languageHint` | The language of the interface. | 界面显示所用的语言。 |
| 373 | `settings.theme` | Theme | 主题 |
| 374 | `settings.themeHint` | A whole colour scheme — surfaces, text and the colours that carry meaning. | 一整套配色方案 —— 包括底面、文字，以及承载含义的状态色。 |
| 375 | `settings.themeNote` | Green means done and red means late in every theme; the palettes differ in their surfaces and accent, so a status keeps its meaning whichever one you pick. | 在每一套主题里，绿都代表完成、红都代表逾期。各套之间变化的是底面与强调色，所以无论选哪套，状态的含义都不变。 |
| 376 | `settings.active` | Current | 当前 |
| 377 | `settings.version` | Version | 版本 |
| 378 | `settings.versionHint` | The desktop app checks for updates on every launch. | 桌面版每次启动会自动检查更新。 |
| 379 | `settings.releaseHistory` | Release history | 历史版本 |

## reminders

| # | key | English | 中文 |
|---|-----|---------|------|
| 380 | `settings.reminder` | Reminders | 提醒 |
| 381 | `settings.reminderWebNote` | Reminders are sent by the desktop app — it is the only build that can post to PushPlus. In a browser there is nothing here to set up. | 提醒由桌面版发出 —— 只有桌面版能把消息送到 PushPlus。浏览器版这里没有可设置的东西。 |
| 382 | `settings.reminderOn` | Desktop notifications are on by default. Keep WBS Gantt running in the background. | 桌面弹窗通知默认开启，请保持 WBS-gantt 在电脑后台运行。 |
| 383 | `settings.reminderWechat` | Sync notifications to personal WeChat | 将通知/提醒同步到个人微信 |
| 384 | `settings.reminderTime` | Send at | 发送时间 |
| 385 | `settings.reminderToken` | PushPlus token | PushPlus 令牌 |
| 386 | `settings.reminderPushplusNote` | WBS Gantt relies on PushPlus to sync notifications to WeChat.\nActivating that route means paying PushPlus ¥3.50 for real-name verification, so skipping it is entirely reasonable. | WBS-gantt 依赖 pushplus 在微信同步通知。\n不过，激活该途径需要向 pushplus 支付 3.5 元以完成实名认证。因而放弃配置该途径也是完全可行的。 |
| 387 | `settings.reminderTokenHint` | Sign in at pushplus.plus and paste the token from the top of the page here. | 在 pushplus.plus 扫码登录，并把页面顶部的令牌(token)复制在这里 |
| 388 | `settings.reminderOpen` | Open pushplus.plus | 打开 pushplus.plus |
| 389 | `settings.reminderTest` | Send a test | 发一条试试 |
| 390 | `settings.reminderPreview` | Preview noon’s | 预览中午的 |
| 391 | `settings.reminderSending` | Sending… | 发送中… |
| 392 | `settings.reminderSent` | Sent. | 已发出。 |
| 393 | `settings.backgroundAppOnly` | Without it, reminders only go out while this window happens to be open. | 不装的话，只有这个窗口开着的时候才会发。 |
| 394 | `settings.autostart` | Start with Windows | 开机自启动 |
| 395 | `settings.closeToTray` | Minimize to tray on close | 关闭时最小化到托盘 |
| 396 | `tray.open` | Open WBS Gantt | 打开看板 |
| 397 | `tray.quit` | Quit | 退出 |
| 398 | `reminder.greeting.dawn` | Still up | 强啊传奇耐熬王 |
| 399 | `reminder.greeting.early` | Good morning | 早上好 |
| 400 | `reminder.greeting.morning` | Good morning | 上午好 |
| 401 | `reminder.greeting.noon` | Midday | 中午好 |
| 402 | `reminder.greeting.afternoon` | Good afternoon | 下午好 |
| 403 | `reminder.greeting.dusk` | End of the day | 傍晚了 |
| 404 | `reminder.greeting.evening` | Good evening | 晚上好 |
| 405 | `reminder.greeting.night` | Late night | 夜深了 |
| 406 | `reminder.closing.dawn` |  | ⟨空⟩ |
| 407 | `reminder.closing.early` |  | ⟨空⟩ |
| 408 | `reminder.closing.morning` |  | ⟨空⟩ |
| 409 | `reminder.closing.noon` |  | ⟨空⟩ |
| 410 | `reminder.closing.afternoon` |  | ⟨空⟩ |
| 411 | `reminder.closing.dusk` |  | ⟨空⟩ |
| 412 | `reminder.closing.evening` |  | ⟨空⟩ |
| 413 | `reminder.closing.night` |  | ⟨空⟩ |
| 414 | `reminder.starting` | Starting today | 今天该开始 |
| 415 | `reminder.dueSoon` | Coming up | 即将到期 |
| 416 | `reminder.reportTitle` | Daily report | 日报 |
| 417 | `reminder.reportEmpty` | Nothing outstanding today. | 今日无事 |
| 418 | `reminder.reportYesterday` | Yesterday | 昨日 |
| 419 | `reminder.reportToday` | Today | 今天 |
| 420 | `reminder.reportRate` | Completion | 完成率 |
| 421 | `reminder.groupTasks` | Tasks | 任务清单 |
| 422 | `reminder.groupDeadlines` | Due & overdue | 到期与逾期 |
| 423 | `reminder.testTitle` | WBS Gantt — test message | 看板 —— 测试消息 |
| 424 | `reminder.testBody` | If you are reading this in WeChat, reminders are working. | 你能在微信里看到这条，就说明提醒已经配好了。 |
| 425 | `reminder.nudgeLogs` | Remember to write logs for the tasks you have finished. | 记得为已经完成的任务填写日志。 |
| 426 | `reminder.nudgeDebt` | {count} waiting on you — | 还有 {count} 项事项待处理，其中： |
| 427 | `reminder.nudgeDebtLine` | - {count} {label} | - {count} 项{label} |
| 428 | `reminder.nudgeTasks` | tasks | 任务 |
| 429 | `reminder.ack` | Got it | 我知道了 |
| 430 | `slot.early` | Morning | 早上 |
| 431 | `slot.noon` | Noon | 中午 |
| 432 | `slot.dusk` | Evening | 傍晚 |
| 433 | `reminder.overdue` | Overdue | 已逾期 |
| 434 | `reminder.dueToday` | Due today | 今天到期 |
| 435 | `reminder.logsOwed` | Logs owed | 日志缺少 |
| 436 | `reminder.chores` | Chores | 临时事务 |
| 437 | `reminder.habits` | Routine | 日常安排 |
| 438 | `update.check` | Check for updates | 检查更新 |
| 439 | `update.checking` | Checking… | 检查中… |
| 440 | `update.upToDate` | You are on the latest version. | 已是最新版本。 |
| 441 | `update.availableShort` | An update is available. | 有可用更新。 |
| 442 | `update.unreachable` | Automatic updates are unavailable because GitHub cannot be reached. | 由于无法连接到 GitHub，自动更新不可用。 |
| 443 | `update.unreachableHide` | Hide for this run | 本次运行不显示 |
| 444 | `update.webNote` | Automatic updates apply to the desktop app. In a browser you always load the latest build. | 自动更新只适用于桌面版；在浏览器里打开的始终是最新版本。 |
| 445 | `update.availableTitle` | Update available | 发现新版本 |
| 446 | `update.availableBody` | Version {version} has been released. You are on {current}. | 新版本 {version} 已发布，当前版本为 {current}。 |
| 447 | `update.notes` | Release notes | 更新说明 |
| 448 | `update.history` | Older releases this update brings along ({count}) | 本次将连带更新的历史版本内容（{count} 个版本） |
| 449 | `update.historyTitle` | Release history | 历史版本更新说明 |
| 450 | `update.historyLoading` | Loading… | 读取中… |
| 451 | `update.historyFailed` | Could not read the release list from GitHub. | 没能从 GitHub 读到版本列表。 |
| 452 | `update.noNotes` | This release came with no release notes. | 本次发布未填写更新说明。 |
| 453 | `update.downloadAndInstall` | Update in background | 后台更新 |
| 454 | `update.readyTitle` | Update downloaded | 更新已下载 |
| 455 | `update.readyBody` | Version {version} has been downloaded. Restart now? | 新版本 {version} 已下载完成。立刻重启？ |
| 456 | `update.now` | Restart now | 立刻重启 |
| 457 | `update.installing` | Downloading… | 正在下载… |
| 458 | `update.installFailed` | The update could not be installed: {message} | 更新安装失败：{message} |
| 459 | `update.later` | Later | 以后再说 |
| 460 | `update.snooze` | Ignore for {days} days | {days} 天内不再提醒 |
| 461 | `update.nagTitle` | It has been a while | 已经很久没有更新了 |
| 462 | `update.nagBody` | It has been over a month since this app last reached GitHub. Take a look for bug fixes and new features? | 要不要连上 GitHub 看一眼有没有 bug 修复和新功能呢？ |
| 463 | `update.nagGo` | Go to Settings | 去设置看看 |
| 464 | `update.connectTitle` | Want a stable GitHub connection? | 想稳定连接 GitHub？ |
| 465 | `update.connectBody` | Watt Toolkit (formerly Steam++) is a free, open-source network accelerator. It speeds up both the GitHub website and Release downloads. | Watt Toolkit（原 Steam++）是免费开源的多平台网络加速工具，可以加速 GitHub 网页和 Release 下载。 |
| 466 | `update.connectLink` | Download from steampp.net | 前往官网下载（steampp.net） |
| 467 | `update.opensource` | GitHub is the largest home of open-source software — operating systems, frameworks, ready-made tools, most of it free to use, study and build on. This project’s source and releases live there too. | GitHub 是全球最大的开源社区，托管着数以亿计的开源项目 —— 从操作系统、开发框架到各类现成工具，绝大多数都可以免费使用、学习和二次开发。本项目的源码和版本更新也发布在这里。 |
| 468 | `update.openRepo` | View on GitHub | 在 GitHub 上查看 |
| 469 | `theme.graphite.name` | Graphite | 石墨 |
| 470 | `theme.graphite.hint` | Near-black, neutral | 近黑 · 中性 |
| 471 | `theme.slate.name` | Slate | 板岩 |
| 472 | `theme.slate.hint` | Mid grey-blue, cool | 中灰蓝 · 偏冷 |
| 473 | `theme.ember.name` | Ember | 余烬 |
| 474 | `theme.ember.hint` | Hazel-black, warm | 榛黑 · 偏暖 |
| 475 | `theme.paper.name` | Paper | 纸张 |
| 476 | `theme.paper.hint` | Light, crisp | 浅色 · 清爽 |
| 477 | `swatch.groupChrome` | Interface | 界面 |
| 478 | `swatch.groupSignals` | Meaning | 语义 |
| 479 | `swatch.bg` | Background | 底色 |
| 480 | `swatch.panel` | Panel | 面板 |
| 481 | `swatch.panel2` | Field | 输入框 |
| 482 | `swatch.stripe` | Alt. row | 斑马行 |
| 483 | `swatch.border` | Border | 边框 |
| 484 | `swatch.line` | Divider | 分隔线 |
| 485 | `swatch.fg` | Text | 正文 |
| 486 | `swatch.muted` | Secondary text | 次要文字 |
| 487 | `swatch.dim` | Faint text | 弱化文字 |
| 488 | `swatch.accent` | Accent | 强调色 |

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

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
| 115 | `gantt.editDone` | Done | 完成 |
| 116 | `gantt.editMode` | Edit mode | 编辑模式 |
| 117 | `gantt.selected` | {count} selected | 已选 {count} 项 |
| 118 | `gantt.clearSelection` | Clear selection | 取消选择 |
| 119 | `gantt.setTodoMany` | one: Mark {count} task as to-do?\n\nIts dates, priority and progress are cleared. / other: Mark {count} tasks as to-do?\n\nTheir dates, priorities and progress are cleared. | 确定将这 {count} 个任务设为待办？\n\n它们的日期、优先级和进度将被清除。 |
| 120 | `gantt.setTodoManyWithSubtasks` | one: Mark {count} task and its {subs} unfinished subtask as to-do?\n\n / other: Mark {count} tasks and their {subs} unfinished subtasks as to-do?\n\n | 确定将这 {count} 个任务及其 {subs} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 121 | `gantt.deleteSelected` | one: Delete {count} task? / other: Delete {count} tasks? | 确定删除这 {count} 个任务？ |
| 122 | `gantt.deleteSelectedWithSubtasks` | one: Delete {count} task and its subtasks? / other: Delete {count} tasks and their subtasks? | 确定删除这 {count} 个任务及其子任务？ |
| 123 | `gantt.pauseMany` | one: Pause {count} task? / other: Pause {count} tasks? | 确定暂停 {count} 项任务？ |
| 124 | `gantt.resumeMany` | one: Resume {count} task? / other: Resume {count} tasks? | 确定恢复 {count} 项任务？ |
| 125 | `gantt.archiveMany` | one: Archive {count} task? / other: Archive {count} tasks? | 确定归档 {count} 项任务？ |
| 126 | `gantt.archiveManyWithSubtasks` | one: Archive {count} task? Its subtasks are filed away with it. / other: Archive {count} tasks? Their subtasks are filed away with them. | 确定归档 {count} 项任务？属于它们的子任务也会连带归档。 |
| 127 | `gantt.dragMany` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 128 | `gantt.moved` | Moved {what} | 已移动 {what} |
| 129 | `gantt.undoTodo` | Marked {what} as to-do | 已将 {what}设为待办 |
| 130 | `gantt.undoStart` | Started {what} | 已开始 {what} |
| 131 | `gantt.undoPause` | Paused {what} | 已暂停 {what} |
| 132 | `gantt.undoResume` | Resumed {what} | 已恢复 {what} |
| 133 | `gantt.undoDelete` | Deleted {what} | 已删除 {what} |
| 134 | `gantt.undoArchive` | Archived {what} | 已归档 {what} |
| 135 | `gantt.undoUnarchive` | Brought back {what} | 已取消归档 {what} |
| 136 | `gantt.undo` | Undo | 撤销 |
| 137 | `gantt.undoSeconds` | ({seconds}) | （{seconds}） |

## history

| # | key | English | 中文 |
|---|-----|---------|------|
| 138 | `history.title` | History | 操作历史 |
| 139 | `history.now` | Opened the app | 本次打开 |
| 140 | `history.empty` | Nothing has changed the board yet. | 还没有改动过看板。 |
| 141 | `history.count` | one: {count} item / other: {count} items | {count} 项 |
| 142 | `history.autoAdd` | Added {count} | 新增 {count} 项 |
| 143 | `history.autoRemove` | Removed {count} | 删除 {count} 项 |
| 144 | `history.autoChange` | Changed {count} | 改动 {count} 项 |
| 145 | `history.added` | Added | 新增 |
| 146 | `history.removed` | Removed | 删除 |
| 147 | `history.changed` | Changed | 改动 |
| 148 | `history.projectAdded` | Projects added | 新增项目 |
| 149 | `history.projectRemoved` | Projects removed | 删除项目 |
| 150 | `history.projectChanged` | Projects changed | 项目改动 |
| 151 | `history.more` | … and {count} more | …… 还有 {count} 项 |
| 152 | `history.newTask` | Added {what} | 新建 {what} |
| 153 | `history.editTask` | Edited {what} | 编辑 {what} |
| 154 | `history.newProject` | Added project {what} | 新建项目 {what} |
| 155 | `history.editProject` | Edited project {what} | 编辑项目 {what} |
| 156 | `history.deleteProject` | Deleted project {what} | 删除项目 {what} |
| 157 | `history.move` | Moved {what} | 移动 {what} |
| 158 | `history.moveNewProject` | Moved {what} into a new project | 把 {what} 放进新建的项目 |
| 159 | `history.promoteTask` | Made {what} a project | 把 {what} 升为项目 |
| 160 | `history.outdent` | Moved {what} to top level | 把 {what} 移到顶层 |
| 161 | `history.folderRename` | Renamed a to-do folder | 待办文件夹改名 |

## to-dos

| # | key | English | 中文 |
|---|-----|---------|------|
| 162 | `todo.folderName` | To-dos | 待办 |
| 163 | `todo.folder` | To-dos ({count}) | 待办（{count}） |
| 164 | `todo.startTask` | Start task | 开始任务 |
| 165 | `todo.start` | Start | 开始 |
| 166 | `todo.next` | Next → | 下一个 → |
| 167 | `todo.restoreMany` | one: Restore {count} to-do / other: Restore {count} to-dos | 恢复 {count} 项待办 |
| 168 | `todo.saveAll` | Save all ({count}) | 全部保存（{count}） |
| 169 | `todo.hasSubtasks` | {name} has subtasks, so its dates are decided by them. Restore those first, or set a priority here and let the dates follow. | {name} 有子任务，它的日期由子任务决定。请先恢复那些子任务；也可以只在此设定优先级，让日期随后自动跟进。 |
| 170 | `todo.renameFolder` | Name this folder | 给文件夹起名 |
| 171 | `todo.folderPlaceholder` | Folder name | 文件夹名 |
| 172 | `todo.restoreAll` | Restore all {count} | 恢复全部 {count} 项 |
| 173 | `todo.deleteAll` | Delete all {count} | 删除全部 {count} 项 |

## archive

| # | key | English | 中文 |
|---|-----|---------|------|
| 174 | `archive.title` | Archived ({count}) | 已归档（{count}） |
| 175 | `archive.badge` | Archived | 已归档 |
| 176 | `archive.restoreAll` | Unarchive all {count} | 全部取消归档（{count} 项） |
| 177 | `archive.empty` | Nothing archived yet. | 还没有归档的任务 |

## tasks

| # | key | English | 中文 |
|---|-----|---------|------|
| 178 | `task.add` | Add | 添加 |
| 179 | `task.addSubtask` | Add subtask | 添加子任务 |
| 180 | `task.addSibling` | Add sibling task | 添加同级任务 |
| 181 | `task.new` | New task | 新建任务 |
| 182 | `task.edit` | Edit task | 编辑任务 |
| 183 | `task.namePlaceholder` | Task name | 任务名称 |
| 184 | `task.parent` | Parent | 父任务 |
| 185 | `task.topLevel` | — Top level — | 最顶层任务 |
| 186 | `task.createAsTodo` | Create as to-do | 创建为待办 |
| 187 | `task.todoNote` | This is a to-do: unscheduled work. It sits last among its siblings inside a {toDos} folder until you give it a schedule with {startTask} in the detail panel. | 这是一项待办：尚未排期的工作。它会排在同级任务末尾的 {toDos} 文件夹中，直到你在详情面板里用 {startTask} 为它安排时间。 |
| 188 | `task.endDateLocked` | The end date is decided by the subtask that ends last — change that subtask’s end date instead. | 结束日期由最晚结束的子任务决定，请改为修改那个子任务的结束日期。 |
| 189 | `task.startDateLocked` | The start date is decided by the subtask that starts first — change that subtask’s start date instead. | 开始日期由最早开始的子任务决定，请改为修改那个子任务的开始日期。 |
| 190 | `task.strictProgress` | Turn off daily logs (not recommended) | 取消日志限制（不推荐） |
| 191 | `task.overdueMark` | This task is already overdue — mark as | 该任务已逾期 —— 标记为 |
| 192 | `task.tagsPlaceholder` | study, health | 学习, 健康 |
| 193 | `task.tagsLabel` | Tags (comma separated) | 标签（用逗号分隔） |
| 194 | `task.subtaskCount` | one: {count} subtask / other: {count} subtasks | {count} 项子任务 |
| 195 | `task.hide` | Hide | 收起 |
| 196 | `task.hidden` | Hidden. | 已收起 |
| 197 | `task.tree` | Task tree | 所在任务树 |
| 198 | `task.treeFocus` | Show one branch | 只展示一支 |
| 199 | `task.pendingLogs` | Still to log | 今日待填 |
| 200 | `task.progressMode` | Progress mode | 进度模式 |
| 201 | `task.modeStrict` | Log-based | 严格模式 |
| 202 | `task.modeAuto` | Simplified (ticked per day) | 简化模式 |
| 203 | `task.modeRolledUp` | From subtasks | 由子任务汇总 |
| 204 | `optOut.title` | Go without log supervision? | 确定采取简化模式(脱离日志系统)吗？ |
| 205 | `optOut.p1` | Without the log system this task will *keep no history at all*, and the Logs page will not manage it. | 脱离日志系统则该任务将*不会拥有历史日志*，且不会在 log 页面里被统一管理。 |
| 206 | `optOut.p2` | It will use a *deliberately crude* way of counting progress: each day you only have to *click a button by hand* to confirm you did it, and the system then accumulates progress as elapsed days ÷ total days. No click, no accumulation. If you miss a day, later daily reports will remind you, and you can leave it for now or put the confirmation in — which is one more click. | 本任务将采用一种*极度简化*的进度计算方式，即每日只需要*手动点击按钮*来确认完成，然后系统自动按已过日期 ÷ 总日期进行进度累计，否则不予累计进度。如果你有某日忘了点按钮，则会在以后的日报里对你进行提醒，你可以按实际需求暂时忽略／将确认补上，也就是再点一下按钮的事。 |
| 207 | `optOut.p3` | This also means the task */may not reflect its real progress*/, and the supervision over whether you did a given day’s work is */close to zero*/. **//Please make sure you have enough self-discipline to go without the log system’s supervision**//. | 这也就意味着，本任务可能将*/无法精确反应任务实际进度*/，且确认某日本任务完成的*/监督力度几乎为 0 */。**//请确保你有足够的自律能力脱离日志系统监督**//。 |
| 208 | `optOut.back` | Back | 返回 |
| 209 | `optOut.confirm` | Turn logs off anyway | 仍要取消 |
| 210 | `day.tick` | Mark this day as done | 把这一天标记为完成 |
| 211 | `task.pausedNote` | one: Paused. Started {start} · paused on {paused} · {count} day elapsed. / other: Paused. Started {start} · paused on {paused} · {count} days elapsed. | 已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。 |
| 212 | `task.resume` | Resume | 恢复 |
| 213 | `task.endPostponed` | End (postponed) | 结束（已顺延） |
| 214 | `task.setAsTodo` | Set as to-do | 设为待办 |
| 215 | `task.pauseConfirm` | Pause "{name}"? | 确定暂停“{name}”？ |
| 216 | `task.resumeConfirm` | Resume "{name}"? | 确定恢复“{name}”？ |
| 217 | `task.archive` | Archive | 归档 |
| 218 | `task.unarchive` | Unarchive | 取消归档 |
| 219 | `task.archiveConfirm` | Archive "{name}"? | 确定归档“{name}”？ |
| 220 | `task.archiveWithSubtasks` | Archive "{name}"? Its subtasks are filed away with it. | 确定归档“{name}”？属于它的子任务也会连带归档。 |
| 221 | `task.pause` | Pause task | 暂停任务 |
| 222 | `task.pauseHistory` | Pause history ({count}) | 暂停记录（{count}） |
| 223 | `task.pauseEntry` | Paused {from} → resumed {to} | 暂停于 {from} → 恢复于 {to} |
| 224 | `task.heat.title` | Completion | 完成情况 |
| 225 | `task.heat.done` | Done | 已完成 |
| 226 | `task.heat.pending` | Not done | 未完成 |
| 227 | `task.heat.none` | Not scheduled | 无排期 |
| 228 | `task.heat.count` | one: {count} task done / other: {count} tasks done | 完成 {count} 项任务 |
| 229 | `task.heat.less` | Less | 少 |
| 230 | `task.heat.more` | More | 多 |
| 231 | `task.setAsTodoConfirm` | Mark "{name}" as to-do?\n\nIts dates, priority and progress are cleared. | 确定将“{name}”设为待办？\n\n它的日期、优先级和进度将被清除。 |
| 232 | `task.setAsTodoConfirmMany` | one: Mark "{name}" and its {count} unfinished subtask as to-do?\n\n / other: Mark "{name}" and its {count} unfinished subtasks as to-do?\n\n | 确定将“{name}”及其 {count} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 233 | `task.markedCompleted` | Marked as completed | 已标记为完成 |

## logs

| # | key | English | 中文 |
|---|-----|---------|------|
| 234 | `log.write` | Write log | 写日志 |
| 235 | `log.editProgress` | Correct progress | 修改进度 |
| 236 | `log.label` | Log | 日志 |
| 237 | `log.contentPlaceholder` | What did you work on? | 今天做了什么？ |
| 238 | `log.editedAt` | edited {time} | 编辑于 {time} |
| 239 | `log.hint` | Each line is an item; Tab indents a sub-item, Shift+Tab outdents. | 每行是一个条目；Tab 键缩进为子条目，Shift+Tab 反向缩进。 |
| 240 | `log.progressAdd` | Progress added (%) | 进度增加（%） |
| 241 | `log.progressAfterDay` | Progress becomes (%) | 进度累积至（%） |
| 242 | `log.currentProgress` | Currently at {percent}% | 目前进度 {percent}% |
| 243 | `log.byDays` | Advance one day | 自动推进一日 |
| 244 | `log.byDaysHint` | Advance one day = add (1 ÷ total days) × 100% of the progress. If less than a fifth of a day’s share is left after that, the task is taken as complete. | 自动推进一日＝增加（1 ÷ 总日数）× 100% 的进度。如果自动推进一日后剩余进度小于一日进度的 1/5，则会默认任务完成。 |
| 245 | `log.progressRequired` | Fill in at least one of the two — put 0 under “{add}” if nothing moved. | 两个格子至少填一个 —— 没进展就在「{add}」里填 0。 |
| 246 | `log.progressBackward` | Progress cannot go backwards — that lands below the figure it started the day at. | 进度不能往回填 |
| 247 | `log.task` | Task | 任务 |
| 248 | `logs.all` | All logs | 全部日志 |
| 249 | `logs.empty` | No logs yet. | 暂无日志。 |
| 250 | `logs.moreTasks` | one: +{count} more task / other: +{count} more tasks | 以及 {count} 项任务 |
| 251 | `logs.tabLogs` | Logs | 日志 |

## notes

| # | key | English | 中文 |
|---|-----|---------|------|
| 252 | `notes.title` | Notes | 记事本 |
| 253 | `notes.empty` | Nothing written yet. | 空空如也 |
| 254 | `notes.add` | Write something | 写点什么 |
| 255 | `notes.placeholder` | Whatever you want to keep. | 写点随想 |
| 256 | `notes.none` | None yet. | 暂无 |

## calendar

| # | key | English | 中文 |
|---|-----|---------|------|
| 257 | `calendar.prevMonth` | Previous month | 上个月 |
| 258 | `calendar.nextMonth` | Next month | 下个月 |
| 259 | `calendar.cellLabel` | {date}: {due}, {starting}; {coverage} | {date}：{due}，{starting}；{coverage} |
| 260 | `calendar.dueCount` | {count} due | {count} 项到期 |
| 261 | `calendar.startingCount` | {count} starting | {count} 项开始 |
| 262 | `calendar.coverage.future` | not yet due | 尚未到期 |
| 263 | `calendar.coverage.clear` | no logs due | 无日志义务 |
| 264 | `calendar.coverage.partial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 265 | `calendar.coverage.full` | all {count} logs written | {count} 项日志已全部记录 |
| 266 | `calendar.more` | +{count} more | 还有 {count} 项 |
| 267 | `calendar.milestoneTitle` | {kind}{strict} — {name}{logged} | {kind}{strict} —— {name}{logged} |
| 268 | `calendar.milestone.due` | Due | 到期 |
| 269 | `calendar.milestone.starts` | Starts | 开始 |
| 270 | `calendar.milestone.strict` |  * |  * |
| 271 | `calendar.milestone.logged` |  · logged this day |  · 当天已记录 |

## day detail

| # | key | English | 中文 |
|---|-----|---------|------|
| 272 | `day.strictLogs` | Logs | 日志 |
| 273 | `day.notYetDue` | Not yet due | 尚未到期 |
| 274 | `day.noStrictScheduled` | No logs due | 当天无日志义务 |
| 275 | `day.allLogged` | Everything logged | 已完成所有日志填写 |
| 276 | `day.nothingLogged` | Nothing logged yet | 尚未记录任何日志 |
| 277 | `day.stillMissing` | {count} still missing | 还差 {count} 项 |
| 278 | `day.noStrictTasksScheduled` | No logs due | 当天没有日志义务 |
| 279 | `day.ringPartial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 280 | `day.taskCount` | one: {count} task on this day / other: {count} tasks on this day | 当天有 {count} 项任务 |
| 281 | `day.tasksBreakdown` | {strict} with logs · {other} other | {strict} 有日志 · {other} 其他 |
| 282 | `day.taskList` | Tasks | 任务清单 |
| 283 | `day.nothingScheduled` | Nothing scheduled on this day. | 当天没有排期。 |
| 284 | `day.logMark` | A * marks a task that owes a daily log. | 带 * 的任务有日志义务。 |
| 285 | `day.readLogs` | Read this day’s logs | 查看当天的日志 |
| 286 | `day.readLogsCount` | Read this day’s logs ({count}) | 查看当天的日志（{count}） |
| 287 | `day.noProgress` | No progress | 无进度 |
| 288 | `day.viewTask` | View task → | 查看任务 → |

## chores (the Today page)

| # | key | English | 中文 |
|---|-----|---------|------|
| 289 | `chore.section` | Chores | 临时事务 |
| 290 | `chore.placeholder` | Add a chore… | 添加临时事务… |
| 291 | `chore.enterHint` | Type the name in the box and press Enter to create it. | 请在文本框内直接输入事项名称，按回车确认创建。 |
| 292 | `chore.emptyToday` | Nothing on hand today. | 今天没有临时事务。 |
| 293 | `chore.emptyTomorrow` | Nothing lined up for tomorrow. | 明天还没有安排。 |
| 294 | `chore.noneOnDay` | No chores on this day. | 当天没有临时事务。 |
| 295 | `chore.stillOpen` | {count} still open | 还有 {count} 项 |
| 296 | `chore.allDone` | All done | 全部完成 |
| 297 | `chore.edit` | Edit chore | 编辑临时事务 |
| 298 | `chore.title` | Chore | 内容 |
| 299 | `chore.note` | Note | 备注 |
| 300 | `chore.notePlaceholder` | Optional | 可不填 |
| 301 | `chore.day` | Day | 日期 |
| 302 | `chore.slot` | Part of day | 时段 |
| 303 | `chore.slot.none` | Anytime | 不限 |
| 304 | `chore.slot.dawn` | Early morning | 凌晨 |
| 305 | `chore.slot.am` | Morning | 上午 |
| 306 | `chore.slot.pm` | Afternoon | 下午 |
| 307 | `chore.slot.eve` | Evening | 晚上 |
| 308 | `chore.time` | Exact time | 时间点 |
| 309 | `chore.timePlaceholder` | e.g. 9:30 / 9:30pm / 21:30 | 如 9:30 / 9:30pm / 21:30 |
| 310 | `chore.timeHint` | 12-hour with am/pm, or 24-hour | 12 小时制带 am/pm，或直接写 24 小时制 |
| 311 | `chore.timeUnreadable` | Not a time we can read | 看不懂这个时间 |
| 312 | `chore.timeMismatch` | {time} is in {timeSlot}, not the {slot} picked above. Which should it use? | {time} 属于「{timeSlot}」，和上面选的「{slot}」不一致。以哪个为准？ |
| 313 | `chore.preferTime` | Switch to {slot} | 改为{slot} |
| 314 | `chore.preferSlot` | Keep {slot} | 保持{slot} |
| 315 | `chore.carriedTitle` | Meant for {date} | 原本定于 {date} |
| 316 | `habit.section` | Routine | 日常安排 |
| 317 | `habit.none` | Nothing daily yet. | 还没有每日项。 |
| 318 | `habit.edit` | Edit daily item | 编辑每日项 |
| 319 | `habit.title` | Item | 内容 |
| 320 | `habit.deleteAsk` | Delete "{name}"? Every day you ticked it goes with it. | 确定删除“{name}”？它的历史完成等记录也会一并删除 |
| 321 | `habit.new` | New routine | 新建日常安排 |
| 322 | `habit.note` | Note | 备注 |
| 323 | `habit.notePlaceholder` | Optional | 可不填 |
| 324 | `habit.weekdays` | Days | 星期几 |
| 325 | `habit.everyDay` | Every day | 每天 |
| 326 | `habit.endDate` | Ends | 结束日期 |
| 327 | `habit.noEndDate` | Leave empty to keep going. | 选填。 |
| 328 | `habit.paused` | Suspended | 停用 |
| 329 | `habit.parent` | Parent | 上级日常安排 |
| 330 | `habit.topLevel` | — Top level — | 最顶层日常安排 |
| 331 | `habit.addSubtask` | Add sub-routine | 添加子日常安排 |

## manage

| # | key | English | 中文 |
|---|-----|---------|------|
| 332 | `manage.overall` | Overall | 总览 |
| 333 | `manage.heat` | Completion heatmap | 完成热力图 |
| 334 | `manage.subtasks` | Subtasks | 子任务 |
| 335 | `manage.parentTasks` | one: {count} parent task / other: {count} parent tasks | {count} 项父任务 |
| 336 | `manage.upcoming` | Upcoming (7 days) | 未来 7 天 |
| 337 | `manage.overdue` | Overdue | 已逾期 |
| 338 | `manage.deleteProject` | Delete project "{name}" and all its tasks? | 确定删除项目“{name}”及其全部任务？ |
| 339 | `manage.openInGantt` | Open in Gantt → | 在甘特图中打开 → |
| 340 | `manage.comingSoon` | Coming soon | 即将开始 |
| 341 | `manage.allStatuses` | All statuses | 全部状态 |
| 342 | `manage.filteredCount` | one: {filtered} of {count} task / other: {filtered} of {count} tasks | 共 {count} 项任务，显示 {filtered} 项 |
| 343 | `manage.empty` | Nothing here. | 暂无内容。 |
| 344 | `manage.sub.active` | active | 进行中 |
| 345 | `manage.sub.tracked` | in total | 全部项目 |
| 346 | `manage.sub.done` | done | 已完成 |
| 347 | `manage.sub.paused` | paused | 已暂停 |
| 348 | `manage.sub.startsIn7` | starts in 7 days | 将在 7 天内开始 |
| 349 | `manage.sub.pastDue` | past due | 已过期 |
| 350 | `manage.sub.pastDueDueSoon` | past due · {count} due soon | 已过期 · {count} 项即将到期 |
| 351 | `manage.sub.unscheduled` | unscheduled | 未排期 |
| 352 | `manage.countCompleted` | {count} completed | {count} 项已完成 |
| 353 | `manage.countOpen` | {count} open | {count} 项未完成 |

## projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 354 | `project.heading` | Project | 项目 |
| 355 | `project.color` | Color | 颜色 |
| 356 | `project.done` | Done | 已完成 |
| 357 | `project.open` | Open | 未完成 |

## merging projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 358 | `project.manage` | Hierarchy | 层级管理器 |
| 359 | `project.moveMode` | Project move mode (if any) | 项目移动方式（如涉及） |
| 360 | `project.moveModeFolder` | A parent task | 变成父任务 |
| 361 | `project.moveModeFlat` | At the top level | 直接铺平 |

## the move dialog

| # | key | English | 中文 |
|---|-----|---------|------|
| 362 | `move.sources` | Move | 将 |
| 363 | `move.target` | Into | 放到 |
| 364 | `move.newProject` | New project | 创建为新项目 |
| 365 | `move.newProjectOr` | or | 或 |
| 366 | `move.newProjectName` | New project | 新项目 |
| 367 | `move.confirm` | Move | 移动 |

## settings

| # | key | English | 中文 |
|---|-----|---------|------|
| 368 | `settings.language` | Language | 语言 |
| 369 | `settings.languageHint` | The language of the interface. | 界面显示所用的语言。 |
| 370 | `settings.theme` | Theme | 主题 |
| 371 | `settings.themeHint` | A whole colour scheme — surfaces, text and the colours that carry meaning. | 一整套配色方案 —— 包括底面、文字，以及承载含义的状态色。 |
| 372 | `settings.themeNote` | Green means done and red means late in every theme; the palettes differ in their surfaces and accent, so a status keeps its meaning whichever one you pick. | 在每一套主题里，绿都代表完成、红都代表逾期。各套之间变化的是底面与强调色，所以无论选哪套，状态的含义都不变。 |
| 373 | `settings.active` | Current | 当前 |
| 374 | `settings.version` | Version | 版本 |
| 375 | `settings.versionHint` | The desktop app checks for updates on every launch. | 桌面版每次启动会自动检查更新。 |
| 376 | `settings.releaseHistory` | Release history | 历史版本 |

## reminders

| # | key | English | 中文 |
|---|-----|---------|------|
| 377 | `settings.reminder` | Reminders | 提醒 |
| 378 | `settings.reminderWebNote` | Reminders are sent by the desktop app — it is the only build that can post to PushPlus. In a browser there is nothing here to set up. | 提醒由桌面版发出 —— 只有桌面版能把消息送到 PushPlus。浏览器版这里没有可设置的东西。 |
| 379 | `settings.reminderOn` | Desktop notifications are on by default. Keep WBS Gantt running in the background. | 桌面弹窗通知默认开启，请保持 WBS-gantt 在电脑后台运行。 |
| 380 | `settings.reminderWechat` | Sync notifications to personal WeChat | 将通知/提醒同步到个人微信 |
| 381 | `settings.reminderTime` | Send at | 发送时间 |
| 382 | `settings.reminderToken` | PushPlus token | PushPlus 令牌 |
| 383 | `settings.reminderPushplusNote` | WBS Gantt relies on PushPlus to sync notifications to WeChat.\nActivating that route means paying PushPlus ¥3.50 for real-name verification, so skipping it is entirely reasonable. | WBS-gantt 依赖 pushplus 在微信同步通知。\n不过，激活该途径需要向 pushplus 支付 3.5 元以完成实名认证。因而放弃配置该途径也是完全可行的。 |
| 384 | `settings.reminderTokenHint` | Sign in at pushplus.plus and paste the token from the top of the page here. | 在 pushplus.plus 扫码登录，并把页面顶部的令牌(token)复制在这里 |
| 385 | `settings.reminderOpen` | Open pushplus.plus | 打开 pushplus.plus |
| 386 | `settings.reminderTest` | Send a test | 发一条试试 |
| 387 | `settings.reminderPreview` | Preview noon’s | 预览中午的 |
| 388 | `settings.reminderSending` | Sending… | 发送中… |
| 389 | `settings.reminderSent` | Sent. | 已发出。 |
| 390 | `settings.backgroundAppOnly` | Without it, reminders only go out while this window happens to be open. | 不装的话，只有这个窗口开着的时候才会发。 |
| 391 | `settings.autostart` | Start with Windows | 开机自启动 |
| 392 | `settings.closeToTray` | Minimize to tray on close | 关闭时最小化到托盘 |
| 393 | `tray.open` | Open WBS Gantt | 打开看板 |
| 394 | `tray.quit` | Quit | 退出 |
| 395 | `reminder.greeting.dawn` | Still up | 强啊传奇耐熬王 |
| 396 | `reminder.greeting.early` | Good morning | 早上好 |
| 397 | `reminder.greeting.morning` | Good morning | 上午好 |
| 398 | `reminder.greeting.noon` | Midday | 中午好 |
| 399 | `reminder.greeting.afternoon` | Good afternoon | 下午好 |
| 400 | `reminder.greeting.dusk` | End of the day | 傍晚了 |
| 401 | `reminder.greeting.evening` | Good evening | 晚上好 |
| 402 | `reminder.greeting.night` | Late night | 夜深了 |
| 403 | `reminder.closing.dawn` |  | ⟨空⟩ |
| 404 | `reminder.closing.early` |  | ⟨空⟩ |
| 405 | `reminder.closing.morning` |  | ⟨空⟩ |
| 406 | `reminder.closing.noon` |  | ⟨空⟩ |
| 407 | `reminder.closing.afternoon` |  | ⟨空⟩ |
| 408 | `reminder.closing.dusk` |  | ⟨空⟩ |
| 409 | `reminder.closing.evening` |  | ⟨空⟩ |
| 410 | `reminder.closing.night` |  | ⟨空⟩ |
| 411 | `reminder.starting` | Starting today | 今天该开始 |
| 412 | `reminder.dueSoon` | Coming up | 即将到期 |
| 413 | `reminder.reportTitle` | Daily report | 日报 |
| 414 | `reminder.reportEmpty` | Nothing outstanding today. | 今日无事 |
| 415 | `reminder.reportYesterday` | Yesterday | 昨日 |
| 416 | `reminder.reportToday` | Today | 今天 |
| 417 | `reminder.reportRate` | Completion | 完成率 |
| 418 | `reminder.groupTasks` | Tasks | 任务清单 |
| 419 | `reminder.groupDeadlines` | Due & overdue | 到期与逾期 |
| 420 | `reminder.testTitle` | WBS Gantt — test message | 看板 —— 测试消息 |
| 421 | `reminder.testBody` | If you are reading this in WeChat, reminders are working. | 你能在微信里看到这条，就说明提醒已经配好了。 |
| 422 | `reminder.nudgeLogs` | Remember to write logs for the tasks you have finished. | 记得为已经完成的任务填写日志。 |
| 423 | `reminder.nudgeDebt` | {count} waiting on you — | 还有 {count} 项事项待处理，其中： |
| 424 | `reminder.nudgeDebtLine` | - {count} {label} | - {count} 项{label} |
| 425 | `reminder.nudgeTasks` | tasks | 任务 |
| 426 | `reminder.ack` | Got it | 我知道了 |
| 427 | `slot.early` | Morning | 早上 |
| 428 | `slot.noon` | Noon | 中午 |
| 429 | `slot.dusk` | Evening | 傍晚 |
| 430 | `reminder.overdue` | Overdue | 已逾期 |
| 431 | `reminder.dueToday` | Due today | 今天到期 |
| 432 | `reminder.logsOwed` | Logs owed | 日志缺少 |
| 433 | `reminder.chores` | Chores | 临时事务 |
| 434 | `reminder.habits` | Routine | 日常安排 |
| 435 | `update.check` | Check for updates | 检查更新 |
| 436 | `update.checking` | Checking… | 检查中… |
| 437 | `update.upToDate` | You are on the latest version. | 已是最新版本。 |
| 438 | `update.availableShort` | An update is available. | 有可用更新。 |
| 439 | `update.unreachable` | Automatic updates are unavailable because GitHub cannot be reached. | 由于无法连接到 GitHub，自动更新不可用。 |
| 440 | `update.unreachableHide` | Hide for this run | 本次运行不显示 |
| 441 | `update.webNote` | Automatic updates apply to the desktop app. In a browser you always load the latest build. | 自动更新只适用于桌面版；在浏览器里打开的始终是最新版本。 |
| 442 | `update.availableTitle` | Update available | 发现新版本 |
| 443 | `update.availableBody` | Version {version} has been released. You are on {current}. | 新版本 {version} 已发布，当前版本为 {current}。 |
| 444 | `update.notes` | Release notes | 更新说明 |
| 445 | `update.history` | Older releases this update brings along ({count}) | 本次将连带更新的历史版本内容（{count} 个版本） |
| 446 | `update.historyTitle` | Release history | 历史版本更新说明 |
| 447 | `update.historyLoading` | Loading… | 读取中… |
| 448 | `update.historyFailed` | Could not read the release list from GitHub. | 没能从 GitHub 读到版本列表。 |
| 449 | `update.noNotes` | This release came with no release notes. | 本次发布未填写更新说明。 |
| 450 | `update.downloadAndInstall` | Update in background | 后台更新 |
| 451 | `update.readyTitle` | Update downloaded | 更新已下载 |
| 452 | `update.readyBody` | Version {version} has been downloaded. Restart now? | 新版本 {version} 已下载完成。立刻重启？ |
| 453 | `update.now` | Restart now | 立刻重启 |
| 454 | `update.installing` | Downloading… | 正在下载… |
| 455 | `update.installFailed` | The update could not be installed: {message} | 更新安装失败：{message} |
| 456 | `update.later` | Later | 以后再说 |
| 457 | `update.snooze` | Ignore for {days} days | {days} 天内不再提醒 |
| 458 | `update.nagTitle` | It has been a while | 已经很久没有更新了 |
| 459 | `update.nagBody` | It has been over a month since this app last reached GitHub. Take a look for bug fixes and new features? | 要不要连上 GitHub 看一眼有没有 bug 修复和新功能呢？ |
| 460 | `update.nagGo` | Go to Settings | 去设置看看 |
| 461 | `update.connectTitle` | Want a stable GitHub connection? | 想稳定连接 GitHub？ |
| 462 | `update.connectBody` | Watt Toolkit (formerly Steam++) is a free, open-source network accelerator. It speeds up both the GitHub website and Release downloads. | Watt Toolkit（原 Steam++）是免费开源的多平台网络加速工具，可以加速 GitHub 网页和 Release 下载。 |
| 463 | `update.connectLink` | Download from steampp.net | 前往官网下载（steampp.net） |
| 464 | `update.opensource` | GitHub is the largest home of open-source software — operating systems, frameworks, ready-made tools, most of it free to use, study and build on. This project’s source and releases live there too. | GitHub 是全球最大的开源社区，托管着数以亿计的开源项目 —— 从操作系统、开发框架到各类现成工具，绝大多数都可以免费使用、学习和二次开发。本项目的源码和版本更新也发布在这里。 |
| 465 | `update.openRepo` | View on GitHub | 在 GitHub 上查看 |
| 466 | `theme.graphite.name` | Graphite | 石墨 |
| 467 | `theme.graphite.hint` | Near-black, neutral | 近黑 · 中性 |
| 468 | `theme.slate.name` | Slate | 板岩 |
| 469 | `theme.slate.hint` | Mid grey-blue, cool | 中灰蓝 · 偏冷 |
| 470 | `theme.ember.name` | Ember | 余烬 |
| 471 | `theme.ember.hint` | Hazel-black, warm | 榛黑 · 偏暖 |
| 472 | `theme.paper.name` | Paper | 纸张 |
| 473 | `theme.paper.hint` | Light, crisp | 浅色 · 清爽 |
| 474 | `swatch.groupChrome` | Interface | 界面 |
| 475 | `swatch.groupSignals` | Meaning | 语义 |
| 476 | `swatch.bg` | Background | 底色 |
| 477 | `swatch.panel` | Panel | 面板 |
| 478 | `swatch.panel2` | Field | 输入框 |
| 479 | `swatch.stripe` | Alt. row | 斑马行 |
| 480 | `swatch.border` | Border | 边框 |
| 481 | `swatch.line` | Divider | 分隔线 |
| 482 | `swatch.fg` | Text | 正文 |
| 483 | `swatch.muted` | Secondary text | 次要文字 |
| 484 | `swatch.dim` | Faint text | 弱化文字 |
| 485 | `swatch.accent` | Accent | 强调色 |

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

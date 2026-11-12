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
| 77 | `status.overrun` | Overrun | 已超期 |
| 78 | `status.delayed` | Delayed | 已逾期 |
| 79 | `priority.low` | Low | 低 |
| 80 | `priority.medium` | Medium | 中 |
| 81 | `priority.high` | High | 高 |
| 82 | `priority.top` | Top | 最高 |
| 83 | `priority.title` | {level} priority | {level}优先级 |
| 84 | `type.phase` | Phase | 阶段性任务 |
| 85 | `type.longTerm` | Long-Term | 长期任务 |

## dates and periods

| # | key | English | 中文 |
|---|-----|---------|------|
| 86 | `time.today` | Today | 今天 |
| 87 | `time.tomorrow` | Tomorrow | 明天 |
| 88 | `time.thisWeek` | This week | 本周 |
| 89 | `time.yesterday` | Yesterday | 昨天 |
| 90 | `time.inDays` | one: in {count} day / other: in {count} days | {count} 天后 |
| 91 | `time.daysAgo` | one: {count} day ago / other: {count} days ago | {count} 天前 |
| 92 | `time.minutes` | {count} min | {count} 分钟 |
| 93 | `time.week` | W{count} | {count}周 |
| 94 | `time.quarter` | Q{count} | {count}季度 |
| 95 | `time.monthYear` | {month} {year} | {year}年{month} |
| 96 | `time.quarterYear` | Q{count} {year} | {year}年第{count}季度 |
| 97 | `time.rangeSeparator` |  –  |  –  |

## gantt

| # | key | English | 中文 |
|---|-----|---------|------|
| 98 | `gantt.view.day` | Day | 日 |
| 99 | `gantt.view.week` | Week | 周 |
| 100 | `gantt.view.month` | Month | 月 |
| 101 | `gantt.view.quarter` | Quarter | 季 |
| 102 | `gantt.view.year` | Year | 年 |
| 103 | `gantt.backToToday` | Back to Today | 回到今天 |
| 104 | `gantt.planNudge` | Plan the next step, or archive this task | 可进行下一步规划或归档 |
| 105 | `gantt.gotIt` | Got it | 我知道了 |
| 106 | `gantt.newTask` | New task | 新建任务 |

## the new-thing dialog

| # | key | English | 中文 |
|---|-----|---------|------|
| 107 | `new.title` | New | 新建 |
| 108 | `new.task` | Task | 任务 |
| 109 | `new.project` | Project | 项目 |
| 110 | `gantt.newTaskOrProject` | New task / project | 新建任务/项目 |
| 111 | `gantt.noProject` | A task has to live in a project — create one first. | 任务要放在项目里 —— 请先新建一个项目。 |
| 112 | `gantt.noProject.p1` | WBS-gantt manages projects and tasks much the way an operating system manages files — a directory tree. A project is the root directory at the very top, and every task filed under one is a file or a folder. A file has to live under a root, so a task needs a project chosen for it before it can be created. I do recommend reading the network of tasks you are about to build this way, because… that is how the software is designed. | WBS-gantt 管理项目和任务的方式与电脑操作系统管理文件的方式（目录树）很像。在这里，项目（project）是最顶层的根目录，而每个项目下属的所有任务都可以视作一个文件 / 文件夹。显然文件得存放在根目录下，所以在新建任务前，需要为其指定一个项目。我十分推荐你这样理解你未来即将构建的任务网络，因为……软件就是这么设计的。 |
| 113 | `gantt.noProject.p2` | Beyond giving a task somewhere to exist, a project is only a label for sorting. Read it as the “topic” of the tasks created under it: it gives them a category, so that they can be managed by category — which is the other reason to file your tasks under projects. | 除了为任务的存在提供一个地基之外，项目只是一个分类用的标签。不妨把它理解为在它下面建立的任务的「主题」。它为这些任务定义了一个类别，以便按类管理。所以从管理的角度来看，将任务分类在项目下也是十分必要的。 |
| 114 | `gantt.deleteTask` | Delete "{name}"? | 确定删除“{name}”？ |
| 115 | `gantt.deleteTaskWithSubtasks` | Delete "{name}" and all its subtasks? | 确定删除“{name}”及其所有子任务？ |
| 116 | `gantt.deleteTodos` | one: Delete {count} to-do task? / other: Delete {count} to-do tasks? | 确定删除 {count} 项待办任务？ |
| 117 | `gantt.deleteTodosWithSubtasks` | one: Delete {count} to-do task and its subtasks? / other: Delete {count} to-do tasks and their subtasks? | 确定删除 {count} 项待办任务及其子任务？ |
| 118 | `gantt.ongoingTitle` | {wbs} {name} — ongoing | {wbs} {name} —— 长期进行中 |
| 119 | `gantt.deadlineTitle` | ddl {date} | ddl {date} |
| 120 | `gantt.pickDate` | Click any date to open its day detail | 点击任意日期查看当天详情 |
| 121 | `gantt.writeLogForDay` | Write a log for this day | 为这一天写日志 |
| 122 | `gantt.moveToTopLevel` | Move to top level | 移到顶层 |
| 123 | `gantt.taskTree` | Task tree | 任务树 |
| 124 | `taskTree.taskCount` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 125 | `taskTree.subtasks` | one: {count} subtask / other: {count} subtasks | {count} 个子任务 |
| 126 | `gantt.editDone` | Done | 完成 |
| 127 | `gantt.editMode` | Edit mode | 编辑模式 |
| 128 | `gantt.todoEditMode` | To-do edit mode | 待办编辑模式 |
| 129 | `gantt.selected` | {count} selected | 已选 {count} 项 |
| 130 | `gantt.clearSelection` | Clear selection | 取消选择 |
| 131 | `gantt.setTodoMany` | one: Mark {count} task as to-do?\n\nIts dates, priority and progress are cleared. / other: Mark {count} tasks as to-do?\n\nTheir dates, priorities and progress are cleared. | 确定将这 {count} 个任务设为待办？\n\n它们的日期、优先级和进度将被清除。 |
| 132 | `gantt.setTodoManyWithSubtasks` | one: Mark {count} task and its {subs} unfinished subtask as to-do?\n\n / other: Mark {count} tasks and their {subs} unfinished subtasks as to-do?\n\n | 确定将这 {count} 个任务及其 {subs} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 133 | `gantt.deleteSelected` | one: Delete {count} task? / other: Delete {count} tasks? | 确定删除这 {count} 个任务？ |
| 134 | `gantt.deleteSelectedWithSubtasks` | one: Delete {count} task and its subtasks? / other: Delete {count} tasks and their subtasks? | 确定删除这 {count} 个任务及其子任务？ |
| 135 | `gantt.pauseMany` | one: Pause {count} task? / other: Pause {count} tasks? | 确定暂停 {count} 项任务？ |
| 136 | `gantt.resumeMany` | one: Resume {count} task? / other: Resume {count} tasks? | 确定恢复 {count} 项任务？ |
| 137 | `gantt.archiveMany` | one: Archive {count} task? / other: Archive {count} tasks? | 确定归档 {count} 项任务？ |
| 138 | `gantt.archiveManyWithSubtasks` | one: Archive {count} task? Its subtasks are filed away with it. / other: Archive {count} tasks? Their subtasks are filed away with them. | 确定归档 {count} 项任务？属于它们的子任务也会连带归档。 |
| 139 | `gantt.dragMany` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 140 | `gantt.moved` | Moved {what} | 已移动 {what} |
| 141 | `gantt.undoTodo` | Marked {what} as to-do | 已将 {what}设为待办 |
| 142 | `gantt.undoStart` | Started {what} | 已开始 {what} |
| 143 | `gantt.undoPause` | Paused {what} | 已暂停 {what} |
| 144 | `gantt.undoPostpone` | Postponed {what} | 已延期 {what} |
| 145 | `gantt.undoPostponeEdit` | Edited the postponement of {what} | 已修改 {what} 的延期记录 |
| 146 | `gantt.undoPostponeRevoke` | Revoked a postponement of {what} | 已撤销 {what} 的一次延期 |
| 147 | `gantt.undoResume` | Resumed {what} | 已恢复 {what} |
| 148 | `gantt.undoDelete` | Deleted {what} | 已删除 {what} |
| 149 | `gantt.undoArchive` | Archived {what} | 已归档 {what} |
| 150 | `gantt.undoUnarchive` | Brought back {what} | 已取消归档 {what} |
| 151 | `gantt.undo` | Undo | 撤销 |
| 152 | `gantt.undoSeconds` | ({seconds}) | （{seconds}） |

## history

| # | key | English | 中文 |
|---|-----|---------|------|
| 153 | `history.title` | History | 操作历史 |
| 154 | `history.now` | Opened the app | 本次打开 |
| 155 | `history.empty` | Nothing has changed the board yet. | 还没有改动过看板。 |
| 156 | `history.count` | one: {count} item / other: {count} items | {count} 项 |
| 157 | `history.autoAdd` | Added {count} | 新增 {count} 项 |
| 158 | `history.autoRemove` | Removed {count} | 删除 {count} 项 |
| 159 | `history.autoChange` | Changed {count} | 改动 {count} 项 |
| 160 | `history.added` | Added | 新增 |
| 161 | `history.removed` | Removed | 删除 |
| 162 | `history.changed` | Changed | 改动 |
| 163 | `history.projectAdded` | Projects added | 新增项目 |
| 164 | `history.projectRemoved` | Projects removed | 删除项目 |
| 165 | `history.projectChanged` | Projects changed | 项目改动 |
| 166 | `history.more` | … and {count} more | …… 还有 {count} 项 |
| 167 | `history.newTask` | Added {what} | 新建 {what} |
| 168 | `history.editTask` | Edited {what} | 编辑 {what} |
| 169 | `history.newProject` | Added project {what} | 新建项目 {what} |
| 170 | `history.editProject` | Edited project {what} | 编辑项目 {what} |
| 171 | `history.deleteProject` | Deleted project {what} | 删除项目 {what} |
| 172 | `history.move` | Moved {what} | 移动 {what} |
| 173 | `history.moveNewProject` | Moved {what} into a new project | 把 {what} 放进新建的项目 |
| 174 | `history.promoteTask` | Made {what} a project | 把 {what} 升为项目 |
| 175 | `history.outdent` | Moved {what} to top level | 把 {what} 移到顶层 |
| 176 | `history.folderRename` | Renamed a to-do folder | 待办文件夹改名 |

## to-dos

| # | key | English | 中文 |
|---|-----|---------|------|
| 177 | `todo.folderName` | To-dos | 待办 |
| 178 | `todo.folder` | To-dos ({count}) | 待办（{count}） |
| 179 | `todo.startTask` | Start task | 开始任务 |
| 180 | `todo.start` | Start | 开始 |
| 181 | `todo.next` | Next → | 下一个 → |
| 182 | `todo.restoreMany` | one: Restore {count} to-do / other: Restore {count} to-dos | 恢复 {count} 项待办 |
| 183 | `todo.saveAll` | Save all ({count}) | 全部保存（{count}） |
| 184 | `todo.hasSubtasks` | {name} has subtasks, so its dates are decided by them. Restore those first, or set a priority here and let the dates follow. | {name} 有子任务，它的日期由子任务决定。请先恢复那些子任务；也可以只在此设定优先级，让日期随后自动跟进。 |
| 185 | `todo.renameFolder` | Name this folder | 给文件夹起名 |
| 186 | `todo.folderPlaceholder` | Folder name | 文件夹名 |
| 187 | `todo.restoreAll` | Restore all {count} | 恢复全部 {count} 项 |
| 188 | `todo.deleteAll` | Delete all {count} | 删除全部 {count} 项 |

## archive

| # | key | English | 中文 |
|---|-----|---------|------|
| 189 | `archive.title` | Archived ({count}) | 已归档（{count}） |
| 190 | `archive.badge` | Archived | 已归档 |
| 191 | `archive.restoreAll` | Unarchive all {count} | 全部取消归档（{count} 项） |
| 192 | `archive.empty` | Nothing archived yet. | 还没有归档的任务 |

## tasks

| # | key | English | 中文 |
|---|-----|---------|------|
| 193 | `task.add` | Add | 添加 |
| 194 | `task.addSubtask` | Add subtask | 添加子任务 |
| 195 | `task.addSibling` | Add sibling task | 添加同级任务 |
| 196 | `task.new` | New task | 新建任务 |
| 197 | `task.edit` | Edit task | 编辑任务 |
| 198 | `task.namePlaceholder` | Task name | 任务名称 |
| 199 | `task.parent` | Parent | 父任务 |
| 200 | `task.topLevel` | — Top level — | 最顶层任务 |
| 201 | `task.createAsTodo` | Create as to-do | 创建为待办 |
| 202 | `task.todoNote` | This is a to-do: unscheduled work. It sits last among its siblings inside a {toDos} folder until you give it a schedule with {startTask} in the detail panel. | 这是一项待办：尚未排期的工作。它会排在同级任务末尾的 {toDos} 文件夹中，直到你在详情面板里用 {startTask} 为它安排时间。 |
| 203 | `task.endDateLocked` | The end date is decided by the subtask that ends last — change that subtask’s end date instead. | 结束日期由最晚结束的子任务决定，请改为修改那个子任务的结束日期。 |
| 204 | `task.startDateLocked` | The start date is fixed to the day this task was created; the end follows the subtask that ends last. | 开始日期固定为任务创建那天；结束日期由最晚结束的子任务决定。 |
| 205 | `task.strictProgress` | Turn off daily logs (not recommended) | 取消日志限制（不推荐） |
| 206 | `task.deadline` | ddl | ddl |
| 207 | `task.deadlineOptional` | ddl (optional) | ddl（可选） |
| 208 | `task.deadlineHint` | The end date is the finish you plan for; the ddl is the literal deadline. A ddl adds a hard constraint and is used by the overdue checks and reminders elsewhere. | 结束日期是用户根据规划自定义的任务期望结束日期，而 ddl 是字面意义上的 ddl。填写 ddl 之后会为任务提供更详细的信息，并在其它地方纳入计算或进行提示。 |
| 209 | `task.deadlineFromEnd` | = end date | = 结束日期 |
| 210 | `task.deadlineBeforeEnd` | The end date is later than the ddl. | 结束日期晚于 ddl。 |
| 211 | `task.overdueMark` | This task is already overdue — mark as | 该任务已逾期 —— 标记为 |
| 212 | `task.tagsPlaceholder` | study, health | 学习, 健康 |
| 213 | `task.tagsLabel` | Tags (comma separated) | 标签（用逗号分隔） |
| 214 | `task.subtaskCount` | one: {count} subtask / other: {count} subtasks | {count} 项子任务 |
| 215 | `task.hide` | Hide | 收起 |
| 216 | `task.hidden` | Hidden. | 已收起 |
| 217 | `task.tree` | Task tree | 所在任务树 |
| 218 | `task.treeFocus` | Show one branch | 只展示一支 |
| 219 | `task.pendingLogs` | Still to log | 今日待填 |
| 220 | `task.progressMode` | Progress mode | 进度模式 |
| 221 | `task.modeStrict` | Log-based | 严格模式 |
| 222 | `task.modeAuto` | Simplified (ticked per day) | 简化模式 |
| 223 | `task.modeRolledUp` | From subtasks | 由子任务汇总 |
| 224 | `optOut.title` | Go without log supervision? | 确定采取简化模式(脱离日志系统)吗？ |
| 225 | `optOut.p1` | Without the log system this task will *keep no history at all*, and the Logs page will not manage it. | 脱离日志系统则该任务将*不会拥有历史日志*，且不会在 log 页面里被统一管理。 |
| 226 | `optOut.p2` | It will use a *deliberately crude* way of counting progress: each day you only have to *click a button by hand* to confirm you did it, and the system then accumulates progress as elapsed days ÷ total days. No click, no accumulation. If you miss a day, later daily reports will remind you, and you can leave it for now or put the confirmation in — which is one more click. | 本任务将采用一种*极度简化*的进度计算方式，即每日只需要*手动点击按钮*来确认完成，然后系统自动按已过日期 ÷ 总日期进行进度累计，否则不予累计进度。如果你有某日忘了点按钮，则会在以后的日报里对你进行提醒，你可以按实际需求暂时忽略／将确认补上，也就是再点一下按钮的事。 |
| 227 | `optOut.p3` | This also means the task */may not reflect its real progress*/, and the supervision over whether you did a given day’s work is */close to zero*/. **//Please make sure you have enough self-discipline to go without the log system’s supervision**//. | 这也就意味着，本任务可能将*/无法精确反应任务实际进度*/，且确认某日本任务完成的*/监督力度几乎为 0 */。**//请确保你有足够的自律能力脱离日志系统监督**//。 |
| 228 | `optOut.back` | Back | 返回 |
| 229 | `optOut.confirm` | Turn logs off anyway | 仍要取消 |
| 230 | `day.tick` | Mark this day as done | 把这一天标记为完成 |
| 231 | `task.pausedNote` | one: Paused. Started {start} · paused on {paused} · {count} day elapsed. / other: Paused. Started {start} · paused on {paused} · {count} days elapsed. | 已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。 |
| 232 | `task.resume` | Resume | 恢复 |
| 233 | `task.endPostponed` | End (postponed) | 结束（已顺延） |
| 234 | `task.setAsTodo` | Set as to-do | 设为待办 |
| 235 | `task.pauseConfirm` | Pause "{name}"? | 确定暂停“{name}”？ |
| 236 | `task.resumeConfirm` | Resume "{name}"? | 确定恢复“{name}”？ |
| 237 | `task.archive` | Archive | 归档 |
| 238 | `task.unarchive` | Unarchive | 取消归档 |
| 239 | `task.archiveReason` | Archive reason (optional) | 归档原因（选填） |
| 240 | `task.archiveConfirm` | Archive "{name}"? | 确定归档“{name}”？ |
| 241 | `task.archiveWithSubtasks` | Archive "{name}"? Its subtasks are filed away with it. | 确定归档“{name}”？属于它的子任务也会连带归档。 |
| 242 | `task.pause` | Pause task | 暂停任务 |
| 243 | `task.pauseReason` | Pause reason (optional) | 暂停理由（选填） |
| 244 | `task.pauseHistory` | Pause history ({count}) | 暂停记录（{count}） |
| 245 | `task.pauseEntry` | Paused {from} → resumed {to} | 暂停于 {from} → 恢复于 {to} |
| 246 | `task.postpone` | Postpone task | 延期任务 |
| 247 | `task.postponeTitle` | Postpone "{name}" | 延期“{name}” |
| 248 | `task.postponeCurrent` | Current end: {date} | 当前结束于 {date} |
| 249 | `task.postponeNewEnd` | New end date | 新的结束日期 |
| 250 | `task.postponeReason` | Reason (optional) | 延期理由（选填） |
| 251 | `task.postponeLater` | The new end date must be later than the current one. | 新的结束日期必须晚于当前结束日期。 |
| 252 | `task.postponeConfirm` | Postpone | 确认延期 |
| 253 | `task.postponeHistory` | Postpone history ({count}) | 延期记录（{count}） |
| 254 | `task.postponeEditTitle` | Edit the postponement of "{name}" | 编辑“{name}”的延期记录 |
| 255 | `task.postponeDate` | Recorded on | 记录日期 |
| 256 | `task.postponeFrom` | Previous end | 原结束日期 |
| 257 | `task.postponeLaterFrom` | The new end date must be later than the previous one. | 新的结束日期必须晚于原结束日期。 |
| 258 | `task.postponeRevoke` | Revoke this postponement | 撤销这次延期 |
| 259 | `task.heat.title` | Completion | 完成情况 |
| 260 | `task.heat.done` | Done | 已完成 |
| 261 | `task.heat.pending` | Not done | 未完成 |
| 262 | `task.heat.none` | Not scheduled | 无排期 |
| 263 | `task.heat.count` | one: {count} task done / other: {count} tasks done | 完成 {count} 项任务 |
| 264 | `task.heat.less` | Less | 少 |
| 265 | `task.heat.more` | More | 多 |
| 266 | `task.setAsTodoConfirm` | Mark "{name}" as to-do?\n\nIts dates, priority and progress are cleared. | 确定将“{name}”设为待办？\n\n它的日期、优先级和进度将被清除。 |
| 267 | `task.setAsTodoConfirmMany` | one: Mark "{name}" and its {count} unfinished subtask as to-do?\n\n / other: Mark "{name}" and its {count} unfinished subtasks as to-do?\n\n | 确定将“{name}”及其 {count} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 268 | `task.markedCompleted` | Marked as completed | 已标记为完成 |

## logs

| # | key | English | 中文 |
|---|-----|---------|------|
| 269 | `log.write` | Write log | 写日志 |
| 270 | `log.editProgress` | Correct progress | 修改进度 |
| 271 | `log.label` | Log | 日志 |
| 272 | `log.contentPlaceholder` | What did you work on? | 今天做了什么？ |
| 273 | `log.editedAt` | edited {time} | 编辑于 {time} |
| 274 | `log.hint` | Each line is an item; Tab indents a sub-item, Shift+Tab outdents. | 每行是一个条目；Tab 键缩进为子条目，Shift+Tab 反向缩进。 |
| 275 | `log.progressAdd` | Progress added (%) | 进度增加（%） |
| 276 | `log.progressAfterDay` | Progress becomes (%) | 进度累积至（%） |
| 277 | `log.currentProgress` | Currently at {percent}% | 目前进度 {percent}% |
| 278 | `log.byDays` | Advance one day | 自动推进一日 |
| 279 | `log.complete` | Complete | 完成 |
| 280 | `log.byDaysHint` | Advance one day = add (1 ÷ total days) × 100% of the progress. If less than a fifth of a day’s share is left after that, the task is taken as complete. | 自动推进一日＝增加（1 ÷ 总日数）× 100% 的进度。如果自动推进一日后剩余进度小于一日进度的 1/5，则会默认任务完成。 |
| 281 | `log.progressRequired` | Fill in at least one of the two — put 0 under “{add}” if nothing moved. | 两个格子至少填一个 —— 没进展就在「{add}」里填 0。 |
| 282 | `log.task` | Task | 任务 |
| 283 | `logs.all` | All logs | 全部日志 |
| 284 | `logs.empty` | No logs yet. | 暂无日志。 |
| 285 | `logs.moreTasks` | one: +{count} more task / other: +{count} more tasks | 以及 {count} 项任务 |
| 286 | `logs.tabLogs` | Logs | 日志 |

## notes

| # | key | English | 中文 |
|---|-----|---------|------|
| 287 | `notes.title` | Notes | 记事本 |
| 288 | `notes.empty` | Nothing written yet. | 空空如也 |
| 289 | `notes.add` | Write something | 写点什么 |
| 290 | `notes.placeholder` | Whatever you want to keep. | 写点随想 |
| 291 | `notes.none` | None yet. | 暂无 |

## sticky notes (the corkboard)

| # | key | English | 中文 |
|---|-----|---------|------|
| 292 | `sticky.title` | Notes | 便签 |
| 293 | `sticky.defaultName` | Label {n} | 标签 {n} |
| 294 | `sticky.name` | Name | 名称 |
| 295 | `sticky.rename` | Rename note | 重命名便签 |
| 296 | `sticky.expandNote` | Expand note | 展开便签 |
| 297 | `sticky.collapseNote` | Collapse to title | 折叠为标题 |
| 298 | `sticky.add` | New note | 新建便签 |
| 299 | `sticky.placeholder` | Write something… | 写点什么… |
| 300 | `sticky.delete` | Delete note | 删除便签 |
| 301 | `sticky.deleteConfirm` | Delete this note? Its text cannot be recovered. | 删除这张便签？文字无法恢复。 |
| 302 | `sticky.collapse` | Collapse notes | 收起便签 |
| 303 | `sticky.expand` | Open notes | 展开便签 |
| 304 | `sticky.empty` | No notes on the board yet. | 板上还没有便签。 |
| 305 | `sticky.drag` | Drag this note | 拖动这张便签 |
| 306 | `sticky.bold` | Bold | 粗体 |
| 307 | `sticky.sizeSmall` | Smaller text | 小字号 |
| 308 | `sticky.sizeDefault` | Default text size | 默认字号 |
| 309 | `sticky.sizeLarge` | Larger text | 大字号 |
| 310 | `sticky.textColor` | Text colour | 文字颜色 |
| 311 | `sticky.noteColor` | Note colour | 便签颜色 |
| 312 | `sticky.colorDefault` | Default | 默认 |
| 313 | `sticky.customColor` | Custom colour | 自定义颜色 |
| 314 | `sticky.colorDrag` | Drag to pick a text colour | 拖动选择文字颜色 |
| 315 | `sticky.resize` | Resize note | 调整便签大小 |

## calendar

| # | key | English | 中文 |
|---|-----|---------|------|
| 316 | `calendar.prevMonth` | Previous month | 上个月 |
| 317 | `calendar.nextMonth` | Next month | 下个月 |
| 318 | `calendar.cellLabel` | {date}: {due}, {starting}; {coverage} | {date}：{due}，{starting}；{coverage} |
| 319 | `calendar.dueCount` | {count} due | {count} 项到期 |
| 320 | `calendar.startingCount` | {count} starting | {count} 项开始 |
| 321 | `calendar.coverage.future` | not yet due | 尚未到期 |
| 322 | `calendar.coverage.clear` | no logs due | 无日志义务 |
| 323 | `calendar.coverage.partial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 324 | `calendar.coverage.full` | all {count} logs written | {count} 项日志已全部记录 |
| 325 | `calendar.more` | +{count} more | 还有 {count} 项 |
| 326 | `calendar.milestoneTitle` | {kind}{strict} — {name}{logged} | {kind}{strict} —— {name}{logged} |
| 327 | `calendar.milestone.due` | Due | 到期 |
| 328 | `calendar.milestone.starts` | Starts | 开始 |
| 329 | `calendar.milestone.strict` |  * |  * |
| 330 | `calendar.milestone.logged` |  · logged this day |  · 当天已记录 |

## day detail

| # | key | English | 中文 |
|---|-----|---------|------|
| 331 | `day.strictLogs` | Logs | 日志 |
| 332 | `day.notYetDue` | Not yet due | 尚未到期 |
| 333 | `day.noStrictScheduled` | Nothing due | 当天没有要做的事 |
| 334 | `day.allLogged` | Everything logged | 已完成所有日志填写 |
| 335 | `day.nothingLogged` | Nothing done yet | 还没有完成任何一项 |
| 336 | `day.stillMissing` | {count} still missing | 还差 {count} 项 |
| 337 | `day.noStrictTasksScheduled` | Nothing due | 当天没有要做的事 |
| 338 | `day.ringPartial` | {count} of {total} done | 已完成 {count}/{total} 项 |
| 339 | `day.ringAll` | All done | 全部完成 |
| 340 | `day.taskCount` | one: {count} task on this day / other: {count} tasks on this day | 当天有 {count} 项任务 |
| 341 | `day.tasksBreakdown` | {strict} with logs · {other} other | {strict} 有日志 · {other} 其他 |
| 342 | `day.taskList` | Tasks | 任务清单 |
| 343 | `day.sort` | Sort | 排序 |
| 344 | `day.sortStatus` | Status | 按状态 |
| 345 | `day.sortPriority` | Priority | 按优先级 |
| 346 | `day.nothingScheduled` | Nothing scheduled on this day. | 当天没有排期。 |
| 347 | `day.logMark` | A * marks a task that owes a daily log. | 带 * 的任务有日志义务。 |
| 348 | `day.readLogs` | Read this day’s logs | 查看当天的日志 |
| 349 | `day.readLogsCount` | Read this day’s logs ({count}) | 查看当天的日志（{count}） |
| 350 | `day.noProgress` | No progress | 无进度 |
| 351 | `day.viewTask` | View task → | 查看任务 → |

## the day's plan and the timetable (Today page)

| # | key | English | 中文 |
|---|-----|---------|------|
| 352 | `plan.button` | Plan | 规划 |
| 353 | `plan.adjust` | Adjust | 调整 |
| 354 | `plan.title` | Plan {date} | 规划 {date} |
| 355 | `plan.selectTasks` | Tick the tasks for today and fill in the hours | 勾选今天要做的任务，填上预计小时 |
| 356 | `plan.save` | Save plan | 保存安排 |
| 357 | `plan.restDay` | Rest day | 休息日 |
| 358 | `plan.restDayEmpty` | Nothing planned for this day. | 今天没有安排任务。 |
| 359 | `plan.restoreAuto` | Back to automatic | 恢复自动 |
| 360 | `plan.load` | {used} / {capacity} h scheduled | 已排 {used} / {capacity} 小时 |
| 361 | `plan.over` | over | 超载 |
| 362 | `plan.notScheduled` | not scheduled | 当天未排期 |
| 363 | `plan.sinceLastLog` | one: 1 day since the last log / other: {count} days since the last log | 距上一份日志已 {count} 天 |
| 364 | `plan.noCandidates` | No tasks to choose from for this day. | 当天没有可安排的任务。 |
| 365 | `plan.selected` | {count} selected | 已选 {count} 项 |
| 366 | `plan.promptTitle` | Today’s plan | 今天的安排 |
| 367 | `plan.freeTime` | How much free time do you have today? | 今天有多少空闲时间？ |
| 368 | `plan.later` | Fill in later | 稍后再填 |
| 369 | `plan.startToday` | Start today | 开启今日 |
| 370 | `plan.promptTag` | Today is not planned yet — click to plan | 今天还没有安排，点击规划 |
| 371 | `plan.promptTab` | Plan today | 今日待规划 |
| 372 | `plan.hours` | Hours today | 今天几小时 |
| 373 | `plan.default` | default | 默认 |
| 374 | `plan.setDefault` | Use this as the default hours | 设为默认工时 |
| 375 | `load.label` | Load | 负载 |
| 376 | `load.used` | {hours} h scheduled | 已排 {hours} 小时 |
| 377 | `load.available` | Available | 可用 |
| 378 | `load.left` | {hours} h left | 还剩 {hours} 小时 |
| 379 | `load.overBy` | {hours} h over | 超载 {hours} 小时 |
| 380 | `load.unfilled` | Not set | 未填写 |
| 381 | `load.unknown` | Cannot calculate | 无法计算 |
| 382 | `load.reference` | Reference | 参考值 |
| 383 | `schedule.title` | Schedule | 日程 |
| 384 | `schedule.capacity` | Available hours | 可用小时 |
| 385 | `schedule.load` | {used} / {capacity} h | {used} / {capacity} 小时 |
| 386 | `schedule.over` | over | 超载 |
| 387 | `schedule.addTitle` | New block | 新建日程 |
| 388 | `schedule.newBeside` | New at the same time | 同一时段新建 |
| 389 | `schedule.editTitle` | Edit block | 编辑日程 |
| 390 | `schedule.kind` | Type | 类型 |
| 391 | `schedule.kind.task` | Task | 任务时段 |
| 392 | `schedule.kind.event` | Event | 自由事件 |
| 393 | `schedule.kind.deadline` | Deadline | 截止时间 |
| 394 | `schedule.kind.course` | Course | 课程 |
| 395 | `schedule.task` | Task | 任务 |
| 396 | `schedule.noTask` | No task | 不关联任务 |
| 397 | `schedule.unscheduled` | To schedule | 待排 |
| 398 | `schedule.name` | Title | 标题 |
| 399 | `schedule.start` | Start | 开始 |
| 400 | `schedule.end` | End | 结束 |
| 401 | `schedule.invalidTime` | The end must be later than the start. | 结束时间必须晚于开始时间。 |
| 402 | `schedule.invalidName` | Add a title or choose a task. | 填标题或选一个任务。 |
| 403 | `schedule.openTask` | Open task | 打开任务 |

## chores (the Today page)

| # | key | English | 中文 |
|---|-----|---------|------|
| 404 | `chore.section` | Chores | 临时事务 |
| 405 | `chore.placeholder` | Add a chore… | 添加临时事务… |
| 406 | `chore.enterHint` | Type the name in the box and press Enter to create it. | 请在文本框内直接输入事项名称，按回车确认创建。 |
| 407 | `chore.emptyToday` | Nothing on hand today. | 今天没有临时事务。 |
| 408 | `chore.emptyTomorrow` | Nothing lined up for tomorrow. | 明天还没有安排。 |
| 409 | `chore.noneOnDay` | No chores on this day. | 当天没有临时事务。 |
| 410 | `chore.stillOpen` | {count} still open | 还有 {count} 项 |
| 411 | `chore.allDone` | All done | 全部完成 |
| 412 | `chore.edit` | Edit chore | 编辑临时事务 |
| 413 | `chore.title` | Chore | 内容 |
| 414 | `chore.note` | Note | 备注 |
| 415 | `chore.notePlaceholder` | Optional | 可不填 |
| 416 | `chore.day` | Day | 日期 |
| 417 | `chore.slot` | Part of day | 时段 |
| 418 | `chore.slot.none` | Anytime | 不限 |
| 419 | `chore.slot.dawn` | Early morning | 凌晨 |
| 420 | `chore.slot.am` | Morning | 上午 |
| 421 | `chore.slot.pm` | Afternoon | 下午 |
| 422 | `chore.slot.eve` | Evening | 晚上 |
| 423 | `chore.time` | Exact time | 时间点 |
| 424 | `chore.timePlaceholder` | e.g. 9:30 / 9:30pm / 21:30 | 如 9:30 / 9:30pm / 21:30 |
| 425 | `chore.timeHint` | 12-hour with am/pm, or 24-hour | 12 小时制带 am/pm，或直接写 24 小时制 |
| 426 | `chore.timeUnreadable` | Not a time we can read | 看不懂这个时间 |
| 427 | `chore.timeMismatch` | {time} is in {timeSlot}, not the {slot} picked above. Which should it use? | {time} 属于「{timeSlot}」，和上面选的「{slot}」不一致。以哪个为准？ |
| 428 | `chore.preferTime` | Switch to {slot} | 改为{slot} |
| 429 | `chore.preferSlot` | Keep {slot} | 保持{slot} |
| 430 | `chore.carriedTitle` | Meant for {date} | 原本定于 {date} |
| 431 | `habit.section` | Routine | 日常安排 |
| 432 | `habit.none` | Nothing daily yet. | 还没有每日项。 |
| 433 | `habit.edit` | Edit daily item | 编辑每日项 |
| 434 | `habit.title` | Item | 内容 |
| 435 | `habit.deleteAsk` | Delete "{name}"? Every day you ticked it goes with it. | 确定删除“{name}”？它的历史完成等记录也会一并删除 |
| 436 | `habit.new` | New routine | 新建日常安排 |
| 437 | `habit.note` | Note | 备注 |
| 438 | `habit.notePlaceholder` | Optional | 可不填 |
| 439 | `habit.weekdays` | Days | 星期几 |
| 440 | `habit.everyDay` | Every day | 每天 |
| 441 | `habit.duration` | Time per day (optional) | 每天大约多久（可选） |
| 442 | `habit.durationUnit` | min | 分钟 |
| 443 | `habit.endDate` | Ends | 结束日期 |
| 444 | `habit.noEndDate` | Leave empty to keep going. | 选填。 |
| 445 | `habit.paused` | Suspended | 停用 |
| 446 | `habit.parent` | Parent | 上级日常安排 |
| 447 | `habit.topLevel` | — Top level — | 最顶层日常安排 |
| 448 | `habit.addSubtask` | Add sub-routine | 添加子日常安排 |

## manage

| # | key | English | 中文 |
|---|-----|---------|------|
| 449 | `manage.overall` | Overall | 总览 |
| 450 | `manage.heat` | Completion heatmap | 完成热力图 |
| 451 | `manage.subtasks` | Subtasks | 子任务 |
| 452 | `manage.parentTasks` | one: {count} parent task / other: {count} parent tasks | {count} 项父任务 |
| 453 | `manage.upcoming` | Upcoming (7 days) | 未来 7 天 |
| 454 | `manage.overdue` | Overdue | 已逾期 |
| 455 | `manage.deleteProject` | Delete project "{name}" and all its tasks? | 确定删除项目“{name}”及其全部任务？ |
| 456 | `manage.openInGantt` | Open in Gantt → | 在甘特图中打开 → |
| 457 | `manage.comingSoon` | Coming soon | 即将开始 |
| 458 | `manage.allStatuses` | All statuses | 全部状态 |
| 459 | `manage.filteredCount` | one: {filtered} of {count} task / other: {filtered} of {count} tasks | 共 {count} 项任务，显示 {filtered} 项 |
| 460 | `manage.empty` | Nothing here. | 暂无内容。 |
| 461 | `manage.sub.active` | active | 进行中 |
| 462 | `manage.sub.tracked` | in total | 全部项目 |
| 463 | `manage.sub.done` | done | 已完成 |
| 464 | `manage.sub.paused` | paused | 已暂停 |
| 465 | `manage.sub.startsIn7` | starts in 7 days | 将在 7 天内开始 |
| 466 | `manage.sub.pastDue` | past due | 已过期 |
| 467 | `manage.sub.pastDueDueSoon` | past due · {count} due soon | 已过期 · {count} 项即将到期 |
| 468 | `manage.sub.unscheduled` | unscheduled | 未排期 |
| 469 | `manage.countCompleted` | {count} completed | {count} 项已完成 |
| 470 | `manage.countOpen` | {count} open | {count} 项未完成 |

## projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 471 | `project.heading` | Project | 项目 |
| 472 | `project.color` | Color | 颜色 |
| 473 | `project.done` | Done | 已完成 |
| 474 | `project.open` | Open | 未完成 |

## merging projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 475 | `project.manage` | Hierarchy | 层级管理器 |
| 476 | `project.moveMode` | Project move mode (if any) | 项目移动方式（如涉及） |
| 477 | `project.moveModeFolder` | A parent task | 变成父任务 |
| 478 | `project.moveModeFlat` | At the top level | 直接铺平 |

## the move dialog

| # | key | English | 中文 |
|---|-----|---------|------|
| 479 | `move.sources` | Move | 将 |
| 480 | `move.target` | Into | 放到 |
| 481 | `move.newProject` | New project | 创建为新项目 |
| 482 | `move.newProjectOr` | or | 或 |
| 483 | `move.newProjectName` | New project | 新项目 |
| 484 | `move.confirm` | Move | 移动 |

## settings

| # | key | English | 中文 |
|---|-----|---------|------|
| 485 | `settings.language` | Language | 语言 |
| 486 | `settings.languageHint` | The language of the interface. | 界面显示所用的语言。 |
| 487 | `settings.theme` | Theme | 主题 |
| 488 | `settings.themeHint` | A whole colour scheme — surfaces, text and the colours that carry meaning. | 一整套配色方案 —— 包括底面、文字，以及承载含义的状态色。 |
| 489 | `settings.themeNote` | Green means done and red means late in every theme; the palettes differ in their surfaces and accent, so a status keeps its meaning whichever one you pick. | 在每一套主题里，绿都代表完成、红都代表逾期。各套之间变化的是底面与强调色，所以无论选哪套，状态的含义都不变。 |
| 490 | `settings.active` | Current | 当前 |
| 491 | `settings.version` | Version | 版本 |
| 492 | `course.section` | Timetable | 课表 |
| 493 | `course.hint` | Import a weekly timetable from Excel (.xlsx, .xls, .xlsm, .xlsb). If the file marks groups, pick yours; if it has no date row, also give the Monday of week 1. A preview appears before anything is written. | 导入每周课表，支持 Excel 文件（.xlsx / .xls / .xlsm / .xlsb）。如果文件里标了分组，选你的组；如果表里没有日期行，还需要第 1 周周一。导入前会先出预览，确认后才写入。 |
| 494 | `course.edit` | Edit course | 编辑课程 |
| 495 | `course.location` | Location | 地点 |
| 496 | `course.group` | Group | 分组 |
| 497 | `course.groupAll` | All | 全部 |
| 498 | `course.import` | Import Excel | 导入 Excel |
| 499 | `course.reading` | Reading… | 正在读取… |
| 500 | `course.clear` | Clear timetable | 清空课表 |
| 501 | `course.clearAsk` | Clear the imported timetable? | 确定清空已导入的课表？ |
| 502 | `course.empty` | No timetable imported. | 还没有导入课表。 |
| 503 | `course.summary` | {count} classes · {weeks} · week 1 starts {date} | {count} 节课 · {weeks} · 第 1 周从 {date} 开始 |
| 504 | `course.week` | week {week} | 第 {week} 周 |
| 505 | `course.weeks` | weeks {from}–{to} | 第 {from}–{to} 周 |
| 506 | `course.previewTitle` | Import timetable | 导入课表 |
| 507 | `course.conflict` | Week {week} appears in more than one file; the last one wins. | 第 {week} 周在多个文件里都有，以最后一份为准。 |
| 508 | `course.overwrites` | This replaces the classes already stored for {weeks}. | 会覆盖课表里已有的 {weeks}。 |
| 509 | `course.importConfirm` | Import | 导入 |
| 510 | `course.noWeeks` | No classes were found in this file. | 这个文件里没有找到课程。 |
| 511 | `course.readError` | Could not read this file. | 读不了这个文件。 |
| 512 | `course.badFile` | This Excel file could not be read: it may be encrypted or damaged. Open it in Excel and save it again as .xlsx. | 读不了这个 Excel 文件：可能已加密或损坏。用 Excel 打开后另存为 .xlsx 再试。 |
| 513 | `course.tooBig` | This file is too large to be a timetable. | 文件太大，不像是一份课表。 |
| 514 | `course.aiRead` | Read with AI | 用 AI 解析 |
| 515 | `course.aiReadAll` | Read all with AI | 用 AI 重新解析全部 |
| 516 | `course.aiReading` | AI is reading… | AI 正在解析… |
| 517 | `course.aiSendAsk` | Send the unread sheets to DeepSeek? This may use tokens. You will choose the group and weeks in the preview; if there is no date row, fill in the Monday of week 1. | 把没识别出的表发送给 DeepSeek 解析？可能消耗 tokens。预览里再选分组和周次；如果表里没有日期行，请填写第 1 周周一。 |
| 518 | `course.aiFailed` | AI could not read this file. | AI 没能识别这份课表。 |
| 519 | `course.aiWarnings` | {dropped} invalid rows skipped; {out} rows outside the requested weeks. | 跳过 {dropped} 行无效数据，忽略 {out} 行不在本次周次内的数据。 |
| 520 | `course.aiEmpty` | AI returned no usable classes. | AI 没有返回可用的课程。 |
| 521 | `course.aiProgress` | Sent {sheets} sheet(s) to DeepSeek — {stage} ({seconds}s) | 已发送 {sheets} 张工作表给 DeepSeek — {stage}（{seconds} 秒） |
| 522 | `course.aiStageThinking` | waiting for the model | 等待模型返回 |
| 523 | `course.aiStageCorrecting` | model did not return the format, retrying | 模型没按格式返回，正在重试 |
| 524 | `course.aiStageValidating` | validating the result | 正在校验并合并结果 |
| 525 | `course.periodTimes` | This sheet gives period numbers, not clock times. Fill in each period’s start and end; it is used for this import only. | 这份表只写了节次，没有钟点时间。请补充每节的起止时间；只会用于这次导入。 |
| 526 | `course.period` | Period {period} | 第 {period} 节 |
| 527 | `course.aiSemesterStart` | Monday of week 1 | 第 1 周周一 |
| 528 | `course.aiSemesterHint` | The timetable has no date row; set this before importing. | 课表里没有日期行，请先填写。 |
| 529 | `ai.open` | AI assistant | AI 助手 |
| 530 | `ai.title` | AI assistant | AI 助手 |
| 531 | `ai.placeholder` | What do you want to do? | 你想做什么？ |
| 532 | `ai.send` | Send | 发送 |
| 533 | `ai.stop` | Stop | 停止 |
| 534 | `ai.clear` | Clear | 清空 |
| 535 | `ai.empty` | Ask me to plan, create tasks, or explain how to do something in the app. | 可以让我排今天的计划、建任务树，或者讲解软件里的操作。 |
| 536 | `ai.notConfigured` | Add your DeepSeek API key in Settings → AI. | 请在 设置 → AI 里填写 DeepSeek API Key。 |
| 537 | `ai.goSettings` | Open settings | 去设置 |
| 538 | `ai.disclosure` | Requests are sent to DeepSeek; only the data needed for your request is included. | 请求会发送到 DeepSeek，只包含完成本次操作需要的数据。 |
| 539 | `ai.thinking` | Working… | 处理中… |
| 540 | `ai.toolRunning` | Using {name}… | 正在使用 {name}… |
| 541 | `ai.applied` | Applied. | 已应用。 |
| 542 | `ai.cancelled` | Proposal cancelled; nothing was written. | 已取消，没有写入。 |
| 543 | `ai.applyFailed` | Could not apply: {message} | 应用失败：{message} |
| 544 | `ai.appliedPrompt` | The user applied "{summary}". Result: {result}. Reply with one short sentence about what changed, then at most 3 manual steps for next time. | 用户已应用“{summary}”。结果：{result}。请用一句话说明改了什么，再用最多 3 步说明下次自己怎么做。 |
| 545 | `ai.error.noKey` | No DeepSeek API key is set. | 没有填写 DeepSeek API Key。 |
| 546 | `ai.error.auth` | The DeepSeek API key was rejected. | DeepSeek API Key 被拒绝。 |
| 547 | `ai.error.balance` | The DeepSeek account has no balance. | DeepSeek 账户余额不足。 |
| 548 | `ai.error.rateLimit` | DeepSeek is rate-limiting requests; try again shortly. | DeepSeek 限流了，稍后再试。 |
| 549 | `ai.error.network` | Could not reach DeepSeek. Check the network (the web build may be blocked by CORS). | 连不上 DeepSeek；检查网络（网页版可能被 CORS 拦截）。 |
| 550 | `ai.error.timeout` | DeepSeek did not answer in time. | DeepSeek 没有及时响应。 |
| 551 | `ai.error.aborted` | Request stopped. | 已停止请求。 |
| 552 | `ai.error.badResponse` | DeepSeek returned an unexpected response. | DeepSeek 返回了无法识别的结果。 |
| 553 | `ai.error.maxSteps` | The assistant took too many steps; try a smaller request. | 助手步骤过多，请把请求拆小一点。 |
| 554 | `ai.error.unknown` | The assistant request failed. | 助手请求失败。 |
| 555 | `ai.proposal.apply` | Apply | 应用 |
| 556 | `ai.proposal.cancel` | Cancel | 取消 |
| 557 | `ai.proposal.pending` | Waiting for your confirmation | 等待你确认 |
| 558 | `ai.proposal.applied` | Applied | 已应用 |
| 559 | `ai.proposal.cancelled` | Cancelled | 已取消 |
| 560 | `ai.proposal.taskTree` | Create tasks | 创建任务 |
| 561 | `ai.proposal.dayPlan` | Day plan | 当天计划 |
| 562 | `ai.proposal.project` | Project | 项目 |
| 563 | `ai.proposal.newProject` | New project | 新项目 |
| 564 | `ai.proposal.parent` | Under | 放在 |
| 565 | `ai.proposal.hours` | Hours | 小时 |
| 566 | `ai.proposal.rest` | Rest day | 休息日 |
| 567 | `ai.proposal.clear` | Automatic | 自动 |
| 568 | `ai.proposal.noUndo` | Saving a day plan cannot be undone. | 保存当天计划不能撤销。 |
| 569 | `ai.proposal.warnings` | Warnings | 提醒 |
| 570 | `ai.undo.taskTree` | AI created tasks | AI 创建任务 |
| 571 | `ai.settings.title` | AI assistant | AI 助手 |
| 572 | `ai.settings.hint` | Use your own DeepSeek key. The app sends requests directly to DeepSeek. | 使用你自己的 DeepSeek Key；应用会直接请求 DeepSeek。 |
| 573 | `ai.settings.key` | DeepSeek API key | DeepSeek API Key |
| 574 | `ai.settings.model` | Model | 模型 |
| 575 | `ai.settings.customModel` | Custom… | 自定义… |
| 576 | `ai.settings.test` | Test connection | 测试连接 |
| 577 | `ai.settings.testing` | Testing… | 测试中… |
| 578 | `ai.settings.success` | Connection works. | 连接正常。 |
| 579 | `ai.settings.failure` | Connection failed: {message} | 连接失败：{message} |
| 580 | `ai.settings.storage` | The key is stored locally in plain text and is never part of an exported board. | Key 明文存在本机，不会写进导出的看板。 |
| 581 | `ai.settings.fixed` | Endpoint: https://api.deepseek.com | 地址：https://api.deepseek.com |
| 582 | `settings.versionHint` | The desktop app checks for updates on every launch. | 桌面版每次启动会自动检查更新。 |
| 583 | `settings.releaseHistory` | Release history | 历史版本 |

## feedback

| # | key | English | 中文 |
|---|-----|---------|------|
| 584 | `feedback.title` | Feedback | 意见反馈 |
| 585 | `feedback.hint` | Found a bug, want a feature, or something just feels wrong? Write it here. The app version and OS are attached to the message to help narrow it down. | 遇到 bug、想加功能，或者哪里用着别扭，写在这里。发送时会附上应用版本和系统信息，方便定位。 |
| 586 | `feedback.placeholder` | What is on your mind? | 写下你的想法… |
| 587 | `feedback.copy` | Copy | 复制内容 |
| 588 | `feedback.copied` | Copied | 已复制 |
| 589 | `feedback.copyFailed` | Could not copy — select the text manually | 复制失败，请手动选中文字 |
| 590 | `feedback.address` | Or write to | 也可以直接发到 |
| 591 | `feedback.subject` | Feedback for WBS · Gantt | 对 WBS · Gantt 的意见 |
| 592 | `feedback.github` | Submit on GitHub | 在 GitHub 上提交 |
| 593 | `feedback.githubHint` | Needs a GitHub account, and you must stay signed in in your browser. | 需要 GitHub 账号，并在浏览器里保持登录。 |

## reminders

| # | key | English | 中文 |
|---|-----|---------|------|
| 594 | `settings.reminder` | Reminders | 提醒 |
| 595 | `settings.reminderWebNote` | Reminders are sent by the desktop app — it is the only build that can post to PushPlus. In a browser there is nothing here to set up. | 提醒由桌面版发出 —— 只有桌面版能把消息送到 PushPlus。浏览器版这里没有可设置的东西。 |
| 596 | `settings.reminderOn` | Desktop notifications are on by default. Keep WBS Gantt running in the background. | 桌面弹窗通知默认开启，请保持 WBS-gantt 在电脑后台运行。 |
| 597 | `settings.reminderWechat` | Sync notifications to personal WeChat | 将通知/提醒同步到个人微信 |
| 598 | `settings.reminderTime` | Send at | 发送时间 |
| 599 | `settings.reminderToken` | PushPlus token | PushPlus 令牌 |
| 600 | `settings.reminderPushplusNote` | WBS Gantt relies on PushPlus to sync notifications to WeChat.\nActivating that route means paying PushPlus ¥3.50 for real-name verification, so skipping it is entirely reasonable. | WBS-gantt 依赖 pushplus 在微信同步通知。\n不过，激活该途径需要向 pushplus 支付 3.5 元以完成实名认证。因而放弃配置该途径也是完全可行的。 |
| 601 | `settings.reminderTokenHint` | Sign in at pushplus.plus and paste the token from the top of the page here. | 在 pushplus.plus 扫码登录，并把页面顶部的令牌(token)复制在这里 |
| 602 | `settings.reminderOpen` | Open pushplus.plus | 打开 pushplus.plus |
| 603 | `settings.reminderTest` | Send a test | 发一条试试 |
| 604 | `settings.reminderPreview` | Preview noon’s | 预览中午的 |
| 605 | `settings.reminderSending` | Sending… | 发送中… |
| 606 | `settings.reminderSent` | Sent. | 已发出。 |
| 607 | `settings.backgroundAppOnly` | Without it, reminders only go out while this window happens to be open. | 不装的话，只有这个窗口开着的时候才会发。 |
| 608 | `settings.autostart` | Start with Windows | 开机自启动 |
| 609 | `settings.closeToTray` | Minimize to tray on close | 关闭时最小化到托盘 |
| 610 | `tray.open` | Open WBS Gantt | 打开看板 |
| 611 | `tray.quit` | Quit | 退出 |
| 612 | `reminder.greeting.dawn` | Still up | 强啊传奇耐熬王 |
| 613 | `reminder.greeting.early` | Good morning | 早上好 |
| 614 | `reminder.greeting.morning` | Good morning | 上午好 |
| 615 | `reminder.greeting.noon` | Midday | 中午好 |
| 616 | `reminder.greeting.afternoon` | Good afternoon | 下午好 |
| 617 | `reminder.greeting.dusk` | End of the day | 傍晚了 |
| 618 | `reminder.greeting.evening` | Good evening | 晚上好 |
| 619 | `reminder.greeting.night` | Late night | 夜深了 |
| 620 | `reminder.closing.dawn` |  | ⟨空⟩ |
| 621 | `reminder.closing.early` |  | ⟨空⟩ |
| 622 | `reminder.closing.morning` |  | ⟨空⟩ |
| 623 | `reminder.closing.noon` |  | ⟨空⟩ |
| 624 | `reminder.closing.afternoon` |  | ⟨空⟩ |
| 625 | `reminder.closing.dusk` |  | ⟨空⟩ |
| 626 | `reminder.closing.evening` |  | ⟨空⟩ |
| 627 | `reminder.closing.night` |  | ⟨空⟩ |
| 628 | `reminder.starting` | Starting today | 今天该开始 |
| 629 | `reminder.dueSoon` | Coming up | 即将到期 |
| 630 | `reminder.reportTitle` | Daily report | 日报 |
| 631 | `reminder.reportEmpty` | Nothing outstanding today. | 今日无事 |
| 632 | `reminder.reportYesterday` | Yesterday | 昨日 |
| 633 | `reminder.reportToday` | Today | 今天 |
| 634 | `reminder.reportRate` | Completion | 完成率 |
| 635 | `reminder.groupTasks` | Tasks | 任务清单 |
| 636 | `reminder.groupDeadlines` | Due & overdue | 到期与逾期 |
| 637 | `reminder.testTitle` | WBS Gantt — test message | 看板 —— 测试消息 |
| 638 | `reminder.testBody` | If you are reading this in WeChat, reminders are working. | 你能在微信里看到这条，就说明提醒已经配好了。 |
| 639 | `reminder.nudgeLogs` | Remember to write logs for the tasks you have finished. | 记得为已经完成的任务填写日志。 |
| 640 | `reminder.nudgeDebt` | {count} waiting on you — | 还有 {count} 项事项待处理，其中： |
| 641 | `reminder.nudgeDebtLine` | - {count} {label} | - {count} 项{label} |
| 642 | `reminder.nudgeTasks` | tasks | 任务 |
| 643 | `reminder.ack` | Got it | 我知道了 |
| 644 | `slot.early` | Morning | 早上 |
| 645 | `slot.noon` | Noon | 中午 |
| 646 | `slot.dusk` | Evening | 傍晚 |
| 647 | `reminder.overdue` | Overdue | 已逾期 |
| 648 | `reminder.dueToday` | Due today | 今天到期 |
| 649 | `reminder.logsOwed` | Logs owed | 日志缺少 |
| 650 | `reminder.chores` | Chores | 临时事务 |
| 651 | `reminder.habits` | Routine | 日常安排 |
| 652 | `update.check` | Check for updates | 检查更新 |
| 653 | `update.checking` | Checking… | 检查中… |
| 654 | `update.upToDate` | You are on the latest version. | 已是最新版本。 |
| 655 | `update.availableShort` | An update is available. | 有可用更新。 |
| 656 | `update.unreachable` | Automatic updates are unavailable because GitHub cannot be reached. | 由于无法连接到 GitHub，自动更新不可用。 |
| 657 | `update.unreachableHide` | Hide for this run | 本次运行不显示 |
| 658 | `update.webNote` | Automatic updates apply to the desktop app. In a browser you always load the latest build. | 自动更新只适用于桌面版；在浏览器里打开的始终是最新版本。 |
| 659 | `update.availableTitle` | Update available | 发现新版本 |
| 660 | `update.availableBody` | Version {version} has been released. You are on {current}. | 新版本 {version} 已发布，当前版本为 {current}。 |
| 661 | `update.importantTitle` | Important update | 重要更新 |
| 662 | `update.importantBody` | This update ships new features or other important changes. Please read the release notes before updating. | 本次更新涉及新功能上线或其它重要改动，请确保阅读过更新文件之后再进行更新。 |
| 663 | `update.notes` | Release notes | 更新说明 |
| 664 | `update.history` | Older releases this update brings along ({count}) | 本次将连带更新的历史版本内容（{count} 个版本） |
| 665 | `update.historyTitle` | Release history | 历史版本更新说明 |
| 666 | `update.noNotes` | This release came with no release notes. | 本次发布未填写更新说明。 |
| 667 | `update.downloadAndInstall` | Update in background | 后台更新 |
| 668 | `update.readyTitle` | Update downloaded | 更新已下载 |
| 669 | `update.readyBody` | Version {version} has been downloaded. Restart now? | 新版本 {version} 已下载完成。立刻重启？ |
| 670 | `update.now` | Restart now | 立刻重启 |
| 671 | `update.installing` | Downloading… | 正在下载… |
| 672 | `update.installFailed` | The update could not be installed: {message} | 更新安装失败：{message} |
| 673 | `update.later` | Later | 以后再说 |
| 674 | `update.snooze` | Ignore for {days} days | {days} 天内不再提醒 |
| 675 | `update.nagTitle` | It has been a while | 已经很久没有更新了 |
| 676 | `update.nagBody` | It has been over a month since this app last reached GitHub. Take a look for bug fixes and new features? | 要不要连上 GitHub 看一眼有没有 bug 修复和新功能呢？ |
| 677 | `update.nagGo` | Go to Settings | 去设置看看 |
| 678 | `update.connectTitle` | Want a stable GitHub connection? | 想稳定连接 GitHub？ |
| 679 | `update.connectBody` | Watt Toolkit (formerly Steam++) is a free, open-source network accelerator. It speeds up both the GitHub website and Release downloads. | Watt Toolkit（原 Steam++）是免费开源的多平台网络加速工具，可以加速 GitHub 网页和 Release 下载。 |
| 680 | `update.connectLink` | Download from steampp.net | 前往官网下载（steampp.net） |
| 681 | `update.opensource` | GitHub is the largest home of open-source software — operating systems, frameworks, ready-made tools, most of it free to use, study and build on. This project’s source and releases live there too. | GitHub 是全球最大的开源社区，托管着数以亿计的开源项目 —— 从操作系统、开发框架到各类现成工具，绝大多数都可以免费使用、学习和二次开发。本项目的源码和版本更新也发布在这里。 |
| 682 | `update.openRepo` | View on GitHub | 在 GitHub 上查看 |
| 683 | `theme.graphite.name` | Graphite | 石墨 |
| 684 | `theme.graphite.hint` | Near-black, neutral | 近黑 · 中性 |
| 685 | `theme.slate.name` | Slate | 板岩 |
| 686 | `theme.slate.hint` | Mid grey-blue, cool | 中灰蓝 · 偏冷 |
| 687 | `theme.ember.name` | Ember | 余烬 |
| 688 | `theme.ember.hint` | Hazel-black, warm | 榛黑 · 偏暖 |
| 689 | `theme.paper.name` | Paper | 纸张 |
| 690 | `theme.paper.hint` | Light, crisp | 浅色 · 清爽 |
| 691 | `swatch.groupChrome` | Interface | 界面 |
| 692 | `swatch.groupSignals` | Meaning | 语义 |
| 693 | `swatch.bg` | Background | 底色 |
| 694 | `swatch.panel` | Panel | 面板 |
| 695 | `swatch.panel2` | Field | 输入框 |
| 696 | `swatch.stripe` | Alt. row | 斑马行 |
| 697 | `swatch.border` | Border | 边框 |
| 698 | `swatch.line` | Divider | 分隔线 |
| 699 | `swatch.fg` | Text | 正文 |
| 700 | `swatch.muted` | Secondary text | 次要文字 |
| 701 | `swatch.dim` | Faint text | 弱化文字 |
| 702 | `swatch.accent` | Accent | 强调色 |

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

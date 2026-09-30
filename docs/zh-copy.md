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
| 1 | `app.title` | WBS · Gantt — Project Control | WBS · Gantt —— 项目管控 |

## navigation and shell

| # | key | English | 中文 |
|---|-----|---------|------|
| 2 | `nav.gantt` | Gantt | 甘特图 |
| 3 | `nav.logs` | Logs / Notes | 日志 / 记事本 |
| 4 | `nav.manage` | Manage | 管理 |
| 5 | `nav.calendar` | Calendar | 日历 |
| 6 | `nav.settings` | Settings | 设置 |
| 7 | `sidebar.projects` | Projects | 项目 |
| 8 | `sidebar.allProjects` | All projects | 全部项目 |
| 9 | `sidebar.expandAll` | Expand all | 全部展开 |
| 10 | `sidebar.collapseAll` | Collapse all | 全部折叠 |
| 11 | `sidebar.editProject` | Edit project | 编辑项目 |
| 12 | `sidebar.export` | Export | 导出 |
| 13 | `sidebar.exportTitle` | Export JSON | 导出 JSON |
| 14 | `sidebar.import` | Import | 导入 |
| 15 | `sidebar.importTitle` | Import JSON | 导入 JSON |
| 16 | `sidebar.importFailed` | Import failed: {message} | 导入失败：{message} |

## shared vocabulary

| # | key | English | 中文 |
|---|-----|---------|------|
| 17 | `common.none` | — | — |
| 18 | `common.tbd` | TBD | 待定 |
| 19 | `common.cancel` | Cancel | 取消 |
| 20 | `common.save` | Save | 保存 |
| 21 | `common.delete` | Delete | 删除 |
| 22 | `common.edit` | Edit | 编辑 |
| 23 | `common.view` | View | 查看 |
| 24 | `common.close` | Close | 关闭 |
| 25 | `common.ok` | OK | 确定 |
| 26 | `common.gotIt` | Got it | 我知道了 |
| 27 | `common.confirm` | Confirm | 确认 |
| 28 | `common.confirmTitle` | Please confirm | 请确认 |
| 29 | `common.noticeTitle` | Notice | 提示 |
| 30 | `common.name` | Name | 名称 |
| 31 | `common.date` | Date | 日期 |
| 32 | `common.type` | Type | 类型 |
| 33 | `common.project` | Project | 项目 |
| 34 | `common.status` | Status | 状态 |
| 35 | `common.priority` | Priority | 优先级 |
| 36 | `common.progress` | Progress | 进度 |
| 37 | `common.description` | Description | 描述 |
| 38 | `common.noDescription` | No description. | 暂无描述。 |
| 39 | `common.tags` | Tags | 标签 |
| 40 | `common.tasks` | Tasks | 任务 |
| 41 | `common.task` | Task | 任务 |
| 42 | `common.start` | Start | 开始 |
| 43 | `common.end` | End | 结束 |
| 44 | `common.startDate` | Start date | 开始日期 |
| 45 | `common.endDate` | End date | 结束日期 |
| 46 | `common.history` | History | 历史 |
| 47 | `common.dependencies` | Dependencies | 依赖 |
| 48 | `common.wbs` | WBS | WBS |
| 49 | `common.prog` | Prog | 进度 |
| 50 | `common.expand` | Expand | 展开 |
| 51 | `common.collapse` | Collapse | 折叠 |
| 52 | `common.select` | Select | 选择 |
| 53 | `common.deselect` | Deselect | 取消选择 |
| 54 | `common.selectAll` | Select all | 全选 |
| 55 | `common.deselectAll` | Deselect all | 取消全选 |
| 56 | `common.listSeparator` | ,  | 、 |
| 57 | `common.pathSeparator` |  ›  |  ›  |
| 58 | `common.unknownTask` | Unknown task | 未知任务 |
| 59 | `common.notes` | Notes… | 备注… |
| 60 | `common.targetProgress` | Target progress: {percent}% | 目标进度：{percent}% |
| 61 | `common.taskCount` | one: {count} task / other: {count} tasks | {count} 项任务 |
| 62 | `common.logCount` | one: {count} log / other: {count} logs | {count} 条日志 |
| 63 | `common.noteCount` | one: {count} note / other: {count} notes | {count} 条笔记 |

## statuses, priorities, task types

| # | key | English | 中文 |
|---|-----|---------|------|
| 64 | `status.todo` | To-do | 待办 |
| 65 | `status.notStarted` | Not started | 未开始 |
| 66 | `status.inProgress` | In progress | 进行中 |
| 67 | `status.completed` | Completed | 已完成 |
| 68 | `status.paused` | Paused | 已暂停 |
| 69 | `status.delayed` | Delayed | 已逾期 |
| 70 | `priority.low` | Low | 低 |
| 71 | `priority.medium` | Medium | 中 |
| 72 | `priority.high` | High | 高 |
| 73 | `priority.top` | Top | 最高 |
| 74 | `priority.title` | {level} priority | {level}优先级 |
| 75 | `type.phase` | Phase | 阶段性任务 |
| 76 | `type.longTerm` | Long-Term | 长期任务 |

## dates and periods

| # | key | English | 中文 |
|---|-----|---------|------|
| 77 | `time.today` | Today | 今天 |
| 78 | `time.tomorrow` | Tomorrow | 明天 |
| 79 | `time.yesterday` | Yesterday | 昨天 |
| 80 | `time.inDays` | one: in {count} day / other: in {count} days | {count} 天后 |
| 81 | `time.daysAgo` | one: {count} day ago / other: {count} days ago | {count} 天前 |
| 82 | `time.week` | W{count} | {count}周 |
| 83 | `time.quarter` | Q{count} | {count}季度 |
| 84 | `time.monthYear` | {month} {year} | {year}年{month} |
| 85 | `time.quarterYear` | Q{count} {year} | {year}年第{count}季度 |
| 86 | `time.rangeSeparator` |  –  |  –  |

## gantt

| # | key | English | 中文 |
|---|-----|---------|------|
| 87 | `gantt.view.day` | Day | 日 |
| 88 | `gantt.view.week` | Week | 周 |
| 89 | `gantt.view.month` | Month | 月 |
| 90 | `gantt.view.quarter` | Quarter | 季 |
| 91 | `gantt.view.year` | Year | 年 |
| 92 | `gantt.backToToday` | Back to Today | 回到今天 |
| 93 | `gantt.newTask` | New task | 新建任务 |
| 94 | `gantt.deleteTask` | Delete "{name}"? | 确定删除“{name}”？ |
| 95 | `gantt.deleteTaskWithSubtasks` | Delete "{name}" and all its subtasks? | 确定删除“{name}”及其所有子任务？ |
| 96 | `gantt.deleteTodos` | one: Delete {count} to-do task? / other: Delete {count} to-do tasks? | 确定删除 {count} 项待办任务？ |
| 97 | `gantt.deleteTodosWithSubtasks` | one: Delete {count} to-do task and its subtasks? / other: Delete {count} to-do tasks and their subtasks? | 确定删除 {count} 项待办任务及其子任务？ |
| 98 | `gantt.ongoingTitle` | {wbs} {name} — ongoing | {wbs} {name} —— 长期进行中 |
| 99 | `gantt.pickDate` | Click any date to open its day detail | 点击任意日期查看当天详情 |
| 100 | `gantt.writeLogForDay` | Write a log for this day | 为这一天写日志 |
| 101 | `gantt.moveToTopLevel` | Move to top level | 移到顶层 |
| 102 | `gantt.manageTasks` | Organize | 管理任务 |
| 103 | `gantt.editDone` | Done | 完成 |
| 104 | `gantt.editMode` | Editing | 编辑模式 |
| 105 | `gantt.selected` | {count} selected | 已选 {count} 项 |
| 106 | `gantt.clearSelection` | Clear selection | 取消选择 |
| 107 | `gantt.setTodoMany` | one: Mark {count} task as to-do?\n\nIts dates, priority and progress are cleared. / other: Mark {count} tasks as to-do?\n\nTheir dates, priorities and progress are cleared. | 确定将这 {count} 个任务设为待办？\n\n它们的日期、优先级和进度将被清除。 |
| 108 | `gantt.setTodoManyWithSubtasks` | one: Mark {count} task and its {subs} unfinished subtask as to-do?\n\n / other: Mark {count} tasks and their {subs} unfinished subtasks as to-do?\n\n | 确定将这 {count} 个任务及其 {subs} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 109 | `gantt.deleteSelected` | one: Delete {count} task? / other: Delete {count} tasks? | 确定删除这 {count} 个任务？ |
| 110 | `gantt.deleteSelectedWithSubtasks` | one: Delete {count} task and its subtasks? / other: Delete {count} tasks and their subtasks? | 确定删除这 {count} 个任务及其子任务？ |
| 111 | `gantt.dragMany` | one: {count} task / other: {count} tasks | {count} 个任务 |
| 112 | `gantt.moved` | Moved {what} | 已移动 {what} |
| 113 | `gantt.undoTodo` | Marked {what} as to-do | 已将 {what}设为待办 |
| 114 | `gantt.undoPause` | Paused {what} | 已暂停 {what} |
| 115 | `gantt.undoResume` | Resumed {what} | 已恢复 {what} |
| 116 | `gantt.undoDelete` | Deleted {what} | 已删除 {what} |
| 117 | `gantt.undo` | Undo | 撤销 |

## to-dos

| # | key | English | 中文 |
|---|-----|---------|------|
| 118 | `todo.folderName` | To-dos | 待办 |
| 119 | `todo.folder` | To-dos ({count}) | 待办（{count}） |
| 120 | `todo.startTask` | Start task | 开始任务 |
| 121 | `todo.start` | Start | 开始 |
| 122 | `todo.next` | Next → | 下一个 → |
| 123 | `todo.restoreMany` | one: Restore {count} to-do / other: Restore {count} to-dos | 恢复 {count} 项待办 |
| 124 | `todo.saveAll` | Save all ({count}) | 全部保存（{count}） |
| 125 | `todo.hasSubtasks` | {name} has subtasks, so its dates are decided by them. Restore those first, or set a priority here and let the dates follow. | {name} 有子任务，它的日期由子任务决定。请先恢复那些子任务；也可以只在此设定优先级，让日期随后自动跟进。 |
| 126 | `todo.restoreSelected` | Restore {count} selected | 恢复已选的 {count} 项 |
| 127 | `todo.renameFolder` | Name this folder | 给文件夹起名 |
| 128 | `todo.folderPlaceholder` | Folder name | 文件夹名 |
| 129 | `todo.restoreAll` | Restore all {count} | 恢复全部 {count} 项 |
| 130 | `todo.deleteSelected` | Delete {count} selected | 删除已选的 {count} 项 |
| 131 | `todo.deleteAll` | Delete all {count} | 删除全部 {count} 项 |

## tasks

| # | key | English | 中文 |
|---|-----|---------|------|
| 132 | `task.addSubtask` | Add subtask | 添加子任务 |
| 133 | `task.addSibling` | Add sibling task | 添加同级任务 |
| 134 | `task.new` | New task | 新建任务 |
| 135 | `task.edit` | Edit task | 编辑任务 |
| 136 | `task.namePlaceholder` | Task name | 任务名称 |
| 137 | `task.parent` | Parent | 父任务 |
| 138 | `task.topLevel` | — Top level — | 最顶层任务 |
| 139 | `task.createAsTodo` | Create as to-do | 创建为待办 |
| 140 | `task.todoNote` | This is a to-do: unscheduled work. It sits last among its siblings inside a {toDos} folder until you give it a schedule with {startTask} in the detail panel. | 这是一项待办：尚未排期的工作。它会排在同级任务末尾的 {toDos} 文件夹中，直到你在详情面板里用 {startTask} 为它安排时间。 |
| 141 | `task.endDateLocked` | The end date is decided by the subtask that ends last — change that subtask’s end date instead. | 结束日期由最晚结束的子任务决定，请改为修改那个子任务的结束日期。 |
| 142 | `task.startDateLocked` | The start date is decided by the subtask that starts first — change that subtask’s start date instead. | 开始日期由最早开始的子任务决定，请改为修改那个子任务的开始日期。 |
| 143 | `task.strictProgress` | Turn off daily logs (not recommended) | 取消日志限制（不推荐） |
| 144 | `task.overdueMark` | This task is already overdue — mark as | 该任务已逾期 —— 标记为 |
| 145 | `task.tagsPlaceholder` | study, health | 学习, 健康 |
| 146 | `task.tagsLabel` | Tags (comma separated) | 标签（用逗号分隔） |
| 147 | `task.subtaskCount` | one: {count} subtask / other: {count} subtasks | {count} 项子任务 |
| 148 | `task.hide` | Hide | 收起 |
| 149 | `task.hidden` | Hidden. | 已收起 |
| 150 | `task.tree` | Task tree | 所在任务树 |
| 151 | `task.treeFocus` | Show one branch | 只展示一支 |
| 152 | `task.pendingLogs` | Still to log | 今日待填 |
| 153 | `task.progressMode` | Progress mode | 进度模式 |
| 154 | `task.modeStrict` | Log-based | 严格模式 |
| 155 | `task.modeAuto` | Simplified (ticked per day) | 简化模式 |
| 156 | `task.modeRolledUp` | From subtasks | 由子任务汇总 |
| 157 | `optOut.title` | Go without log supervision? | 确定采取简化模式(脱离日志系统)吗？ |
| 158 | `optOut.p1` | Without the log system this task will *keep no history at all*, and the Logs page will not manage it. | 脱离日志系统则该任务将*不会拥有历史日志*，且不会在 log 页面里被统一管理。 |
| 159 | `optOut.p2` | It will use a *deliberately crude* way of counting progress: each day you only have to *click a button by hand* to confirm you did it, and the system then accumulates progress as elapsed days ÷ total days. No click, no accumulation. If you miss a day, later daily reports will remind you, and you can leave it for now or put the confirmation in — which is one more click. | 本任务将采用一种*极度简化*的进度计算方式，即每日只需要*手动点击按钮*来确认完成，然后系统自动按已过日期 ÷ 总日期进行进度累计，否则不予累计进度。如果你有某日忘了点按钮，则会在以后的日报里对你进行提醒，你可以按实际需求暂时忽略／将确认补上，也就是再点一下按钮的事。 |
| 160 | `optOut.p3` | This also means the task */may not reflect its real progress*/, and the supervision over whether you did a given day’s work is */close to zero*/. **//Please make sure you have enough self-discipline to go without the log system’s supervision**//. | 这也就意味着，本任务可能将*/无法精确反应任务实际进度*/，且确认某日本任务完成的*/监督力度几乎为 0 */。**//请确保你有足够的自律能力脱离日志系统监督**//。 |
| 161 | `optOut.back` | Back | 返回 |
| 162 | `optOut.confirm` | Turn logs off anyway | 仍要取消 |
| 163 | `day.tick` | Mark this day as done | 把这一天标记为完成 |
| 164 | `task.pausedNote` | one: Paused. Started {start} · paused on {paused} · {count} day elapsed. / other: Paused. Started {start} · paused on {paused} · {count} days elapsed. | 已暂停。开始于 {start} · 暂停于 {paused} · 已过去 {count} 天。 |
| 165 | `task.resume` | Resume | 恢复 |
| 166 | `task.endPostponed` | End (postponed) | 结束（已顺延） |
| 167 | `task.setAsTodo` | Set as to-do | 设为待办 |
| 168 | `task.pause` | Pause task | 暂停任务 |
| 169 | `task.pauseHistory` | Pause history ({count}) | 暂停记录（{count}） |
| 170 | `task.pauseEntry` | Paused {from} → resumed {to} | 暂停于 {from} → 恢复于 {to} |
| 171 | `task.heat.title` | Completion | 完成情况 |
| 172 | `task.heat.done` | Done | 已完成 |
| 173 | `task.heat.pending` | Not done | 未完成 |
| 174 | `task.heat.none` | Not scheduled | 无排期 |
| 175 | `task.heat.count` | one: {count} task done / other: {count} tasks done | 完成 {count} 项任务 |
| 176 | `task.heat.less` | Less | 少 |
| 177 | `task.heat.more` | More | 多 |
| 178 | `task.setAsTodoConfirm` | Mark "{name}" as to-do?\n\nIts dates, priority and progress are cleared. | 确定将“{name}”设为待办？\n\n它的日期、优先级和进度将被清除。 |
| 179 | `task.setAsTodoConfirmMany` | one: Mark "{name}" and its {count} unfinished subtask as to-do?\n\n / other: Mark "{name}" and its {count} unfinished subtasks as to-do?\n\n | 确定将“{name}”及其 {count} 项未完成的子任务设为待办？\n\n它们的日期、优先级和进度将被清除；已完成的子任务不受影响。 |
| 180 | `task.markedCompleted` | Marked as completed | 已标记为完成 |

## logs

| # | key | English | 中文 |
|---|-----|---------|------|
| 181 | `log.write` | Write log | 写日志 |
| 182 | `log.edit` | Edit log | 编辑日志 |
| 183 | `log.label` | Log | 日志 |
| 184 | `log.contentPlaceholder` | What did you work on? | 今天做了什么？ |
| 185 | `log.hint` | Each line is an item; Tab indents a sub-item, Shift+Tab outdents. | 每行是一个条目；Tab 键缩进为子条目，Shift+Tab 反向缩进。 |
| 186 | `log.progressAdd` | Progress added (%) | 进度增加（%） |
| 187 | `log.progressAfterDay` | Progress becomes (%) | 进度累积至（%） |
| 188 | `log.currentProgress` | Currently at {percent}% | 目前进度 {percent}% |
| 189 | `log.byDays` | Advance one day | 自动推进一日 |
| 190 | `log.byDaysHint` | Advance one day = add (1 ÷ total days) × 100% of the progress. If less than a fifth of a day’s share is left after that, the task is taken as complete. | 自动推进一日＝增加（1 ÷ 总日数）× 100% 的进度。如果自动推进一日后剩余进度小于一日进度的 1/5，则会默认任务完成。 |
| 191 | `log.progressRequired` | Fill in at least one of the two — put 0 under “{add}” if nothing moved. | 两个格子至少填一个 —— 没进展就在「{add}」里填 0。 |
| 192 | `log.progressBackward` | Progress cannot go backwards — that lands below the figure it started the day at. | 进度不能往回填 |
| 193 | `log.task` | Task | 任务 |
| 194 | `logs.all` | All logs | 全部日志 |
| 195 | `logs.empty` | No logs yet. | 暂无日志。 |
| 196 | `logs.moreTasks` | one: +{count} more task / other: +{count} more tasks | 以及 {count} 项任务 |
| 197 | `logs.tabLogs` | Logs | 日志 |

## notes

| # | key | English | 中文 |
|---|-----|---------|------|
| 198 | `notes.title` | Notes | 记事本 |
| 199 | `notes.empty` | Nothing written yet. | 空空如也 |
| 200 | `notes.add` | Write something | 写点什么 |
| 201 | `notes.placeholder` | Whatever you want to keep. | 写点随想 |
| 202 | `notes.none` | None yet. | 暂无 |

## calendar

| # | key | English | 中文 |
|---|-----|---------|------|
| 203 | `calendar.prevMonth` | Previous month | 上个月 |
| 204 | `calendar.nextMonth` | Next month | 下个月 |
| 205 | `calendar.cellLabel` | {date}: {due}, {starting}; {coverage} | {date}：{due}，{starting}；{coverage} |
| 206 | `calendar.dueCount` | {count} due | {count} 项到期 |
| 207 | `calendar.startingCount` | {count} starting | {count} 项开始 |
| 208 | `calendar.coverage.future` | not yet due | 尚未到期 |
| 209 | `calendar.coverage.clear` | no logs due | 无日志义务 |
| 210 | `calendar.coverage.partial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 211 | `calendar.coverage.full` | all {count} logs written | {count} 项日志已全部记录 |
| 212 | `calendar.more` | +{count} more | 还有 {count} 项 |
| 213 | `calendar.milestoneTitle` | {kind}{strict} — {name}{logged} | {kind}{strict} —— {name}{logged} |
| 214 | `calendar.milestone.due` | Due | 到期 |
| 215 | `calendar.milestone.starts` | Starts | 开始 |
| 216 | `calendar.milestone.strict` |  * |  * |
| 217 | `calendar.milestone.logged` |  · logged this day |  · 当天已记录 |

## day detail

| # | key | English | 中文 |
|---|-----|---------|------|
| 218 | `day.strictLogs` | Logs | 日志 |
| 219 | `day.notYetDue` | Not yet due | 尚未到期 |
| 220 | `day.noStrictScheduled` | No logs due | 当天无日志义务 |
| 221 | `day.allLogged` | Everything logged | 已完成所有日志填写 |
| 222 | `day.nothingLogged` | Nothing logged yet | 尚未记录任何日志 |
| 223 | `day.stillMissing` | {count} still missing | 还差 {count} 项 |
| 224 | `day.noStrictTasksScheduled` | No logs due | 当天没有日志义务 |
| 225 | `day.ringPartial` | {count} of {total} logs written | 已记录 {count}/{total} 项日志 |
| 226 | `day.taskCount` | one: {count} task on this day / other: {count} tasks on this day | 当天有 {count} 项任务 |
| 227 | `day.tasksBreakdown` | {strict} with logs · {other} other | {strict} 有日志 · {other} 其他 |
| 228 | `day.taskList` | Tasks | 任务清单 |
| 229 | `day.nothingScheduled` | Nothing scheduled on this day. | 当天没有排期。 |
| 230 | `day.logMark` | A * marks a task that owes a daily log. | 带 * 的任务有日志义务。 |
| 231 | `day.readLogs` | Read this day’s logs | 查看当天的日志 |
| 232 | `day.readLogsCount` | Read this day’s logs ({count}) | 查看当天的日志（{count}） |
| 233 | `day.noProgress` | No progress | 无进度 |
| 234 | `day.belongsTo` | in | 属于 |
| 235 | `day.parentPath` | Show the whole path | 展开完整路径 |
| 236 | `day.viewTask` | View task → | 查看任务 → |

## chores (the Today page)

| # | key | English | 中文 |
|---|-----|---------|------|
| 237 | `chore.section` | Chores | 临时事务 |
| 238 | `chore.placeholder` | Add a chore… | 添加临时事务… |
| 239 | `chore.emptyToday` | Nothing on hand today. | 今天没有临时事务。 |
| 240 | `chore.emptyTomorrow` | Nothing lined up for tomorrow. | 明天还没有安排。 |
| 241 | `chore.noneOnDay` | No chores on this day. | 当天没有临时事务。 |
| 242 | `chore.stillOpen` | {count} still open | 还有 {count} 项 |
| 243 | `chore.allDone` | All done | 全部完成 |
| 244 | `chore.edit` | Edit chore | 编辑临时事务 |
| 245 | `chore.title` | Chore | 内容 |
| 246 | `chore.note` | Note | 备注 |
| 247 | `chore.notePlaceholder` | Optional | 可不填 |
| 248 | `chore.day` | Day | 日期 |
| 249 | `chore.carriedTitle` | Meant for {date} | 原本定于 {date} |
| 250 | `habit.section` | Routine | 日常安排 |
| 251 | `habit.none` | Nothing daily yet. | 还没有每日项。 |
| 252 | `habit.edit` | Edit daily item | 编辑每日项 |
| 253 | `habit.title` | Item | 内容 |
| 254 | `habit.deleteAsk` | Delete "{name}"? Every day you ticked it goes with it. | 确定删除“{name}”？它的历史完成等记录也会一并删除 |
| 255 | `habit.new` | New routine | 新建日常安排 |
| 256 | `habit.note` | Note | 备注 |
| 257 | `habit.notePlaceholder` | Optional | 可不填 |
| 258 | `habit.weekdays` | Days | 星期几 |
| 259 | `habit.everyDay` | Every day | 每天 |
| 260 | `habit.endDate` | Ends | 结束日期 |
| 261 | `habit.noEndDate` | Leave empty to keep going. | 选填。 |
| 262 | `habit.paused` | Suspended | 停用 |

## manage

| # | key | English | 中文 |
|---|-----|---------|------|
| 263 | `manage.overall` | Overall | 总览 |
| 264 | `manage.heat` | Completion heatmap | 完成热力图 |
| 265 | `manage.subtasks` | Subtasks | 子任务 |
| 266 | `manage.parentTasks` | one: {count} parent task / other: {count} parent tasks | {count} 项父任务 |
| 267 | `manage.upcoming` | Upcoming (7 days) | 未来 7 天 |
| 268 | `manage.overdue` | Overdue | 已逾期 |
| 269 | `manage.newProject` | New project | 新建项目 |
| 270 | `manage.projectNamePrompt` | Project name | 项目名称 |
| 271 | `manage.deleteProject` | Delete project "{name}" and all its tasks? | 确定删除项目“{name}”及其全部任务？ |
| 272 | `manage.openInGantt` | Open in Gantt → | 在甘特图中打开 → |
| 273 | `manage.comingSoon` | Coming soon | 即将开始 |
| 274 | `manage.allStatuses` | All statuses | 全部状态 |
| 275 | `manage.filteredCount` | one: {filtered} of {count} task / other: {filtered} of {count} tasks | 共 {count} 项任务，显示 {filtered} 项 |
| 276 | `manage.empty` | Nothing here. | 暂无内容。 |
| 277 | `manage.sub.active` | active | 进行中 |
| 278 | `manage.sub.tracked` | in total | 全部项目 |
| 279 | `manage.sub.done` | done | 已完成 |
| 280 | `manage.sub.paused` | paused | 已暂停 |
| 281 | `manage.sub.startsIn7` | starts in 7 days | 将在 7 天内开始 |
| 282 | `manage.sub.pastDue` | past due | 已过期 |
| 283 | `manage.sub.pastDueDueSoon` | past due · {count} due soon | 已过期 · {count} 项即将到期 |
| 284 | `manage.sub.unscheduled` | unscheduled | 未排期 |
| 285 | `manage.countCompleted` | {count} completed | {count} 项已完成 |
| 286 | `manage.countOpen` | {count} open | {count} 项未完成 |

## projects

| # | key | English | 中文 |
|---|-----|---------|------|
| 287 | `project.heading` | Project | 项目 |
| 288 | `project.color` | Color | 颜色 |
| 289 | `project.done` | Done | 已完成 |
| 290 | `project.open` | Open | 未完成 |

## settings

| # | key | English | 中文 |
|---|-----|---------|------|
| 291 | `settings.language` | Language | 语言 |
| 292 | `settings.languageHint` | The language of the interface. | 界面显示所用的语言。 |
| 293 | `settings.theme` | Theme | 主题 |
| 294 | `settings.themeHint` | A whole colour scheme — surfaces, text and the colours that carry meaning. | 一整套配色方案 —— 包括底面、文字，以及承载含义的状态色。 |
| 295 | `settings.themeNote` | Green means done and red means late in every theme; the palettes differ in their surfaces and accent, so a status keeps its meaning whichever one you pick. | 在每一套主题里，绿都代表完成、红都代表逾期。各套之间变化的是底面与强调色，所以无论选哪套，状态的含义都不变。 |
| 296 | `settings.active` | Current | 当前 |
| 297 | `settings.version` | Version | 版本 |
| 298 | `settings.versionHint` | The desktop app checks for updates on every launch. | 桌面版每次启动会自动检查更新。 |

## reminders

| # | key | English | 中文 |
|---|-----|---------|------|
| 299 | `settings.reminder` | Reminders | 提醒 |
| 300 | `settings.reminderWebNote` | Reminders are sent by the desktop app — it is the only build that can post to PushPlus. In a browser there is nothing here to set up. | 提醒由桌面版发出 —— 只有桌面版能把消息送到 PushPlus。浏览器版这里没有可设置的东西。 |
| 301 | `settings.reminderOn` | Desktop notifications are on by default. Keep WBS Gantt running in the background. | 桌面弹窗通知默认开启，请保持 WBS-gantt 在电脑后台运行。 |
| 302 | `settings.reminderWechat` | Sync notifications to personal WeChat | 将通知/提醒同步到个人微信 |
| 303 | `settings.reminderTime` | Send at | 发送时间 |
| 304 | `settings.reminderToken` | PushPlus token | PushPlus 令牌 |
| 305 | `settings.reminderPushplusNote` | WBS Gantt relies on PushPlus to sync notifications to WeChat.\nActivating that route means paying PushPlus ¥3.50 for real-name verification, so skipping it is entirely reasonable. | WBS-gantt 依赖 pushplus 在微信同步通知。\n不过，激活该途径需要向 pushplus 支付 3.5 元以完成实名认证。因而放弃配置该途径也是完全可行的。 |
| 306 | `settings.reminderTokenHint` | Sign in at pushplus.plus and paste the token from the top of the page here. | 在 pushplus.plus 扫码登录，并把页面顶部的令牌(token)复制在这里 |
| 307 | `settings.reminderOpen` | Open pushplus.plus | 打开 pushplus.plus |
| 308 | `settings.reminderTest` | Send a test | 发一条试试 |
| 309 | `settings.reminderPreview` | Preview noon’s | 预览中午的 |
| 310 | `settings.reminderSending` | Sending… | 发送中… |
| 311 | `settings.reminderSent` | Sent. | 已发出。 |
| 312 | `settings.backgroundAppOnly` | Without it, reminders only go out while this window happens to be open. | 不装的话，只有这个窗口开着的时候才会发。 |
| 313 | `settings.autostart` | Start with Windows | 开机自启动 |
| 314 | `tray.open` | Open WBS Gantt | 打开看板 |
| 315 | `tray.quit` | Quit | 退出 |
| 316 | `reminder.greeting.dawn` | Still up | 强啊传奇耐熬王 |
| 317 | `reminder.greeting.early` | Good morning | 早上好 |
| 318 | `reminder.greeting.morning` | Good morning | 上午好 |
| 319 | `reminder.greeting.noon` | Midday | 中午好 |
| 320 | `reminder.greeting.afternoon` | Good afternoon | 下午好 |
| 321 | `reminder.greeting.dusk` | End of the day | 傍晚了 |
| 322 | `reminder.greeting.evening` | Good evening | 晚上好 |
| 323 | `reminder.greeting.night` | Late night | 夜深了 |
| 324 | `reminder.closing.dawn` |  | ⟨空⟩ |
| 325 | `reminder.closing.early` |  | ⟨空⟩ |
| 326 | `reminder.closing.morning` |  | ⟨空⟩ |
| 327 | `reminder.closing.noon` |  | ⟨空⟩ |
| 328 | `reminder.closing.afternoon` |  | ⟨空⟩ |
| 329 | `reminder.closing.dusk` |  | ⟨空⟩ |
| 330 | `reminder.closing.evening` |  | ⟨空⟩ |
| 331 | `reminder.closing.night` |  | ⟨空⟩ |
| 332 | `reminder.starting` | Starting today | 今天该开始 |
| 333 | `reminder.dueSoon` | Coming up | 即将到期 |
| 334 | `reminder.reportTitle` | Daily report | 日报 |
| 335 | `reminder.reportEmpty` | Nothing outstanding today. | 今日无事 |
| 336 | `reminder.reportYesterday` | Yesterday | 昨日 |
| 337 | `reminder.reportToday` | Today | 今天 |
| 338 | `reminder.reportRate` | Completion | 完成率 |
| 339 | `reminder.groupTasks` | Tasks | 任务清单 |
| 340 | `reminder.groupDeadlines` | Due & overdue | 到期与逾期 |
| 341 | `reminder.testTitle` | WBS Gantt — test message | 看板 —— 测试消息 |
| 342 | `reminder.testBody` | If you are reading this in WeChat, reminders are working. | 你能在微信里看到这条，就说明提醒已经配好了。 |
| 343 | `reminder.nudgeLogs` | Remember to write logs for the tasks you have finished. | 记得为已经完成的任务填写日志。 |
| 344 | `reminder.nudgeDebt` | {count} waiting on you — | 还有 {count} 项事项待处理，其中： |
| 345 | `reminder.nudgeDebtLine` | - {count} {label} | - {count} 项{label} |
| 346 | `reminder.nudgeTasks` | tasks | 任务 |
| 347 | `reminder.ack` | Got it | 我知道了 |
| 348 | `slot.early` | Morning | 早上 |
| 349 | `slot.noon` | Noon | 中午 |
| 350 | `slot.dusk` | Evening | 傍晚 |
| 351 | `reminder.overdue` | Overdue | 已逾期 |
| 352 | `reminder.dueToday` | Due today | 今天到期 |
| 353 | `reminder.logsOwed` | Logs owed | 日志缺少 |
| 354 | `reminder.chores` | Chores | 临时事务 |
| 355 | `reminder.habits` | Routine | 日常安排 |
| 356 | `update.check` | Check for updates | 检查更新 |
| 357 | `update.checking` | Checking… | 检查中… |
| 358 | `update.upToDate` | You are on the latest version. | 已是最新版本。 |
| 359 | `update.availableShort` | An update is available. | 有可用更新。 |
| 360 | `update.unreachable` | Automatic updates are unavailable because GitHub cannot be reached. | 由于无法连接到 GitHub，自动更新不可用。 |
| 361 | `update.webNote` | Automatic updates apply to the desktop app. In a browser you always load the latest build. | 自动更新只适用于桌面版；在浏览器里打开的始终是最新版本。 |
| 362 | `update.availableTitle` | Update available | 发现新版本 |
| 363 | `update.availableBody` | Version {version} has been released. You are on {current}. | 新版本 {version} 已发布，当前版本为 {current}。 |
| 364 | `update.notes` | Release notes | 更新说明 |
| 365 | `update.noNotes` | This release came with no release notes. | 本次发布未填写更新说明。 |
| 366 | `update.downloadAndInstall` | Download and install | 下载并安装 |
| 367 | `update.installing` | Downloading… | 正在下载… |
| 368 | `update.installFailed` | The update could not be installed: {message} | 更新安装失败：{message} |
| 369 | `update.later` | Later | 以后再说 |
| 370 | `update.snooze` | Ignore for {days} days | {days} 天内不再提醒 |
| 371 | `update.nagTitle` | It has been a while | 已经很久没有更新了 |
| 372 | `update.nagBody` | It has been over a month since this app last reached GitHub. Take a look for bug fixes and new features? | 要不要连上 GitHub 看一眼有没有 bug 修复和新功能呢？ |
| 373 | `update.nagGo` | Go to Settings | 去设置看看 |
| 374 | `update.connectTitle` | Want a stable GitHub connection? | 想稳定连接 GitHub？ |
| 375 | `update.connectBody` | Watt Toolkit (formerly Steam++) is a free, open-source network accelerator. It speeds up both the GitHub website and Release downloads. | Watt Toolkit（原 Steam++）是免费开源的多平台网络加速工具，可以加速 GitHub 网页和 Release 下载。 |
| 376 | `update.connectLink` | Download from steampp.net | 前往官网下载（steampp.net） |
| 377 | `update.opensource` | GitHub is the largest home of open-source software — operating systems, frameworks, ready-made tools, most of it free to use, study and build on. This project’s source and releases live there too. | GitHub 是全球最大的开源社区，托管着数以亿计的开源项目 —— 从操作系统、开发框架到各类现成工具，绝大多数都可以免费使用、学习和二次开发。本项目的源码和版本更新也发布在这里。 |
| 378 | `update.openRepo` | View on GitHub | 在 GitHub 上查看 |
| 379 | `theme.graphite.name` | Graphite | 石墨 |
| 380 | `theme.graphite.hint` | Near-black, neutral | 近黑 · 中性 |
| 381 | `theme.slate.name` | Slate | 板岩 |
| 382 | `theme.slate.hint` | Mid grey-blue, cool | 中灰蓝 · 偏冷 |
| 383 | `theme.ember.name` | Ember | 余烬 |
| 384 | `theme.ember.hint` | Hazel-black, warm | 榛黑 · 偏暖 |
| 385 | `theme.paper.name` | Paper | 纸张 |
| 386 | `theme.paper.hint` | Light, crisp | 浅色 · 清爽 |
| 387 | `swatch.groupChrome` | Interface | 界面 |
| 388 | `swatch.groupSignals` | Meaning | 语义 |
| 389 | `swatch.bg` | Background | 底色 |
| 390 | `swatch.panel` | Panel | 面板 |
| 391 | `swatch.panel2` | Field | 输入框 |
| 392 | `swatch.stripe` | Alt. row | 斑马行 |
| 393 | `swatch.border` | Border | 边框 |
| 394 | `swatch.line` | Divider | 分隔线 |
| 395 | `swatch.fg` | Text | 正文 |
| 396 | `swatch.muted` | Secondary text | 次要文字 |
| 397 | `swatch.dim` | Faint text | 弱化文字 |
| 398 | `swatch.accent` | Accent | 强调色 |

## getting started

| # | key | English | 中文 |
|---|-----|---------|------|
| 399 | `guide.title` | Getting started | 开始使用 |
| 400 | `guide.dismiss` | Hide this | 收起 |
| 401 | `guide.done` | You are set up. | 已经上手了。 |
| 402 | `guide.read` | Read this | 看说明 |
| 403 | `guide.close` | Got it | 知道了 |
| 404 | `guide.goThere` | Take me there | 带我去 |
| 405 | `guide.step.language` | Pick your language in {settings} | 在{settings}里选界面语言 |
| 406 | `guide.step.project` | Create a project in {manage} | 在{manage}里新建一个项目 |
| 407 | `guide.step.parentTask` | Add a parent task inside it | 在这个项目下新建一个父任务 |
| 408 | `guide.step.strictChild` | Nest a strict subtask under that task | 在父任务下挂一个严格子任务 |
| 409 | `guide.step.endDate` | How a parent’s dates are worked out | 父任务的日期是怎么来的 |
| 410 | `guide.step.log` | Write a log on the strict subtask | 给严格子任务写一条任务日志 |
| 411 | `guide.step.tour` | Look around: Logs, Manage, Calendar, Settings | 逛一圈：日志 · 管理 · 日历 · 设置 |
| 412 | `guide.explain.language.title` | Interface language | 界面语言 |
| 413 | `guide.explain.language.p1` | The interface comes in {langs}. It opens in English — if that is not your language, switch it in Settings, under Language. Everything follows at once, this card included. | 界面有 {langs} 三种。默认打开是 English —— 如果你不读英文，到设置里的「语言」换一下。换完立刻生效，这张卡片也会跟着变。 |
| 414 | `guide.explain.language.skip` | Not now | 先不用 |
| 415 | `guide.explain.endDate.title` | How a parent’s dates are worked out | 父任务的日期是怎么来的 |
| 416 | `guide.explain.endDate.p1` | A phase parent keeps no schedule of its own — it starts when its earliest subtask starts and ends when its latest one ends. Give a subtask dates outside the parent’s and the parent stretches out to meet them. | 阶段任务的父任务自己不排期 —— 它从最早开始的子任务开始、到最晚结束的子任务结束。给某个子任务的日期超出父任务的范围，父任务就会撑出去跟上它。 |
| 417 | `guide.explain.endDate.p2` | The interface says as much: open a phase parent for editing and both date fields are greyed out. Drag any subtask and the parent follows, at both ends. Its progress works the same way — the average of its subtasks’ — which is why it will not let you type one in either. | 这一点界面上就写着：打开一个阶段父任务的编辑框，开始日期和结束日期两栏都是灰的。你拖动任何一个子任务，父任务两头都会跟着走。进度同理 —— 父任务的进度是子任务进度的平均，所以它也不让你手填。 |
| 418 | `guide.explain.endDate.p3` | Long-term goals are the exception. They have a start and no end, so a parent of that kind has nothing to stretch — which is why it shows a start date and nothing else. | 长期目标是例外。它只有开始、没有结束，所以这种父任务没有东西可撑 —— 这就是它只显示一个开始日期的原因。 |
| 419 | `guide.explain.strict.title` | Strict and non-strict: where progress comes from | 严格与非严格：进度从哪来 |
| 420 | `guide.explain.strict.p1` | The difference is where the number comes from, not how it is drawn. | 差别在于这个数字从哪来，而不在于它怎么画。 |
| 421 | `guide.explain.strict.p2` | A simplified task counts the days you tick off. On a day you did the work you click its box once, and a day you did not tick counts for nothing, however long ago its window closed. A window that closes without every day ticked reads late, not done. | 简化任务数的是你点过的天。哪一天做了，就在那天点一次框；没点的日子一分不算，窗口过去多久都一样。窗口走完还没点满，它读作逾期，而不是完成。 |
| 422 | `guide.explain.strict.p3` | A strict task counts only logs. With no log at all it stays at 0%, long after its window has closed. Once there are logs, one of two things decides the number: the latest log that carries a target progress is taken at its word; if none carries one, progress accrues as logged days ÷ the window’s days — so a day you skip is a day genuinely lost. | 严格任务只认日志。一条日志都没有，它就一直是 0%，哪怕窗口早就过去了。有了日志之后，两种情况决定这个数字：最新一条日志填了目标进度，就以它为准；一条都没填，就按「写过日志的天数 ÷ 窗口总天数」累积 —— 所以漏掉一天，就是实打实地少一格。 |
| 423 | `guide.explain.strict.p4` | That is what a strict task is for: a progress figure that carries a reason beside it, rather than a bare number. | 这就是严格任务的意义：进度旁边带着一句「为什么」，而不只是一个数字。 |
| 424 | `guide.explain.tour.title` | A look around | 逛一圈 |
| 425 | `guide.explain.tour.intro` | These four pages all read the board you have just built, so there is something to see on each of them even while it is still small. One line on each: | 这四个页面读的都是你刚建起来的看板 —— 就算它还很小，每个页面上也有东西可看。各一句： |
| 426 | `guide.explain.tour.logs` | Logs — everything written, collected by day; a strict task’s entries carry their target progress too. The switcher in the corner shows just the notes instead — what you write for its own sake, and which never becomes a task. | 日志 —— 所有写过的内容按天汇总；严格任务的条目还带着目标进度。右上角可以切到记事本 —— 那是你为自己写的东西，永远不会变成任务。 |
| 427 | `guide.explain.tour.manage` | Manage — the overview: what is on today, what is coming, what has slipped, then a year of completion shading, and projects and tasks broken out below. | Manage —— 整体概览：今天该做什么、接下来是什么、哪些逾期了，往下是一年的完成热力图，再往下按项目和任务分列。 |
| 428 | `guide.explain.tour.calendar` | Calendar — the month at a glance. A cell’s shade is how much of that day’s strict work was logged, and days carrying milestones or overdue work are marked. | 日历 —— 整月一屏。每格的深浅是当天严格任务的日志覆盖率，有里程碑或逾期任务的日子会标出来。 |
| 429 | `guide.explain.tour.settings` | Settings — three languages and four colour schemes, switchable whenever you like. | 设置 —— 三种语言、四套配色，随时可切。 |

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

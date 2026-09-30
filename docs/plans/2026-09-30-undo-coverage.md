# 撤销：补齐编辑模式以外的缺口 + 删掉任务条拖动

> **这一份与最终实现一致**：正文说的是做成了什么。实现过程中没有被推翻的判断 —— 获批时写下的「从待办恢复不加第二道确认」原样落地。

## 背景

撤销此前只覆盖编辑模式里那一套（拖拽重排、选择栏五个按钮）加上行上垃圾桶和抽屉的取消归档。用户定了三条：**范围**只限「编辑模式里的操作」（已有）+「编辑模式以外的 删除 / 归档 / 暂停 / 恢复 / 设为待办 / 从待办恢复」；**暂停 / 恢复 / 设为待办 / 从待办恢复**各加确认；**任务条拖动删掉**，日期只能在编辑对话框里改。一步、十秒、不做历史栈。

## 一、把缺的接进撤销

六类里大部分早就有了，真正接上的是四处：右键菜单的**删除**（`GanttPage.handleDelete`）、待办文件夹的**删除全部**（`todo.remove`，与它同形的那条「文件夹的恢复」走的是对话框）、详情面板的**暂停 / 恢复 / 设为待办 / 取消归档**、以及 `StartTodoDialog` 的 submit（**从待办恢复**，文件夹的「恢复」与面板的「开始任务」两条入口都汇到这里）。

**账本身没动**：这些全是 tasks 上的字段改动，删除那条早就有 `removedTasks` / `removedLogs`，现成的 `patches` 够用。

**视图闸门**加在 `withUndo` 开头：当前视图不是 `gantt` 就照做但不记账。必须加 —— 详情面板在每个页面都开（`App.tsx` 只把日期面板限在甘特和日历），不挡的话在今天页点一下暂停，会留下一条到了甘特才冒出来的报价。`activeView` 初值是 `gantt`，所以两个 check 脚本里直接调 `withUndo` 仍然记账。

**面板那条老规矩就此推翻**：它之前不记，理由正是「面板在别的页面也开」。现在判定改成「你当时在不在甘特」—— 今天页、日历、日志页里点它们照旧不记。

## 二、四个动作加确认

右键菜单与详情面板的**暂停 / 恢复**、选择栏的**批量暂停 / 恢复**各加一句确认（设为待办与删除本来就有）。四个新文案键：`task.pauseConfirm`、`task.resumeConfirm`、`gantt.pauseMany`、`gantt.resumeMany`。

**「从待办恢复」没有加第二道确认**：它两条入口都是先开「开始待办」那个要填起止日期、类型、优先级、严格开关的表单，填完点保存才生效 —— 那本身就是一次确认，前面再加一层是同一件事问两遍。

## 三、删掉任务条拖动

`TaskBar.tsx` 里的整套拖拽机制（`begin` / `onMove` / `onUp`、`dragRef` / `barRef` / `suppressClickRef`、`DragMode` / `DragState`、四处 `onPointerDown`、拖动中的 DOM 写、`cursor-grab` / `cursor-ew-resize`、`onClickBar` 里消费 `suppressClickRef` 的一段）全部删掉；空出来的符号（`useRef`、`PointerEvent`、`addUnit`、`toISO`、`finished`、`barLeft`/`barRight`）手工扫掉 —— `tsconfig` 的 `noUnusedLocals` 是 `false`，编译器不报。store 里的 `moveTask` / `resizeTask`（全仓库只有它调用）与 `lib/dates.ts` 的 `addUnitISO`（只服务于那两个）一并删掉；`Unit` 与 `addUnit` 留着，`lib/timeline.ts` 在用。TaskBar 从 278 行降到 162 行。

## 四、这次没做

日志的写改删、记事本、新建与编辑任务、日期面板的勾选、待办文件夹改名、临时事务、日常安排、侧栏的项目对话框与导入 —— 都不在用户圈定的六类里。视图状态、偏好、派生值照旧不碰。

## 五、验证

- `scripts/check-task-tree.mjs` 的撤销段加了两条：**从待办恢复**的往返（撤销把行重新变回待办、并把给它的日程一起摘掉）；**闸门**（`activeView` 设成 `today` 时 `withUndo` 照做但 `lastUndo` 仍是 `null`，设回 `gantt` 又能记）。闸门那条实测过：把闸门去掉，它就会红。
- `scripts/check-archive.mjs` 里对 `patches` 形状的断言原样通过（记录结构没动）。
- 页面上的实际点击没有验 —— 仓库里没有浏览器自动化。条子不再可拖、光标不变手、每处改完底部出现报价、别的页面不出现，这些要手工看一眼。

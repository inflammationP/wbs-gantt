# 待办（To-do）任务状态

## 背景

现在这个应用里，每个任务的状态都是从「起止日期 + 暂停状态 + 进度」推导出来的
（`src/lib/tree.ts` 的 `deriveTaskStatus`）。所以一件「还没想好什么时候做」的事情没地方放——
你必须先编一个起止日期、一个优先级和一个进度模式才能建它。

要加一个 **待办 / To-do** 状态，含义是「还没排期」：没有起止日期、没有优先级、没有严格模式、
没有进度、不能写日志，与未开始 / 进行中等状态同级。

把一个**父任务**设为待办时必须级联：它下面所有**未完成**的后代任务也一起变成待办，而**已完成**
的后代保持不动。因为变成待办的那批子任务变成了一堆无序的东西，所以要把它们收进一个**类似文件夹
的分组行**里，这个分组行可以折叠，并且可以单独/全选地对里面的任务做**删除**和**恢复**。

项目用 `npm run build`（= `tsc --noEmit && vite build`）构建，所以下面每个类型改动都会被编译器检查到。

## 核心模型

**待办任务的形态**：`isTodo: true`、`type === 'phase'`、`startDate === null`、`endDate === null`、
`strictProgress === false`、`priority === null`。

**`isTodo` 是最高优先级**：只要一个任务被标了待办，在所有推导里它就赢了——它永远不会拿到日期、
进度，也不会从子任务汇总出状态；而且没有任何代码能把日期写回到它身上。

**文件夹不是真实任务**，而是 `buildRows` 为「有至少一个待办子任务的任务」合成出来的一个行。
这样做的好处：WBS 编号、统计页、项目计数、任务页、日志页、导入导出全都不受影响——否则一个
合成节点会出现在十几个地方需要额外过滤，还可能变成孤儿或被拖到别的父任务下。

所有新增的界面文案用英文，与现有 UI 保持一致。

## 1. 类型 — `src/types.ts`

- `TaskStatus` 增加 `'todo'`
- `Task` 增加 `isTodo: boolean`
- `Task.priority` 类型改为 `TaskPriority | null`（只有待办会是 null）

## 2. 状态元数据 — `src/lib/ui.ts`

- 新增 `TODO_COLOR = '#a371f7'`，并在 `STATUS_META` 里加 `todo` 条目（`label: 'To-do'` 及
  `color` / `dim` / `text` 四个字段必须齐全）。
- `'todo'` 放在 `STATUS_ORDER` 最前面（它是最早的状态）。
- 新增 `priorityMeta(p: TaskPriority | null)`：返回 `PRIORITY_META[p]`，p 为 null 时返回中性的
  `{ label: '—', color: '#6e7681' }`。在四处索引点改用它，这样 `PRIORITY_META[null].color`
  这种崩溃从根上不可能发生。

> `STATUS_META` 是 `Record<TaskStatus, StatusMeta>`（穷举类型），所以第 1 步和第 2 步必须同时改完，
> 否则 `tsc` 会报错。

## 3. 进度 — `src/lib/progress.ts`

`taskProgress()` 在 `task.isTodo` 时直接返回 `null`。这就是「抹去进度信息」的实现方式，同时该任务
的历史日志**不会被删除**。所有调用方（`averageProgress`，以及经由它的侧边栏 / 仪表盘 / 统计页 /
项目详情面板）本身已经对 null 安全。

## 4. 树与推导 — `src/lib/tree.ts`（本次改动的核心）

- **排序键**：在 `buildChildrenMap` 的 `cmp` 里把 `(a.isTodo ? 1 : 0) - (b.isTodo ? 1 : 0)`
  作为**第一个**排序键，让待办沉到同级任务的最下方——这一条同时满足了「新建待办放最后」（需求 3）
  和「转为待办后换位置」（需求 4），也顺带让 `computeWbs` 自动给出最后的 WBS 编号。
  必须写成 `? 1 : 0` 而**不能**写 `Number(...)`：旧数据在 `normalize` 补上 `isTodo` 之前是
  `undefined`，比较器返回 `NaN` 会让 `Array.sort` 的排序结果变成实现相关的乱序。
  `collectDescendants` 只用集合成员判断，顺序对它无影响。

- **`buildRows` 的根排序**：把同一个键插到 `roots.sort` 里 `pa - pb` **之后**、日期键**之前**。
  放到最前面会把所有非待办任务按项目挤到一起、排在所有待办之前，破坏多项目分组。

- **`effectiveStates`**：把 `if (t.isTodo) return { start: null, end: null, progress: null, status: 'todo' }`
  提到 `kids.length === 0` 分支**之前**，这样「有子任务的待办」依然是待办。于是 `deriveTaskStatus`
  完全不需要待办分支——只有这一个地方说了算。

- **父任务汇总时排除待办子任务**：在非叶分支里取 `timed = es.filter(e => e.status !== 'todo')`，
  用 `timed` 去算 `ps` / `starts` / `active` / `source` / `deriveStatus`。
  不这么做的话，只要有一个待办子任务（它的 `end` 是 null），`source.some(e => e.end == null)`
  就为真，于是**父任务的结束日被抹成 null，并会被 `syncParentEnds` 写回存储**，父任务的甘特条
  就会一直拉到时间轴尽头。`timed` 为空时，原有的 `: t.startDate` / `: t.endDate` 兜底逻辑正好生效。

- **`deriveStatus`**：加一行 `if (statuses.length === 0) return 'not-started'`。
  `[].every(...)` 返回 `true`，不加上这行的话，「子任务全是待办」会显示成**已完成**。

- **`syncParentEnds`**：跳过 `t.isTodo`（与上面的汇总修复形成双保险）。

- **`deriveTaskStatus`**：加 `if (task.startDate == null && task.endDate == null) return 'not-started'`，
  这样恢复后但排期还没填的任务不会显示成「进行中」。

- **新增 `todoCascadeIds(tasks, logs, id): string[]`**：返回该任务本身 + 所有有效状态不是
  `'completed'` 的后代任务 id。store 的级联动作和确认弹窗里的数量都用它。

- **`Row` 改成可辨识联合（discriminated union）**，替换现在的单一接口：

  ```ts
  interface RowTask      { kind: 'task';      id; task; depth; wbs; eff; hasKids; isLeaf }
  interface RowTodoGroup { kind: 'todoGroup'; id: `todogroup:${string}`; parentId: string | null; depth: number; todoIds: string[] }
  ```

  在 `visit` 里把某个任务的子任务分成「非待办」（照常访问）和「待办」两拨。只要有待办子任务，
  就在**与这些子任务相同的 `depth`** 上先发一行 `todoGroup`——它读起来像一个分组标题而不是多一层
  嵌套，所以子任务的 WBS 编号保持诚实——再按展开状态访问那些待办子任务。
  分组行的展开键就用它的合成 `id`，复用现有的 `expanded` map，因此 `toggleExpanded` /
  `expandAll` / `collapseAll` 不用改。
  改成联合类型后，`tsc` 会把 `GanttChart` / `RowLeft` / `TaskBar` / `ContextMenu` / `GanttPage`
  里所有需要收窄类型的调用点全部标出来。

## 5. 持久化 — `src/store/storage.ts`

在 `normalize` 里，对每个任务：`isTodo: t.isTodo === true`；
`priority: t.priority ?? (isTodo ? null : 'medium')`；并把 normalize 作为不变量的修复点，让任何错误
写入路径在重新加载时自愈：`startDate: isTodo ? null : (t.startDate ?? null)`、
`endDate: isTodo ? null : …`、`strictProgress: isTodo ? false : (t.strictProgress ?? false)`。

**不要改 `KEY`**（`wbs-gantt.v2`）——normalize 会补齐新字段，改 key 等于把用户现有数据静默丢弃。
`parseImport` 已经走 `normalize`，导入同样被覆盖。

## 6. Store — `src/store/useStore.ts`

- `NewTaskInput` 增加 `isTodo?: boolean`；`addTask` 的待办分支强制 `type: 'phase'`，并把
  `startDate` / `endDate` / `strictProgress` / `priority` 全部置空。
- **`setTaskTodo(id)`**：任务已是待办则空操作。用**一次原子的 `set()`** 把
  `{ isTodo: true, startDate: null, endDate: null, strictProgress: false, priority: null, paused: false, pauseDate: null }`
  写到该任务及 `todoCascadeIds` 返回的所有 id 上，`pauses` 和全部日志保持不动。
  必须写成单次原子更新，因为 `App.tsx` 会在每次 `tasks` 引用变化后跑 `syncParentEnds`。
- **`startTodoTasks(entries)`**：批量/单个恢复。每个 entry 是
  `{ id, startDate, endDate, strictProgress, priority }`，清掉 `isTodo` 并写入排期——单个任务和
  整个多选走同一个动作（第 8 节的标签页弹窗）。
- 给 `resizeTask` 加 `if (task.isTodo) return {}` 守卫（`moveTask` 因为对 null 日期空操作，本来就安全）。

## 7. 新建/编辑弹窗 — `src/components/TaskDialog.tsx`

- 增加 `isTodo` 表单状态，初值取 `existing?.isTodo ?? false`。
- **只在新建时**（`existing` 为 undefined）渲染 **"Create as to-do"** 勾选框，位置在 Parent 字段之后、
  **起止日期之前**（需求 2）。
- 勾选后：隐藏起止日期、严格模式勾选框和优先级下拉；Type 下拉强制并禁用为 `phase`。
  同时把 `isTodo` 并进 `isOverdueStrict` 判断（`&& !isTodo`）和提交逻辑，避免待办走到
  `addLog(..., targetProgress: 100)` 那条路径上。
- **编辑一个已有待办时不能把它的排期复活**。现在 `submit` 总是拼装完整 payload，而 `updateTask` 是浅合并，
  所以对 `existing.isTodo` 的情况要**完全省略** `startDate` / `endDate` / `strictProgress` / `priority`，
  只发 name / description / project / parent / tags。待办标记只能通过「Start task」流程解除，不能在这里解除。
- 把 `isTodo` 的任务从 `parentOptions` 里过滤掉——待办是收纳区，不是容器。

## 8. 待办详情面板 — `src/components/TaskDetailPanel.tsx` + 新增 `StartTodoDialog.tsx`

**`StartTodoDialog`** 接收要排期的任务 id 列表，内部为每个任务保存一份表单。顶部是一条标签栏，
每个任务一个小标签（「像打开多个网页一样，页面上方有个小标签告诉你现在正在编辑的是哪个任务」），
用来切换下面的起止日期 / 严格模式 / 优先级字段正在编辑哪个任务；每个任务保留自己的值，填过的标签上
显示一个小圆点。点 Restore 时通过 `startTodoTasks` 一次性提交全部。只有一个任务时是单标签的同一个弹窗。
UI 复用 `src/components/ui.tsx` 的 `Modal` / `Field` / `inputCls`，校验复用 `TaskDialog.submit` 里
起止日期颠倒就交换的逻辑；只对**没有子任务**的任务显示日期和严格模式（父任务的日期是从子任务推导的）。

对 `isTodo` 任务，详情面板**只展示它真正拥有的信息**——Status（To-do）、Type、标签、依赖、子任务、
描述和 History——隐藏优先级、进度模式、起止日期、进度条、暂停历史区块和 **Write log** 按钮。
History 保持可编辑/可删除（你已确认）。暂停/恢复控件替换为 **Start task** 按钮，打开
`StartTodoDialog`，**故意不复用暂停/恢复的逻辑**；再加一行提示，避免这个稀疏的面板看起来像坏了。

对**非待办**且有效状态为 `'not-started'` 的任务，**Pause task** 按钮变为 **Set as to-do**（需求 4）。
点击后通过 `setTaskTodo` 抹去日期/严格模式/优先级/进度；当该任务有子任务时，先用 `todoCascadeIds`
算出的数量弹出 `confirm()` 确认，因为级联会抹掉整个未完成分支的排期。

## 9. 甘特图行

- **`RowLeft.tsx`**：`isTodo` 任务的优先级圆点位置改画一个 `CircleDashed` 图标（它们的优先级是 null），
  任务名加上虚线边框的胶囊样式——这就是「特殊 UI 标注」。`todoGroup` 行渲染 `FolderOpen` 图标、
  **To-dos (n)** 文字，并在操作列放常驻的**全选 / Restore / Delete** 按钮；点击该行切换折叠而不再
  是选中。待办子任务在常规悬浮操作之外，多一个常驻的勾选框（单独选择）。
- **`TaskBar.tsx`**：`todoGroup` 行不渲染任何东西；`isTodo` 任务本来也渲染不出东西（分段为空）。
  补上显式的提前返回，确保两者都不会挂载一个退化的条。时间轴区域对待办保持留空（按你的选择），
  因为一个没有日期的任务没有位置可言。
- **`GanttChart.tsx` / `GanttPage.tsx`**：把 `selectedTodoIds` 和 `onToggleTodo` 从 `GanttPage`
  透传到 `RowLeft`，并加上删除/恢复的处理函数。选择状态、删除确认和批量恢复用的 `StartTodoDialog`
  都由 `GanttPage` 持有。
- **`ContextMenu.tsx`**：`todoGroup` 行不弹菜单；现有的 "Write log" 项已经由状态门控，对待办会自动消失。
- **`TasksPage.tsx`**：排序加上待办键，让顺序与甘特图一致；优先级单元格改用 `priorityMeta`。

## 验证方式

1. **`npm run build`**——`tsc --noEmit` 必须通过。穷举的 `STATUS_META` 和 `Row` 联合类型这两处改动，
   会把所有还需要改的地方全部暴露出来。
2. **`npm run dev`**，然后依次验证：
   - 新建任务 → 勾选 **Create as to-do**（确认勾选框在起止日期上方）→ 保存 → 该行排在同级最后，
     显示紫色 **To-do**、没有甘特条，详情面板有 Start task、没有 Write log。
   - 编辑这个待办 → 保存 → 它**仍然**是没有日期的待办（防止浅合并 bug 的回归验证）。
   - Start task → 填写排期 → 变成正常任务并出现甘特条；设为 `strict` 后确认能写日志了。
   - 找一个**未开始**、子任务里既有已完成又有未完成的阶段 → **Set as to-do** → 确认弹窗 →
     父任务变 To-do 且无条，已完成的子任务保留自己的甘特条，未完成的收进 **To-dos (n)** 文件夹里
     且 WBS 编号不变，**并且父任务的结束日没有被抹掉**（把时间轴拉宽，确认已完成子任务的条结束
     位置和原来一样，而不是拉到尽头）。
   - 文件夹：折叠/展开；单选、全选；Delete（有确认）；选中 3 个点 Restore → 每个任务一个标签，
     逐个填好 → 恢复后全部变成正常的已排期任务。
   - 刷新应用：待办和文件夹能经过 localStorage 往返存活（验证 `normalize`）。
   - 统计 / 任务 / 仪表盘 / 日历 / 日志页都能正常渲染，待办被算作「未完成」而不是「已完成」。
3. 手工确认本次顺带修掉的 bug：一个任务有某个待办子任务时，它自己的 `endDate` 不会被null 掉。

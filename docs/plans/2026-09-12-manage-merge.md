# Manage：Dashboard / Tasks / Projects / Statistics 四页合一

## Context

导航里现在有 Dashboard、Tasks、Projects、Statistics 四个页面，它们大量重复展示同一批派生数据：项目进度条出现 5 处（侧边栏、Dashboard 项目段、Statistics 项目图、ProjectsPage 卡片、ProjectDetailPanel），状态计数出现 4 处，逾期任务清单出现 2 处（Dashboard 的 Overdue 列 与 Tasks 筛 `delayed`）。同一份聚合逻辑也被复制了 5 遍。

目标是合并成**一个** `Manage` 页面，让每一类信息只出现一次。Calendar 本轮不动。

约束：指标卡、进度条、状态枚举必须保留（这是本页主体）；不引入甘特式的任务条/时间轴。

## 页面结构

以 Dashboard 为基准，自上而下三段：

```
Manage
├─ 总览
│   ├─ [Projects] [Total tasks]            两卡占满一行，沿用原 Stat 卡格式
│   └─ [Today] [Upcoming (7d)] [Overdue]   原 Dashboard 三列，原样
├─ Projects                                原 ProjectsPage 原样搬入
│   ├─ 标题行右侧 [+ New project]
│   └─ 卡片：颜色／名字（内联改名）／✎／🗑／进度条／%／N tasks·N completed·N open／Open in Gantt
└─ Tasks
    ├─ 6 张状态卡占满一行
    ├─ 状态下拉筛选
    └─ 8 列表格（WBS／任务／项目／开始／结束／进度／状态／优先级），点行开右侧任务面板
```

总览两卡的副标沿用原处语义：Projects → `active`，Total tasks → `N leaf tasks`。

## 6 张状态卡的口径

计数对象是**叶子任务**（沿用 Dashboard/Statistics 原口径：`tasks.filter(t => !tasks.some(x => x.parentId === t.id))`，配 `effectiveStates(tasks, logs)`）。

| # | 标签 | 副标 | 口径 |
|---|---|---|---|
| 1 | In progress | active | `eff.status === 'in-progress'` |
| 2 | Completed | done | `eff.status === 'completed'` |
| 3 | Paused | paused | `eff.status === 'paused'` |
| 4 | Coming soon | starts in 7 days | `startDate > today && startDate <= today+7` |
| 5 | Delayed | `past due · N due soon` | `eff.status === 'delayed'`，副标附带即将逾期的计数 |
| 6 | To-do | unscheduled | `eff.status === 'todo'` |

标签沿用 `STATUS_META`（[ui.ts:16-23](src/lib/ui.ts#L16-L23)）的英文，与全站 UI 语言一致。

三处要点：

- **`即将逾期` 不单独成卡，折进 `Delayed`。** 它的口径是 `endDate >= today && endDate <= today+7` 且未完成。第 5 张卡的**值**取 `delayed` 的计数，副标在有即将逾期任务时写成 `past due · N due soon`，没有时就是 `past due`——即用既有的 11px 小字副标行承载这条附带信息，不新增卡位。同时保留原 Dashboard Overdue 卡的 `danger` 红色数字（`delayed > 0` 时）。
- **`Coming soon` 承接的是原 Dashboard `Due soon` 的旧口径**（按 `startDate` 算，[DashboardPage.tsx:29](src/pages/DashboardPage.tsx#L29)）。原标签 "Due soon" 的含义其实是"即将开始"，这次一并纠正为 "Coming soon"。
- **卡片之间不互斥。** 一张进行中的任务可以同时计入 In progress 和 Coming soon，7 项之外的状态同理——6 个数字加起来不等于总任务数，这是设计如此，不是 bug。（`Coming soon` 按开始日算、`Delayed` 按 `today > endDate` 算（[tree.ts:85](src/lib/tree.ts#L85)），这两项彼此不重叠。）

## 实现步骤

1. **新建 `src/pages/ManagePage.tsx`**，按上面结构组装三个区块：
   - 总览区：把 [DashboardPage.tsx](src/pages/DashboardPage.tsx) 里私有的 `Stat` / `Section` / `Empty` / `TaskRow` 四个小组件一并搬过来复用，不重写。
   - Projects 区：把 [ProjectsPage.tsx](src/pages/ProjectsPage.tsx) 的 `statsFor` 与卡片 JSX 整体搬入。
   - Tasks 区：把 [TasksPage.tsx](src/pages/TasksPage.tsx) 的下拉 + 表格整体搬入，去掉底部的 `← Back to Gantt`；在表格上方用 `<Stat>` 新增 6 卡行。
   - 容器宽度用 `max-w-6xl`（与原 TasksPage 一致）。

2. **`src/types.ts:5`**：`AppView` 收敛为 `'gantt' | 'logs' | 'calendar' | 'manage'`。

3. **`src/App.tsx`**：路由从 7 条降到 4 条，`manage` 渲染 `<ManagePage />`。`DayDetailPanel` 的挂载条件（`gantt || calendar`，[App.tsx:44](src/App.tsx#L44)）不变。

4. **`src/components/Sidebar.tsx:12-20`**：`NAV` 删掉 dashboard / tasks / projects / statistics 四项，加入 `{ id: 'manage', label: 'Manage', icon: LayoutDashboard }`。

5. **删除四个页面文件**：`DashboardPage.tsx`、`TasksPage.tsx`、`ProjectsPage.tsx`、`StatisticsPage.tsx`。

6. **清理悬空引用**（`tsc --noEmit` 会全部指出）。需要保留的共享依赖：`averageProgress`（Sidebar 与 ProjectDetailPanel 仍在用）、`effectiveStates`、`formatShort`、`STATUS_META` / `STATUS_ORDER`。

不需要数据迁移：`activeView` 不入 localStorage，持久化只写 projects/tasks/logs（[useStore.ts:389-393](src/store/useStore.ts#L389-L393)）。

## 已知取舍与遗留

- **未开始的任务不再有卡片。** 按你的决定 `not-started` 不单独成卡，`Coming soon` 只覆盖 7 日内开始的——「未开始且 7 天后才开始」的任务只出现在下面表格里，靠下拉筛到。6 张卡的状态总览因此不是全集。
- **`ProjectDetailPanel` 本轮不动。** 它是右侧面板（点侧边栏项目打开），展示项目进度/计数/**描述**/Open in Gantt，与 Manage 的项目卡片信息重叠。但它是目前唯一能读到项目描述的地方，且不在这次四页范围内，先保留、记录在案。
- **侧边栏常驻的项目进度条保留**：它是导航（点击→甘特并筛选），不是聚合视图。
- 项目卡片上的 `✎` 走的是 ProjectsPage 原来那套（只改名字），改颜色和描述仍然只能在侧边栏的铅笔里做——沿用现状，不扩范围。

## 验证

1. `npm run build` —— `tsc --noEmit` 零错误。这是删掉四个页面后查悬空引用的主要手段。
2. `npm run dev`，打开 `Manage`：
   - 总览两卡的数字与侧边栏 "All projects" 的任务总数对得上；
   - Today / Upcoming / Overdue 三列与改动前 Dashboard 表现一致；
   - 抽一张卡验算：把某任务的 `startDate` 改到 3 天后，`Coming soon` 应 +1；把某严格任务的 `endDate` 改到 3 天后，`Delayed` 卡的值不变而副标出现 `· 1 due soon`；把 `endDate` 改到昨天，`Delayed` 的值应 +1；
   - Projects 卡片：新建 / 内联改名 / 删除 / Open in Gantt 全部可用；
   - 表格下拉筛选生效，点行能打开右侧任务面板。
3. 回归：Gantt、Logs、Calendar 三页仍能正常渲染（`AppView` 收窄会影响路由）。

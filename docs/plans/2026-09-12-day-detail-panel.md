# 日期详情面板（Calendar Day Detail）

## Context

现在 Calendar 页只有月历网格：点某天什么都不会发生，格子里最多列 4 个**起始日**落在该天的任务条。任务的完整信息只能通过点任务条打开右侧 `TaskDetailPanel` 看，缺少「以天为单位」的视角 ——「今天到底要处理什么、严格任务的日志补齐了没有」这个问题当前无处回答。

本次要做的是：在月历里点某一天，右侧滑出**日期详情面板**，回答三件事 —— 当天要处理哪些任务、当天严格任务的日志填写进度（圆环）、当天写了哪些日志（可读可编辑）。

同时，`src/lib/seed.ts` 目前返回空数据。曾经那份「全英文」的演示数据（`Course` / `French` / `Competition Team` / `STM32` / `Personal` 五个项目）存活在 commit `08aac95` 的 `src/lib/seed.ts` 里，被 `ecc4abf` 清空。需要把它按**当前数据模型**（`isTodo` / `strictProgress` / `paused` / `pauses` / 日志系统）重写回来，并补上演示日志，让新面板一装上就有东西可看。根目录的 `todo-demo.json` 弃用删除。

**已确认的决策**（来自用户）：
- 呈现形式：右侧面板（`aside`），与 `TaskDetailPanel` 同构。
- 圆环含义：**日志填写完成度** = 当天该写日志的严格任务里已写了几条。
- 清单范围：**全部展示**（长期/短期、严格/非严格都列），已完成的把任务名划掉；非严格任务不做处理，它们随日期自动加进度。
- 演示数据：以 `08aac95` 那份全英文数据为基础调整，根目录 `todo-demo.json` 弃用。

---

## 一、核心派生逻辑：`src/lib/dayTasks.ts`（新建）

纯函数，无 React，风格对齐现有的 `lib/tree.ts` / `lib/progress.ts` / `lib/logs.ts`。面板只负责渲染。

### 1. 日志必须先按日期裁剪

`taskProgress()`（[progress.ts:27-38](src/lib/progress.ts#L27-L38)）在严格分支里取的是**全部日志中最新的一条**（`own[own.length - 1]`），`loggedDays` 也统计所有日期 —— 它是「当前值」，不是「某天的值」。因此任何「截至 D 日」的计算都必须先裁剪日志：

```ts
export function logsUpTo(logs: TaskLog[], day: string): TaskLog[]  // l.date <= day
```

每次渲染裁剪一次，把结果传给所有下游调用，避免 O(logs) 重复扫描。

### 2. 「当天活跃」判定 —— 用原始日期，不用 `effectiveStates`

```
activeOnDay(task, day):
  task.isTodo            -> false      // 待办无排期，谈不上「某天」
  task.startDate == null -> false      // 防御性
  task.endDate == null   -> startDate <= day   // 长期目标 / 结束日未定 = 开放式
  else                   -> startDate <= day <= endDate
```

**为什么不复用 `effectiveStates`**：它内部写死了 `new Date()` / `todayISO()`（[tree.ts:104](src/lib/tree.ts#L104)、[L109](src/lib/tree.ts#L109)、[L126](src/lib/tree.ts#L126)），根本无法回答「过去某天」；而且父任务的 `endDate` 已被 `App.tsx:22-25` 的 `syncParentEnds()` 持久化同步过，走原始日期结果一致，还能避开 [tree.ts:137](src/lib/tree.ts#L137) 那个「任一子任务结束日未定 → 父任务 end 为 null → 该父任务从每一天消失」的坑。

### 3. 「截至 D 日的状态与进度」：`dayStates(tasks, logs, day)`

镜像 `effectiveStates`，但把 `day` 当参数传进去，并复用 tree.ts 已导出的 `deriveStatus` / `deriveTaskStatus` / `buildChildrenMap`：

- 叶子：`taskProgress(t, clipped, toDate(day))` + `deriveTaskStatus(t, progress, day)`（该函数第二个日期参数本来就叫 `today`，传 `day` 即可）。
- 父任务：子任务状态聚合 + 非 null 进度的平均值（长期目标无进度、待办不参与汇总，均照搬 `effectiveStates` 的规则）。
- 长驻目标：`progress: null`、状态由自身日期推导。

这样点回 9 月 3 号时，面板显示的是 **9 月 3 号那天**的进度和状态，而不是今天的。这是本功能最容易做错的地方 —— 直接把 `effectiveStates` 的结果往面板上一贴，所有历史日期都会显示今天的进度。

### 4. 圆环：`strictLogRate(tasks, logs, day) -> { done, total, pct }`

- **候选池** = 只取**叶子**任务（`strictProgress` 在父任务上是惰性的：`taskProgress` 只在叶子被调用，父任务值是子任务均值 —— 若把父任务算进分母会永久虚高），且 `type === 'phase'`、`strictProgress === true`、`activeOnDay`、**当天不在暂停中**、**当天开始前未完成**。
- `done` = 候选池中「日期 === day」有日志的任务数。
- `pct = total ? round(done/total*100) : 0`。

两个关键规则：

**(a) 排除「当天开始前就已完成」的严格任务**，用 `progressOnDay(task, clipped, day-1) >= 100` 判定，而不是 `progress >= 100`。否则会出现**写完日志反而掉进度**：3/5 时把某任务写到 100%，若用当天进度判定，它立刻退出分母 → 3/4 = 75%，看起来像倒退。用「当天开始前」判定则单调：3/5 → 4/5。语义也更诚实 ——「今天开工时还开着的严格任务，我记录了多少」。

**(b) 当天暂停中的任务不计入分母**。暂停了就不该要求写日志。需要按日判定，因为 `pauses` 存的是历史、`pauseDate` 只在当前暂停态下存在：

```ts
isPausedOnDay(task, day) =
  task.pauses.some(p => p.pauseDate <= day && day < p.resumeDate) ||
  (task.paused && task.pauseDate != null && task.pauseDate <= day)
```

**`total === 0` 的处理**：不渲染告警态，画一个只有轨道的空环，中心显示 `—`，下方灰字 `No strict work scheduled`。三种状态靠**文字 + 图标**区分，绝不只靠颜色（`#3fb950` 与 `#e3b341` 在红绿色盲下 ΔE 仅 3.8）：

| 状态 | 环填充 | 中心 | 说明文字 |
|---|---|---|---|
| `total === 0` | 无 | `—` | `No strict work scheduled`（dim） |
| `done === total > 0` | `STATUS_META.completed.color` | `100%` / `n/n` | `All strict work logged` + `Check` 图标 |
| 其余 | `done > 0` 用 accent，`done === 0` 用 `today` 黄 | `pct%` / `done/total` | `n missing` + `TriangleAlert`（`text-today`） |

> 备注：`taskProgress` 的自动累积分支是 `loggedDays / totalDays`（[progress.ts:36-38](src/lib/progress.ts#L36-L38)），即「严格任务大约需要窗口内每天一条日志才能做满」。圆环的分母用的正是同一个「一天一条」的单位，所以这个指标是自洽的，不是随手定的。

### 5. 清单分组：`dayRows(tasks, logs, projects, day) -> { strict, nonStrict }`

- `strict` = 严格 phase 任务；`nonStrict` = 其余（非严格 phase + 长期目标）。
- **逾期任务**：严格任务窗口已过、仍未完成（即应用自己的 `delayed` 概念）当天已不在 `activeOnDay` 范围内，会从面板上彻底消失 —— 而它恰恰是最该被处理的。所以清单额外纳入这类任务并加 `Overdue` 徽标。它们**不进圆环**（不是「今天该记录的工作」），这个不对称是刻意的。
- 行数据：`{ task, wbs, depth, status, progress, hasLog, pausedToday, strict, overdue }`，`status`/`progress` 取自 `dayStates`。
- 排序：状态优先级（`delayed < in-progress < not-started < paused < completed`）→ 项目顺序 → WBS。
- 待办（`isTodo`）不出现 —— 它们没有排期，若纳入会在 42 个格子里全都是它们。

---

## 二、状态归属与布局

**选中日期放进 zustand store**：`selectedDay: string | null` + `setSelectedDay`。理由：面板要作为 `TaskDetailPanel` 的兄弟节点挂在 `App.tsx`，且 store 里已经放着全部跨面板选择态（`selectedTaskId` / `selectedProjectId`）。持久化订阅只写 `projects`/`tasks`/`logs`（[useStore.ts:383-387](src/store/useStore.ts#L383-L387)），所以 `selectedDay` 不会落进 localStorage，无迁移负担。

**面板挂在 `App.tsx`**，位于 `</main>` 之后、现有两个详情面板之前，用 `view === 'calendar'` 门控：

```
<Sidebar/> <main>{CalendarPage}</main>
{view==='calendar' && selectedDay && <DayDetailPanel day={selectedDay}/>}
{project ? <ProjectDetailPanel/> : task ? <TaskDetailPanel/> : null}
```

- 宽度用 `w-[320px]` 与 `TaskDetailPanel` **完全一致** —— 两者并排时 20px 的差异看起来像 bug。
- 三栏顺序自然是 `日历 | 日期面板 | 任务面板`；从日期面板点任务直接 `setSelected(taskId)`，无需穿过页面传回调。
- 切换视图时面板自然卸载，无需清理 effect。不在 `setActiveView` 里清空 `selectedDay`，这样回到 Calendar 能恢复面板。

---

## 三、文件改动清单

### 新建

| 文件 | 内容 |
|---|---|
| `src/lib/dayTasks.ts` | 上述全部纯函数 |
| `src/components/ProgressRing.tsx` | `{ value, size=92, stroke=9, color, track, children }`。两个 `<circle>`，`r=(size-stroke)/2`，`C=2πr`，`strokeDasharray={C}`，`strokeDashoffset={C*(1-value/100)}`，`transform="rotate(-90 cx cy)"`，`strokeLinecap="round"`，`transition-[stroke-dashoffset] duration-500`。外层 `relative` + 绝对居中的 `children`，加 `role="img"` + `aria-label`。无新增依赖（项目里没有图表库，现有可视化全是手写 div 宽度条） |
| `src/components/DayLogsModal.tsx` | 把 `LogsPage.tsx:197-260` 的私有 `DayDetail` **原样**提出来，改名、props 不变（`date, logs, tasks, projects, onClose, onEdit, onDelete`）。保持纯展示，`LogsPage` 的改动就只是「删掉本地函数 + 加 import」 |
| `src/components/DayDetailPanel.tsx` | 面板本体：头部（`formatLong(toDate(day))` + ✕）→ 圆环块 → 两个可折叠分组 → 底部「Read this day's logs (n)」按钮。本地状态：`expandedRows`（在列表上以 `day` 作 key 重置）、`openSections`、`logFor`、`logsOpen`。行组件 `DayRowView` 先内联在本文件（照 `LogsPage` 保留私有 `DayDetail` 的做法），超过 ~250 行再拆 |

### 修改

| 文件 | 改动 |
|---|---|
| `src/store/useStore.ts` | 加 `selectedDay` / `setSelectedDay` 到 `State` 和 creator。**不动** `importData`、不加持久化 |
| `src/App.tsx` | 读 `selectedDay`，在 `</main>` 与现有面板之间插入日期面板 `aside` |
| `src/pages/CalendarPage.tsx` | ① 日格可点选（`onClick` + `role="button"` + `tabIndex={0}` + Enter/Space `onKeyDown`），选中态 `ring-1 ring-inset ring-accent bg-accent/10`；② **关键**：[CalendarPage.tsx:61](src/pages/CalendarPage.tsx#L61) 的任务条按钮必须改成 `onClick={(e) => { e.stopPropagation(); setSelected(t.id) }}`，否则点任务条会连带把日期面板切走；③ 格子内任务条仍然只显示**起始日**在该天的任务（否则长任务会糊满 40 个格子）；④ 每格加一个 `3/5` 式的小徽标（由 `strictLogRate` 算出），让这个功能在网格上可被发现 —— 42 个格子在一个 memo 里算完 |
| `src/components/LogDialog.tsx` | **必须改**：加 `defaultDate?: string`，`useState(existing?.date ?? defaultDate ?? todayISO())`（[LogDialog.tsx:19](src/components/LogDialog.tsx#L19)）。否则在 5 号的面板里点笔，日志会被静默记成 12 号，直接污染严格进度。向后兼容，现有调用点不动 |
| `src/pages/LogsPage.tsx` | 删掉私有 `DayDetail`，改为 import `DayLogsModal`。行为无变化 |
| `src/lib/seed.ts` | 见第四节 |
| `todo-demo.json` | 删除（已弃用，且 git 里有记录可恢复） |

### 两个交互冲突的取舍

1. 需求说「点行展开进度条」，也说「点任务打开任务详情」。**取**：行主体点击 = 展开/收起进度条；展开区里放 `View task →` 按钮打开任务面板；悬停时右侧出现「写日志」笔图标。
2. 笔图标：**总是新增一条当天日志**（贴需求原文），不尝试复用当天已有日志；改和删走「Read this day's logs」弹窗 —— 那里本来就是编辑面。

### 「向右展开」的实现

行体常驻挂载，同时动高度和宽度两个轴，避免依赖挂载时序，让进度条真的从 0 向右长出来：

```tsx
<div className={`overflow-hidden transition-[height] duration-300 ${expanded ? 'h-7' : 'h-0'}`}>
  <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
    <div className="h-full rounded-full transition-[width] duration-300 ease-out"
         style={{ width: `${expanded ? row.progress : 0}%`, background: STATUS_META[row.status].color, opacity: 0.85 }} />
  </div>
</div>
```

### 「未填写日志」的特殊标注

`row.strict && !row.hasLog && !row.pausedToday && !row.completeBefore` 时显示琥珀色药丸（`bg-today/15 text-today border border-today/30`，`today: '#e3b341'` 已在 [tailwind.config.js](tailwind.config.js) 中），**文字 + `TriangleAlert` 图标**，不只靠颜色。暂停中的行改显示蓝色 `Paused` 药丸。长期目标展开区显示 `No progress (long-term goal)`（对齐 [TaskDetailPanel.tsx:226](src/components/TaskDetailPanel.tsx#L226) 对无进度任务的隐藏处理）。

---

## 四、演示数据：`src/lib/seed.ts`

源码来源：`git show 08aac95:src/lib/seed.ts`。它用**相对今天的天数偏移**（`d(offset)`），永不过期 —— 正是我们要的形式；但 `Spec` 形状是旧的：`progress` / `status` 曾是**存储字段**（现已派生），`est` / `act` 已从模型移除。

### Spec 转换

去掉 `progress` / `status` / `est` / `act`；新增 `isTodo?` / `strict?` / `paused?` / `pause?`（偏移）；保留 `desc` / `tags` / `priority` / `parent` / `type` / `start` / `end`。

转换的关键洞察：`autoProgress` 把 `elapsed` 钳制在 `total`（[progress.ts:12](src/lib/progress.ts#L12)），所以**任何窗口已结束的非严格任务都自动派生为 100%**，零日志。旧数据里的 `status: 'completed'` 因此等价于「过去的窗口 + 非严格」，不需要伪造百分比；`not-started` ≈ 未来起始日，`in-progress` ≈ 窗口覆盖今天。

`buildSeed` 现在还要返回 `logs`（[useStore.ts:92-93](src/store/useStore.ts#L92-L93) 已在用这个三字段形状）。新 seed 里 `startDate: isTodo ? null : d(s.start ?? 0)`、`endDate: isTodo || isLT ? null : d(s.end ?? 0)`，`createdAt` 沿用 `now`，日志的 `createdAt`/`updatedAt` 用 `d(offset) + 'T09:00:00'` 使历史顺序看起来正常。`strict: true` 的 tsconfig 下每个字段都必填，漏字段即编译错误 —— 这本身就是安全网。

### 具体分配（today = `d(0)`；除注明外，各任务窗口沿用 08aac95 原值）

| id | 相对原数据的改动 | 用意 |
|---|---|---|
| `stm-motor-test` | `strict: true` + 当天日志，`targetProgress: 25` | 严格任务**有**当天日志；target 保留原 25%，同时覆盖 `taskProgress` 的手动覆盖分支 |
| `stm-can` | `strict: true` + 当天日志，`targetProgress: 50` | 第二个已记录严格任务 |
| `team-vision` | `strict: true` + 当天日志，`targetProgress: 35` | 第三个已记录严格任务 |
| `stm-pid` | `strict: true`，**当天无**日志，仅 `d(-1)` 一条（target 15） | 演示「有历史、缺今天」→ 琥珀药丸，进度仍是原 15% |
| `fr-u5` | `strict: true`，**一条日志都没有** | 演示零日志场景（进度老老实实派生为 0%） |
| `stm-motor-pcb` | `end: -1` → `end: 0` | 划名演示：窗口今天结束、非严格 → 恰好 100%、读作 `completed`，**且今天仍在窗口内** |
| `pe-read` | `paused: true, pause: -3` | 取代旧的存储 `status: 'paused'`；显示 Paused 药丸与详情页暂停块 |
| `stm-chassis`、`stm-motor`、`stm-fw`、`team-algo`、`co-pytorch`、`pe-goal` | 显式 `strict: false` | 父任务 —— 防止惰性标志把父任务塞进严格分组 |
| `fr-goal`、`pe-goal` | 不动（`type: 'long-term'`，`start` 分别 -120 / -200） | 新模型下本来就正确，无需再造日期 |
| 新增 3 个待办 | `stm-todo-mosfet`（`stm-chassis` 下）、`pe-todo-sicp`、`fr-todo-podcast`，均 `isTodo: true` | 覆盖待办文件夹 UI，并验证面板正确地**不**收录它们 |

其余（`stm-motor-sch`、`co-python`、`stm-mach`、`stm-aim`、`stm-test`、`stm-field`、`fr-listen`、`co-cnn`、`pe-goal-robot`、`team-mech`、`team-elec`、`team-decision`、`co-mlp`、`fr-anki`、`pe-fitness`）除了删掉旧字段外无需改动，状态会正确重派生。

**今天的圆环结果**：`{stm-motor-test ✓, stm-can ✓, team-vision ✓, stm-pid ✗, fr-u5 ✗}` → **3/5 = 60%**，两个琥珀药丸，一行划名（`stm-motor-pcb`），一行 Paused，两个长期目标显示 `—`。

### 演示日志（5 条，让 LogsPage 出现三个不同日期：`d(-2)` / `d(-1)` / `d(0)`）

1. `stm-motor-test` @ `d(0)`，target 25：`"- Flashed bring-up firmware\n\t- Encoder counts stable at 1 kHz\n\t- Closed-loop spin test OK\n- Next: current-loop calibration"`（Tab 缩进同时验证 `parseLogContent` 的子条目渲染）
2. `stm-can` @ `d(0)`，target 50：`"- CAN frames TX/RX at 500 kbps\n\t- Filter mask was wrong, fixed\n- Next: error-frame handling"`
3. `team-vision` @ `d(0)`，target 35：`"- Labelled 120 armor-plate images\n- 20 epochs, mAP 0.42\n- Next: augment for low light"`
4. `stm-pid` @ `d(-1)`，target 15：`"- 1 kHz PID loop running\n\t- 30% overshoot at Kp=2.0\n- Next: lower Kp, add D term"`
5. `fr-anki` @ `d(-2)`，`targetProgress: null`：`"- 40 new cards, 120 reviews"`（非严格任务上的日记式日志，证明日志在严格模式外同样有用）

日志 id 用稳定值如 `log-stm-can-0`。

> 注意：首次挂载时 `syncParentEnds` 会重写 seed 里父任务的结束日（`stm-chassis` 的 35 → 其子任务最大值 34）。这是**正确行为**，不是 seed 的 bug，不要试图保留字面值。

---

## 五、实施顺序

每一步都可独立验证：

1. `src/lib/dayTasks.ts` —— 纯函数，无 UI 风险，后续全部依赖它。
2. `src/lib/seed.ts` —— 还原 + 转换 + 日志。做完立刻能在甘特图里看到。
3. `src/components/ProgressRing.tsx` —— 独立 SVG。**动手前先调用 `dataviz` skill**（圆环属于 meter/stat 类可视化，skill 描述了配色与文字/图标不依赖颜色的规则）。
4. `src/components/DayLogsModal.tsx` + 改写 `LogsPage.tsx`。零行为变化，先回归 Logs 页再往下走。
5. `LogDialog` 加 `defaultDate`。
6. `useStore` 加 `selectedDay` / `setSelectedDay`。
7. `src/components/DayDetailPanel.tsx`。
8. `src/App.tsx` 接线。
9. `src/pages/CalendarPage.tsx` —— 可点选格子、任务条 `stopPropagation`、每格徽标。
10. `npm run build`（其 `tsc --noEmit` 是类型闸门），再做手工验收。

## 六、验收

**先清数据**：DevTools console 执行 `localStorage.removeItem('wbs-gantt.v2')`，再 `npm run dev` 刷新。否则 store 会加载你现有的数据（[useStore.ts:91-93](src/store/useStore.ts#L91-L93)），新 seed 根本不会出现 —— UI 里没有重置按钮，[Sidebar.tsx:56](src/components/Sidebar.tsx#L56) 只有导入。

- **Calendar**：今天的格子有 accent 选中环；右侧 320px 面板出现，带完整日期和 ✕。
- **圆环**：读作 `60%`、`3 / 5`、说明文字 `2 missing` + 警告图标。点另一天 → 圆环与清单同步变化，说明文字带上那一天。
- **严格分组**：5 行，两行带琥珀 `No log` 药丸（`stm-pid`、`fr-u5`）。**非严格分组**：长期目标显示 `—`，`pe-read` 带 Paused 药丸，`stm-motor-pcb` 划名。
- **行展开**：点一行 → 进度条从左向右从 0 长到目标值；再点 → 收成 0。分组头可折叠。
- **写日志**：悬停 `fr-u5` 出现笔图标 → 点开，**Date 字段是面板选中的那天而不是今天**；保存后琥珀药丸消失、圆环变 4/5 = 80%。
- **三栏并存**：展开行里点 `View task →`，任务面板出现在日期面板**右侧**；关掉它日期面板还在。再点日历里的任务条 → 日期**不变**（验证 `stopPropagation`），任务面板打开。
- **日志弹窗**：点「Read this day's logs (3)」→ 按任务分组列出当天日志；编辑其中一条（LogDialog 预填的是日志自己的日期，不是面板日期）；删除一条；✕ 和点遮罩都能关。
- **历史日期准确性**（最重要的一条）：点回 `d(-8)` 附近 → 出现的是**那一天**的进度与状态；`stm-motor-sch` / `stm-motor-pcb` 划名；`stm-pid` 显示当天缺日志；`co-python` 只在自己的窗口内出现。若这里显示的进度和今天一样，说明 `dayStates` 没接上，是回归。
- **不串扰**：切到 Logs / Gantt，日期面板消失，切回来又出现；Logs 页的便利贴网格与日详情弹窗行为与改动前完全一致（提取的回归验证）；在甘特图点 Expand all / Collapse all，日期面板的行展开状态不受影响（证明面板用的是自己的状态，没复用 store 的 `expanded`）。

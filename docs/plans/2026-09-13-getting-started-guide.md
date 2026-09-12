# 应用内入门指引：六步顺序流程 + 说明弹窗

## Context

main 的 `buildSeed()` 是刻意留空的桩，新用户打开就是一块空看板，没有任何引导。

约束是三条：依赖表冻结（不能用 driver.js / intro.js）、三种语言由编译器强制齐全、四套配色（截图方案在另外三套下都是错的）。这三条合起来把聚光灯式引导排除掉了 —— 它绑 DOM、文案要乘三、而且步骤失效是静默的。

所以做成**一张右下角的卡片 + 应用自己的 Modal 弹窗**：卡片列出六步与进度，用户在真实看板上操作；讲原理的部分以弹窗文字讲述。不绑 DOM、不依赖截图、文案走字典。

**这是一条有顺序的流程，不是六个独立勾选项**：第 2 步的东西建在第 1 步的项目里，第 3 步的严格子任务挂在第 2 步的父任务下，第 5 步的日志写在第 3 步那条上。所以卡片显示「第 N / 6 步」，后面的步骤压暗，当前步骤高亮。

## 六步与判定

放在新文件 `src/lib/guide.ts`，纯函数、不引 React 也不引 i18n（标签由组件用 `t(\`guide.step.${id}\`)` 构造，同 `SettingsPage.tsx:101` 的 `t(\`theme.${id}.name\`)`）。形状对齐 `progress.ts` / `tree.ts` / `dayTasks.ts`。

```ts
export function guideSteps(projects, tasks, logs, read: string[]): GuideStep[]
```

先解出三个「产物」，后面的步骤都指着它们：

- `project` = `projects[0]`（看板起始为空，所以就是用户建的那个）
- `parentTask` = 最早的、`parentId === null && !isTodo` 的任务（按 `createdAt` 取最早，多个时稳定）
- `strictChild` = `parentId === parentTask.id && strictProgress` 的任务

| # | id | 卡片文案 | 判定 |
|---|---|---|---|
| 1 | `project` | 新建一个项目 | `projects.length > 0` |
| 2 | `parentTask` | 在这个项目下新建一个父任务 | 存在根任务（`parentId === null && !isTodo`） |
| 3 | `strictChild` | 在父任务下新建一个严格子任务 | 存在 `parentId !== null && strictProgress` 的任务 |
| 4 | `endDate` | 父任务的结束日期是怎么来的 | `read` 含 `endDate`（纯讲解，见下） |
| 5 | `log` | 给严格子任务写一条任务日志 | `logs` 里有 `strictChild` 的日志 |
| 6 | `tour` | 逛一圈：日志 · Manage · 日历 · 设置 | `read` 含 `tour`（纯讲解，见下） |

**第 4 步的完成只能靠「读过」这个标志。** 它想讲的规则（父任务结束日期 = 子任务里最晚的那个）在子任务一建出来时就已经成立了，推导不出「用户是否理解」。所以用 `Prefs.guideRead: string[]` 记已打开过的说明弹窗 —— 纯讲解的步骤（4、6）靠它判定，挂在动作上的说明弹窗（第 5 步那条）打开不影响完成。

**第 5 步的说明弹窗不做自动弹出。** 写完日志进度会变，那一刻自动弹窗讲「为什么变了」教学效果最好，但那要靠 `useEffect` 监听状态翻转，而 `main.tsx` 有 `StrictMode`（dev 下 effect 跑两次），且要额外记「已经弹过了」。改成行内一个「看说明」按钮，用户在写之前或之后自己点 —— 弹窗文案本身就把对比讲全了。

## 说明弹窗的内容

第 4 步和第 5 步是这次改动的教学核心，文案必须和代码里的推导**逐字对得上**。下面是内容提纲（中英法三份都要写，这里只列中文意图）：

**第 4 步 · 父任务的结束日期是怎么来的**

> 父任务自己不排期 —— 它的结束日期由子任务决定：永远是所有子任务里最晚的那个结束日期。
>
> 这一点界面上就写着：你现在打开父任务的编辑框，会看到结束日期那一栏是灰的，鼠标停上去写着「由子任务决定」。你拖动任何一个子任务，父任务都会跟着走。
>
> 父任务的**进度**同理，是它子任务进度的平均 —— 所以父任务也不让你手填进度。

依据：`syncParentEnds`（`tree.ts:159`）取子任务的有效结束日期；`TaskDialog.tsx:207` 在有子任务时 `disabled` 结束日期输入并挂 `task.endDateLocked` 提示；`averageProgress`（`progress.ts:42`）。

**第 5 步 · 严格与非严格，进度是怎么算的**

> 差别在于**进度从哪来**。
>
> 普通任务看日历：窗口过去多少比例，进度就是多少 —— 还没开始是 0%，窗口一结束自动读满 100%。你什么都不用做它也会动。
>
> 严格任务只认日志。一条日志都没有，它就一直是 0%，**哪怕窗口早就过去了**。写了日志之后分两种情况：
> - 日志里填了「目标进度」，就取最后一条填的值；
> - 没填，就按「写过日志的天数 ÷ 窗口总天数」自动累积 —— 所以漏掉一天，就是实打实地少一格。
>
> 严格任务存在的意义是：让进度反映你真的做了多少，而不是让时间替你走完。

依据：`autoProgress`（`progress.ts:6`）与 `taskProgress`（`progress.ts:23-40`）三条分支，逐条对应上面三段。

**第 6 步 · 逛一圈**

先调 `addSample()` 把示例数据**追加**进来（见下），再弹出：

> 现在看板上多了一块示例数据，日志、日历和 Manage 页都有东西可看了。四个页面各看一句：
>
> - **日志**：按天汇总所有任务写过的内容，严格任务的日志还带着目标进度。
> - **Manage**：整体概览 —— 今天该做什么、接下来是什么、什么逾期了，下面按项目和任务分列。
> - **日历**：整月视图，每格的深浅是当天严格任务的日志覆盖率；有里程碑和逾期任务的日子会标出来。
> - **设置**：三种语言和四套配色，随时切。

每段配一个「带我去」按钮（`setActiveView`）。

## 示例数据：追加，不是替换

示例数据**不放进 `src/lib/seed.ts`**。那个文件在模块加载时被 `useStore.ts:103` 的 `loaded ?? buildSeed()` 兜底，`useStore.ts:105` 又会立刻写进 localStorage —— 放进去等于每次新装都开出一块演示看板，和「新装是空白的」这个既定决定冲突（也和你把数据停在 `seed-tutorial` 分支上的现状冲突）。

新文件 `src/lib/sample.ts` 导出 `buildSample()`，从 `git show seed-tutorial:src/lib/seed.ts` 整体移植（259 行，除 `./dates` 和 `../types` 无依赖）。

**关键改动：新增 store action `addSample()` 追加，而不是走 `importData()` 替换。** 第 6 步紧跟在用户刚建完自己的项目、父任务和子任务之后 —— 用一个整体替换的按钮会把用户刚做的东西一键抹掉，而 `importData` 没有撤销（订阅器同步写盘）。追加没有这个问题，也就不需要确认弹窗。

- 幂等：示例数据的项目 id 是稳定字符串（`stm32` / `french` / …），已有的用户项目 id 是 uuid，不可能撞。`addSample()` 在发现任一示例项目 id 已存在时直接不动，所以重复点不会追加第二份。
- 顺带避开了 `importData` 唯一跳过 `storage.ts:61` 私有 `normalize()` 的问题 —— 追加根本不经过它。（`normalize` 不只是补字段，还是 `isTodo ⇒ 无日期/无严格/无暂停` 这些不变式的修复点；TypeScript 管字段，管不了这些。本次不动它，但值得单独记一笔。）

## 跳转

比上一版大幅缩水 —— 卡片不再跳到示例任务上，只有两类跳转：

- **第 3、5 步**的行给一个「带我去」（`setSelected(strictChild.id)`），选中用户自己刚建的那条，打开它的详情面板。
- **第 6 步**的四个页面按钮（`setActiveView`）。

**不选中示例看板上的任务，就不需要 `focusTask` 那套东西** —— 不用展开祖先、不用展开待办文件夹（`todogroup:` 那个坑这次不碰）、不用给甘特图加 `data-task-row` 和 `scrollIntoView`。`GanttChart.tsx` 本次**不动**。

## 卡片摆哪儿

**不能用 `fixed bottom-right`** —— 那三块详情面板是 `App.tsx:40-43` 里的 in-flow flex 兄弟，本来就贴着窗口右边，卡片会正好盖在刚点开的面板上。而第 3、5 步的「带我去」和说明弹窗都要跟面板打交道，等于盖住自己刚打开的东西。

改成给 `main`（`App.tsx:30`）加 `relative`，卡片 `absolute bottom-4 right-4 z-[50]` 渲染在 `main` 里面。`main` 是 `flex-1 min-w-0`，到面板为止 —— 卡片永远不会压到面板上，`main` 的 `overflow-hidden` 也只是裁掉而不是溢出。不要用 portal，portal 到 `document.body` 会原样复现这个重叠。

`z-[50]`：甘特画布内部最高 40，Modal 是 60，ContextMenu 是 69/70 —— 卡在中间，低于所有模态（说明弹窗用 `Modal`，`z-[60]`，会盖在卡片上，正确）。

样式抄 `Modal` / `ContextMenu` 的配方：`bg-panel border border-border rounded-[3px] shadow-2xl`。**必须是实心 `bg-panel`** —— 卡片浮在交替的 `bg-stripe` 行上面，半透明在 `paper`（亮色）那套主题下会糊。

## 组件形状

`App.tsx` 目前**没有**订阅 `logs`。内联进 App 的函数体的话，App 会多一个 `logs` 订阅，每次存日志都重渲染整棵树（App 渲染 Sidebar、main 和三块面板，全都没有 memo）。所以做成 `<GettingStarted />` 自订阅子组件，从 App 无条件渲染一行，App 的 selector 集合不变。

`src/components/GettingStarted.tsx` 一个文件里放三样：

1. 选择器函数 —— 调 `guideSteps()`，算出 `{ steps, currentIndex, allDone }`。全项目唯一的决策点。
2. 卡片 —— 标题、`currentIndex + 1 / 6` 进度、六行（已完成打勾／当前高亮／未到压暗）、当前动作步骤的「带我去」、讲解步骤的「看说明」、关闭按钮。行是根据 `kind` 分支的普通 `<button>` / 静态行。
3. 说明弹窗 —— 用 `ui.tsx` 的 `Modal`，正文按段落分 `<p>`。

说明步骤的「看说明」按钮**只在它前面所有动作步骤都完成时才可点**（`disabled` + `title` 说明原因）—— 第 4 步的讲解前提是用户已经有一个带子任务的父任务，否则弹窗里说的东西在屏幕上一个都找不到。

都用 `.some()` 返回布尔，selector 稳定；**不要引 `useShallow`**（仓库没用过）。弹窗开关是 `useState`，跳转在事件处理里，不放 `useEffect`。

## 要动的文件

| 文件 | 改动 |
|---|---|
| `src/lib/guide.ts` | 新增。六步表 + 判定纯函数 |
| `src/lib/sample.ts` | 新增。从 `git show seed-tutorial:src/lib/seed.ts` 移植 |
| `src/components/GettingStarted.tsx` | 新增。卡片 + 说明弹窗 |
| `src/App.tsx` | `main` 加 `relative`；渲染 `<GettingStarted />` |
| `src/components/Sidebar.tsx` | 底部数据行加一个 `?` 图标按钮（`HelpCircle`，已确认 lucide-react 0.451 里存在），`title` 复用 `guide.title` |
| `src/store/useStore.ts` | 新增 `guideDismissed` / `guideRead` 状态 + `addSample` / `dismissGuide` / `showGuide` / `markGuideRead`；扩展 `persistPrefs()` 的解构 |
| `src/store/storage.ts` | `Prefs` / `DEFAULT_PREFS` / `loadPrefs` 加 `guideDismissed: boolean` 与 `guideRead: string[]`（按现有逐字段校验的写法，缺键或类型不对回落到默认值） |

`src/lib/seed.ts` **不动**，`GanttChart.tsx` **不动**。

## i18n

`en` 里加一节 `// --- getting started ---`，`zh` / `fr` 同位置镜像。全部走 `t()`，不需要 `useTRich`。

```
guide.title / guide.dismiss / guide.done / guide.read / guide.close
guide.step.{project,parentTask,strictChild,endDate,log,tour}        6
guide.explain.endDate.title / .p1 / .p2
guide.explain.strict.title  / .p1 / .p2 / .p3
guide.explain.tour.title / .intro / .logs / .manage / .calendar / .settings
```

约 24 个 key × 3 = 72 条手写文案（项目不机器翻译）。**弹窗正文是段落，这是这次改动的主要成本** —— 三份都要真写，法语比英语长 20–30%。按 `i18n.ts` 现有排版：长条目单独占行，跨行用 `+` 连接（`en:222-229` 有先例）；正文按段落拆成 `p1` / `p2`，不要在字符串里塞 `\n\n` 再靠 `whitespace-pre-line` 渲染。

注意 `en` 必须保持裸对象字面量（不能 `as const` / `satisfies`），`zh`/`fr` 必须直接赋值（不能 spread）—— `i18n.ts:12-22` 那两条规则，破了机制会静默反过来。

## 文档

- `CHANGELOG.md` 的 `## v0.3.0 — 待发布` 下 `### 新增` 加一条加粗起头的条目。
- `FEATURES.md`：三、功能清单在「部署与发布」之前插入一节，编号顺延；修正 §12/§13 里把 prefs 键描述成「语言与主题」的句子（现在还有 `guideDismissed` 和 `guideRead`）；「新装是空白的」那段补上「示例数据由第 6 步按需追加」。
- **记录一次决定反转**：`docs/plans/2026-09-13-calendar.md` 写着「演示数据只改 `seed-tutorial` 分支，不进 main」。本方案把数据集搬进了 main 的 `sample.ts`（`seed.ts` 仍是空桩，新装仍是空的，所以反转的只是「数据集不在 main」这半句）。按惯例在 `docs/plans/README.md` 登记本次计划，把这条反转写清楚。
- **`seed-tutorial` 分支本方案不动**，删不删由你定。留着两个副本会漂移，这是我倾向删的理由，但删分支不可逆，我不替你决定。

## 明确不做

- 聚光灯 / 蒙层引导（绑 DOM、静默失效、文案乘三）。
- 截图（四套主题下三套是错的）。
- 教程进度的跨会话持久化（哪些动作步骤做过了）—— 动作步骤全部实时推导，只有两个纯讲解步骤用 `guideRead`。
- 第 5 步说明弹窗的自动弹出（`StrictMode` 下 effect 双跑，且要额外记「弹过了」）。
- 设置页里的教程开关 —— 侧栏 `?` 已经覆盖。
- 空状态文案的单独改造 —— 卡片本身就是空状态引导。
- 重新加载示例数据的入口 —— 想看原始状态就删掉示例项目再走一次第 6 步。

## 验证

1. `npm run build` —— `tsc --noEmit` 是三语齐全的兜底，漏一个 key 就挂。
2. **清掉两个 localStorage 键后硬刷新**（`wbs-gantt.v2` 和 `wbs-gantt.prefs`）。必须硬刷新：HMR 不会重跑模块级代码，`FEATURES.md:168` 记过这个坑。预期：空看板 + 卡片显示 1 / 6。
3. 按顺序走一遍，每步核对卡片自动前进：
   - 建项目 → 第 2 步亮起
   - 在该项目下建父任务 → 第 3 步亮起
   - 在父任务下建严格子任务 → 第 4 步亮起，**核对「看说明」此时才从禁用变为可点**
   - 读第 4 步弹窗 → 关闭后第 5 步亮起
   - 给严格子任务写日志 → 第 5 步完成；**核对进度确实从 0 变成了预期值**
   - 读第 6 步弹窗 → **核对该弹窗打开时示例数据被追加**，用户自己建的项目和任务仍在
4. 专门核对两条推导规则和弹窗文案一致：
   - 有子任务时父任务的结束日期输入框是禁用的，且结束日期等于最晚的子任务结束日期；拖动子任务后父任务跟着走
   - 严格任务：没日志恒为 0（把窗口设成过去也一样）；日志填了目标进度就取目标值；不填则按已写天数 ÷ 窗口天数
5. 第 6 步的四个「带我去」各自跳对页面，且页面里确实有数据可看（Logs 有日志、Calendar 有覆盖率深浅、Manage 有统计）。
6. 六步全完成后卡片收成一行「已经上手了」；关闭后侧栏 `?` 能重开；刷新页面确认关闭状态被记住。
7. 重复点第 6 步的「看说明」多次，核对示例数据不会追加第二份。
8. 三种语言 × 至少两套主题（`graphite` 和 `paper`）各走一遍，重点看 `paper` 下卡片对比度和法语弹窗换行。

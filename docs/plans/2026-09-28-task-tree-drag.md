# 任务结构管理：项目行 + 编辑模式下拖拽

> **这一份已经与最终实现对齐：正文说的是「做成了什么」，不是「当时打算做什么」。**
> 凡与获批稿不同的地方，就地用 **〔改动 N〕** 标出，编号对应文末的《获批之后的修订》。改动有十处，其中四处是**用户见到实现之后推翻或追加的**（实时预览、待办沉底、撤销、圆圈多选）—— 只留获批稿再另附说明的话，正文会和自己打架。

## 背景

调整任务树的层级现在只能打开每个任务的对话框、在「父任务」选择器里挑一个新的，**一次一个**；同级之间的先后**根本改不了**（由 `buildChildrenMap` 按 `(是否待办, 开始日期, 名字, id)` 现算，是只读的）。

同时有三个已存在的缺陷，根子是同一个：

- **父任务的时间条不跟着子任务走。** `effectiveStates` 给父任务算的起始日是「最早子任务的开始」，但 `syncParentEnds` 只把**结束日**写回任务，起始日永远停在原地；而 `TaskBar` 画条子用的是 `row.task.startDate`/`endDate` 这两个**存下来的**值。把子任务往右拖，子任务的条走了、父任务的左边缘不动 —— 看上去就是「父任务有一个最小长度」。
- **父任务的起始日输入框是假的。** 改了，下一次同步就覆盖掉，但对话框里它看起来可以编。
- **「不用写日志」这个开关在父任务上也是假的。** `TaskDetailPanel` 早就写明了（`hasKids ? t('task.modeRolledUp')`，注释原话是「a parent takes its progress from its children, so the strict flag is inert on it」），详情面板说对了，对话框没说。

外加一件要**删掉**的功能：父任务能代写整棵子树里每个待填子任务的日志（`LogDialog` 的批量模式）。容器不代别人干活。

## 屏幕上会变成什么样

**甘特图左栏多了项目行。** 每个有任务的项目，在它那组任务上面多一条整行：高 32px（和第三级子任务一样）、**不缩进**、横跨整行；左边是折叠三角 + 项目名（项目色），右边一条同色横线**从名字一直跑到任务栏右端留 12px 处**〔改动 10〕；名字优先于线（名字占满整行时才截断）。**时间轴那一侧什么都不画**〔改动 10〕—— 标记它的颜色已经在同一行的左半边了，右边再来一条会被读成一条任务条。点它折叠/展开；`−`（全部折叠）也把它折上；空项目不画头。任务本身的层级、缩进、字号**一个都不变**。

**工具栏最右边多了「管理任务」**，点下去进入编辑模式：按钮变按下的强调色、文字变「完成」，旁边一个小标签「编辑模式」；再点「完成」或按 `Esc` 退出。

**编辑模式里，每个任务名左边一个圆圈。**〔改动 7〕点圈或点行都切换勾选，**不用按 Ctrl**；`Shift` 连选一段。选中之后顶部工具栏整条换成选择栏：`✕ ｜ 已选 N 项 ｜ 设为待办 ｜ 暂停任务 ｜ 恢复 ｜ 删除`。

**拖动**：

- 落在某行的**上 1/4 / 下 1/4** → 插到它前/后（同级）；落在**中间一半** → 变成它的子任务；落在**项目行上** → 搬到那个项目的顶层。
- **拖父任务 = 搬整个文件夹**：整棵子树一起走，子树里每个任务的 `projectId` 跟着改成落点所在的项目。不然项目筛选一开，子任务会从树上凭空消失。
- 待办不能当父任务（本来的规矩），所以对待办行只有上/下两种。

**拖动时是实时预览。**〔改动 2〕指针还按着，行就已经动到新位置上了：被挤开的行滑开（180ms），落点行跟着指针走。松手就是这一个结果 —— 预览和结果由**同一个函数**算出来。

**顺序记在任务上**：拖过一次之后，这一组同级任务就按你排的顺序显示；没拖过的组一切照旧（仍按开始日期、名字、id）。

**待办可以放在任意位置。**〔改动 4〕原来它有一条硬规则：同级里永远沉底，连拖上去都会弹回来。

**单步撤销。**〔改动 6〕底部一条 `已移动 C [撤销]`，十秒后自己消失。

**任务一旦有了子任务，属于「算出来的」那几个字段就都置灰**：开始日、结束日、「不用写日志」开关。

**父任务上不再有「批量填子任务日志」。** 「写日志」按钮还在，点了写的就是它自己那一条。上面那张「今日待填」清单留着，而且每一条的**名字变成可以点** —— 点它就打开那条子任务的详情面板。

**同名任务会自己带上父级路径**，只在**真的会撞名**的时候。

## 数据与逻辑

### 1. `Task.order?: number`

新字段，可缺省。`normalize` 里加一句 `Number.isFinite` 校验，旧数据和手改的导入文件自然落到 `undefined`，不需要迁移。

`buildChildrenMap` 里那个内联的 `cmp` 提出来导出成 `compareSiblings(a, b)`：

```ts
export function compareSiblings(a: Task, b: Task): number {
  return (
    byOrder(a, b) ||
    (a.isTodo ? 1 : 0) - (b.isTodo ? 1 : 0) ||
    (a.startDate ?? '').localeCompare(b.startDate ?? '') ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  )
}
```

两处细节：

- **`byOrder` 排在「是不是待办」前面**〔改动 4〕：两个键原先的先后是反的，于是把一个待办拖到两条任务中间，它弹回底部 —— 手排的结果根本读不到。
- **别写成 `(a.order ?? Infinity) - (b.order ?? Infinity)`**：两个 `undefined` 相减是 `NaN`，`Array.sort` 在 `NaN` 比较器下的行为是实现相关的。`byOrder` 是「两边都有序才比大小，否则返回 0」。

**`compareSiblings` 导出后给三个地方用**，此前是三份互不相同的副本：`buildChildrenMap`、`buildRows` 里 roots 那个比较器（变成 `pa - pb || compareSiblings(a, b)`）、以及 `ManagePage.tsx` 的 `filtered.sort(...)`（它少了 `id` 决胜键，加了 `order` 之后会和甘特图排出两个不同的顺序）。

### 2. `placeTasks(tasks, ids, parentId, beforeId, projectId)` —— 纯函数

拖拽的唯一落点，同时被实时预览和提交调用。返回 `Task[] | null`（不可能时 null）。

1. 从 `ids` 里剔掉「本身是另一个被拖任务子孙」的项。
2. 守卫：`parentId` 不能是被拖任务本身或它的子孙（循环），也不能是待办。
3. 取目标父节点的整份同级列表（`compareSiblings` 的顺序），踢掉被移动的，把移动的作为一个连续块插到 `beforeId` 前面（`beforeId` 为 null 则追加到末尾），然后给**整组**写 `order: 0..n-1`。
4. 移动的子树里每个任务改 `parentId`，并统一改 `projectId` 为传入的那个。
5. 不写 `updatedAt`（预览也走这条路）。

`addTask` 补一句：目标同级组里已经有人有 `order` 时，新任务的 `order` 取该组最大值 +1。

### 3. 项目行

`Row` 加第三个成员 `RowProject`，键是 `project:${id}`，与任务共用同一个 `expanded` map。`buildRows` 按 `projects` 的顺序遍历，项目下没有可见根任务就跳过，否则推一个项目行、再 `visit` 它的根任务（**depth 仍然是 0**）和根待办组；最后追加 `projectId` 不在 `projects` 里的孤儿根任务。`collapseAll` 里补一句把每个项目行也置 false。

行高统一走 `heightOf(row)`：项目行取 `ROW_HEIGHT[2]`，其余照旧。项目行的颜色是**项目色**，不是状态信号色。

**待办文件夹的键带上项目**：`todogroup:${parentId ?? 'root'}:${projectId}`，`todoGroupIds(tasks)` 按 `(parentId, projectId)` 计数。〔改动 5〕计数仍按**总数**而不是按下面第 7 节说的「段」来数，也就是故意比实际画出来的文件夹多一些 —— 多出来的 key 没人读，少一个才会让「全部折叠」合不上一个开着的文件夹。

### 4. 拖拽用 Pointer Events，不用 HTML5 DnD

跟 `gantt/TaskBar.tsx` 同一套写法：`setPointerCapture` + `onPointerMove/onPointerUp`。两个理由：Tauri 在 Windows 上 `dragDropEnabled` 默认为 true，会截掉 webview 里的 HTML5 拖放事件；而这套写法这个仓库已经在用。

**落点判定用算术，不用 `elementFromPoint`。**〔改动 3〕获批稿打算给每行加 `data-idx`、拖动时拿 `document.elementFromPoint(x, y)?.closest('[data-idx]')` 定位行号 —— 实测**不可行**：预览会把行挪到指针下面，再去问文档「指针下面是哪一行」，得到的正是预览刚刚放过去的那一行，于是它再挪一次；指针不动，列表在两个排列之间来回跳。

改成从**按下那一刻**的行几何算：`scrollTop` + 逐行高度累加 + 表头高度。答案只取决于指针在哪，预览就能自由重排。代价是那点算术，而它是每次指针移动付一次，不是每帧渲染付一次。

`onPointerDown` 里遇到 `e.target.closest('button')` 直接返回；真拖动过之后的 `click` 用 `suppressClickRef` 吃掉（`TaskBar.tsx` 已有这个模式）。**拖动开始时还要 `e.preventDefault()`**〔改动 11〕：不加的话，往下拖会沿途选中行里的文字，而且松手之后还留着。

### 5. 父任务日期跟着子任务走

`syncParentEnds` 扩成 **`syncParentDates`**：对有子任务的阶段任务同时写回 `startDate = eff.start` 和 `endDate = eff.end`。守卫不变：`type === 'long-term'`、`isTodo`、没有子任务，三种都跳过。收敛性没问题：写回的值不会反过来改变 `eff`，第二趟就发现没有变化、返回同一个数组引用。

### 6. 父任务的派生字段一律置灰

**规则**：`hasKids && !isLongTerm && 至少有一个非待办子任务` 时，开始日、结束日、「不用写日志」开关全部 disabled + 一行说明。最后那一节不能省：`effectiveStates` 只把**非待办**子任务算进时间跨度，所以一个子任务全是待办的父任务，它的日期其实是它自己的。优先级、类型、名称、说明、标签、项目、父任务一律不锁。

### 7. 待办文件夹按「连续的待办段」分组

〔改动 5〕获批稿写的是「同一父任务下的待办合成一个可折叠分组」。待办可以插在任务中间之后，「全部待办」合成一行就没地方站了 —— 画在前面或后面，都不是它在屏幕上的位置。改成：`buildRows` 按顺序走一个父任务的子节点，把**连续的待办**作为一个单元交给 `visitGroup`；一段里只有一个就是普通行，两个以上才画文件夹。默认那种「待办都在最后」的情况下，一段就是全部，和以前完全一致。

代价：待办被拆散之后那个父任务下就没有文件夹了，连带的批量恢复/删除按钮也不出现；拖回相邻就回来。

### 8. 父任务不再代写子任务日志

删 `LogDialog` 的批量模式：`pending` / `children` 两个 `useMemo`、`batch` 常量与 `picked` 状态、以及 `save` 里「还剩几条 → 关窗还是留着」那段分支。删完 `save` 就是「`addLog` 然后 `onClose()`」。

**`dayTasks.ts` 不动**：`pendingLogsUnder` 和 `hasStrictLeafUnder` 仍有调用方，而且它们和 `strictLogRate` 共用同一套判定 —— 「今日待填」清单和日志环上那个数字永远对得上。

`TaskDetailPanel` 改三处：清单注释（不再是「在上面的弹窗里一条条走」）、每行的名字变成按钮（`setSelected(p.id)`）、以及滚动容器加 ref，`taskId` 一变就滚回顶部。

### 9. 同名任务的区分

新增 `nameQualifiers(rows, tasks): Map<string, string[]>`：限定符是祖先名字链，**从近到远一级一级加**，直到这一组里没有两行还长得一样为止；判断范围是**这张清单要渲染的全部行**，不是当前展开可见的那些，否则展开/折叠一下限定符就忽有忽无。不撞名的行拿到空数组。

### 10. 选中态的归属

`editing` 与选中的集合 `sel` 都放 `GanttPage`〔改动 7〕—— 获批稿把 `sel` 放在 `GanttChart`（「只有拖动逻辑读它」），现在顶部那条选择栏也要读它，而一个列表不能有两个主人。`GanttChart` 通过 props 拿 `sel` / `onSel`。

### 11. 单步撤销

〔改动 6〕store 里一个 `UndoStep`：

```ts
interface UndoStep {
  message: string        // 已经翻好的话：'已移动 C' / '已暂停 2 个任务'
  patches: { id: string; patch: Partial<Task> }[]
  removedTasks: Task[]
  removedLogs: TaskLog[]
}
```

- `moveTasks` 自己记一份（对比前后两个数组，只挑它写过的那三个字段）。
- 其余全部走 `withUndo(message, run)`〔改动 12〕：把一串普通动作夹在中间，比对 `tasks` / `logs` 数组前后的差异 —— 先按对象身份跳过没被碰过的行，再逐字段记下变化前的值。改不动的行（被删掉的）整个存下来，连日志一起。
- `undoLast()` 把补丁合并回去、把删掉的行加回数组尾部。
- **刻意不是快照**：快照会把这段时间里别的东西一起还原 —— 对拖拽来说就是复活一条已被删掉的任务。

## 要改的文件

| 文件 | 改什么 |
|---|---|
| `src/types.ts` | `Task.order?: number` |
| `src/lib/tree.ts` | 导出 `compareSiblings`、`RowProject`、`buildRows` 按项目分段、`todoGroupId` 带项目、`syncParentEnds` → `syncParentDates`、`placeTasks`、`nameQualifiers` |
| `src/store/useStore.ts` | `moveTasks` 改写、`withUndo` / `lastUndo` / `undoLast` / `clearUndo`、`addTask` 追加序号、`collapseAll` 带上项目行 |
| `src/store/storage.ts` | `normalize` 校验 `order` |
| `src/pages/GanttPage.tsx` | `editing` 与 `sel`、工具栏按钮与小标签、选择栏、批量四个动作、撤销条、`Esc` 分层 |
| `src/pages/ManagePage.tsx` | 那个 `filtered.sort` 换成 `compareSiblings` + projects 下标 |
| `src/components/gantt/GanttChart.tsx` | 拖动引擎、几何落点、实时预览、FLIP、编辑模式指针 |
| `src/components/gantt/RowLeft.tsx` | 项目行组件、圆圈、多选高亮 |
| `src/components/gantt/ContextMenu.tsx` | 设为待办 / 暂停任务 / 恢复 |
| `src/components/TaskDialog.tsx` | 第 6 节那张表的置灰 |
| `src/components/LogDialog.tsx` | 删掉批量模式 |
| `src/components/TaskDetailPanel.tsx` | 清单注释 + 名字可点 + 换任务时滚动回顶 + 名字走 `nameQualifiers` |
| `src/components/DayBoard.tsx` | 名字走 `nameQualifiers`，`title` 换成完整路径 |
| `src/lib/i18n.ts` | 新增 key × 3 语言 |

新增 i18n key：`gantt.manageTasks`（en 用 "Organize"，避开已有的 `nav.manage`）、`gantt.editDone`、`gantt.editMode`、`gantt.dragMany`、`gantt.moved`、`gantt.undo`、`gantt.undoTodo/Pause/Resume/Delete`、`gantt.selected`、`gantt.clearSelection`、`gantt.setTodoMany(+WithSubtasks)`、`gantt.deleteSelected(+WithSubtasks)`、`task.startDateLocked`、`common.listSeparator`、`common.pathSeparator`。移除 `gantt.drop*` 系列和 `log.saveNext`。

## 明确不做

- **不做「新建文件夹」。** 要造一个新的分组，还是用「新建任务」建一个任务再把东西拖进去 —— 装进去的那一刻它就成了文件夹。
- **不做行内改名。**
- **不做项目行本身的拖动排序。**（获批稿如此，实现也如此；要按拖拽调项目顺序的话，落点机器已经在了，补一个 store 动作就行。）
- ~~**不做撤销。**~~ 〔改动 6〕获批稿写的是「为一个拖拽单做一套历史栈不成比例，拖错了再拖回去」。用户在原方案落地后要求加，做成的是**单步** —— 覆盖拖拽与批量编辑，仍然没有历史栈。原判断有一半是对的：**栈**不成比例，**一步**不是。
- **不引入「文件夹类型」。** 文件夹是一个普通阶段任务被当容器用。

## 验证

仓库里没有任何测试框架（`package.json` 只有 `vite` / `tsc`），不为这个引一套。类型不变量交给 `npm run build`（`tsc --noEmit`）。

**〔改动 13〕除此之外还做了两件事**，都比获批稿里那套手点清单更硬：

- **新增 `scripts/check-task-tree.mjs`**（与仓库既有的十个 check 脚本同一套写法：Vite `ssrLoadModule` 直接加载 TS 源码 + `node:assert/strict`）。盯的是那些**坏起来看不见**的地方：排序键的回退、`moveTasks` 一次写下的四件事（父、项目、位置、整组重编号）、子树随行、项目随子树、父任务两端日期、撤销的每一步（包括「不复活中途被删的任务」）、`placeTasks` 的纯度、`nameQualifiers` 的碰撞解消与环。`check-todo-folder.mjs` 同时补了项目行与「按段分组」的几种形态。
- **真的在浏览器里拖了一遍**（无头 Edge + npx 缓存里的 Playwright，临时脚本用完即删）：预览与落盘结果逐字一致、`order` 落盘且刷新还在、撤销精确回位、落点规则（上/下/中间/项目行/夹在两段之间的文件夹行）逐一走过、`prefers-reduced-motion` 下动画退化成直接落位、往下拖不再选中文本。

## 获批之后的修订

1. **`qualifyNames` → `nameQualifiers`**；`syncParentEnds` → `syncParentDates`。名字对齐实现。
2. **实时预览换了形态。**〔改动 2〕获批稿是「落点画一条横线 / 整行高亮」+ 一段说明文字（`gantt.drop*` 系列 key）。用户要求：**仅移动顺序时就在拖动中实时重排**、并且要动画（「类似手机桌面拖拽调整应用位置和组成文件夹」），同时**去掉那段文字说明、只留被拖的是什么**。于是落点标记整个删掉，改成 FLIP 重排 + 跟手的 pill。
3. **落点判定从 `elementFromPoint` 换成几何累加。**〔改动 3〕原因见第 4 节：它会自我反馈，指针不动而列表来回跳。
4. **待办沉底这条规则被取消。**〔改动 4〕获批稿把它留在排序键最前面（「未排期的工作就该在已排期之后」）。用户反馈「拖起来太麻烦」—— 一个待办永远拖不到任务中间。改成**手排优先、没排过序的组仍然沉底**。
5. **待办文件夹改成按「段」。**〔改动 5〕第 4 条的直接后果：待办可以插在任务中间，「全部待办合成一行」就没地方站了。
6. **加了单步撤销。**〔改动 6〕获批稿明确不做。用户在原方案落地后提：「拖完之后因为有父子任务关系所以很多东西会重新计算，这个时候如果不小心拖错了很难修正」。做成**一步**（拖拽或一次批量操作），十秒后消失，没有历史栈 —— 原方案说的「不成比例」对栈成立，对一步不成立。
7. **加了圆圈多选与顶部选择栏。**〔改动 7〕获批稿的多选是 `Ctrl` / `Shift` 点击，没有可见的勾选控件。用户看到编辑模式之后提：「点击管理任务之后所有任务名左侧应该出现圆圈，就像所有软件的『管理』功能设计的那样，可以不按 ctrl 进行多选，然后在一个统一的入口进行操作」。同时也是他在同一轮里指出的缺口 —— **「设为待办」在这之前只活在详情面板里**，甘特图的右键菜单根本没有入口，于是右键菜单补了三个（设为待办 / 暂停任务 / 恢复）。
   - 顺带的两个决定：**编辑模式下点行不再打开详情面板**（用户在两个方案里选了这个），**待办行右边那个方块勾选与文件夹行的全选框收起来**（一行上摆两套选择器没法解释）〔改动 10〕。
   - 选择栏的位置用户也推翻过一次：先说「放在一个统一的入口」，我打算放底部（和撤销条同一个位置），他改成**顶部** —— 「正常设计不都是放在上面吗」。最终是**顶掉工具栏**而不是在它下面加一条：同样 48px，页面不跳。
8. **批量编辑与右键菜单也进了撤销。**〔改动 12〕第 6 条只提了拖拽。做法不是让四个 action 各写一份记录，而是 `withUndo(message, run)` 对比数组差异 —— 一份账管住四种。**删除是唯一的例外**：行已经不在盘上，「打补丁」无处可打，所以整个存下来，连同日志（`deleteTask` 会连日志一起删）。详情面板里那三个按钮**不记**：它是阅读面，而且在今天、日历页上也在，那些页面没有这条带子。
9. **新增 `check-task-tree.mjs` + 用无头浏览器实际拖了一遍。**〔改动 13〕获批稿的验证一节是一条条手点的清单，还留着「新建文件夹」那种已经砍掉的场景。
10. **项目行两处「铺到哪儿」的改动。**
    - **时间轴上不画任何东西。**获批稿写的是「同一条高度上一条极淡的项目色带」。实现时没画：那是一条分组之间的分界线，标记它的颜色已经在同一行的左半边（左栏的横带）了，右边再来一条会被读成一条任务条。
    - **横线跑到任务栏右端。**获批稿说的是「铺到列尾」，而它写的第一版是「名字那一格剩下的宽度」—— 于是线在进度列之前就断了。用户要求「延伸到任务栏右端一定位置处」：现在它从名字一直跑到右端留 12px 的地方，穿过那三个空格子（它们只是替其它行占住列宽），停的地方离分割条一小段，不然会被读成面板的边框而不是行内的分割线。同时底色从 14% 提到 18% ——「变实一点点」。
      - **并且名字压过线。**加长之后用户立刻发现名字仍被截：那一格还挂着 `max-w-[45%]`，于是名字在 45% 处收成省略号、而线独占后面一大截。现在名字那格是 `flex-initial`（按内容要宽、不参与分配空余），线吃剩下的；只有名字真的长到占满整行时才截断，那时线退成 `min-w-2` 的残段。一条为了好看的分割线不该让这一行唯一表达「这是哪一组」的文字让位。

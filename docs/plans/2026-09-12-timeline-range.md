# 甘特图日期范围规则 + seed 数据与历史 log

## Context

现在甘特图的时间轴没有边界：`buildTimeline` 生成的是**和画布等宽的一屏窗口**（`count = ceil(canvasWidth / colWidth)` 列，起点是 anchor 往前 `lead` 列），`goPrev`/`goNext` 靠移动 anchor 让窗口无限滑动。既能滑到远古，也能滑到永远。

改成固定范围：**最早 `今天−30天`，最晚 `max(今天+30天, 该范围内最后一个非长期任务的截止日 + 10天)`，下限于 60 天**。范围**跟随甘特图左上角的项目筛选**变化（已确认接受切换项目时滚动位置被夹断）。翻页按钮 ← → 去掉，只保留 Today（滚回今天）。

同时调整 seed 数据以契合新范围，并补写过往日期的 log，让 Logs 页与日期详情面板有足够历史可看。

## 一、范围计算（`src/lib/timeline.ts`）

新增纯函数，输出**已按当前粒度对齐**的区间：

```ts
export function timelineRange(mode: ViewMode, tasks: Task[], todayISO: string, canvasWidth: number): { start: Date; end: Date }
```

三步：

**1. 数据范围。** 参与计算的任务集：`!isTodo && type !== 'long-term' && endDate != null`（长期目标无截止日，to-do 无日期）。

- `rawStart = 今天 − 30 天`
- `rawEnd = max(今天 + 30 天, 最后一个截止日 + 10 天)`

**2. 粗粒度的对称下限（非 day）。** `day` 粒度下数据范围本身就有 130 天 = 5200px，远超画布，不需要下限；其余粒度列太宽会把时间轴缩成一小条，所以要一个以今天为中心的下限：

```
fillColumns = ceil(canvasWidth / colWidth)     // 铺满画布所需列数
side        = ceil(fillColumns / 2) + 5        // 每侧单位数，+5 是余量
rawStart = min(rawStart, 今天 − side 个 unit)
rawEnd   = max(rawEnd,   今天 + side 个 unit)
```

1730px 画布（1920 窗口 − 190 侧边栏）下的实际取值：

| 粒度 | 列宽 | fillColumns | side | 下限跨度 |
|---|---|---|---|---|
| week | 56px | 31 | 16+5 = 21 | ±21 周 ≈ 294 天 |
| month | 90px | 20 | 10+5 = 15 | ±15 月 ≈ 2.5 年 |
| quarter | 80px | 22 | 11+5 = 16 | ±16 季 = 8 年 |
| year | 200px | 9 | 5+5 = 10 | ±10 年 = 20 年 |

**3. 兜底：跨度不窄于画布。** 若取完并集、向外取整后总跨度仍不足 `fillColumns` 列，把 `rawEnd` 往右补足。这条主要保护 `day` 粒度在超宽屏（如 3440px 宽，画布 3250px，60 天只有 2400px）下不会缩在左边。

最后按 `mode` 的 unit **向外取整**：起点用既有的 `startOfDay` / `startOfWeek` / `startOfMonth` / `startOfQuarter` / `startOfYear`（[dates.ts:28-63](src/lib/dates.ts#L28-L63)），终点在取整后的起点上逐 unit 递进。向外取整只会让跨度变大，60 天下限天然成立。

`buildTimeline` 签名改为 `buildTimeline(mode, range, canvasWidth)`，列数直接由 range 推出。

每个 date 的 x 仍由 `dateToX`（[timeline.ts:147](src/lib/timeline.ts#L147)）算出，只依赖 `start`/`colWidth`/`unit`——所以切换项目筛选时**任务条位置完全不动**，只有右端长度变。

删除：`rangeStart()`、`lead`、`ANCHOR_OFFSET_PX`（改名为 `FOCUS_OFFSET_PX` 另作他用）、`shiftAnchor()`、`periodLabel()`。新增 `rangeLabel(range)` 给工具栏用。

初始滚动位置**不变**（今天停在左侧面板右边 160px 处），所以粗粒度下算出来的那半个历史区间要往左滚才看得到。

## 二、状态与滚动（`src/store/useStore.ts`、`GanttChart.tsx`）

- 删除 `anchorISO` / `goPrev` / `goNext`，新增 `focusISO: string`（初值 `todayISO()`）与 `focusTick: number`（初值 0）。
- `goToday` 改为 `set(s => ({ focusISO: todayISO(), focusTick: s.focusTick + 1 }))`。
- 新增 `useTimelineRange(mode)` 钩子，紧挨 `useRows()`（[useStore.ts:401](src/store/useStore.ts#L401)）放：订阅 `tasks` / `projectFilter` / `today`，套用和 `useRows` 同一行筛选后调 `timelineRange`。

**筛选要基于完整任务集，不能复用 `useRows()` 的返回值**——`buildRows` 会受 `expanded` 影响，用 rows 会让范围随折叠状态乱变。

`GanttChart` 里的滚动定位（替换现有的 anchor 机制）：

```
scrollLeft = max(0, dateToX(today) − FOCUS_OFFSET_PX)
```

这个值**与 `leftWidth` 无关**（左侧任务面板是 `sticky left-0`，今天出现在视口中的位置推出 scrollLeft 时 leftWidth 被消掉），所以拖分隔条不会影响它。

触发时机用一个 `pendingFocus` ref：初值 `true`（首次渲染滚到今天），`focusTick` 变化时置 `true`，在 `timeline` 重建的 effect 里消费掉。这样切换项目筛选导致 timeline 重建时**不会**抢走用户的滚动位置——浏览器自行把越界的 `scrollLeft` 夹回新范围内，即已确认接受的"弹回"。

## 三、工具栏（`src/pages/GanttPage.tsx`）

- 删掉 ← 和 → 两个按钮，保留 Today。
- 原来 `periodLabel(viewMode, anchorISO)` 的位置改显示 `rangeLabel(range)`，形如 `Aug 13 – Dec 21`；`GanttPage` 通过同一个 `useTimelineRange(viewMode)` 拿到范围。

## 四、seed 数据（`src/lib/seed.ts`）

现有非长期任务的最晚截止是 `pe-goal-robot` 的 **+90**（它虽是长期目标 `pe-goal` 的子任务，但自身是 phase 类型），所以 All 视图下 `rawEnd = 今天+100`，范围 130 天。

改动保持文件顶部说明的那些演示场景（已完成的、暂停的、严格但 0% 的、to-do、缺 log 的）不变，只做两类增补：

1. **让左端有内容。** 现在 −30..−20 只有 `co-python` 和 `pe-read` 两个任务，新的左边界（今天−30）附近太空。把 `team-mech` 起点提前到 −28 左右，并在 −30..−12 区间补 2–3 个任务。
2. **补历史 log。** 关键约束：现有的严格任务（`stm-can` 起点 −2、`stm-pid` −2、`stm-motor-test` 0、`team-vision` 0、`fr-u5` −7）**几乎都不覆盖 −30..−8 这段窗口**，没有可挂 log 的任务。所以先加一个覆盖早期窗口的严格任务（例如 `fr-u4`，`Unité 4`，−30..−8，`strict: true`），再围绕它和其它严格任务写 **约 18 条 log**，铺在 −28..−1 之间。

补 log 的规则：

- 内容沿用现有风格（`-` 项目符号、`\t` 表子项，见 [seed.ts:100-136](src/lib/seed.ts#L100-L136)）。
- 每个严格任务的 `targetProgress` 随日期递增，保持"越晚越高"的一致叙事；非严格任务（如 `fr-anki`）用 `null`。
- **故意留几天不写**，让日历的严格日志覆盖率出现"部分完成"（琥珀色）和"完全没写"两种状态，而不是清一色满格。
- `fr-u5` 保持"从不写 log"，它现在是 0% 的演示案例，也是 `No log` 徽章的样本。

## 验证

1. `npm run build` —— `tsc --noEmit` 零错误。删掉 `anchorISO`/`goPrev`/`goNext`/`periodLabel`/`shiftAnchor` 后靠它查悬空引用。
2. `npm run dev` 打开甘特图：
   - 工具栏只剩 Today，右侧显示范围标签；
   - 首次加载视图停在今天附近，**向左滚动能看到约 30 天的历史**，左端就是 `今天−30`；
   - 点 Today 能滚回今天；拖动左右分隔条后点 Today 仍定位正确；
   - 切到 French 项目，时间轴右端明显缩短（130 天 → 61 天）；切回 All 恢复；期间任务条的 x 位置不变；
   - 切到 `month` / `quarter` / `year` 粒度：时间轴不再被数据范围缩成一小条，且**向左也能滚出一段历史**（对称下限生效）。`year` 下大致是 ±10 年，向左滚动应能看到当前年份之前的若干年。
3. 打开 Logs 页：便利贴数量应显著增多（原来只有 3 个日期）。
4. 打开 Calendar 或点甘特表头日期：过往日期能看到日志覆盖率有满格/部分/缺失三种状态。

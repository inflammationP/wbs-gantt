# 设置页：语言（英 / 中 / 法）与主题

## Context

侧边栏现在只有 Gantt / Logs / Manage / Calendar 四个入口，没有任何应用级配置。本轮新增 **Settings** 页，内置两项：

1. **语言**：界面目前纯英文硬编码 —— 按钮文字、标题、`title=` 悬浮提示、`aria-label`、`confirm()` 文案、以及日期/月份/星期名，散落在 20 个组件与 3 个 `lib/` 模块里，约 **290 条不重复文案**。要支持 English（默认，现状）、中文、Français，**每一条可见文本都要翻，包括悬浮提示**。要求表意准确、无歧义，不接受机翻腔。
2. **主题**：配色目前硬编码在三处（`tailwind.config.js`、`src/lib/ui.ts`、大量内联 hex，其中**强调色一个事实被抄了五遍**）。改成 4 套可选配色：现状保留为默认，另加 3 套风格差异明显的（含一套浅色）。

两条来自代码本身的硬约束：

- 全局只有 `react / react-dom / zustand / lucide-react` 四个依赖 → **不引入 i18n 库**。
- `npm run build` 先跑 `tsc --noEmit` → 把它当成**翻译完整性的强制闸门**：任何一种语言漏一个 key 就编译不过。

已确认的决策：（来自用户）
- 现状配色**保留并作为默认**，另加 2-3 套新配色。取 3 套，共 4 套。
- **包含一套浅色主题**。我先前把浅色列为高成本项，复查后确认成本可控（见 2.3）。
- 任务名、项目名、日志正文属于用户数据，**从不翻译**（`src/lib/seed.ts` 在 main 上保持为空）。

---

## 一、i18n

### 1.1 字典与编译期校验

`src/lib/i18n.ts`（新建，纯模块，**不 import React、不 import store** —— store 已经 import 了 `lib/*`，保持无环）。

```ts
export type Lang = 'en' | 'zh' | 'fr'
export const LANGS: Lang[] = ['en', 'zh', 'fr']
// 语言名用本语言自称，切换器里不需要翻译
export const LANG_LABEL: Record<Lang, string> = { en: 'English', zh: '中文', fr: 'Français' }

const en = {                              // ← 不能加 as const / Object.freeze / satisfies
  'nav.gantt': 'Gantt',
  'task.delete.confirm': 'Delete "{name}"?',
  'log.count': { one: '{count} log', other: '{count} logs' },
  // …
}
export type Dict = typeof en              // key 全集由英文单一来源决定

const zh: Dict = { /* 逐 key 齐全 */ }     // 漏 key ⇒ TS2741；多 key ⇒ TS2353
const fr: Dict = { /* 逐 key 齐全 */ }
```

**这里有个必须写进注释的陷阱**：`en` 上如果加了 `as const`，属性类型会变成字面量类型，于是 `Dict['nav.gantt']` 就是 `'Gantt'`，法语字典必须逐字写出 `'Gantt'` 才能通过——整套设计会静默失效。同理 `const zh: Dict = { ...en, 'x': '…' }` 也会因为展开而绕过检查。规则：**直接赋值的对象字面量、带类型标注、不展开、不套 helper**。

`keyof Dict` 的类型要一路传到调用点，否则等于白做：`useT()` 返回 `(key: keyof Dict, params?) => string`，调用点写错 key 也是编译错误。动态 key 用模板字面量类型（`t(\`status.${status}\`)` 能推出 6 个字面量的联合），仍然是安全的——前提是所有 `status.*` / `type.*` / `priority.*` key 都存在。

### 1.2 复数与插值

现有代码里有 **16 处**手写复数，其中 5 处是 bug（`1 subtasks`、`1 tasks on this day`、`1 days ago`——只有 `=== 1` 分支或完全没有分支）。

- 复数条目写成 `{ one, other }`，用 `Intl.PluralRules(lang).select(count)` 取形，**并且 `?? entry.other` 兜底**：CLDR 给法语加了 `many` 类（大数量级），`select(1000000)` 可能返回 `'many'`，直接索引会渲染出 `undefined`。
- `Intl.PluralRules` 按 lang 记忆化——甘特表头渲染频繁，别每次字符串都构造一个。
- 英语 `1 log / 2 logs`；法语 0 和 1 都算单数（`0 journal / 1 journal / 2 journaux`）——这正是必须上机器而不是手写三元的原因；中文只返回 `other`（`one` 照写一遍同样的字，保持类型完整）。
- 插值用 `{name}` / `{count}` 占位符。

### 1.3 日期：不是替换词，是重新组句

这是 i18n 里最容易被低估的成本。光有月份/星期名表还不够，**词序和分隔符都要换**：

| | en | fr | zh |
|---|---|---|---|
| `formatShort` | `Aug 13` | `13 août` | `8月13日` |
| `formatLong` | `Thu, Aug 13, 2026` | `jeu. 13 août 2026` | `2026年8月13日 周四` |
| 周刻度 | `W34` | `S34` | `34周` |
| 季度刻度 | `Q3` | `T3` | `3季度` |
| 周分组 | `Aug 10 – Aug 16` | `10 – 16 août` | `8月10日 – 8月16日` |
| `rangeLabel` | `Aug 13 – Dec 21, 2026` | `13 août – 21 déc. 2026` | `2026年8月13日 – 12月21日` |
| 相对日 | `2 days ago` | `il y a 2 jours` | `2天前` |

所以 `formatShort(iso, lang)`、`formatLong(date, lang)`、`rangeLabel(range, lang)`、`timeline.ts` 的 `cellLabel` / `groupLabelFor` 都需要**按语言分支**，不是查表。法语缩写按惯例带点（`janv.` `févr.` `juil.` `sept.`），这会影响 `rangeLabel` 里的间距——手写，不要生成。

`groupLabelFor` 里已有的"跨年边界"分支在三种语言下读法都不同，是最琐碎的一处。

**做法**：`src/lib/dates.ts` 里的 `MONTHS` / `MONTHS_SHORT` / `WEEKDAYS` **直接删除**，移进 `i18n.ts`。删除是故意的——它会把每一个 import 点变成编译错误，这就是审计。依赖方向单向：`dates.ts` → `i18n.ts`，反向不行。

### 1.4 需要从模块作用域搬进组件的常量

这些都是渲染时读取的模块级常量，语言切换时**不会更新**，必须搬进组件体内用 `t()` 现算：

| 位置 | 常量 |
|---|---|
| `src/components/Sidebar.tsx:12-17` | `NAV` |
| `src/pages/GanttPage.tsx:22-28` | `VIEW_OPTIONS`（Day/Week/Month/Quarter/Year） |
| `src/pages/CalendarPage.tsx:10` | `WEEKDAY_LABELS`——**周一开头，和 `dates.ts` 里周日开头的 `WEEKDAYS` 是两份重复数组**，只翻一份会漏 |
| `src/lib/ui.ts:16-35` | `STATUS_META[].label`、`PRIORITY_META[].label` |
| `src/lib/ui.ts:52-55` | `TASK_TYPE_LABEL` |
| `src/pages/CalendarPage.tsx:187-195` | `coverageLabel`（同时喂 `aria-label`） |
| `src/components/DayDetailPanel.tsx:15-21` | `relativeDay` |
| `src/components/TaskDetailPanel.tsx:13-17` | `formatDate`（含 `'TBD'`） |

**配套决定**：把 `label` 从 `STATUS_META` / `PRIORITY_META` 里剥掉，只留颜色，改为 `labelKey`；`TASK_TYPE_LABEL` 删除。这样 2.3 的色彩改造和 1.x 的翻译改造不会在同一个对象上打架。

### 1.5 调用点改造模式

```tsx
const t = useT()
<button title={t('task.addSubtask')}>…</button>
confirm(t('project.delete.confirm', { name: p.name }))
```

**跨 JSX 拆散的句子必须合成一条**——中法语的词序扛不住拼接。有 4 处：
`TaskDialog.tsx:182-184`（to-do 说明，5 个片段）、`StartTodoDialog.tsx:115-116`、`DayDetailPanel.tsx:176`（暂停说明，5 个插值）、`CalendarPage.tsx:143`（`title`，4 个片段）。

`useT()` 返回的函数必须**引用稳定**（`useCallback`，依赖 `[lang]`）。这个代码库 `useMemo` 很密，`t` 每次换新身份会连带 churn。反过来，**`lang` 只在真正产出文案的 memo 里加依赖**：`GanttChart.tsx:55` 的 `buildTimeline` memo **必须加**（它产出 `cells[].label` 与 `groups[].label`，不加会看到表头卡在旧语言）；`GanttPage.tsx:52` 的 `useTimelineRange`、`CalendarPage` 的 `rings`/`milestones`、`DayDetailPanel` 的 `summary` 都不产出文案，**不要**加。

### 1.6 已知陷阱

- **`TaskDialog.tsx:130` `content: 'Marked as completed'`** —— 这不是 UI 文案，是**写进 `TaskLog` 的数据**，之后会在 `TaskDetailPanel` / `LogsPage` / `DayLogsModal` 里显示。用 JSX/attribute/confirm 三种方式扫都扫不到它。**决定：按写入时的界面语言翻译**——它和用户自己敲的日志正文同类（用户内容），改语言后历史里出现另一种语言是正常的。在字典注释里写明，免得以后有人"修"它。
- **`RowLeft.tsx:204` 的 `'—'.repeat(row.wbsCells)`** 是排版占位，**不要翻**。
- **`progress`/`status` 之外还有几处 `—` 占位符**（`ui.ts:39`、`ManagePage.tsx:219/221` 等），统一用一个 `common.none` key。
- 文案长度：改中/法文后侧边栏（190px 固定宽）和 `ManagePage` 的 8 列表头最容易溢出，要专门看。

---

## 二、主题

### 2.1 机制

`tailwind.config.js` 的 11 个 hex 改成引用 CSS 变量：

```js
colors: { bg: 'rgb(var(--c-bg) / <alpha-value>)', /* … */ }
```

`<alpha-value>` 是关键：代码里有 **28 处**透明度修饰（`bg-panel2/50`、`text-fg/90`、`bg-accent/[0.07]`、`ring-accent`、`border-accent/60`……），变量必须存成 `R G B` 三元组，Tailwind 才拼得出 `rgb(R G B / 0.1)`。任意值形式 `bg-accent/[0.07]` 同样成立。

**默认配色写进 `src/index.css` 的 `:root`**，而不是只靠 JS 注入。原因不是"闪一下"而是更糟：`body { @apply bg-bg }` 会生成 `background-color: rgb(var(--c-bg) / 1)`，若此刻 `--c-bg` 未定义，`var()` 无兜底会让整条声明在计算值阶段失效，回落到 `transparent`——浅色 WebView 里就是一帧白屏，而如果注入没跑成就是永久的。`:root` 里放上现状的精确 hex 之后，正确外观从第一帧就存在，`applyTheme` 退化成"非默认主题的覆盖"。

`src/lib/themes.ts`（新建）持唯一色值真源：`ThemeId`、`Palette`、`THEMES`、`THEME_ORDER`、`applyTheme(id)`。`applyTheme` 写成 `document.documentElement.style.setProperty(...)`，同时设置 `color-scheme`（见 2.3）与 `document.documentElement.lang`。

**在 `setTheme` 这个 action 里调 `applyTheme`，不要放 `useEffect`**——effect 会走"渲染→绘制→再改样式"，每次切换都有一帧滞后。同理 `savePrefs()` 也直接写在 `setLang` / `setTheme` 里，不新增订阅。

**另一个顺带要修的**：`src/index.css` 从没声明过 `color-scheme`。Chromium 不会从 `background-color` 反推，所以今天 WebView2 里的 `<input type="date">`、`<select>`、复选框原生滚动条**全是浅色的**——近黑面板上弹出浅色日期选择器。主题功能会把这个问题放到聚光灯下，加 `color-scheme` 顺手解决。

### 2.2 四套配色

现状保留为默认，另加 3 套。命名沿用同一种构词法：**单个名词，四种都是"材料"**——石墨、玄武岩、赤铜都是矿物/金属，纸张是它们的对面（石墨画在纸上）。三种语言都用各自的自称名词。

四套在**四个维度**上同时拉开，而不是只换强调色（只换强调色的话，五套读起来就是"同一套主题配五个按钮"）：

| | 底面明度 | 表面对比度 | 中性色温 | 强调色 |
|---|---|---|---|---|
| **Graphite** 石墨 / Graphite ← 默认 | 中深 | 中 | 中性 | 青 `#46b8e6` |
| **Basalt** 玄武岩 / Basalte | 最深 | **低**（久看不累） | 冷 | 钢蓝 `#7c9ede` |
| **Copper** 赤铜 / Cuivre | 中深 | **高**（分隔清楚） | 暖 | 赤铜 `#cf8552` |
| **Paper** 纸张 / Papier | 浅 | 高 | 暖（米白） | 墨蓝 `#1f6feb` |

每套配一句短说明（`theme.<id>.hint`），三语都有。

`Paper` 需要额外的 `on-accent` token：现在是 **10 处 `bg-accent text-black`**，浅色主题下强调色是深墨蓝，必须改用 `text-on-accent`（深色主题 `#000`，Paper `#fff`）。

### 2.3 语义色也要跟主题走（浅色主题的前提）

原方案想"只改外壳、语义色恒定"，这样能保住用户已学会的颜色语言。但浅色主题会立刻撞墙：这些语义色是按深色底调的，当正文用放白底上对比度不足——`RowLeft` 的状态列与 `ManagePage` 表格正是拿它们当文字（琥珀 `#e3b341` 在 `#fff` 上约 1.9:1，绿 `#3fb950` 约 2.5:1）。

**做法**：语义色也变成每套主题的 CSS 变量，沿用 `STATUS_META` 已有的 `{color, dim, text}` 三态结构：

```
--c-todo / -dim / -text          紫
--c-notstarted / -dim / -text    灰
--c-progress / -dim / -text      琥珀（同时驱动 today）
--c-completed / -dim / -text     绿
--c-paused / -dim / -text        蓝
--c-delayed / -dim / -text       红
```

对应的 Tailwind key 就是 `completed` / `completed-dim` / `completed-text`，调用点写成 `bg-completed-dim`、`text-completed-text`、`border-completed/30`。`dim` 也可以直接用透明度修饰（`bg-completed/15`），但保留 `-dim` key 更贴近现有代码的写法。

**三套深色主题写同一组值**（沿用现状，语义不变），`Paper` 另配一套浅色 ramp。三套共用一份 `DARK_SIGNALS` 常量、浅色一份 `LIGHT_SIGNALS`，避免抄三遍。

**副作用是好的**：这一步顺带修掉一处既有隐患——`#f85149` 作为裸字面量出现在 **8 个文件**里，同时 `STATUS_META.delayed.color` 也是它；`#3fb950`、`#e3b341` 同理，而 `CalendarPage.tsx:169-180` 里的绿甚至写成 `rgba(63,185,80,…)`，十六进制搜索根本搜不到。集中之后这套颜色不会再各自漂移。

**色值在 JS 侧的使用**（约 5 处，全部可枚举）：
- `TaskBar.tsx:141` 长期目标渐变 `hexToRgba(meta.color, 0.3)` → 用现成的 `dim` token，`linear-gradient(to right, var(--c-…), var(--c-…-dim))`
- `ProgressRing.tsx:41,49` 的 `stroke={…}` **必须改成 `style={{ stroke: … }}`**——SVG 的呈现属性按 `<paint>` 语法解析，**不接受 `var()`**；走 CSS 级联才行。这是本次唯一的技术卡点，实现时先验证。
- `DayDetailPanel.tsx:64-65` 圆环的 `fill`/`track`
- `RowLeft.tsx:134` to-do 虚线描边 `hexToRgba(TODO_COLOR, 0.55)`
- `CalendarPage.tsx:169-180` 的 `boxShadow` 与 `PIP_*` 内联样式

其余 `style={{ background: meta.color }}`（约 15 处）把字符串换成 `'var(--c-…)'` 即可，React 原样透传给 CSS，级联自己重算，**不需要重渲染**。所以 `usePalette()` 几乎不需要——设计成零消费者，能省则省。

**如果确实要 `usePalette()`**：写成 `const id = useStore(s => s.theme); return THEMES[id]`。**绝不能**写成 `useStore(s => ({ ...THEMES[s.theme] }))`——zustand v4 默认 `Object.is` 比较，每次返回新对象会直接无限重渲染，表现为页面卡死而不是颜色不对。

### 2.4 选中日竖线改为中性色

`GanttChart.tsx:163` 的今日线是 `#e3b341`，`:172` 的选中日线是强调色。**两条都是贯穿全高的 1px 竖线，同一块画布，只靠色相区分**。换到 Copper（赤铜 25° vs 琥珀 43°）两条线几乎分不开，红色盲下完全合并。

**改法**：选中日线不再用强调色，改成中性标记（`bg-fg/40`，或虚线）。这样"强调色"在整个应用里永远不会和语义色是**同一种标记形态**，这一类混淆整体消失——这也是后面能放心用赤铜做强调色的前提。

顺带：`RowLeft.tsx:193` 的 to-do 文件夹底色是 `bg-accent/[0.07]`，在 Nebula 那类配色下会变成粉色底、里面却躺着紫色（`TODO_COLOR`）的图标与名字。改用 `TODO_COLOR` 派生底色，文件夹的身份永远是紫的。

### 2.5 需要替换的硬编码颜色

**必须改（否则换主题后不对）**

| 位置 | 现状 | 改为 |
|---|---|---|
| `src/index.css:20,27,30,31,35,38` | 滚动条 `#2a333d` / `#0a0d10` / `#3a4550` | 三个 token：`--c-scroll`（拇指）、`--c-scroll-hover`、底色复用 `--c-bg` |
| `src/index.css:42` | `::selection rgba(70,184,230,.25)` | `rgb(var(--c-accent) / .25)` |
| `src/lib/ui.ts:14` | `ACCENT_COLOR = '#46b8e6'`（自己的注释承认是在镜像 token） | 删除，走变量 |
| `src/components/gantt/GanttChart.tsx:172` | 选中日线 `#46b8e6` | 见 2.4，改中性 |
| `src/components/DayDetailPanel.tsx:56,60` | 圆环轨道 `#242c35`——**这就是 `border` token 本身被手抄了一遍** | `rgb(var(--c-border))` |
| `src/components/TaskDialog.tsx:213`、`StartTodoDialog.tsx:135` | `accent-[#46b8e6]` | `accent-accent`（Tailwind 的 `accentColor` 由 `colors` 派生；若未生成则退回 `accent-[rgb(var(--c-accent))]`） |
| `tailwind.config.js:7-17` | 11 个 hex | 变量 |

强调色这一个事实原先被抄了 5 遍（tailwind config、`ui.ts`、两个 `accent-[…]`、`::selection`、`GanttChart` 内联），合并成一个 `--c-accent` 是这次改造收益最高的部分。

**改为 fg 相对（4 处，纯白洗色在暖色/浅色主题下会发脏）**

`TimelineHeader.tsx:28` `rgba(255,255,255,0.02)` → `bg-fg/[0.02]`；`:32` `hover:bg-white/5`、`:46` `hover:bg-white/10` → `bg-fg/5` `/10`；`GridBackground.tsx:25` 同。

**保持字面量（语义色，2.3 之后走变量但值不变）**

`TaskBar.tsx:165,225` 的 `textShadow: '0 1px 2px rgba(0,0,0,0.7)'` 画在语义色任务条上——但它需要一个每主题的值（浅色主题下深色文字配深色阴影会糊），所以做成 `--c-bar-shadow` token，深色三套 `rgba(0,0,0,0.7)`、Paper 透明。

`ui.tsx:21` 的 `bg-black/60` 模态遮罩保持不变（浅色下深遮罩是标准做法）。

### 2.6 预览卡片要给缩略图，不是色点

主题卡片若只画一个强调色圆点配中性卡面，四套深色会看起来一模一样。**卡片要画一个小号的真应用**：`bg` 底条 + `panel2` 卡片 + `border` 分隔线 + 三档文字色 + 一个强调色实心按钮。四张缩略图长得像不像，就是四套主题差异够不够的判据——在设计阶段就能看出来，而不是发版之后。

---

## 三、设置页、导航与持久化

- `src/types.ts`：`AppView` 增加 `'settings'`。
- `src/components/Sidebar.tsx`：`NAV` 增加 `{ id: 'settings', icon: Settings }`（lucide 0.451 有 `Settings`），排在 Calendar 之后。
- `src/App.tsx`：`{view === 'settings' && <SettingsPage />}`。
- `src/pages/SettingsPage.tsx`（新建）：沿用 `ManagePage` 的版式外壳（`flex-1 overflow-auto` → `max-w-6xl mx-auto p-6 space-y-6` → `text-[18px] font-semibold text-fg`）。
  - **Language**：三张卡片，各显示本语言自称 + 一行**该语言的日期样例**（`Sept 13, 2026` / `2026年9月13日` / `13 sept. 2026`）作即时预览。
  - **Theme**：四张卡片，2.6 的缩略图 + 名称 + 一句说明。
  - 均为**即时生效**，无保存按钮——与全应用"改了就是改了"的交互一致。

**持久化**：`wbs-gantt.prefs` **独立 key**，绝不混进 `PersistedData`。

理由具体：`parseImport` 返回 `PersistedData`，`importData` 直接 `set({ projects, tasks, logs })`——如果 lang/theme 在里面，**导入一份数据文件会静默重置用户的主题与语言**；导出的 JSON 也不该带界面偏好。`storage.ts` 加 `loadPrefs` / `savePrefs`，`PersistedData`、`exportJson`、`parseImport` 一律不动。

**`applyTheme` / `document.documentElement.lang` 在 action 里调**（见 2.1）。

---

## 四、附带修掉的问题

写在计划里是因为它们在同一批文件里，且不修会让 i18n 显得没做完：

1. **原生对话框的按钮跟系统语言走**。6 处 `confirm()` / `alert()` / `prompt()` 里，正文能翻，但按钮（OK/Cancel、确定/取消）由**操作系统**渲染——中文 Windows + 法语界面 = 法语正文配中文按钮。加一个基于现有 `Modal` 的 `ConfirmDialog` / `PromptDialog`（约 60 行）换掉这 6 处。**这一项超出字面需求，你可以否掉**，但不做的话 i18n 故事不完整。
2. `src/components/ui.tsx:32` 模态关闭按钮**既无 `title` 也无 `aria-label`**，对读屏软件不可见。反正要做 aria 一遍过。
3. `TaskDialog.tsx:199` 那条写死的中文提示（`结束日期由最晚结束的子任务决定…`）。它是本次 i18n 的**验收金丝雀**：如果英文界面下它仍是中文，说明扫描漏了。
4. 5 处"永远复数"的既有 bug（`1 subtasks`、`1 tasks on this day`、`1 days ago`、`1 leaf tasks`、`1 tasks`）——上复数机制后自动消失。

---

## 五、改动清单

**新建（4）**
`src/lib/i18n.ts` · `src/lib/useT.ts` · `src/lib/themes.ts` · `src/pages/SettingsPage.tsx`
（若采纳 4.1，再加 `src/components/ConfirmDialog.tsx`）

**配置**：`tailwind.config.js`、`src/index.css`、`src/types.ts`、`src/App.tsx`、`index.html`（`lang` 改为动态）

**状态**：`src/store/useStore.ts`（lang/theme + action 内持久化）、`src/store/storage.ts`（`loadPrefs`/`savePrefs`）

**纯函数**：`src/lib/dates.ts`（删三个导出）、`src/lib/timeline.ts`、`src/lib/ui.ts`（剥 label）

**组件（19）**：`Sidebar`、`ui.tsx`、`TaskDialog`、`TaskDetailPanel`、`ProjectDialog`、`ProjectDetailPanel`、`DayDetailPanel`、`DayLogsModal`、`LogDialog`、`StartTodoDialog`、`gantt/{GanttChart,RowLeft,TaskBar,TimelineHeader,ContextMenu,GridBackground}`

**页面**：`GanttPage`、`LogsPage`、`ManagePage`、`CalendarPage`

**实施顺序**（每一步都以编译通过为界，让编译器当向导）：
1. 主题机制（零视觉差异）→ **验收：现状像素级不变**，然后把 `--c-accent` 在 devtools 里改成刺眼的颜色走查全站，残留的青色就是漏掉的字面量。
2. 语义色变量化 + 浅色 ramp + 4 套配色。
3. i18n 地基（`i18n.ts` / `useT.ts` / 三个 lib）——先做 lib 再做组件，让 `dates.ts` 的导出删除把调用点全部报出来。
4. 字符串清扫，顺序：`ui.tsx` → 四个页面 → `gantt/` → 面板与弹窗。
5. Settings 页 + 导航 + 持久化。

**注释语言**：代码注释沿用现有全英文风格；`zh` / `fr` 的字典条目是产品文案，不在此列。

---

## 六、验证

1. `npm run build` —— `tsc --noEmit` 通过即证明三语字典 key 齐全、无 typo 的调用点。
2. 主题：先确认**默认主题与 HEAD 像素级一致**（`:root` 里是现状精确 hex，任何偏移都是 token 转错了）。再逐套切换，重点看滚动条、模态遮罩、时间轴表头 hover、任务条文字、圆环轨道、复选框勾选色、原生日期选择器。
3. 语言：切到中文/法文，逐页走查 **Gantt · Logs · Manage · Calendar · Settings**，并**逐个悬浮触发提示**看有没有漏翻的 `title=`；打开全部 7 个弹窗。重点核对：甘特轴刻度与分组标签、日期范围标签、相对日、单复数（`1 log` vs `2 logs`、`0 journal` vs `2 journaux`）、`confirm()` 文案。
4. 反查漏翻：`grep -rnE ">[A-Z][a-z]" src/**/*.tsx`，每个命中都必须能解释成专有名词、单位或品牌串（`WBS·GANTT`）。`TBD` 不算豁免，它应该是 `待定` / `à définir`。
5. 金丝雀：`TaskDialog.tsx:199` 在英文界面下必须是英文。
6. 中/法文字数变长后，专看 `Sidebar`（190px 固定宽）与 `ManagePage` 的 8 列表头是否溢出。
7. 刷新页面确认语言与主题被记住；**导入一份 JSON 确认不会重置语言/主题**。

---

## 七、范围外

- **演示数据**：`src/lib/seed.ts` 在 main 上保持为空（演示数据在 `seed-tutorial` 分支）；任务名/项目名/日志正文是用户数据，从不翻译。
- **原生窗口标题**：`src-tauri/tauri.conf.json:15` 是 `WBS · Gantt`（纯品牌名，无可译文本）。`document.title` 会跟随语言；要改原生标题需要 `@tauri-apps/api`，当前不在依赖里，不值得为此加。
- **不提交**：实现完成、你验证通过并明确要求之后才 commit。

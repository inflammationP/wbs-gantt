# AI 助手 + 课表的 AI 兜底

> 2026-11-06 获批，随 v0.20.0（2026-11-10）实现。正文按最终实现写；与获批稿不同的地方在文末汇总。获批稿的范围是「一个小 harness，不是聊天机器人」——这一条没有变。

## Context

用户在课表导入做到一半时问：应用里能不能放一个小 harness，让用户填自己的 API Key 后替他们做一些简单操作；同时问「接的 API 真的能理解、操作软件吗」。答案决定了实现路径：模型看不见屏幕，只能看见应用发过去的文字和工具清单；真正的操作是「模型返回工具调用 → 应用执行 → 用户确认 → 写入本地数据」。同一轮还要求把课表导入里本地解析不了的部分也交给模型。

## 1. AI 助手

### 最终做成的样子

- **设置 → AI**：DeepSeek Key（password 输入、明文存本机偏好、不进导出文件/日志）、模型、「测试连接」。模型默认 `deepseek-flash`，输入框从 DeepSeek 拉当前账号可用的模型名做成下拉，也可以选「自定义…」手填。测试连接就是一次真实的 chat 请求，失败时显示 DeepSeek 返回的原因。
- **左侧栏「AI 助手」**：对话、工具执行状态、提案卡片（应用 / 取消）、停止、清空；没填 Key 时直接跳设置；发出前说明会外发哪些数据。每次请求最多 6 步工具调用，超时 60 秒。
- **只读工具**：`list_projects`、`search_tasks`、`get_task`、`get_day`、`get_project`。
- **写操作只生成提案**：
  - `propose_task_tree`：从文字或大纲生成项目、阶段、任务（父子、日期、ddl、优先级），确认后批量创建，**一步撤销**。
  - `propose_day_plan`：今日计划 / 休息日 / 恢复自动，确认后 `setDayPlan`；卡片明确提示**计划不可撤销**。
  - 应用后把「已应用 + 结果」作为新消息再问模型一次，模型只做简短讲解和下一步流程。
- **不做**：写日志、删除/归档、任意文件/网络/命令、无人确认的批量修改；这些只讲手动路径。
- **应用手册**（`lib/ai/appGuide.ts`）：页面、任务模型、今日计划、日程表、归档、课表；「做不到时直接说，给最接近的替代，不要编 UI 路径」。任务标题/备注/课表内容都当数据，不当指令。
- **传输**：`lib/ai/deepseek.ts` 是唯一的出口，固定 `https://api.deepseek.com`；桌面端走 Tauri HTTP 插件（capability 放行该域名），浏览器版走 fetch（受 CORS 限制）。

### 实现位置

- `src/lib/ai/`：`types.ts`、`constants.ts`、`deepseek.ts`、`agent.ts`、`tools.ts`、`apply.ts`、`errors.ts`、`appGuide.ts`、`courseParse.ts`。
- `src/components/AiPanel.tsx`、`src/components/AiSettings.tsx`。
- `src/store/useStore.ts`：`aiApiKey` / `aiModel` 偏好与 `setAiConfig`，提案应用的动作。
- `src-tauri/capabilities/default.json`：放行 `https://api.deepseek.com/*`。

## 2. 课表导入的 AI 兜底

### 最终做成的样子

- 设置 → 课表选文件后，「AI 解析」始终可用；发送前确认会把相关工作表发给 DeepSeek。
- 发送内容：工作表名、非空单元格与合并区域（限制 30 张表、80 行、40 列、12 万字符）。
- 模型按实际内容判断版式、周次、日期、时间；不假设示例文件的格式，不发明标准作息或 40 分钟一节课。
- 只有节次没有钟点时，模型返回 `periodStart` / `periodEnd` 与一张节次表；预览里补全每节起止后才允许导入。
- 结果必须过 `readCourses`（存档同一套清洗）才能进入预览；非法行丢弃，本地已解析的周优先保留。
- 解析期间显示「已发送 N 张工作表 — 等待模型返回（Ns）」，并报告重试、校验阶段。

### 实现位置

- `src/lib/ai/courseParse.ts`：工具 schema、提示词、容错解析、节次表。
- `src/components/CourseImport.tsx`：入口、确认、进度、预览与节次时间表。
- `src/lib/courseSheet.ts`、`src/lib/xlsx.ts`：本地解析与 Excel 读取。

## 3. 与获批稿 / 当天实现的差别

1. **强制工具调用被推翻**：获批稿用 `tool_choice` 强制 `submit_sessions`，DeepSeek 思考模式模型直接拒绝（`Thinking mode does not support this tool_choice`）。改成 `auto` + 一次纠正轮，并接受回复正文里的 JSON。
2. **课程解析的输出预算** 4096 → 8192：整份课表的 JSON 放不进 4096，思考模型还要先花一部分预算。
3. **容错解析**：工具参数可能双重编码、被代码块包住或被截断；按「严格 JSON → 拆双重编码 → 从文本里提取」逐层尝试，正文里的 JSON 作为最后兜底，被截断时明确说「请少导入几周」。
4. **进度反馈**：获批稿只有按钮上的「AI 读取中…」，实际补了阶段 + 秒数 + 已发送表数。
5. **节次时间表**：获批稿假设模型能从表里读出时间；实际学校导出的表经常只有「第 1-2 节」。模型不猜时长，预览里补一张节次时间表。
6. **模型设置**：获批稿固定 `deepseek-chat`；用户要求默认改成 `deepseek-flash`，并把模型输入框改成从 `/models` 拉取的下拉 + 自定义项。
7. **课表格式**：获批稿只做 `.xlsx`；后来补了 `.xls/.xlsm/.xlsb`（旧式二进制按需加载 SheetJS 0.20.3，带代码页表），并给坏文件可读的错误提示。
8. **课程在日程表里变成时间块**：获批稿里课程只是浅色背景层；实际改成按普通块排布、占 lane、同段并排，加了右键「编辑课程」与其他块的「同一时段新建」菜单。
9. **课表的一键导入仍只覆盖示例版式**：本地解析器没有做成通用解析，其他版式走 AI 兜底；这与获批稿的范围一致，但需要在文档里说清楚。

## 4. 验证

`npx tsc --noEmit`、`npm test`（28 个 check）、`npm run build` 全过。相关断言：

- `scripts/check-ai-client.mjs`：请求地址、Bearer 头、工具形状、模型列表、错误码映射。
- `scripts/check-ai-tools.mjs`：只读查询、任务树/日计划校验、应用逻辑、手册内容。
- `scripts/check-ai-agent.mjs`：工具循环、提案停止、坏 JSON、步数上限、`reasoning_content` 回传。
- `scripts/check-ai-course.mjs`：工具调用、正文 JSON、双重编码、截断、节次时间、学期开始日透传。
- `scripts/check-course-sheet.mjs`：周表解析、真 `.xls` 走 SheetJS、坏文件错误码。

**没有在真实 WebView2 窗口里和真实模型往返过**；浏览器版的 CORS 与 Key 明文存储仍是已知限制。

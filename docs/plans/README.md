# 设计计划归档

开发过程中在 Claude Code 的 plan 模式里写下并获批的实现计划。每个文件都是当时的**原始计划**，逐字节导出，未做改写。

计划文件平时存在 `~/.claude/plans/` 下，文件名是随机生成的（如 `calm-wiggling-wolf.md`），不便检索，故归档到这里并按主题重命名。

| 日期 | 主题 | 计划 | 对应提交 | 源 session |
|---|---|---|---|---|
| 2026-09-12 | 任务日志 + 严格进度 | [2026-09-12-task-log.md](2026-09-12-task-log.md) | `783d03b` lunched log system and bug fixes | `0f629038` |
| 2026-09-12 | 待办（To-do）任务状态 | [2026-09-12-todo-status.md](2026-09-12-todo-status.md) | `d54d526` textbox tab update and added a new status for task | `2f65b3d5` |
| 2026-09-12 | 日期详情面板 | [2026-09-12-day-detail-panel.md](2026-09-12-day-detail-panel.md) | 未提交 | `3fde5df9` |

源文件对应关系（便于回查原始位置）：

```
~/.claude/plans/calm-wiggling-wolf.md        -> 2026-09-12-task-log.md
~/.claude/plans/memoized-sleeping-kazoo.md   -> 2026-09-12-todo-status.md
~/.claude/plans/elegant-cooking-sedgewick.md -> 2026-09-12-day-detail-panel.md
```

## 阅读须知

- **这是计划，不是实现记录。** 文件内容是获批那一刻的方案。实际实现过程中的偏离、追加需求、砍掉的部分都不会体现。比如日期详情面板最后把入口加到了甘特图时间轴表头上（原计划只做 Calendar），这件事不在计划文件里。
- **一个 session 只产出一份计划。** 计划文件按 session 分配，同一个 session 内多次修改会覆盖同一个文件，只保留最终版。
- 同日有多个计划，靠主题区分；文件名里的日期是计划的最后修改日期。
- 四个 session 中有一个（`80a98994`，讨论「任务负载系统」）没有进入 plan 模式，因此没有计划文件。

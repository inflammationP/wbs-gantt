# 设计计划归档

开发过程中在 Claude Code 的 plan 模式里写下并获批的实现计划。每个文件都是当时的**原始计划**，逐字节导出，未做改写。

计划文件平时存在 `~/.claude/plans/` 下，文件名是随机生成的（如 `calm-wiggling-wolf.md`），不便检索，故归档到这里并按主题重命名。

| 日期 | 主题 | 计划 | 对应提交 | 源 session |
|---|---|---|---|---|
| 2026-09-12 | 任务日志 + 严格进度 | [2026-09-12-task-log.md](2026-09-12-task-log.md) | `783d03b` lunched log system and bug fixes | `0f629038` |
| 2026-09-12 | 待办（To-do）任务状态 | [2026-09-12-todo-status.md](2026-09-12-todo-status.md) | `d54d526` textbox tab update and added a new status for task | `2f65b3d5` |
| 2026-09-12 | 日期详情面板 | [2026-09-12-day-detail-panel.md](2026-09-12-day-detail-panel.md) | `faf113e` v0.2.2 | `3fde5df9` |
| 2026-09-12 | 四页合并为 Manage | [2026-09-12-manage-merge.md](2026-09-12-manage-merge.md) | `faf113e` v0.2.2 | `c8603167` |
| 2026-09-12 | 甘特图日期范围 | [2026-09-12-timeline-range.md](2026-09-12-timeline-range.md) | `faf113e` v0.2.2 | `c8603167` |
| 2026-09-13 | 日历改造 | [2026-09-13-calendar.md](2026-09-13-calendar.md) | `8b493a3` v0.2.3 | `c8603167` |

源文件对应关系（便于回查原始位置）：

```
~/.claude/plans/calm-wiggling-wolf.md          -> 2026-09-12-task-log.md
~/.claude/plans/memoized-sleeping-kazoo.md     -> 2026-09-12-todo-status.md
~/.claude/plans/elegant-cooking-sedgewick.md   -> 2026-09-12-day-detail-panel.md
~/.claude/plans/frolicking-cuddling-biscuit.md -> 上面最后三份（文件被覆盖，见下）
```

## 阅读须知

- **这是计划，不是实现记录。** 文件内容是获批那一刻的方案。实际实现过程中的偏离、追加需求、砍掉的部分都不会体现。例如：
  - 日期详情面板最后把入口加到了甘特图时间轴表头上（原计划只做 Calendar）；
  - 日历改造原计划用水位高度表示日志完成率，实测后改成了义务方块，原因见 `FEATURES.md` 第 4.10 节。
- **一个 session 可以产出多份计划，而计划文件名在 session 内是复用的。** `c8603167` 这一个 session 写下了三份计划，却共用 `frolicking-cuddling-biscuit.md` 一个文件，于是每次 Write 都覆盖上一份，磁盘上最终只剩最后那份。
  - 前两份是从该 session 的对话记录（`~/.claude/projects/d--GitProject-wbs-gantt/c8603167-….jsonl`）里的 Write 调用还原的，文字与当时写入的一致。
  - 每份取的都是**终稿**——同一标题的最后一次快照，即获批的那一版；中间草稿未保留。
- 同日有多个计划，靠主题区分；文件名里的日期是计划的**本地**最后修改日期（UTC+8），所以 UTC 时间在 16:00 之后的计划会落到第二天。
- 五个 session 中有一个（`80a98994`，讨论「任务负载系统」）没有进入 plan 模式，因此没有计划文件。

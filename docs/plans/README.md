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
| 2026-09-13 | 设置页：语言与主题 | [2026-09-13-settings-i18n-theme.md](2026-09-13-settings-i18n-theme.md) | `169e89b` added a settings page with three languages and four colour themes | `1559b7da` |
| 2026-09-13 | 入门引导（六步） | [2026-09-13-getting-started-guide.md](2026-09-13-getting-started-guide.md) | （待提交） | 本次 |

源文件对应关系（便于回查原始位置）：

```
~/.claude/plans/calm-wiggling-wolf.md          -> 2026-09-12-task-log.md
~/.claude/plans/memoized-sleeping-kazoo.md     -> 2026-09-12-todo-status.md
~/.claude/plans/elegant-cooking-sedgewick.md   -> 2026-09-12-day-detail-panel.md
~/.claude/plans/frolicking-cuddling-biscuit.md -> 上面最后三份（文件被覆盖，见下）
~/.claude/plans/squishy-scribbling-tide.md     -> 2026-09-13-settings-i18n-theme.md
~/.claude/plans/wise-coalescing-nebula.md      -> 2026-09-13-getting-started-guide.md
```

## 阅读须知

- **这是计划，不是实现记录。** 文件内容是获批那一刻的方案。实际实现过程中的偏离、追加需求、砍掉的部分都不会体现。例如：
  - 日期详情面板最后把入口加到了甘特图时间轴表头上（原计划只做 Calendar）；
  - 日历改造原计划用水位高度表示日志完成率，实测后改成了义务方块，原因见 `FEATURES.md` 第 4.10 节；
  - 设置页的主题方案原定四套（石墨 / 玄武岩 / 赤铜 / 纸张），以「表面明度、对比度、色温、强调色」四个维度区隔。实际实现时却把差异全压在了色相上——三套深色的底面明度只差 2.5 个 L\*，被用户判为「就是同一个黑」。推翻重做后改为**底面明度当主变量**：石墨 4.4 / 余烬 6.9 / 板岩 15.1 / 纸张 100（L\*）。原计划里的玄武岩与赤铜未实现，色板卡也从「迷你示意」改成了逐色块列出名字与十六进制值。原因见 `FEATURES.md` 第 4.11 节。
  - 入门引导的卡片原本给**已完成的步骤**也留了「带我去」链接。渲染出来一看，300px 宽的卡片里挤了六个蓝色链接（法语更长，最挤），噪声盖过了内容。改成只给当前步骤留链接，讲解弹窗的「看说明」保留（回头再读是有用的）。
  - 入门引导在实现后又按用户反馈改了三处，都不在计划里：**加了第 1 步「选界面语言」**（界面默认英文，不读英文的人认不出设置在哪），于是七步；**第 1、2 步的文案改成用侧栏的说法指路**（「在设置里」「在 Manage 里」）；**最后一步改成「四个页面都逛过」才算完成**——原计划是「读过弹窗」，结果弹窗一开该步即完成、七步全完成、卡片收成「已经上手了」，第一次点「带我去」就把另外三个地方一起带走了。
- **一个 session 可以产出多份计划，而计划文件名在 session 内是复用的。** `c8603167` 这一个 session 写下了三份计划，却共用 `frolicking-cuddling-biscuit.md` 一个文件，于是每次 Write 都覆盖上一份，磁盘上最终只剩最后那份。
  - 前两份是从该 session 的对话记录（`~/.claude/projects/d--GitProject-wbs-gantt/c8603167-….jsonl`）里的 Write 调用还原的，文字与当时写入的一致。
  - 每份取的都是**终稿**——同一标题的最后一次快照，即获批的那一版；中间草稿未保留。
- 同日有多个计划，靠主题区分；文件名里的日期是计划的**本地**最后修改日期（UTC+8），所以 UTC 时间在 16:00 之后的计划会落到第二天。
- 七个 session 中有一个（`80a98994`，讨论「任务负载系统」）没有进入 plan 模式，因此没有计划文件。
- 入门引导这份计划在获批前被整个改写过两次（先是「状态驱动清单」，再是「清单 + 示例看板导览」，最后才是六步顺序流程），所以 `wise-coalescing-nebula.md` 磁盘上只剩最后一版。归档的是**获批的那一版**。

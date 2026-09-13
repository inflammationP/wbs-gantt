# 设计计划归档

开发过程中在 Claude Code 的 plan 模式里写下并获批的实现计划。**计划正文在 [`docs/plans/`](docs/plans/) 下**，这一份是索引 —— 放在仓库根目录、和 `README.md` 并排，是为了让它跟其它几份文档一样显眼。

计划文件平时存在 `~/.claude/plans/` 下，文件名是随机生成的（如 `calm-wiggling-wolf.md`），不便检索，故归档到 `docs/plans/` 并按主题重命名。

| 日期 | 主题 | 计划 | 对应提交 | 源 session |
|---|---|---|---|---|
| 2026-09-12 | 任务日志 + 严格进度 | [2026-09-12-task-log.md](docs/plans/2026-09-12-task-log.md) | `783d03b` lunched log system and bug fixes | `0f629038` |
| 2026-09-12 | 待办（To-do）任务状态 | [2026-09-12-todo-status.md](docs/plans/2026-09-12-todo-status.md) | `d54d526` textbox tab update and added a new status for task | `2f65b3d5` |
| 2026-09-12 | 日期详情面板 | [2026-09-12-day-detail-panel.md](docs/plans/2026-09-12-day-detail-panel.md) | `faf113e` v0.2.2 | `3fde5df9` |
| 2026-09-12 | 四页合并为 Manage | [2026-09-12-manage-merge.md](docs/plans/2026-09-12-manage-merge.md) | `faf113e` v0.2.2 | `c8603167` |
| 2026-09-12 | 甘特图日期范围 | [2026-09-12-timeline-range.md](docs/plans/2026-09-12-timeline-range.md) | `faf113e` v0.2.2 | `c8603167` |
| 2026-09-13 | 日历改造 | [2026-09-13-calendar.md](docs/plans/2026-09-13-calendar.md) | `8b493a3` v0.2.3 | `c8603167` |
| 2026-09-13 | 设置页：语言与主题 | [2026-09-13-settings-i18n-theme.md](docs/plans/2026-09-13-settings-i18n-theme.md) | `169e89b` added a settings page with three languages and four colour themes | `1559b7da` |
| 2026-09-13 | 入门引导（计划里是六步，做成七步） | [2026-09-13-getting-started-guide.md](docs/plans/2026-09-13-getting-started-guide.md) | `63bd162` guidance for beginners，后续修补在 `b5fbf54` | `1559b7da` |
| 2026-09-14 | 父任务的待填提醒与批量填写 | [2026-09-14-parent-subtask-logs.md](docs/plans/2026-09-14-parent-subtask-logs.md) | | 本次 |

源文件对应关系（便于回查原始位置）：

```
~/.claude/plans/calm-wiggling-wolf.md          -> docs/plans/2026-09-12-task-log.md
~/.claude/plans/memoized-sleeping-kazoo.md     -> docs/plans/2026-09-12-todo-status.md
~/.claude/plans/elegant-cooking-sedgewick.md   -> docs/plans/2026-09-12-day-detail-panel.md
~/.claude/plans/frolicking-cuddling-biscuit.md -> 上面最后三份（文件被覆盖，见下）
~/.claude/plans/squishy-scribbling-tide.md     -> docs/plans/2026-09-13-settings-i18n-theme.md
~/.claude/plans/wise-coalescing-nebula.md      -> docs/plans/2026-09-13-getting-started-guide.md
                                                  和 docs/plans/2026-09-14-parent-subtask-logs.md（同一个文件被写两次）
```

## 阅读须知

- **这是计划，不是实现记录。** 文件内容是获批那一刻的方案。实际实现过程中的偏离、追加需求、砍掉的部分默认不会体现，只在下面按例外列出。**唯一的例外是 2026-09-14 那一份**：它按用户要求把获批后的修订写进了自己的「八、获批之后的修订」一节，所以那一份不是纯快照，读的时候要看那一节。
- 计划里没提、但实现时改掉的，逐条记在这里：
  - 日期详情面板最后把入口加到了甘特图时间轴表头上（原计划只做 Calendar）；
  - 日历改造原计划用水位高度表示日志完成率，实测后改成了义务方块，原因见 `FEATURES.md` 第 4.10 节；
  - 设置页的主题方案原定四套（石墨 / 玄武岩 / 赤铜 / 纸张），以「表面明度、对比度、色温、强调色」四个维度区隔。实际实现时却把差异全压在了色相上——三套深色的底面明度只差 2.5 个 L\*，被用户判为「就是同一个黑」。推翻重做后改为**底面明度当主变量**：石墨 4.4 / 余烬 6.9 / 板岩 15.1 / 纸张 100（L\*）。原计划里的玄武岩与赤铜未实现，色板卡也从「迷你示意」改成了逐色块列出名字与十六进制值。原因见 `FEATURES.md` 第 4.11 节。
  - 入门引导的卡片原本给**已完成的步骤**也留了「带我去」链接。渲染出来一看，300px 宽的卡片里挤了六个蓝色链接（法语更长，最挤），噪声盖过了内容。改成只给当前步骤留链接，讲解弹窗的「看说明」保留（回头再读是有用的）。
  - 入门引导在实现后又按用户反馈改了五处，都不在计划里：**加了第 1 步「选界面语言」**（界面默认英文，不读英文的人认不出设置在哪），于是七步；**第 1、2 步的文案改成用侧栏的说法指路**（「在设置里」「在 Manage 里」）；**最后一步改成「四个页面都逛过」才算完成**——原计划是「读过弹窗」，结果弹窗一开该步即完成、七步全完成、卡片收成「已经上手了」，第一次点「带我去」就把另外三个地方一起带走了；**第 3 步改成也接受长期目标当父任务**（新建任务的表单本来就允许，引导却只认阶段任务）；**打勾后不再因删除而回退**——`deleteTask` 是级联的，删一个父任务会连带删掉严格子任务和日志，纯推导的版本会把三步一起退回。
  - **计划里关于演示数据的那条决定被推翻了两次。** 计划写着把 `seed-tutorial` 的数据集搬进 `main` 的 `src/lib/sample.ts`，由第 7 步按需追加（当时记为「对『演示数据不进 main』的一次反转」）。实现后又按用户要求整体删除：**一切教学步骤都不碰演示数据**，四个页面读的就是用户自己那块看板。所以现在 `main` 上没有任何演示数据，`seed-tutorial` 重新成为唯一来源——绕了一圈回到原点，`seed.ts` 的空桩从头到尾没动过。
- **一个 session 可以产出多份计划，而计划文件名在 session 内是复用的。** 这一点踩过两次：
  - `c8603167` 一个 session 写下三份计划，共用 `frolicking-cuddling-biscuit.md`，每次 Write 覆盖上一份，磁盘上只剩最后那份。前两份是从该 session 的对话记录（`~/.claude/projects/d--GitProject-wbs-gantt/c8603167-….jsonl`）里的 Write 调用还原的，文字与当时写入的一致。
  - `1559b7da` 一个 session 写下两份（入门引导、父任务的待填提醒），共用 `wise-coalescing-nebula.md`。两份都保住了，因为第二份是在第一份**归档之后**才写进去的。
  - 每份取的都是**终稿**——同一标题的最后一次快照，即获批的那一版；中间草稿未保留。入门引导那份在获批前被整个改写过两次（先是「状态驱动清单」，再是「清单 + 示例看板导览」，最后才是六步顺序流程），所以磁盘上只剩获批那一版。
- 同日有多个计划，靠主题区分；文件名里的日期是计划的**本地**最后修改日期（UTC+8），所以 UTC 时间在 16:00 之后的计划会落到第二天。
- 八个 session 中有一个（`80a98994`，讨论「任务负载系统」）没有进入 plan 模式，因此没有计划文件。

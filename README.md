# WBS · Gantt

一个带 **WBS（工作分解结构）+ 甘特图** 的项目进度管理工具。支持多层级任务、时间轴可视化、拖拽调整、长期目标、项目过滤，数据存在浏览器本地（localStorage）。

## 功能特性

- 多层级任务树，自动 WBS 编号（`1` / `1.1` / `1.1.1`），支持展开/折叠
- 甘特图时间轴：Day / Week / Month / Quarter / Year 五种粒度
- 任务条拖拽移动、拖拽调整起止日期
- 长期目标（无结束日期）用渐变色「向右淡出」表示
- 项目过滤、任务详情面板、项目详情面板
- 导入 / 导出 JSON
- 数据持久化到 localStorage（Web 版）或本地（桌面版）

## 技术栈

- **前端**：React 18 + TypeScript + Vite 7 + Zustand + Tailwind CSS
- **桌面端**：Tauri 2（Rust）
- **部署**：Cloudflare（Workers 静态资源 / `wrangler`）

## 目录结构

```
src/
  components/        # UI 组件（Sidebar、TaskDialog、详情面板等）
    gantt/           # 甘特图核心（GanttChart、TaskBar、RowLeft、TimelineHeader、GridBackground）
  lib/               # 纯逻辑（dates、timeline、tree、seed、ui、updater）
  pages/             # 页面（GanttPage、Dashboard、Tasks、Calendar、Projects、Statistics）
  store/             # Zustand 状态 + localStorage 持久化（useStore、storage）
  App.tsx / main.tsx
src-tauri/           # Tauri 桌面端（Rust 配置、图标）
scripts/release.mjs  # 一键发布（打包 + 生成 latest.json + gh 发布）
```

## 本地开发

```bash
npm install
npm run dev          # 浏览器开发服务器（http://localhost:1420）
```

## 构建

```bash
npm run build        # 类型检查 + 构建到 dist/（Web 用）
npm run preview      # 本地预览构建结果
```

## 部署到 Cloudflare（Web）

```bash
npm install -g wrangler   # 或已作为 devDependency 安装
npm run deploy            # 构建 + wrangler deploy
```

需要 Node ≥ 22（见 `.nvmrc`）。配置见 `wrangler.jsonc`。

## 桌面端（Tauri）打包

需要先安装 Rust 工具链和 MSVC 构建工具。

```bash
npm run tauri dev     # 桌面开发模式
npm run tauri build   # 打包成 Windows 安装包（NSIS）
```

产物在 `src-tauri/target/release/bundle/nsis/`。

### 自动更新

桌面端已集成 `tauri-plugin-updater`，启动时自动检查更新。发布新版本：

```bash
npm run release
```

脚本会提示版本号和更新说明，然后自动：带签名打包 → 生成 `latest.json` → 用 `gh` 创建 GitHub Release。

发布前需先 `gh auth login`（GitHub CLI），并把 `src-tauri/tauri.conf.json` 里的 `endpoints` 指向真实仓库地址（当前为 `inflammationP/wbs-gantt`）。

## 数据存储

- **Web 版**：`localStorage`（key：`wbs-gantt.v2`），刷新不丢。
- **桌面版**：同样走 WebView 的 localStorage，存在应用本地数据目录。

首次打开默认是空甘特图（演示数据已移除），可在 Projects 页新建项目、甘特图里新建任务。

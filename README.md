# WBS · Gantt

![GitHub release](https://img.shields.io/github/v/release/inflammationP/wbs-gantt)

用户将自己的任务按父子项等关系分好类之后填入，然后工具围绕甘特图提供直观、可视化的任务进度管理服务，仅此而已。

<img width="1280" height="764" alt="屏幕截图 2026-09-10 152338" src="https://github.com/user-attachments/assets/15f4638e-b552-428e-80c9-8df3c454c73b" />
<img width="1280" height="764" alt="屏幕截图 2026-09-10 152439" src="https://github.com/user-attachments/assets/af7bbda6-0921-430a-af4d-adbc7d75ef66" />

工具绝大部分功能都是换着花样为用户提供统计信息。后续更新会加入任务日志等功能，期待我，以及几乎不存在的其他用户们在未来使用中提出的意见。

## 安装

Windows 桌面版安装包：[Releases](https://github.com/inflammationP/wbs-gantt/releases)。

## 快速开始

### Web

```bash
npm install
npm run dev        # 开发服务器
npm run build      # 构建 Web 版本（dist/）
npm run deploy     # 部署到 Cloudflare
```

### 桌面端（Windows）

需要 Rust 工具链和 MSVC 构建工具。

```bash
npm run tauri dev      # 桌面开发模式
npm run tauri build    # 打包 NSIS 安装包
```

`npm run release` 一键打包、签名并发布 GitHub Release（含自动更新）。

## 技术栈

React · TypeScript · Vite · Zustand · Tailwind CSS · Tauri 2

## 数据

数据保存在本地（Web 版为 localStorage，桌面版为 WebView localStorage），支持 JSON 导入导出。

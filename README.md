# ClipStream

ClipStream 是一款专为 macOS 设计的极简、高效的剪贴板历史记录管理器。基于 Electron 和 React 构建，为您提供无缝的复制粘贴体验。

## ✨ 核心特性

- **多格式支持**：自动记录您复制的文本和图片。
- **全局快捷键**：随时随地通过全局快捷键（默认 `Cmd + Shift + V`）呼出剪贴板面板。
- **极速搜索**：支持对历史记录进行快速模糊搜索。
- **全键盘操作**：
  - `↑` / `↓` 切换选中项
  - `Enter` 自动粘贴到当前激活的应用程序
  - `Cmd + K` 快速聚焦搜索框
  - `Esc` 清空搜索或关闭窗口
- **macOS 原生体验**：
  - 使用 AppleScript 实现可靠的自动粘贴。
  - 支持毛玻璃（Vibrancy）视觉效果，UI 现代且美观。
  - 支持隐藏 Dock 栏图标，仅在顶部菜单栏（Tray）静默运行。
- **高度可定制**：
  - 自定义全局快捷键。
  - 自定义历史记录最大保存数量。
  - 自定义窗口弹出位置（跟随鼠标、屏幕四角）。

## 🛠 技术栈

- **框架**: [Electron](https://www.electronjs.org/) + [React](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **本地存储**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (借助 `idb` 库)
- **动画**: [Framer Motion](https://www.framer.com/motion/)
- **图标**: [Lucide React](https://lucide.dev/)

## 🚀 快速开始

### 环境要求

- Node.js (推荐 v18+)
- 仅支持 macOS 操作系统

### 安装依赖

```bash
npm install
```

### 开发模式

启动本地开发服务器并打开 Electron 窗口：

```bash
npm run dev
```

### 打包构建

将应用打包为 macOS 可执行文件 (`.dmg` 或 `.app`)：

```bash
npm run electron:build
```

打包后的文件将生成在 `dist-electron` 或 `release` 目录中（具体取决于您的 electron-builder 配置）。

## ⚙️ 设置选项

点击主界面右上角的“设置”图标（⚙️），您可以调整以下选项：

1. **快捷键**：点击输入框并按下您想要的组合键即可修改全局唤醒快捷键。
2. **最大历史记录数**：设置数据库中最多保留多少条剪贴板记录（默认 50 条）。
3. **窗口位置**：设置呼出面板时的显示位置（跟随鼠标、左上角、右上角、左下角、右下角）。
4. **显示在程序坞**：控制应用是否在底部 Dock 栏显示图标。
5. **显示在菜单栏**：控制应用是否在顶部菜单栏显示图标。

## 📝 注意事项

- **辅助功能权限**：由于 ClipStream 需要使用 AppleScript 模拟键盘按键 (`Cmd + V`) 来实现自动粘贴功能，首次运行时 macOS 可能会要求您在“系统设置 -> 隐私与安全性 -> 辅助功能”中授予该应用权限。
- **纯 macOS 应用**：本项目已移除对 Windows 和 Linux 的兼容代码，专注于提供最佳的 macOS 体验。

## 📄 开源协议

MIT License

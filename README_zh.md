**简体中文** | [English](./README.md)

# ClipStream 📋

一款流畅、快速且现代的剪贴板管理器，基于 Electron、React 和 Tailwind CSS 构建。ClipStream 能够记录您复制的文本和图片，让您可以通过快捷键瞬间搜索并粘贴历史记录。

![ClipStream](public/icon.png)

## ✨ 特性

*   **📝 文本与图片支持：** 自动保存您复制的文本片段和图片。
*   **🔍 快速搜索：** 通过极速的实时搜索栏瞬间找到历史剪贴板内容。
*   **⌨️ 全局快捷键：** 使用全局热键随时随地呼出剪贴板历史（默认：`Cmd+Shift+V` 或 `Ctrl+Shift+V`）。
*   **⚙️ 高度可定制：** 
    *   调整窗口位置（跟随鼠标、右上角、左下角等）。
    *   设置最大历史记录数量和显示行数。
    *   切换程序坞（Dock）和菜单栏（托盘）的显示状态。
*   **🌍 国际化 (i18n)：** 全面支持英文和简体中文。
*   **🚀 开机自启：** 支持系统登录时自动启动。
*   **🎨 现代 UI：** 基于 Tailwind CSS 构建的精美极简界面与流畅动画。

## 🛠️ 技术栈

*   **框架:** [Electron](https://www.electronjs.org/)
*   **前端:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
*   **样式:** [Tailwind CSS 4](https://tailwindcss.com/)
*   **图标:** [Lucide React](https://lucide.dev/)
*   **数据库:** IndexedDB / SQLite

## 🚀 快速开始

### 环境要求

请确保您的计算机上已安装 [Node.js](https://nodejs.org/)。

### 安装步骤

1. 克隆仓库:
   ```bash
   git clone https://github.com/yourusername/clipstream.git
   cd clipstream
   ```

2. 安装依赖:
   ```bash
   npm install
   ```

3. 启动开发服务器:
   ```bash
   npm run electron:dev
   ```

### 构建生产版本

为当前操作系统构建应用程序：

```bash
npm run electron:build
```

编译后的应用程序将生成在 `dist-electron/` 或 `release/` 目录中。

## 📸 截图

<div align="center">
  <img src="public/screenshot1.png" alt="ClipStream 主界面" width="45%" />
  &nbsp; &nbsp;
  <img src="public/screenshot2.png" alt="ClipStream 设置" width="45%" />
</div>

## 📄 开源协议

本项目基于 MIT 协议开源。

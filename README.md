# ClipStream (Swift 原生重构版)

这是一个使用原生 Swift 和 SwiftUI 重构的 ClipStream 剪贴板管理器。

## 为什么使用 Swift 重构？
Electron 版本的应用通常会占用 100MB - 300MB 的内存，并且需要运行 Node.js 进程和 Chromium 渲染进程。
使用原生 Swift (SwiftUI) 重构后：
- **内存占用**：将降至 15MB - 30MB 左右。
- **CPU 占用**：几乎为 0（仅在复制时短暂唤醒）。
- **包体积**：从几十 MB 缩小到几 MB。
- **UI/UX**：完全原生的 macOS 视觉体验和动画。

## 🚀 极简一键打包 (推荐)

我们为您提供了一个原生的 Bash 脚本，**无需打开 Xcode**，只需在您的 Mac 终端中运行一行命令，即可自动编译、生成图标并打包成 `.zip`！

1. 将整个 `ClipStream-Swift` 文件夹下载到您的 Mac 上。
2. 打开终端 (Terminal)，进入该文件夹：
   ```bash
   cd path/to/ClipStream-Swift
   ```
3. 赋予脚本执行权限并运行：
   ```bash
   chmod +x build.sh
   ./build.sh
   ```
4. **完成！** 脚本会自动调用 macOS 自带的 `swiftc` 编译器，并在当前目录下生成 `ClipStream.app` 和 `ClipStream.zip`。您可以直接双击运行 `ClipStream.app`。

---

## 🛠️ 传统方式：使用 Xcode 运行

如果您希望修改代码或进行调试，可以使用 Xcode：

1. 打开 Mac 上的 **Xcode**。
2. 选择 **Create a new Xcode project**。
3. 选择 **macOS** -> **App**，点击 Next。
4. 填写项目信息：
   - Product Name: `ClipStream`
   - Interface: `SwiftUI`
   - Language: `Swift`
5. 创建项目后，将 `ClipStream-Swift` 文件夹中的以下 4 个文件拖入 Xcode 项目中（替换掉默认的 `ContentView.swift` 和 `App.swift`）：
   - `ClipStreamApp.swift`
   - `ContentView.swift`
   - `ClipboardManager.swift`
   - `PasteHelper.swift`
6. 点击 Xcode 左上角的 **Run (播放按钮)** 即可编译并运行！

## 权限设置
为了让应用能够模拟 `Cmd+V` 自动粘贴，您需要在首次运行时，在 Mac 的“系统设置 -> 隐私与安全性 -> 辅助功能”中允许 ClipStream 控制您的电脑。

## 功能对齐
- [x] 菜单栏托盘图标 (MenuBarExtra)
- [x] 剪贴板历史记录监听 (NSPasteboard)
- [x] 搜索过滤功能
- [x] 点击历史记录自动复制并粘贴 (CGEvent 模拟 Cmd+V)
- [x] 本地数据持久化 (UserDefaults)
- [x] 清空历史记录

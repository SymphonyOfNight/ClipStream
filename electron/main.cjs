const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let tray = null;
let lastText = '';
let lastImage = '';
let currentShortcut = 'CommandOrControl+Shift+V';
let windowPosition = 'mouse'; // mouse, top-right, top-left, bottom-right, bottom-left
let ignoreBlur = false;
let shortcutsEnabled = true;

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // titleBarStyle: 'hiddenInset', // 移除此项以完全隐藏红绿灯
    titleBarStyle: 'customButtonsOnHover', // 或者使用 'hidden' 如果我们完全不需要控件，但 'hidden' 可能会保留红绿灯。
    // 实际上，frame: false 通常会隐藏所有内容，但在 macOS 上 titleBarStyle 可以覆盖它。
    // 要在 macOS 上使用 frame: false 完全隐藏红绿灯，我们可以使用 titleBarStyle: 'hidden' 和 trafficLightPosition: { x: -100, y: -100 } 的黑客方法，或者如果配置正确，仅依赖 frame: false。
    // 让我们尝试 macOS 的标准无边框设置，这会隐藏红绿灯。
    frame: false, 
    titleBarStyle: 'hidden', // 这个加上 trafficLightPosition hidden 通常有效
    trafficLightPosition: { x: -100, y: -100 }, // 隐藏红绿灯
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    resizable: true, 
    maximizable: false,
    alwaysOnTop: false,
    show: false, 
  });

  mainWindow = win;

  // 如果未忽略失去焦点（例如在设置中），则在失去焦点时隐藏
  win.on('blur', () => {
    if (!ignoreBlur && win.isVisible()) {
      win.hide();
    }
  });

  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
    return false;
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  registerGlobalShortcut(currentShortcut);
  startClipboardPolling(win);
}

function createTray() {
  if (tray) return;

  let iconPath;
  
  if (app.isPackaged) {
    // 在生产环境中，资源通常位于 resources/app.asar/dist 或 resources/app.asar/public
    // 但是 Vite 通常会将公共资源复制到 dist 根目录。
    // 所以我们先检查 dist。
    
    // 检查 dist/trayTemplate.png (相对于 electron 文件夹中的 main.cjs)
    const distPath = path.join(__dirname, '../dist/trayTemplate.png');
    
    // 检查 public/trayTemplate.png (如果 public 文件夹被保留)
    const publicPath = path.join(__dirname, '../public/trayTemplate.png');
    
    // 检查 resources/public/trayTemplate.png (如果使用了 extraResources)
    const resourcesPath = path.join(process.resourcesPath, 'public', 'trayTemplate.png');
    
    // 检查 app.asar/dist/trayTemplate.png (在某些构建中常见)
    const asarDistPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'trayTemplate.png');

    if (require('fs').existsSync(distPath)) {
        iconPath = distPath;
    } else if (require('fs').existsSync(publicPath)) {
        iconPath = publicPath;
    } else if (require('fs').existsSync(resourcesPath)) {
        iconPath = resourcesPath;
    } else if (require('fs').existsSync(asarDistPath)) {
        iconPath = asarDistPath;
    } else {
        // 如果找不到 PNG，则回退到 SVG
        const svgPath = path.join(__dirname, '../public/tray.svg');
        if (require('fs').existsSync(svgPath)) {
            iconPath = svgPath;
        } else {
            console.error('Tray icon not found in any expected location');
            iconPath = path.join(__dirname, '../dist/trayTemplate.png'); // 默认为 dist png
        }
    }
  } else {
    iconPath = path.join(__dirname, '../public/trayTemplate.png');
    if (!require('fs').existsSync(iconPath)) {
        iconPath = path.join(__dirname, '../public/tray.svg');
    }
  }

  let icon = nativeImage.createFromPath(iconPath);
  
  if (icon.isEmpty()) {
      console.error('Failed to load tray icon from path:', iconPath);
      // 尝试使用 fs 直接读取文件并从缓冲区创建作为回退
      try {
          const fs = require('fs');
          const buffer = fs.readFileSync(iconPath);
          icon = nativeImage.createFromBuffer(buffer);
          if (icon.isEmpty()) {
              console.error('Still failed to load icon from buffer');
          } else {
              console.log('Successfully loaded icon from buffer');
          }
      } catch (err) {
          console.error('Error reading icon file:', err);
      }
  } else {
      console.log('Successfully loaded tray icon from path:', iconPath);
  }
  
  // macOS 会自动将带有 "Template" 后缀的图片识别为模板图片，无需手动设置
  // 并且我们已经生成了 22x22 和 44x44 (@2x) 的图片，无需手动 resize

  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => {
        if (mainWindow) {
            positionWindow();
            mainWindow.show();
            mainWindow.focus();
        }
    }},
    { type: 'separator' },
    { label: '退出', click: () => {
        app.isQuitting = true;
        app.quit();
    }}
  ]);
  
  tray.setToolTip('ClipStream');
  tray.setContextMenu(contextMenu);
  
  // 点击时，切换窗口
  tray.on('click', () => {
      if (mainWindow) {
          if (mainWindow.isVisible()) {
              mainWindow.hide();
          } else {
              positionWindow();
              mainWindow.show();
              mainWindow.focus();
          }
      }
  });
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

function positionWindow() {
  if (!mainWindow) return;

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = display;
  const [winWidth, winHeight] = mainWindow.getSize();

  let x, y;

  switch (windowPosition) {
    case 'top-right':
      x = workArea.x + workArea.width - winWidth - 20;
      y = workArea.y + 20;
      break;
    case 'top-left':
      x = workArea.x + 20;
      y = workArea.y + 20;
      break;
    case 'bottom-right':
      x = workArea.x + workArea.width - winWidth - 20;
      y = workArea.y + workArea.height - winHeight - 20;
      break;
    case 'bottom-left':
      x = workArea.x + 20;
      y = workArea.y + workArea.height - winHeight - 20;
      break;
    case 'mouse':
    default:
      x = cursorPoint.x;
      y = cursorPoint.y;
      // 确保窗口在边界内
      if (x + winWidth > workArea.x + workArea.width) {
        x = workArea.x + workArea.width - winWidth - 10;
      }
      if (y + winHeight > workArea.y + workArea.height) {
        y = workArea.y + workArea.height - winHeight - 10;
      }
      break;
  }

  mainWindow.setPosition(Math.round(x), Math.round(y));
}

function registerGlobalShortcut(shortcut) {
  globalShortcut.unregisterAll();
  try {
    globalShortcut.register(shortcut, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible() && !mainWindow.isAlwaysOnTop()) {
          mainWindow.hide();
        } else {
          positionWindow();
          mainWindow.show();
          mainWindow.focus();
        }
      } else {
        createWindow();
      }
    });
    currentShortcut = shortcut;
  } catch (err) {
    console.error('Failed to register shortcut:', err);
  }
}

function startClipboardPolling(win) {
  setInterval(() => {
    if (!win || win.isDestroyed()) return;

    const formats = clipboard.availableFormats();
    
    // 增强的文件检测：如果剪贴板包含文件路径则忽略
    // 这可以防止将文件副本记录为文本（路径）或图像（图标）
    const isFile = formats.some(f => 
       f === 'public.file-url' || 
       f === 'text/uri-list' || 
       f === 'FileName' || 
       f === 'FileNameW' || 
       f === 'x-special/gnome-copied-files' ||
       // 检查其他常见的文件指示符
       (f.toLowerCase().includes('file') && f.toLowerCase().includes('url'))
    );

    if (isFile) {
      return;
    }

    const text = clipboard.readText();
    
    // 仅在没有文本时尝试读取图像，或者如果我们想要支持混合内容。
    // 但通常我们会优先考虑。
    // 此外，检查格式是否包含图像类型有助于避免误报。
    const hasImageFormat = formats.some(f => 
        f.startsWith('image/') || 
        f === 'public.png' || 
        f === 'public.tiff' || 
        f === 'Bitmap' ||
        f === 'Dib'
    );

    let imageDataUrl = '';
    if (hasImageFormat) {
        const image = clipboard.readImage();
        imageDataUrl = image.isEmpty() ? '' : image.toDataURL();
    }

    if (text && text.trim() !== lastText.trim()) {
      lastText = text;
      win.webContents.send('clipboard-changed', { type: 'text', content: text, timestamp: Date.now() });
    }

    if (imageDataUrl && imageDataUrl !== lastImage) {
      lastImage = imageDataUrl;
      // 如果我们同时拥有文本和图像（很少见但可能），我们可能想要首选其中一个或发送两者。
      // 当前逻辑独立发送两者。
      // 但是如果是图像复制，通常文本为空或只是元数据。
      // 如果存在文本，我们已经发送了它。
      // 如果是新的，我们也发送图像。
      win.webContents.send('clipboard-changed', { type: 'image', content: imageDataUrl, timestamp: Date.now() });
    }
  }, 1000);
}


ipcMain.on('set-shortcut-enabled', (event, enabled) => {
  shortcutsEnabled = enabled;
  if (enabled) {
    registerGlobalShortcut(currentShortcut);
  } else {
    globalShortcut.unregisterAll();
  }
});

ipcMain.on('set-ignore-blur', (event, ignore) => {
  ignoreBlur = ignore;
});

ipcMain.on('update-shortcut', (event, shortcut) => {
  registerGlobalShortcut(shortcut);
});

ipcMain.on('set-window-position', (event, position) => {
  windowPosition = position;
});

ipcMain.on('set-show-dock', (event, show) => {
  if (show) {
      app.dock.show();
  } else {
      app.dock.hide();
  }
});

ipcMain.on('set-show-tray', (event, show) => {
  if (show) {
      createTray();
  } else {
      destroyTray();
  }
});

  ipcMain.on('paste-content', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 执行实际粘贴命令的函数
      const performPaste = () => {
        // 双重检查：如果窗口又显示了（用户可能快速重新激活了窗口），则取消粘贴
        if (mainWindow.isVisible()) return;

        try {
          // macOS: 使用 AppleScript 发送 Command+V
          // 优化：
          // 1. 拆分 delay 和 keystroke，确保 System Events 有时间响应
          // 2. 增加 delay 0.05 (50ms) 在脚本内部，作为系统级缓冲
          const script = `
            tell application "System Events"
              delay 0.05
              keystroke "v" using command down
            end tell
          `;
          exec(`osascript -e '${script}'`, (error) => {
            if (error) console.error('Paste execution failed:', error);
          });
        } catch (err) {
          console.error('Paste simulation error:', err);
        }
      };

      // 1. 立即隐藏窗口，强制操作系统开始切换焦点
      // 使用 app.hide() 而不是 mainWindow.hide() 在 macOS 上通常能更可靠地将焦点交还给前一个应用
      app.hide();

      // 2. 等待焦点切换完成
      // 之前的基于 blur 事件的逻辑在某些系统高负载下不可靠。
      // 改为固定等待 100ms。这是一个在“响应速度”和“可靠性”之间的最佳平衡点。
      // 100ms 对于用户来说几乎是瞬间的，但对于操作系统完成窗口切换和焦点对焦来说通常已经足够。
      setTimeout(performPaste, 100);
    }
  });

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });
});

// 移除了 window-all-closed 监听器，因为仅 macOS 应用程序不需要它


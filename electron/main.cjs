const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, Tray, Menu, nativeImage, systemPreferences, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const log = require('electron-log');

// 配置 electron-log
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.info('App starting...');

let mainWindow;
let tray = null;
let lastText = '';
let lastImageBmp = null;
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
            log.error('Tray icon not found in any expected location');
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
      log.error('Failed to load tray icon from path:', iconPath);
      // 尝试使用 fs 直接读取文件并从缓冲区创建作为回退
      try {
          const fs = require('fs');
          const buffer = fs.readFileSync(iconPath);
          icon = nativeImage.createFromBuffer(buffer);
          if (icon.isEmpty()) {
              log.error('Still failed to load icon from buffer');
          } else {
              log.info('Successfully loaded icon from buffer');
          }
      } catch (err) {
          log.error('Error reading icon file:', err);
      }
  } else {
      log.info('Successfully loaded tray icon from path:', iconPath);
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
    { label: '打开日志目录', click: () => {
        const { shell } = require('electron');
        shell.showItemInFolder(log.transports.file.getFile().path);
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
    log.error('Failed to register shortcut:', err);
  }
}

function startClipboardPolling(win) {
  setInterval(() => {
    if (!win || win.isDestroyed()) return;

    const formats = clipboard.availableFormats();

    // 检测是否为本地文件复制
    const isFile = formats.some(f =>
       f === 'public.file-url' ||
       f === 'NSFilenamesPboardType' ||
       f === 'FileName' ||
       f === 'FileNameW' ||
       f === 'x-special/gnome-copied-files'
    );

    // 如果是文件，我们忽略图像部分（通常只是文件图标），只处理文本部分（文件路径）
    const hasImage = !isFile && formats.some(f =>
        f.startsWith('image/') ||
        f === 'public.png' ||
        f === 'public.tiff' ||
        f === 'Bitmap' ||
        f === 'Dib'
    );

    const text = clipboard.readText();
    let isNewText = text && text.trim() !== lastText.trim();
    let isNewImage = false;
    let img = null;
    let bmp = null;

    if (hasImage) {
        img = clipboard.readImage();
        if (!img.isEmpty()) {
            bmp = img.toBitmap();
            if (!lastImageBmp || Buffer.compare(bmp, lastImageBmp) !== 0) {
                isNewImage = true;
            }
        }
    }

    if (isNewImage) {
        lastImageBmp = bmp;
        lastText = text; // 同步文本，避免同一复制事件触发两次
        const dataUrl = img.toDataURL();
        win.webContents.send('clipboard-changed', { type: 'image', content: dataUrl, timestamp: Date.now() });
    } else if (isNewText) {
        lastText = text;
        if (!hasImage) {
            lastImageBmp = null; // 只有在剪贴板没有图片时才清空图片缓存
        }
        win.webContents.send('clipboard-changed', { type: 'text', content: text, timestamp: Date.now() });
    }
  }, 500);
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

ipcMain.handle('get-auto-launch', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.on('set-auto-launch', (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath('exe')
  });
});

  ipcMain.on('paste-content', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      log.info('Received paste-content request from renderer');

      // macOS 权限检查
      if (process.platform === 'darwin') {
        if (!systemPreferences.isTrustedAccessibilityClient(false)) {
          log.warn('Missing accessibility permissions for pasting');
          // 触发系统权限弹窗
          systemPreferences.isTrustedAccessibilityClient(true);
          
          dialog.showMessageBox({
            type: 'warning',
            title: '需要辅助功能权限',
            message: '无法自动粘贴：缺少“辅助功能”权限',
            detail: 'macOS 安全机制要求授予权限才能模拟按键。\n\n请打开“系统设置 > 隐私与安全性 > 辅助功能”，勾选您正在使用的终端（如 Terminal, iTerm, VSCode）或 ClipStream 应用，然后重试。',
            buttons: ['我知道了']
          });
          return; // 终止粘贴流程
        }
      }

      // 执行实际粘贴命令的函数
      const performPaste = () => {
        // 双重检查：如果窗口又显示了（用户可能快速重新激活了窗口），则取消粘贴
        if (mainWindow.isVisible()) {
          log.warn('Paste cancelled: window became visible again');
          return;
        }

        try {
          log.info('Executing AppleScript for paste simulation');
          const script = `
            tell application "System Events"
              delay 0.05
              keystroke "v" using command down
            end tell
          `;
          exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
            if (error) {
              log.error('Paste execution failed:', error.message);
              log.error('Paste stderr:', stderr);
              // 如果仍然报 1002 错误，可能是权限刚给还没生效，或者被拒绝
              if (stderr.includes('1002') || stderr.includes('不允许发送按键')) {
                dialog.showMessageBox({
                  type: 'error',
                  title: '粘贴失败',
                  message: '系统拒绝了模拟按键请求',
                  detail: '请确保在“系统设置 > 隐私与安全性 > 辅助功能”中正确勾选了当前应用。如果已经勾选，请尝试取消勾选并重新勾选，或者重启应用。',
                  buttons: ['确定']
                });
              }
            } else {
              log.info('Paste executed successfully');
            }
          });
        } catch (err) {
          log.error('Paste simulation error:', err.message, err.stack);
        }
      };

      // 1. 立即隐藏窗口，强制操作系统开始切换焦点
      log.info('Hiding app to return focus to previous window');
      app.hide();

      // 2. 等待焦点切换完成
      setTimeout(() => {
        log.info('Timeout reached, attempting to perform paste');
        performPaste();
      }, 100);
    } else {
      log.warn('paste-content received but mainWindow is invalid');
    }
  });

ipcMain.on('log-message', (event, { level, message, data }) => {
  if (log[level]) {
    log[level](`[Renderer] ${message}`, ...(data || []));
  } else {
    log.info(`[Renderer] ${message}`, ...(data || []));
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


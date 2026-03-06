const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let tray = null;
let lastText = '';
let lastImage = '';
let currentShortcut = 'CommandOrControl+Shift+V';
let windowPosition = 'mouse'; // mouse, top-right, top-left, bottom-right, bottom-left
let isPinned = false;
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
    // titleBarStyle: 'hiddenInset', // Removed to hide traffic lights completely
    titleBarStyle: 'customButtonsOnHover', // Or 'hidden' if we want no controls at all, but 'hidden' might keep traffic lights. 
    // Actually, frame: false usually hides everything, but on macOS titleBarStyle can override.
    // To hide traffic lights completely on macOS with frame: false, we can use titleBarStyle: 'hidden' and trafficLightPosition: { x: -100, y: -100 } hack or just rely on frame: false if configured right.
    // Let's try standard frameless setup for macOS which hides traffic lights.
    frame: false, 
    titleBarStyle: 'hidden', // This plus trafficLightPosition hidden usually works
    trafficLightPosition: { x: -100, y: -100 }, // Hide traffic lights
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    resizable: true, 
    maximizable: false,
    alwaysOnTop: false,
    show: false, 
  });

  mainWindow = win;

  // Hide on blur if not pinned and not ignoring blur (e.g. in settings)
  win.on('blur', () => {
    if (!isPinned && !ignoreBlur && win.isVisible()) {
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
    // In production, resources are usually in resources/app.asar/dist or resources/app.asar/public
    // But Vite usually copies public assets to dist root.
    // So we check dist first.
    
    // Check dist/tray.png (relative to main.cjs in electron folder)
    const distPath = path.join(__dirname, '../dist/tray.png');
    
    // Check public/tray.png (if public folder is preserved)
    const publicPath = path.join(__dirname, '../public/tray.png');
    
    // Check resources/public/tray.png (if extraResources used)
    const resourcesPath = path.join(process.resourcesPath, 'public', 'tray.png');
    
    // Check app.asar/dist/tray.png (common in some builds)
    const asarDistPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'tray.png');

    if (require('fs').existsSync(distPath)) {
        iconPath = distPath;
    } else if (require('fs').existsSync(publicPath)) {
        iconPath = publicPath;
    } else if (require('fs').existsSync(resourcesPath)) {
        iconPath = resourcesPath;
    } else if (require('fs').existsSync(asarDistPath)) {
        iconPath = asarDistPath;
    } else {
        // Fallback to SVG if PNG not found
        const svgPath = path.join(__dirname, '../public/tray.svg');
        if (require('fs').existsSync(svgPath)) {
            iconPath = svgPath;
        } else {
            console.error('Tray icon not found in any expected location');
            iconPath = path.join(__dirname, '../dist/tray.png'); // Default to dist png
        }
    }
  } else {
    iconPath = path.join(__dirname, '../public/tray.png');
    if (!require('fs').existsSync(iconPath)) {
        iconPath = path.join(__dirname, '../public/tray.svg');
    }
  }

  let icon = nativeImage.createFromPath(iconPath);
  
  if (process.platform === 'darwin') {
      // On macOS, resize to 22x22 to ensure it fits the menu bar
      icon = icon.resize({ width: 22, height: 22 });
      icon.setTemplateImage(true);
  } else {
      icon = icon.resize({ width: 16, height: 16 });
  }
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
  
  // On click, toggle window
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
      // Ensure window is within bounds
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
    
    // Enhanced file detection: ignore if clipboard contains file paths
    // This prevents recording file copies as text (paths) or images (icons)
    const isFile = formats.some(f => 
       f === 'public.file-url' || 
       f === 'text/uri-list' || 
       f === 'FileName' || 
       f === 'FileNameW' || 
       f === 'x-special/gnome-copied-files' ||
       // Check for other common file indicators
       (f.toLowerCase().includes('file') && f.toLowerCase().includes('url'))
    );

    if (isFile) {
      return;
    }

    const text = clipboard.readText();
    
    // Only attempt to read image if there's no text, or if we want to support mixed content.
    // But usually we prioritize. 
    // Also, checking if formats contain image types can help avoid false positives.
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
      // If we have both text and image (rare but possible), we might want to prefer one or send both.
      // Current logic sends both independently.
      // But if it's an image copy, usually text is empty or just metadata.
      // If text is present, we already sent it.
      // Let's send image too if it's new.
      win.webContents.send('clipboard-changed', { type: 'image', content: imageDataUrl, timestamp: Date.now() });
    }
  }, 1000);
}

ipcMain.on('set-always-on-top', (event, flag) => {
  isPinned = flag;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(flag, 'floating');
    mainWindow.setVisibleOnAllWorkspaces(flag);
  }
});

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
  if (process.platform === 'darwin') {
    if (show) {
        app.dock.show();
    } else {
        app.dock.hide();
    }
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
    if (process.platform === 'darwin') {
      app.hide(); 
      // Increased delay to 100ms to ensure previous window regains focus before pasting
      // 50ms might be too fast for some systems or apps
      setTimeout(() => {
        exec('osascript -e "tell application \\"System Events\\" to keystroke \\"v\\" using command down"');
      }, 100);
    } else {
      mainWindow.hide();
    }
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

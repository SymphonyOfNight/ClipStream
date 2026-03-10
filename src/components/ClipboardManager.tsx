import React, { useEffect, useState, useRef } from 'react';
import { openDB } from 'idb';
import { cn } from '../lib/utils';
import { Copy, Image as ImageIcon, Trash2, Search, Command, X, Settings, Keyboard, Layers, AlignLeft, Monitor, LayoutTemplate, AppWindow, Rocket, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Toast from './Toast';
import { i18n, Language } from './i18n';

interface ClipboardItem {
  id?: number;
  type: 'text' | 'image';
  content: string | Blob;
  timestamp: number;
  preview?: string;
}

const DB_NAME = 'clipstream-db';
const STORE_NAME = 'items';

// 格式化快捷键以进行显示的辅助函数
const renderShortcut = (shortcut: string) => {
  const parts = shortcut.split('+');
  return (
    <div className="flex items-center gap-1.5">
      {parts.map((part, i) => {
        let label = part;
        let icon = '';
        
        if (part === 'CommandOrControl' || part === 'Command') {
          label = 'Command';
          icon = '⌘';
        } else if (part === 'Control') {
          label = 'Ctrl';
          icon = '⌃';
        } else if (part === 'Alt') {
          label = 'Option';
          icon = '⌥';
        } else if (part === 'Shift') {
          label = 'Shift';
          icon = '⇧';
        }
        
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-gray-300">+</span>}
            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-medium text-gray-600 flex items-center gap-1">
              {icon && <span className="text-gray-400 font-sans">{icon}</span>}
              <span>{label}</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default function ClipboardManager() {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [shortcut, setShortcut] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('shortcut') || 'CommandOrControl+Shift+V';
    return 'CommandOrControl+Shift+V';
  });
  const [maxItems, setMaxItems] = useState(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('maxItems');
        return stored ? parseInt(stored) : 50;
    }
    return 50;
  });
  const [maxLines, setMaxLines] = useState(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('maxLines');
        return stored ? parseInt(stored) : 2;
    }
    return 2;
  });
  const [windowPosition, setWindowPosition] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('windowPosition') || 'mouse';
    return 'mouse';
  });
  const [showDock, setShowDock] = useState(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('showDock');
        return stored !== null ? stored === 'true' : true;
    }
    return true;
  });
  const [showTray, setShowTray] = useState(() => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('showTray');
        return stored !== null ? stored === 'true' : true; // 默认为 true
    }
    return true; // 默认为 true
  });
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
        return (localStorage.getItem('language') as Language) || 'zh';
    }
    return 'zh';
  });
  
  const t = i18n[language];

  // 模态框的临时设置状态
  const [tempSettings, setTempSettings] = useState({
    shortcut: '',
    maxItems: 50,
    maxLines: 2,
    windowPosition: 'mouse',
    showDock: true,
    showTray: true, // 默认为 true
    autoLaunch: false,
    language: 'zh' as Language
  });

  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 初始化数据库并加载项目
  useEffect(() => {
    const init = async () => {
      const db = await openDB(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('timestamp', 'timestamp');
          }
        },
      });
      loadItems(db);
    };
    init();

    // 获取开机自启状态
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('get-auto-launch').then((enabled: boolean) => {
        setAutoLaunch(enabled);
        setTempSettings(prev => ({ ...prev, autoLaunch: enabled }));
      }).catch(console.error);
    }
  }, []);

  // 打开模态框时初始化临时设置
  useEffect(() => {
    if (showSettings) {
      setTempSettings({
        shortcut,
        maxItems,
        maxLines,
        windowPosition,
        showDock,
        showTray,
        autoLaunch,
        language
      });
    }
  }, [showSettings]);

  // 更新 Dock 可见性
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-show-dock', showDock);
    }
  }, [showDock]);

  // 更新托盘可见性
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-show-tray', showTray);
    }
  }, [showTray]);

  // 处理设置打开/关闭以禁用快捷键和忽略失去焦点
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      if (showSettings) {
        ipcRenderer.send('set-shortcut-enabled', false);
        ipcRenderer.send('set-ignore-blur', true);
      } else {
        ipcRenderer.send('set-shortcut-enabled', true);
        ipcRenderer.send('set-ignore-blur', false);
        // 确保当前快捷键处于活动状态
        ipcRenderer.send('update-shortcut', shortcut);
      }
    }
  }, [showSettings, shortcut]);

  // 在主进程中更新快捷键（仅当不在设置中时，或由上述效果处理）
  // 实际上，我们只想在快捷键更改且不在设置中时更新（或者让上述效果处理重新启用）
  // 但是如果我们在设置中更改快捷键，我们不想在关闭设置之前注册它？
  // 或者我们可以注册它，但它是禁用的。
  // 让我们保留原始效果，但如果我们在 showSettings 效果中处理它，可能它是多余的。
  // 但是，在初始加载时，showSettings 为 false，所以我们需要注册。
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require && !showSettings) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('update-shortcut', shortcut);
    }
  }, [shortcut]);

  // 在主进程中更新窗口位置
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-window-position', windowPosition);
    }
  }, [windowPosition]);

  const loadItems = async (db: any) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.store.index('timestamp');
    let cursor = await index.openCursor(null, 'prev');
    const loadedItems: ClipboardItem[] = [];
    while (cursor && loadedItems.length < maxItems) {
      loadedItems.push(cursor.value);
      cursor = await cursor.continue();
    }
    setItems(loadedItems);
  };

  // 处理粘贴事件（手动粘贴到窗口中）
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const db = await openDB(DB_NAME, 1);

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const base64 = event.target?.result as string;
              // 添加通常由 db 服务处理的逻辑，但现在我们手动处理
              // 理想情况下应该使用 addClipboardItem 服务
              await db.add(STORE_NAME, {
                type: 'image',
                content: blob,
                preview: base64,
                timestamp: Date.now(),
              });
              loadItems(db);
            };
            reader.readAsDataURL(blob);
          }
        } else if (item.type.indexOf('text/plain') !== -1) {
          item.getAsString(async (text) => {
            if (text.trim()) {
              await db.add(STORE_NAME, {
                type: 'text',
                content: text,
                timestamp: Date.now(),
              });
              loadItems(db);
            }
          });
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSettings) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleCopyAndPaste(filteredItems[selectedIndex]);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (searchQuery) {
            setSearchQuery('');
        } else {
            // 如果需要，通过 IPC 隐藏窗口，但通常由全局快捷键切换处理
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, items, searchQuery, showSettings]);

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    
    if (item.type === 'text') {
      return (item.content as string).toLowerCase().includes(searchQuery.toLowerCase());
    }
    
    return false;
  });

  const handleCopyAndPaste = async (item: ClipboardItem) => {
    const logToMain = (level: 'info' | 'warn' | 'error', message: string, ...data: any[]) => {
        if (typeof window !== 'undefined' && window.require) {
            try {
                window.require('electron').ipcRenderer.send('log-message', { level, message, data });
            } catch (e) {
                console[level](message, ...data);
            }
        } else {
            console[level](message, ...data);
        }
    };

    try {
      logToMain('info', `Attempting to copy and paste item of type: ${item.type}`);
      if (item.type === 'text') {
        await navigator.clipboard.writeText(item.content as string);
      } else if (item.type === 'image') {
        const blob = item.content as Blob;
        await navigator.clipboard.write([
          new window.ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
      }
      
      // 在主进程中触发粘贴
      if (typeof window !== 'undefined' && window.require) {
        const { ipcRenderer } = window.require('electron');
        logToMain('info', 'Sending paste-content IPC message to main process');
        ipcRenderer.send('paste-content');
      }

      setToastMessage(t.copiedAndPasted);
    } catch (err: any) {
      logToMain('error', 'Failed to copy:', err.message || String(err));
      setToastMessage(t.copyFailed);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const db = await openDB(DB_NAME, 1);
    await db.delete(STORE_NAME, id);
    loadItems(db);
  };

  const clearAll = async () => {
    if (confirm(t.confirmClear)) {
      const db = await openDB(DB_NAME, 1);
      await db.clear(STORE_NAME);
      loadItems(db);
      setToastMessage(t.historyCleared);
    }
  };

  const saveSettings = () => {
    // 提交更改
    setShortcut(tempSettings.shortcut);
    setMaxItems(tempSettings.maxItems);
    setMaxLines(tempSettings.maxLines);
    setWindowPosition(tempSettings.windowPosition);
    setShowDock(tempSettings.showDock);
    setShowTray(tempSettings.showTray);
    setAutoLaunch(tempSettings.autoLaunch);
    setLanguage(tempSettings.language);

    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-auto-launch', tempSettings.autoLaunch);
    }

    localStorage.setItem('shortcut', tempSettings.shortcut);
    localStorage.setItem('maxItems', tempSettings.maxItems.toString());
    localStorage.setItem('maxLines', tempSettings.maxLines.toString());
    localStorage.setItem('windowPosition', tempSettings.windowPosition);
    localStorage.setItem('showDock', String(tempSettings.showDock));
    localStorage.setItem('showTray', String(tempSettings.showTray));
    localStorage.setItem('language', tempSettings.language);
    
    setShowSettings(false);
    setIsRecordingShortcut(false);
    // 重新加载项目以遵守新限制
    openDB(DB_NAME, 1).then(loadItems);
  };

  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const modifiers = [];
    if (e.metaKey) modifiers.push('Command'); // Electron 在 Mac 上使用 Command
    if (e.ctrlKey && !e.metaKey) modifiers.push('Control'); // 如果同时按下，避免在 mac 上出现双重 command/control？通常 meta 是 command
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    // 如果只按下了修饰键，暂时不要设置
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;

    let key = e.key.toUpperCase();
    if (key === ' ') key = 'Space';
    
    // 构建 Electron 加速器字符串
    let electronModifiers = [];
    if (e.metaKey) electronModifiers.push('Command');
    if (e.ctrlKey) electronModifiers.push('Control');
    if (e.altKey) electronModifiers.push('Alt');
    if (e.shiftKey) electronModifiers.push('Shift');
    
    // 如果没有修饰键，可能是无效的全局快捷键，但让我们允许 F 键等。
    const newShortcut = [...electronModifiers, key].join('+');
    setTempSettings(prev => ({ ...prev, shortcut: newShortcut }));
    setIsRecordingShortcut(false);
  };

  // 将选定的项目滚动到视图中
  useEffect(() => {
    if (listRef.current) {
      // 查找选定项目的实际 DOM 元素
      // 我们需要通过 id 或 class 查询，因为 AnimatePresence 可能会添加/删除元素
      const selectedEl = listRef.current.querySelector(`#item-${filteredItems[selectedIndex]?.id}`) as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex, filteredItems]);

  // 监听 Electron 剪贴板事件
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        
        const logToMain = (level: 'info' | 'warn' | 'error', message: string, ...data: any[]) => {
          try {
            ipcRenderer.send('log-message', { level, message, data });
          } catch (e) {
            console[level](message, ...data);
          }
        };

        const handleClipboardChanged = async (_: any, item: any) => {
          // 动态导入以避免 SSR 问题（如果有的话）（虽然这是 SPA）
          const { addClipboardItem } = await import('../services/db');
          
          let content: string | Blob = item.content;
          let preview = undefined;

          if (item.type === 'image') {
             const res = await fetch(item.content);
             content = await res.blob();
             preview = item.content;
          }

          await addClipboardItem({
              type: item.type,
              content: content,
              preview: preview,
              timestamp: item.timestamp
          });
          
          const db = await openDB(DB_NAME, 1);
          loadItems(db);
        };

        ipcRenderer.on('clipboard-changed', handleClipboardChanged);
        return () => {
          ipcRenderer.removeListener('clipboard-changed', handleClipboardChanged);
        };
      } catch (e: any) {
        console.error('Electron IPC not available', e);
      }
    }
  }, [maxItems]);

  return (
    <div className="flex flex-col h-screen bg-gray-50/90 backdrop-blur-xl text-gray-800 font-sans overflow-hidden select-none">
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      
      {/* 头部 / 搜索 */}
      <div 
        className="flex-none px-3 pt-3 pb-2 bg-white/80 border-b border-gray-200 shadow-sm z-10 backdrop-blur-md"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                    ref={searchInputRef}
                    type="text"
                    className="block w-full pl-8 pr-8 py-1.5 bg-gray-100 border-none rounded-md text-sm focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition-all shadow-inner placeholder-gray-400"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedIndex(0);
                    }}
                    autoFocus
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
            <button 
                onClick={() => setShowSettings(true)}
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
                title={t.settings}
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <Settings size={16} />
            </button>
        </div>
        
        <div className="flex justify-between items-center text-[10px] text-gray-400 px-1">
          <div className="flex gap-3 items-center">
            <span><kbd className="font-sans bg-gray-100 px-1 rounded">↵</kbd> {t.paste}</span>
            <span><kbd className="font-sans bg-gray-100 px-1 rounded">↑↓</kbd> {t.select}</span>
          </div>
          <button 
            onClick={clearAll} 
            className="hover:text-red-600 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {t.clearHistory}
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-2" ref={listRef}>
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                id={`item-${item.id}`}
                onClick={() => {
                    setSelectedIndex(index);
                    handleCopyAndPaste(item);
                }}
                className={cn(
                  "group relative flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer",
                  selectedIndex === index
                    ? "bg-blue-50 border-blue-200 shadow-sm"
                    : "bg-white border-gray-100 hover:border-gray-200"
                )}
              >
                {/* 图标 */}
                <div className={cn(
                  "flex-none p-1.5 rounded-md mt-0.5",
                  selectedIndex === index ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                )}>
                  {item.type === 'text' ? <Copy size={14} /> : <ImageIcon size={14} />}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-[10px] font-medium text-gray-400 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {item.type === 'text' ? (
                    <p 
                      className={cn(
                        "text-xs font-mono whitespace-pre-wrap break-words leading-relaxed",
                        selectedIndex === index ? "text-gray-900" : "text-gray-600",
                        maxLines > 0 ? "overflow-hidden" : ""
                      )}
                      style={maxLines > 0 ? {
                        display: '-webkit-box',
                        WebkitLineClamp: maxLines,
                        WebkitBoxOrient: 'vertical'
                      } : {}}
                    >
                      {item.content as string}
                    </p>
                  ) : (
                    <div className="mt-1 rounded border border-gray-100 bg-gray-50 w-fit max-w-full">
                      <img 
                        src={item.preview} 
                        alt="Clipboard Image" 
                        className="max-h-32 object-contain" 
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                {/* 操作 */}
                <div className="flex-none flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-white/80 backdrop-blur-sm rounded shadow-sm border border-gray-100">
                    <button
                        onClick={(e) => handleDelete(e, item.id!)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title={t.delete}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Command size={24} className="opacity-50" />
              </div>
              <p className="text-sm font-medium text-gray-500">{t.noRecords}</p>
              <p className="text-xs mt-1">{t.noRecordsDesc}</p>
            </div>
          )}
        </div>
      </div>

      {/* 设置模态框 */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                        <Settings size={16} className="text-gray-500" /> {t.settings}
                    </h3>
                    <button 
                        onClick={() => {
                            setShowSettings(false);
                            setIsRecordingShortcut(false);
                        }}
                        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-md transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
                
                {/* Content */}
                <div className="p-5 space-y-6 overflow-y-auto">
                    {/* General Section */}
                    <div className="space-y-4">
                        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t.settings}</h4>
                        
                        {/* Shortcut */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Keyboard size={14} className="text-gray-400" /> {t.shortcut}
                            </label>
                            <div 
                                className={cn(
                                    "w-full px-3 py-2.5 bg-gray-50 border rounded-lg text-sm flex items-center justify-center cursor-pointer transition-all",
                                    isRecordingShortcut ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20" : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-100/50"
                                )}
                                onClick={() => setIsRecordingShortcut(true)}
                                onKeyDown={isRecordingShortcut ? handleShortcutKeyDown : undefined}
                                tabIndex={0}
                            >
                                {isRecordingShortcut ? (
                                    <span className="animate-pulse font-medium">{t.pressShortcut}</span>
                                ) : (
                                    <div className="flex items-center gap-1 font-mono">
                                        {renderShortcut(tempSettings.shortcut)}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Max Items */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Layers size={14} className="text-gray-400" /> {t.maxItems}
                            </label>
                            <input 
                                type="number" 
                                value={tempSettings.maxItems}
                                onChange={(e) => setTempSettings(prev => ({ ...prev, maxItems: Number(e.target.value) }))}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        {/* Max Lines */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <AlignLeft size={14} className="text-gray-400" /> {t.maxLines}
                            </label>
                            <select 
                                value={tempSettings.maxLines}
                                onChange={(e) => setTempSettings(prev => ({ ...prev, maxLines: Number(e.target.value) }))}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                            >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={4}>4</option>
                                <option value={5}>5</option>
                                <option value={0}>{t.unlimitedLines}</option>
                            </select>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full"></div>

                    {/* Appearance & System Section */}
                    <div className="space-y-4">
                        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t.appearanceAndSystem}</h4>
                        
                        {/* Window Position */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Monitor size={14} className="text-gray-400" /> {t.windowPosition}
                            </label>
                            <select 
                                value={tempSettings.windowPosition}
                                onChange={(e) => setTempSettings(prev => ({ ...prev, windowPosition: e.target.value }))}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                            >
                                <option value="mouse">{t.followMouse}</option>
                                <option value="top-right">{t.topRight}</option>
                                <option value="top-left">{t.topLeft}</option>
                                <option value="bottom-right">{t.bottomRight}</option>
                                <option value="bottom-left">{t.bottomLeft}</option>
                            </select>
                        </div>
                        
                        {/* Toggles */}
                        <div className="space-y-3 pt-2">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <LayoutTemplate size={14} className="text-gray-400" /> {t.showDock}
                                </div>
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        checked={tempSettings.showDock}
                                        onChange={(e) => setTempSettings(prev => ({ ...prev, showDock: e.target.checked }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                </div>
                            </label>

                            <label className="flex items-center justify-between cursor-pointer group">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <AppWindow size={14} className="text-gray-400" /> {t.showTray}
                                </div>
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        checked={tempSettings.showTray}
                                        onChange={(e) => setTempSettings(prev => ({ ...prev, showTray: e.target.checked }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                </div>
                            </label>

                            <label className="flex items-center justify-between cursor-pointer group">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Rocket size={14} className="text-gray-400" /> {t.autoLaunch}
                                </div>
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        checked={tempSettings.autoLaunch}
                                        onChange={(e) => setTempSettings(prev => ({ ...prev, autoLaunch: e.target.checked }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                                </div>
                            </label>

                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                    <Globe size={14} className="text-gray-400" /> {t.language}
                                </div>
                                <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                                    <button
                                        onClick={() => setTempSettings(prev => ({ ...prev, language: 'zh' }))}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            tempSettings.language === 'zh' 
                                                ? "bg-white text-gray-900 shadow-sm" 
                                                : "text-gray-500 hover:text-gray-700"
                                        )}
                                    >
                                        中文
                                    </button>
                                    <button
                                        onClick={() => setTempSettings(prev => ({ ...prev, language: 'en' }))}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            tempSettings.language === 'en' 
                                                ? "bg-white text-gray-900 shadow-sm" 
                                                : "text-gray-500 hover:text-gray-700"
                                        )}
                                    >
                                        EN
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button 
                        onClick={() => {
                            setShowSettings(false);
                            setIsRecordingShortcut(false);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200/50 bg-gray-100 rounded-lg transition-colors"
                    >
                        {t.cancel}
                    </button>
                    <button 
                        onClick={saveSettings}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                    >
                        {t.save}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

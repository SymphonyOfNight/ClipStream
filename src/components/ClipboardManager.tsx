import React, { useEffect, useState, useRef } from 'react';
import { openDB } from 'idb';
import { cn } from '../lib/utils';
import { Copy, Image as ImageIcon, Trash2, Search, Command, X, Settings, Pin, PinOff, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Toast from './Toast';

interface ClipboardItem {
  id?: number;
  type: 'text' | 'image';
  content: string | Blob;
  timestamp: number;
  preview?: string;
}

const DB_NAME = 'clipstream-db';
const STORE_NAME = 'items';

// Helper to format shortcut for display
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
  const [isPinned, setIsPinned] = useState(false);
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
        return stored !== null ? stored === 'true' : false;
    }
    return false;
  });
  
  // Temporary settings state for modal
  const [tempSettings, setTempSettings] = useState({
    shortcut: '',
    maxItems: 50,
    windowPosition: 'mouse',
    showDock: true,
    showTray: false
  });

  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Initialize DB and load items
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
  }, []);

  // Initialize temp settings when opening modal
  useEffect(() => {
    if (showSettings) {
      setTempSettings({
        shortcut,
        maxItems,
        windowPosition,
        showDock,
        showTray
      });
    }
  }, [showSettings]);

  // Update dock visibility
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-show-dock', showDock);
    }
  }, [showDock]);

  // Update tray visibility
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-show-tray', showTray);
    }
  }, [showTray]);

  // Handle settings open/close for shortcut disabling and blur ignoring
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      if (showSettings) {
        ipcRenderer.send('set-shortcut-enabled', false);
        ipcRenderer.send('set-ignore-blur', true);
      } else {
        ipcRenderer.send('set-shortcut-enabled', true);
        ipcRenderer.send('set-ignore-blur', false);
        // Ensure current shortcut is active
        ipcRenderer.send('update-shortcut', shortcut);
      }
    }
  }, [showSettings, shortcut]);

  // Update shortcut in main process (only when not in settings, or handled by above effect)
  // Actually, we only want to update when shortcut changes AND we are not in settings (or just let the above effect handle re-enabling)
  // But if we change shortcut while in settings, we don't want to register it yet until we close settings?
  // Or we can register it but it's disabled.
  // Let's keep the original effect but maybe it's redundant if we handle it in showSettings effect.
  // However, on initial load, showSettings is false, so we need to register.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require && !showSettings) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('update-shortcut', shortcut);
    }
  }, [shortcut]);

  // Update window position in main process
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

  // Handle Paste Event (Manual paste into window)
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
              // Add logic handled by db service usually, but here we do it manually for now
              // Ideally should use addClipboardItem service
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

  // Keyboard Navigation
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
            // Hide window via IPC if needed, but usually handled by global shortcut toggle
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
    try {
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
      
      // Trigger paste in main process
      if (typeof window !== 'undefined' && window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('paste-content');
      }

      setToastMessage('已复制并粘贴');
    } catch (err) {
      console.error('Failed to copy:', err);
      setToastMessage('复制失败');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const db = await openDB(DB_NAME, 1);
    await db.delete(STORE_NAME, id);
    loadItems(db);
  };

  const clearAll = async () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      const db = await openDB(DB_NAME, 1);
      await db.clear(STORE_NAME);
      loadItems(db);
      setToastMessage('历史记录已清空');
    }
  };

  const togglePin = () => {
    const newState = !isPinned;
    setIsPinned(newState);
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-always-on-top', newState);
    }
  };

  const saveSettings = () => {
    // Commit changes
    setShortcut(tempSettings.shortcut);
    setMaxItems(tempSettings.maxItems);
    setWindowPosition(tempSettings.windowPosition);
    setShowDock(tempSettings.showDock);
    setShowTray(tempSettings.showTray);

    localStorage.setItem('shortcut', tempSettings.shortcut);
    localStorage.setItem('maxItems', tempSettings.maxItems.toString());
    localStorage.setItem('windowPosition', tempSettings.windowPosition);
    localStorage.setItem('showDock', String(tempSettings.showDock));
    localStorage.setItem('showTray', String(tempSettings.showTray));
    
    setShowSettings(false);
    setIsRecordingShortcut(false);
    // Reload items to respect new limit
    openDB(DB_NAME, 1).then(loadItems);
  };

  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const modifiers = [];
    if (e.metaKey) modifiers.push('Command'); // Electron uses Command on Mac
    if (e.ctrlKey && !e.metaKey) modifiers.push('Control'); // Avoid double command/control on mac if both pressed? usually meta is command
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    // If only modifiers are pressed, don't set yet
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;

    let key = e.key.toUpperCase();
    if (key === ' ') key = 'Space';
    
    // Construct Electron accelerator string
    let electronModifiers = [];
    if (e.metaKey) electronModifiers.push('Command');
    if (e.ctrlKey) electronModifiers.push('Control');
    if (e.altKey) electronModifiers.push('Alt');
    if (e.shiftKey) electronModifiers.push('Shift');
    
    // If no modifiers, might be invalid global shortcut, but let's allow F-keys etc.
    const newShortcut = [...electronModifiers, key].join('+');
    setTempSettings(prev => ({ ...prev, shortcut: newShortcut }));
    setIsRecordingShortcut(false);
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Listen for Electron clipboard events
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        const handleClipboardChanged = async (_: any, item: any) => {
          // Dynamic import to avoid SSR issues if any (though this is SPA)
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
      } catch (e) {
        console.error('Electron IPC not available', e);
      }
    }
  }, [maxItems]);

  return (
    <div className="flex flex-col h-screen bg-gray-50/90 backdrop-blur-xl text-gray-800 font-sans overflow-hidden select-none">
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      
      {/* Header / Search */}
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
                    placeholder="搜索剪贴板..."
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
                onClick={togglePin}
                className={cn("p-1.5 rounded-md transition-colors", isPinned ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-500")}
                title={isPinned ? "取消固定" : "固定窗口"}
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>
            <button 
                onClick={() => setShowSettings(true)}
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
                title="设置"
                style={{ WebkitAppRegion: 'no-drag' } as any}
            >
                <Settings size={16} />
            </button>
        </div>
        
        <div className="flex justify-between items-center text-[10px] text-gray-400 px-1">
          <div className="flex gap-3 items-center">
            <span><kbd className="font-sans bg-gray-100 px-1 rounded">↵</kbd> 粘贴</span>
            <span><kbd className="font-sans bg-gray-100 px-1 rounded">↑↓</kbd> 选择</span>
          </div>
          <button 
            onClick={clearAll} 
            className="hover:text-red-600 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            清空历史
          </button>
        </div>
      </div>

      {/* List */}
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
                {/* Icon */}
                <div className={cn(
                  "flex-none p-1.5 rounded-md mt-0.5",
                  selectedIndex === index ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                )}>
                  {item.type === 'text' ? <Copy size={14} /> : <ImageIcon size={14} />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-[10px] font-medium text-gray-400 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {item.type === 'text' ? (
                    <p className={cn(
                        "text-xs font-mono whitespace-pre-wrap break-words line-clamp-2 leading-relaxed",
                        selectedIndex === index ? "text-gray-900" : "text-gray-600"
                    )}>
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

                {/* Actions */}
                <div className="flex-none flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-white/80 backdrop-blur-sm rounded shadow-sm border border-gray-100">
                    <button
                        onClick={(e) => handleDelete(e, item.id!)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="删除"
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
              <p className="text-sm font-medium text-gray-500">暂无记录</p>
              <p className="text-xs mt-1">复制 (⌘C) 内容后将自动显示在这里</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-4 space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Settings size={16} /> 设置
                </h3>
                
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">快捷键</label>
                        <div 
                            className={cn(
                                "w-full px-3 py-2 bg-gray-50 border rounded text-sm flex items-center justify-center cursor-pointer transition-colors",
                                isRecordingShortcut ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:border-gray-300"
                            )}
                            onClick={() => setIsRecordingShortcut(true)}
                            onKeyDown={isRecordingShortcut ? handleShortcutKeyDown : undefined}
                            tabIndex={0}
                        >
                            {isRecordingShortcut ? (
                                <span className="animate-pulse">请按下快捷键...</span>
                            ) : (
                                <div className="flex items-center gap-1 font-mono">
                                    {renderShortcut(tempSettings.shortcut)}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">最大历史记录数</label>
                        <input 
                            type="number" 
                            value={tempSettings.maxItems}
                            onChange={(e) => setTempSettings(prev => ({ ...prev, maxItems: Number(e.target.value) }))}
                            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">窗口位置</label>
                        <select 
                            value={tempSettings.windowPosition}
                            onChange={(e) => setTempSettings(prev => ({ ...prev, windowPosition: e.target.value }))}
                            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            <option value="mouse">跟随鼠标</option>
                            <option value="top-right">右上角</option>
                            <option value="top-left">左上角</option>
                            <option value="bottom-right">右下角</option>
                            <option value="bottom-left">左下角</option>
                        </select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-500">显示在程序坞</label>
                        <input 
                            type="checkbox" 
                            checked={tempSettings.showDock}
                            onChange={(e) => setTempSettings(prev => ({ ...prev, showDock: e.target.checked }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-500">显示在菜单栏</label>
                        <input 
                            type="checkbox" 
                            checked={tempSettings.showTray}
                            onChange={(e) => setTempSettings(prev => ({ ...prev, showTray: e.target.checked }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button 
                        onClick={() => {
                            setShowSettings(false);
                            setIsRecordingShortcut(false);
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                    >
                        取消
                    </button>
                    <button 
                        onClick={saveSettings}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

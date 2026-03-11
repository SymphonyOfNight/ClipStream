import { openDB, DBSchema } from 'idb';

interface ClipboardItem {
  id?: number;
  type: 'text' | 'image';
  content: string | Blob; // Text content or Image Blob
  timestamp: number;
  preview?: string; // For images, a small base64 preview or object URL
}

interface ClipboardDB extends DBSchema {
  items: {
    key: number;
    value: ClipboardItem;
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'clipstream-db';
const STORE_NAME = 'items';

export const initDB = async () => {
  return openDB<ClipboardDB>(DB_NAME, 1, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, {
        keyPath: 'id',
        autoIncrement: true,
      });
      store.createIndex('by-timestamp', 'timestamp');
    },
  });
};

export const addClipboardItem = async (item: Omit<ClipboardItem, 'id'>) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.store;
  
  // Deduplication: Check if content already exists (only for text)
  let cursor = await store.openCursor();
  let existingId: number | undefined;

  while (cursor) {
    const existingItem = cursor.value;
    
    if (existingItem.type === item.type) {
      if (item.type === 'text' && typeof item.content === 'string' && typeof existingItem.content === 'string') {
        if (item.content.trim() === existingItem.content.trim()) {
          existingId = existingItem.id;
          break;
        }
      }
      // 图片不再进行重复检测，直接作为新记录插入，大幅提升性能
    }
    cursor = await cursor.continue();
  }

  if (existingId) {
    // If exists, update timestamp (move to top)
    const existing = await store.get(existingId);
    if (existing) {
        existing.timestamp = Date.now();
        await store.put(existing);
        await tx.done;
        return existingId;
    }
  }

  // If not exists, add new
  const id = await store.add(item);
  await tx.done;
  return id;
};

export const getClipboardHistory = async (limit = 50) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('by-timestamp');
  let cursor = await index.openCursor(null, 'prev');
  
  const items: ClipboardItem[] = [];
  let count = 0;
  
  while (cursor && count < limit) {
    items.push(cursor.value);
    count++;
    cursor = await cursor.continue();
  }
  
  return items;
};

export const clearHistory = async () => {
  const db = await initDB();
  return db.clear(STORE_NAME);
};

export const deleteItem = async (id: number) => {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
};

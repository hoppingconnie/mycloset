/**
 * 写真（base64 data URL）を IndexedDB に保存する。
 * localStorage の 5MB 上限を回避するためのストレージ層。
 * Safari 14+ / Chrome / Firefox すべてで動作する。
 */

const DB_NAME    = 'wardrobe';
const STORE_NAME = 'photos';
const VERSION    = 1;

let _db: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (!_db) {
    _db = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
  return _db;
}

export const photoStore = {
  async get(id: string): Promise<string | undefined> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result as string | undefined);
        req.onerror   = () => reject(req.error);
      });
    } catch { return undefined; }
  },

  async set(id: string, dataUrl: string): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  },

  async delete(id: string): Promise<void> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      });
    } catch { /* 無視 */ }
  },

  async getAll(): Promise<Map<string, string>> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const map = new Map<string, string>();
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) { map.set(String(cursor.key), cursor.value as string); cursor.continue(); }
          else resolve(map);
        };
        req.onerror = () => reject(req.error);
      });
    } catch { return new Map(); }
  },

  async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      });
    } catch { /* 無視 */ }
  },
};

/**
 * 旧形式（localStorage の wardrobe:clothes に埋め込まれた photoUrl）を
 * IndexedDB へ一括移行する。初回のみ実行。
 */
export async function migratePhotosToIndexedDB(): Promise<void> {
  if (typeof window === 'undefined') return;
  const FLAG = 'wardrobe:migrated:photos-idb-v1';
  if (localStorage.getItem(FLAG) === '1') return;

  try {
    const raw = localStorage.getItem('wardrobe:clothes');
    if (!raw) { localStorage.setItem(FLAG, '1'); return; }

    const items = JSON.parse(raw) as Array<{ id?: string; photoUrl?: string }>;
    if (items.some(i => i.photoUrl)) {
      for (const item of items) {
        if (item.id && item.photoUrl) {
          await photoStore.set(item.id, item.photoUrl);
        }
      }
      // localStorage から photoUrl を除去して書き戻す（容量解放）
      const stripped = items.map(({ photoUrl: _p, ...rest }) => rest);
      localStorage.setItem('wardrobe:clothes', JSON.stringify(stripped));
    }
    localStorage.setItem(FLAG, '1');
  } catch (e) {
    console.warn('Photo migration failed:', e);
  }
}

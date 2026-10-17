/* IndexedDB の薄いラッパー。
   packs    : テーマパック（取り込んだ JSON そのもの）
   progress : 問題ごとの習熟度。key = `${pack}|${qid}`
   attempts : 英作文の解答履歴（次のテーマ作成時に添削してもらう材料）
   kv       : 設定など */

const DB_NAME = 'theme-english';
const DB_VER = 1;
let dbp = null;

export function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('packs', { keyPath: 'id' });
      d.createObjectStore('progress', { keyPath: 'key' }).createIndex('pack', 'pack');
      d.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true }).createIndex('pack', 'pack');
      d.createObjectStore('kv');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

async function run(store, mode, fn) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const dbGet = (store, key) => run(store, 'readonly', (s) => s.get(key));
export const dbGetAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const dbPut = (store, val, key) => run(store, 'readwrite', (s) => (key === undefined ? s.put(val) : s.put(val, key)));
export const dbDel = (store, key) => run(store, 'readwrite', (s) => s.delete(key));
export const dbByIndex = (store, index, value) =>
  run(store, 'readonly', (s) => s.index(index).getAll(value));

export async function dbBulkPut(store, rows) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    for (const r of rows) s.put(r);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** あるパックに属する行をすべて消す */
export async function dbDelByIndex(store, index, value) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, 'readwrite');
    const req = t.objectStore(store).index(index).openCursor(IDBKeyRange.only(value));
    req.onsuccess = () => {
      const c = req.result;
      if (c) { c.delete(); c.continue(); }
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* 非対応なら何もしない */ }
}

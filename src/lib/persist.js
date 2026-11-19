// Simpan otomatis kertas stiker di browser (IndexedDB), biar ga ilang pas di-refresh.
const DB = 'stikerin';
const STORE = 'doc';
const KEY = 'current';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export async function saveDoc(doc) {
  try {
    await run('readwrite', (s) => s.put(doc, KEY));
    return true;
  } catch (e) {
    console.warn('Simpan otomatis gagal', e);
    return false;
  }
}

export async function loadDoc() {
  try {
    return (await run('readonly', (s) => s.get(KEY))) || null;
  } catch {
    return null;
  }
}

export async function clearDoc() {
  try {
    await run('readwrite', (s) => s.delete(KEY));
  } catch {
    /* abaikan */
  }
}

/** Blob gambar → canvas (buat ngebalikin cutout). */
export async function blobToCanvas(blob) {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  bmp.close?.();
  return c;
}

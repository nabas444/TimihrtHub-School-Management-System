// ─────────────────────────────────────────────────────────────────────────────
// Offline write queue — Phase 3 (PWA & Offline-First)
//
// Requirement doc: "Offline support for attendance entry with background sync
// once re-connected." Built on the browser's native IndexedDB API directly
// (no 'idb'/'localForage' dependency) since this session's sandbox couldn't
// verify a new npm package actually installs.
//
// Usage pattern (see AttendanceMarkPage.jsx):
//   - Try the real API call first.
//   - If it fails because the device is offline (not because the server
//     rejected it), queue{...} the request instead of showing an error.
//   - flushQueue() is called on the browser's 'online' event and replays
//     everything in order; entries that succeed are removed, entries that
//     fail again (still offline, or a real server error) stay queued.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'timhirthub-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-writes';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// entry: { url, method, body, description, createdAt }
export async function queueWrite(entry) {
  const db = await openDb();
  const id = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add({ ...entry, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  notifyQueueChanged();
  return id;
}

export async function getQueuedWrites() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueuedWrite(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  notifyQueueChanged();
}

export const QUEUE_CHANGED_EVENT = 'timhirthub:offline-queue-changed';
function notifyQueueChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

export async function getQueueCount() {
  try {
    const all = await getQueuedWrites();
    return all.length;
  } catch {
    return 0; // IndexedDB unsupported/unavailable — treat as "nothing queued" rather than erroring the UI
  }
}

// Replays every queued write, in the order it was queued, against the given
// axios instance. Stops attempting further entries once one fails so writes
// stay in order (e.g. two attendance saves for the same class shouldn't be
// replayed out of order) — the remaining entries are retried on the next
// flush (next 'online' event or manual retry).
export async function flushQueue(apiClient) {
  const entries = await getQueuedWrites();
  let succeeded = 0;
  for (const entry of entries) {
    try {
      await apiClient.request({ url: entry.url, method: entry.method, data: entry.body });
      await removeQueuedWrite(entry.id);
      succeeded += 1;
    } catch (err) {
      // Still offline, or the server rejected it — leave it queued and stop
      // here so later entries don't jump ahead of this one.
      return { succeeded, remaining: entries.length - succeeded, stoppedOnError: err };
    }
  }
  return { succeeded, remaining: 0, stoppedOnError: null };
}

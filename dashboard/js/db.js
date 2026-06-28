// db.js — IndexedDB repository wrapper (~150 lines).
// Exports: getAll, get, put, hardDelete, bulkPut, query, getByIndex, getByDateRange, initDB.
// Blueprint §3, amendments C6 (hard delete, no soft-delete status='deleted').

import { DB_NAME, DB_VERSION, runMigrations } from './migrations.js?v=4';

let _db = null;

/**
 * Initialize the database. Runs migrations on first connect or version bump.
 * Stores the open DB connection in module scope for reuse.
 * @returns {Promise<void>}
 * @throws {Error} if IndexedDB is unavailable or open fails.
 */
export async function initDB() {
  if (_db) return;

  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment.');
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      runMigrations(event, event.target.result);
    };

    request.onsuccess = (event) => {
      _db = event.target.result;
      resolve();
    };

    request.onerror = (event) => {
      reject(new Error(`IndexedDB open failed: ${event.target.error?.message || 'unknown error'}`));
    };

    request.onblocked = () => {
      reject(new Error('IndexedDB open blocked — close other tabs with this app open.'));
    };
  });
}

/**
 * Get the current DB connection. Throws if initDB() hasn't been called.
 * @returns {IDBDatabase}
 */
function _getDB() {
  if (!_db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return _db;
}

/**
 * Wrap an IDBRequest in a Promise.
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
function _req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Execute a transaction with a read or readwrite mode.
 * @param {string|string[]} storeNames
 * @param {'readonly'|'readwrite'} mode
 * @param {(store: IDBObjectStore) => IDBRequest|void} fn
 * @returns {Promise<any>}
 */
async function _tx(storeNames, mode, fn) {
  const db = _getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const store = tx.objectStore(
      Array.isArray(storeNames) ? storeNames[0] : storeNames
    );

    let result;
    const maybeReq = fn(store);
    if (maybeReq && typeof maybeReq.onsuccess !== 'undefined') {
      maybeReq.onsuccess = () => { result = maybeReq.result; };
      maybeReq.onerror = () => reject(maybeReq.error);
    }

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

/**
 * Get all records from a store (all statuses — active, archived, etc.).
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
export async function getAll(storeName) {
  const db = _getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a single record by ID.
 * @param {string} storeName
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function get(storeName, id) {
  const db = _getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Put a record (insert or update). Auto-increments version + sets updated_at.
 * If the record has no version, it's a new record: version=1, created_at=now.
 * If it already exists, version++ and updated_at=now (created_at preserved).
 *
 * @param {string} storeName
 * @param {Object} record — must have an `id` field.
 * @returns {Promise<Object>} the saved record.
 */
export async function put(storeName, record) {
  const db = _getDB();
  const now = new Date().toISOString();

  // Fetch existing record to determine version + created_at
  const existing = await get(storeName, record.id);

  let toSave;
  if (existing) {
    // Update: increment version, preserve created_at, update updated_at
    toSave = {
      ...existing,
      ...record,
      created_at: existing.created_at, // immutable
      id: existing.id, // immutable
      version: (existing.version || 0) + 1,
      updated_at: now,
    };
  } else {
    // New record
    toSave = {
      ...record,
      version: record.version || 1,
      created_at: record.created_at || now,
      updated_at: now,
    };
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(toSave);
    request.onsuccess = () => resolve(toSave);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Hard delete a record by ID. Removes it from IndexedDB entirely.
 * No soft-delete. (Amendment C6)
 * @param {string} storeName
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function hardDelete(storeName, id) {
  const db = _getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Bulk put multiple records. Does NOT auto-increment version (raw put).
 * Used by seed.js for initial data load.
 * @param {string} storeName
 * @param {Array<Object>} records
 * @returns {Promise<void>}
 */
export async function bulkPut(storeName, records) {
  const db = _getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const record of records) {
      store.put(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Bulk put aborted'));
  });
}

/**
 * Query a store with optional index, range, and filter.
 * @param {string} storeName
 * @param {Object} options
 * @param {string} [options.index] — index name to query against
 * @param {IDBKeyRange} [options.range] — key range for index query
 * @param {Function} [options.filter] — filter function: (record) => boolean
 * @returns {Promise<Array>}
 */
export async function query(storeName, { index, range, filter } = {}) {
  const db = _getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    let source = store;
    if (index) {
      source = store.index(index);
    }
    const request = source.getAll(range || null);
    request.onsuccess = () => {
      let results = request.result || [];
      if (filter && typeof filter === 'function') {
        results = results.filter(filter);
      }
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all records matching a specific index key value.
 * @param {string} storeName
 * @param {string} indexName
 * @param {any} key
 * @returns {Promise<Array>}
 */
export async function getByIndex(storeName, indexName, key) {
  return query(storeName, { index: indexName, range: IDBKeyRange.only(key) });
}

/**
 * Get all records where a date field falls within [from, to] (inclusive).
 * Uses getAll + filter since date fields are stored as strings.
 * @param {string} storeName
 * @param {string} dateField
 * @param {string} from — YYYY-MM-DD
 * @param {string} to — YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function getByDateRange(storeName, dateField, from, to) {
  const all = await getAll(storeName);
  return all.filter((record) => {
    const val = record[dateField];
    if (!val) return false;
    return val >= from && val <= to;
  });
}

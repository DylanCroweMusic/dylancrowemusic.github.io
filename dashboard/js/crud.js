// crud.js — Shared CRUD abstraction for all 10 entities.
// Exports: create, read, readAll, update, archive, unarchive, deleteEntity.
// Config singleton enforcement (amendment H8). Hard delete (amendment C6).
// Version++ enforced on every update (blueprint §13 invariant 7).

import { get, getAll, put, hardDelete } from './db.js';

// Entity types that support archive (busking_sessions and todos are atomic — no archive)
const ARCHIVABLE = new Set([
  'config',
  'tour_stops',
  'contacts',
  'venues',
  'gigs',
  'house_concerts',
  'busking_spots',
  'expense_log',
]);

// Entities that can be created (config is singleton — seed only)
const CREATABLE = new Set([
  'tour_stops',
  'contacts',
  'venues',
  'gigs',
  'house_concerts',
  'busking_spots',
  'busking_sessions',
  'expense_log',
  'todos',
]);

const ALL_STORES = new Set([
  'config',
  'tour_stops',
  'contacts',
  'venues',
  'gigs',
  'house_concerts',
  'busking_spots',
  'busking_sessions',
  'expense_log',
  'todos',
]);

/**
 * Create a new record. Auto-generates audit fields (id, created_at, updated_at, status, version).
 * Config is a singleton — calling create('config', ...) throws (amendment H8).
 *
 * @param {string} storeName
 * @param {Object} data — entity fields (id should be provided by caller via id generator)
 * @returns {Promise<Object>} the created record
 * @throws {Error} if store is 'config' (singleton) or unknown store
 */
export async function create(storeName, data) {
  if (storeName === 'config') {
    throw new Error('Config is a singleton — use update() only.');
  }
  if (!CREATABLE.has(storeName)) {
    throw new Error(`Unknown or non-creatable store: ${storeName}`);
  }

  const now = new Date().toISOString();
  const record = {
    ...data,
    status: data.status || 'active',
    version: 1,
    created_at: data.created_at || now,
    updated_at: now,
    archived_at: null,
  };

  // For entities with archive support, ensure status defaults to 'active'
  // busking_sessions and todos don't have archive, but still use status='active' for filtering
  if (!ARCHIVABLE.has(storeName)) {
    // busking_sessions, todos — still active by default
    record.status = 'active';
  }

  const saved = await put(storeName, record);
  return saved;
}

/**
 * Read a single record by ID.
 * For config, use read('config', 'cfg_singleton').
 *
 * @param {string} storeName
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function read(storeName, id) {
  if (!ALL_STORES.has(storeName)) {
    throw new Error(`Unknown store: ${storeName}`);
  }
  return get(storeName, id);
}

/**
 * Read all active (non-archived) records from a store.
 * Excludes archived records. To get ALL records including archived, use getAll() from db.js directly.
 *
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
export async function readAll(storeName) {
  if (!ALL_STORES.has(storeName)) {
    throw new Error(`Unknown store: ${storeName}`);
  }
  const all = await getAll(storeName);
  // Filter to active only (excludes archived). Hard-deleted records don't exist (C6).
  // Todos use completed=false/true, but status is still 'active'.
  return all.filter((r) => r.status === 'active');
}

/**
 * Update a record. Version is auto-incremented by db.js put().
 * created_at and id are immutable (preserved by put()).
 *
 * @param {string} storeName
 * @param {string} id
 * @param {Object} changes — partial field updates
 * @returns {Promise<Object>} the updated record
 * @throws {Error} if record not found
 */
export async function update(storeName, id, changes) {
  if (!ALL_STORES.has(storeName)) {
    throw new Error(`Unknown store: ${storeName}`);
  }

  const existing = await get(storeName, id);
  if (!existing) {
    throw new Error(`Record not found: ${storeName}/${id}`);
  }

  // Merge changes into existing record. put() handles version++ and updated_at.
  const updated = { ...existing, ...changes };
  // Force immutable fields back to existing values
  updated.id = existing.id;
  updated.created_at = existing.created_at;

  const saved = await put(storeName, updated);
  return saved;
}

/**
 * Archive a record: set status='archived', archived_at=now.
 * Not available for busking_sessions or todos (atomic entities).
 *
 * @param {string} storeName
 * @param {string} id
 * @returns {Promise<Object>} the archived record
 * @throws {Error} if entity is not archivable or record not found
 */
export async function archive(storeName, id) {
  if (!ARCHIVABLE.has(storeName)) {
    throw new Error(`Entity '${storeName}' does not support archive (atomic entity).`);
  }

  const existing = await get(storeName, id);
  if (!existing) {
    throw new Error(`Record not found: ${storeName}/${id}`);
  }

  const now = new Date().toISOString();
  const archived = {
    ...existing,
    status: 'archived',
    archived_at: now,
  };

  const saved = await put(storeName, archived);
  return saved;
}

/**
 * Un-archive a record: set status='active', archived_at=null.
 *
 * @param {string} storeName
 * @param {string} id
 * @returns {Promise<Object>} the un-archived record
 * @throws {Error} if entity is not archivable or record not found
 */
export async function unarchive(storeName, id) {
  if (!ARCHIVABLE.has(storeName)) {
    throw new Error(`Entity '${storeName}' does not support archive (atomic entity).`);
  }

  const existing = await get(storeName, id);
  if (!existing) {
    throw new Error(`Record not found: ${storeName}/${id}`);
  }

  const unarchived = {
    ...existing,
    status: 'active',
    archived_at: null,
  };

  const saved = await put(storeName, unarchived);
  return saved;
}

/**
 * Hard delete a record from IndexedDB. No soft-delete, no recovery.
 * Config is a singleton — calling deleteEntity('config', ...) throws (amendment H8).
 *
 * @param {string} storeName
 * @param {string} id
 * @returns {Promise<void>}
 * @throws {Error} if store is 'config' (singleton) or record not found
 */
export async function deleteEntity(storeName, id) {
  if (storeName === 'config') {
    throw new Error('Config is a singleton — cannot be deleted.');
  }
  if (!ALL_STORES.has(storeName)) {
    throw new Error(`Unknown store: ${storeName}`);
  }

  // Verify record exists (provide a clear error if not)
  const existing = await get(storeName, id);
  if (!existing) {
    throw new Error(`Record not found: ${storeName}/${id}`);
  }

  await hardDelete(storeName, id);
}

/**
 * Read all records including archived. Convenience wrapper around db.getAll().
 * Useful for archive views.
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
export async function readAllIncludingArchived(storeName) {
  if (!ALL_STORES.has(storeName)) {
    throw new Error(`Unknown store: ${storeName}`);
  }
  return getAll(storeName);
}

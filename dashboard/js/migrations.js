// migrations.js — Schema v1. Single source of truth for IndexedDB object stores + indexes.
// Blueprint §1 (10 entities), §3 (tech stack), amendments C1 (no income_log), C5 (completed on tour_stops), C4 (host_contact_id nullable).

export const DB_NAME = 'tourOS_v4';
export const DB_VERSION = 1;

// 10 object stores. NO income_log (amendment C1).
export const STORES = [
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
];

// Index definitions per store: { name, keyPath, unique? }
export const INDEXES = {
  config: [],
  tour_stops: [
    { name: 'completed', keyPath: 'completed' },
  ],
  contacts: [],
  venues: [
    { name: 'tour_stop_id', keyPath: 'tour_stop_id' },
    { name: 'pipeline_status', keyPath: 'pipeline_status' },
    { name: 'primary_contact_id', keyPath: 'primary_contact_id' },
  ],
  gigs: [
    { name: 'tour_stop_id', keyPath: 'tour_stop_id' },
    { name: 'venue_id', keyPath: 'venue_id' },
    { name: 'gig_status', keyPath: 'gig_status' },
  ],
  house_concerts: [
    { name: 'tour_stop_id', keyPath: 'tour_stop_id' },
    { name: 'pipeline_status', keyPath: 'pipeline_status' },
    { name: 'host_contact_id', keyPath: 'host_contact_id' },
  ],
  busking_spots: [
    { name: 'tour_stop_id', keyPath: 'tour_stop_id' },
    { name: 'pipeline_status', keyPath: 'pipeline_status' },
  ],
  busking_sessions: [
    { name: 'tour_stop_id', keyPath: 'tour_stop_id' },
    { name: 'busking_spot_id', keyPath: 'busking_spot_id' },
  ],
  expense_log: [
    { name: 'tour_stop_id', keyPath: 'tour_stop_id' },
  ],
  todos: [
    { name: 'linked_entity_id', keyPath: 'linked_entity_id' },
    { name: 'auto_rule', keyPath: 'auto_rule' },
  ],
};

/**
 * Run migrations onupgradeneeded. Called by db.js initDB().
 * Forward-only, idempotent within the same version.
 * @param {IDBVersionChangeEvent} event
 * @param {IDBDatabase} db
 */
export function runMigrations(event, db) {
  const oldVersion = event.oldVersion;

  // v1: create all stores + indexes
  if (oldVersion < 1) {
    for (const storeName of STORES) {
      const store = db.createObjectStore(storeName, {
        keyPath: 'id',
        autoIncrement: false,
      });

      const indexes = INDEXES[storeName] || [];
      for (const idx of indexes) {
        store.createIndex(idx.name, idx.keyPath, {
          unique: false, // all indexes non-unique (C4: host_contact_id non-unique)
        });
      }
    }
  }

  // Future migrations: if (oldVersion < 2) { ... }
}

// Store names for iteration
export const ALL_STORE_NAMES = STORES;

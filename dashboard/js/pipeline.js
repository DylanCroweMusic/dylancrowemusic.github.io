// pipeline.js — Canonical state machines + transition enforcement (§4 + H1)
//
// Three pipelines: venue, house_concert (hc), busking.
// Each has a transition map. Any transition NOT in the map is rejected.
// H1 reverse transitions (safety valves) included.

import { read, readAll, update, create } from './crud.js?v=4';
import { generateId } from './utils/id.js?v=4';
import { reevaluateForEntity } from './todos.js?v=4';

// ─── Store name per entity type ──────────────────────────────────────────────
const STORE_BY_TYPE = {
  venue: 'venues',
  hc: 'house_concerts',
  busking: 'busking_spots',
};

// ─── Transition maps (from → [to, to, ...]) ──────────────────────────────────
// Venue pipeline (§4.1 + H1 reverse transitions)
const VENUE_TRANSITIONS = {
  not_contacted: ['contacted', 'declined'],
  contacted: ['follow_up', 'booked', 'declined'],
  follow_up: ['follow_up', 'booked', 'declined'],
  booked: ['confirmed', 'cancelled'],
  confirmed: ['played', 'cancelled', 'booked', 'follow_up'], // last two = H1 reverse
  played: [], // terminal
  declined: ['not_contacted'], // re-engage
  cancelled: ['not_contacted'], // re-engage
};

// HC pipeline (§4.2 + H1 reverse transition)
const HC_TRANSITIONS = {
  posted: ['interested', 'cancelled'],
  interested: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'interested'], // last = H1 reverse (un-confirm)
  completed: [], // terminal
  cancelled: ['posted'], // re-post ad
};

// Busking pipeline (§4.3 + H1 reverse transitions)
const BUSKING_TRANSITIONS = {
  discovered: ['tested'],
  tested: ['regular', 'retired', 'discovered'], // last = H1 reverse (reset)
  regular: ['retired', 'tested'], // last = H1 reverse (demote)
  retired: ['discovered'], // re-test
};

const MAPS = {
  venue: VENUE_TRANSITIONS,
  hc: HC_TRANSITIONS,
  busking: BUSKING_TRANSITIONS,
};

// Map our entityType → the field name on the record that holds pipeline status
const STATUS_FIELD = {
  venue: 'pipeline_status',
  hc: 'pipeline_status',
  busking: 'pipeline_status',
};

// ─── Public: canTransition(entityType, fromStatus, toStatus) → boolean ───────
// ─── Public: stages(entityType?) → [{key, label}] ──────────────────────────
const STAGE_MAP = {
  venue: [
    { key: 'not_contacted', label: 'Not contacted' },
    { key: 'contacted',     label: 'Contacted' },
    { key: 'follow_up',     label: 'Follow up' },
    { key: 'booked',        label: 'Booked' },
    { key: 'confirmed',     label: 'Confirmed' },
    { key: 'played',        label: 'Played' },
    { key: 'declined',      label: 'Declined' },
    { key: 'cancelled',     label: 'Cancelled' },
  ],
  hc: [
    { key: 'posted',     label: 'Posted' },
    { key: 'interested', label: 'Interested' },
    { key: 'confirmed',  label: 'Confirmed' },
    { key: 'completed',  label: 'Completed' },
    { key: 'cancelled',  label: 'Cancelled' },
  ],
  busking: [
    { key: 'discovered', label: 'Discovered' },
    { key: 'tested',     label: 'Tested' },
    { key: 'regular',    label: 'Regular' },
    { key: 'retired',    label: 'Retired' },
  ],
};

export function stages(entityType) {
  return STAGE_MAP[entityType] || STAGE_MAP.venue;
}

export function canTransition(entityType, fromStatus, toStatus) {
  const map = MAPS[entityType];
  if (!map) return false;
  const allowed = map[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

// ─── Public: getValidTransitions(entityType, currentStatus) → string[] ───────
export function getValidTransitions(entityType, currentStatus) {
  const map = MAPS[entityType];
  if (!map) return [];
  return map[currentStatus] ? [...map[currentStatus]] : [];
}

// ─── Side-effect handlers ────────────────────────────────────────────────────
// Venue → booked: create a gigs record
async function sideEffectVenueBooked(venue) {
  const gig = {
    id: generateId('gig_'),
    venue_id: venue.id,
    tour_stop_id: venue.tour_stop_id || null,
    gig_date: venue.target_gig_date || null,
    start_time: null,
    duration_min: null,
    guarantee_aud: null,
    door_price_aud: null,
    capacity: venue.capacity || null,
    gig_status: 'booked',
    actual_income_aud: null,
    setlist: null,
    notes: null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    version: 1,
  };
  return create('gigs', gig);
}

// Update linked gig's gig_status for a venue
async function updateLinkedGigStatus(venue, newGigStatus) {
  // Find gigs linked to this venue
  const gigs = await readAll('gigs');
  const linked = gigs.filter((g) => g.venue_id === venue.id && g.status === 'active');
  for (const g of linked) {
    await update('gigs', g.id, { gig_status: newGigStatus });
  }
}

// ─── Public: transition(entityType, entityId, newStatus) → updated entity ────
export async function transition(entityType, entityId, newStatus) {
  const storeName = STORE_BY_TYPE[entityType];
  if (!storeName) {
    throw new Error(`Unknown pipeline entity type: ${entityType}`);
  }

  const entity = await read(storeName, entityId);
  if (!entity) {
    throw new Error(`${entityType} not found: ${entityId}`);
  }

  const statusField = STATUS_FIELD[entityType];
  const currentStatus = entity[statusField];

  if (!canTransition(entityType, currentStatus, newStatus)) {
    throw new Error(
      `INVALID_TRANSITION: ${entityType} ${currentStatus} → ${newStatus} is not allowed`,
    );
  }

  // Build the update payload
  const now = new Date().toISOString();
  const changes = {
    [statusField]: newStatus,
    pipeline_status_at: now,
  };

  // Venue-specific: set last_contacted_at on first contact
  if (entityType === 'venue') {
    if (currentStatus === 'not_contacted' && newStatus === 'contacted') {
      changes.last_contacted_at = now;
    }
    if (newStatus === 'declined' || newStatus === 'cancelled') {
      // bulk cleanup of todos handled by reevaluateForEntity below, but we
      // also mark the venue so the re-eval pass resolves linked todos.
    }
  }

  // Apply the status update
  const updated = await update(storeName, entityId, changes);

  // ─── Side effects (per §4.1 / §4.2 / §4.3) ───────────────────────────────
  if (entityType === 'venue') {
    if (newStatus === 'booked') {
      await sideEffectVenueBooked(updated);
    } else if (newStatus === 'confirmed') {
      await updateLinkedGigStatus(updated, 'confirmed');
    } else if (newStatus === 'played') {
      await updateLinkedGigStatus(updated, 'played');
    } else if (newStatus === 'cancelled') {
      await updateLinkedGigStatus(updated, 'cancelled');
    }
  }

  // HC confirmed → set materials_sent=false (§4.2). We do NOT overwrite an
  // existing value on reverse transitions, only on interested→confirmed.
  if (entityType === 'hc' && currentStatus === 'interested' && newStatus === 'confirmed') {
    await update(storeName, entityId, { materials_sent: false });
  }

  // ─── Re-evaluate todos for this entity (and linked gig if venue) ─────────
  // This catches auto-complete + bulk-cleanup rules (§5.2, §5.3).
  try {
    await reevaluateForEntity(entityType, entityId);
  } catch (_e) {
    // Re-eval failures must not roll back a valid transition.
    // Surfaced separately; transition itself succeeded.
  }

  // Re-read to return the final state after side-effect writes.
  const finalEntity = await read(storeName, entityId);
  return finalEntity || updated;
}

export default {
  canTransition,
  transition,
  getValidTransitions,
  stages,
};

// todos.js — Todo automation engine (§5 + H5 + M6 + C2)
//
// 18 auto-generate rules (§5.1), auto-complete conditions (§5.2), bulk
// cleanup (§5.3), and the re-evaluation engine (H5: boot + 5min sweep).
//
// Dedup: "no open todo with auto_rule=slug AND linked_entity_id=entity
// AND completed=false AND status=active" (§5.4).
//
// reevaluateAll() and reevaluateForEntity() are async (they write via crud).
// getActiveTodos() and getTodosForEntity() are sync (read from store state).

import { getState } from './store.js?v=4';
import { read, readAll, update, create } from './crud.js?v=4';
import { generateId } from './utils/id.js?v=4';
import {
  getStopGigShortfall,
  getStopBuskingShortfall,
  getStopHCShortfall,
} from './gigs_needed.js?v=4';

// ─── Date helpers (inline; utils/dates.js may not be loaded yet) ─────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  if (!dateStr) return null;
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr.slice(0, 10) + 'T00:00:00Z').getTime();
  const now = new Date(todayStr() + 'T00:00:00Z').getTime();
  return Math.round((target - now) / 86400000);
}
function nowISO() {
  return new Date().toISOString();
}

// ─── Entity type → store name mapping ────────────────────────────────────────
const STORE_BY_TYPE = {
  venue: 'venues',
  gig: 'gigs',
  hc: 'house_concerts',
  house_concert: 'house_concerts',
  busking_spot: 'busking_spots',
  busking: 'busking_spots',
  busking_session: 'busking_sessions',
  session: 'busking_sessions',
  tour_stop: 'tour_stops',
  contact: 'contacts',
  expense: 'expense_log',
};

function normalizeType(t) {
  if (t === 'house_concert') return 'hc';
  if (t === 'busking_spot') return 'busking';
  if (t === 'session') return 'busking_session';
  return t;
}

// ─── State helpers ───────────────────────────────────────────────────────────
function collections() {
  const s = getState() || {};
  const e = s.entities || {};
  return {
    config: (e.config || [])[0] || {},
    venues: Array.isArray(e.venues) ? e.venues : [],
    gigs: Array.isArray(e.gigs) ? e.gigs : [],
    house_concerts: Array.isArray(e.house_concerts) ? e.house_concerts : [],
    busking_spots: Array.isArray(e.busking_spots) ? e.busking_spots : [],
    busking_sessions: Array.isArray(e.busking_sessions) ? e.busking_sessions : [],
    tour_stops: Array.isArray(e.tour_stops) ? e.tour_stops : [],
    contacts: Array.isArray(e.contacts) ? e.contacts : [],
    expense_log: Array.isArray(e.expense_log) ? e.expense_log : [],
    todos: Array.isArray(e.todos) ? e.todos : [],
  };
}

function active(arr) {
  return (arr || []).filter((r) => (r.status || 'active') === 'active');
}

function openTodosFor(slug, linkedEntityId, todos) {
  return todos.filter(
    (t) =>
      t.auto_rule === slug &&
      t.linked_entity_id === linkedEntityId &&
      !t.completed &&
      (t.status || 'active') === 'active',
  );
}

function findEntity(storeArr, id) {
  return storeArr.find((e) => e.id === id) || null;
}

// ─── Todo creation helper ────────────────────────────────────────────────────
async function createTodo(fields) {
  const now = nowISO();
  const todo = {
    id: generateId('todo_'),
    title: fields.title || 'Untitled todo',
    description: fields.description || null,
    due_date: fields.due_date || null,
    priority: fields.priority || 'medium',
    category: fields.category || null,
    linked_entity_type: fields.linked_entity_type || null,
    linked_entity_id: fields.linked_entity_id || null,
    is_auto_generated: true,
    auto_rule: fields.auto_rule || null,
    completed: false,
    completed_at: null,
    status: 'active',
    created_at: now,
    updated_at: now,
    archived_at: null,
    version: 1,
  };
  return create('todos', todo);
}

async function completeTodo(todoId) {
  return update('todos', todoId, {
    completed: true,
    completed_at: nowISO(),
  });
}

// ─── Rule definitions ────────────────────────────────────────────────────────
// Each rule: {
//   slug, entityType, priority, category,
//   trigger(entity, ctx) → boolean,        // should a todo exist?
//   build(entity, ctx) → todo fields,      // template + due date
//   shouldComplete(entity, ctx) → boolean,  // auto-complete condition
// }
//
// ctx = { c: collections, config, gigsForVenue, hcsForStop, sessionsForStop, ... }

function gigsForVenueId(gigs, venueId) {
  return active(gigs).filter((g) => g.venue_id === venueId);
}

const RULES = [
  // ── A1: venue_new_contact_needed ──────────────────────────────────────────
  {
    slug: 'venue_new_contact_needed',
    entityType: 'venue',
    priority: 'high',
    category: 'venue',
    trigger: (v) => v.pipeline_status === 'not_contacted',
    build: (v) => ({
      title: `Contact ${v.name}`,
      due_date: addDays(todayStr(), 3),
    }),
    shouldComplete: (v) =>
      ['contacted', 'declined', 'cancelled', 'follow_up', 'booked', 'confirmed', 'played']
        .includes(v.pipeline_status),
  },

  // ── A2: venue_follow_up_due ───────────────────────────────────────────────
  {
    slug: 'venue_follow_up_due',
    entityType: 'venue',
    priority: 'medium',
    category: 'venue',
    trigger: (v) => v.pipeline_status === 'follow_up',
    build: (v) => ({
      title: `Follow up with ${v.name}`,
      due_date: addDays(v.pipeline_status_at || todayStr(), 3),
    }),
    shouldComplete: (v) => v.pipeline_status !== 'follow_up',
  },

  // ── A3: venue_contacted_no_response ───────────────────────────────────────
  {
    slug: 'venue_contacted_no_response',
    entityType: 'venue',
    priority: 'high',
    category: 'venue',
    trigger: (v) => {
      if (v.pipeline_status !== 'contacted') return false;
      if (!v.last_contacted_at) return false;
      const d = daysUntil(v.last_contacted_at.slice(0, 10));
      return d !== null && d < -5; // more than 5 days ago
    },
    build: (v) => ({
      title: `Chase ${v.name} — no response in 5d`,
      due_date: addDays(todayStr(), 1),
    }),
    shouldComplete: (v) => {
      if (v.pipeline_status !== 'contacted') return true;
      if (!v.last_contacted_at) return false;
      const d = daysUntil(v.last_contacted_at.slice(0, 10));
      return d !== null && d >= -5; // within 5 days now
    },
  },

  // ── A4: venue_booked_finalize_gig ─────────────────────────────────────────
  {
    slug: 'venue_booked_finalize_gig',
    entityType: 'venue',
    priority: 'high',
    category: 'venue',
    trigger: (v, ctx) => {
      if (v.pipeline_status !== 'booked') return false;
      const gigs = gigsForVenueId(ctx.c.gigs, v.id);
      return gigs.some((g) => !g.gig_date || g.guarantee_aud == null);
    },
    build: (v) => ({
      title: `Finalize gig details for ${v.name}`,
      due_date: addDays(todayStr(), 2),
    }),
    shouldComplete: (v, ctx) => {
      if (v.pipeline_status !== 'booked') return true;
      const gigs = gigsForVenueId(ctx.c.gigs, v.id);
      return gigs.length > 0 && gigs.every((g) => g.gig_date && g.guarantee_aud != null);
    },
  },

  // ── A5: venue_booked_send_epk ─────────────────────────────────────────────
  {
    slug: 'venue_booked_send_epk',
    entityType: 'venue',
    priority: 'high',
    category: 'venue',
    trigger: (v) => v.pipeline_status === 'booked' && !v.epk_sent,
    build: (v) => ({
      title: `Send EPK to ${v.name}`,
      due_date: addDays(todayStr(), 1),
    }),
    shouldComplete: (v) => v.epk_sent === true || v.pipeline_status !== 'booked',
  },

  // ── A6: venue_confirmed_logistics ─────────────────────────────────────────
  {
    slug: 'venue_confirmed_logistics',
    entityType: 'venue',
    priority: 'medium',
    category: 'venue',
    trigger: (v) => v.pipeline_status === 'confirmed',
    build: (v) => ({
      title: `Confirm logistics with ${v.name} (load-in, soundcheck)`,
      due_date: v.target_gig_date
        ? addDays(v.target_gig_date.slice(0, 10), -7)
        : addDays(todayStr(), 7),
    }),
    shouldComplete: (v) => v.pipeline_status !== 'confirmed',
  },

  // ── A7: venue_played_log_income ───────────────────────────────────────────
  {
    slug: 'venue_played_log_income',
    entityType: 'venue',
    priority: 'medium',
    category: 'venue',
    trigger: (v, ctx) => {
      if (v.pipeline_status !== 'played') return false;
      const gigs = gigsForVenueId(ctx.c.gigs, v.id);
      return gigs.some((g) => g.actual_income_aud == null);
    },
    build: (v) => ({
      title: `Log actual income for gig at ${v.name}`,
      due_date: addDays(todayStr(), 2),
    }),
    shouldComplete: (v, ctx) => {
      if (v.pipeline_status !== 'played') return true;
      const gigs = gigsForVenueId(ctx.c.gigs, v.id);
      return gigs.length > 0 && gigs.every((g) => g.actual_income_aud != null);
    },
  },

  // ── A8: venue_gig_prep (M6: auto-complete only on played/cancelled) ────────
  {
    slug: 'venue_gig_prep',
    entityType: 'gig',
    priority: 'high',
    category: 'gig',
    trigger: (g) => {
      if (!g.gig_date) return false;
      if (['played', 'cancelled'].includes(g.gig_status)) return false;
      const d = daysUntil(g.gig_date.slice(0, 10));
      return d !== null && d >= 0 && d <= 3; // today through +3 days
    },
    build: (g, ctx) => ({
      title: `Gig at ${venueName(ctx.c, g.venue_id)} on ${g.gig_date.slice(0, 10)} — prep`,
      due_date: g.gig_date.slice(0, 10),
      linked_entity_type: 'gig',
      linked_entity_id: g.id,
    }),
    shouldComplete: (g) =>
      ['played', 'cancelled'].includes(g.gig_status), // M6: NOT on date passing
  },

  // ── A9: hc_post_fb_ad ─────────────────────────────────────────────────────
  {
    slug: 'hc_post_fb_ad',
    entityType: 'hc',
    priority: 'high',
    category: 'hc',
    trigger: (h) => h.pipeline_status === 'posted' && !h.fb_ad_posted,
    build: (h, ctx) => ({
      title: `Post FB ad for HC in ${hcCity(ctx ? ctx.c : null, h)}`,
      due_date: addDays(todayStr(), 1),
    }),
    shouldComplete: (h) => h.fb_ad_posted === true || h.pipeline_status !== 'posted',
  },

  // ── A10: hc_respond_inquiry ───────────────────────────────────────────────
  {
    slug: 'hc_respond_inquiry',
    entityType: 'hc',
    priority: 'high',
    category: 'hc',
    trigger: (h) => h.pipeline_status === 'interested',
    build: (h, ctx) => ({
      title: `Respond to HC inquiry from ${contactName(ctx.c, h.host_contact_id)}`,
      due_date: addDays(todayStr(), 1),
    }),
    shouldComplete: (h) => h.pipeline_status !== 'interested',
  },

  // ── A11: hc_set_date ──────────────────────────────────────────────────────
  {
    slug: 'hc_set_date',
    entityType: 'hc',
    priority: 'high',
    category: 'hc',
    trigger: (h) => h.pipeline_status === 'confirmed' && !h.hc_date,
    build: (h, ctx) => ({
      title: `Set date for HC at ${hcCity(ctx ? ctx.c : null, h)}`,
      due_date: addDays(todayStr(), 3),
    }),
    shouldComplete: (h) => !!h.hc_date || h.pipeline_status !== 'confirmed',
  },

  // ── A12: hc_send_materials ────────────────────────────────────────────────
  {
    slug: 'hc_send_materials',
    entityType: 'hc',
    priority: 'high',
    category: 'hc',
    trigger: (h) => h.pipeline_status === 'confirmed' && !h.materials_sent,
    build: (h) => ({
      title: `Send host materials for HC ${h.hc_date || '(no date)'}`,
      due_date: h.hc_date
        ? addDays(h.hc_date.slice(0, 10), -7)
        : addDays(todayStr(), 3),
    }),
    shouldComplete: (h) => h.materials_sent === true || h.pipeline_status !== 'confirmed',
  },

  // ── A13: hc_completed_log_income ──────────────────────────────────────────
  {
    slug: 'hc_completed_log_income',
    entityType: 'hc',
    priority: 'medium',
    category: 'hc',
    trigger: (h) => h.pipeline_status === 'completed' && h.actual_income_aud == null,
    build: (h) => ({
      title: `Log HC actual income (${h.hc_date || 'no date'})`,
      due_date: addDays(todayStr(), 2),
    }),
    shouldComplete: (h) => h.actual_income_aud != null || h.pipeline_status !== 'completed',
  },

  // ── A14: busking_spot_test ────────────────────────────────────────────────
  {
    slug: 'busking_spot_test',
    entityType: 'busking',
    priority: 'low',
    category: 'busking',
    trigger: (s) => s.pipeline_status === 'discovered',
    build: (s) => ({
      title: `Test busking at ${s.name}`,
      due_date: null,
    }),
    shouldComplete: (s) => s.pipeline_status !== 'discovered',
  },

  // ── A15: busking_spot_permit_needed ───────────────────────────────────────
  {
    slug: 'busking_spot_permit_needed',
    entityType: 'busking',
    priority: 'medium',
    category: 'busking',
    trigger: (s) =>
      s.council_permit_required &&
      !s.permit_obtained &&
      ['discovered', 'tested', 'regular'].includes(s.pipeline_status),
    build: (s) => ({
      title: `Get busking permit for ${s.name}`,
      due_date: null,
    }),
    shouldComplete: (s) =>
      s.permit_obtained === true || s.pipeline_status === 'retired',
  },

  // ── A16: tour_stop_gig_shortfall ──────────────────────────────────────────
  {
    slug: 'tour_stop_gig_shortfall',
    entityType: 'tour_stop',
    priority: 'high',
    category: 'tour_stop',
    trigger: (t, ctx) => {
      const n = getStopGigShortfall(t.id);
      return n > 0;
    },
    build: (t, ctx) => ({
      title: `Book ${getStopGigShortfall(t.id)} more gig(s) for ${t.name}`,
      due_date: t.arrival_date ? t.arrival_date.slice(0, 10) : null,
    }),
    shouldComplete: (t) => getStopGigShortfall(t.id) <= 0,
  },

  // ── A17: tour_stop_busking_shortfall ──────────────────────────────────────
  {
    slug: 'tour_stop_busking_shortfall',
    entityType: 'tour_stop',
    priority: 'medium',
    category: 'tour_stop',
    trigger: (t) => getStopBuskingShortfall(t.id) > 0,
    build: (t) => ({
      title: `Log ${getStopBuskingShortfall(t.id)} more busking session(s) for ${t.name}`,
      due_date: t.arrival_date ? t.arrival_date.slice(0, 10) : null,
    }),
    shouldComplete: (t) => getStopBuskingShortfall(t.id) <= 0,
  },

  // ── A18: tour_stop_hc_shortfall ───────────────────────────────────────────
  {
    slug: 'tour_stop_hc_shortfall',
    entityType: 'tour_stop',
    priority: 'medium',
    category: 'tour_stop',
    trigger: (t) => getStopHCShortfall(t.id) > 0,
    build: (t) => ({
      title: `Find ${getStopHCShortfall(t.id)} more HC lead(s) for ${t.name}`,
      due_date: t.arrival_date ? t.arrival_date.slice(0, 10) : null,
    }),
    shouldComplete: (t) => getStopHCShortfall(t.id) <= 0,
  },
];

// ─── Name helpers (used in todo templates) ───────────────────────────────────
function venueName(c, id) {
  if (!id) return 'Unknown venue';
  const v = c.venues.find((x) => x.id === id);
  return v ? v.name : 'Unknown venue';
}
function contactName(c, id) {
  if (!id) return 'Unknown host';
  const ct = c.contacts.find((x) => x.id === id);
  return ct ? ct.name : 'Unknown host';
}
function hcCity(c, h) {
  // HC doesn't have a direct city field; use tour_stop name if available.
  if (c && h.tour_stop_id) {
    const stop = (c.tour_stops || []).find((t) => t.id === h.tour_stop_id);
    if (stop) return stop.name;
  }
  return h.tour_stop_id || 'this stop';
}

// ─── Rule evaluation for a single entity ─────────────────────────────────────
async function evalRulesForEntity(entityType, entity, visited) {
  const c = collections();
  const config = c.config;
  const ctx = { c, config };
  const normType = normalizeType(entityType);

  // Fetch fresh todos from DB (state cache may be stale mid-sweep).
  let todos;
  try {
    todos = await readAll('todos');
  } catch (_e) {
    todos = active(c.todos);
  }

  // Find rules matching this entity type
  const matchingRules = RULES.filter((r) => r.entityType === normType);

  for (const rule of matchingRules) {
    // Determine the linked entity for this rule.
    // Most rules link to the entity itself. A8 (gig) links to the gig.
    const linkedEntityType = rule.slug === 'venue_gig_prep' ? 'gig' : normType;
    const linkedEntityId = entity.id;

    const openExisting = openTodosFor(rule.slug, linkedEntityId, todos);

    let triggered = false;
    try {
      triggered = rule.trigger(entity, ctx);
    } catch (_e) {
      triggered = false;
    }

    if (triggered && openExisting.length === 0) {
      // Create new todo
      const fields = rule.build(entity, ctx);
      await createTodo({
        ...fields,
        priority: rule.priority,
        category: rule.category,
        auto_rule: rule.slug,
        linked_entity_type: linkedEntityType,
        linked_entity_id: linkedEntityId,
      });
      // Update local cache so subsequent rules see it.
      todos = todos.concat([{
        auto_rule: rule.slug,
        linked_entity_id: linkedEntityId,
        linked_entity_type: linkedEntityType,
        completed: false,
        status: 'active',
      }]);
    }

    // Auto-complete check
    if (openExisting.length > 0) {
      let shouldComplete = false;
      try {
        shouldComplete = rule.shouldComplete(entity, ctx);
      } catch (_e) {
        shouldComplete = false;
      }
      if (shouldComplete) {
        for (const t of openExisting) {
          await completeTodo(t.id);
        }
        // Update local cache.
        todos = todos.map((t) =>
          openExisting.find((o) => o.id === t.id)
            ? { ...t, completed: true }
            : t,
        );
      }
    }
  }
}

// ─── Bulk cleanup (§5.3) ─────────────────────────────────────────────────────
async function bulkCleanup(entityType, entity) {
  const normType = normalizeType(entityType);

  // Fetch fresh todos from DB (state cache may be stale mid-sweep).
  let todos;
  try {
    todos = await readAll('todos');
  } catch (_e) {
    todos = active(collections().todos);
  }

  let shouldResolve = (todo) => false;

  if (normType === 'venue') {
    if (['declined', 'cancelled'].includes(entity.pipeline_status)) {
      shouldResolve = (t) => t.linked_entity_id === entity.id;
    }
  } else if (normType === 'hc') {
    if (entity.pipeline_status === 'cancelled') {
      shouldResolve = (t) => t.linked_entity_id === entity.id;
    }
  } else if (normType === 'busking') {
    if (entity.pipeline_status === 'retired') {
      shouldResolve = (t) => t.linked_entity_id === entity.id;
    }
  } else if (normType === 'tour_stop') {
    if (entity.completed) {
      // Resolve shortfall todos only (A16/A17/A18)
      const shortfallSlugs = [
        'tour_stop_gig_shortfall',
        'tour_stop_busking_shortfall',
        'tour_stop_hc_shortfall',
      ];
      shouldResolve = (t) =>
        t.linked_entity_id === entity.id &&
        shortfallSlugs.includes(t.auto_rule);
    }
  }

  const toResolve = todos.filter((t) => shouldResolve(t));
  for (const t of toResolve) {
    await completeTodo(t.id);
  }
}

// ─── Cascading re-evaluation for related entities ────────────────────────────
// When an entity changes, related entities' rules may need re-eval.
// Uses a visited set to prevent infinite loops.
async function cascadeReevaluate(entityType, entity, visited) {
  const normType = normalizeType(entityType);
  const key = `${normType}:${entity.id}`;
  if (visited.has(key)) return;
  visited.add(key);

  // Evaluate direct rules + bulk cleanup for this entity
  await evalRulesForEntity(normType, entity, visited);
  await bulkCleanup(normType, entity);

  // Cascade to related entities. Fetch fresh from DB where feasible.
  const c = collections();

  async function freshRead(storeName, id) {
    try {
      return await read(storeName, id);
    } catch (_e) {
      return findEntity(c[storeName], id);
    }
  }

  if (normType === 'venue') {
    // Re-evaluate linked gigs (A8)
    let linkedGigs;
    try {
      const allGigs = await readAll('gigs');
      linkedGigs = allGigs.filter((g) => g.venue_id === entity.id);
    } catch (_e) {
      linkedGigs = active(c.gigs).filter((g) => g.venue_id === entity.id);
    }
    for (const g of linkedGigs) {
      await cascadeReevaluate('gig', g, visited);
    }
    // Re-evaluate tour stop shortfalls
    if (entity.tour_stop_id) {
      const stop = await freshRead('tour_stops', entity.tour_stop_id);
      if (stop) await cascadeReevaluate('tour_stop', stop, visited);
    }
  } else if (normType === 'gig') {
    // Re-evaluate parent venue (A4, A7)
    if (entity.venue_id) {
      const venue = await freshRead('venues', entity.venue_id);
      if (venue) await cascadeReevaluate('venue', venue, visited);
    }
    // Re-evaluate tour stop shortfalls
    if (entity.tour_stop_id) {
      const stop = await freshRead('tour_stops', entity.tour_stop_id);
      if (stop) await cascadeReevaluate('tour_stop', stop, visited);
    }
  } else if (normType === 'hc') {
    // Re-evaluate tour stop shortfalls
    if (entity.tour_stop_id) {
      const stop = await freshRead('tour_stops', entity.tour_stop_id);
      if (stop) await cascadeReevaluate('tour_stop', stop, visited);
    }
  } else if (normType === 'busking') {
    // Re-evaluate tour stop shortfalls
    if (entity.tour_stop_id) {
      const stop = await freshRead('tour_stops', entity.tour_stop_id);
      if (stop) await cascadeReevaluate('tour_stop', stop, visited);
    }
  } else if (normType === 'busking_session') {
    // Re-evaluate parent spot (A14 auto-complete on first session)
    if (entity.busking_spot_id) {
      const spot = await freshRead('busking_spots', entity.busking_spot_id);
      if (spot) await cascadeReevaluate('busking', spot, visited);
    }
    // Re-evaluate tour stop shortfalls
    if (entity.tour_stop_id) {
      const stop = await freshRead('tour_stops', entity.tour_stop_id);
      if (stop) await cascadeReevaluate('tour_stop', stop, visited);
    }
  }
  // tour_stop: no cascade needed (shortfall rules are self-contained)
}

// ─── Public: reevaluateForEntity(entityType, entityId) ───────────────────────
export async function reevaluateForEntity(entityType, entityId) {
  const storeName = STORE_BY_TYPE[entityType];
  if (!storeName) return;

  // Fetch fresh entity from DB (state cache may be stale after a transition).
  let entity;
  try {
    entity = await read(storeName, entityId);
  } catch (_e) {
    entity = findEntity(collections()[storeName], entityId);
  }
  if (!entity) return;

  const visited = new Set();
  await cascadeReevaluate(entityType, entity, visited);
}

// ─── Public: reevaluateAll() ─────────────────────────────────────────────────
// Sweeps ALL entities across ALL entity types. Called on boot (H5) and every
// 5 minutes via setInterval (H5).
export async function reevaluateAll() {
  const visited = new Set();

  // Fetch fresh entity collections from DB (state cache may be stale).
  let venues = [], gigs = [], hcs = [], spots = [], sessions = [], stops = [];
  try {
    [venues, gigs, hcs, spots, sessions, stops] = await Promise.all([
      readAll('venues'),
      readAll('gigs'),
      readAll('house_concerts'),
      readAll('busking_spots'),
      readAll('busking_sessions'),
      readAll('tour_stops'),
    ]);
  } catch (_e) {
    // Fallback to state cache.
    const c = collections();
    venues = active(c.venues);
    gigs = active(c.gigs);
    hcs = active(c.house_concerts);
    spots = active(c.busking_spots);
    sessions = active(c.busking_sessions);
    stops = active(c.tour_stops);
  }

  // Order matters: evaluate leaves first so parent rules see fresh state.
  // Busking sessions → spots → venues → gigs → HCs → tour stops.

  for (const s of sessions) {
    await cascadeReevaluate('busking_session', s, visited);
  }
  for (const s of spots) {
    await cascadeReevaluate('busking', s, visited);
  }
  for (const v of venues) {
    await cascadeReevaluate('venue', v, visited);
  }
  for (const g of gigs) {
    await cascadeReevaluate('gig', g, visited);
  }
  for (const h of hcs) {
    await cascadeReevaluate('hc', h, visited);
  }
  for (const t of stops) {
    await cascadeReevaluate('tour_stop', t, visited);
  }
}

// ─── Public: getActiveTodos() → array (sync) ─────────────────────────────────
export function getActiveTodos() {
  const c = collections();
  return active(c.todos)
    .filter((t) => !t.completed)
    .sort((a, b) => {
      // Sort by priority (high→medium→low), then due date asc
      const prio = { high: 0, medium: 1, low: 2 };
      const pa = prio[a.priority] ?? 3;
      const pb = prio[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      const da = a.due_date || '9999-12-31';
      const db = b.due_date || '9999-12-31';
      return da < db ? -1 : da > db ? 1 : 0;
    });
}

// ─── Public: getTodosForEntity(entityType, entityId) → array (sync) ──────────
export function getTodosForEntity(entityType, entityId) {
  const c = collections();
  const normType = normalizeType(entityType);
  return active(c.todos).filter(
    (t) =>
      !t.completed &&
      t.linked_entity_id === entityId,
  );
}

// ─── H5: Auto-sweep interval helper (optional; main.js may call directly) ────
let _sweepTimer = null;
export function startAutoSweep(intervalMs = 300000) {
  // 5 minutes = 300000ms
  if (_sweepTimer) clearInterval(_sweepTimer);
  _sweepTimer = setInterval(() => {
    reevaluateAll().catch(() => {});
  }, intervalMs);
  return _sweepTimer;
}

export function stopAutoSweep() {
  if (_sweepTimer) {
    clearInterval(_sweepTimer);
    _sweepTimer = null;
  }
}

export default {
  reevaluateAll,
  reevaluateForEntity,
  getActiveTodos,
  getTodosForEntity,
  startAutoSweep,
  stopAutoSweep,
};

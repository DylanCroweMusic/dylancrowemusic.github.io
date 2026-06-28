// finance.js — Canonical financial projections (§8 + M1/M2/M3/M5/M6 fixes)
//
// All functions are PURE and SYNCHRONOUS: they read from store.getState(),
// which caches the active (non-archived) entity collections. The store is
// refreshed by crud writes, so these always reflect the latest committed data.
//
// Income is derived ONLY from:
//   - gigs.actual_income_aud        (when gig_status='played')
//   - house_concerts.actual_income_aud (when pipeline_status='completed')
//   - busking_sessions.income_aud   (all logged sessions)
// There is NO income_log entity (C1).

import { getState } from './store.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

function coalesce(v, fallback) {
  return v === null || v === undefined || v === '' ? fallback : v;
}

function stateEntities() {
  const s = getState() || {};
  // Store nests entity arrays under state.entities.<storeName>.
  const e = s.entities || {};
  return {
    config: (e.config || [])[0] || null,
    gigs: Array.isArray(e.gigs) ? e.gigs : [],
    house_concerts: Array.isArray(e.house_concerts) ? e.house_concerts : [],
    busking_sessions: Array.isArray(e.busking_sessions) ? e.busking_sessions : [],
    busking_spots: Array.isArray(e.busking_spots) ? e.busking_spots : [],
    tour_stops: Array.isArray(e.tour_stops) ? e.tour_stops : [],
    expense_log: Array.isArray(e.expense_log) ? e.expense_log : [],
  };
}

function getConfig() {
  return stateEntities().config || {};
}

function active(arr) {
  return arr.filter((r) => (r.status || 'active') === 'active');
}

// ─── §8.1 Per-gig projection ─────────────────────────────────────────────────
export function gigProjectedIncome(gig, config) {
  if (!gig) return 0;
  const status = gig.gig_status;
  const defaultGig = num(config.default_gig_target_aud);

  if (status === 'played' && gig.actual_income_aud != null) {
    return num(gig.actual_income_aud);
  }
  if (status === 'confirmed') {
    return num(coalesce(gig.guarantee_aud, defaultGig));
  }
  if (status === 'booked') {
    return num(coalesce(gig.guarantee_aud, defaultGig)) * 0.75;
  }
  // cancelled (or any other) → 0
  return 0;
}

// ─── §8.2 Per-HC projection (M1: COALESCE donation to 25) ────────────────────
export function hcProjectedIncome(hc, config) {
  if (!hc) return 0;
  const status = hc.pipeline_status;
  const capacity = num(coalesce(hc.capacity, 20));
  const donation = num(coalesce(hc.suggested_donation_aud, 25)); // M1

  if (status === 'completed' && hc.actual_income_aud != null) {
    return num(hc.actual_income_aud);
  }
  if (status === 'confirmed') {
    return capacity * donation * 0.6;
  }
  if (status === 'interested') {
    return capacity * donation * 0.3;
  }
  if (status === 'posted') {
    return capacity * donation * 0.1;
  }
  // cancelled → 0
  return 0;
}

// ─── §8.3 Per-session projection ─────────────────────────────────────────────
// Logged session → income_aud. Planned session → default_busking_target_aud.
// "Planned" = sessions_needed(stop) > 0 AND stop not completed AND
// departure_date >= today (M2). Per-session projection for a *logged* session
// is just its income_aud.
export function sessionProjectedIncome(sess, config) {
  if (!sess) return 0;
  if (sess.income_aud != null && num(sess.income_aud) > 0) {
    return num(sess.income_aud);
  }
  return num(config.default_busking_target_aud);
}

// ─── sessions_needed(stop) — M2 clamp ────────────────────────────────────────
// sessions_committed filters by tour_stop_id (NOT date window) per M5.
export function sessionsCommitted(stopId, collections) {
  return active(collections.busking_sessions).filter(
    (s) => s.tour_stop_id === stopId,
  ).length;
}

export function sessionsNeeded(stop, collections) {
  if (!stop) return 0;
  // M2: clamp to 0 if completed=true or departure_date < today
  if (stop.completed) return 0;
  const today = new Date().toISOString().slice(0, 10);
  if (stop.departure_date && stop.departure_date < today) return 0;
  const committed = sessionsCommitted(stop.id, collections);
  const needed = num(stop.busking_target) - committed;
  return needed > 0 ? needed : 0;
}

// ─── §8.4 Per-stop projection ────────────────────────────────────────────────
export function getStopProjectedIncome(stopId) {
  const c = stateEntities();
  const config = getConfig();
  const stop = active(c.tour_stops).find((t) => t.id === stopId);
  if (!stop) return 0;

  const gigs = active(c.gigs).filter((g) => g.tour_stop_id === stopId);
  const hcs = active(c.house_concerts).filter((h) => h.tour_stop_id === stopId);
  const sessions = active(c.busking_sessions).filter((s) => s.tour_stop_id === stopId);

  const gigSum = gigs.reduce((acc, g) => acc + gigProjectedIncome(g, config), 0);
  const hcSum = hcs.reduce((acc, h) => acc + hcProjectedIncome(h, config), 0);
  const sessSum = sessions.reduce((acc, s) => acc + sessionProjectedIncome(s, config), 0);
  const plannedSum = sessionsNeeded(stop, c) * num(config.default_busking_target_aud);

  return gigSum + hcSum + sessSum + plannedSum;
}

// ─── §8.4 Per-stop ACTUAL income ─────────────────────────────────────────────
export function getStopActualIncome(stopId) {
  const c = stateEntities();
  const gigs = active(c.gigs).filter((g) => g.tour_stop_id === stopId);
  const hcs = active(c.house_concerts).filter((h) => h.tour_stop_id === stopId);
  const sessions = active(c.busking_sessions).filter((s) => s.tour_stop_id === stopId);

  const gigActual = gigs
    .filter((g) => g.gig_status === 'played' && g.actual_income_aud != null)
    .reduce((a, g) => a + num(g.actual_income_aud), 0);
  const hcActual = hcs
    .filter((h) => h.pipeline_status === 'completed' && h.actual_income_aud != null)
    .reduce((a, h) => a + num(h.actual_income_aud), 0);
  const sessActual = sessions
    .reduce((a, s) => a + num(s.income_aud), 0);

  return gigActual + hcActual + sessActual;
}

// ─── §8.5 Whole-tour roll-ups ────────────────────────────────────────────────
export function getTourProjectedIncome() {
  const c = stateEntities();
  return active(c.tour_stops).reduce((acc, stop) => acc + getStopProjectedIncome(stop.id), 0);
}

export function getTourActualIncome() {
  const c = stateEntities();
  const config = getConfig();

  const gigActual = active(c.gigs)
    .filter((g) => g.gig_status === 'played' && g.actual_income_aud != null)
    .reduce((a, g) => a + num(g.actual_income_aud), 0);
  const hcActual = active(c.house_concerts)
    .filter((h) => h.pipeline_status === 'completed' && h.actual_income_aud != null)
    .reduce((a, h) => a + num(h.actual_income_aud), 0);
  const sessActual = active(c.busking_sessions)
    .reduce((a, s) => a + num(s.income_aud), 0);

  return gigActual + hcActual + sessActual;
}

export function getTourActualExpenses() {
  const c = stateEntities();
  return active(c.expense_log).reduce((a, e) => a + num(e.amount_aud), 0);
}

export function getTourNetProjected() {
  return getTourProjectedIncome() - getTourActualExpenses();
}

export function getTourNetActual() {
  return getTourActualIncome() - getTourActualExpenses();
}

// ─── §8.7 Income ledger (derived) ────────────────────────────────────────────
// Returns array of { date, type, amount, source, entity_id } sorted by date.
export function getIncomeLedger() {
  const c = stateEntities();
  const rows = [];

  // Gigs with actual income
  for (const g of active(c.gigs)) {
    if (g.gig_status === 'played' && g.actual_income_aud != null) {
      rows.push({
        date: g.gig_date || null,
        type: 'gig',
        amount: num(g.actual_income_aud),
        source: 'Gig (played)',
        entity_id: g.id,
      });
    }
  }

  // HCs with actual income
  for (const h of active(c.house_concerts)) {
    if (h.pipeline_status === 'completed' && h.actual_income_aud != null) {
      rows.push({
        date: h.hc_date || null,
        type: 'hc',
        amount: num(h.actual_income_aud),
        source: 'House concert (completed)',
        entity_id: h.id,
      });
    }
  }

  // All logged busking sessions (income_aud may be 0 — still a session)
  for (const s of active(c.busking_sessions)) {
    rows.push({
      date: s.session_date || null,
      type: 'busking',
      amount: num(s.income_aud),
      source: 'Busking session',
      entity_id: s.id,
    });
  }

  // Sort by date asc (nulls last)
  rows.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });

  return rows;
}

// ─── Convenience: average gig pay (for gigs_needed financial formula) ─────────
export function getAvgGigPay() {
  const c = stateEntities();
  const config = getConfig();
  const projecting = active(c.gigs)
    .map((g) => gigProjectedIncome(g, config))
    .filter((v) => v > 0);
  if (projecting.length === 0) return num(config.default_gig_target_aud);
  return projecting.reduce((a, b) => a + b, 0) / projecting.length;
}

export default {
  gigProjectedIncome,
  hcProjectedIncome,
  sessionProjectedIncome,
  sessionsCommitted,
  sessionsNeeded,
  getStopProjectedIncome,
  getStopActualIncome,
  getTourProjectedIncome,
  getTourActualIncome,
  getTourActualExpenses,
  getTourNetProjected,
  getTourNetActual,
  getIncomeLedger,
  getAvgGigPay,
};

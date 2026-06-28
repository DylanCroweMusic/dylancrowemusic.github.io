// gigs_needed.js — "Gigs needed" calculations (§10 + M2/M3/M5)
//
// Two distinct calculations:
//   §10.1 Per-stop count-based shortfall  (how many more gigs/sessions/HCs)
//   §10.2 Financial gap-based calculation (how many gigs to hit $ target)
//
// All functions are PURE and SYNCHRONOUS, reading from store.getState()
// via finance.js helpers.

import { getState } from './store.js?v=4';
import {
  getTourProjectedIncome,
  getAvgGigPay,
  sessionsCommitted,
  sessionsNeeded,
} from './finance.js?v=4';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

function active(arr) {
  return (arr || []).filter((r) => (r.status || 'active') === 'active');
}

function collections() {
  const s = getState() || {};
  const e = s.entities || {};
  return {
    config: (e.config || [])[0] || null,
    gigs: Array.isArray(e.gigs) ? e.gigs : [],
    house_concerts: Array.isArray(e.house_concerts) ? e.house_concerts : [],
    busking_sessions: Array.isArray(e.busking_sessions) ? e.busking_sessions : [],
    tour_stops: Array.isArray(e.tour_stops) ? e.tour_stops : [],
  };
}

function getConfig(c) {
  return (c && c.config) || {};
}

function findStop(stopId) {
  const c = collections();
  return active(c.tour_stops).find((t) => t.id === stopId);
}

// ─── §10.1 Per-stop count-based shortfalls ───────────────────────────────────

// gigs_committed = COUNT(gigs WHERE tour_stop_id=stop AND gig_status IN
// (booked,confirmed,played) AND status='active')
export function getStopGigShortfall(stopId) {
  const c = collections();
  const stop = active(c.tour_stops).find((t) => t.id === stopId);
  if (!stop) return 0;
  const committed = active(c.gigs).filter(
    (g) =>
      g.tour_stop_id === stopId &&
      ['booked', 'confirmed', 'played'].includes(g.gig_status),
  ).length;
  const needed = num(stop.gig_target) - committed;
  return needed > 0 ? needed : 0;
}

// sessions_committed filters by tour_stop_id (NOT date window) per M5.
export function getStopBuskingShortfall(stopId) {
  const c = collections();
  const stop = active(c.tour_stops).find((t) => t.id === stopId);
  if (!stop) return 0;
  // M2: sessionsNeeded clamps to 0 if completed or departure_date < today
  return sessionsNeeded(stop, c);
}

// hcs_committed = COUNT(HCs WHERE tour_stop_id=stop AND pipeline_status IN
// (confirmed,completed) AND status='active')
export function getStopHCShortfall(stopId) {
  const c = collections();
  const stop = active(c.tour_stops).find((t) => t.id === stopId);
  if (!stop) return 0;
  const committed = active(c.house_concerts).filter(
    (h) =>
      h.tour_stop_id === stopId &&
      ['confirmed', 'completed'].includes(h.pipeline_status),
  ).length;
  const needed = num(stop.hc_target) - committed;
  return needed > 0 ? needed : 0;
}

// ─── Whole-tour count-based shortfalls (sum over stops) ──────────────────────
export function getTourGigShortfall() {
  const c = collections();
  return active(c.tour_stops).reduce((acc, stop) => acc + getStopGigShortfall(stop.id), 0);
}

export function getTourBuskingShortfall() {
  const c = collections();
  return active(c.tour_stops).reduce((acc, stop) => acc + getStopBuskingShortfall(stop.id), 0);
}

export function getTourHCShortfall() {
  const c = collections();
  return active(c.tour_stops).reduce((acc, stop) => acc + getStopHCShortfall(stop.id), 0);
}

// ─── §10.2 Financial gap-based calculation (M3: MAX(0, ceil(...))) ───────────
// gigs_needed_financial = MAX(0, ceil((target - projected) / MAX(avg_gig_pay, 1)))
export function getTourGigsNeeded() {
  const c = collections();
  const config = getConfig(c);
  const target = num(config.revenue_target_aud);
  const projected = getTourProjectedIncome();
  const avgPay = getAvgGigPay();

  if (target <= 0) return 0; // no target set
  const gap = target - projected;
  if (gap <= 0) return 0;

  const divisor = Math.max(avgPay, 1); // M3: never divide by <1
  return Math.max(0, Math.ceil(gap / divisor));
}

export default {
  getStopGigShortfall,
  getStopBuskingShortfall,
  getStopHCShortfall,
  getTourGigShortfall,
  getTourBuskingShortfall,
  getTourHCShortfall,
  getTourGigsNeeded,
};

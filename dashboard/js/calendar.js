// calendar.js — Calendar event computation (§9 + H9)
//
// Pure SYNCHRONOUS function: reads from store.getState(), returns an array of
// event objects for the given [from, to] date range (inclusive, ISO date
// strings 'YYYY-MM-DD'). Calendar events are COMPUTED, never stored.
//
// Event shape: { date, type, entity_type, entity_id, title, time, end? }
// Tour stops render as a single chip on arrival date (H9 simplification),
// carrying an `end` field for the departure date.

import { getState } from './store.js?v=4';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function active(arr) {
  return (arr || []).filter((r) => (r.status || 'active') === 'active');
}

function collections() {
  const s = getState() || {};
  const e = s.entities || {};
  return {
    gigs: Array.isArray(e.gigs) ? e.gigs : [],
    house_concerts: Array.isArray(e.house_concerts) ? e.house_concerts : [],
    busking_sessions: Array.isArray(e.busking_sessions) ? e.busking_sessions : [],
    busking_spots: Array.isArray(e.busking_spots) ? e.busking_spots : [],
    tour_stops: Array.isArray(e.tour_stops) ? e.tour_stops : [],
    venues: Array.isArray(e.venues) ? e.venues : [],
    contacts: Array.isArray(e.contacts) ? e.contacts : [],
  };
}

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  // Normalize to YYYY-MM-DD
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

// A tour stop overlaps [from,to] if arrival <= to AND departure >= from.
function stopInRange(stop, from, to) {
  const arr = stop.arrival_date ? stop.arrival_date.slice(0, 10) : null;
  const dep = stop.departure_date ? stop.departure_date.slice(0, 10) : null;
  if (!arr && !dep) return false;
  const startOk = arr ? (!to || arr <= to) : true;
  const endOk = dep ? (!from || dep >= from) : true;
  return startOk && endOk;
}

function contactName(contacts, id) {
  if (!id) return 'Unknown host';
  const c = contacts.find((x) => x.id === id);
  return c ? c.name : 'Unknown host';
}

function venueName(venues, id) {
  if (!id) return 'Unknown venue';
  const v = venues.find((x) => x.id === id);
  return v ? v.name : 'Unknown venue';
}

function spotName(spots, id) {
  if (!id) return 'Unknown spot';
  const s = spots.find((x) => x.id === id);
  return s ? s.name : 'Unknown spot';
}

// ─── Public: getEvents(from, to) → array ─────────────────────────────────────
export function getEvents(from, to) {
  const c = collections();
  const events = [];

  // ── Gigs: gig_status ∈ {confirmed, played} ────────────────────────────────
  for (const g of active(c.gigs)) {
    if (!['confirmed', 'played'].includes(g.gig_status)) continue;
    if (!inRange(g.gig_date, from, to)) continue;
    events.push({
      date: g.gig_date.slice(0, 10),
      type: 'gig',
      entity_type: 'gig',
      entity_id: g.id,
      title: `Gig: ${venueName(c.venues, g.venue_id)}`,
      time: g.start_time || null,
    });
  }

  // ── House concerts: pipeline_status ∈ {confirmed, completed} ──────────────
  for (const h of active(c.house_concerts)) {
    if (!['confirmed', 'completed'].includes(h.pipeline_status)) continue;
    if (!inRange(h.hc_date, from, to)) continue;
    events.push({
      date: h.hc_date.slice(0, 10),
      type: 'hc',
      entity_type: 'house_concert',
      entity_id: h.id,
      title: `HC: ${contactName(c.contacts, h.host_contact_id)}`,
      time: h.start_time || null,
    });
  }

  // ── Busking sessions: all logged sessions ─────────────────────────────────
  for (const s of active(c.busking_sessions)) {
    if (!inRange(s.session_date, from, to)) continue;
    events.push({
      date: s.session_date.slice(0, 10),
      type: 'busking',
      entity_type: 'busking_session',
      entity_id: s.id,
      title: `Busk: ${spotName(c.busking_spots, s.busking_spot_id)}`,
      time: s.start_time || null,
    });
  }

  // ── Tour stops: single chip on arrival date (H9) ──────────────────────────
  for (const t of active(c.tour_stops)) {
    if (!stopInRange(t, from, to)) continue;
    const arr = t.arrival_date ? t.arrival_date.slice(0, 10) : null;
    if (!arr) continue;
    const dep = t.departure_date ? t.departure_date.slice(0, 10) : arr;
    events.push({
      date: arr,
      type: 'tour_stop',
      entity_type: 'tour_stop',
      entity_id: t.id,
      title: `${t.name} — ${arr} to ${dep}`,
      time: null,
      end: dep,
    });
  }

  // ── Venue target gig dates (ghosted) ──────────────────────────────────────
  // Show when venue has a target_gig_date in range AND no gig exists for that
  // venue on that date.
  for (const v of active(c.venues)) {
    if (!v.target_gig_date) continue;
    if (!inRange(v.target_gig_date, from, to)) continue;
    const hasGig = c.gigs.some(
      (g) =>
        g.venue_id === v.id &&
        g.status === 'active' &&
        g.gig_date &&
        g.gig_date.slice(0, 10) === v.target_gig_date.slice(0, 10),
    );
    if (hasGig) continue;
    events.push({
      date: v.target_gig_date.slice(0, 10),
      type: 'venue_target',
      entity_type: 'venue',
      entity_id: v.id,
      title: `Target gig: ${v.name}`,
      time: null,
    });
  }

  // Sort by date asc, then time asc (nulls last).
  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time || 'zz';
    const tb = b.time || 'zz';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  return events;
}

export default { getEvents };

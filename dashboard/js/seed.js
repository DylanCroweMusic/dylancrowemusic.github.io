// seed.js — Initial demo data for Dylan Crowe Music Touring Dashboard v4.
// Data from doc 04 §9, ADAPTED per amendments:
//   C1 — income_log removed entirely (no inc_01, inc_02, inc_03)
//   C5 — all tour_stops have completed: false
//   C2 — todo auto_rule slugs match blueprint §5.1 exactly
//   C4 — hc_03.host_contact_id null is OK

import { get, bulkPut, getAll } from './db.js?v=4';
import { STORES } from './migrations.js?v=4';

// ─── Seed Data ──────────────────────────────────────────────────────────

const seedData = {
  config: [
    {
      id: 'cfg_singleton',
      schema_version: '4.0',
      tour_name: 'Dylan Crowe — Australian Tour 2026',
      tour_start_date: '2026-09-01',
      tour_end_date: '2026-11-30',
      revenue_target_aud: 37000,
      default_currency: 'AUD',
      fb_group_url: 'https://www.facebook.com/groups/dylancrowehouseconcerts',
      epk_url: 'https://dylancrowe.com/epk',
      default_gig_target_aud: 400,
      default_busking_target_aud: 300,
      default_session_duration_min: 120,
      status: 'active',
      version: 1,
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      archived_at: null,
    },
  ],

  tour_stops: [
    { id: 'ts_01', name: 'Perth', state: 'WA', arrival_date: '2026-09-01', departure_date: '2026-09-04', order: 1, gig_target: 1, busking_target: 3, hc_target: 1, completed: false, notes: 'WA loop start', status: 'active', version: 1, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', archived_at: null },
    { id: 'ts_02', name: 'Margaret River', state: 'WA', arrival_date: '2026-09-05', departure_date: '2026-09-07', order: 2, gig_target: 1, busking_target: 2, hc_target: 0, completed: false, notes: '', status: 'active', version: 1, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', archived_at: null },
    { id: 'ts_03', name: 'Albany', state: 'WA', arrival_date: '2026-09-08', departure_date: '2026-09-10', order: 3, gig_target: 1, busking_target: 2, hc_target: 0, completed: false, notes: '', status: 'active', version: 1, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', archived_at: null },
    { id: 'ts_04', name: 'Adelaide', state: 'SA', arrival_date: '2026-09-14', departure_date: '2026-09-18', order: 4, gig_target: 2, busking_target: 3, hc_target: 1, completed: false, notes: '', status: 'active', version: 1, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', archived_at: null },
    { id: 'ts_05', name: 'Melbourne', state: 'VIC', arrival_date: '2026-09-22', departure_date: '2026-09-28', order: 5, gig_target: 2, busking_target: 4, hc_target: 2, completed: false, notes: 'East coast leg begins', status: 'active', version: 1, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', archived_at: null },
  ],

  contacts: [
    { id: 'ct_01', name: 'Megan Prior', role: 'venue_booker', email: 'megan@thebirdperth.com.au', phone: '+61 8 9221 9221', facebook_profile_url: null, notes: 'Booker at The Bird', status: 'active', version: 1, created_at: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z', archived_at: null },
    { id: 'ct_02', name: 'Steve Kalajanis', role: 'venue_booker', email: 'steve@jadebar.com.au', phone: '+61 8 9228 0155', facebook_profile_url: null, notes: 'The Jade Monkey', status: 'active', version: 1, created_at: '2026-07-02T00:00:00Z', updated_at: '2026-07-02T00:00:00Z', archived_at: null },
    { id: 'ct_03', name: "Rachael O'Donnell", role: 'hc_host', email: 'rachael.o@gmail.com', phone: '+61 412 555 019', facebook_profile_url: 'https://www.facebook.com/rachael.odonnell.7', notes: 'Hosts house concerts in Brunswick', status: 'active', version: 1, created_at: '2026-07-03T00:00:00Z', updated_at: '2026-07-03T00:00:00Z', archived_at: null },
    { id: 'ct_04', name: 'Tom Whitaker', role: 'hc_host', email: 'tom.whitaker@outlook.com', phone: '+61 449 778 210', facebook_profile_url: 'https://www.facebook.com/tom.whitaker.9', notes: 'HC lead from FB group', status: 'active', version: 1, created_at: '2026-07-04T00:00:00Z', updated_at: '2026-07-04T00:00:00Z', archived_at: null },
  ],

  venues: [
    { id: 'ven_01', name: 'The Bird', tour_stop_id: 'ts_01', address: '181 William St', suburb: 'Northbridge', state: 'WA', postcode: '6003', primary_contact_id: 'ct_01', website_url: 'https://thebirdperth.com', phone: '+61 8 9221 9221', capacity: 120, epk_sent: true, epk_sent_at: '2026-07-10T02:00:00Z', pipeline_status: 'confirmed', pipeline_status_at: '2026-07-10T02:30:00Z', last_contacted_at: '2026-07-09T01:00:00Z', target_gig_date: '2026-09-03', notes: 'Wednesday night slot', status: 'active', version: 3, created_at: '2026-07-05T00:00:00Z', updated_at: '2026-07-10T02:30:00Z', archived_at: null },
    { id: 'ven_02', name: 'The Jade Monkey', tour_stop_id: 'ts_04', address: '141 Twin St', suburb: 'Adelaide CBD', state: 'SA', postcode: '5000', primary_contact_id: 'ct_02', website_url: 'https://www.jadebar.com.au', phone: '+61 8 9228 0155', capacity: 90, epk_sent: false, epk_sent_at: null, pipeline_status: 'follow_up', pipeline_status_at: '2026-07-12T05:00:00Z', last_contacted_at: '2026-07-08T04:00:00Z', target_gig_date: '2026-09-16', notes: '', status: 'active', version: 2, created_at: '2026-07-06T00:00:00Z', updated_at: '2026-07-12T05:00:00Z', archived_at: null },
    { id: 'ven_03', name: 'Babylon Bar', tour_stop_id: 'ts_01', address: '75 Beaufort St', suburb: 'Perth', state: 'WA', postcode: '6000', primary_contact_id: null, website_url: null, phone: null, capacity: 150, epk_sent: false, epk_sent_at: null, pipeline_status: 'not_contacted', pipeline_status_at: '2026-07-01T00:00:00Z', last_contacted_at: null, target_gig_date: '2026-09-02', notes: 'Cold approach target', status: 'active', version: 1, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', archived_at: null },
    { id: 'ven_04', name: 'The Tote', tour_stop_id: 'ts_05', address: '67 Johnston St', suburb: 'Collingwood', state: 'VIC', postcode: '3066', primary_contact_id: null, website_url: 'https://thetotehotel.com', phone: '+61 3 9419 5320', capacity: 200, epk_sent: true, epk_sent_at: '2026-07-14T03:00:00Z', pipeline_status: 'contacted', pipeline_status_at: '2026-07-14T03:30:00Z', last_contacted_at: '2026-07-14T03:00:00Z', target_gig_date: '2026-09-25', notes: '', status: 'active', version: 2, created_at: '2026-07-07T00:00:00Z', updated_at: '2026-07-14T03:30:00Z', archived_at: null },
    { id: 'ven_05', name: "Lass O'Gowrie", tour_stop_id: 'ts_04', address: '7 Rundle St', suburb: 'Adelaide CBD', state: 'SA', postcode: '5000', primary_contact_id: null, website_url: null, phone: '+61 8 8223 2883', capacity: 80, epk_sent: false, epk_sent_at: null, pipeline_status: 'declined', pipeline_status_at: '2026-07-15T06:00:00Z', last_contacted_at: '2026-07-13T05:00:00Z', target_gig_date: '2026-09-17', notes: 'Booker said no — try again next tour', status: 'active', version: 1, created_at: '2026-07-08T00:00:00Z', updated_at: '2026-07-15T06:00:00Z', archived_at: null },
  ],

  gigs: [
    { id: 'gig_01', venue_id: 'ven_01', tour_stop_id: 'ts_01', gig_date: '2026-09-03', start_time: '20:00', duration_min: 120, guarantee_aud: 400, door_price_aud: 15, capacity: 120, gig_status: 'confirmed', actual_income_aud: null, setlist: 'Open: Black Dog / Midnight Oil cover\r\nOriginals\r\nClose: Hallelujah', notes: 'Load-in 18:00', status: 'active', version: 1, created_at: '2026-07-10T02:31:00Z', updated_at: '2026-07-10T02:31:00Z', archived_at: null },
    { id: 'gig_02', venue_id: 'ven_04', tour_stop_id: 'ts_05', gig_date: '2026-09-25', start_time: '21:00', duration_min: 90, guarantee_aud: 350, door_price_aud: 12, capacity: 200, gig_status: 'booked', actual_income_aud: null, setlist: null, notes: '', status: 'active', version: 1, created_at: '2026-07-15T00:00:00Z', updated_at: '2026-07-15T00:00:00Z', archived_at: null },
  ],

  house_concerts: [
    { id: 'hc_01', tour_stop_id: 'ts_05', host_contact_id: 'ct_03', hc_date: '2026-09-26', start_time: '19:30', capacity: 25, suggested_donation_aud: 25, fb_ad_posted: true, fb_ad_posted_at: '2026-07-10T05:00:00Z', materials_sent: true, materials_sent_at: '2026-07-15T05:00:00Z', pipeline_status: 'confirmed', pipeline_status_at: '2026-07-15T05:00:00Z', actual_income_aud: null, notes: "Rachael's house, Brunswick", status: 'active', version: 3, created_at: '2026-07-10T05:00:00Z', updated_at: '2026-07-15T05:00:00Z', archived_at: null },
    { id: 'hc_02', tour_stop_id: 'ts_05', host_contact_id: 'ct_04', hc_date: null, start_time: null, capacity: 30, suggested_donation_aud: 25, fb_ad_posted: true, fb_ad_posted_at: '2026-07-12T05:00:00Z', materials_sent: false, materials_sent_at: null, pipeline_status: 'interested', pipeline_status_at: '2026-07-12T06:00:00Z', actual_income_aud: null, notes: 'Tom enquired; date TBD', status: 'active', version: 1, created_at: '2026-07-12T05:00:00Z', updated_at: '2026-07-12T06:00:00Z', archived_at: null },
    { id: 'hc_03', tour_stop_id: 'ts_01', host_contact_id: null, hc_date: null, start_time: null, capacity: null, suggested_donation_aud: 25, fb_ad_posted: true, fb_ad_posted_at: '2026-07-08T05:00:00Z', materials_sent: false, materials_sent_at: null, pipeline_status: 'posted', pipeline_status_at: '2026-07-08T05:00:00Z', actual_income_aud: null, notes: 'Waiting for Perth leads', status: 'active', version: 1, created_at: '2026-07-08T05:00:00Z', updated_at: '2026-07-08T05:00:00Z', archived_at: null },
  ],

  busking_spots: [
    { id: 'bs_01', tour_stop_id: 'ts_01', name: 'Hay Street Mall', lat: -31.9522, lng: 115.8589, address_hint: 'Between William & Barrack', council_permit_required: true, permit_obtained: true, noise_restriction_notes: 'Amplified ok to 21:00', pipeline_status: 'regular', pipeline_status_at: '2026-07-05T00:00:00Z', best_session_income_aud: 420, notes: 'Best pitch in CBD', status: 'active', version: 2, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-05T00:00:00Z', archived_at: null },
    { id: 'bs_02', tour_stop_id: 'ts_01', name: 'Fremantle Markets (entrance)', lat: -32.0572, lng: 115.7464, address_hint: 'South Tce entrance', council_permit_required: true, permit_obtained: false, noise_restriction_notes: 'Acoustic only inside', pipeline_status: 'tested', pipeline_status_at: '2026-07-03T00:00:00Z', best_session_income_aud: 280, notes: 'Good Sat morning', status: 'active', version: 1, created_at: '2026-07-02T00:00:00Z', updated_at: '2026-07-03T00:00:00Z', archived_at: null },
    { id: 'bs_03', tour_stop_id: 'ts_04', name: 'Rundle Mall', lat: -34.9235, lng: 138.6006, address_hint: 'Near Myer Centre', council_permit_required: true, permit_obtained: false, noise_restriction_notes: '', pipeline_status: 'discovered', pipeline_status_at: '2026-07-01T00:00:00Z', best_session_income_aud: null, notes: 'Test on arrival', status: 'active', version: 1, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', archived_at: null },
    { id: 'bs_04', tour_stop_id: 'ts_05', name: 'Federation Square', lat: -37.8176, lng: 144.9674, address_hint: 'Main plaza', council_permit_required: true, permit_obtained: false, noise_restriction_notes: 'Permit via City of Melbourne', pipeline_status: 'discovered', pipeline_status_at: '2026-07-01T00:00:00Z', best_session_income_aud: null, notes: '', status: 'active', version: 1, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', archived_at: null },
  ],

  busking_sessions: [
    { id: 'sess_01', busking_spot_id: 'bs_01', tour_stop_id: 'ts_01', session_date: '2026-09-01', start_time: '11:00', duration_min: 150, income_aud: 380, income_source: 'mixed', weather: 'sunny', notes: 'Lunch crowd solid', status: 'active', version: 1, created_at: '2026-09-01T13:30:00Z', updated_at: '2026-09-01T13:30:00Z', archived_at: null },
    { id: 'sess_02', busking_spot_id: 'bs_01', tour_stop_id: 'ts_01', session_date: '2026-09-02', start_time: '16:00', duration_min: 120, income_aud: 420, income_source: 'mixed', weather: 'overcast', notes: 'Best yet', status: 'active', version: 1, created_at: '2026-09-02T18:00:00Z', updated_at: '2026-09-02T18:00:00Z', archived_at: null },
    { id: 'sess_03', busking_spot_id: 'bs_02', tour_stop_id: 'ts_01', session_date: '2026-09-03', start_time: '10:00', duration_min: 90, income_aud: 280, income_source: 'cash', weather: 'windy', notes: 'Cut short by wind', status: 'active', version: 1, created_at: '2026-09-03T11:30:00Z', updated_at: '2026-09-03T11:30:00Z', archived_at: null },
  ],

  // NO income_log (amendment C1)

  expense_log: [
    { id: 'exp_01', category: 'fuel', amount_aud: 120, incurred_date: '2026-08-31', tour_stop_id: 'ts_01', vendor: 'Shell', description: 'Perth — first fill', status: 'active', version: 1, created_at: '2026-08-31T00:00:00Z', updated_at: '2026-08-31T00:00:00Z', archived_at: null },
    { id: 'exp_02', category: 'food', amount_aud: 65, incurred_date: '2026-09-02', tour_stop_id: 'ts_01', vendor: 'Coles', description: 'Groceries', status: 'active', version: 1, created_at: '2026-09-02T00:00:00Z', updated_at: '2026-09-02T00:00:00Z', archived_at: null },
    { id: 'exp_03', category: 'vet', amount_aud: 180, incurred_date: '2026-09-04', tour_stop_id: 'ts_01', vendor: 'Perth Vet Hospital', description: 'Maverick check-up', status: 'active', version: 1, created_at: '2026-09-04T00:00:00Z', updated_at: '2026-09-04T00:00:00Z', archived_at: null },
    { id: 'exp_04', category: 'accommodation', amount_aud: 240, incurred_date: '2026-09-22', tour_stop_id: 'ts_05', vendor: 'Airbnb', description: '3 nights Brunswick', status: 'active', version: 1, created_at: '2026-09-22T00:00:00Z', updated_at: '2026-09-22T00:00:00Z', archived_at: null },
  ],

  todos: [
    // todo_01: auto_rule 'venue_follow_up_due' — matches §5.1 slug exactly
    { id: 'todo_01', title: 'Follow up with The Jade Monkey', description: 'No response to EPK send', due_date: '2026-07-15', priority: 'medium', category: 'venue', linked_entity_type: 'venue', linked_entity_id: 'ven_02', is_auto_generated: true, auto_rule: 'venue_follow_up_due', completed: false, completed_at: null, status: 'active', version: 1, created_at: '2026-07-12T05:00:00Z', updated_at: '2026-07-12T05:00:00Z', archived_at: null },
    // todo_02: auto_rule 'busking_spot_permit_needed' — matches §5.1 slug exactly
    { id: 'todo_02', title: 'Get busking permit for Rundle Mall', description: '', due_date: null, priority: 'medium', category: 'busking', linked_entity_type: 'busking_spot', linked_entity_id: 'bs_03', is_auto_generated: true, auto_rule: 'busking_spot_permit_needed', completed: false, completed_at: null, status: 'active', version: 1, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', archived_at: null },
    // todo_03: auto_rule 'hc_send_materials' — amendment C2: was hc_confirmed_send_materials, now matches §5.1 slug
    { id: 'todo_03', title: 'Send host materials for HC 2026-09-26', description: "Rachael O'Donnell", due_date: '2026-09-19', priority: 'high', category: 'hc', linked_entity_type: 'house_concert', linked_entity_id: 'hc_01', is_auto_generated: true, auto_rule: 'hc_send_materials', completed: true, completed_at: '2026-07-15T05:00:00Z', status: 'active', version: 1, created_at: '2026-07-15T05:00:00Z', updated_at: '2026-07-15T05:00:00Z', archived_at: null },
    // todo_04: auto_rule 'tour_stop_gig_shortfall' — matches §5.1 slug exactly
    { id: 'todo_04', title: 'Book 1 more gig for Perth', description: 'Target 1, committed 0', due_date: '2026-09-01', priority: 'high', category: 'venue', linked_entity_type: 'tour_stop', linked_entity_id: 'ts_01', is_auto_generated: true, auto_rule: 'tour_stop_gig_shortfall', completed: false, completed_at: null, status: 'active', version: 1, created_at: '2026-07-10T00:00:00Z', updated_at: '2026-07-10T00:00:00Z', archived_at: null },
    // todo_05: manual todo — is_auto_generated: false, no auto_rule (amendment C2)
    { id: 'todo_05', title: 'Reply to Tom re: HC date', description: 'Manual follow-up on hc_02', due_date: '2026-07-20', priority: 'medium', category: 'hc', linked_entity_type: 'house_concert', linked_entity_id: 'hc_02', is_auto_generated: false, auto_rule: null, completed: false, completed_at: null, status: 'active', version: 1, created_at: '2026-07-13T00:00:00Z', updated_at: '2026-07-13T00:00:00Z', archived_at: null },
  ],
};

// ─── Loader ─────────────────────────────────────────────────────────────

/**
 * Load seed data into IndexedDB if the database is empty.
 * Checks config store first — if it has a record, the DB is already seeded.
 *
 * @returns {Promise<boolean>} true if seed was loaded, false if DB was already populated
 */
export async function loadSeedIfEmpty() {
  // Check if config store already has the singleton record
  const configRecord = await get('config', 'cfg_singleton');
  if (configRecord) {
    // DB already seeded
    return false;
  }

  // Load all seed data
  for (const storeName of STORES) {
    const records = seedData[storeName];
    if (records && records.length > 0) {
      await bulkPut(storeName, records);
    }
  }

  return true;
}

// Export seed data for testing/inspection
export { seedData };

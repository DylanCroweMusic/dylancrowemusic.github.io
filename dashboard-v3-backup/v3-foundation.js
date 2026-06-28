/**
 * Tour OS v3 — Foundation / Data Layer
 * 
 * Provides: localStorage persistence, CRUD operations, pipeline management,
 * stop recalculation, import/export, v2 migration, and event system.
 * 
 * Entities managed: tour_stops, contacts, venues, gigs, house_concerts,
 * busking_spots, income_log, expense_log, todos
 */

const TourOS = (function () {
  'use strict';

  const STORAGE_KEY = 'tourOS_v3_data';
  const V2_STORAGE_KEY = 'tourOS_data'; // old v2 localStorage key

  // ===== Canonical Pipeline Maps =====
  const PIPELINES = {
    venue: {
      not_contacted: ['contacted', 'declined'],
      contacted: ['follow_up', 'booked', 'declined'],
      follow_up: ['follow_up', 'booked', 'declined'],
      booked: ['confirmed', 'cancelled'],
      confirmed: ['played', 'cancelled'],
      played: [],
      declined: ['not_contacted'],
      cancelled: ['not_contacted']
    },
    house_concert: {
      posted: ['interested'],
      interested: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],
      cancelled: ['posted']
    },
    busking_spot: {
      discovered: ['tested'],
      tested: ['regular', 'discovered'],
      regular: ['retired'],
      retired: ['discovered']
    }
  };

  // ===== Entity type → collection key mapping =====
  // Supports both singular (pipeline type) and plural (collection) keys
  const ENTITY_COLLECTIONS = {
    tour_stops: 'tour_stops',
    tour_stop: 'tour_stops',
    contacts: 'contacts',
    contact: 'contacts',
    venues: 'venues',
    venue: 'venues',
    gigs: 'gigs',
    gig: 'gigs',
    house_concerts: 'house_concerts',
    house_concert: 'house_concerts',
    hc: 'house_concerts',
    busking_spots: 'busking_spots',
    busking_spot: 'busking_spots',
    bsk: 'busking_spots',
    income_log: 'income_log',
    income: 'income_log',
    expense_log: 'expense_log',
    expense: 'expense_log',
    todos: 'todos',
    todo: 'todos'
  };

  // ===== In-memory state =====
  let _data = null;
  let _changeCallbacks = [];

  // ===== Default empty state (merged with seed data on first load) =====
  function _defaultState() {
    return {
      meta: {
        version: '3.0',
        schema_version: '3.0',
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
        artist: {
          name: 'Dylan Crowe',
          email: 'dylancrowemusic@gmail.com',
          phone: '0411 926 271',
          ig: '@dylan_crowe_music',
          yt: '@dylancrowemusic'
        }
      },
      config: {
        tour_name: 'WA Loop → East Coast 2026',
        tour_target: 37000,
        busking_min_session: 300,
        gig_target: 400,
        currency: 'AUD',
        brand: {
          cosmic_blue: '#1A1A3E',
          cyan: '#00B4D8',
          magenta: '#D946EF',
          amber: '#D97706',
          green: '#166534',
          off_white: '#F5F0E8'
        },
        stream_colors: {
          busking: '#166534',
          venue: '#00B4D8',
          house_concert: '#D97706'
        },
        hc_tiers: [
          { id: 'tier_1', label: 'Intimate', guests: '15-25', ticket_price: 25 },
          { id: 'tier_2', label: 'Standard', guests: '25-40', ticket_price: 25 },
          { id: 'tier_3', label: 'Large', guests: '40-50', ticket_price: 25 }
        ],
        venue_stages: ['not_contacted', 'contacted', 'follow_up', 'booked', 'confirmed', 'played', 'declined', 'cancelled'],
        hc_stages: ['posted', 'interested', 'confirmed', 'completed', 'cancelled']
      },
      tour_stops: [],
      contacts: [],
      venues: [],
      gigs: [],
      house_concerts: [],
      busking_spots: [],
      income_log: [],
      expense_log: [],
      todos: []
    };
  }

  // ===== Deep merge helper =====
  function _deepMerge(target, source) {
    if (!source) return target;
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || source === null) return source;
    if (Array.isArray(source)) return source; // arrays replace, don't merge
    const result = { ...target };
    for (const key of Object.keys(source)) {
      result[key] = _deepMerge(target[key], source[key]);
    }
    return result;
  }

  // ===== Load data from localStorage =====
  function loadData() {
    if (_data) return _data;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        _data = JSON.parse(stored);
        // Merge with default state to ensure new fields exist
        _data = _deepMerge(_defaultState(), _data);
      } catch (e) {
        console.error('TourOS: Failed to parse stored data, falling back to seed', e);
        _data = _deepMerge(_defaultState(), _getSeedData());
        saveData();
      }
    } else {
      // First run — use seed data
      _data = _deepMerge(_defaultState(), _getSeedData());
      saveData();
    }
    return _data;
  }

  // ===== Get seed data from window.DASHBOARD_DATA (v3-seed-data.js) =====
  function _getSeedData() {
    if (typeof window !== 'undefined' && window.DASHBOARD_DATA) {
      return window.DASHBOARD_DATA;
    }
    return {};
  }

  // ===== Save data to localStorage =====
  function saveData() {
    if (!_data) return;
    _data.meta = _data.meta || {};
    _data.meta.updated_at = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
    } catch (e) {
      console.error('TourOS: Failed to save data', e);
    }
    notifyChange();
  }

  // ===== Generate ID =====
  function generateId(prefix) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return prefix + '_' + id;
  }

  // ===== Get current stop =====
  function getCurrentStop() {
    const stops = getAllEntities('tour_stops');
    return stops.find(s => s.status === 'current') || null;
  }

  // ===== Set current stop =====
  function setCurrentStop(id) {
    const stops = getAllEntities('tour_stops');
    stops.forEach(stop => {
      if (stop.status === 'current') {
        stop.status = 'completed';
        stop.updated_at = new Date().toISOString();
      }
    });
    const stop = getEntity('tour_stops', id);
    if (stop) {
      stop.status = 'current';
      stop.updated_at = new Date().toISOString();
      saveData();
      return stop;
    }
    return null;
  }

  // ===== CRUD: Create =====
  function createEntity(type, data) {
    if (!_data) loadData();
    const collection = ENTITY_COLLECTIONS[type];
    if (!collection) throw new Error(`Unknown entity type: ${type}`);

    if (!_data[collection]) _data[collection] = [];

    const now = new Date().toISOString();
    const prefixMap = {
      tour_stops: 'stop',
      contacts: 'con',
      venues: 'ven',
      gigs: 'gig',
      house_concerts: 'hc',
      busking_spots: 'bsk',
      income_log: 'inc',
      expense_log: 'exp',
      todos: 'todo'
    };

    const entity = {
      id: data.id || generateId(prefixMap[type] || type),
      ...data,
      created_at: data.created_at || now,
      updated_at: now
    };

    _data[collection].push(entity);
    saveData();
    return entity;
  }

  // ===== CRUD: Get single =====
  function getEntity(type, id) {
    if (!_data) loadData();
    const collection = ENTITY_COLLECTIONS[type];
    if (!collection || !_data[collection]) return null;
    return _data[collection].find(e => e.id === id) || null;
  }

  // ===== CRUD: Get all =====
  function getAllEntities(type) {
    if (!_data) loadData();
    const collection = ENTITY_COLLECTIONS[type];
    if (!collection || !_data[collection]) return [];
    return _data[collection];
  }

  // ===== CRUD: Update =====
  function updateEntity(type, id, data) {
    if (!_data) loadData();
    const collection = ENTITY_COLLECTIONS[type];
    if (!collection || !_data[collection]) return null;

    const idx = _data[collection].findIndex(e => e.id === id);
    if (idx === -1) return null;

    _data[collection][idx] = {
      ..._data[collection][idx],
      ...data,
      id: id, // preserve ID
      updated_at: new Date().toISOString()
    };

    saveData();
    return _data[collection][idx];
  }

  // ===== CRUD: Delete =====
  function deleteEntity(type, id) {
    if (!_data) loadData();
    const collection = ENTITY_COLLECTIONS[type];
    if (!collection || !_data[collection]) return false;

    const idx = _data[collection].findIndex(e => e.id === id);
    if (idx === -1) return false;

    _data[collection].splice(idx, 1);
    saveData();
    return true;
  }

  // ===== Archive entity =====
  function archiveEntity(type, id, reason) {
    const entity = getEntity(type, id);
    if (!entity) return null;
    return updateEntity(type, id, {
      status: 'archived',
      archive_reason: reason || '',
      archived_at: new Date().toISOString()
    });
  }

  // ===== Get valid pipeline transitions =====
  function getValidTransitions(type, currentStage) {
    const pipeline = PIPELINES[type];
    if (!pipeline) return [];
    return pipeline[currentStage] || [];
  }

  // ===== Advance pipeline stage =====
  function advancePipeline(type, id, newStage) {
    const entity = getEntity(type, id);
    if (!entity) throw new Error(`Entity not found: ${type}/${id}`);

    const currentStage = entity.stage || entity.status;
    const valid = getValidTransitions(type, currentStage);

    if (!valid.includes(newStage)) {
      throw new Error(`Invalid transition: ${currentStage} → ${newStage} for ${type}. Valid: ${valid.join(', ')}`);
    }

    // Build stage history entry
    const historyEntry = {
      stage: newStage,
      date: new Date().toISOString().split('T')[0],
      notes: ''
    };

    // Update entity
    const update = {
      stage: newStage,
      stage_history: [...(entity.stage_history || []), historyEntry]
    };

    // Special: follow_up → follow_up increments follow_up_count
    if (type === 'venue' && newStage === 'follow_up') {
      update.follow_up_count = (entity.follow_up_count || 0) + 1;
    }

    // Set first_contacted_date on first contact
    if (type === 'venue' && !entity.first_contacted_date && newStage === 'contacted') {
      update.first_contacted_date = historyEntry.date;
    }

    const updated = updateEntity(type, id, update);
    return updated;
  }

  // ===== Recalculate a single stop's actuals from income/expense logs =====
  function recalculateStop(stopId) {
    const stop = getEntity('tour_stops', stopId);
    if (!stop) return null;

    const incomeEntries = getAllEntities('income_log').filter(i => i.tour_stop_id === stopId);
    const expenseEntries = getAllEntities('expense_log').filter(e => e.tour_stop_id === stopId);

    // Calculate actuals
    let buskingSessions = 0;
    let buskingEarnings = 0;
    let gigsPlayed = 0;
    let gigEarnings = 0;
    let hcCompleted = 0;
    let hcEarnings = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    incomeEntries.forEach(entry => {
      totalIncome += entry.amount || 0;
      if (entry.type === 'busking') {
        buskingSessions++;
        buskingEarnings += entry.amount || 0;
      } else if (entry.type === 'venue' || entry.type === 'venue_gig') {
        gigEarnings += entry.amount || 0;
        // Count as played if income is logged
        gigsPlayed++;
      } else if (entry.type === 'house_concert') {
        hcEarnings += entry.amount || 0;
        hcCompleted++;
      }
    });

    expenseEntries.forEach(entry => {
      totalExpenses += entry.amount || 0;
    });

    const updated = updateEntity('tour_stops', stopId, {
      actuals: {
        busking_sessions: buskingSessions,
        busking_earnings: buskingEarnings,
        gigs_played: gigsPlayed,
        gig_earnings: gigEarnings,
        hc_completed: hcCompleted,
        hc_earnings: hcEarnings
      },
      financials: {
        actual_income: totalIncome,
        actual_expenses: totalExpenses,
        net: totalIncome - totalExpenses
      }
    });

    return updated;
  }

  // ===== Recalculate all stops =====
  function recalculateAll() {
    const stops = getAllEntities('tour_stops');
    stops.forEach(stop => recalculateStop(stop.id));
  }

  // ===== Export data as JSON string =====
  function exportData() {
    if (!_data) loadData();
    return JSON.stringify(_data, null, 2);
  }

  // ===== Import data from JSON string =====
  function importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.meta || !parsed.config) {
        throw new Error('Invalid data: missing meta or config');
      }
      _data = _deepMerge(_defaultState(), parsed);
      saveData();
      return true;
    } catch (e) {
      console.error('TourOS: Import failed', e);
      return false;
    }
  }

  // ===== Migrate v2 data if present =====
  function migrateV2Data() {
    const v2Stored = localStorage.getItem(V2_STORAGE_KEY);
    if (!v2Stored) return null;

    try {
      const v2 = JSON.parse(v2Stored);
      const migrated = _defaultState();

      // Migrate tour stops
      if (v2.tour_stops && Array.isArray(v2.tour_stops)) {
        migrated.tour_stops = v2.tour_stops.map((stop, idx) => {
          const segmentMap = ['WA Loop', 'WA Loop', 'WA Loop', 'WA Loop', 'WA Loop', 'WA Loop', 'WA Loop',
            'SA Crossing', 'SA Crossing', 'VIC Run', 'VIC Run', 'VIC Run',
            'NSW Coast', 'NSW Coast', 'NSW Coast', 'NSW Coast', 'NSW Coast', 'NSW Coast', 'NSW Coast',
            'QLD Finale', 'QLD Finale', 'QLD Finale'];

          const targets = stop.targets || {};
          const actuals = stop.actuals || {};

          return {
            id: `stop_${String(idx + 1).padStart(2, '0')}`,
            name: stop.name || '',
            state: stop.state || '',
            segment: segmentMap[idx] || '',
            arrival_date: stop.arrival_date || '',
            departure_date: stop.departure_date || '',
            status: stop.status ? stop.status.toLowerCase() : 'planned',
            targets: {
              busking_sessions: targets.busking?.sessions_target || 0,
              busking_earnings: targets.busking?.earnings_target || 0,
              gigs: targets.venue_gig?.gigs_target || 0,
              gig_earnings: targets.venue_gig?.earnings_target || 0,
              hc_shows: targets.house_concert?.shows_target || 0,
              hc_earnings: targets.house_concert?.earnings_target || 0
            },
            actuals: {
              busking_sessions: actuals.busking?.sessions_completed || 0,
              busking_earnings: actuals.busking?.earnings_actual || 0,
              gigs_played: actuals.venue_gig?.gigs_played || 0,
              gig_earnings: actuals.venue_gig?.earnings_actual || 0,
              hc_completed: actuals.house_concert?.shows_completed || 0,
              hc_earnings: actuals.house_concert?.earnings_actual || 0
            },
            venue_ids: [],
            house_concert_ids: [],
            busking_spot_ids: [],
            notes: stop.notes || '',
            created_at: '',
            updated_at: ''
          };
        });
      }

      // Migrate venues
      if (v2.venues && Array.isArray(v2.venues)) {
        migrated.venues = v2.venues.map((ven, idx) => {
          const stageMap = {
            'not_contacted': 'not_contacted',
            'called': 'contacted', 'emailed': 'contacted',
            'follow_up_1': 'follow_up', 'follow_up_2': 'follow_up',
            'booked': 'booked', 'confirmed': 'confirmed',
            'played': 'played', 'declined': 'declined', 'cancelled': 'cancelled'
          };
          return {
            id: ven.id || `ven_${String(idx + 1).padStart(3, '0')}`,
            name: ven.name || '',
            phone: ven.phone || '',
            email: ven.email || '',
            contact_name: ven.contact_name || '',
            contact_id: null,
            type: ven.venue_type || '',
            city: ven.city || '',
            state: ven.state || '',
            priority: ven.priority || 'medium',
            tour_stop_id: ven.tour_stop_id ? `stop_${String(ven.tour_stop_id).padStart(2, '0')}` : null,
            stage: stageMap[ven.pipeline_stage] || 'not_contacted',
            stage_history: (ven.stage_history || []).map(h => ({
              stage: stageMap[h.stage] || h.stage,
              date: h.date || '',
              notes: h.notes || ''
            })),
            follow_up_count: (ven.stage_history || []).filter(h => h.stage && h.stage.includes('follow_up')).length,
            first_contacted_date: ven.first_contacted_date || null,
            gig: ven.gig ? {
              date: ven.gig.date || '',
              fee: ven.gig.fee || 0,
              set_times: ven.gig.set_times ? ven.gig.set_times.join(' - ') : '',
              sound_check: ven.gig.sound_check_time || '',
              pa_provided: ven.gig.pa_provided || false,
              rider: ven.gig.rider_notes || '',
              accommodation_offered: ven.gig.accommodation_offered || false
            } : null,
            marketing: { epk_sent: false, epk_sent_date: null, media_pack_sent: false, media_pack_sent_date: null, tcs_sent: false, tcs_sent_date: null, reels_captured: ven.marketing?.reels_captured || false, venue_tagged: ven.marketing?.venue_tagged_dylan || false, content_notes: ven.marketing?.content_notes || '' },
            decline_reason: null,
            tags: ven.tags || [],
            status: ven.status === 'in_pipeline' ? 'active' : (ven.status || 'active'),
            created_at: '',
            updated_at: ''
          };
        });
      }

      // Migrate house concerts
      if (v2.house_concerts && Array.isArray(v2.house_concerts)) {
        migrated.house_concerts = v2.house_concerts.map((hc, idx) => {
          const stageMap = { 'posted': 'posted', 'interested': 'interested', 'confirmed': 'confirmed', 'completed': 'completed', 'cancelled': 'cancelled' };
          return {
            id: hc.id || `hc_${String(idx + 1).padStart(3, '0')}`,
            host_name: hc.host_name || '',
            host_contact_id: null,
            source: hc.source || '',
            source_detail: hc.source_detail || '',
            tour_stop_id: hc.tour_stop_id ? `stop_${String(hc.tour_stop_id).padStart(2, '0')}` : null,
            stage: stageMap[hc.pipeline_stage] || 'posted',
            stage_history: (hc.stage_history || []).map(h => ({
              stage: stageMap[h.stage] || h.stage,
              date: h.date || '',
              notes: h.notes || ''
            })),
            event: hc.event ? {
              date: hc.event.date || '',
              tier: hc.event.tier === 'starter' ? 'tier_1' : hc.event.tier === 'standard' ? 'tier_2' : hc.event.tier === 'premium' ? 'tier_3' : hc.event.tier,
              tickets_sold: hc.event.tickets_sold || 0,
              tickets_target: hc.event.tickets_target || 0,
              revenue_actual: hc.event.revenue_actual || 0,
              humanitix_link: hc.event.humanitix_link || '',
              door_time: '',
              start_time: hc.event.set_times ? hc.event.set_times[0] : ''
            } : null,
            marketing: { promo_kit_sent: hc.marketing?.promo_kit_sent || false, promo_kit_sent_date: hc.marketing?.promo_kit_sent_date || null, invite_generated: false, invite_url: null, host_posted_socials: hc.marketing?.host_posted_socials || false, reels_captured: hc.marketing?.reels_captured || false, content_notes: hc.marketing?.content_notes || '' },
            tags: hc.tags || [],
            status: hc.status === 'in_pipeline' ? 'active' : (hc.status || 'active'),
            created_at: '',
            updated_at: ''
          };
        });
      }

      // Migrate busking spots
      if (v2.busking_spots && Array.isArray(v2.busking_spots)) {
        migrated.busking_spots = v2.busking_spots.map((bsk, idx) => {
          const statusMap = { 'discovered': 'discovered', 'tested': 'tested', 'played': 'tested', 'regular': 'regular', 'retired': 'retired' };
          return {
            id: bsk.id || `bsk_${String(idx + 1).padStart(3, '0')}`,
            name: bsk.name || '',
            city: bsk.city || '',
            address: bsk.address || '',
            traffic_rating: bsk.foot_traffic_rating || 3,
            permit_required: bsk.permit_required || false,
            permit_obtained: bsk.permit_obtained || false,
            best_time: bsk.best_time_notes || '',
            acoustics_notes: bsk.acoustics_notes || '',
            tour_stop_id: bsk.tour_stop_id ? `stop_${String(bsk.tour_stop_id).padStart(2, '0')}` : null,
            status: statusMap[bsk.status] || 'discovered',
            sessions: (bsk.earnings_history || []).map((s, si) => ({
              id: `ses_${idx}_${si}`,
              date: s.date || '',
              duration_minutes: s.duration_minutes || 0,
              earnings: s.earnings || 0,
              merch_sales: s.merch_sales || 0,
              notes: s.notes || '',
              income_id: null
            })),
            earnings_stats: {
              total_earnings: bsk.total_earnings_logged || 0,
              total_sessions: bsk.total_sessions || 0,
              avg_earnings: bsk.avg_earnings_per_session || 0
            },
            tags: bsk.tags || [],
            created_at: bsk.discovered_date || '',
            updated_at: ''
          };
        });
      }

      // Migrate income history
      if (v2.income_history && Array.isArray(v2.income_history)) {
        migrated.income_log = v2.income_history.map((inc, idx) => {
          const typeMap = { 'busking': 'busking', 'venue_gig': 'venue', 'merch': 'merch', 'house_concert': 'house_concert', 'gig': 'venue' };
          let sourceType = '';
          let sourceId = '';
          if (inc.busking_spot_id) { sourceType = 'busking_spot'; sourceId = inc.busking_spot_id; }
          else if (inc.venue_id) { sourceType = 'venue'; sourceId = inc.venue_id; }
          return {
            id: inc.id || `inc_${String(idx + 1).padStart(3, '0')}`,
            date: inc.date ? inc.date.split('T')[0] : '',
            type: typeMap[inc.type] || inc.type || 'misc',
            amount: inc.amount || 0,
            source_entity_type: sourceType,
            source_entity_id: sourceId,
            tour_stop_id: inc.tour_stop_id ? `stop_${String(inc.tour_stop_id).padStart(2, '0')}` : null,
            payment_method: 'cash',
            merch_sales: 0,
            notes: inc.description || '',
            created_at: '',
            updated_at: ''
          };
        });
      }

      // Migrate expense history
      if (v2.expense_history && Array.isArray(v2.expense_history)) {
        migrated.expense_log = v2.expense_history.map((exp, idx) => ({
          id: exp.id || `exp_${String(idx + 1).padStart(3, '0')}`,
          date: exp.date ? exp.date.split('T')[0] : '',
          category: exp.category === 'dog' ? 'maverick' : exp.category || 'misc',
          amount: exp.amount || 0,
          description: exp.description || '',
          tour_stop_id: exp.tour_stop_id ? `stop_${String(exp.tour_stop_id).padStart(2, '0')}` : null,
          odometer: null,
          vehicle_related: exp.category === 'fuel' || exp.category === 'vehicle_maintenance',
          receipt_ref: '',
          created_at: '',
          updated_at: ''
        }));
      }

      // Migrate todos (if they exist in v2)
      if (v2.todos && Array.isArray(v2.todos)) {
        migrated.todos = v2.todos.map((todo, idx) => ({
          id: todo.id || `todo_${String(idx + 1).padStart(3, '0')}`,
          text: todo.text || todo.title || '',
          category: todo.category || 'ops',
          priority: todo.priority || 'medium',
          due_date: todo.due_date || null,
          completed: todo.completed || false,
          completed_at: todo.completed_at || null,
          auto_generated: false,
          source_entity_type: null,
          source_entity_id: null,
          created_at: '',
          updated_at: ''
        }));
      }

      // Migrate meta
      if (v2.meta) {
        migrated.meta.artist = {
          name: v2.meta.artist?.name || 'Dylan Crowe',
          email: v2.meta.artist?.email || '',
          phone: '0411 926 271',
          ig: v2.meta.artist?.instagram || '',
          yt: '@dylancrowemusic'
        };
      }

      _data = migrated;
      saveData();
      return migrated;
    } catch (e) {
      console.error('TourOS: v2 migration failed', e);
      return null;
    }
  }

  // ===== Event System =====
  function onDataChange(callback) {
    if (typeof callback === 'function') {
      _changeCallbacks.push(callback);
    }
  }

  function notifyChange() {
    _changeCallbacks.forEach(cb => {
      try {
        cb(_data);
      } catch (e) {
        console.error('TourOS: Change callback error', e);
      }
    });
  }

  // ===== Reset to seed data =====
  function resetToSeed() {
    _data = _deepMerge(_defaultState(), _getSeedData());
    saveData();
    return _data;
  }

  // ===== Get full data object =====
  function getData() {
    if (!_data) loadData();
    return _data;
  }

  // ===== Public API =====
  return {
    // Storage
    loadData,
    saveData,
    getData,
    resetToSeed,
    exportData,
    importData,
    migrateV2Data,
    // IDs
    generateId,
    // Current stop
    getCurrentStop,
    setCurrentStop,
    // CRUD
    createEntity,
    getEntity,
    getAllEntities,
    updateEntity,
    deleteEntity,
    archiveEntity,
    // Pipeline
    advancePipeline,
    getValidTransitions,
    // Recalculation
    recalculateStop,
    recalculateAll,
    // Events
    onDataChange,
    notifyChange,
    // Config
    PIPELINES,
    STORAGE_KEY
  };
})();

// Expose globally
if (typeof window !== 'undefined') {
  window.TourOS = TourOS;
}

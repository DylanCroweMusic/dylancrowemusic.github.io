/* ═══════════════════════════════════════════════════════════════
   TOUR OS v3 — PIPELINE VIEW
   Venue + House Concert Kanban, Detail Modals, Stage Advancement,
   Media Pack / T&Cs Sending, Marketing Checklists
   
   Renders into div#view-pipeline
   Loaded after main dashboard script — overrides renderPipeline()
   ═══════════════════════════════════════════════════════════════ */

(function() {
'use strict';

/* ═══════════════════════════════════════════════════════════════
   SECTION 0: V3 DATA LAYER ADAPTER
   Wraps the existing D global with v3 API functions.
   Normalizes v2 field names (pipeline_stage) and stage names to v3 canonical.
   ═══════════════════════════════════════════════════════════════ */

// V2 → V3 stage mapping for venues
var VENUE_STAGE_MAP = {
  'not_contacted': 'not_contacted',
  'called':        'contacted',
  'emailed':       'contacted',
  'follow_up_1':   'follow_up',
  'follow_up_2':   'follow_up',
  'booked':        'booked',
  'confirmed':     'confirmed',
  'played':        'played',
  'declined':      'declined',
  'cancelled':     'cancelled'
};

// V3 canonical venue stages in pipeline order
var VENUE_STAGES_V3 = ['not_contacted', 'contacted', 'follow_up', 'booked', 'confirmed', 'played'];
var VENUE_TERMINAL  = ['declined', 'cancelled'];

// V3 venue stage transitions
var VENUE_TRANSITIONS = {
  'not_contacted': ['contacted', 'declined'],
  'contacted':    ['follow_up', 'booked', 'declined'],
  'follow_up':    ['follow_up', 'booked', 'declined'],
  'booked':       ['confirmed', 'cancelled'],
  'confirmed':    ['played', 'cancelled'],
  'played':       [],
  'declined':     ['not_contacted'],
  'cancelled':    ['not_contacted']
};

// V3 canonical HC stages in pipeline order
var HC_STAGES_V3 = ['posted', 'interested', 'confirmed', 'completed'];
var HC_TERMINAL  = ['cancelled'];

// V3 HC stage transitions
var HC_TRANSITIONS = {
  'posted':     ['interested'],
  'interested': ['confirmed', 'cancelled'],
  'confirmed':  ['completed', 'cancelled'],
  'completed':  [],
  'cancelled':  ['posted']
};

// Stage display labels
var VENUE_STAGE_LABELS = {
  'not_contacted': 'Not Contacted',
  'contacted':     'Contacted',
  'follow_up':     'Follow Up',
  'booked':        'Booked',
  'confirmed':     'Confirmed',
  'played':        'Played',
  'declined':      'Declined',
  'cancelled':     'Cancelled'
};

var HC_STAGE_LABELS = {
  'posted':     'Posted',
  'interested': 'Interested',
  'confirmed':  'Confirmed',
  'completed':  'Completed',
  'cancelled':  'Cancelled'
};

// Stage colors
var VENUE_STAGE_COLORS = {
  'not_contacted': '#6b7280',
  'contacted':     '#3b82f6',
  'follow_up':     '#f59e0b',
  'booked':        '#22c55e',
  'confirmed':     '#06b6d4',
  'played':        '#14b8a6',
  'declined':      '#ef4444',
  'cancelled':     '#ef4444'
};

var HC_STAGE_COLORS = {
  'posted':     '#6b7280',
  'interested': '#f59e0b',
  'confirmed':  '#22c55e',
  'completed':  '#14b8a6',
  'cancelled':  '#ef4444'
};

// Decline reasons
var DECLINE_REASONS = [
  'No availability on tour dates',
  'Already booked',
  'Budget constraints',
  'Not interested in live music',
  'Venue closing/renovating',
  'No response after 3+ follow-ups',
  'Other'
];

/* ── Normalize: v2 venue → v3 venue ── */
function normalizeVenue(v) {
  var rawStage = v.stage || v.pipeline_stage || 'not_contacted';
  var stage = VENUE_STAGE_MAP[rawStage] || rawStage;
  
  // Normalize marketing fields (v2 → v3)
  var mkt = v.marketing || {};
  var marketing = {
    epk_sent:           !!(mkt.epk_sent),
    epk_sent_date:      mkt.epk_sent_date || null,
    media_pack_sent:    !!(mkt.media_pack_sent),
    media_pack_sent_date: mkt.media_pack_sent_date || null,
    tcs_sent:           !!(mkt.tcs_sent),
    tcs_sent_date:      mkt.tcs_sent_date || null,
    reels_captured:     !!(mkt.reels_captured),
    venue_tagged:       !!(mkt.venue_tagged || mkt.venue_tagged_dylan),
    content_notes:      mkt.content_notes || ''
  };
  
  // Normalize stage_history
  var stageHistory = (v.stage_history || []).map(function(sh) {
    return {
      stage: VENUE_STAGE_MAP[sh.stage] || sh.stage,
      date: sh.date || '',
      notes: sh.notes || ''
    };
  });
  
  // Normalize gig
  var gig = v.gig ? {
    date: v.gig.date || '',
    fee: v.gig.fee || 0,
    set_times: v.gig.set_times || [],
    set_duration_minutes: v.gig.set_duration_minutes || 45,
    sound_check: v.gig.sound_check_time || v.gig.sound_check || '',
    pa_provided: v.gig.pa_provided !== undefined ? v.gig.pa_provided : true,
    rider: v.gig.rider_notes || v.gig.rider || '',
    accommodation_offered: v.gig.accommodation_offered || false
  } : null;
  
  return {
    id: v.id,
    name: v.name || '',
    phone: v.phone || '',
    email: v.email || '',
    contact_name: v.contact_name || '',
    contact_id: v.contact_id || '',
    type: v.venue_type || v.type || '',
    city: v.city || '',
    state: v.state || '',
    priority: v.priority || 'medium',
    tour_stop_id: v.tour_stop_id,
    stage: stage,
    stage_history: stageHistory,
    follow_up_count: v.follow_up_count || 0,
    first_contacted_date: v.first_contacted_date || null,
    gig: gig,
    marketing: marketing,
    decline_reason: v.decline_reason || null,
    tags: v.tags || [],
    status: v.status || 'active',
    _raw: v  // keep reference to original for saving
  };
}

/* ── Normalize: v2 HC → v3 HC ── */
function normalizeHC(h) {
  var rawStage = h.stage || h.pipeline_stage || 'posted';
  // HC stages already match v3, but handle edge cases
  var stage = rawStage;
  
  var mkt = h.marketing || {};
  var marketing = {
    promo_kit_sent:        !!(mkt.promo_kit_sent),
    promo_kit_sent_date:   mkt.promo_kit_sent_date || null,
    invite_generated:      !!(mkt.invite_generated),
    invite_url:            mkt.invite_url || null,
    host_posted_socials:   !!(mkt.host_posted_socials),
    reels_captured:        !!(mkt.reels_captured),
    content_notes:         mkt.content_notes || ''
  };
  
  var stageHistory = (h.stage_history || []).map(function(sh) {
    return {
      stage: sh.stage,
      date: sh.date || '',
      notes: sh.notes || ''
    };
  });
  
  var event = h.event ? {
    date: h.event.date || '',
    tier: h.event.tier || 'tier_2',
    tickets_sold: h.event.tickets_sold || 0,
    tickets_target: h.event.tickets_target || 0,
    revenue_actual: h.event.revenue_actual || 0,
    revenue_projected: h.event.revenue_projected || 0,
    humanitix_link: h.event.humanitix_link || '',
    door_time: h.event.door_time || '',
    start_time: h.event.start_time || ''
  } : null;
  
  return {
    id: h.id,
    host_name: h.host_name || '',
    host_phone: h.host_phone || '',
    host_email: h.host_email || '',
    host_contact_id: h.host_contact_id || '',
    source: h.source || '',
    source_detail: h.source_detail || '',
    tour_stop_id: h.tour_stop_id,
    stage: stage,
    stage_history: stageHistory,
    event: event,
    marketing: marketing,
    tags: h.tags || [],
    status: h.status || 'active',
    _raw: h
  };
}

/* ── V3 Data API (wraps existing D global) ── */
function v3_getAllEntities(type) {
  if (type === 'venues') return (D.venues || []).map(normalizeVenue);
  if (type === 'house_concerts') return (D.house_concerts || []).map(normalizeHC);
  return [];
}

function v3_getEntity(type, id) {
  var arr = type === 'venues' ? D.venues : (type === 'house_concerts' ? D.house_concerts : []);
  var raw = arr.find(function(e) { return e.id === id; });
  if (!raw) return null;
  return type === 'venues' ? normalizeVenue(raw) : normalizeHC(raw);
}

function v3_getRawEntity(type, id) {
  var arr = type === 'venues' ? D.venues : (type === 'house_concerts' ? D.house_concerts : []);
  return arr.find(function(e) { return e.id === id; });
}

function v3_updateEntity(type, id, data) {
  var raw = v3_getRawEntity(type, id);
  if (!raw) return;
  // Merge data into raw object
  Object.keys(data).forEach(function(k) {
    if (k === '_raw' || k === 'stage' || k === 'stage_history') return;
    raw[k] = data[k];
  });
  // Handle stage updates specially
  if (data.stage) {
    raw.stage = data.stage;
    raw.pipeline_stage = data.stage; // keep v2 compat
    raw.status = data.stage;
  }
  if (data.stage_history) {
    raw.stage_history = data.stage_history;
  }
  if (data.marketing) {
    raw.marketing = raw.marketing || {};
    Object.keys(data.marketing).forEach(function(k) {
      raw.marketing[k] = data.marketing[k];
    });
  }
  if (data.gig) {
    raw.gig = data.gig;
  }
  if (data.event) {
    raw.event = data.event;
  }
  raw.updated_at = new Date().toISOString();
  saveEdits();
}

function v3_advancePipeline(type, id, newStage, notes) {
  var raw = v3_getRawEntity(type, id);
  if (!raw) return;
  var today = new Date().toISOString().slice(0, 10);
  
  // Get current stage (normalized)
  var currentStage;
  if (type === 'venues') {
    var norm = normalizeVenue(raw);
    currentStage = norm.stage;
  } else {
    currentStage = raw.stage || raw.pipeline_stage || 'posted';
  }
  
  // Update stage
  raw.stage = newStage;
  raw.pipeline_stage = newStage; // v2 compat
  raw.status = newStage;
  
  // Log to stage_history
  raw.stage_history = raw.stage_history || [];
  raw.stage_history.push({
    stage: newStage,
    date: today,
    notes: notes || ''
  });
  
  // Handle follow_up count increment
  if (type === 'venues' && newStage === 'follow_up' && currentStage === 'follow_up') {
    raw.follow_up_count = (raw.follow_up_count || 0) + 1;
  }
  
  // Handle first_contacted_date
  if (type === 'venues' && !raw.first_contacted_date && (newStage === 'contacted' || newStage === 'called' || newStage === 'emailed')) {
    raw.first_contacted_date = today;
  }
  
  // Handle decline_reason
  if (newStage === 'declined' && notes) {
    raw.decline_reason = notes;
  }
  
  // Handle confirmed venue → init gig if missing
  if (type === 'venues' && newStage === 'booked' && !raw.gig) {
    raw.gig = {
      date: '', fee: 400, set_times: [], set_duration_minutes: 45,
      sound_check_time: '', pa_provided: true, rider_notes: '', venue_notes: ''
    };
  }
  
  // Handle HC confirmed → init event if missing
  if (type === 'house_concerts' && newStage === 'confirmed' && !raw.event) {
    var stop = (D.tour_stops || []).find(function(s) { return s.id === raw.tour_stop_id; });
    raw.event = {
      date: stop ? (stop.arrival_date || '') : '',
      tier: 'tier_2',
      tickets_sold: 0,
      tickets_target: 30,
      revenue_projected: 750,
      revenue_actual: 0,
      humanitix_link: ''
    };
  }
  
  raw.updated_at = new Date().toISOString();
  saveEdits();
}

function v3_getValidTransitions(type, stage) {
  var transitions = type === 'venues' ? VENUE_TRANSITIONS : HC_TRANSITIONS;
  return transitions[stage] || [];
}

function v3_archiveEntity(type, id) {
  var raw = v3_getRawEntity(type, id);
  if (!raw) return;
  raw.status = 'archived';
  raw.updated_at = new Date().toISOString();
  saveEdits();
}

function v3_deleteEntity(type, id) {
  if (type === 'venues') {
    D.venues = (D.venues || []).filter(function(v) { return v.id !== id; });
  } else if (type === 'house_concerts') {
    D.house_concerts = (D.house_concerts || []).filter(function(h) { return h.id !== id; });
  }
  // Also remove from tour_stop arrays
  (D.tour_stops || []).forEach(function(stop) {
    if (type === 'venues' && stop.venue_ids) {
      stop.venue_ids = stop.venue_ids.filter(function(vid) { return vid !== id; });
    }
    if (type === 'house_concerts' && stop.house_concert_ids) {
      stop.house_concert_ids = stop.house_concert_ids.filter(function(hid) { return hid !== id; });
    }
  });
  saveEdits();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 1: PIPELINE STATE
   ═══════════════════════════════════════════════════════════════ */

var pipeState = {
  mode: 'venues',          // 'venues' | 'house_concerts'
  filterStage: 'all',      // 'all' or a specific stage
  searchTerm: '',
  showAllStops: false,     // false = current stop only
  editMode: false          // for detail modal edit toggle
};

/* ═══════════════════════════════════════════════════════════════
   SECTION 2: MAIN RENDER — overrides existing renderPipeline()
   ═══════════════════════════════════════════════════════════════ */

window.renderPipeline = function() {
  var container = document.getElementById('pipeline-container');
  if (!container) return;
  
  var stop = getCurrentStop();
  
  // ── Segmented control ──
  var html = '';
  html += '<div class="seg-control">';
  html += '<button class="seg-btn ' + (pipeState.mode === 'venues' ? 'active' : '') + '" onclick="V3Pipe.setMode(\'venues\')">🏢 Venues</button>';
  html += '<button class="seg-btn ' + (pipeState.mode === 'house_concerts' ? 'active' : '') + '" onclick="V3Pipe.setMode(\'house_concerts\')">🏠 House Concerts</button>';
  html += '</div>';
  
  // ── Filter bar ──
  html += renderFilterBar();
  
  // ── Scope label ──
  var allEntities = getScopedEntities();
  var scopeLabel = pipeState.showAllStops ? 'All stops' : (stop ? stop.name : 'No active stop');
  html += '<div class="pipe-scope-label">' + scopeLabel + ' — ' + allEntities.length + ' total</div>';
  
  // ── Render pipeline groups ──
  if (pipeState.mode === 'venues') {
    html += renderVenuePipeline(allEntities);
  } else {
    html += renderHCPipeline(allEntities);
  }
  
  if (!allEntities.length) {
    var emptyMsg = pipeState.mode === 'venues' 
      ? 'No venues in pipeline. Tap + to add a venue.'
      : 'No house concerts yet. Tap + to add a host.';
    html = html.replace(/<div class="pipe-scope-label">.*<\/div>/, '');
    html += '<div class="empty-state">' + emptyMsg + '</div>';
  }
  
  container.innerHTML = html;
};

/* ── Scoped entities (current stop or all) ── */
function getScopedEntities() {
  var stop = getCurrentStop();
  var type = pipeState.mode;
  
  var entities;
  if (pipeState.showAllStops) {
    entities = v3_getAllEntities(type);
  } else {
    if (!stop) return [];
    entities = v3_getAllEntities(type).filter(function(e) {
      return e.tour_stop_id === stop.id;
    });
    // If current stop has few, also show next stop
    if (entities.length < 3) {
      var stopIdx = (D.tour_stops || []).findIndex(function(s) { return s.id === stop.id; });
      if (stopIdx >= 0 && stopIdx < D.tour_stops.length - 1) {
        var nextStop = D.tour_stops[stopIdx + 1];
        var nextEntities = v3_getAllEntities(type).filter(function(e) {
          return e.tour_stop_id === nextStop.id;
        });
        entities = entities.concat(nextEntities);
      }
    }
  }
  
  // Apply search filter
  var searchLower = (pipeState.searchTerm || '').toLowerCase();
  if (searchLower) {
    entities = entities.filter(function(e) {
      var name = (pipeState.mode === 'venues' ? e.name : e.host_name) || '';
      var city = e.city || '';
      var contact = e.contact_name || e.host_name || '';
      return name.toLowerCase().indexOf(searchLower) !== -1 ||
             city.toLowerCase().indexOf(searchLower) !== -1 ||
             contact.toLowerCase().indexOf(searchLower) !== -1;
    });
  }
  
  return entities;
}

/* ── Filter bar ── */
function renderFilterBar() {
  var stages = pipeState.mode === 'venues' ? VENUE_STAGES_V3.concat(VENUE_TERMINAL) : HC_STAGES_V3.concat(HC_TERMINAL);
  var labels = pipeState.mode === 'venues' ? VENUE_STAGE_LABELS : HC_STAGE_LABELS;
  
  var html = '<div class="filter-bar">';
  html += '<select onchange="V3Pipe.setFilterStage(this.value)">';
  html += '<option value="all"' + (pipeState.filterStage === 'all' ? ' selected' : '') + '>All Stages</option>';
  stages.forEach(function(s) {
    html += '<option value="' + s + '"' + (pipeState.filterStage === s ? ' selected' : '') + '>' + labels[s] + '</option>';
  });
  html += '</select>';
  html += '<input type="text" placeholder="🔍 Search…" value="' + escAttr(pipeState.searchTerm) + '" oninput="V3Pipe.setSearch(this.value)">';
  html += '<label class="pipe-toggle"><input type="checkbox" ' + (pipeState.showAllStops ? 'checked' : '') + ' onchange="V3Pipe.setShowAll(this.checked)"> All stops</label>';
  html += '</div>';
  
  return html;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3: VENUE PIPELINE
   ═══════════════════════════════════════════════════════════════ */

function renderVenuePipeline(entities) {
  var html = '';
  var stagesToShow = pipeState.filterStage === 'all' 
    ? VENUE_STAGES_V3 
    : [pipeState.filterStage];
  
  // Main stages
  stagesToShow.forEach(function(stage) {
    var stageVenues = entities.filter(function(v) { return v.stage === stage; });
    if (!stageVenues.length) return;
    html += renderVenueStageGroup(stage, stageVenues);
  });
  
  // Terminal stages (collapsible)
  if (pipeState.filterStage === 'all' || VENUE_TERMINAL.indexOf(pipeState.filterStage) !== -1) {
    VENUE_TERMINAL.forEach(function(stage) {
      if (pipeState.filterStage !== 'all' && pipeState.filterStage !== stage) return;
      var stageVenues = entities.filter(function(v) { return v.stage === stage; });
      if (!stageVenues.length) return;
      html += renderVenueTerminalGroup(stage, stageVenues);
    });
  }
  
  return html;
}

function renderVenueStageGroup(stage, venues) {
  var color = VENUE_STAGE_COLORS[stage] || '#888';
  var label = VENUE_STAGE_LABELS[stage] || stage;
  
  var html = '<div class="pipe-group">';
  html += '<div class="pipe-group-title" style="color:' + color + '">';
  html += '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';display:inline-block"></span>';
  html += label;
  html += '<span class="pipe-count">' + venues.length + '</span>';
  html += '</div>';
  
  venues.forEach(function(v) {
    html += renderVenueCard(v);
  });
  
  html += '</div>';
  return html;
}

function renderVenueTerminalGroup(stage, venues) {
  var color = VENUE_STAGE_COLORS[stage] || '#888';
  var label = VENUE_STAGE_LABELS[stage] || stage;
  var groupId = 'venue-terminal-' + stage;
  
  var html = '<div class="pipe-group pipe-terminal">';
  html += '<div class="pipe-group-title collapsible" style="color:' + color + ';cursor:pointer" onclick="V3Pipe.toggleCollapse(\'' + groupId + '\')">';
  html += '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';display:inline-block"></span>';
  html += label;
  html += '<span class="pipe-count">' + venues.length + '</span>';
  html += '<span class="collapse-icon" id="' + groupId + '-icon">▼</span>';
  html += '</div>';
  html += '<div class="pipe-terminal-body" id="' + groupId + '" style="display:none">';
  venues.forEach(function(v) {
    html += renderVenueCard(v);
  });
  html += '</div>';
  html += '</div>';
  return html;
}

function renderVenueCard(v) {
  var color = VENUE_STAGE_COLORS[v.stage] || '#888';
  var prioColor, prioBg, prioText;
  if (v.priority === 'high') { prioColor = '#ef4444'; prioBg = 'rgba(239,68,68,0.15)'; prioText = 'HIGH'; }
  else if (v.priority === 'low') { prioColor = '#9ca3af'; prioBg = 'rgba(156,163,175,0.12)'; prioText = 'LOW'; }
  else { prioColor = '#f59e0b'; prioBg = 'rgba(245,158,11,0.15)'; prioText = 'MED'; }
  
  var vid = v.id.replace(/'/g, "\\'");
  
  var html = '<div class="venue-card v3-venue-card" style="border-left:3px solid ' + color + '" onclick="V3Pipe.openVenueDetail(\'' + vid + '\')">';
  html += '<div class="entity-hdr">';
  html += '<div>';
  html += '<div class="entity-name">' + escHtml(v.name) + ' <span class="venue-stage-badge" style="background:' + prioBg + ';color:' + prioColor + '">' + prioText + '</span></div>';
  html += '<div class="entity-sub">' + escHtml(v.type) + ' · ' + escHtml(v.city) + '</div>';
  html += '</div>';
  html += '<span class="venue-stage-badge" style="background:' + color + '22;color:' + color + '">' + VENUE_STAGE_LABELS[v.stage] + '</span>';
  html += '</div>';
  
  if (v.contact_name) {
    html += '<div class="entity-row"><span class="lbl">Contact</span><span>' + escHtml(v.contact_name) + '</span></div>';
  }
  if (v.phone) {
    html += '<div class="entity-row"><span class="lbl">📞</span><a href="tel:' + encodeURIComponent(v.phone) + '" style="color:var(--cyan)" onclick="event.stopPropagation()">' + escHtml(v.phone) + '</a></div>';
  }
  if (v.gig && v.gig.date) {
    html += '<div class="entity-row"><span class="lbl">Gig Date</span><span style="color:var(--st-booked)">' + v.gig.date + '</span></div>';
  }
  
  // Follow-up count badge
  if (v.stage === 'follow_up' && v.follow_up_count > 0) {
    html += '<div class="followup-alert">Follow-up #' + v.follow_up_count + '</div>';
  }
  
  html += '</div>';
  return html;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4: HOUSE CONCERT PIPELINE
   ═══════════════════════════════════════════════════════════════ */

function renderHCPipeline(entities) {
  var html = '';
  var stagesToShow = pipeState.filterStage === 'all' 
    ? HC_STAGES_V3 
    : [pipeState.filterStage];
  
  // Main stages
  stagesToShow.forEach(function(stage) {
    var stageHCs = entities.filter(function(h) { return h.stage === stage; });
    if (!stageHCs.length) return;
    html += renderHCStageGroup(stage, stageHCs);
  });
  
  // Terminal (cancelled) — collapsible
  if (pipeState.filterStage === 'all' || pipeState.filterStage === 'cancelled') {
    var cancelledHCs = entities.filter(function(h) { return h.stage === 'cancelled'; });
    if (cancelledHCs.length) {
      html += renderHCTerminalGroup('cancelled', cancelledHCs);
    }
  }
  
  return html;
}

function renderHCStageGroup(stage, hcs) {
  var color = HC_STAGE_COLORS[stage] || '#888';
  var label = HC_STAGE_LABELS[stage] || stage;
  
  var html = '<div class="pipe-group">';
  html += '<div class="pipe-group-title" style="color:' + color + '">';
  html += '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';display:inline-block"></span>';
  html += label;
  html += '<span class="pipe-count">' + hcs.length + '</span>';
  html += '</div>';
  
  hcs.forEach(function(h) {
    html += renderHCCard(h);
  });
  
  html += '</div>';
  return html;
}

function renderHCTerminalGroup(stage, hcs) {
  var color = HC_STAGE_COLORS[stage] || '#888';
  var label = HC_STAGE_LABELS[stage] || stage;
  var groupId = 'hc-terminal-' + stage;
  
  var html = '<div class="pipe-group pipe-terminal">';
  html += '<div class="pipe-group-title collapsible" style="color:' + color + ';cursor:pointer" onclick="V3Pipe.toggleCollapse(\'' + groupId + '\')">';
  html += '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';display:inline-block"></span>';
  html += label;
  html += '<span class="pipe-count">' + hcs.length + '</span>';
  html += '<span class="collapse-icon" id="' + groupId + '-icon">▼</span>';
  html += '</div>';
  html += '<div class="pipe-terminal-body" id="' + groupId + '" style="display:none">';
  hcs.forEach(function(h) {
    html += renderHCCard(h);
  });
  html += '</div>';
  html += '</div>';
  return html;
}

function renderHCCard(h) {
  var color = HC_STAGE_COLORS[h.stage] || '#888';
  var hid = h.id.replace(/'/g, "\\'");
  
  var html = '<div class="venue-card v3-hc-card" style="border-left:3px solid ' + color + '" onclick="V3Pipe.openHCDetail(\'' + hid + '\')">';
  html += '<div class="entity-hdr">';
  html += '<div>';
  html += '<div class="entity-name">🏠 ' + escHtml(h.host_name) + '</div>';
  html += '<div class="entity-sub">' + escHtml(h.source) + '</div>';
  html += '</div>';
  html += '<span class="venue-stage-badge" style="background:' + color + '22;color:' + color + '">' + HC_STAGE_LABELS[h.stage] + '</span>';
  html += '</div>';
  
  if (h.event && h.event.date) {
    html += '<div class="entity-row"><span class="lbl">Event Date</span><span style="color:var(--house-l)">' + h.event.date + '</span></div>';
  }
  if (h.source_detail) {
    html += '<div class="entity-row"><span class="lbl">Detail</span><span>' + escHtml(h.source_detail) + '</span></div>';
  }
  
  // Ticket progress if confirmed
  if (h.stage === 'confirmed' && h.event && h.event.tickets_target > 0) {
    var pct = Math.round((h.event.tickets_sold / h.event.tickets_target) * 100);
    html += '<div class="entity-row"><span class="lbl">Tickets</span><span>' + (h.event.tickets_sold||0) + '/' + h.event.tickets_target + ' (' + pct + '%)</span></div>';
    html += '<div class="stat-bar"><div class="stat-bar-fill" style="width:' + Math.min(pct,100) + '%;background:var(--house-l)"></div></div>';
  }
  
  html += '</div>';
  return html;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5: VENUE DETAIL MODAL
   ═══════════════════════════════════════════════════════════════ */

window.V3Pipe_openVenueDetail = function(venueId) {
  var v = v3_getEntity('venues', venueId);
  if (!v) return;
  pipeState.editMode = false;
  renderVenueDetailModal(v);
};

function renderVenueDetailModal(v) {
  var color = VENUE_STAGE_COLORS[v.stage] || '#888';
  var vid = v.id.replace(/'/g, "\\'");
  var isEditing = pipeState.editMode;
  
  var html = '';
  
  // Header
  html += '<div class="modal-hdr">';
  html += '<div class="modal-title">' + escHtml(v.name) + '</div>';
  html += '<button class="modal-close" onclick="closeModal(\'vd-modal\')">✕</button>';
  html += '</div>';
  
  // Venue header info
  html += '<div class="venue-detail-hdr">';
  html += '<div class="entity-row"><span class="lbl">Type</span><span>' + escHtml(v.type || '—') + '</span></div>';
  html += '<div class="entity-row"><span class="lbl">City</span><span>' + escHtml(v.city) + '</span></div>';
  html += '<div class="entity-row"><span class="lbl">Stage</span><span class="venue-stage-badge" style="background:' + color + '22;color:' + color + '">' + VENUE_STAGE_LABELS[v.stage] + '</span></div>';
  html += '</div>';
  
  // Editable fields
  html += '<div class="section-title" style="margin:0.6rem 0 0.4rem">Details</div>';
  if (isEditing) {
    html += renderVenueEditFields(v, vid);
  } else {
    html += renderVenueReadFields(v);
  }
  
  // Call button
  if (v.phone) {
    html += '<a href="tel:' + encodeURIComponent(v.phone) + '" class="venue-btn call" style="display:block;text-align:center;margin:0.5rem 0;text-decoration:none">📞 Call ' + escHtml(v.phone) + '</a>';
  }
  
  // Stage advancement
  html += renderVenueStageAdvancement(v, vid);
  
  // Stage history
  html += renderStageHistory(v.stage_history, VENUE_STAGE_LABELS);
  
  // Marketing checklist
  html += renderVenueMarketingChecklist(v, vid);
  
  // Gig details (if stage >= booked)
  var stageIdx = VENUE_STAGES_V3.indexOf(v.stage);
  if (stageIdx >= 3 || v.gig) { // booked, confirmed, played
    html += renderGigDetails(v, vid);
  }
  
  // Media Pack + T&Cs buttons
  html += '<div class="venue-actions" style="margin-top:0.6rem">';
  html += '<button class="venue-btn" style="color:var(--magenta);border-color:rgba(217,70,239,0.3);flex:1" onclick="V3Pipe.openMediaPack(\'venues\',\'' + vid + '\')">📦 Send Media Pack</button>';
  if (stageIdx >= 3) {
    html += '<button class="venue-btn" style="color:var(--cyan);border-color:rgba(0,210,255,0.3);flex:1" onclick="V3Pipe.openTcsComposer(\'' + vid + '\')">📋 Send T&Cs</button>';
  }
  html += '</div>';
  
  // Footer actions
  html += '<div class="venue-actions" style="margin-top:0.8rem;padding-top:0.6rem;border-top:1px solid var(--card-brd)">';
  html += '<button class="venue-btn" onclick="V3Pipe.toggleEdit()">' + (isEditing ? '✓ Save' : '✏ Edit') + '</button>';
  html += '<button class="venue-btn" onclick="V3Pipe.archiveVenue(\'' + vid + '\')">📦 Archive</button>';
  html += '<button class="venue-btn" style="color:var(--expense);border-color:rgba(239,68,68,0.3)" onclick="V3Pipe.deleteVenue(\'' + vid + '\')">🗑 Delete</button>';
  html += '</div>';
  
  var sheet = document.getElementById('vd-content');
  if (sheet) sheet.innerHTML = html;
  openModal('vd-modal');
}

function renderVenueReadFields(v) {
  var html = '';
  if (v.contact_name) html += '<div class="entity-row"><span class="lbl">Contact</span><span>' + escHtml(v.contact_name) + '</span></div>';
  if (v.phone) html += '<div class="entity-row"><span class="lbl">Phone</span><span>' + escHtml(v.phone) + '</span></div>';
  if (v.email) html += '<div class="entity-row"><span class="lbl">Email</span><span>' + escHtml(v.email) + '</span></div>';
  if (v.priority) html += '<div class="entity-row"><span class="lbl">Priority</span><span style="text-transform:capitalize">' + v.priority + '</span></div>';
  if (v.tags && v.tags.length) html += '<div class="entity-row"><span class="lbl">Tags</span><span>' + v.tags.join(', ') + '</span></div>';
  return html;
}

function renderVenueEditFields(v, vid) {
  var html = '';
  html += '<div class="modal-field"><label>Venue Name</label><input type="text" id="vd-edit-name" value="' + escAttr(v.name) + '"></div>';
  html += '<div class="modal-field"><label>Phone</label><input type="tel" id="vd-edit-phone" value="' + escAttr(v.phone) + '"></div>';
  html += '<div class="modal-field"><label>Email</label><input type="email" id="vd-edit-email" value="' + escAttr(v.email) + '"></div>';
  html += '<div class="modal-field"><label>Contact Name</label><input type="text" id="vd-edit-contact_name" value="' + escAttr(v.contact_name) + '"></div>';
  html += '<div class="modal-field"><label>Venue Type</label><input type="text" id="vd-edit-type" value="' + escAttr(v.type) + '"></div>';
  html += '<div class="modal-field"><label>Priority</label><select id="vd-edit-priority"><option value="high"' + (v.priority==='high'?' selected':'') + '>High</option><option value="medium"' + (v.priority==='medium'?' selected':'') + '>Medium</option><option value="low"' + (v.priority==='low'?' selected':'') + '>Low</option></select></div>';
  html += '<div class="modal-field"><label>Notes</label><textarea id="vd-edit-notes" rows="3">' + escAttr((v.marketing && v.marketing.content_notes) || '') + '</textarea></div>';
  return html;
}

function renderVenueStageAdvancement(v, vid) {
  var transitions = v3_getValidTransitions('venues', v.stage);
  if (!transitions.length) {
    return '<div class="section-title" style="margin:0.6rem 0 0.4rem">Stage Advancement</div><div class="empty-state" style="padding:0.5rem">No further stages (terminal)</div>';
  }
  
  var html = '<div class="section-title" style="margin:0.6rem 0 0.4rem">Stage Advancement</div>';
  html += '<div class="venue-actions">';
  
  transitions.forEach(function(newStage) {
    var label = VENUE_STAGE_LABELS[newStage] || newStage;
    var isDecline = newStage === 'declined';
    var isCancel = newStage === 'cancelled';
    var isReengage = newStage === 'not_contacted' && (v.stage === 'declined' || v.stage === 'cancelled');
    var isFollowUp = newStage === 'follow_up' && v.stage === 'follow_up';
    
    var btnColor = isDecline || isCancel ? 'var(--expense)' : 'var(--st-booked)';
    var btnBorder = isDecline || isCancel ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)';
    var btnLabel = label;
    if (isReengage) btnLabel = '🔄 Re-engage';
    if (isFollowUp) btnLabel = 'Follow Up → (count: ' + (v.follow_up_count + 1) + ')';
    
    var action = 'V3Pipe.advanceVenueStage(\'' + vid + '\',\'' + newStage + '\')';
    if (isDecline) action = 'V3Pipe.showDeclinePicker(\'' + vid + '\')';
    
    html += '<button class="venue-btn advance" style="color:' + btnColor + ';border-color:' + btnBorder + ';flex:1" onclick="' + action + '">→ ' + btnLabel + '</button>';
  });
  
  html += '</div>';
  return html;
}

function renderStageHistory(history, labels) {
  if (!history || !history.length) {
    return '<div class="section-title" style="margin:0.6rem 0 0.4rem">Stage History</div><div class="empty-state" style="padding:0.5rem">No history</div>';
  }
  
  var html = '<div class="section-title" style="margin:0.6rem 0 0.4rem">Stage History</div>';
  html += '<div class="stage-timeline">';
  history.forEach(function(sh, idx) {
    var label = labels[sh.stage] || sh.stage;
    html += '<div class="stage-tl-item">' + label + ' — ' + sh.date + (sh.notes ? ' (' + sh.notes + ')' : '') + '</div>';
  });
  html += '</div>';
  return html;
}

function renderVenueMarketingChecklist(v, vid) {
  var items = [
    { field: 'epk_sent', label: 'EPK Sent' },
    { field: 'media_pack_sent', label: 'Media Pack Sent' },
    { field: 'tcs_sent', label: 'T&Cs Sent' },
    { field: 'reels_captured', label: 'Reels Captured' },
    { field: 'venue_tagged', label: 'Venue Tagged' }
  ];
  
  var html = '<div class="section-title" style="margin:0.6rem 0 0.4rem">Marketing Checklist</div>';
  items.forEach(function(item) {
    var done = v.marketing && v.marketing[item.field];
    var dateField = item.field.replace('_sent', '_sent_date').replace('_tagged', '_tagged_date');
    var dateStr = (v.marketing && v.marketing[dateField]) ? ' (' + v.marketing[dateField] + ')' : '';
    html += '<div class="mkt-check ' + (done ? 'done' : '') + '" onclick="V3Pipe.toggleVenueMarketing(\'' + vid + '\',\'' + item.field + '\')">';
    html += '<div class="todo-check ' + (done ? 'done' : '') + '"></div>';
    html += '<span class="todo-text">' + item.label + dateStr + '</span>';
    html += '</div>';
  });
  return html;
}

function renderGigDetails(v, vid) {
  var gig = v.gig;
  if (!gig) {
    if (v.stage === 'booked') {
      return '<button class="modal-submit" onclick="V3Pipe.initGig(\'' + vid + '\')">Add Gig Details</button>';
    }
    return '';
  }
  
  var html = '<div class="section-title" style="margin:0.6rem 0 0.4rem">Gig Details</div>';
  html += '<div style="padding:0.5rem;background:rgba(34,197,94,0.06);border-radius:6px">';
  html += '<div class="entity-row"><span class="lbl">Date</span><input class="inline-edit" style="width:auto" type="date" value="' + (gig.date||'') + '" onchange="V3Pipe.updateGigField(\'' + vid + '\',\'date\',this.value)"></div>';
  html += '<div class="entity-row"><span class="lbl">Fee $</span><input class="inline-edit" type="number" value="' + (gig.fee||0) + '" onchange="V3Pipe.updateGigField(\'' + vid + '\',\'fee\',parseFloat(this.value)||0)"></div>';
  html += '<div class="entity-row"><span class="lbl">Set Times</span><input class="inline-edit" style="width:60%" type="text" value="' + escAttr((gig.set_times||[]).join(', ')) + '" onchange="V3Pipe.updateGigField(\'' + vid + '\',\'set_times\',this.value.split(\',\').map(function(s){return s.trim()}))"></div>';
  html += '<div class="entity-row"><span class="lbl">Sound Check</span><input class="inline-edit" style="width:80px" type="time" value="' + escAttr(gig.sound_check||'') + '" onchange="V3Pipe.updateGigField(\'' + vid + '\',\'sound_check\',this.value)"></div>';
  html += '<div class="entity-row"><span class="lbl">PA Provided</span><select class="inline-edit" onchange="V3Pipe.updateGigField(\'' + vid + '\',\'pa_provided\',this.value===\'true\')"><option value="true"' + (gig.pa_provided?' selected':'') + '>Yes</option><option value="false"' + (!gig.pa_provided?' selected':'') + '>No</option></select></div>';
  html += '<div class="entity-row"><span class="lbl">Rider</span><input class="inline-edit" style="width:60%" type="text" value="' + escAttr(gig.rider||'') + '" onchange="V3Pipe.updateGigField(\'' + vid + '\',\'rider\',this.value)"></div>';
  html += '</div>';
  return html;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 6: HC DETAIL MODAL
   ═══════════════════════════════════════════════════════════════ */

window.V3Pipe_openHCDetail = function(hcId) {
  var h = v3_getEntity('house_concerts', hcId);
  if (!h) return;
  pipeState.editMode = false;
  renderHCDetailModal(h);
};

function renderHCDetailModal(h) {
  var color = HC_STAGE_COLORS[h.stage] || '#888';
  var hid = h.id.replace(/'/g, "\\'");
  var isEditing = pipeState.editMode;
  
  var html = '';
  
  // Header
  html += '<div class="modal-hdr">';
  html += '<div class="modal-title">🏠 ' + escHtml(h.host_name) + '</div>';
  html += '<button class="modal-close" onclick="closeModal(\'hd-modal\')">✕</button>';
  html += '</div>';
  
  // HC header info
  html += '<div class="venue-detail-hdr">';
  html += '<div class="entity-row"><span class="lbl">Source</span><span>' + escHtml(h.source || '—') + '</span></div>';
  if (h.source_detail) html += '<div class="entity-row"><span class="lbl">Detail</span><span>' + escHtml(h.source_detail) + '</span></div>';
  html += '<div class="entity-row"><span class="lbl">Stage</span><span class="venue-stage-badge" style="background:' + color + '22;color:' + color + '">' + HC_STAGE_LABELS[h.stage] + '</span></div>';
  html += '</div>';
  
  // Editable fields
  html += '<div class="section-title" style="margin:0.6rem 0 0.4rem">Host Details</div>';
  if (isEditing) {
    html += renderHCEditFields(h, hid);
  } else {
    html += renderHCReadFields(h);
  }
  
  // Stage advancement
  html += renderHCStageAdvancement(h, hid);
  
  // Stage history
  html += renderStageHistory(h.stage_history, HC_STAGE_LABELS);
  
  // Event details (if stage >= confirmed)
  var stageIdx = HC_STAGES_V3.indexOf(h.stage);
  if (stageIdx >= 2 || h.event) { // confirmed, completed
    html += renderHCEventDetails(h, hid);
  }
  
  // Marketing checklist
  html += renderHCMarketingChecklist(h, hid);
  
  // Promo Kit button
  html += '<div class="venue-actions" style="margin-top:0.6rem">';
  html += '<button class="venue-btn" style="color:var(--magenta);border-color:rgba(217,70,239,0.3);flex:1" onclick="V3Pipe.openMediaPack(\'house_concerts\',\'' + hid + '\')">📦 Send Promo Kit</button>';
  html += '</div>';
  
  // Footer actions
  html += '<div class="venue-actions" style="margin-top:0.8rem;padding-top:0.6rem;border-top:1px solid var(--card-brd)">';
  html += '<button class="venue-btn" onclick="V3Pipe.toggleEdit()">' + (isEditing ? '✓ Save' : '✏ Edit') + '</button>';
  html += '<button class="venue-btn" onclick="V3Pipe.archiveHC(\'' + hid + '\')">📦 Archive</button>';
  html += '<button class="venue-btn" style="color:var(--expense);border-color:rgba(239,68,68,0.3)" onclick="V3Pipe.deleteHC(\'' + hid + '\')">🗑 Delete</button>';
  html += '</div>';
  
  var sheet = document.getElementById('hd-content');
  if (sheet) sheet.innerHTML = html;
  openModal('hd-modal');
}

function renderHCReadFields(h) {
  var html = '';
  if (h.host_phone) html += '<div class="entity-row"><span class="lbl">Phone</span><span>' + escHtml(h.host_phone) + '</span></div>';
  if (h.host_email) html += '<div class="entity-row"><span class="lbl">Email</span><span>' + escHtml(h.host_email) + '</span></div>';
  if (h.marketing && h.marketing.content_notes) html += '<div class="entity-row"><span class="lbl">Notes</span><span>' + escHtml(h.marketing.content_notes) + '</span></div>';
  return html;
}

function renderHCEditFields(h, hid) {
  var html = '';
  html += '<div class="modal-field"><label>Host Name</label><input type="text" id="hd-edit-host_name" value="' + escAttr(h.host_name) + '"></div>';
  html += '<div class="modal-field"><label>Phone</label><input type="tel" id="hd-edit-host_phone" value="' + escAttr(h.host_phone) + '"></div>';
  html += '<div class="modal-field"><label>Email</label><input type="email" id="hd-edit-host_email" value="' + escAttr(h.host_email) + '"></div>';
  html += '<div class="modal-field"><label>Source</label><select id="hd-edit-source">';
  ['Facebook group','Venue referral','Word of mouth','Instagram','Other'].forEach(function(s) {
    html += '<option value="' + s + '"' + (h.source === s ? ' selected' : '') + '>' + s + '</option>';
  });
  html += '</select></div>';
  html += '<div class="modal-field"><label>Notes</label><textarea id="hd-edit-notes" rows="3">' + escAttr((h.marketing && h.marketing.content_notes) || '') + '</textarea></div>';
  return html;
}

function renderHCStageAdvancement(h, hid) {
  var transitions = v3_getValidTransitions('house_concerts', h.stage);
  if (!transitions.length) {
    return '<div class="section-title" style="margin:0.6rem 0 0.4rem">Stage Advancement</div><div class="empty-state" style="padding:0.5rem">No further stages (terminal)</div>';
  }
  
  var html = '<div class="section-title" style="margin:0.6rem 0 0.4rem">Stage Advancement</div>';
  html += '<div class="venue-actions">';
  
  transitions.forEach(function(newStage) {
    var label = HC_STAGE_LABELS[newStage] || newStage;
    var isCancel = newStage === 'cancelled';
    var isReengage = newStage === 'posted' && h.stage === 'cancelled';
    
    var btnColor = isCancel ? 'var(--expense)' : 'var(--st-booked)';
    var btnBorder = isCancel ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)';
    if (isReengage) label = '🔄 Re-engage';
    
    html += '<button class="venue-btn advance" style="color:' + btnColor + ';border-color:' + btnBorder + ';flex:1" onclick="V3Pipe.advanceHCStage(\'' + hid + '\',\'' + newStage + '\')">→ ' + label + '</button>';
  });
  
  html += '</div>';
  return html;
}

function renderHCEventDetails(h, hid) {
  var event = h.event;
  if (!event) {
    if (h.stage === 'confirmed') {
      return '<button class="modal-submit" onclick="V3Pipe.initHCEvent(\'' + hid + '\')">Add Event Details</button>';
    }
    return '';
  }
  
  var html = '<div class="section-title" style="margin:0.6rem 0 0.4rem">Event Details</div>';
  html += '<div style="padding:0.5rem;background:rgba(217,119,6,0.06);border-radius:6px">';
  html += '<div class="entity-row"><span class="lbl">Date</span><input class="inline-edit" style="width:auto" type="date" value="' + (event.date||'') + '" onchange="V3Pipe.updateHCEventField(\'' + hid + '\',\'date\',this.value)"></div>';
  html += '<div class="entity-row"><span class="lbl">Tier</span><select class="inline-edit" onchange="V3Pipe.updateHCEventField(\'' + hid + '\',\'tier\',this.value)">';
  var tiers = (D.config && D.config.hc_tiers) || [
    {id:'tier_1',label:'Intimate'},{id:'tier_2',label:'Standard'},{id:'tier_3',label:'Large'}
  ];
  tiers.forEach(function(t) {
    html += '<option value="' + t.id + '"' + (event.tier === t.id ? ' selected' : '') + '>' + t.label + ' (' + (t.guests||'') + ')</option>';
  });
  html += '</select></div>';
  html += '<div class="entity-row"><span class="lbl">Tickets Sold</span><input class="inline-edit" type="number" value="' + (event.tickets_sold||0) + '" onchange="V3Pipe.updateHCEventField(\'' + hid + '\',\'tickets_sold\',parseInt(this.value)||0)"></div>';
  html += '<div class="entity-row"><span class="lbl">Tickets Target</span><input class="inline-edit" type="number" value="' + (event.tickets_target||0) + '" onchange="V3Pipe.updateHCEventField(\'' + hid + '\',\'tickets_target\',parseInt(this.value)||0)"></div>';
  html += '<div class="entity-row"><span class="lbl">Humanitix</span><input class="inline-edit" style="width:60%" type="text" value="' + escAttr(event.humanitix_link||'') + '" onchange="V3Pipe.updateHCEventField(\'' + hid + '\',\'humanitix_link\',this.value)"></div>';
  html += '</div>';
  return html;
}

function renderHCMarketingChecklist(h, hid) {
  var items = [
    { field: 'promo_kit_sent', label: 'Promo Kit Sent' },
    { field: 'invite_generated', label: 'Invite Generated' },
    { field: 'host_posted_socials', label: 'Host Posted Socials' },
    { field: 'reels_captured', label: 'Reels Captured' }
  ];
  
  var html = '<div class="section-title" style="margin:0.6rem 0 0.4rem">Marketing Checklist</div>';
  items.forEach(function(item) {
    var done = h.marketing && h.marketing[item.field];
    var dateStr = '';
    if (item.field === 'promo_kit_sent' && h.marketing && h.marketing.promo_kit_sent_date) {
      dateStr = ' (' + h.marketing.promo_kit_sent_date + ')';
    }
    html += '<div class="mkt-check ' + (done ? 'done' : '') + '" onclick="V3Pipe.toggleHCMarketing(\'' + hid + '\',\'' + item.field + '\')">';
    html += '<div class="todo-check ' + (done ? 'done' : '') + '"></div>';
    html += '<span class="todo-text">' + item.label + dateStr + '</span>';
    html += '</div>';
  });
  return html;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 7: MEDIA PACK COMPOSER
   ═══════════════════════════════════════════════════════════════ */

var mediaPackComponents = {
  epk:        { label: 'EPK Link',        included: true },
  bio:        { label: 'Bio',             included: true },
  quotes:     { label: 'Press Quotes',    included: true },
  photos:     { label: 'Photos',          included: true },
  videos:     { label: 'Videos',           included: true },
  tech:       { label: 'Tech Requirements', included: true },
  availability: { label: 'Availability',  included: true },
  tcs:        { label: 'T&Cs',            included: true }
};

window.V3Pipe_openMediaPack = function(type, entityId) {
  var entity, recipientName, recipientEmail, venueName, gigDate, fee;
  
  if (type === 'venues') {
    entity = v3_getEntity('venues', entityId);
    if (!entity) return;
    recipientName = entity.contact_name || entity.name;
    recipientEmail = entity.email || '';
    venueName = entity.name;
    gigDate = entity.gig ? entity.gig.date : '';
    fee = entity.gig ? entity.gig.fee : 400;
  } else {
    entity = v3_getEntity('house_concerts', entityId);
    if (!entity) return;
    recipientName = entity.host_name;
    recipientEmail = entity.host_email || '';
    venueName = entity.host_name + ' (House Concert)';
    gigDate = entity.event ? entity.event.date : '';
    fee = entity.event ? (entity.event.revenue_projected || 700) : 700;
  }
  
  // Store context for sending
  pipeState._mediaPackContext = { type: type, entityId: entityId, entity: entity };
  
  var html = '';
  html += '<div class="modal-hdr">';
  html += '<div class="modal-title">📦 Media Pack Composer</div>';
  html += '<button class="modal-close" onclick="closeModal(\'mp-modal\')">✕</button>';
  html += '</div>';
  
  // Recipient
  html += '<div class="entity-row"><span class="lbl">To</span><span>' + escHtml(recipientName) + (recipientEmail ? ' &lt;' + escHtml(recipientEmail) + '&gt;' : ' (no email)') + '</span></div>';
  
  // Components
  html += '<div class="section-title" style="margin:0.6rem 0 0.4rem">Components</div>';
  Object.keys(mediaPackComponents).forEach(function(key) {
    var comp = mediaPackComponents[key];
    html += '<div class="mkt-check ' + (comp.included ? '' : '') + '" onclick="V3Pipe.toggleMediaComp(\'' + key + '\')">';
    html += '<div class="todo-check ' + (comp.included ? 'done' : '') + '"></div>';
    html += '<span class="todo-text">' + comp.label + '</span>';
    html += '</div>';
  });
  
  // Delivery options
  html += '<div class="section-title" style="margin:0.6rem 0 0.4rem">Delivery</div>';
  html += '<div class="venue-actions">';
  html += '<button class="venue-btn advance" style="flex:1" onclick="V3Pipe.sendMediaPack(\'email\')">📧 Email (mailto:)</button>';
  html += '<button class="venue-btn" style="flex:1;color:var(--cyan);border-color:rgba(0,210,255,0.3)" onclick="V3Pipe.sendMediaPack(\'clipboard\')">📋 Copy to Clipboard</button>';
  html += '</div>';
  
  // Preview
  html += '<div class="section-title" style="margin:0.6rem 0 0.4rem">Preview</div>';
  html += '<div id="mp-preview" style="background:rgba(0,0,0,0.3);border-radius:8px;padding:0.6rem;font-size:0.7rem;white-space:pre-wrap;max-height:200px;overflow-y:auto">' + escHtml(buildMediaPackText(entity, type)) + '</div>';
  
  var sheet = ensureModalSheet('mp-modal');
  sheet.innerHTML = html;
  openModal('mp-modal');
};

function buildMediaPackText(entity, type) {
  var artistName = (D.meta && D.meta.artist && D.meta.artist.name) || 'Dylan Crowe';
  var artistEmail = (D.meta && D.meta.artist && D.meta.artist.email) || 'dylancrowemusic@gmail.com';
  var artistIG = (D.meta && D.meta.artist && D.meta.artist.ig) || '@dylan_crowe_music';
  var venueName, gigDate, fee;
  
  if (type === 'venues') {
    venueName = entity.name;
    gigDate = entity.gig ? entity.gig.date : '';
    fee = entity.gig ? entity.gig.fee : 400;
  } else {
    venueName = entity.host_name + ' (House Concert)';
    gigDate = entity.event ? entity.event.date : '';
    fee = entity.event ? (entity.event.revenue_projected || 700) : 700;
  }
  
  var subject = 'Dylan Crowe — Media Pack & T&Cs for ' + venueName;
  var lines = [];
  lines.push('Subject: ' + subject);
  lines.push('');
  lines.push('Hi ' + (entity.contact_name || entity.host_name || 'there') + ',');
  lines.push('');
  lines.push('Thanks for your interest in having ' + artistName + ' perform at ' + venueName + '.');
  lines.push('');
  lines.push('Here\'s everything you need:');
  lines.push('');
  
  if (mediaPackComponents.epk.included) {
    lines.push('── EPK ──');
    lines.push('Link: https://dylancrowemusic.github.io/epk');
    lines.push('');
  }
  if (mediaPackComponents.bio.included) {
    lines.push('── BIO ──');
    lines.push('Dylan Crowe is a solo musician touring Australia — one guitar, one dog, every town. Raw, authentic performances blending folk, blues, and roots.');
    lines.push('');
  }
  if (mediaPackComponents.quotes.included) {
    lines.push('── PRESS QUOTES ──');
    lines.push('"A voice that stops you in your tracks." — RTRFM');
    lines.push('"Genuine, heartfelt, and unmissable." — Tone Deaf');
    lines.push('');
  }
  if (mediaPackComponents.photos.included) {
    lines.push('── PHOTOS ──');
    lines.push('Hi-res: https://dylancrowemusic.github.io/photos');
    lines.push('');
  }
  if (mediaPackComponents.videos.included) {
    lines.push('── VIDEOS ──');
    lines.push('Live: https://youtube.com/@dylancrowemusic');
    lines.push('Reels: https://instagram.com/' + artistIG.replace('@',''));
    lines.push('');
  }
  if (mediaPackComponents.tech.included) {
    lines.push('── TECH REQUIREMENTS ──');
    lines.push('• 1× vocal mic (SM58 or similar)');
    lines.push('• 1× DI box for acoustic guitar');
    lines.push('• 2× floor monitors');
    lines.push('• PA with mixing (or bring own)');
    lines.push('');
  }
  if (mediaPackComponents.availability.included) {
    lines.push('── AVAILABILITY ──');
    if (gigDate) lines.push('Date: ' + gigDate);
    lines.push('Touring Aug–Dec 2026');
    lines.push('');
  }
  if (mediaPackComponents.tcs.included) {
    lines.push('── TERMS & CONDITIONS ──');
    lines.push('Fee: $' + fee);
    lines.push('Payment: Cash or transfer on the night');
    lines.push('Cancellation: 48hrs notice required');
    lines.push('Performance: 2× 45min sets + sound check');
    lines.push('Merch: Artist retains 100%');
    lines.push('');
  }
  
  lines.push('Looking forward to it!');
  lines.push('');
  lines.push(artistName);
  lines.push(artistEmail + ' | ' + artistIG);
  
  return lines.join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 8: T&Cs COMPOSER
   ═══════════════════════════════════════════════════════════════ */

window.V3Pipe_openTcsComposer = function(venueId) {
  var v = v3_getEntity('venues', venueId);
  if (!v) return;
  
  var gig = v.gig || {};
  var venueName = v.name;
  var gigDate = gig.date || '';
  var fee = gig.fee || 400;
  var setTimes = (gig.set_times || []).join(', ');
  var setDuration = gig.set_duration_minutes || 45;
  
  var html = '';
  html += '<div class="modal-hdr">';
  html += '<div class="modal-title">📋 T&Cs Composer</div>';
  html += '<button class="modal-close" onclick="closeModal(\'tc-modal\')">✕</button>';
  html += '</div>';
  
  // Context display
  html += '<div class="entity-row"><span class="lbl">Venue</span><span>' + escHtml(venueName) + '</span></div>';
  html += '<div class="entity-row"><span class="lbl">Date</span><span>' + (gigDate || 'TBD') + '</span></div>';
  html += '<div class="entity-row"><span class="lbl">Fee</span><span>$' + fee + '</span></div>';
  
  // T&Cs text with variable substitution
  var tcsText = buildTcsText(venueName, gigDate, fee, setTimes, setDuration);
  
  html += '<div class="section-title" style="margin:0.6rem 0 0.4rem">T&Cs Text</div>';
  html += '<div id="tc-preview" style="background:rgba(0,0,0,0.3);border-radius:8px;padding:0.6rem;font-size:0.7rem;white-space:pre-wrap;max-height:250px;overflow-y:auto">' + escHtml(tcsText) + '</div>';
  
  // Delivery options
  html += '<div class="section-title" style="margin:0.6rem 0 0.4rem">Delivery</div>';
  html += '<div class="venue-actions">';
  html += '<button class="venue-btn advance" style="flex:1" onclick="V3Pipe.sendTcs(\'email\',\'' + venueId.replace(/'/g,"\\'") + '\')">📧 Email (mailto:)</button>';
  html += '<button class="venue-btn" style="flex:1;color:var(--cyan);border-color:rgba(0,210,255,0.3)" onclick="V3Pipe.sendTcs(\'clipboard\',\'' + venueId.replace(/'/g,"\\'") + '\')">📋 Copy to Clipboard</button>';
  html += '</div>';
  
  var sheet = ensureModalSheet('tc-modal');
  sheet.innerHTML = html;
  openModal('tc-modal');
};

function buildTcsText(venueName, gigDate, fee, setTimes, setDuration) {
  var artistName = (D.meta && D.meta.artist && D.meta.artist.name) || 'Dylan Crowe';
  var subject = 'Dylan Crowe — Terms & Conditions for ' + venueName + (gigDate ? ' (' + gigDate + ')' : '');
  
  var lines = [];
  lines.push('Subject: ' + subject);
  lines.push('');
  lines.push('TERMS & CONDITIONS');
  lines.push('');
  lines.push('Venue: ' + venueName);
  if (gigDate) lines.push('Date: ' + gigDate);
  if (setTimes) lines.push('Set Times: ' + setTimes);
  lines.push('');
  lines.push('Fee: $' + fee);
  lines.push('Payment: Cash or bank transfer on the night');
  lines.push('Cancellation: 48hrs notice required (either party)');
  lines.push('Included: 1× ' + setDuration + 'min performance + sound check');
  lines.push('Merch: Artist retains 100% of merchandise sales');
  lines.push('PA: Provided by venue (unless otherwise agreed)');
  lines.push('Accommodation: Not required');
  lines.push('');
  lines.push('Please confirm by reply to lock in the date.');
  lines.push('');
  lines.push(artistName);
  
  return lines.join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 9: V3Pipe PUBLIC API (called from onclick handlers)
   ═══════════════════════════════════════════════════════════════ */

window.V3Pipe = {
  
  /* ── Segmented control ── */
  setMode: function(mode) {
    pipeState.mode = mode;
    pipeState.filterStage = 'all';
    pipeState.searchTerm = '';
    renderPipeline();
  },
  
  /* ── Filters ── */
  setFilterStage: function(stage) {
    pipeState.filterStage = stage;
    renderPipeline();
  },
  
  setSearch: function(term) {
    pipeState.searchTerm = term;
    renderPipeline();
  },
  
  setShowAll: function(val) {
    pipeState.showAllStops = val;
    renderPipeline();
  },
  
  /* ── Collapsible sections ── */
  toggleCollapse: function(groupId) {
    var body = document.getElementById(groupId);
    var icon = document.getElementById(groupId + '-icon');
    if (body) {
      var isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      if (icon) icon.textContent = isHidden ? '▲' : '▼';
    }
  },
  
  /* ── Venue detail ── */
  openVenueDetail: function(venueId) {
    V3Pipe_openVenueDetail(venueId);
  },
  
  openHCDetail: function(hcId) {
    V3Pipe_openHCDetail(hcId);
  },
  
  toggleEdit: function() {
    pipeState.editMode = !pipeState.editMode;
    // Save fields if switching from edit to read
    if (!pipeState.editMode) {
      // Determine which modal is open and save
      var vdModal = document.getElementById('vd-modal');
      var hdModal = document.getElementById('hd-modal');
      if (vdModal && vdModal.classList.contains('show')) {
        saveVenueEditFields();
      } else if (hdModal && hdModal.classList.contains('show')) {
        saveHCEditFields();
      }
    }
    // Re-render the open modal
    if (document.getElementById('vd-modal').classList.contains('show')) {
      var vid = getCurrentModalEntityId('venues');
      if (vid) {
        var v = v3_getEntity('venues', vid);
        if (v) renderVenueDetailModal(v);
      }
    } else if (document.getElementById('hd-modal').classList.contains('show')) {
      var hid = getCurrentModalEntityId('house_concerts');
      if (hid) {
        var h = v3_getEntity('house_concerts', hid);
        if (h) renderHCDetailModal(h);
      }
    }
  },
  
  /* ── Stage advancement ── */
  advanceVenueStage: function(venueId, newStage) {
    var v = v3_getEntity('venues', venueId);
    if (!v) return;
    
    var notes = '';
    if (newStage === 'follow_up' && v.stage === 'follow_up') {
      notes = 'Follow-up #' + (v.follow_up_count + 1);
    }
    
    v3_advancePipeline('venues', venueId, newStage, notes);
    showToast('✓ Stage: ' + VENUE_STAGE_LABELS[newStage]);
    
    // Re-render modal
    var updated = v3_getEntity('venues', venueId);
    if (updated) renderVenueDetailModal(updated);
  },
  
  advanceHCStage: function(hcId, newStage) {
    var h = v3_getEntity('house_concerts', hcId);
    if (!h) return;
    
    v3_advancePipeline('house_concerts', hcId, newStage, '');
    showToast('✓ Stage: ' + HC_STAGE_LABELS[newStage]);
    
    var updated = v3_getEntity('house_concerts', hcId);
    if (updated) renderHCDetailModal(updated);
  },
  
  showDeclinePicker: function(venueId) {
    var html = '';
    html += '<div class="modal-hdr">';
    html += '<div class="modal-title">Decline Venue</div>';
    html += '<button class="modal-close" onclick="closeModal(\'mp-modal\')">✕</button>';
    html += '</div>';
    html += '<div class="section-title" style="margin:0.6rem 0 0.4rem">Select Reason</div>';
    DECLINE_REASONS.forEach(function(reason) {
      var safeReason = reason.replace(/'/g, "\\'");
      html += '<button class="venue-btn" style="width:100%;margin-bottom:0.3rem;text-align:left" onclick="V3Pipe.confirmDecline(\'' + venueId + '\',\'' + safeReason + '\')">' + reason + '</button>';
    });
    
    var sheet = ensureModalSheet('mp-modal');
    sheet.innerHTML = html;
    openModal('mp-modal');
  },
  
  confirmDecline: function(venueId, reason) {
    v3_advancePipeline('venues', venueId, 'declined', reason);
    var raw = v3_getRawEntity('venues', venueId);
    if (raw) raw.decline_reason = reason;
    saveEdits();
    closeModal('mp-modal');
    showToast('✗ Venue declined: ' + reason);
    renderPipeline();
  },
  
  /* ── Marketing toggles ── */
  toggleVenueMarketing: function(venueId, field) {
    var v = v3_getEntity('venues', venueId);
    if (!v || !v.marketing) return;
    var newVal = !v.marketing[field];
    var data = { marketing: {} };
    data.marketing[field] = newVal;
    // Set date fields
    if (field === 'epk_sent' && newVal) data.marketing.epk_sent_date = new Date().toISOString().slice(0,10);
    if (field === 'media_pack_sent' && newVal) data.marketing.media_pack_sent_date = new Date().toISOString().slice(0,10);
    if (field === 'tcs_sent' && newVal) data.marketing.tcs_sent_date = new Date().toISOString().slice(0,10);
    v3_updateEntity('venues', venueId, data);
    
    var updated = v3_getEntity('venues', venueId);
    if (updated) renderVenueDetailModal(updated);
  },
  
  toggleHCMarketing: function(hcId, field) {
    var h = v3_getEntity('house_concerts', hcId);
    if (!h || !h.marketing) return;
    var newVal = !h.marketing[field];
    var data = { marketing: {} };
    data.marketing[field] = newVal;
    if (field === 'promo_kit_sent' && newVal) data.marketing.promo_kit_sent_date = new Date().toISOString().slice(0,10);
    v3_updateEntity('house_concerts', hcId, data);
    
    var updated = v3_getEntity('house_concerts', hcId);
    if (updated) renderHCDetailModal(updated);
  },
  
  /* ── Gig field update ── */
  updateGigField: function(venueId, field, value) {
    var raw = v3_getRawEntity('venues', venueId);
    if (!raw || !raw.gig) return;
    raw.gig[field] = value;
    // Map v3 field names to v2 for sound_check
    if (field === 'sound_check') raw.gig.sound_check_time = value;
    if (field === 'rider') raw.gig.rider_notes = value;
    saveEdits();
  },
  
  /* ── HC event field update ── */
  updateHCEventField: function(hcId, field, value) {
    var raw = v3_getRawEntity('house_concerts', hcId);
    if (!raw || !raw.event) return;
    raw.event[field] = value;
    // Recompute projected revenue
    if (field === 'tickets_target' || field === 'tier') {
      var price = 25;
      if (D.config && D.config.hc_tiers) {
        var tier = (D.config.hc_tiers || []).find(function(t) { return t.id === raw.event.tier; });
        if (tier) price = tier.ticket_price || 25;
      }
      raw.event.revenue_projected = (raw.event.tickets_target || 0) * price;
    }
    saveEdits();
  },
  
  /* ── Init gig ── */
  initGig: function(venueId) {
    var raw = v3_getRawEntity('venues', venueId);
    if (!raw) return;
    raw.gig = {
      date: '', fee: 400, set_times: [], set_duration_minutes: 45,
      sound_check_time: '', pa_provided: true, rider_notes: '', venue_notes: ''
    };
    saveEdits();
    var updated = v3_getEntity('venues', venueId);
    if (updated) renderVenueDetailModal(updated);
  },
  
  /* ── Init HC event ── */
  initHCEvent: function(hcId) {
    var raw = v3_getRawEntity('house_concerts', hcId);
    if (!raw) return;
    var stop = (D.tour_stops || []).find(function(s) { return s.id === raw.tour_stop_id; });
    raw.event = {
      date: stop ? (stop.arrival_date || '') : '',
      tier: 'tier_2', tickets_sold: 0, tickets_target: 30,
      revenue_projected: 750, revenue_actual: 0, humanitix_link: ''
    };
    saveEdits();
    var updated = v3_getEntity('house_concerts', hcId);
    if (updated) renderHCDetailModal(updated);
  },
  
  /* ── Archive ── */
  archiveVenue: function(venueId) {
    if (!confirm('Archive this venue?')) return;
    v3_archiveEntity('venues', venueId);
    closeModal('vd-modal');
    showToast('📦 Venue archived');
    renderPipeline();
  },
  
  archiveHC: function(hcId) {
    if (!confirm('Archive this house concert?')) return;
    v3_archiveEntity('house_concerts', hcId);
    closeModal('hd-modal');
    showToast('📦 House concert archived');
    renderPipeline();
  },
  
  /* ── Delete ── */
  deleteVenue: function(venueId) {
    if (!confirm('Permanently delete this venue? This cannot be undone.')) return;
    v3_deleteEntity('venues', venueId);
    closeModal('vd-modal');
    showToast('🗑 Venue deleted');
    renderPipeline();
  },
  
  deleteHC: function(hcId) {
    if (!confirm('Permanently delete this house concert? This cannot be undone.')) return;
    v3_deleteEntity('house_concerts', hcId);
    closeModal('hd-modal');
    showToast('🗑 House concert deleted');
    renderPipeline();
  },
  
  /* ── Media Pack ── */
  openMediaPack: function(type, entityId) {
    V3Pipe_openMediaPack(type, entityId);
  },
  
  toggleMediaComp: function(key) {
    if (mediaPackComponents[key]) {
      mediaPackComponents[key].included = !mediaPackComponents[key].included;
      // Update the checkbox visually
      var ctx = pipeState._mediaPackContext;
      if (ctx) {
        V3Pipe_openMediaPack(ctx.type, ctx.entityId);
      }
    }
  },
  
  sendMediaPack: function(method) {
    var ctx = pipeState._mediaPackContext;
    if (!ctx) return;
    var entity = ctx.type === 'venues' ? v3_getEntity('venues', ctx.entityId) : v3_getEntity('house_concerts', ctx.entityId);
    if (!entity) return;
    
    var text = buildMediaPackText(entity, ctx.type);
    var email = ctx.type === 'venues' ? entity.email : entity.host_email;
    var subject = 'Dylan Crowe — Media Pack & T&Cs for ' + (ctx.type === 'venues' ? entity.name : entity.host_name + ' (House Concert)');
    
    // Limit to 2000 chars for mailto
    if (text.length > 2000) text = text.substring(0, 1997) + '...';
    
    if (method === 'email' && email) {
      var mailto = 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
      window.location.href = mailto;
    } else if (method === 'clipboard') {
      copyToClipboard(text);
      showToast('📋 Media pack copied to clipboard');
    } else if (method === 'email' && !email) {
      copyToClipboard(text);
      showToast('⚠ No email — copied to clipboard instead');
    }
    
    // Log marketing
    var today = new Date().toISOString().slice(0,10);
    if (ctx.type === 'venues') {
      v3_updateEntity('venues', ctx.entityId, {
        marketing: { media_pack_sent: true, media_pack_sent_date: today }
      });
    } else {
      v3_updateEntity('house_concerts', ctx.entityId, {
        marketing: { promo_kit_sent: true, promo_kit_sent_date: today }
      });
    }
    
    // Create follow-up reminder (5 days)
    var followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 5);
    var fuDateStr = followUpDate.toISOString().slice(0,10);
    var todoText = 'Follow up on media pack — ' + (ctx.type === 'venues' ? entity.name : entity.host_name);
    addTodo(todoText, 'venue', 'medium', fuDateStr, ctx.type, ctx.entityId);
    
    showToast('✓ Media pack sent & logged');
    closeModal('mp-modal');
  },
  
  /* ── T&Cs ── */
  openTcsComposer: function(venueId) {
    V3Pipe_openTcsComposer(venueId);
  },
  
  sendTcs: function(method, venueId) {
    var v = v3_getEntity('venues', venueId);
    if (!v || !v.gig) return;
    
    var text = buildTcsText(v.name, v.gig.date, v.gig.fee, (v.gig.set_times||[]).join(', '), v.gig.set_duration_minutes || 45);
    var email = v.email;
    var subject = 'Dylan Crowe — Terms & Conditions for ' + v.name + (v.gig.date ? ' (' + v.gig.date + ')' : '');
    
    if (text.length > 2000) text = text.substring(0, 1997) + '...';
    
    if (method === 'email' && email) {
      var mailto = 'mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
      window.location.href = mailto;
    } else if (method === 'clipboard') {
      copyToClipboard(text);
      showToast('📋 T&Cs copied to clipboard');
    } else if (method === 'email' && !email) {
      copyToClipboard(text);
      showToast('⚠ No email — copied to clipboard instead');
    }
    
    // Log marketing
    var today = new Date().toISOString().slice(0,10);
    v3_updateEntity('venues', venueId, {
      marketing: { tcs_sent: true, tcs_sent_date: today }
    });
    
    showToast('✓ T&Cs sent & logged');
    closeModal('tc-modal');
  }
};

/* ═══════════════════════════════════════════════════════════════
   SECTION 10: HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

/* ── Get current modal entity ID (tracks which entity is in the modal) ── */
var _currentModalEntity = { venues: null, house_concerts: null };

var _origOpenVenueDetail = window.V3Pipe_openVenueDetail;
window.V3Pipe_openVenueDetail = function(venueId) {
  _currentModalEntity.venues = venueId;
  _origOpenVenueDetail(venueId);
};

var _origOpenHCDetail = window.V3Pipe_openHCDetail;
window.V3Pipe_openHCDetail = function(hcId) {
  _currentModalEntity.house_concerts = hcId;
  _origOpenHCDetail(hcId);
};

function getCurrentModalEntityId(type) {
  return _currentModalEntity[type];
}

/* ── Save venue edit fields ── */
function saveVenueEditFields() {
  var vid = _currentModalEntity.venues;
  if (!vid) return;
  var name = valSafe('vd-edit-name');
  var data = {};
  if (name !== null) data.name = name;
  data.phone = valSafe('vd-edit-phone') || '';
  data.email = valSafe('vd-edit-email') || '';
  data.contact_name = valSafe('vd-edit-contact_name') || '';
  data.venue_type = valSafe('vd-edit-type') || '';
  data.type = data.venue_type;
  data.priority = valSafe('vd-edit-priority') || 'medium';
  var notes = valSafe('vd-edit-notes');
  if (notes !== null) {
    data.marketing = data.marketing || {};
    data.marketing.content_notes = notes;
  }
  v3_updateEntity('venues', vid, data);
  showToast('✓ Venue saved');
}

/* ── Save HC edit fields ── */
function saveHCEditFields() {
  var hid = _currentModalEntity.house_concerts;
  if (!hid) return;
  var data = {};
  data.host_name = valSafe('hd-edit-host_name') || '';
  data.host_phone = valSafe('hd-edit-host_phone') || '';
  data.host_email = valSafe('hd-edit-host_email') || '';
  data.source = valSafe('hd-edit-source') || '';
  var notes = valSafe('hd-edit-notes');
  if (notes !== null) {
    data.marketing = data.marketing || {};
    data.marketing.content_notes = notes;
  }
  v3_updateEntity('house_concerts', hid, data);
  showToast('✓ House concert saved');
}

/* ── Safe value getter (returns null if element doesn't exist) ── */
function valSafe(id) {
  var el = document.getElementById(id);
  if (!el) return null;
  return el.value;
}

/* ── Ensure modal exists (create if not) ── */
function ensureModalSheet(modalId) {
  var modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = modalId;
    var sheet = document.createElement('div');
    sheet.className = 'modal-sheet';
    modal.appendChild(sheet);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.classList.remove('show');
    });
    document.body.appendChild(modal);
    return sheet;
  }
  var sheet = modal.querySelector('.modal-sheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.className = 'modal-sheet';
    modal.appendChild(sheet);
  }
  return sheet;
}

/* ── Copy to clipboard ── */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(function() {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  var textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(textarea);
}

/* ── Add todo ── */
function addTodo(text, category, priority, dueDate, sourceType, sourceId) {
  D.todos = D.todos || [];
  D.todos.push({
    id: 'todo-' + Date.now(),
    text: text,
    category: category || 'venue',
    priority: priority || 'medium',
    due_date: dueDate || '',
    completed: false,
    completed_at: null,
    auto_generated: true,
    source_entity_type: sourceType || '',
    source_entity_id: sourceId || '',
    created_at: new Date().toISOString().slice(0,10),
    updated_at: new Date().toISOString()
  });
  saveEdits();
}

/* ── Escape helpers ── */
function escAttr(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Toast (use existing if available, else fallback) ── */
function showToast(msg) {
  if (typeof window.showToast === 'function') {
    window.showToast(msg);
  } else {
    var toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.id = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function() { toast.classList.remove('show'); }, 2500);
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 11: INJECT CSS FOR V3 PIPELINE COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

(function injectCSS() {
  var css = `
/* ── V3 Pipeline: Segmented Control ── */
.seg-control {
  display: flex;
  gap: 0.25rem;
  background: var(--card);
  border: 1px solid var(--card-brd);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 0.8rem;
}
.seg-btn {
  flex: 1;
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 40px;
}
.seg-btn.active {
  background: rgba(255,255,255,0.06);
  color: var(--off-white);
}

/* ── V3 Pipeline: Scope label ── */
.pipe-scope-label {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-bottom: 0.8rem;
}

/* ── V3 Pipeline: Toggle ── */
.pipe-toggle {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  color: var(--text-dim);
  white-space: nowrap;
  cursor: pointer;
}
.pipe-toggle input {
  width: 16px;
  height: 16px;
  accent-color: var(--cyan);
}

/* ── V3 Pipeline: Terminal groups ── */
.pipe-terminal .pipe-group-title {
  opacity: 0.7;
}
.collapse-icon {
  margin-left: auto;
  font-size: 0.65rem;
  color: var(--text-dim);
}

/* ── V3 Pipeline: Venue/HC cards ── */
.v3-venue-card, .v3-hc-card {
  background: var(--card);
  border: 1px solid var(--card-brd);
  border-radius: 8px;
  padding: 0.7rem;
  margin-bottom: 0.4rem;
  cursor: pointer;
  transition: background 0.2s;
}
.v3-venue-card:active, .v3-hc-card:active {
  background: var(--card-h, rgba(255,255,255,0.06));
}

/* ── V3 Pipeline: Stage timeline ── */
.stage-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.stage-tl-item {
  font-size: 0.68rem;
  padding: 0.35rem 0.5rem;
  background: rgba(255,255,255,0.02);
  border-radius: 4px;
  border-left: 2px solid var(--card-brd);
}

/* ── V3 Pipeline: Modal sheets for media pack / T&Cs ── */
#mp-modal .modal-sheet, #tc-modal .modal-sheet {
  max-height: 90vh;
}

/* ── V3 Pipeline: Venue actions flex ── */
.venue-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}
.venue-actions .venue-btn {
  flex: 1;
  min-width: 80px;
  text-align: center;
}
  `;
  
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

/* ═══════════════════════════════════════════════════════════════
   SECTION 12: INITIALIZE — hook into existing switchView
   ═══════════════════════════════════════════════════════════════ */

// The existing switchView('pipeline') already calls renderPipeline(),
// which we've overridden above. No additional wiring needed.

// Re-render pipeline if it's the active view on load
if (document.readyState !== 'loading') {
  var activeView = document.querySelector('.view.active');
  if (activeView && activeView.id === 'view-pipeline') {
    renderPipeline();
  }
} else {
  document.addEventListener('DOMContentLoaded', function() {
    var activeView = document.querySelector('.view.active');
    if (activeView && activeView.id === 'view-pipeline') {
      renderPipeline();
    }
  });
}

})();

/* ═══════════════════════════════════════════════════════════════════════
   TOUR OS v3 — FINANCE & BUSKING MODULE
   Agent 4: Busking + Financials
   
   Renders:
   - Tour tab (div id="view-tour"): Route timeline + Stop detail + Busking session logging
   - Money tab (div id="view-money"): Financials dashboard + Income/Expense logging
   
   Depends on v3 data layer:
   - loadData(), saveData()
   - getAllEntities(type), getEntity(type, id)
   - createEntity(type, data), updateEntity(type, id, data), deleteEntity(type, id)
   - getCurrentStop(), setCurrentStop(id)
   - recalculateStop(stopId), recalculateAll()
   - generateId(prefix)
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────────────

  /** Format a number as AUD currency: $X,XXX.XX */
  function fmt$(amount) {
    var n = Number(amount) || 0;
    return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** Format a date string (YYYY-MM-DD) to a readable label */
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }

  /** Format a date range */
  function fmtDateRange(a, b) {
    if (!a && !b) return '';
    if (!b || a === b) return fmtDate(a);
    return fmtDate(a) + ' – ' + fmtDate(b);
  }

  /** Escape HTML */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Clamp a value between min and max */
  function clamp(val, min, max) {
    val = Number(val) || 0;
    return Math.max(min, Math.min(max, val));
  }

  /** Percentage helper — returns "XX%" string */
  function pct(numerator, denominator) {
    var d = Number(denominator) || 0;
    if (d === 0) return '0%';
    return Math.round((Number(numerator) || 0) / d * 100) + '%';
  }

  /** Today's date as YYYY-MM-DD */
  function today() {
    var d = new Date();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var da = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mo + '-' + da;
  }

  /** Show a toast (if showToast exists, else alert) */
  function notify(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else alert(msg);
  }

  /** Open/close modal helpers (use global modal system if available) */
  var modalCounter = 0;

  function openModalSheet(id, contentHTML, opts) {
    opts = opts || {};
    var overlayId = 'v3modal-' + id;
    var existing = document.getElementById(overlayId);
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.id = overlayId;
    overlay.style.zIndex = opts.zIndex || 350;

    var sheet = document.createElement('div');
    sheet.className = 'modal-sheet';
    sheet.innerHTML = contentHTML;

    overlay.appendChild(sheet);

    // Close on overlay click (but not sheet click)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModalSheet(id);
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  function closeModalSheet(id) {
    var overlay = document.getElementById('v3modal-' + id);
    if (overlay) overlay.remove();
  }

  // Close sheet when clicking elements with data-close="id"
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-close-sheet]');
    if (el) {
      var sid = el.getAttribute('data-close-sheet');
      closeModalSheet(sid);
    }
  });

  // ── Income type labels & colors ────────────────────────────────────────
  var INCOME_TYPES = {
    busking: { label: 'Busking', color: '#22c55e', icon: '🎸' },
    gig_income: { label: 'Gig Income', color: '#00d2ff', icon: '🎤' },
    house_concert: { label: 'House Concert', color: '#f59e0b', icon: '🏠' },
    merch: { label: 'Merch', color: '#a855f7', icon: '👕' },
    other: { label: 'Other', color: '#8888aa', icon: '💰' }
  };

  var EXPENSE_CATEGORIES = {
    fuel: { label: 'Fuel', color: '#ef4444', icon: '⛽' },
    accommodation: { label: 'Accommodation', color: '#8b5cf6', icon: '🏨' },
    food: { label: 'Food', color: '#f59e0b', icon: '🍔' },
    gear: { label: 'Gear', color: '#06b6d4', icon: '🎛️' },
    maverick: { label: 'Maverick', color: '#22c55e', icon: '🐕' },
    marketing: { label: 'Marketing', color: '#ec4899', icon: '📢' },
    vehicle_maintenance: { label: 'Vehicle Maint.', color: '#f97316', icon: '🔧' },
    misc: { label: 'Misc', color: '#8888aa', icon: '📦' }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PART A: TOUR TAB
  // ═══════════════════════════════════════════════════════════════════════

  /** Current state for Tour tab */
  var tourState = {
    subview: 'route',      // 'route' | 'calendar'
    selectedStopId: null,  // when in stop detail
    stopDetailTab: 'busking' // 'busking' | 'gigs' | 'financials'
  };

  // ── Main render entry point for Tour tab ───────────────────────────────
  function renderTour() {
    var container = document.getElementById('view-tour');
    if (!container) return;

    // If a stop is selected, show stop detail
    if (tourState.selectedStopId) {
      container.innerHTML = renderStopDetailHTML(tourState.selectedStopId);
      bindStopDetailEvents();
      return;
    }

    // Segmented control: Route | Calendar
    var html = '' +
      '<div style="display:flex;gap:0.3rem;margin-bottom:1rem;background:var(--card);border-radius:10px;padding:3px;">' +
        '<button id="v3-tour-seg-route" class="tab-btn ' + (tourState.subview === 'route' ? 'active' : '') + '" style="flex:1;text-align:center;">🗺️ Route</button>' +
        '<button id="v3-tour-seg-calendar" class="tab-btn ' + (tourState.subview === 'calendar' ? 'active' : '') + '" style="flex:1;text-align:center;">📅 Calendar</button>' +
      '</div>';

    if (tourState.subview === 'calendar') {
      html += '<div class="empty-state">' +
        '<div style="font-size:2rem;margin-bottom:0.5rem">📅</div>' +
        '<div style="font-weight:700;margin-bottom:0.3rem">Calendar View</div>' +
        '<div>Coming in Phase 2</div>' +
        '<div style="font-size:0.65rem;margin-top:0.5rem;color:var(--text-faint)">Unified calendar for gigs, busking sessions, HC shows, and travel.</div>' +
      '</div>';
    } else {
      html += renderRouteTimeline();
    }

    container.innerHTML = html;

    // Bind segmented control
    var routeBtn = document.getElementById('v3-tour-seg-route');
    var calBtn = document.getElementById('v3-tour-seg-calendar');
    if (routeBtn) routeBtn.addEventListener('click', function () {
      tourState.subview = 'route';
      renderTour();
    });
    if (calBtn) calBtn.addEventListener('click', function () {
      tourState.subview = 'calendar';
      renderTour();
    });

    // Bind stop card clicks
    container.querySelectorAll('[data-stop-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        tourState.selectedStopId = el.getAttribute('data-stop-id');
        renderTour();
      });
    });
  }

  // ── Route Timeline ─────────────────────────────────────────────────────
  function renderRouteTimeline() {
    var stops = getAllEntities('tour_stops') || [];
    if (stops.length === 0) {
      return '<div class="empty-state">No tour stops yet. Add stops in Settings.</div>';
    }

    // Sort by arrival date
    stops.sort(function (a, b) {
      return (a.arrival_date || '').localeCompare(b.arrival_date || '');
    });

    var currentStop = getCurrentStop();

    var html = '<div class="section-title">Tour Route — ' + stops.length + ' Stops</div>';
    html += '<div class="timeline">';

    stops.forEach(function (stop, idx) {
      var status = stop.status || 'planned';
      var isCurrent = status === 'current';
      var isCompleted = status === 'completed';

      // Dot class
      var dotClass = 'planned';
      if (isCurrent) dotClass = 'current';
      else if (isCompleted) dotClass = 'completed';

      // Badge
      var badgeClass = dotClass;
      var badgeLabel = status.charAt(0).toUpperCase() + status.slice(1);

      // Progress bars
      var targets = stop.targets || {};
      var actuals = stop.actuals || {};

      // Support both v3 flat structure and nested structure
      var bTargetSessions = targets.busking_sessions || (targets.busking && targets.busking.sessions_target) || 0;
      var bActualSessions = actuals.busking_sessions || (actuals.busking && actuals.busking.sessions_completed) || 0;
      var bPct = bTargetSessions > 0 ? clamp(bActualSessions / bTargetSessions * 100, 0, 100) : 0;

      var gTargetGigs = targets.gigs || (targets.venue_gig && targets.venue_gig.gigs_target) || 0;
      var gActualGigs = actuals.gigs_played || (actuals.venue_gig && actuals.venue_gig.gigs_played) || 0;
      var gPct = gTargetGigs > 0 ? clamp(gActualGigs / gTargetGigs * 100, 0, 100) : 0;

      var hTargetShows = targets.hc_shows || (targets.house_concert && targets.house_concert.shows_target) || 0;
      var hActualShows = actuals.hc_completed || (actuals.house_concert && actuals.house_concert.shows_completed) || 0;
      var hPct = hTargetShows > 0 ? clamp(hActualShows / hTargetShows * 100, 0, 100) : 0;

      var isActive = currentStop && currentStop.id === stop.id;

      html += '<div class="stop-node">' +
        '<div class="stop-dot ' + dotClass + '"></div>' +
        '<div class="stop-card ' + (isActive ? 'active' : '') + '" data-stop-id="' + esc(stop.id) + '">' +
          '<div class="stop-hdr">' +
            '<div>' +
              '<span class="stop-name">' + esc(stop.name) + ', ' + esc(stop.state || '') + '</span>' +
              ' <span class="stop-num">#' + (idx + 1) + '</span>' +
            '</div>' +
            '<span class="stop-badge ' + badgeClass + '">' + esc(badgeLabel) + '</span>' +
          '</div>' +
          '<div class="stop-meta">' + fmtDateRange(stop.arrival_date, stop.departure_date) + (stop.segment ? ' · ' + esc(stop.segment) : '') + '</div>' +
          '<div class="stop-bars">' +
            '<div class="stop-bar" title="Busking: ' + bActualSessions + '/' + bTargetSessions + ' sessions"><div class="stop-bar-fill busking" style="width:' + bPct + '%"></div></div>' +
            '<div class="stop-bar" title="Gigs: ' + gActualGigs + '/' + gTargetGigs + ' gigs"><div class="stop-bar-fill gig" style="width:' + gPct + '%"></div></div>' +
            '<div class="stop-bar" title="HC: ' + hActualShows + '/' + hTargetShows + ' shows"><div class="stop-bar-fill house" style="width:' + hPct + '%"></div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    return html;
  }

  // ── Stop Detail ────────────────────────────────────────────────────────
  function renderStopDetailHTML(stopId) {
    var stop = getEntity('tour_stops', stopId);
    if (!stop) {
      tourState.selectedStopId = null;
      return '<div class="empty-state">Stop not found. <button class="venue-btn" onclick="window._v3TourBack()">← Back</button></div>';
    }

    var status = stop.status || 'planned';
    var badgeClass = status === 'current' ? 'current' : (status === 'completed' ? 'completed' : 'planned');

    var html = '' +
      '<div style="margin-bottom:0.8rem;">' +
        '<button class="venue-btn" id="v3-stop-back">← Back to Route</button>' +
      '</div>';

    // Stop detail header
    html += '<div class="stop-detail-hdr">' +
      '<div class="stop-detail-name">' + esc(stop.name) + ', ' + esc(stop.state || '') + '</div>' +
      '<div class="stop-detail-meta">' +
        fmtDateRange(stop.arrival_date, stop.departure_date) +
        (stop.segment ? ' · ' + esc(stop.segment) : '') +
      '</div>' +
      '<div style="margin-top:0.4rem;">' +
        '<span class="stop-badge ' + badgeClass + '">' + esc(status.charAt(0).toUpperCase() + status.slice(1)) + '</span>' +
      '</div>' +
    '</div>';

    // Tabs: Busking | Gigs | Financials
    var activeTab = tourState.stopDetailTab;
    html += '<div class="tab-bar">' +
      '<button class="tab-btn busking ' + (activeTab === 'busking' ? 'active' : '') + '" data-tab="busking">🎸 Busking</button>' +
      '<button class="tab-btn gig ' + (activeTab === 'gigs' ? 'active' : '') + '" data-tab="gigs">🎤 Gigs</button>' +
      '<button class="tab-btn house ' + (activeTab === 'financials' ? 'active' : '') + '" data-tab="financials">💰 Financials</button>' +
    '</div>';

    // Tab content
    if (activeTab === 'busking') {
      html += renderStopBuskingTab(stop);
    } else if (activeTab === 'gigs') {
      html += renderStopGigsTab(stop);
    } else {
      html += renderStopFinancialsTab(stop);
    }

    return html;
  }

  // ── Stop Detail: Busking Tab ───────────────────────────────────────────
  function renderStopBuskingTab(stop) {
    var spots = (getAllEntities('busking_spots') || []).filter(function (s) {
      return s.tour_stop_id === stop.id;
    });

    // Sync spot IDs from stop if available
    if (stop.busking_spot_ids && stop.busking_spot_ids.length > 0 && spots.length === 0) {
      // Try matching by id reference
      stop.busking_spot_ids.forEach(function (sid) {
        var spot = getEntity('busking_spots', sid);
        if (spot) spots.push(spot);
      });
    }

    var html = '' +
      '<div style="display:flex;gap:0.4rem;margin-bottom:0.8rem;">' +
        '<button class="venue-btn advance" id="v3-log-session" style="flex:1;font-size:0.72rem;">📝 Log Session</button>' +
        '<button class="venue-btn call" id="v3-add-spot" style="flex:1;font-size:0.72rem;">➕ Add Spot</button>' +
      '</div>';

    if (spots.length === 0) {
      html += '<div class="empty-state">' +
        '<div style="font-size:1.5rem;margin-bottom:0.3rem">🎸</div>' +
        '<div>No busking spots for ' + esc(stop.name) + ' yet.</div>' +
        '<div style="font-size:0.65rem;margin-top:0.3rem;color:var(--text-faint)">Tap "Add Spot" to discover a new location.</div>' +
      '</div>';
      return html;
    }

    html += '<div class="section-title">Busking Spots (' + spots.length + ')</div>';

    spots.forEach(function (spot) {
      var stats = spot.earnings_stats || { total_earnings: 0, total_sessions: 0, avg_earnings: 0 };
      var sessions = spot.sessions || [];
      var rating = spot.traffic_rating || 0;
      var ratingStars = '';
      for (var i = 0; i < 5; i++) {
        ratingStars += i < rating ? '★' : '☆';
      }

      html += '<div class="entity-card" data-spot-id="' + esc(spot.id) + '" style="cursor:pointer;">' +
        '<div class="entity-hdr">' +
          '<div>' +
            '<div class="entity-name">' + esc(spot.name) + '</div>' +
            '<div class="entity-sub">' + esc(spot.city || '') + ' · <span style="color:var(--amber);">' + ratingStars + '</span></div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-size:0.8rem;font-weight:700;color:var(--busking-l);">' + fmt$(stats.total_earnings) + '</div>' +
            '<div class="entity-sub">' + (stats.total_sessions || sessions.length) + ' sessions</div>' +
          '</div>' +
        '</div>' +
        '<div class="entity-row">' +
          '<span class="lbl">Status</span>' +
          '<span style="font-size:0.65rem;text-transform:uppercase;">' + esc(spot.status || 'discovered') + '</span>' +
        '</div>' +
      '</div>';
    });

    return html;
  }

  // ── Stop Detail: Gigs Tab ──────────────────────────────────────────────
  function renderStopGigsTab(stop) {
    // Get gigs for this stop
    var gigs = (getAllEntities('gigs') || []).filter(function (g) {
      return g.tour_stop_id === stop.id;
    });

    // Also get venues for this stop (gigs may not exist yet)
    var venues = (getAllEntities('venues') || []).filter(function (v) {
      return v.tour_stop_id === stop.id;
    });

    var html = '';

    if (gigs.length === 0 && venues.length === 0) {
      html += '<div class="empty-state">' +
        '<div style="font-size:1.5rem;margin-bottom:0.3rem">🎤</div>' +
        '<div>No gigs for ' + esc(stop.name) + ' yet.</div>' +
        '<div style="font-size:0.65rem;margin-top:0.3rem;color:var(--text-faint)">Add venues in the Pipeline tab to start booking gigs.</div>' +
      '</div>';
      return html;
    }

    // Gigs list
    if (gigs.length > 0) {
      html += '<div class="section-title">Booked Gigs (' + gigs.length + ')</div>';
      gigs.forEach(function (gig) {
        var venue = gig.venue_id ? getEntity('venues', gig.venue_id) : null;
        var venueName = venue ? venue.name : 'Unknown Venue';
        var statusBadge = gig.status || 'booked';
        var incomeBadge = gig.income_logged ? '<span class="pct-badge" style="background:rgba(34,197,94,0.15);color:var(--green-bright);">Income Logged</span>' : '<span class="pct-badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;">Income Pending</span>';

        html += '<div class="entity-card" data-gig-id="' + esc(gig.id) + '" style="cursor:pointer;">' +
          '<div class="entity-hdr">' +
            '<div>' +
              '<div class="entity-name">' + esc(venueName) + '</div>' +
              '<div class="entity-sub">' + fmtDate(gig.date) + (gig.set_times ? ' · ' + esc(gig.set_times) : '') + '</div>' +
            '</div>' +
            '<div style="text-align:right;">' +
              '<div style="font-size:0.8rem;font-weight:700;color:var(--gig-l);">' + fmt$(gig.fee) + '</div>' +
              incomeBadge +
            '</div>' +
          '</div>' +
          '<div class="entity-row">' +
            '<span class="lbl">Status</span>' +
            '<span style="font-size:0.65rem;text-transform:uppercase;font-weight:700;">' + esc(statusBadge) + '</span>' +
          '</div>' +
        '</div>';
      });
    }

    // Venues without gigs (pipeline)
    if (venues.length > 0) {
      var unbooked = venues.filter(function (v) {
        return !gigs.some(function (g) { return g.venue_id === v.id; });
      });
      if (unbooked.length > 0) {
        html += '<div class="section-title" style="margin-top:1rem;">Pipeline Venues (' + unbooked.length + ')</div>';
        unbooked.forEach(function (venue) {
          html += '<div class="entity-card">' +
            '<div class="entity-hdr">' +
              '<div>' +
                '<div class="entity-name">' + esc(venue.name) + '</div>' +
                '<div class="entity-sub">' + esc(venue.type || '') + ' · ' + esc(venue.city || '') + '</div>' +
              '</div>' +
              '<span style="font-size:0.6rem;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.06);color:var(--text-dim);">' + esc(venue.stage || 'not_contacted') + '</span>' +
            '</div>' +
          '</div>';
        });
      }
    }

    return html;
  }

  // ── Stop Detail: Financials Tab ────────────────────────────────────────
  function renderStopFinancialsTab(stop) {
    var targets = stop.targets || {};
    var actuals = stop.actuals || {};
    var fin = stop.financials || {};

    // Projected vs actual income
    var projectedIncome = fin.projected_income || 0;
    var actualIncome = fin.actual_income || 0;
    var actualExpenses = fin.actual_expenses || 0;
    var net = fin.net !== undefined ? fin.net : (actualIncome - actualExpenses);

    // Recalculate from income/expense logs to ensure accuracy
    var incomes = (getAllEntities('income_log') || []).filter(function (i) {
      return i.tour_stop_id === stop.id;
    });
    var expenses = (getAllEntities('expense_log') || []).filter(function (e) {
      return e.tour_stop_id === stop.id;
    });
    var calcIncome = incomes.reduce(function (sum, i) { return sum + (Number(i.amount) || 0); }, 0);
    var calcExpenses = expenses.reduce(function (sum, e) { return sum + (Number(e.amount) || 0); }, 0);
    var calcNet = calcIncome - calcExpenses;

    // Use calculated values (more accurate)
    actualIncome = calcIncome;
    actualExpenses = calcExpenses;
    net = calcNet;

    var html = '<div class="fin-card">' +
      '<div class="fin-row income"><span class="lbl">Projected Income</span><span class="val">' + fmt$(projectedIncome) + '</span></div>' +
      '<div class="fin-row income"><span class="lbl">Actual Income</span><span class="val">' + fmt$(actualIncome) + '</span></div>' +
      '<div class="fin-row expense"><span class="lbl">Actual Expenses</span><span class="val">-' + fmt$(actualExpenses) + '</span></div>' +
      '<div class="fin-row fin-total"><span>Net</span><span style="color:' + (net >= 0 ? 'var(--green-bright)' : 'var(--expense)') + '">' + fmt$(net) + '</span></div>' +
    '</div>';

    // Editable projection
    html += '<div class="section-title">Edit Projections</div>';
    html += '<div class="fin-card">' +
      '<div class="modal-field">' +
        '<label>Projected Income ($)</label>' +
        '<input type="number" step="0.01" value="' + projectedIncome + '" data-projection="projected_income" data-stop-id="' + esc(stop.id) + '" style="width:100%;padding:0.6rem;border-radius:8px;border:1px solid var(--card-brd);background:rgba(0,0,0,0.3);color:var(--off-white);font-size:0.85rem;min-height:44px;" />' +
      '</div>' +
    '</div>';

    // Income breakdown for this stop
    if (incomes.length > 0) {
      html += '<div class="section-title" style="margin-top:1rem;">Income Breakdown</div>';
      html += '<div class="fin-card">';
      var incomeByType = {};
      incomes.forEach(function (i) {
        var t = i.type || 'other';
        incomeByType[t] = (incomeByType[t] || 0) + (Number(i.amount) || 0);
      });
      Object.keys(incomeByType).forEach(function (type) {
        var typeInfo = INCOME_TYPES[type] || INCOME_TYPES.other;
        var amt = incomeByType[type];
        var barPct = actualIncome > 0 ? clamp(amt / actualIncome * 100, 0, 100) : 0;
        html += '<div class="fin-row income">' +
          '<span class="lbl">' + typeInfo.icon + ' ' + esc(typeInfo.label) + '</span>' +
          '<span class="val">' + fmt$(amt) + '</span>' +
        '</div>' +
        '<div class="stream-bar" style="margin:0.2rem 0 0.5rem;"><div class="stream-bar-fill" style="width:' + barPct + '%;background:' + typeInfo.color + ';"></div></div>';
      });
      html += '</div>';
    }

    // Expense breakdown for this stop
    if (expenses.length > 0) {
      html += '<div class="section-title" style="margin-top:1rem;">Expense Breakdown</div>';
      html += '<div class="fin-card">';
      var expByCat = {};
      expenses.forEach(function (e) {
        var c = e.category || 'misc';
        expByCat[c] = (expByCat[c] || 0) + (Number(e.amount) || 0);
      });
      Object.keys(expByCat).forEach(function (cat) {
        var catInfo = EXPENSE_CATEGORIES[cat] || EXPENSE_CATEGORIES.misc;
        var amt = expByCat[cat];
        var barPct = actualExpenses > 0 ? clamp(amt / actualExpenses * 100, 0, 100) : 0;
        html += '<div class="fin-row expense">' +
          '<span class="lbl">' + catInfo.icon + ' ' + esc(catInfo.label) + '</span>' +
          '<span class="val">-' + fmt$(amt) + '</span>' +
        '</div>' +
        '<div class="stream-bar" style="margin:0.2rem 0 0.5rem;"><div class="stream-bar-fill" style="width:' + barPct + '%;background:' + catInfo.color + ';"></div></div>';
      });
      html += '</div>';
    }

    if (incomes.length === 0 && expenses.length === 0) {
      html += '<div class="empty-state" style="margin-top:1rem;">No transactions logged for this stop yet.</div>';
    }

    return html;
  }

  // ── Stop Detail Event Binding ──────────────────────────────────────────
  function bindStopDetailEvents() {
    // Back button
    var backBtn = document.getElementById('v3-stop-back');
    if (backBtn) backBtn.addEventListener('click', function () {
      tourState.selectedStopId = null;
      renderTour();
    });

    // Tab buttons
    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        tourState.stopDetailTab = btn.getAttribute('data-tab');
        renderTour();
      });
    });

    // Log Session button
    var logBtn = document.getElementById('v3-log-session');
    if (logBtn) logBtn.addEventListener('click', function () {
      openLogBuskingSessionModal(tourState.selectedStopId);
    });

    // Add Spot button
    var addSpotBtn = document.getElementById('v3-add-spot');
    if (addSpotBtn) addSpotBtn.addEventListener('click', function () {
      openAddBuskingSpotModal(tourState.selectedStopId);
    });

    // Spot card clicks
    document.querySelectorAll('[data-spot-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        openSpotDetailModal(el.getAttribute('data-spot-id'));
      });
    });

    // Gig card clicks
    document.querySelectorAll('[data-gig-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        openGigDetailModal(el.getAttribute('data-gig-id'));
      });
    });

    // Projection input
    document.querySelectorAll('[data-projection]').forEach(function (input) {
      input.addEventListener('change', function () {
        var field = input.getAttribute('data-projection');
        var stopId = input.getAttribute('data-stop-id');
        var val = parseFloat(input.value) || 0;
        var stop = getEntity('tour_stops', stopId);
        if (stop) {
          if (!stop.financials) stop.financials = {};
          stop.financials[field] = val;
          stop.updated_at = new Date().toISOString();
          updateEntity('tour_stops', stopId, stop);
          saveData();
          recalculateStop(stopId);
          notify('Projection updated');
        }
      });
    });
  }

  // ── Log Busking Session Modal ───────────────────────────────────────────
  function openLogBuskingSessionModal(stopId) {
    var stop = getEntity('tour_stops', stopId);
    if (!stop) return;

    // Get spots for this stop
    var spots = (getAllEntities('busking_spots') || []).filter(function (s) {
      return s.tour_stop_id === stopId;
    });

    var spotOptions = spots.map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
    }).join('');

    var html = '' +
      '<div class="modal-hdr">' +
        '<div class="modal-title">🎸 Log Busking Session</div>' +
        '<button class="modal-close" data-close-sheet="log-session">✕</button>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Busking Spot</label>' +
        '<select id="v3-session-spot">' +
          (spotOptions || '<option value="">No spots yet</option>') +
          '<option value="__quick_add">➕ Quick Add New Spot</option>' +
        '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Date</label>' +
        '<input type="date" id="v3-session-date" value="' + today() + '" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Duration (minutes)</label>' +
        '<input type="number" id="v3-session-duration" value="120" min="0" step="15" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Earnings ($)</label>' +
        '<input type="number" id="v3-session-earnings" value="0" min="0" step="0.01" placeholder="0.00 (rainout/moved on is OK)" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Merch Sales ($) — Optional</label>' +
        '<input type="number" id="v3-session-merch" value="0" min="0" step="0.01" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Notes</label>' +
        '<textarea id="v3-session-notes" rows="2" placeholder="Good crowd, weather, etc." style="min-height:60px;"></textarea>' +
      '</div>' +
      '<button class="modal-submit" id="v3-session-save">Save Session</button>';

    openModalSheet('log-session', html);

    // Handle spot selector change — show quick add fields
    var spotSelect = document.getElementById('v3-session-spot');
    var quickAddDiv = null;
    if (spotSelect) {
      spotSelect.addEventListener('change', function () {
        if (this.value === '__quick_add') {
          if (!quickAddDiv) {
            quickAddDiv = document.createElement('div');
            quickAddDiv.id = 'v3-quick-add-spot';
            quickAddDiv.innerHTML =
              '<div class="modal-field" style="margin-top:0.6rem;padding:0.6rem;border-radius:8px;border:1px solid var(--card-brd);background:rgba(0,0,0,0.2);">' +
                '<label>New Spot Name</label>' +
                '<input type="text" id="v3-quick-spot-name" placeholder="e.g. Murray St Mall" />' +
                '<label style="margin-top:0.4rem;">Traffic Rating (1-5)</label>' +
                '<input type="number" id="v3-quick-spot-rating" value="3" min="1" max="5" />' +
              '</div>';
            spotSelect.parentNode.appendChild(quickAddDiv);
          }
        } else {
          if (quickAddDiv) {
            quickAddDiv.remove();
            quickAddDiv = null;
          }
        }
      });
    }

    // Save button
    var saveBtn = document.getElementById('v3-session-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      saveBuskingSession(stopId);
    });
  }

  function saveBuskingSession(stopId) {
    var spotSelect = document.getElementById('v3-session-spot');
    var dateInput = document.getElementById('v3-session-date');
    var durationInput = document.getElementById('v3-session-duration');
    var earningsInput = document.getElementById('v3-session-earnings');
    var merchInput = document.getElementById('v3-session-merch');
    var notesInput = document.getElementById('v3-session-notes');

    if (!spotSelect || !spotSelect.value) {
      notify('Please select a spot (or quick add one)');
      return;
    }

    var spotId = spotSelect.value;
    var spotName = '';

    // Handle quick add
    if (spotId === '__quick_add') {
      var nameInput = document.getElementById('v3-quick-spot-name');
      var ratingInput = document.getElementById('v3-quick-spot-rating');
      if (!nameInput || !nameInput.value.trim()) {
        notify('Enter a name for the new spot');
        return;
      }
      spotName = nameInput.value.trim();
      var rating = parseInt(ratingInput ? ratingInput.value : '3') || 3;

      // Create new busking spot
      var newSpot = {
        id: generateId('bsk'),
        name: spotName,
        city: '',
        address: '',
        traffic_rating: rating,
        permit_required: false,
        permit_obtained: false,
        best_time: '',
        acoustics_notes: '',
        tour_stop_id: stopId,
        status: 'discovered',
        sessions: [],
        earnings_stats: { total_earnings: 0, total_sessions: 0, avg_earnings: 0 },
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      newSpot = createEntity('busking_spots', newSpot);

      // Link to stop
      var stop = getEntity('tour_stops', stopId);
      if (stop) {
        if (!stop.busking_spot_ids) stop.busking_spot_ids = [];
        stop.busking_spot_ids.push(newSpot.id);
        stop.updated_at = new Date().toISOString();
        updateEntity('tour_stops', stopId, stop);
      }

      spotId = newSpot.id;
    } else {
      var existingSpot = getEntity('busking_spots', spotId);
      spotName = existingSpot ? existingSpot.name : 'Busking';
    }

    var date = dateInput ? dateInput.value : today();
    var duration = parseInt(durationInput ? durationInput.value : '120') || 0;
    var earnings = parseFloat(earningsInput ? earningsInput.value : '0') || 0;
    var merch = parseFloat(merchInput ? merchInput.value : '0') || 0;
    var notes = notesInput ? notesInput.value.trim() : '';

    // Create income_log entry
    var incomeEntry = {
      id: generateId('inc'),
      date: date,
      type: 'busking',
      amount: earnings + merch, // Include merch in total income if separate merch income entry needed
      source_entity_type: 'busking_spot',
      source_entity_id: spotId,
      tour_stop_id: stopId,
      payment_method: 'cash',
      merch_sales: merch,
      notes: notes || (duration + 'min session at ' + spotName),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    incomeEntry = createEntity('income_log', incomeEntry);

    // If merch sales > 0, also create a merch income entry
    if (merch > 0) {
      var merchEntry = {
        id: generateId('inc'),
        date: date,
        type: 'merch',
        amount: merch,
        source_entity_type: 'busking_spot',
        source_entity_id: spotId,
        tour_stop_id: stopId,
        payment_method: 'cash',
        merch_sales: merch,
        notes: 'Merch sales during busking session at ' + spotName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      createEntity('income_log', merchEntry);
      // Adjust the busking income entry to exclude merch (since merch is separate)
      incomeEntry.amount = earnings;
      updateEntity('income_log', incomeEntry.id, incomeEntry);
    }

    // Create session entry and append to spot's sessions[]
    var session = {
      id: generateId('ses'),
      date: date,
      duration_minutes: duration,
      earnings: earnings,
      merch_sales: merch,
      notes: notes,
      income_id: incomeEntry.id
    };

    var spot = getEntity('busking_spots', spotId);
    if (spot) {
      if (!spot.sessions) spot.sessions = [];
      spot.sessions.push(session);

      // Update earnings stats
      var totalEarnings = spot.sessions.reduce(function (sum, s) { return sum + (Number(s.earnings) || 0); }, 0);
      var totalSessions = spot.sessions.length;
      spot.earnings_stats = {
        total_earnings: totalEarnings,
        total_sessions: totalSessions,
        avg_earnings: totalSessions > 0 ? totalEarnings / totalSessions : 0
      };

      // Auto-update status: discovered → tested after first session
      if (spot.status === 'discovered') {
        spot.status = 'tested';
      }

      spot.updated_at = new Date().toISOString();
      updateEntity('busking_spots', spotId, spot);
    }

    // Update stop actuals
    var stopEntity = getEntity('tour_stops', stopId);
    if (stopEntity) {
      if (!stopEntity.actuals) stopEntity.actuals = {};
      // Support both flat and nested structures
      if (stopEntity.actuals.busking_sessions !== undefined) {
        stopEntity.actuals.busking_sessions = (stopEntity.actuals.busking_sessions || 0) + 1;
      } else if (stopEntity.actuals.busking) {
        stopEntity.actuals.busking.sessions_completed = (stopEntity.actuals.busking.sessions_completed || 0) + 1;
        stopEntity.actuals.busking.earnings_actual = (stopEntity.actuals.busking.earnings_actual || 0) + earnings;
      }
      stopEntity.updated_at = new Date().toISOString();
      updateEntity('tour_stops', stopId, stopEntity);
    }

    saveData();
    recalculateStop(stopId);

    closeModalSheet('log-session');
    notify('Session logged: ' + fmt$(earnings) + (merch > 0 ? ' + ' + fmt$(merch) + ' merch' : ''));

    // Re-render
    renderTour();
  }

  // ── Add Busking Spot Modal ──────────────────────────────────────────────
  function openAddBuskingSpotModal(stopId) {
    var html = '' +
      '<div class="modal-hdr">' +
        '<div class="modal-title">➕ Add Busking Spot</div>' +
        '<button class="modal-close" data-close-sheet="add-spot">✕</button>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Spot Name *</label>' +
        '<input type="text" id="v3-spot-name" placeholder="e.g. Raine Square" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>City / Area</label>' +
        '<input type="text" id="v3-spot-city" placeholder="e.g. Perth CBD" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Address</label>' +
        '<input type="text" id="v3-spot-address" placeholder="Street address" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Traffic Rating (1-5)</label>' +
        '<input type="number" id="v3-spot-rating" value="3" min="1" max="5" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Best Time</label>' +
        '<input type="text" id="v3-spot-besttime" placeholder="e.g. Lunch 12-2pm" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Permit Required?</label>' +
        '<select id="v3-spot-permit">' +
          '<option value="false">No</option>' +
          '<option value="true">Yes</option>' +
        '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Acoustics Notes</label>' +
        '<textarea id="v3-spot-acoustics" rows="2" placeholder="Reverb, echo, wind exposure..." style="min-height:50px;"></textarea>' +
      '</div>' +
      '<button class="modal-submit" id="v3-spot-save">Add Spot</button>';

    openModalSheet('add-spot', html);

    var saveBtn = document.getElementById('v3-spot-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      saveNewSpot(stopId);
    });
  }

  function saveNewSpot(stopId) {
    var name = (document.getElementById('v3-spot-name') || {}).value;
    if (!name || !name.trim()) {
      notify('Spot name is required');
      return;
    }

    var city = (document.getElementById('v3-spot-city') || {}).value || '';
    var address = (document.getElementById('v3-spot-address') || {}).value || '';
    var rating = parseInt((document.getElementById('v3-spot-rating') || {}).value) || 3;
    var bestTime = (document.getElementById('v3-spot-besttime') || {}).value || '';
    var permit = (document.getElementById('v3-spot-permit') || {}).value === 'true';
    var acoustics = (document.getElementById('v3-spot-acoustics') || {}).value || '';

    var newSpot = {
      id: generateId('bsk'),
      name: name.trim(),
      city: city.trim(),
      address: address.trim(),
      traffic_rating: rating,
      permit_required: permit,
      permit_obtained: false,
      best_time: bestTime.trim(),
      acoustics_notes: acoustics.trim(),
      tour_stop_id: stopId,
      status: 'discovered',
      sessions: [],
      earnings_stats: { total_earnings: 0, total_sessions: 0, avg_earnings: 0 },
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    newSpot = createEntity('busking_spots', newSpot);

    // Link to stop
    var stop = getEntity('tour_stops', stopId);
    if (stop) {
      if (!stop.busking_spot_ids) stop.busking_spot_ids = [];
      stop.busking_spot_ids.push(newSpot.id);
      stop.updated_at = new Date().toISOString();
      updateEntity('tour_stops', stopId, stop);
    }

    saveData();
    closeModalSheet('add-spot');
    notify('Spot added: ' + name.trim());
    renderTour();
  }

  // ── Spot Detail Modal ──────────────────────────────────────────────────
  function openSpotDetailModal(spotId) {
    var spot = getEntity('busking_spots', spotId);
    if (!spot) return;

    var sessions = spot.sessions || [];
    var stats = spot.earnings_stats || { total_earnings: 0, total_sessions: 0, avg_earnings: 0 };
    var rating = spot.traffic_rating || 0;
    var ratingStars = '';
    for (var i = 0; i < 5; i++) ratingStars += i < rating ? '★' : '☆';

    var html = '' +
      '<div class="modal-hdr">' +
        '<div class="modal-title">🎸 ' + esc(spot.name) + '</div>' +
        '<button class="modal-close" data-close-sheet="spot-detail">✕</button>' +
      '</div>';

    // Spot info
    html += '<div class="entity-card">' +
      '<div class="entity-row"><span class="lbl">Location</span><span>' + esc(spot.city || '') + (spot.address ? ', ' + esc(spot.address) : '') + '</span></div>' +
      '<div class="entity-row"><span class="lbl">Rating</span><span style="color:var(--amber);">' + ratingStars + '</span></div>' +
      '<div class="entity-row"><span class="lbl">Status</span><span style="text-transform:uppercase;font-size:0.65rem;font-weight:700;">' + esc(spot.status || 'discovered') + '</span></div>' +
      (spot.best_time ? '<div class="entity-row"><span class="lbl">Best Time</span><span>' + esc(spot.best_time) + '</span></div>' : '') +
      (spot.permit_required ? '<div class="entity-row"><span class="lbl">Permit</span><span>' + (spot.permit_obtained ? '✅ Obtained' : '⚠️ Required') + '</span></div>' : '') +
      (spot.acoustics_notes ? '<div class="entity-row"><span class="lbl">Acoustics</span><span style="font-size:0.65rem;">' + esc(spot.acoustics_notes) + '</span></div>' : '') +
      '<div style="border-top:1px solid var(--card-brd);margin-top:0.4rem;padding-top:0.4rem;">' +
        '<div class="fin-row income"><span class="lbl">Total Earnings</span><span class="val">' + fmt$(stats.total_earnings) + '</span></div>' +
        '<div class="fin-row"><span class="lbl">Sessions</span><span>' + (stats.total_sessions || sessions.length) + '</span></div>' +
        '<div class="fin-row"><span class="lbl">Avg / Session</span><span>' + fmt$(stats.avg_earnings) + '</span></div>' +
      '</div>' +
    '</div>';

    // Status changer
    var statuses = ['discovered', 'tested', 'regular', 'retired'];
    html += '<div class="section-title">Status</div><div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.8rem;">';
    statuses.forEach(function (s) {
      var isActive = spot.status === s;
      html += '<button class="venue-btn ' + (isActive ? 'advance' : '') + '" data-spot-status="' + s + '" data-spot-id="' + esc(spotId) + '" style="font-size:0.6rem;text-transform:uppercase;">' + s + '</button>';
    });
    html += '</div>';

    // Sessions list
    html += '<div class="section-title">Sessions (' + sessions.length + ')</div>';
    if (sessions.length === 0) {
      html += '<div class="empty-state" style="padding:1rem;">No sessions logged yet.</div>';
    } else {
      // Sort by date desc
      var sortedSessions = sessions.slice().sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });
      sortedSessions.forEach(function (session) {
        html += '<div class="entity-card" style="padding:0.6rem;">' +
          '<div class="entity-hdr">' +
            '<div>' +
              '<div class="entity-sub" style="font-weight:700;color:var(--off-white);">' + fmtDate(session.date) + '</div>' +
              '<div class="entity-sub">' + (session.duration_minutes || 0) + ' min' + (session.notes ? ' · ' + esc(session.notes) : '') + '</div>' +
            '</div>' +
            '<div style="text-align:right;">' +
              '<div style="font-weight:700;color:var(--busking-l);">' + fmt$(session.earnings) + '</div>' +
              (session.merch_sales > 0 ? '<div class="entity-sub" style="color:var(--merch);">+' + fmt$(session.merch_sales) + ' merch</div>' : '') +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:0.3rem;margin-top:0.4rem;">' +
            '<button class="venue-btn" data-edit-session="' + esc(session.id) + '" data-spot-id="' + esc(spotId) + '" style="font-size:0.6rem;">✏️ Edit</button>' +
            '<button class="venue-btn danger" data-delete-session="' + esc(session.id) + '" data-spot-id="' + esc(spotId) + '" style="font-size:0.6rem;color:var(--expense);">🗑️ Delete</button>' +
          '</div>' +
        '</div>';
      });
    }

    // Log session button
    html += '<button class="modal-submit" id="v3-spot-log-session" style="margin-top:0.6rem;">📝 Log New Session</button>';

    openModalSheet('spot-detail', html);

    // Bind status buttons
    document.querySelectorAll('[data-spot-status]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var newStatus = btn.getAttribute('data-spot-status');
        var sid = btn.getAttribute('data-spot-id');
        var s = getEntity('busking_spots', sid);
        if (s) {
          s.status = newStatus;
          s.updated_at = new Date().toISOString();
          updateEntity('busking_spots', sid, s);
          saveData();
          closeModalSheet('spot-detail');
          openSpotDetailModal(sid);
          notify('Status updated to ' + newStatus);
        }
      });
    });

    // Bind edit session
    document.querySelectorAll('[data-edit-session]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sessionId = btn.getAttribute('data-edit-session');
        var sid = btn.getAttribute('data-spot-id');
        openEditSessionModal(sid, sessionId);
      });
    });

    // Bind delete session
    document.querySelectorAll('[data-delete-session]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sessionId = btn.getAttribute('data-delete-session');
        var sid = btn.getAttribute('data-spot-id');
        deleteSession(sid, sessionId);
      });
    });

    // Log session button
    var logBtn = document.getElementById('v3-spot-log-session');
    if (logBtn) logBtn.addEventListener('click', function () {
      var s = getEntity('busking_spots', spotId);
      closeModalSheet('spot-detail');
      if (s && s.tour_stop_id) {
        openLogBuskingSessionModal(s.tour_stop_id);
      }
    });
  }

  // ── Edit Session Modal ─────────────────────────────────────────────────
  function openEditSessionModal(spotId, sessionId) {
    var spot = getEntity('busking_spots', spotId);
    if (!spot || !spot.sessions) return;

    var session = spot.sessions.find(function (s) { return s.id === sessionId; });
    if (!session) return;

    var html = '' +
      '<div class="modal-hdr">' +
        '<div class="modal-title">✏️ Edit Session</div>' +
        '<button class="modal-close" data-close-sheet="edit-session">✕</button>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Date</label>' +
        '<input type="date" id="v3-edit-session-date" value="' + esc(session.date || today()) + '" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Duration (minutes)</label>' +
        '<input type="number" id="v3-edit-session-duration" value="' + (session.duration_minutes || 120) + '" min="0" step="15" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Earnings ($)</label>' +
        '<input type="number" id="v3-edit-session-earnings" value="' + (session.earnings || 0) + '" min="0" step="0.01" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Merch Sales ($)</label>' +
        '<input type="number" id="v3-edit-session-merch" value="' + (session.merch_sales || 0) + '" min="0" step="0.01" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Notes</label>' +
        '<textarea id="v3-edit-session-notes" rows="2" style="min-height:50px;">' + esc(session.notes || '') + '</textarea>' +
      '</div>' +
      '<button class="modal-submit" id="v3-edit-session-save">Update Session</button>';

    openModalSheet('edit-session', html);

    var saveBtn = document.getElementById('v3-edit-session-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var date = (document.getElementById('v3-edit-session-date') || {}).value || today();
      var duration = parseInt((document.getElementById('v3-edit-session-duration') || {}).value) || 0;
      var earnings = parseFloat((document.getElementById('v3-edit-session-earnings') || {}).value) || 0;
      var merch = parseFloat((document.getElementById('v3-edit-session-merch') || {}).value) || 0;
      var notes = ((document.getElementById('v3-edit-session-notes') || {}).value || '').trim();

      // Update session in spot
      session.date = date;
      session.duration_minutes = duration;
      session.earnings = earnings;
      session.merch_sales = merch;
      session.notes = notes;

      // Recalculate spot stats
      var totalEarnings = spot.sessions.reduce(function (sum, s) { return sum + (Number(s.earnings) || 0); }, 0);
      var totalSessions = spot.sessions.length;
      spot.earnings_stats = {
        total_earnings: totalEarnings,
        total_sessions: totalSessions,
        avg_earnings: totalSessions > 0 ? totalEarnings / totalSessions : 0
      };
      spot.updated_at = new Date().toISOString();
      updateEntity('busking_spots', spotId, spot);

      // Update income_log entry if linked
      if (session.income_id) {
        var income = getEntity('income_log', session.income_id);
        if (income) {
          income.amount = earnings;
          income.date = date;
          income.notes = notes || income.notes;
          income.updated_at = new Date().toISOString();
          updateEntity('income_log', income.id, income);
        }
      }

      saveData();
      if (spot.tour_stop_id) recalculateStop(spot.tour_stop_id);

      closeModalSheet('edit-session');
      closeModalSheet('spot-detail');
      notify('Session updated');
      openSpotDetailModal(spotId);
    });
  }

  // ── Delete Session ─────────────────────────────────────────────────────
  function deleteSession(spotId, sessionId) {
    if (!confirm('Delete this session? This cannot be undone.')) return;

    var spot = getEntity('busking_spots', spotId);
    if (!spot || !spot.sessions) return;

    var session = spot.sessions.find(function (s) { return s.id === sessionId; });
    if (!session) return;

    // Remove from spot
    spot.sessions = spot.sessions.filter(function (s) { return s.id !== sessionId; });

    // Recalculate stats
    var totalEarnings = spot.sessions.reduce(function (sum, s) { return sum + (Number(s.earnings) || 0); }, 0);
    var totalSessions = spot.sessions.length;
    spot.earnings_stats = {
      total_earnings: totalEarnings,
      total_sessions: totalSessions,
      avg_earnings: totalSessions > 0 ? totalEarnings / totalSessions : 0
    };
    spot.updated_at = new Date().toISOString();
    updateEntity('busking_spots', spotId, spot);

    // Delete linked income_log entry
    if (session.income_id) {
      deleteEntity('income_log', session.income_id);
    }

    saveData();
    if (spot.tour_stop_id) recalculateStop(spot.tour_stop_id);

    closeModalSheet('spot-detail');
    notify('Session deleted');
    openSpotDetailModal(spotId);
  }

  // ── Gig Detail Modal ───────────────────────────────────────────────────
  function openGigDetailModal(gigId) {
    var gig = getEntity('gigs', gigId);
    if (!gig) return;

    var venue = gig.venue_id ? getEntity('venues', gig.venue_id) : null;
    var venueName = venue ? venue.name : 'Unknown Venue';

    var html = '' +
      '<div class="modal-hdr">' +
        '<div class="modal-title">🎤 ' + esc(venueName) + '</div>' +
        '<button class="modal-close" data-close-sheet="gig-detail">✕</button>' +
      '</div>';

    // Gig details (editable)
    html += '<div class="entity-card">' +
      '<div class="modal-field">' +
        '<label>Gig Date</label>' +
        '<input type="date" id="v3-gig-date" value="' + esc(gig.date || '') + '" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Fee ($)</label>' +
        '<input type="number" id="v3-gig-fee" value="' + (gig.fee || 0) + '" min="0" step="0.01" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Status</label>' +
        '<select id="v3-gig-status">' +
          ['booked', 'confirmed', 'played', 'cancelled'].map(function (s) {
            return '<option value="' + s + '"' + (gig.status === s ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Set Times</label>' +
        '<input type="text" id="v3-gig-settimes" value="' + esc(gig.set_times || '') + '" placeholder="e.g. 8:00pm - 10:00pm" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Sound Check</label>' +
        '<input type="text" id="v3-gig-soundcheck" value="' + esc(gig.sound_check || '') + '" placeholder="e.g. 6:30pm" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>PA Provided?</label>' +
        '<select id="v3-gig-pa">' +
          '<option value="true"' + (gig.pa_provided ? ' selected' : '') + '>Yes</option>' +
          '<option value="false"' + (!gig.pa_provided ? ' selected' : '') + '>No</option>' +
        '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Rider</label>' +
        '<textarea id="v3-gig-rider" rows="2" style="min-height:50px;">' + esc(gig.rider || '') + '</textarea>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Accommodation Offered?</label>' +
        '<select id="v3-gig-accomm">' +
          '<option value="true"' + (gig.accommodation_offered ? ' selected' : '') + '>Yes</option>' +
          '<option value="false"' + (!gig.accommodation_offered ? ' selected' : '') + '>No</option>' +
        '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Setlist Notes</label>' +
        '<textarea id="v3-gig-setlist" rows="2" style="min-height:50px;">' + esc(gig.setlist_notes || '') + '</textarea>' +
      '</div>' +
    '</div>';

    // Income status
    if (gig.income_logged) {
      html += '<div class="fin-card" style="border-color:rgba(34,197,94,0.2);"><div class="fin-row income"><span class="lbl">✅ Income Logged</span><span class="val">' + fmt$(gig.fee) + '</span></div></div>';
    } else {
      html += '<button class="modal-submit" id="v3-gig-log-income" style="background:linear-gradient(135deg, var(--green-bright), #16a34a);">💰 Log Gig Income (' + fmt$(gig.fee || 0) + ')</button>';
    }

    // Save button
    html += '<button class="modal-submit" id="v3-gig-save">Save Changes</button>';

    openModalSheet('gig-detail', html);

    // Save button
    var saveBtn = document.getElementById('v3-gig-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      gig.date = (document.getElementById('v3-gig-date') || {}).value || gig.date;
      gig.fee = parseFloat((document.getElementById('v3-gig-fee') || {}).value) || 0;
      gig.status = (document.getElementById('v3-gig-status') || {}).value || gig.status;
      gig.set_times = (document.getElementById('v3-gig-settimes') || {}).value || '';
      gig.sound_check = (document.getElementById('v3-gig-soundcheck') || {}).value || '';
      gig.pa_provided = (document.getElementById('v3-gig-pa') || {}).value === 'true';
      gig.rider = (document.getElementById('v3-gig-rider') || {}).value || '';
      gig.accommodation_offered = (document.getElementById('v3-gig-accomm') || {}).value === 'true';
      gig.setlist_notes = (document.getElementById('v3-gig-setlist') || {}).value || '';
      gig.updated_at = new Date().toISOString();
      updateEntity('gigs', gigId, gig);
      saveData();
      if (gig.tour_stop_id) recalculateStop(gig.tour_stop_id);
      closeModalSheet('gig-detail');
      notify('Gig updated');
      renderTour();
    });

    // Log income button
    var logIncomeBtn = document.getElementById('v3-gig-log-income');
    if (logIncomeBtn) logIncomeBtn.addEventListener('click', function () {
      // Create income_log entry for this gig
      var incomeEntry = {
        id: generateId('inc'),
        date: gig.date || today(),
        type: 'gig_income',
        amount: gig.fee || 0,
        source_entity_type: 'gig',
        source_entity_id: gigId,
        tour_stop_id: gig.tour_stop_id || '',
        payment_method: 'bank_transfer',
        merch_sales: 0,
        notes: 'Gig at ' + venueName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      createEntity('income_log', incomeEntry);

      // Mark gig income as logged
      gig.income_logged = true;
      gig.updated_at = new Date().toISOString();
      updateEntity('gigs', gigId, gig);

      saveData();
      if (gig.tour_stop_id) recalculateStop(gig.tour_stop_id);

      closeModalSheet('gig-detail');
      notify('Gig income logged: ' + fmt$(gig.fee));
      renderTour();
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  // PART B: MONEY TAB
  // ═══════════════════════════════════════════════════════════════════════

  /** Current state for Money tab */
  var moneyState = {
    showAllStops: false
  };

  // ── Main render entry point for Money tab ──────────────────────────────
  function renderMoney() {
    var container = document.getElementById('view-money');
    if (!container) return;

    // Ensure recalculation
    if (typeof recalculateAll === 'function') {
      recalculateAll();
    }

    var config = (loadData() && loadData().config) || {};
    var tourTarget = config.tour_target || 37000;

    // Get all income and expenses
    var incomes = getAllEntities('income_log') || [];
    var expenses = getAllEntities('expense_log') || [];

    var grossEarnings = incomes.reduce(function (sum, i) { return sum + (Number(i.amount) || 0); }, 0);
    var totalExpenses = expenses.reduce(function (sum, e) { return sum + (Number(e.amount) || 0); }, 0);
    var netEarnings = grossEarnings - totalExpenses;
    var progressPct = tourTarget > 0 ? clamp(netEarnings / tourTarget * 100, 0, 100) : 0;

    var html = '';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
      '<div>' +
        '<div style="font-size:1.1rem;font-weight:800;">💰 Tour Financials</div>' +
        '<div class="entity-sub">' + (config.tour_name || 'WA Loop → East Coast 2026') + '</div>' +
      '</div>' +
      '<button class="venue-btn" id="v3-export-fin" style="font-size:0.65rem;">📥 Export</button>' +
    '</div>';

    // Summary cards (4)
    html += '<div class="stat-grid" style="grid-template-columns:1fr 1fr;">';
    // Gross Earnings
    html += '<div class="stat-card">' +
      '<div class="stat-label">Gross Earnings</div>' +
      '<div class="stat-val fmt-money" style="color:var(--green-bright);">' + fmt$(grossEarnings) + '</div>' +
      '<div class="stat-sub">' + incomes.length + ' income entries</div>' +
    '</div>';
    // Total Expenses
    html += '<div class="stat-card">' +
      '<div class="stat-label">Total Expenses</div>' +
      '<div class="stat-val fmt-money" style="color:var(--expense);">' + fmt$(totalExpenses) + '</div>' +
      '<div class="stat-sub">' + expenses.length + ' expense entries</div>' +
    '</div>';
    // Net Earnings
    var netColor = netEarnings >= 0 ? 'var(--green-bright)' : 'var(--expense)';
    html += '<div class="stat-card">' +
      '<div class="stat-label">Net Earnings</div>' +
      '<div class="stat-val fmt-money" style="color:' + netColor + ';">' + fmt$(netEarnings) + '</div>' +
      '<div class="stat-sub">Gross - Expenses</div>' +
    '</div>';
    // Progress to target
    html += '<div class="stat-card">' +
      '<div class="stat-label">Progress to ' + fmt$(tourTarget) + '</div>' +
      '<div class="stat-val fmt-money" style="color:var(--cyan);">' + Math.round(progressPct) + '%</div>' +
      '<div class="stat-sub">' + fmt$(netEarnings) + ' / ' + fmt$(tourTarget) + '</div>' +
      '<div class="stat-bar"><div class="stat-bar-fill" style="width:' + progressPct + '%;background:var(--cyan);"></div></div>' +
    '</div>';
    html += '</div>';

    // Log Income + Log Expense buttons
    html += '<div style="display:flex;gap:0.4rem;margin-bottom:1rem;">' +
      '<button class="venue-btn advance" id="v3-log-income" style="flex:1;font-size:0.72rem;padding:0.6rem;">💰 Log Income</button>' +
      '<button class="venue-btn" id="v3-log-expense" style="flex:1;font-size:0.72rem;padding:0.6rem;color:var(--expense);border-color:rgba(239,68,68,0.3);">💸 Log Expense</button>' +
    '</div>';

    // Income breakdown by type
    var incomeByType = {};
    incomes.forEach(function (i) {
      var t = i.type || 'other';
      incomeByType[t] = (incomeByType[t] || 0) + (Number(i.amount) || 0);
    });

    html += '<div class="section-title">Income by Type</div>';
    html += '<div class="fin-card">';
    if (Object.keys(incomeByType).length === 0) {
      html += '<div class="empty-state" style="padding:1rem;">No income logged yet.</div>';
    } else {
      Object.keys(incomeByType).forEach(function (type) {
        var typeInfo = INCOME_TYPES[type] || INCOME_TYPES.other;
        var amt = incomeByType[type];
        var barPct = grossEarnings > 0 ? clamp(amt / grossEarnings * 100, 0, 100) : 0;
        html += '<div class="fin-row income">' +
          '<span class="lbl">' + typeInfo.icon + ' ' + esc(typeInfo.label) + '</span>' +
          '<span class="val">' + fmt$(amt) + '</span>' +
        '</div>' +
        '<div class="stream-bar" style="margin:0.2rem 0 0.5rem;"><div class="stream-bar-fill" style="width:' + barPct + '%;background:' + typeInfo.color + ';"></div></div>';
      });
    }
    html += '</div>';

    // Expense breakdown by category
    var expByCat = {};
    expenses.forEach(function (e) {
      var c = e.category || 'misc';
      expByCat[c] = (expByCat[c] || 0) + (Number(e.amount) || 0);
    });

    html += '<div class="section-title">Expenses by Category</div>';
    html += '<div class="fin-card">';
    if (Object.keys(expByCat).length === 0) {
      html += '<div class="empty-state" style="padding:1rem;">No expenses logged yet.</div>';
    } else {
      Object.keys(expByCat).forEach(function (cat) {
        var catInfo = EXPENSE_CATEGORIES[cat] || EXPENSE_CATEGORIES.misc;
        var amt = expByCat[cat];
        var barPct = totalExpenses > 0 ? clamp(amt / totalExpenses * 100, 0, 100) : 0;
        html += '<div class="fin-row expense">' +
          '<span class="lbl">' + catInfo.icon + ' ' + esc(catInfo.label) + '</span>' +
          '<span class="val">-' + fmt$(amt) + '</span>' +
        '</div>' +
        '<div class="stream-bar" style="margin:0.2rem 0 0.5rem;"><div class="stream-bar-fill" style="width:' + barPct + '%;background:' + catInfo.color + ';"></div></div>';
      });
    }
    html += '</div>';

    // Per-stop breakdown table
    html += renderPerStopBreakdown();

    container.innerHTML = html;

    // Bind buttons
    var exportBtn = document.getElementById('v3-export-fin');
    if (exportBtn) exportBtn.addEventListener('click', exportFinancialsJSON);

    var logIncomeBtn = document.getElementById('v3-log-income');
    if (logIncomeBtn) logIncomeBtn.addEventListener('click', openLogIncomeModal);

    var logExpenseBtn = document.getElementById('v3-log-expense');
    if (logExpenseBtn) logExpenseBtn.addEventListener('click', openLogExpenseModal);

    // Bind projection inputs
    container.querySelectorAll('[data-stop-projection]').forEach(function (input) {
      input.addEventListener('change', function () {
        var stopId = input.getAttribute('data-stop-id');
        var field = input.getAttribute('data-stop-projection');
        var val = parseFloat(input.value) || 0;
        var stop = getEntity('tour_stops', stopId);
        if (stop) {
          if (!stop.financials) stop.financials = {};
          stop.financials[field] = val;
          stop.updated_at = new Date().toISOString();
          updateEntity('tour_stops', stopId, stop);
          saveData();
          notify('Projection updated');
        }
      });
    });
  }

  // ── Per-Stop Breakdown Table ───────────────────────────────────────────
  function renderPerStopBreakdown() {
    var stops = getAllEntities('tour_stops') || [];
    if (stops.length === 0) return '';

    // Sort by arrival date
    stops.sort(function (a, b) {
      return (a.arrival_date || '').localeCompare(b.arrival_date || '');
    });

    var incomes = getAllEntities('income_log') || [];
    var expenses = getAllEntities('expense_log') || [];

    var html = '<div class="section-title">Per-Stop Breakdown</div>';
    html += '<div class="fin-card" style="overflow-x:auto;">';

    // Table header
    html += '<table style="width:100%;border-collapse:collapse;font-size:0.7rem;">' +
      '<thead><tr style="border-bottom:1px solid var(--card-brd);">' +
        '<th style="text-align:left;padding:0.4rem 0.3rem;font-weight:700;color:var(--text-dim);font-size:0.6rem;text-transform:uppercase;">Stop</th>' +
        '<th style="text-align:right;padding:0.4rem 0.3rem;font-weight:700;color:var(--text-dim);font-size:0.6rem;text-transform:uppercase;">Projected</th>' +
        '<th style="text-align:right;padding:0.4rem 0.3rem;font-weight:700;color:var(--text-dim);font-size:0.6rem;text-transform:uppercase;">Actual</th>' +
        '<th style="text-align:right;padding:0.4rem 0.3rem;font-weight:700;color:var(--text-dim);font-size:0.6rem;text-transform:uppercase;">Expenses</th>' +
        '<th style="text-align:right;padding:0.4rem 0.3rem;font-weight:700;color:var(--text-dim);font-size:0.6rem;text-transform:uppercase;">Net</th>' +
        '<th style="text-align:right;padding:0.4rem 0.3rem;font-weight:700;color:var(--text-dim);font-size:0.6rem;text-transform:uppercase;">Δ</th>' +
      '</tr></thead><tbody>';

    var totalProjected = 0, totalActual = 0, totalExp = 0;

    stops.forEach(function (stop) {
      var stopIncomes = incomes.filter(function (i) { return i.tour_stop_id === stop.id; });
      var stopExpenses = expenses.filter(function (e) { return e.tour_stop_id === stop.id; });
      var actual = stopIncomes.reduce(function (s, i) { return s + (Number(i.amount) || 0); }, 0);
      var exp = stopExpenses.reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);
      var net = actual - exp;

      var fin = stop.financials || {};
      var projected = fin.projected_income || 0;
      var variance = actual - projected;

      totalProjected += projected;
      totalActual += actual;
      totalExp += exp;

      var netColor = net >= 0 ? 'var(--green-bright)' : 'var(--expense)';
      var varColor = variance >= 0 ? 'var(--green-bright)' : 'var(--amber)';

      html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.03);">' +
        '<td style="padding:0.4rem 0.3rem;font-weight:600;">' + esc(stop.name) + '</td>' +
        '<td style="text-align:right;padding:0.4rem 0.3rem;">' +
          '<input type="number" value="' + projected + '" step="0.01" data-stop-projection="projected_income" data-stop-id="' + esc(stop.id) + '" style="width:70px;text-align:right;padding:0.2rem 0.3rem;border-radius:4px;border:1px solid var(--card-brd);background:rgba(0,0,0,0.3);color:var(--off-white);font-size:0.65rem;" />' +
        '</td>' +
        '<td style="text-align:right;padding:0.4rem 0.3rem;color:var(--green-bright);">' + fmt$(actual) + '</td>' +
        '<td style="text-align:right;padding:0.4rem 0.3rem;color:var(--expense);">' + fmt$(exp) + '</td>' +
        '<td style="text-align:right;padding:0.4rem 0.3rem;font-weight:700;color:' + netColor + ';">' + fmt$(net) + '</td>' +
        '<td style="text-align:right;padding:0.4rem 0.3rem;font-size:0.6rem;color:' + varColor + ';">' + (variance >= 0 ? '+' : '') + fmt$(variance) + '</td>' +
      '</tr>';
    });

    // Totals row
    var totalNet = totalActual - totalExp;
    var totalVar = totalActual - totalProjected;
    var totalNetColor = totalNet >= 0 ? 'var(--green-bright)' : 'var(--expense)';
    var totalVarColor = totalVar >= 0 ? 'var(--green-bright)' : 'var(--amber)';

    html += '<tr style="border-top:2px solid var(--card-brd);font-weight:800;">' +
      '<td style="padding:0.5rem 0.3rem;">TOTAL</td>' +
      '<td style="text-align:right;padding:0.5rem 0.3rem;">' + fmt$(totalProjected) + '</td>' +
      '<td style="text-align:right;padding:0.5rem 0.3rem;color:var(--green-bright);">' + fmt$(totalActual) + '</td>' +
      '<td style="text-align:right;padding:0.5rem 0.3rem;color:var(--expense);">' + fmt$(totalExp) + '</td>' +
      '<td style="text-align:right;padding:0.5rem 0.3rem;color:' + totalNetColor + ';">' + fmt$(totalNet) + '</td>' +
      '<td style="text-align:right;padding:0.5rem 0.3rem;font-size:0.6rem;color:' + totalVarColor + ';">' + (totalVar >= 0 ? '+' : '') + fmt$(totalVar) + '</td>' +
    '</tr>';

    html += '</tbody></table>';
    html += '</div>';

    return html;
  }

  // ── Export Financials as JSON ──────────────────────────────────────────
  function exportFinancialsJSON() {
    var data = loadData() || {};
    var exportObj = {
      exported_at: new Date().toISOString(),
      tour_name: (data.config && data.config.tour_name) || 'Tour',
      tour_target: (data.config && data.config.tour_target) || 37000,
      income_log: getAllEntities('income_log') || [],
      expense_log: getAllEntities('expense_log') || [],
      tour_stops: (getAllEntities('tour_stops') || []).map(function (s) {
        return {
          id: s.id,
          name: s.name,
          state: s.state,
          arrival_date: s.arrival_date,
          departure_date: s.departure_date,
          status: s.status,
          targets: s.targets,
          actuals: s.actuals,
          financials: s.financials
        };
      })
    };

    var json = JSON.stringify(exportObj, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'tour-financials-' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('Financials exported');
  }

  // ── Log Income Modal ───────────────────────────────────────────────────
  function openLogIncomeModal() {
    var currentStop = getCurrentStop();
    var stops = getAllEntities('tour_stops') || [];
    var stopOptions = stops.map(function (s) {
      var isCurrent = currentStop && s.id === currentStop.id;
      return '<option value="' + esc(s.id) + '"' + (isCurrent ? ' selected' : '') + '>' + esc(s.name) + ', ' + esc(s.state || '') + (isCurrent ? ' (current)' : '') + '</option>';
    }).join('');

    var typeOptions = Object.keys(INCOME_TYPES).map(function (t) {
      var info = INCOME_TYPES[t];
      return '<option value="' + t + '">' + info.icon + ' ' + esc(info.label) + '</option>';
    }).join('');

    var html = '' +
      '<div class="modal-hdr">' +
        '<div class="modal-title">💰 Log Income</div>' +
        '<button class="modal-close" data-close-sheet="log-income">✕</button>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Income Type</label>' +
        '<select id="v3-income-type">' + typeOptions + '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Amount ($)</label>' +
        '<input type="number" id="v3-income-amount" value="0" min="0" step="0.01" placeholder="0.00" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Date</label>' +
        '<input type="date" id="v3-income-date" value="' + today() + '" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Source (auto-linked or manual)</label>' +
        '<input type="text" id="v3-income-source" placeholder="e.g. The Irish Rose, Raine Square" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Tour Stop</label>' +
        '<select id="v3-income-stop">' + (stopOptions || '<option value="">No stops</option>') + '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Payment Method</label>' +
        '<select id="v3-income-method">' +
          '<option value="cash">💵 Cash</option>' +
          '<option value="bank_transfer">🏦 Bank Transfer</option>' +
          '<option value="paypal">💳 PayPal</option>' +
        '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Notes</label>' +
        '<textarea id="v3-income-notes" rows="2" style="min-height:50px;" placeholder="Optional notes..."></textarea>' +
      '</div>' +
      '<button class="modal-submit" id="v3-income-save">Save Income</button>';

    openModalSheet('log-income', html);

    var saveBtn = document.getElementById('v3-income-save');
    if (saveBtn) saveBtn.addEventListener('click', saveIncomeEntry);
  }

  function saveIncomeEntry() {
    var type = (document.getElementById('v3-income-type') || {}).value || 'other';
    var amount = parseFloat((document.getElementById('v3-income-amount') || {}).value) || 0;
    var date = (document.getElementById('v3-income-date') || {}).value || today();
    var source = ((document.getElementById('v3-income-source') || {}).value || '').trim();
    var stopId = (document.getElementById('v3-income-stop') || {}).value || '';
    var method = (document.getElementById('v3-income-method') || {}).value || 'cash';
    var notes = ((document.getElementById('v3-income-notes') || {}).value || '').trim();

    if (amount < 0) {
      notify('Amount cannot be negative');
      return;
    }

    var entry = {
      id: generateId('inc'),
      date: date,
      type: type,
      amount: amount,
      source_entity_type: '',
      source_entity_id: '',
      tour_stop_id: stopId,
      payment_method: method,
      merch_sales: 0,
      notes: notes || source || INCOME_TYPES[type].label,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // If source text provided, store in notes
    if (source && !notes) {
      entry.notes = source;
    }

    createEntity('income_log', entry);
    saveData();
    if (stopId) recalculateStop(stopId);

    closeModalSheet('log-income');
    notify('Income logged: ' + fmt$(amount));
    renderMoney();
  }

  // ── Log Expense Modal ──────────────────────────────────────────────────
  function openLogExpenseModal() {
    var currentStop = getCurrentStop();
    var stops = getAllEntities('tour_stops') || [];
    var stopOptions = stops.map(function (s) {
      var isCurrent = currentStop && s.id === currentStop.id;
      return '<option value="' + esc(s.id) + '"' + (isCurrent ? ' selected' : '') + '>' + esc(s.name) + ', ' + esc(s.state || '') + (isCurrent ? ' (current)' : '') + '</option>';
    }).join('');

    var catOptions = Object.keys(EXPENSE_CATEGORIES).map(function (c) {
      var info = EXPENSE_CATEGORIES[c];
      return '<option value="' + c + '">' + info.icon + ' ' + esc(info.label) + '</option>';
    }).join('');

    var html = '' +
      '<div class="modal-hdr">' +
        '<div class="modal-title">💸 Log Expense</div>' +
        '<button class="modal-close" data-close-sheet="log-expense">✕</button>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Category</label>' +
        '<select id="v3-expense-cat">' + catOptions + '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Amount ($)</label>' +
        '<input type="number" id="v3-expense-amount" value="0" min="0" step="0.01" placeholder="0.00" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Date</label>' +
        '<input type="date" id="v3-expense-date" value="' + today() + '" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Tour Stop</label>' +
        '<select id="v3-expense-stop">' + (stopOptions || '<option value="">No stops</option>') + '</select>' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Description</label>' +
        '<input type="text" id="v3-expense-desc" placeholder="e.g. Diesel fill-up" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Odometer (if vehicle-related)</label>' +
        '<input type="number" id="v3-expense-odo" value="" placeholder="e.g. 45230" />' +
      '</div>' +
      '<div class="modal-field">' +
        '<label>Receipt Reference (optional)</label>' +
        '<input type="text" id="v3-expense-receipt" placeholder="e.g. BP Receipt #12345" />' +
      '</div>' +
      '<button class="modal-submit" id="v3-expense-save" style="background:linear-gradient(135deg, var(--expense), #dc2626);">Save Expense</button>';

    openModalSheet('log-expense', html);

    // Auto-show odometer for vehicle-related categories
    var catSelect = document.getElementById('v3-expense-cat');
    var odoField = document.getElementById('v3-expense-odo');
    if (catSelect && odoField) {
      var odoParent = odoField.closest('.modal-field');
      catSelect.addEventListener('change', function () {
        var isVehicle = this.value === 'fuel' || this.value === 'vehicle_maintenance';
        odoParent.style.opacity = isVehicle ? '1' : '0.4';
      });
    }

    var saveBtn = document.getElementById('v3-expense-save');
    if (saveBtn) saveBtn.addEventListener('click', saveExpenseEntry);
  }

  function saveExpenseEntry() {
    var category = (document.getElementById('v3-expense-cat') || {}).value || 'misc';
    var amount = parseFloat((document.getElementById('v3-expense-amount') || {}).value) || 0;
    var date = (document.getElementById('v3-expense-date') || {}).value || today();
    var stopId = (document.getElementById('v3-expense-stop') || {}).value || '';
    var desc = ((document.getElementById('v3-expense-desc') || {}).value || '').trim();
    var odo = (document.getElementById('v3-expense-odo') || {}).value;
    var receipt = ((document.getElementById('v3-expense-receipt') || {}).value || '').trim();

    if (amount <= 0) {
      notify('Amount must be greater than 0');
      return;
    }

    var isVehicle = category === 'fuel' || category === 'vehicle_maintenance';

    var entry = {
      id: generateId('exp'),
      date: date,
      category: category,
      amount: amount,
      description: desc || EXPENSE_CATEGORIES[category].label,
      tour_stop_id: stopId,
      odometer: odo ? parseInt(odo) : null,
      vehicle_related: isVehicle,
      receipt_ref: receipt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    createEntity('expense_log', entry);
    saveData();
    if (stopId) recalculateStop(stopId);

    closeModalSheet('log-expense');
    notify('Expense logged: ' + fmt$(amount));
    renderMoney();
  }


  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  // Expose render functions globally
  window.renderTour = renderTour;
  window.renderMoney = renderMoney;

  // Expose back button handler for inline onclick
  window._v3TourBack = function () {
    tourState.selectedStopId = null;
    renderTour();
  };

  // Expose for external integration (FAB / Create Sheet)
  window.v3FinanceBusking = {
    renderTour: renderTour,
    renderMoney: renderMoney,
    openLogBuskingSession: function (stopId) {
      var cs = getCurrentStop();
      openLogBuskingSessionModal(stopId || (cs && cs.id));
    },
    openLogIncome: openLogIncomeModal,
    openLogExpense: openLogExpenseModal,
    openAddSpot: function (stopId) {
      var cs = getCurrentStop();
      openAddBuskingSpotModal(stopId || (cs && cs.id));
    },
    // Reset tour detail to route view
    backToRoute: function () {
      tourState.selectedStopId = null;
      tourState.stopDetailTab = 'busking';
      renderTour();
    }
  };

})();

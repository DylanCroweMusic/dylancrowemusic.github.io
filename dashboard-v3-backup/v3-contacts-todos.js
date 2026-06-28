/* ═══════════════════════════════════════════════════════════════════════
   TOUR OS v3 — CONTACTS + TODOS + CREATE SHEET + SEARCH + SETTINGS
   Agent 5: Contacts, Create Sheet (FAB), Global Search, Settings

   Renders:
   - People tab (div id="view-people"): searchable contact list + detail modal
   - Create Sheet: FAB overlay with all entity creation forms
   - Global Search: full-screen search overlay
   - Settings: profile, tour config, data management, about

   Depends on v3-foundation.js (window.TourOS) for all CRUD.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 0: HELPERS
     ═══════════════════════════════════════════════════════════════════════ */

  /** Escape text for safe HTML insertion */
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Today's date as YYYY-MM-DD */
  function todayStr() {
    var d = new Date();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var da = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mo + '-' + da;
  }

  /** Format YYYY-MM-DD → "15 Aug" */
  function fmtDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + months[d.getMonth()];
  }

  /** Format ISO datetime → "15 Aug, 2:30pm" */
  function fmtDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var h = d.getHours();
    var ampm = h >= 12 ? 'pm' : 'am';
    var h12 = h % 12 || 12;
    return d.getDate() + ' ' + months[d.getMonth()] + ', ' + h12 + ':' +
      String(d.getMinutes()).padStart(2, '0') + ampm;
  }

  /** Show toast notification (uses global showToast if available) */
  function toast(msg, type) {
    var el = document.getElementById('toast');
    if (!el) { alert(msg); return; }
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = 'toast'; }, 2500);
  }

  /** Shorthand for TourOS calls */
  function D() { return TourOS.getData(); }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 1: SCOPED CSS
     Inject styles specific to this module.
     ═══════════════════════════════════════════════════════════════════════ */

  var STYLE_ID = 'v3-contacts-todos-css';
  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      /* Filter chips */
      '.ct-filter-bar { display:flex; gap:6px; overflow-x:auto; padding:4px 0 12px; -webkit-overflow-scrolling:touch; scrollbar-width:none; }',
      '.ct-filter-bar::-webkit-scrollbar { display:none; }',
      '.ct-chip { white-space:nowrap; padding:6px 14px; border-radius:20px; border:1px solid var(--border); background:var(--bg-card); color:var(--text-muted); font-size:13px; font-weight:600; cursor:pointer; min-height:36px; display:flex; align-items:center; transition:all 0.2s; -webkit-tap-highlight-color:transparent; }',
      '.ct-chip.active { background:var(--cyan); color:var(--bg); border-color:var(--cyan); }',
      '.ct-chip .ct-chip-count { margin-left:6px; opacity:0.7; font-size:11px; }',

      /* Contact card */
      '.ct-contact-card { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:10px; cursor:pointer; transition:all 0.2s; -webkit-tap-highlight-color:transparent; }',
      '.ct-contact-card:active { background:var(--bg-card-hover); border-color:var(--cyan); }',
      '.ct-contact-name { font-size:15px; font-weight:700; color:var(--text); }',
      '.ct-contact-role { font-size:12px; color:var(--cyan); font-weight:600; margin-top:2px; }',
      '.ct-contact-info { display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:8px; font-size:13px; color:var(--text-muted); }',
      '.ct-contact-info a { color:var(--text-muted); text-decoration:none; }',
      '.ct-contact-info a:active { color:var(--cyan); }',
      '.ct-contact-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }',
      '.ct-tag { font-size:10px; padding:2px 7px; border-radius:4px; background:rgba(0,180,216,0.15); color:var(--cyan); font-weight:600; text-transform:uppercase; letter-spacing:0.3px; }',
      '.ct-linked-entity { display:inline-flex; align-items:center; gap:4px; font-size:11px; padding:3px 8px; border-radius:4px; background:rgba(217,119,6,0.15); color:var(--amber); font-weight:600; margin-top:6px; }',

      /* Section header with action button */
      '.ct-section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }',
      '.ct-section-title { font-size:18px; font-weight:700; }',
      '.ct-add-btn { min-height:36px; padding:6px 14px; border-radius:8px; border:1px solid var(--cyan); background:rgba(0,180,216,0.1); color:var(--cyan); font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:4px; -webkit-tap-highlight-color:transparent; }',
      '.ct-add-btn:active { background:rgba(0,180,216,0.25); }',

      /* Search input */
      '.ct-search-wrap { position:relative; margin-bottom:12px; }',
      '.ct-search-input { width:100%; min-height:44px; padding:10px 12px 10px 38px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:15px; font-family:inherit; }',
      '.ct-search-input:focus { outline:none; border-color:var(--cyan); }',
      '.ct-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); font-size:16px; opacity:0.5; pointer-events:none; }',

      /* Detail modal — interaction timeline */
      '.ct-timeline { margin-top:16px; }',
      '.ct-timeline-item { padding:10px 0; border-bottom:1px solid var(--border); }',
      '.ct-timeline-item:last-child { border-bottom:none; }',
      '.ct-timeline-date { font-size:11px; color:var(--text-muted); font-weight:600; }',
      '.ct-timeline-text { font-size:14px; color:var(--text); margin-top:2px; }',

      /* Create sheet grid */
      '.cs-sheet { width:100%; max-width:var(--max-width); max-height:85vh; overflow-y:auto; background:var(--bg-card); border-radius:16px 16px 0 0; border-top:1px solid var(--border); padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px)); animation:slideUp 0.3s ease; }',
      '.cs-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin:16px 0 8px; }',
      '.cs-section-label:first-child { margin-top:0; }',
      '.cs-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }',
      '.cs-btn { min-height:72px; border:1px solid var(--border); border-radius:12px; background:var(--bg); color:var(--text); font-size:12px; font-weight:600; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:8px 4px; transition:all 0.2s; -webkit-tap-highlight-color:transparent; text-align:center; line-height:1.2; }',
      '.cs-btn:active { border-color:var(--cyan); background:var(--bg-card-hover); }',
      '.cs-btn .cs-btn-icon { font-size:24px; line-height:1; }',
      '.cs-btn .cs-btn-label { font-size:11px; }',
      '.cs-btn.cs-big { min-height:80px; }',
      '.cs-btn.cs-green { border-color:rgba(34,197,94,0.3); }',
      '.cs-btn.cs-green:active { border-color:var(--green-bright); }',
      '.cs-btn.cs-blue { border-color:rgba(0,180,216,0.3); }',
      '.cs-btn.cs-red { border-color:rgba(239,68,68,0.3); }',
      '.cs-btn.cs-red:active { border-color:var(--red); }',

      /* Sheet handle (grabber) */
      '.cs-handle { width:36px; height:4px; border-radius:2px; background:var(--border); margin:0 auto 16px; }',

      /* Form actions */
      '.ct-form-actions { display:flex; gap:8px; margin-top:20px; }',
      '.ct-form-actions .btn { flex:1; }',
      '.ct-form-actions .btn-secondary { background:transparent; border-color:var(--border); color:var(--text-muted); }',

      /* Search overlay */
      '.gs-overlay { position:fixed; inset:0; z-index:380; background:var(--bg); display:flex; flex-direction:column; animation:fadeIn 0.2s ease; }',
      '.gs-header { display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid var(--border); }',
      '.gs-header .ct-search-wrap { flex:1; margin-bottom:0; }',
      '.gs-close { width:44px; height:44px; border:none; background:transparent; color:var(--text-muted); font-size:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; flex-shrink:0; }',
      '.gs-close:active { background:var(--bg-card-hover); color:var(--text); }',
      '.gs-body { flex:1; overflow-y:auto; padding:16px; }',
      '.gs-group { margin-bottom:20px; }',
      '.gs-group-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:8px; }',
      '.gs-result { display:flex; align-items:center; gap:12px; padding:12px; border-radius:10px; cursor:pointer; transition:background 0.2s; -webkit-tap-highlight-color:transparent; }',
      '.gs-result:active { background:var(--bg-card-hover); }',
      '.gs-result-icon { font-size:20px; flex-shrink:0; width:32px; text-align:center; }',
      '.gs-result-info { flex:1; min-width:0; }',
      '.gs-result-title { font-size:14px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
      '.gs-result-sub { font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
      '.gs-recent { margin-top:8px; }',
      '.gs-recent-item { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; margin:3px; border-radius:20px; background:var(--bg-card); border:1px solid var(--border); color:var(--text-muted); font-size:12px; cursor:pointer; }',
      '.gs-recent-item:active { border-color:var(--cyan); color:var(--cyan); }',
      '.gs-highlight { color:var(--cyan); font-weight:700; }',

      /* Settings */
      '.st-section { margin-bottom:24px; }',
      '.st-section-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--cyan); margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid var(--border); }',
      '.st-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); }',
      '.st-row:last-child { border-bottom:none; }',
      '.st-row-label { font-size:14px; color:var(--text); font-weight:500; }',
      '.st-row-input { background:var(--bg); border:1px solid var(--border); border-radius:6px; color:var(--text); padding:8px 10px; font-size:14px; min-height:40px; min-width:120px; text-align:right; font-family:inherit; }',
      '.st-row-input:focus { outline:none; border-color:var(--cyan); }',
      '.st-info-row { display:flex; justify-content:space-between; padding:8px 0; font-size:14px; }',
      '.st-info-label { color:var(--text-muted); }',
      '.st-info-value { color:var(--text); font-weight:600; }',
      '.st-toggle { position:relative; width:48px; height:28px; border-radius:14px; background:var(--border); cursor:pointer; transition:background 0.2s; flex-shrink:0; }',
      '.st-toggle.on { background:var(--cyan); }',
      '.st-toggle::after { content:""; position:absolute; top:3px; left:3px; width:22px; height:22px; border-radius:50%; background:white; transition:transform 0.2s; }',
      '.st-toggle.on::after { transform:translateX(20px); }',
      '.st-toggle.disabled { opacity:0.4; cursor:not-allowed; }',
      '.st-danger-zone { border:1px solid rgba(239,68,68,0.3); border-radius:10px; padding:12px; margin-top:8px; }',
      '.st-confirm-wrap { display:none; margin-top:10px; }',
      '.st-confirm-wrap.show { display:block; }',

      /* Editable field in contact detail */
      '.ct-field { margin-bottom:14px; }',
      '.ct-field-label { font-size:12px; color:var(--text-muted); font-weight:600; margin-bottom:4px; }',
      '.ct-field-value { font-size:15px; color:var(--text); }',
      '.ct-field-input { width:100%; min-height:44px; padding:10px 12px; background:var(--bg); border:1px solid var(--border); border-radius:8px; color:var(--text); font-size:15px; font-family:inherit; }',
      '.ct-field-input:focus { outline:none; border-color:var(--cyan); }',

      /* Inline validation */
      '.ct-field-input.invalid { border-color:var(--red); }',
      '.ct-validation-msg { font-size:12px; color:var(--red); margin-top:4px; display:none; }',
      '.ct-validation-msg.show { display:block; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 2: MODAL / SHEET SYSTEM
     Self-contained bottom-sheet modal system.
     ═══════════════════════════════════════════════════════════════════════ */

  /** Track open sheets by id for stacking / cleanup */
  var _sheets = {};

  /**
   * Open a bottom-sheet modal.
   * @param {string} id - unique sheet id
   * @param {string} innerHTML - modal body HTML
   * @param {object} opts - { title, zIndex, fullScreen }
   */
  function openSheet(id, innerHTML, opts) {
    opts = opts || {};
    closeSheet(id); // remove if already open

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'ct-sheet-' + id;
    overlay.style.zIndex = opts.zIndex || 350;

    var sheet = document.createElement('div');
    sheet.className = opts.fullScreen ? 'modal' : 'cs-sheet';
    if (opts.fullScreen) {
      sheet.style.maxHeight = '100vh';
      sheet.style.borderRadius = '0';
      sheet.style.height = '100vh';
    }

    var html = '';
    if (opts.title) {
      html += '<div class="modal-header">' +
        '<div class="modal-title">' + esc(opts.title) + '</div>' +
        '<button class="modal-close" data-close-sheet="' + id + '">×</button>' +
        '</div>';
    } else if (!opts.fullScreen) {
      html += '<div class="cs-handle" data-close-sheet="' + id + '"></div>';
    } else {
      html += '<div class="modal-header">' +
        '<button class="modal-close" data-close-sheet="' + id + '">×</button>' +
        '</div>';
    }
    html += innerHTML;
    sheet.innerHTML = html;

    overlay.appendChild(sheet);

    // Close on backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeSheet(id);
    });

    document.body.appendChild(overlay);
    _sheets[id] = overlay;

    // Focus first input if present
    setTimeout(function () {
      var firstInput = sheet.querySelector('input, textarea, select');
      if (firstInput && !opts.fullScreen) firstInput.focus();
    }, 300);

    return overlay;
  }

  /** Close a sheet by id */
  function closeSheet(id) {
    var overlay = document.getElementById('ct-sheet-' + id);
    if (overlay) {
      overlay.classList.remove('active');
      overlay.remove();
    }
    delete _sheets[id];
  }

  /** Close all open sheets */
  function closeAllSheets() {
    Object.keys(_sheets).forEach(function (id) { closeSheet(id); });
  }

  // Global click handler for data-close-sheet elements
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-close-sheet]');
    if (el) {
      e.stopPropagation();
      closeSheet(el.getAttribute('data-close-sheet'));
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 3: PEOPLE TAB — Contacts List + Detail
     ═══════════════════════════════════════════════════════════════════════ */

  /** People tab state */
  var peopleState = {
    filter: 'all',      // all | venue_booker | host | lead | attendee
    search: ''
  };

  /** Filter definitions */
  var CONTACT_FILTERS = [
    { id: 'all', label: 'All', match: function () { return true; } },
    { id: 'venue_booker', label: 'Venue Bookers', match: function (c) {
      return (c.role || '').toLowerCase().includes('booker') || (c.tags || []).includes('venue_booker');
    }},
    { id: 'host', label: 'Hosts', match: function (c) {
      return (c.role || '').toLowerCase().includes('host') || (c.tags || []).includes('host') ||
        c.linked_entity_type === 'house_concert';
    }},
    { id: 'lead', label: 'Leads', match: function (c) {
      return (c.tags || []).includes('lead') || (c.role || '').toLowerCase().includes('lead');
    }},
    { id: 'attendee', label: 'Attendees', match: function (c) {
      return (c.tags || []).includes('attendee') || (c.role || '').toLowerCase().includes('attendee');
    }}
  ];

  /** Main render entry point for People tab */
  function renderPeople() {
    var container = document.getElementById('view-people');
    if (!container) return;

    var contacts = (D().contacts || []).filter(function (c) {
      return c.status !== 'archived';
    });

    // Apply filter
    var filterDef = CONTACT_FILTERS.find(function (f) { return f.id === peopleState.filter; }) || CONTACT_FILTERS[0];
    var filtered = contacts.filter(filterDef.match);

    // Apply search
    if (peopleState.search) {
      var q = peopleState.search.toLowerCase();
      filtered = filtered.filter(function (c) {
        return (c.name || '').toLowerCase().includes(q) ||
          (c.role || '').toLowerCase().includes(q) ||
          (c.org || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.city || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q);
      });
    }

    // Sort: name alphabetical
    filtered.sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });

    var html = '';

    // Section header with Add Contact button
    html += '<div class="ct-section-header">';
    html += '<div class="ct-section-title">People</div>';
    html += '<button class="ct-add-btn" id="ct-add-contact-btn">+ Contact</button>';
    html += '</div>';

    // Search
    html += '<div class="ct-search-wrap">';
    html += '<span class="ct-search-icon">🔍</span>';
    html += '<input type="text" class="ct-search-input" id="ct-people-search" placeholder="Search contacts..." value="' + esc(peopleState.search) + '">';
    html += '</div>';

    // Filter chips
    html += '<div class="ct-filter-bar">';
    CONTACT_FILTERS.forEach(function (f) {
      var count = contacts.filter(f.match).length;
      var active = f.id === peopleState.filter ? ' active' : '';
      html += '<button class="ct-chip' + active + '" data-filter="' + f.id + '">' + f.label +
        '<span class="ct-chip-count">' + count + '</span></button>';
    });
    html += '</div>';

    // Contact cards
    if (filtered.length === 0) {
      html += '<div class="empty-state">' +
        '<div class="empty-state-icon">👥</div>' +
        '<p>' + (contacts.length === 0 ? 'No contacts yet. Tap "+ Contact" to add one.' : 'No contacts match your filters.') + '</p>' +
      '</div>';
    } else {
      filtered.forEach(function (c) {
        html += renderContactCard(c);
      });
    }

    container.innerHTML = html;

    // Bind events
    _bindPeopleEvents(container);
  }

  /** Render a single contact card */
  function renderContactCard(c) {
    var html = '<div class="ct-contact-card" data-contact-id="' + esc(c.id) + '">';

    html += '<div class="ct-contact-name">' + esc(c.name || 'Unnamed') + '</div>';
    if (c.role) {
      html += '<div class="ct-contact-role">' + esc(c.role) + '</div>';
    }

    html += '<div class="ct-contact-info">';
    if (c.phone) {
      html += '<a href="tel:' + esc(c.phone) + '" data-stop="1">📞 ' + esc(c.phone) + '</a>';
    }
    if (c.email) {
      html += '<a href="mailto:' + esc(c.email) + '" data-stop="1">✉️ ' + esc(c.email) + '</a>';
    }
    if (c.org) {
      html += '<span>🏢 ' + esc(c.org) + '</span>';
    }
    if (c.city) {
      html += '<span>📍 ' + esc(c.city) + '</span>';
    }
    html += '</div>';

    // Tags
    if (c.tags && c.tags.length) {
      html += '<div class="ct-contact-tags">';
      c.tags.forEach(function (tag) {
        html += '<span class="ct-tag">' + esc(tag) + '</span>';
      });
      html += '</div>';
    }

    // Linked entity
    if (c.linked_entity_type && c.linked_entity_id) {
      var entityLabel = _linkedEntityLabel(c.linked_entity_type);
      html += '<div class="ct-linked-entity" data-linked-type="' + esc(c.linked_entity_type) + '" data-linked-id="' + esc(c.linked_entity_id) + '">🔗 ' + esc(entityLabel) + '</div>';
    }

    html += '</div>';
    return html;
  }

  /** Get human-readable label for a linked entity type */
  function _linkedEntityLabel(type) {
    var labels = {
      venue: 'Venue',
      house_concert: 'House Concert',
      busking_spot: 'Busking Spot',
      tour_stop: 'Tour Stop',
      gig: 'Gig'
    };
    return labels[type] || type;
  }

  /** Get entity name for display */
  function _linkedEntityName(type, id) {
    var entity = TourOS.getEntity(type, id);
    if (!entity) return '(deleted)';
    if (type === 'venue') return entity.name || 'Unnamed Venue';
    if (type === 'house_concert') return entity.host_name ? 'HC: ' + entity.host_name : 'House Concert';
    if (type === 'busking_spot') return entity.name || 'Busking Spot';
    if (type === 'tour_stop') return entity.name || 'Tour Stop';
    if (type === 'gig') return 'Gig';
    return id;
  }

  /** Bind People tab events */
  function _bindPeopleEvents(container) {
    // Add contact button
    var addBtn = container.querySelector('#ct-add-contact-btn');
    if (addBtn) addBtn.addEventListener('click', function () {
      openContactForm();
    });

    // Search input
    var searchInput = container.querySelector('#ct-people-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        peopleState.search = searchInput.value;
        // Debounce
        clearTimeout(searchInput._debounce);
        searchInput._debounce = setTimeout(function () {
          renderPeople();
          // Refocus
          var newInput = document.getElementById('ct-people-search');
          if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(newInput.value.length, newInput.value.length);
          }
        }, 250);
      });
    }

    // Filter chips
    container.querySelectorAll('.ct-chip[data-filter]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        peopleState.filter = chip.getAttribute('data-filter');
        renderPeople();
      });
    });

    // Contact card clicks
    container.querySelectorAll('.ct-contact-card[data-contact-id]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        // Don't open detail if clicking a link (tel:, mailto:) or linked entity
        if (e.target.closest('a[data-stop]')) return;
        if (e.target.closest('[data-linked-type]')) {
          var linked = e.target.closest('[data-linked-type]');
          var type = linked.getAttribute('data-linked-type');
          var id = linked.getAttribute('data-linked-id');
          openLinkedEntity(type, id);
          return;
        }
        var contactId = card.getAttribute('data-contact-id');
        openContactDetail(contactId);
      });
    });
  }

  /** Navigate to a linked entity detail (opens venue/HC/spot modal or switches tab) */
  function openLinkedEntity(type, id) {
    // For now, show a toast and attempt to open a detail sheet
    // In full integration, this would call pipeline.js or finance_busking.js detail functions
    var entity = TourOS.getEntity(type, id);
    if (!entity) {
      toast('Entity not found', 'error');
      return;
    }

    var name = _linkedEntityName(type, id);
    var html = '<div class="ct-field"><div class="ct-field-label">Type</div><div class="ct-field-value">' + _linkedEntityLabel(type) + '</div></div>';
    html += '<div class="ct-field"><div class="ct-field-label">Name</div><div class="ct-field-value">' + esc(name) + '</div></div>';

    if (type === 'venue' && entity.city) {
      html += '<div class="ct-field"><div class="ct-field-label">City</div><div class="ct-field-value">' + esc(entity.city) + '</div></div>';
      html += '<div class="ct-field"><div class="ct-field-label">Stage</div><div class="ct-field-value">' + esc(entity.stage || '') + '</div></div>';
    }
    if (type === 'house_concert') {
      html += '<div class="ct-field"><div class="ct-field-label">Stage</div><div class="ct-field-value">' + esc(entity.stage || '') + '</div></div>';
    }

    html += '<div class="ct-form-actions"><button class="btn btn-primary" data-close-sheet="linked-entity">Close</button></div>';

    openSheet('linked-entity', html, { title: '🔗 ' + name });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 3B: CONTACT DETAIL MODAL
     ═══════════════════════════════════════════════════════════════════════ */

  /** Open contact detail modal */
  function openContactDetail(contactId) {
    var contact = TourOS.getEntity('contacts', contactId);
    if (!contact) { toast('Contact not found', 'error'); return; }

    var editMode = false;
    var sheetId = 'contact-detail';

    function render() {
      var html = '';

      // Edit toggle button
      html += '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">';
      html += '<button class="ct-add-btn" id="ct-edit-toggle">' + (editMode ? '✓ Done' : '✏️ Edit') + '</button>';
      html += '</div>';

      // Fields
      var fields = [
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'role', label: 'Role', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'tel' },
        { key: 'email', label: 'Email', type: 'email' },
        { key: 'org', label: 'Organization', type: 'text' },
        { key: 'city', label: 'City', type: 'text' }
      ];

      fields.forEach(function (f) {
        html += '<div class="ct-field">';
        html += '<div class="ct-field-label">' + esc(f.label) + (f.required ? ' *' : '') + '</div>';
        if (editMode) {
          html += '<input type="' + f.type + '" class="ct-field-input" id="ct-field-' + f.key + '" value="' + esc(contact[f.key] || '') + '" data-field="' + f.key + '"' + (f.required ? ' data-required="1"' : '') + '>';
          html += '<div class="ct-validation-msg" id="ct-err-' + f.key + '">' + esc(f.label) + ' is required</div>';
        } else {
          var val = contact[f.key];
          if (f.key === 'phone' && val) {
            html += '<div class="ct-field-value"><a href="tel:' + esc(val) + '" style="color:var(--cyan);text-decoration:none;">' + esc(val) + '</a></div>';
          } else if (f.key === 'email' && val) {
            html += '<div class="ct-field-value"><a href="mailto:' + esc(val) + '" style="color:var(--cyan);text-decoration:none;">' + esc(val) + '</a></div>';
          } else {
            html += '<div class="ct-field-value">' + esc(val || '—') + '</div>';
          }
        }
        html += '</div>';
      });

      // Tags (display only in view mode, comma-separated input in edit mode)
      html += '<div class="ct-field">';
      html += '<div class="ct-field-label">Tags</div>';
      if (editMode) {
        html += '<input type="text" class="ct-field-input" id="ct-field-tags" value="' + esc((contact.tags || []).join(', ')) + '" placeholder="comma, separated, tags">';
      } else {
        if (contact.tags && contact.tags.length) {
          html += '<div class="ct-contact-tags">';
          contact.tags.forEach(function (tag) {
            html += '<span class="ct-tag">' + esc(tag) + '</span>';
          });
          html += '</div>';
        } else {
          html += '<div class="ct-field-value">—</div>';
        }
      }
      html += '</div>';

      // Linked entity
      if (contact.linked_entity_type && contact.linked_entity_id) {
        var entityName = _linkedEntityName(contact.linked_entity_type, contact.linked_entity_id);
        var entityLabel = _linkedEntityLabel(contact.linked_entity_type);
        html += '<div class="ct-field">';
        html += '<div class="ct-field-label">Linked Entity</div>';
        html += '<div class="ct-linked-entity" id="ct-linked-entity-link">🔗 ' + esc(entityLabel) + ': ' + esc(entityName) + '</div>';
        html += '</div>';
      }

      // Source
      html += '<div class="ct-field">';
      html += '<div class="ct-field-label">Source</div>';
      if (editMode) {
        html += '<input type="text" class="ct-field-input" id="ct-field-source" value="' + esc(contact.source || '') + '" placeholder="How did you find this contact?">';
      } else {
        html += '<div class="ct-field-value">' + esc(contact.source || '—') + '</div>';
      }
      html += '</div>';

      // Interaction history (timeline)
      html += '<div class="ct-timeline">';
      html += '<div class="ct-field-label" style="margin-bottom:8px;">📋 Interaction History</div>';

      // Collect notes/timeline items
      var timeline = [];
      if (contact.notes) {
        // notes can be a string (legacy) or array of {date, text}
        if (Array.isArray(contact.notes)) {
          contact.notes.forEach(function (n) {
            timeline.push({ date: n.date || contact.updated_at || '', text: n.text || n });
          });
        } else if (typeof contact.notes === 'string' && contact.notes.trim()) {
          timeline.push({ date: contact.last_contacted_date || contact.updated_at || '', text: contact.notes });
        }
      }
      // Also check for interaction_history field
      if (contact.interaction_history) {
        contact.interaction_history.forEach(function (n) {
          timeline.push({ date: n.date || '', text: n.text || n.note || '' });
        });
      }

      // Sort timeline by date descending
      timeline.sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });

      if (timeline.length === 0) {
        html += '<div class="ct-field-value text-muted" style="font-size:13px;">No interactions logged yet.</div>';
      } else {
        timeline.forEach(function (item) {
          html += '<div class="ct-timeline-item">';
          html += '<div class="ct-timeline-date">' + esc(fmtDate(item.date) || '—') + '</div>';
          html += '<div class="ct-timeline-text">' + esc(item.text) + '</div>';
          html += '</div>';
        });
      }
      html += '</div>';

      // Add note button
      html += '<button class="btn btn-block mt-16" id="ct-add-note-btn">➕ Add Note / Interaction</button>';

      // Save button (edit mode)
      if (editMode) {
        html += '<button class="btn btn-primary btn-block mt-16" id="ct-save-contact">💾 Save Changes</button>';
      }

      // Archive & Delete
      html += '<div class="ct-form-actions mt-16">';
      html += '<button class="btn btn-secondary" id="ct-archive-contact">📦 Archive</button>';
      html += '<button class="btn btn-danger" id="ct-delete-contact">🗑️ Delete</button>';
      html += '</div>';

      return html;
    }

    openSheet(sheetId, render(), { title: contact.name || 'Contact' });

    // Bind events (re-bind on each render)
    function bindDetailEvents() {
      var sheet = document.getElementById('ct-sheet-' + sheetId);
      if (!sheet) return;

      // Edit toggle
      var editToggle = sheet.querySelector('#ct-edit-toggle');
      if (editToggle) editToggle.addEventListener('click', function () {
        if (editMode) {
          // In edit mode, toggle = Done (just switch back to view without saving)
          editMode = false;
          openSheet(sheetId, render(), { title: contact.name || 'Contact' });
          bindDetailEvents();
        } else {
          editMode = true;
          openSheet(sheetId, render(), { title: 'Edit: ' + (contact.name || 'Contact') });
          bindDetailEvents();
        }
      });

      // Save changes
      var saveBtn = sheet.querySelector('#ct-save-contact');
      if (saveBtn) saveBtn.addEventListener('click', function () {
        // Validate required fields
        var valid = true;
        sheet.querySelectorAll('[data-required]').forEach(function (input) {
          var key = input.getAttribute('data-field');
          var errEl = sheet.querySelector('#ct-err-' + key);
          if (!input.value.trim()) {
            input.classList.add('invalid');
            if (errEl) errEl.classList.add('show');
            valid = false;
          } else {
            input.classList.remove('invalid');
            if (errEl) errEl.classList.remove('show');
          }
        });
        if (!valid) { toast('Please fill required fields', 'error'); return; }

        // Collect values
        var updates = {};
        sheet.querySelectorAll('[data-field]').forEach(function (input) {
          var key = input.getAttribute('data-field');
          if (key === 'tags') {
            updates.tags = input.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
          } else {
            updates[key] = input.value.trim();
          }
        });

        TourOS.updateEntity('contacts', contact.id, updates);
        contact = TourOS.getEntity('contacts', contact.id);
        editMode = false;
        toast('Contact updated', 'success');
        renderPeople();
        openSheet(sheetId, render(), { title: contact.name || 'Contact' });
        bindDetailEvents();
      });

      // Add note
      var noteBtn = sheet.querySelector('#ct-add-note-btn');
      if (noteBtn) noteBtn.addEventListener('click', function () {
        openAddNoteModal(contact.id, function () {
          // Refresh after note added
          contact = TourOS.getEntity('contacts', contact.id);
          openSheet(sheetId, render(), { title: contact.name || 'Contact' });
          bindDetailEvents();
        });
      });

      // Linked entity click
      var linkedEl = sheet.querySelector('#ct-linked-entity-link');
      if (linkedEl) linkedEl.addEventListener('click', function () {
        openLinkedEntity(contact.linked_entity_type, contact.linked_entity_id);
      });

      // Archive
      var archiveBtn = sheet.querySelector('#ct-archive-contact');
      if (archiveBtn) archiveBtn.addEventListener('click', function () {
        if (confirm('Archive this contact? It will be hidden from the active list.')) {
          TourOS.archiveEntity('contacts', contact.id);
          toast('Contact archived', 'success');
          closeSheet(sheetId);
          renderPeople();
        }
      });

      // Delete
      var deleteBtn = sheet.querySelector('#ct-delete-contact');
      if (deleteBtn) deleteBtn.addEventListener('click', function () {
        if (confirm('Permanently delete this contact? This cannot be undone.')) {
          TourOS.deleteEntity('contacts', contact.id);
          toast('Contact deleted', 'success');
          closeSheet(sheetId);
          renderPeople();
        }
      });
    }

    bindDetailEvents();
  }

  /** Open Add Note modal for a contact */
  function openAddNoteModal(contactId, onClose) {
    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Date</label>';
    html += '<input type="date" class="form-input" id="ct-note-date" value="' + todayStr() + '">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Note / Interaction *</label>';
    html += '<textarea class="form-textarea" id="ct-note-text" placeholder="e.g., Called about booking Aug 20. Following up next week."></textarea>';
    html += '<div class="ct-validation-msg" id="ct-note-err">Note text is required</div>';
    html += '</div>';

    html += '<div class="ct-form-actions">';
    html += '<button class="btn btn-secondary" data-close-sheet="add-note">Cancel</button>';
    html += '<button class="btn btn-primary" id="ct-note-save">💾 Save Note</button>';
    html += '</div>';

    openSheet('add-note', html, { title: 'Add Note / Interaction' });

    var sheet = document.getElementById('ct-sheet-add-note');
    if (!sheet) return;

    var saveBtn = sheet.querySelector('#ct-note-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var date = sheet.querySelector('#ct-note-date').value;
      var text = sheet.querySelector('#ct-note-text').value.trim();
      var errEl = sheet.querySelector('#ct-note-err');

      if (!text) {
        sheet.querySelector('#ct-note-text').classList.add('invalid');
        if (errEl) errEl.classList.add('show');
        return;
      }

      var contact = TourOS.getEntity('contacts', contactId);
      if (!contact) { toast('Contact not found', 'error'); return; }

      // Build interaction_history array
      var history = contact.interaction_history || [];
      history.push({ date: date || todayStr(), text: text });

      // Also update notes as array if it was a string
      var notes = contact.notes;
      if (typeof notes === 'string' || notes == null) {
        notes = [];
      }
      if (Array.isArray(notes)) {
        notes.push({ date: date || todayStr(), text: text });
      }

      TourOS.updateEntity('contacts', contactId, {
        interaction_history: history,
        notes: notes,
        last_contacted_date: date || todayStr()
      });

      toast('Note added', 'success');
      closeSheet('add-note');
      if (onClose) onClose();
    });
  }

  /** Open contact add/create form */
  function openContactForm() {
    var currentStop = TourOS.getCurrentStop();
    var stopId = currentStop ? currentStop.id : '';

    var html = '';

    // Name (required)
    html += '<div class="form-group">';
    html += '<label class="form-label">Name *</label>';
    html += '<input type="text" class="form-input" id="cf-name" placeholder="Jane Smith" data-required="1">';
    html += '<div class="ct-validation-msg" id="cf-err-name">Name is required</div>';
    html += '</div>';

    // Role
    html += '<div class="form-group">';
    html += '<label class="form-label">Role</label>';
    html += '<select class="form-select" id="cf-role">';
    html += '<option value="">— Select role —</option>';
    ['Venue Booker', 'House Concert Host', 'Lead', 'Attendee', 'Fan', 'Other'].forEach(function (r) {
      html += '<option value="' + r + '">' + r + '</option>';
    });
    html += '</select>';
    html += '</div>';

    // Phone
    html += '<div class="form-group">';
    html += '<label class="form-label">Phone</label>';
    html += '<input type="tel" class="form-input" id="cf-phone" placeholder="0411 000 000">';
    html += '</div>';

    // Email
    html += '<div class="form-group">';
    html += '<label class="form-label">Email</label>';
    html += '<input type="email" class="form-input" id="cf-email" placeholder="name@example.com">';
    html += '</div>';

    // Org
    html += '<div class="form-group">';
    html += '<label class="form-label">Organization</label>';
    html += '<input type="text" class="form-input" id="cf-org" placeholder="The Irish Rose">';
    html += '</div>';

    // City
    html += '<div class="form-group">';
    html += '<label class="form-label">City</label>';
    html += '<input type="text" class="form-input" id="cf-city" placeholder="Perth">';
    html += '</div>';

    // Tags
    html += '<div class="form-group">';
    html += '<label class="form-label">Tags (comma-separated)</label>';
    html += '<input type="text" class="form-input" id="cf-tags" placeholder="venue_booker, repeat_referrer">';
    html += '</div>';

    // Linked entity type
    html += '<div class="form-group">';
    html += '<label class="form-label">Link to Entity</label>';
    html += '<select class="form-select" id="cf-link-type">';
    html += '<option value="">— None —</option>';
    html += '<option value="venue">Venue</option>';
    html += '<option value="house_concert">House Concert</option>';
    html += '<option value="busking_spot">Busking Spot</option>';
    html += '</select>';
    html += '</div>';

    // Linked entity ID (dynamic based on type)
    html += '<div class="form-group" id="cf-link-id-wrap" style="display:none;">';
    html += '<label class="form-label">Select Entity</label>';
    html += '<select class="form-select" id="cf-link-id"></select>';
    html += '</div>';

    // Source
    html += '<div class="form-group">';
    html += '<label class="form-label">Source</label>';
    html += '<input type="text" class="form-input" id="cf-source" placeholder="How did you find this contact?">';
    html += '</div>';

    // Actions
    html += '<div class="ct-form-actions">';
    html += '<button class="btn btn-secondary" data-close-sheet="contact-form">Cancel</button>';
    html += '<button class="btn btn-primary" id="cf-save-another">💾 Save & Add Another</button>';
    html += '<button class="btn btn-primary" id="cf-save">💾 Save</button>';
    html += '</div>';

    openSheet('contact-form', html, { title: 'Add Contact' });

    var sheet = document.getElementById('ct-sheet-contact-form');
    if (!sheet) return;

    // Dynamic linked entity dropdown
    var linkTypeSelect = sheet.querySelector('#cf-link-type');
    var linkIdWrap = sheet.querySelector('#cf-link-id-wrap');
    var linkIdSelect = sheet.querySelector('#cf-link-id');

    linkTypeSelect.addEventListener('change', function () {
      var type = linkTypeSelect.value;
      if (!type) {
        linkIdWrap.style.display = 'none';
        return;
      }
      linkIdWrap.style.display = 'block';
      var entities = TourOS.getAllEntities(type);
      linkIdSelect.innerHTML = '<option value="">— Select —</option>';
      entities.forEach(function (e) {
        var name = e.name || e.host_name || e.id;
        linkIdSelect.innerHTML += '<option value="' + esc(e.id) + '">' + esc(name) + '</option>';
      });
    });

    function saveContact(addAnother) {
      var name = sheet.querySelector('#cf-name').value.trim();
      if (!name) {
        sheet.querySelector('#cf-name').classList.add('invalid');
        sheet.querySelector('#cf-err-name').classList.add('show');
        return;
      }

      var tags = sheet.querySelector('#cf-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      var linkType = sheet.querySelector('#cf-link-type').value;
      var linkId = linkType ? sheet.querySelector('#cf-link-id').value : '';

      var contactData = {
        name: name,
        role: sheet.querySelector('#cf-role').value,
        phone: sheet.querySelector('#cf-phone').value.trim(),
        email: sheet.querySelector('#cf-email').value.trim(),
        org: sheet.querySelector('#cf-org').value.trim(),
        city: sheet.querySelector('#cf-city').value.trim(),
        tags: tags,
        source: sheet.querySelector('#cf-source').value.trim(),
        linked_entity_type: linkType || null,
        linked_entity_id: linkId || null,
        notes: [],
        interaction_history: [],
        last_contacted_date: null,
        status: 'active'
      };

      TourOS.createEntity('contacts', contactData);
      toast('Contact saved: ' + name, 'success');
      renderPeople();

      if (addAnother) {
        // Reset form
        sheet.querySelectorAll('input, textarea').forEach(function (el) { el.value = ''; });
        sheet.querySelector('#cf-role').value = '';
        sheet.querySelector('#cf-link-type').value = '';
        linkIdWrap.style.display = 'none';
        sheet.querySelector('#cf-name').focus();
      } else {
        closeSheet('contact-form');
      }
    }

    sheet.querySelector('#cf-save').addEventListener('click', function () { saveContact(false); });
    sheet.querySelector('#cf-save-another').addEventListener('click', function () { saveContact(true); });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 4: CREATE SHEET (FAB)
     ═══════════════════════════════════════════════════════════════════════ */

  /** Open the Create Sheet (FAB overlay) */
  function openCreateSheet() {
    var html = '';

    // Tier 1: Quick Log
    html += '<div class="cs-section-label">Quick Log</div>';
    html += '<div class="cs-grid">';
    html += '<button class="cs-btn cs-big cs-green" data-create="busking">🟢<span class="cs-btn-label">Log Busking</span></button>';
    html += '<button class="cs-btn cs-big cs-blue" data-create="gig-income">🔵<span class="cs-btn-label">Log Gig Income</span></button>';
    html += '<button class="cs-btn cs-big cs-red" data-create="expense">🔴<span class="cs-btn-label">Log Expense</span></button>';
    html += '</div>';

    // Tier 2: Pipeline
    html += '<div class="cs-section-label">Pipeline</div>';
    html += '<div class="cs-grid">';
    html += '<button class="cs-btn" data-create="venue">🏢<span class="cs-btn-label">Add Venue</span></button>';
    html += '<button class="cs-btn" data-create="house-concert">🏠<span class="cs-btn-label">Add House Concert</span></button>';
    html += '<button class="cs-btn" data-create="busking-spot">📍<span class="cs-btn-label">Add Busking Spot</span></button>';
    html += '</div>';

    // Tier 3: Manage
    html += '<div class="cs-section-label">Manage</div>';
    html += '<div class="cs-grid">';
    html += '<button class="cs-btn" data-create="tour-stop">🗺️<span class="cs-btn-label">Add Tour Stop</span></button>';
    html += '<button class="cs-btn" data-create="contact">👤<span class="cs-btn-label">Add Contact</span></button>';
    html += '<button class="cs-btn" data-create="todo">✅<span class="cs-btn-label">Add Todo</span></button>';
    html += '<button class="cs-btn" data-create="quick-note">📝<span class="cs-btn-label">Quick Note</span></button>';
    html += '</div>';

    openSheet('create', html, {});

    // Bind create buttons
    var sheet = document.getElementById('ct-sheet-create');
    if (!sheet) return;

    sheet.querySelectorAll('[data-create]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-create');
        closeSheet('create');
        // Small delay for sheet close animation
        setTimeout(function () {
          switch (type) {
            case 'busking': openBuskingSessionModal(); break;
            case 'gig-income': openGigIncomeModal(); break;
            case 'expense': openExpenseModal(); break;
            case 'venue': openVenueAddModal(); break;
            case 'house-concert': openHCAddModal(); break;
            case 'busking-spot': openSpotAddModal(); break;
            case 'tour-stop': openStopAddModal(); break;
            case 'contact': openContactForm(); break;
            case 'todo': openTodoAddModal(); break;
            case 'quick-note': openQuickNoteModal(); break;
          }
        }, 200);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 4A: QUICK LOG FORMS
     ═══════════════════════════════════════════════════════════════════════ */

  /** Log Busking Session modal */
  function openBuskingSessionModal() {
    var currentStop = TourOS.getCurrentStop();
    var stopId = currentStop ? currentStop.id : '';
    var spots = TourOS.getAllEntities('busking_spots');

    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Date *</label>';
    html += '<input type="date" class="form-input" id="bsk-date" value="' + todayStr() + '">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Busking Spot *</label>';
    html += '<select class="form-select" id="bsk-spot" data-required="1">';
    html += '<option value="">— Select spot —</option>';
    spots.forEach(function (s) {
      html += '<option value="' + esc(s.id) + '">' + esc(s.name) + (s.city ? ' (' + esc(s.city) + ')' : '') + '</option>';
    });
    html += '</select>';
    html += '<div class="ct-validation-msg" id="bsk-err-spot">Please select a spot</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Duration (minutes)</label>';
    html += '<input type="number" class="form-input" id="bsk-duration" value="120" min="0">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Earnings ($) *</label>';
    html += '<input type="number" class="form-input" id="bsk-earnings" placeholder="0.00" step="0.01" data-required="1">';
    html += '<div class="ct-validation-msg" id="bsk-err-earnings">Enter earnings amount</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Merch Sales ($)</label>';
    html += '<input type="number" class="form-input" id="bsk-merch" value="0" step="0.01">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Payment Method</label>';
    html += '<select class="form-select" id="bsk-payment">';
    ['cash', 'card', 'transfer', 'mixed'].forEach(function (m) {
      html += '<option value="' + m + '">' + m.charAt(0).toUpperCase() + m.slice(1) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Notes</label>';
    html += '<textarea class="form-textarea" id="bsk-notes" placeholder="Good crowd, lunch rush..."></textarea>';
    html += '</div>';

    html += _formActions('bsk');
    openSheet('busking-session', html, { title: '🟢 Log Busking Session' });
    _bindSaveHandler('bsk', 'busking-session', saveBuskingSession);
  }

  function saveBuskingSession(addAnother) {
    var sheet = document.getElementById('ct-sheet-busking-session');
    if (!sheet) return false;

    var spotId = sheet.querySelector('#bsk-spot').value;
    var earnings = parseFloat(sheet.querySelector('#bsk-earnings').value);

    if (!spotId) {
      sheet.querySelector('#bsk-spot').classList.add('invalid');
      sheet.querySelector('#bsk-err-spot').classList.add('show');
      return false;
    }
    if (!earnings || isNaN(earnings)) {
      sheet.querySelector('#bsk-earnings').classList.add('invalid');
      sheet.querySelector('#bsk-err-earnings').classList.add('show');
      return false;
    }

    var currentStop = TourOS.getCurrentStop();
    var date = sheet.querySelector('#bsk-date').value || todayStr();
    var duration = parseInt(sheet.querySelector('#bsk-duration').value) || 0;
    var merch = parseFloat(sheet.querySelector('#bsk-merch').value) || 0;
    var payment = sheet.querySelector('#bsk-payment').value;
    var notes = sheet.querySelector('#bsk-notes').value.trim();
    var spot = TourOS.getEntity('busking_spots', spotId);

    // Create income_log entry
    var income = TourOS.createEntity('income_log', {
      date: date,
      type: 'busking',
      amount: earnings,
      source_entity_type: 'busking_spot',
      source_entity_id: spotId,
      tour_stop_id: spot ? spot.tour_stop_id : (currentStop ? currentStop.id : null),
      payment_method: payment,
      merch_sales: merch,
      notes: notes
    });

    // Create session entry on the busking spot
    var session = {
      id: TourOS.generateId('ses'),
      date: date,
      duration_minutes: duration,
      earnings: earnings,
      merch_sales: merch,
      notes: notes,
      income_id: income.id
    };

    var sessions = (spot.sessions || []).slice();
    sessions.push(session);

    // Recalculate stats
    var totalEarnings = sessions.reduce(function (s, ss) { return s + (ss.earnings || 0); }, 0);
    var totalSessions = sessions.length;
    var avgEarnings = totalSessions > 0 ? totalEarnings / totalSessions : 0;

    TourOS.updateEntity('busking_spots', spotId, {
      sessions: sessions,
      earnings_stats: {
        total_earnings: totalEarnings,
        total_sessions: totalSessions,
        avg_earnings: avgEarnings
      }
    });

    // Recalculate stop
    if (spot && spot.tour_stop_id) TourOS.recalculateStop(spot.tour_stop_id);

    toast('Busking session logged: $' + earnings.toFixed(2), 'success');
    return true;
  }

  /** Log Gig Income modal */
  function openGigIncomeModal() {
    var venues = TourOS.getAllEntities('venues').filter(function (v) {
      return v.stage === 'booked' || v.stage === 'confirmed' || v.stage === 'played';
    });
    var currentStop = TourOS.getCurrentStop();

    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Date *</label>';
    html += '<input type="date" class="form-input" id="gi-date" value="' + todayStr() + '">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Venue</label>';
    html += '<select class="form-select" id="gi-venue">';
    html += '<option value="">— Select venue (optional) —</option>';
    venues.forEach(function (v) {
      html += '<option value="' + esc(v.id) + '">' + esc(v.name) + (v.city ? ' (' + esc(v.city) + ')' : '') + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Amount ($) *</label>';
    html += '<input type="number" class="form-input" id="gi-amount" placeholder="400.00" step="0.01" data-required="1">';
    html += '<div class="ct-validation-msg" id="gi-err-amount">Enter amount</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Merch Sales ($)</label>';
    html += '<input type="number" class="form-input" id="gi-merch" value="0" step="0.01">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Payment Method</label>';
    html += '<select class="form-select" id="gi-payment">';
    ['cash', 'transfer', 'card', 'mixed'].forEach(function (m) {
      html += '<option value="' + m + '">' + m.charAt(0).toUpperCase() + m.slice(1) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Notes</label>';
    html += '<textarea class="form-textarea" id="gi-notes" placeholder="Great crowd, sold out..."></textarea>';
    html += '</div>';

    html += _formActions('gi');
    openSheet('gig-income', html, { title: '🔵 Log Gig Income' });
    _bindSaveHandler('gi', 'gig-income', saveGigIncome);
  }

  function saveGigIncome(addAnother) {
    var sheet = document.getElementById('ct-sheet-gig-income');
    if (!sheet) return false;

    var amount = parseFloat(sheet.querySelector('#gi-amount').value);
    if (!amount || isNaN(amount)) {
      sheet.querySelector('#gi-amount').classList.add('invalid');
      sheet.querySelector('#gi-err-amount').classList.add('show');
      return false;
    }

    var venueId = sheet.querySelector('#gi-venue').value;
    var venue = venueId ? TourOS.getEntity('venues', venueId) : null;
    var currentStop = TourOS.getCurrentStop();

    TourOS.createEntity('income_log', {
      date: sheet.querySelector('#gi-date').value || todayStr(),
      type: 'gig_income',
      amount: amount,
      source_entity_type: venueId ? 'venue' : null,
      source_entity_id: venueId || null,
      tour_stop_id: venue ? venue.tour_stop_id : (currentStop ? currentStop.id : null),
      payment_method: sheet.querySelector('#gi-payment').value,
      merch_sales: parseFloat(sheet.querySelector('#gi-merch').value) || 0,
      notes: sheet.querySelector('#gi-notes').value.trim()
    });

    if (venue && venue.tour_stop_id) TourOS.recalculateStop(venue.tour_stop_id);

    toast('Gig income logged: $' + amount.toFixed(2), 'success');
    return true;
  }

  /** Log Expense modal */
  function openExpenseModal() {
    var currentStop = TourOS.getCurrentStop();
    var categories = ['fuel', 'accommodation', 'food', 'gear', 'maverick', 'marketing', 'vehicle_maintenance', 'misc'];

    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Date *</label>';
    html += '<input type="date" class="form-input" id="ex-date" value="' + todayStr() + '">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Category *</label>';
    html += '<select class="form-select" id="ex-category" data-required="1">';
    categories.forEach(function (c) {
      var icon = { fuel: '⛽', accommodation: '🏨', food: '🍔', gear: '🎛️', maverick: '🐕', marketing: '📢', vehicle_maintenance: '🔧', misc: '📦' }[c] || '';
      html += '<option value="' + c + '">' + icon + ' ' + c.replace(/_/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Amount ($) *</label>';
    html += '<input type="number" class="form-input" id="ex-amount" placeholder="0.00" step="0.01" data-required="1">';
    html += '<div class="ct-validation-msg" id="ex-err-amount">Enter amount</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Description</label>';
    html += '<input type="text" class="form-input" id="ex-desc" placeholder="Diesel fill-up">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Odometer (km)</label>';
    html += '<input type="number" class="form-input" id="ex-odo" placeholder="45230">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Receipt Ref</label>';
    html += '<input type="text" class="form-input" id="ex-receipt" placeholder="Receipt # or photo ref">';
    html += '</div>';

    html += _formActions('ex');
    openSheet('expense', html, { title: '🔴 Log Expense' });
    _bindSaveHandler('ex', 'expense', saveExpense);
  }

  function saveExpense(addAnother) {
    var sheet = document.getElementById('ct-sheet-expense');
    if (!sheet) return false;

    var amount = parseFloat(sheet.querySelector('#ex-amount').value);
    if (!amount || isNaN(amount)) {
      sheet.querySelector('#ex-amount').classList.add('invalid');
      sheet.querySelector('#ex-err-amount').classList.add('show');
      return false;
    }

    var currentStop = TourOS.getCurrentStop();
    var category = sheet.querySelector('#ex-category').value;
    var odo = sheet.querySelector('#ex-odo').value;

    TourOS.createEntity('expense_log', {
      date: sheet.querySelector('#ex-date').value || todayStr(),
      category: category,
      amount: amount,
      description: sheet.querySelector('#ex-desc').value.trim(),
      tour_stop_id: currentStop ? currentStop.id : null,
      odometer: odo ? parseInt(odo) : null,
      vehicle_related: category === 'fuel' || category === 'vehicle_maintenance',
      receipt_ref: sheet.querySelector('#ex-receipt').value.trim()
    });

    if (currentStop) TourOS.recalculateStop(currentStop.id);

    toast('Expense logged: $' + amount.toFixed(2), 'success');
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 4B: PIPELINE ENTITY FORMS
     ═══════════════════════════════════════════════════════════════════════ */

  /** Add Venue modal */
  function openVenueAddModal() {
    var currentStop = TourOS.getCurrentStop();
    var stops = TourOS.getAllEntities('tour_stops');

    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Venue Name *</label>';
    html += '<input type="text" class="form-input" id="vn-name" placeholder="The Irish Rose" data-required="1">';
    html += '<div class="ct-validation-msg" id="vn-err-name">Name is required</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Type</label>';
    html += '<select class="form-select" id="vn-type">';
    ['Irish Pub', 'Live Music Venue', 'Cafe', 'Bar', 'Hotel', 'Club', 'Festival', 'Other'].forEach(function (t) {
      html += '<option value="' + t + '">' + t + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">City</label>';
    html += '<input type="text" class="form-input" id="vn-city" value="' + esc(currentStop ? currentStop.name : '') + '">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">State</label>';
    html += '<input type="text" class="form-input" id="vn-state" value="' + esc(currentStop ? currentStop.state : '') + '">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Contact Name</label>';
    html += '<input type="text" class="form-input" id="vn-contact" placeholder="Dave O\'Brien">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Phone</label>';
    html += '<input type="tel" class="form-input" id="vn-phone" placeholder="(08) 9221 1234">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Email</label>';
    html += '<input type="email" class="form-input" id="vn-email" placeholder="bookings@venue.com">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Priority</label>';
    html += '<select class="form-select" id="vn-priority">';
    html += '<option value="high">High</option>';
    html += '<option value="medium" selected>Medium</option>';
    html += '<option value="low">Low</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Tour Stop</label>';
    html += '<select class="form-select" id="vn-stop">';
    stops.forEach(function (s) {
      var sel = currentStop && s.id === currentStop.id ? ' selected' : '';
      html += '<option value="' + esc(s.id) + '"' + sel + '>' + esc(s.name) + ' (' + esc(s.state) + ')</option>';
    });
    html += '</select>';
    html += '</div>';

    html += _formActions('vn');
    openSheet('venue-add', html, { title: '🏢 Add Venue' });
    _bindSaveHandler('vn', 'venue-add', saveVenue);
  }

  function saveVenue(addAnother) {
    var sheet = document.getElementById('ct-sheet-venue-add');
    if (!sheet) return false;

    var name = sheet.querySelector('#vn-name').value.trim();
    if (!name) {
      sheet.querySelector('#vn-name').classList.add('invalid');
      sheet.querySelector('#vn-err-name').classList.add('show');
      return false;
    }

    var stopId = sheet.querySelector('#vn-stop').value;
    var contactName = sheet.querySelector('#vn-contact').value.trim();

    // Create contact if contact name provided
    var contactId = null;
    if (contactName) {
      var contact = TourOS.createEntity('contacts', {
        name: contactName,
        role: 'Venue Booker',
        phone: sheet.querySelector('#vn-phone').value.trim(),
        email: sheet.querySelector('#vn-email').value.trim(),
        org: name,
        city: sheet.querySelector('#vn-city').value.trim(),
        tags: ['venue_booker'],
        source: '',
        linked_entity_type: 'venue',
        linked_entity_id: null, // will set after venue created
        notes: [],
        interaction_history: [],
        last_contacted_date: null,
        status: 'active'
      });
      contactId = contact.id;
    }

    var venue = TourOS.createEntity('venues', {
      name: name,
      phone: sheet.querySelector('#vn-phone').value.trim(),
      email: sheet.querySelector('#vn-email').value.trim(),
      contact_name: contactName,
      contact_id: contactId,
      type: sheet.querySelector('#vn-type').value,
      city: sheet.querySelector('#vn-city').value.trim(),
      state: sheet.querySelector('#vn-state').value.trim(),
      priority: sheet.querySelector('#vn-priority').value,
      tour_stop_id: stopId,
      stage: 'not_contacted',
      stage_history: [{ stage: 'not_contacted', date: todayStr(), notes: 'Added to pipeline' }],
      follow_up_count: 0,
      first_contacted_date: null,
      gig: null,
      marketing: { epk_sent: false, epk_sent_date: null, media_pack_sent: false, media_pack_sent_date: null, tcs_sent: false, tcs_sent_date: null, reels_captured: false, venue_tagged: false, content_notes: '' },
      decline_reason: null,
      tags: [],
      status: 'active'
    });

    // Link contact to venue
    if (contactId) {
      TourOS.updateEntity('contacts', contactId, {
        linked_entity_id: venue.id
      });
    }

    // Add venue to stop's venue_ids
    var stop = TourOS.getEntity('tour_stops', stopId);
    if (stop) {
      var venueIds = (stop.venue_ids || []).slice();
      venueIds.push(venue.id);
      TourOS.updateEntity('tour_stops', stopId, { venue_ids: venueIds });
    }

    toast('Venue added: ' + name, 'success');
    return true;
  }

  /** Add House Concert modal */
  function openHCAddModal() {
    var currentStop = TourOS.getCurrentStop();
    var stops = TourOS.getAllEntities('tour_stops');

    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Host Name *</label>';
    html += '<input type="text" class="form-input" id="hc-host" placeholder="Sarah Mitchell" data-required="1">';
    html += '<div class="ct-validation-msg" id="hc-err-host">Host name is required</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Host Phone</label>';
    html += '<input type="tel" class="form-input" id="hc-phone" placeholder="0411 000 000">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Host Email</label>';
    html += '<input type="email" class="form-input" id="hc-email" placeholder="host@example.com">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Source</label>';
    html += '<input type="text" class="form-input" id="hc-source" placeholder="Facebook Group">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Source Detail</label>';
    html += '<input type="text" class="form-input" id="hc-source-detail" placeholder="Perth Live Music Lovers">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Tour Stop</label>';
    html += '<select class="form-select" id="hc-stop">';
    stops.forEach(function (s) {
      var sel = currentStop && s.id === currentStop.id ? ' selected' : '';
      html += '<option value="' + esc(s.id) + '"' + sel + '>' + esc(s.name) + ' (' + esc(s.state) + ')</option>';
    });
    html += '</select>';
    html += '</div>';

    html += _formActions('hc');
    openSheet('hc-add', html, { title: '🏠 Add House Concert' });
    _bindSaveHandler('hc', 'hc-add', saveHC);
  }

  function saveHC(addAnother) {
    var sheet = document.getElementById('ct-sheet-hc-add');
    if (!sheet) return false;

    var hostName = sheet.querySelector('#hc-host').value.trim();
    if (!hostName) {
      sheet.querySelector('#hc-host').classList.add('invalid');
      sheet.querySelector('#hc-err-host').classList.add('show');
      return false;
    }

    var stopId = sheet.querySelector('#hc-stop').value;
    var phone = sheet.querySelector('#hc-phone').value.trim();
    var email = sheet.querySelector('#hc-email').value.trim();

    // Create contact for host
    var contactId = null;
    if (hostName) {
      var contact = TourOS.createEntity('contacts', {
        name: hostName,
        role: 'House Concert Host',
        phone: phone,
        email: email,
        org: '',
        city: '',
        tags: ['host'],
        source: sheet.querySelector('#hc-source').value.trim(),
        linked_entity_type: 'house_concert',
        linked_entity_id: null,
        notes: [],
        interaction_history: [],
        last_contacted_date: null,
        status: 'active'
      });
      contactId = contact.id;
    }

    var hc = TourOS.createEntity('house_concerts', {
      host_name: hostName,
      host_contact_id: contactId,
      source: sheet.querySelector('#hc-source').value.trim(),
      source_detail: sheet.querySelector('#hc-source-detail').value.trim(),
      tour_stop_id: stopId,
      stage: 'posted',
      stage_history: [{ stage: 'posted', date: todayStr(), notes: 'Added to pipeline' }],
      event: null,
      marketing: { promo_kit_sent: false, promo_kit_sent_date: null, invite_generated: false, invite_url: null, host_posted_socials: false, reels_captured: false, content_notes: '' },
      tags: [],
      status: 'active'
    });

    // Link contact
    if (contactId) {
      TourOS.updateEntity('contacts', contactId, { linked_entity_id: hc.id });
    }

    // Add to stop
    var stop = TourOS.getEntity('tour_stops', stopId);
    if (stop) {
      var hcIds = (stop.house_concert_ids || []).slice();
      hcIds.push(hc.id);
      TourOS.updateEntity('tour_stops', stopId, { house_concert_ids: hcIds });
    }

    toast('House Concert added: ' + hostName, 'success');
    return true;
  }

  /** Add Busking Spot modal */
  function openSpotAddModal() {
    var currentStop = TourOS.getCurrentStop();
    var stops = TourOS.getAllEntities('tour_stops');

    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Spot Name *</label>';
    html += '<input type="text" class="form-input" id="bs-name" placeholder="Raine Square" data-required="1">';
    html += '<div class="ct-validation-msg" id="bs-err-name">Name is required</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">City</label>';
    html += '<input type="text" class="form-input" id="bs-city" value="' + esc(currentStop ? currentStop.name : '') + '">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Address</label>';
    html += '<input type="text" class="form-input" id="bs-address" placeholder="3 Murray St, Perth WA">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Traffic Rating (1-5)</label>';
    html += '<input type="range" id="bs-traffic" min="1" max="5" value="3" style="width:100%;">';
    html += '<div id="bs-traffic-display" style="text-align:center;font-size:20px;color:var(--cyan);">⭐⭐⭐</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Permit Required?</label>';
    html += '<select class="form-select" id="bs-permit-req">';
    html += '<option value="false">No</option>';
    html += '<option value="true">Yes</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Best Time</label>';
    html += '<input type="text" class="form-input" id="bs-best-time" placeholder="Lunch 12-2pm">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Acoustics Notes</label>';
    html += '<textarea class="form-textarea" id="bs-acoustics" placeholder="Good natural reverb under archway..."></textarea>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Tour Stop</label>';
    html += '<select class="form-select" id="bs-stop">';
    stops.forEach(function (s) {
      var sel = currentStop && s.id === currentStop.id ? ' selected' : '';
      html += '<option value="' + esc(s.id) + '"' + sel + '>' + esc(s.name) + ' (' + esc(s.state) + ')</option>';
    });
    html += '</select>';
    html += '</div>';

    html += _formActions('bs');
    openSheet('spot-add', html, { title: '📍 Add Busking Spot' });
    _bindSaveHandler('bs', 'spot-add', saveSpot);

    // Traffic rating display
    var trafficInput = document.querySelector('#bs-traffic');
    var trafficDisplay = document.querySelector('#bs-traffic-display');
    if (trafficInput && trafficDisplay) {
      trafficInput.addEventListener('input', function () {
        var val = parseInt(trafficInput.value);
        trafficDisplay.textContent = '⭐'.repeat(val) + '☆'.repeat(5 - val);
      });
    }
  }

  function saveSpot(addAnother) {
    var sheet = document.getElementById('ct-sheet-spot-add');
    if (!sheet) return false;

    var name = sheet.querySelector('#bs-name').value.trim();
    if (!name) {
      sheet.querySelector('#bs-name').classList.add('invalid');
      sheet.querySelector('#bs-err-name').classList.add('show');
      return false;
    }

    var stopId = sheet.querySelector('#bs-stop').value;

    var spot = TourOS.createEntity('busking_spots', {
      name: name,
      city: sheet.querySelector('#bs-city').value.trim(),
      address: sheet.querySelector('#bs-address').value.trim(),
      traffic_rating: parseInt(sheet.querySelector('#bs-traffic').value) || 3,
      permit_required: sheet.querySelector('#bs-permit-req').value === 'true',
      permit_obtained: false,
      best_time: sheet.querySelector('#bs-best-time').value.trim(),
      acoustics_notes: sheet.querySelector('#bs-acoustics').value.trim(),
      tour_stop_id: stopId,
      status: 'discovered',
      sessions: [],
      earnings_stats: { total_earnings: 0, total_sessions: 0, avg_earnings: 0 },
      tags: []
    });

    // Add to stop
    var stop = TourOS.getEntity('tour_stops', stopId);
    if (stop) {
      var spotIds = (stop.busking_spot_ids || []).slice();
      spotIds.push(spot.id);
      TourOS.updateEntity('tour_stops', stopId, { busking_spot_ids: spotIds });
    }

    toast('Busking spot added: ' + name, 'success');
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 4C: MANAGE ENTITY FORMS
     ═══════════════════════════════════════════════════════════════════════ */

  /** Add Tour Stop modal */
  function openStopAddModal() {
    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Stop Name *</label>';
    html += '<input type="text" class="form-input" id="ts-name" placeholder="Perth" data-required="1">';
    html += '<div class="ct-validation-msg" id="ts-err-name">Name is required</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">State</label>';
    html += '<input type="text" class="form-input" id="ts-state" placeholder="WA">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Segment</label>';
    html += '<select class="form-select" id="ts-segment">';
    html += '<option value="WA Loop">WA Loop</option>';
    html += '<option value="SA Crossing">SA Crossing</option>';
    html += '<option value="VIC Run">VIC Run</option>';
    html += '<option value="NSW Coast">NSW Coast</option>';
    html += '<option value="QLD Finale">QLD Finale</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Arrival Date</label>';
    html += '<input type="date" class="form-input" id="ts-arrival">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Departure Date</label>';
    html += '<input type="date" class="form-input" id="ts-departure">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Status</label>';
    html += '<select class="form-select" id="ts-status">';
    html += '<option value="planned">Planned</option>';
    html += '<option value="current">Current</option>';
    html += '<option value="completed">Completed</option>';
    html += '</select>';
    html += '</div>';

    html += _formActions('ts');
    openSheet('stop-add', html, { title: '🗺️ Add Tour Stop' });
    _bindSaveHandler('ts', 'stop-add', saveStop);
  }

  function saveStop(addAnother) {
    var sheet = document.getElementById('ct-sheet-stop-add');
    if (!sheet) return false;

    var name = sheet.querySelector('#ts-name').value.trim();
    if (!name) {
      sheet.querySelector('#ts-name').classList.add('invalid');
      sheet.querySelector('#ts-err-name').classList.add('show');
      return false;
    }

    var status = sheet.querySelector('#ts-status').value;

    // If setting as current, demote existing current
    if (status === 'current') {
      TourOS.getAllEntities('tour_stops').forEach(function (s) {
        if (s.status === 'current') {
          TourOS.updateEntity('tour_stops', s.id, { status: 'completed' });
        }
      });
    }

    TourOS.createEntity('tour_stops', {
      name: name,
      state: sheet.querySelector('#ts-state').value.trim(),
      segment: sheet.querySelector('#ts-segment').value,
      arrival_date: sheet.querySelector('#ts-arrival').value,
      departure_date: sheet.querySelector('#ts-departure').value,
      status: status,
      targets: { busking_sessions: 0, busking_earnings: 0, gigs: 0, gig_earnings: 0, hc_shows: 0, hc_earnings: 0 },
      actuals: { busking_sessions: 0, busking_earnings: 0, gigs_played: 0, gig_earnings: 0, hc_completed: 0, hc_earnings: 0 },
      venue_ids: [], house_concert_ids: [], busking_spot_ids: [],
      notes: ''
    });

    toast('Tour stop added: ' + name, 'success');
    return true;
  }

  /** Add Todo modal */
  function openTodoAddModal() {
    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Task *</label>';
    html += '<textarea class="form-textarea" id="td-text" placeholder="Follow up with The Irish Rose" data-required="1"></textarea>';
    html += '<div class="ct-validation-msg" id="td-err-text">Task is required</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Category</label>';
    html += '<select class="form-select" id="td-category">';
    ['venue', 'house_concert', 'busking', 'content', 'vehicle', 'ops', 'personal'].forEach(function (c) {
      html += '<option value="' + c + '">' + c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ') + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Priority</label>';
    html += '<select class="form-select" id="td-priority">';
    html += '<option value="high">🔴 High</option>';
    html += '<option value="medium" selected>🟡 Medium</option>';
    html += '<option value="low">🟢 Low</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Due Date</label>';
    html += '<input type="date" class="form-input" id="td-due" value="' + todayStr() + '">';
    html += '</div>';

    html += _formActions('td');
    openSheet('todo-add', html, { title: '✅ Add Todo' });
    _bindSaveHandler('td', 'todo-add', saveTodo);
  }

  function saveTodo(addAnother) {
    var sheet = document.getElementById('ct-sheet-todo-add');
    if (!sheet) return false;

    var text = sheet.querySelector('#td-text').value.trim();
    if (!text) {
      sheet.querySelector('#td-text').classList.add('invalid');
      sheet.querySelector('#td-err-text').classList.add('show');
      return false;
    }

    TourOS.createEntity('todos', {
      text: text,
      category: sheet.querySelector('#td-category').value,
      priority: sheet.querySelector('#td-priority').value,
      due_date: sheet.querySelector('#td-due').value || null,
      completed: false,
      completed_at: null,
      auto_generated: false,
      source_entity_type: null,
      source_entity_id: null
    });

    toast('Todo added', 'success');
    return true;
  }

  /** Quick Note modal (creates a todo with category "note") */
  function openQuickNoteModal() {
    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Quick Note *</label>';
    html += '<textarea class="form-textarea" id="qn-text" placeholder="Jot something down..." style="min-height:120px;" data-required="1"></textarea>';
    html += '<div class="ct-validation-msg" id="qn-err-text">Note text is required</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Priority</label>';
    html += '<select class="form-select" id="qn-priority">';
    html += '<option value="high">🔴 High</option>';
    html += '<option value="medium" selected>🟡 Medium</option>';
    html += '<option value="low">🟢 Low</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Due Date (optional)</label>';
    html += '<input type="date" class="form-input" id="qn-due">';
    html += '</div>';

    html += _formActions('qn');
    openSheet('quick-note', html, { title: '📝 Quick Note' });
    _bindSaveHandler('qn', 'quick-note', saveQuickNote);
  }

  function saveQuickNote(addAnother) {
    var sheet = document.getElementById('ct-sheet-quick-note');
    if (!sheet) return false;

    var text = sheet.querySelector('#qn-text').value.trim();
    if (!text) {
      sheet.querySelector('#qn-text').classList.add('invalid');
      sheet.querySelector('#qn-err-text').classList.add('show');
      return false;
    }

    TourOS.createEntity('todos', {
      text: text,
      category: 'note',
      priority: sheet.querySelector('#qn-priority').value,
      due_date: sheet.querySelector('#qn-due').value || null,
      completed: false,
      completed_at: null,
      auto_generated: false,
      source_entity_type: null,
      source_entity_id: null
    });

    toast('Note saved', 'success');
    return true;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 4D: FORM HELPER UTILITIES
     ═══════════════════════════════════════════════════════════════════════ */

  /** Generate standard form action buttons (Save, Save & Add Another, Cancel) */
  function _formActions(prefix) {
    return '<div class="ct-form-actions">' +
      '<button class="btn btn-secondary" data-close-sheet="' + prefix + '-form">Cancel</button>' +
      '<button class="btn btn-primary" id="' + prefix + '-save-another">+ & Save</button>' +
      '<button class="btn btn-primary" id="' + prefix + '-save">💾 Save</button>' +
      '</div>';
  }

  /** Bind save buttons for a form. Calls saveFn(addAnother) which returns true on success. */
  function _bindSaveHandler(prefix, sheetId, saveFn) {
    // Map sheetId to the close-sheet ID used in _formActions
    var closeSheetId = prefix + '-form';

    // The _formActions uses data-close-sheet="PREFIX-form" but openSheet uses the sheetId
    // We need to fix: the sheet was opened with id=sheetId, but cancel button references prefix-form
    // Let's fix the cancel buttons to close the correct sheet
    var sheet = document.getElementById('ct-sheet-' + sheetId);
    if (!sheet) return;

    // Fix cancel button close-sheet references
    sheet.querySelectorAll('[data-close-sheet="' + closeSheetId + '"]').forEach(function (btn) {
      btn.setAttribute('data-close-sheet', sheetId);
    });

    var saveBtn = sheet.querySelector('#' + prefix + '-save');
    var saveAnotherBtn = sheet.querySelector('#' + prefix + '-save-another');

    function handleSave(addAnother) {
      var success = saveFn(addAnother);
      if (success) {
        if (addAnother) {
          // Reset required fields
          sheet.querySelectorAll('input, textarea').forEach(function (el) {
            if (el.type !== 'select' && el.type !== 'button') el.value = '';
          });
          // Re-set defaults
          var dateField = sheet.querySelector('input[type="date"]');
          if (dateField && !dateField.value) dateField.value = todayStr();
        } else {
          closeSheet(sheetId);
        }
      }
    }

    if (saveBtn) saveBtn.addEventListener('click', function () { handleSave(false); });
    if (saveAnotherBtn) saveAnotherBtn.addEventListener('click', function () { handleSave(true); });
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 5: GLOBAL SEARCH
     ═══════════════════════════════════════════════════════════════════════ */

  var SEARCH_RECENTS_KEY = 'tourOS_v3_recent_searches';

  function getRecentSearches() {
    try {
      var stored = localStorage.getItem(SEARCH_RECENTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function addRecentSearch(query) {
    if (!query || query.length < 2) return;
    var recents = getRecentSearches();
    // Remove duplicates
    recents = recents.filter(function (r) { return r.toLowerCase() !== query.toLowerCase(); });
    recents.unshift(query);
    // Keep last 8
    recents = recents.slice(0, 8);
    try {
      localStorage.setItem(SEARCH_RECENTS_KEY, JSON.stringify(recents));
    } catch (e) { /* ignore */ }
  }

  /** Open the global search overlay */
  function openSearchOverlay() {
    var recents = getRecentSearches();

    var html = '';
    html += '<div class="gs-header">';
    html += '<div class="ct-search-wrap">';
    html += '<span class="ct-search-icon">🔍</span>';
    html += '<input type="text" class="ct-search-input" id="gs-input" placeholder="Search everything..." autofocus>';
    html += '</div>';
    html += '<button class="gs-close" data-close-sheet="search">✕</button>';
    html += '</div>';

    html += '<div class="gs-body" id="gs-body">';

    // Show recent searches if any
    if (recents.length) {
      html += '<div class="gs-group">';
      html += '<div class="gs-group-label">Recent Searches</div>';
      html += '<div class="gs-recent">';
      recents.forEach(function (r) {
        html += '<span class="gs-recent-item" data-recent="' + esc(r) + '">' + esc(r) + '</span>';
      });
      html += '</div>';
      html += '</div>';
    }

    // Initial empty state
    html += '<div class="empty-state" id="gs-empty">';
    html += '<div class="empty-state-icon">🔍</div>';
    html += '<p>Search across venues, contacts, house concerts, busking spots, todos, income & expenses.</p>';
    html += '</div>';

    html += '</div>';

    openSheet('search', html, { fullScreen: true });

    var sheet = document.getElementById('ct-sheet-search');
    if (!sheet) return;

    var input = sheet.querySelector('#gs-input');
    var body = sheet.querySelector('#gs-body');

    // Focus input
    if (input) {
      setTimeout(function () { input.focus(); }, 300);
    }

    // Recent search clicks
    sheet.querySelectorAll('[data-recent]').forEach(function (el) {
      el.addEventListener('click', function () {
        var query = el.getAttribute('data-recent');
        input.value = query;
        performSearch(query);
      });
    });

    // Search input handler (debounced)
    if (input) {
      input.addEventListener('input', function () {
        clearTimeout(input._debounce);
        input._debounce = setTimeout(function () {
          performSearch(input.value);
        }, 200);
      });
    }

    function performSearch(query) {
      query = (query || '').trim().toLowerCase();
      if (query.length < 2) {
        // Show empty state
        body.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>Type at least 2 characters to search.</p></div>';
        return;
      }

      var results = _searchAll(query);

      if (results.length === 0) {
        body.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><p>No results for "' + esc(query) + '"</p></div>';
        return;
      }

      // Group by entity type
      var groups = {};
      results.forEach(function (r) {
        if (!groups[r.type]) groups[r.type] = [];
        groups[r.type].push(r);
      });

      var html = '';
      Object.keys(groups).forEach(function (type) {
        var group = groups[type];
        html += '<div class="gs-group">';
        html += '<div class="gs-group-label">' + _entityTypeIcon(type) + ' ' + _entityTypeLabel(type) + ' (' + group.length + ')</div>';
        group.forEach(function (r) {
          html += '<div class="gs-result" data-result-type="' + esc(r.type) + '" data-result-id="' + esc(r.id) + '">';
          html += '<div class="gs-result-icon">' + _entityTypeIcon(r.type) + '</div>';
          html += '<div class="gs-result-info">';
          html += '<div class="gs-result-title">' + _highlight(r.title, query) + '</div>';
          if (r.subtitle) {
            html += '<div class="gs-result-sub">' + _highlight(r.subtitle, query) + '</div>';
          }
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';
      });

      body.innerHTML = html;

      // Bind result clicks
      body.querySelectorAll('[data-result-type]').forEach(function (el) {
        el.addEventListener('click', function () {
          var type = el.getAttribute('data-result-type');
          var id = el.getAttribute('data-result-id');
          addRecentSearch(query);
          closeSheet('search');
          _navigateToResult(type, id);
        });
      });
    }
  }

  /** Search across all entity types */
  function _searchAll(query) {
    var results = [];
    var data = D();

    // Venues
    (data.venues || []).forEach(function (v) {
      if (_matches([v.name, v.contact_name, v.city, v.email, v.phone], query)) {
        results.push({ type: 'venue', id: v.id, title: v.name || 'Unnamed', subtitle: [v.city, v.type].filter(Boolean).join(' • ') });
      }
    });

    // House Concerts
    (data.house_concerts || []).forEach(function (hc) {
      if (_matches([hc.host_name, hc.source, hc.source_detail], query)) {
        results.push({ type: 'house_concert', id: hc.id, title: hc.host_name || 'Unnamed Host', subtitle: hc.stage || '' });
      }
    });

    // Contacts
    (data.contacts || []).forEach(function (c) {
      if (_matches([c.name, c.org, c.email, c.phone, c.role, c.city], query)) {
        results.push({ type: 'contact', id: c.id, title: c.name || 'Unnamed', subtitle: [c.role, c.org].filter(Boolean).join(' • ') });
      }
    });

    // Busking Spots
    (data.busking_spots || []).forEach(function (bs) {
      if (_matches([bs.name, bs.city, bs.address], query)) {
        results.push({ type: 'busking_spot', id: bs.id, title: bs.name || 'Unnamed', subtitle: bs.city || '' });
      }
    });

    // Tour Stops
    (data.tour_stops || []).forEach(function (ts) {
      if (_matches([ts.name, ts.state, ts.segment], query)) {
        results.push({ type: 'tour_stop', id: ts.id, title: ts.name || 'Unnamed', subtitle: ts.state || '' });
      }
    });

    // Todos
    (data.todos || []).forEach(function (td) {
      if (_matches([td.text], query)) {
        results.push({ type: 'todo', id: td.id, title: td.text || '', subtitle: td.category || '' });
      }
    });

    // Income Log
    (data.income_log || []).forEach(function (inc) {
      if (_matches([inc.notes, inc.type, inc.payment_method], query)) {
        results.push({ type: 'income', id: inc.id, title: '$' + (inc.amount || 0).toFixed(2) + ' ' + (inc.type || ''), subtitle: [fmtDate(inc.date), inc.notes].filter(Boolean).join(' • ') });
      }
    });

    // Expense Log
    (data.expense_log || []).forEach(function (exp) {
      if (_matches([exp.description, exp.category], query)) {
        results.push({ type: 'expense', id: exp.id, title: '$' + (exp.amount || 0).toFixed(2) + ' ' + (exp.category || ''), subtitle: [fmtDate(exp.date), exp.description].filter(Boolean).join(' • ') });
      }
    });

    return results;
  }

  /** Check if any field contains the query */
  function _matches(fields, query) {
    return fields.some(function (f) {
      return f && String(f).toLowerCase().includes(query);
    });
  }

  /** Highlight search term in text */
  function _highlight(text, query) {
    if (!text) return '';
    var escaped = esc(text);
    var regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<span class="gs-highlight">$1</span>');
  }

  /** Get icon for entity type */
  function _entityTypeIcon(type) {
    var icons = {
      venue: '🏢',
      house_concert: '🏠',
      contact: '👤',
      busking_spot: '📍',
      tour_stop: '🗺️',
      todo: '✅',
      income: '💰',
      expense: '🧾'
    };
    return icons[type] || '📄';
  }

  /** Get label for entity type */
  function _entityTypeLabel(type) {
    var labels = {
      venue: 'Venues',
      house_concert: 'House Concerts',
      contact: 'Contacts',
      busking_spot: 'Busking Spots',
      tour_stop: 'Tour Stops',
      todo: 'Todos',
      income: 'Income',
      expense: 'Expenses'
    };
    return labels[type] || type;
  }

  /** Navigate to a search result */
  function _navigateToResult(type, id) {
    switch (type) {
      case 'contact':
        openContactDetail(id);
        break;
      case 'venue':
      case 'house_concert':
      case 'busking_spot':
      case 'tour_stop':
        openLinkedEntity(type, id);
        break;
      case 'todo':
        // Show todo in a simple detail sheet
        var todo = TourOS.getEntity('todos', id);
        if (todo) {
          var html = '<div class="ct-field"><div class="ct-field-label">Task</div><div class="ct-field-value">' + esc(todo.text) + '</div></div>';
          if (todo.category) html += '<div class="ct-field"><div class="ct-field-label">Category</div><div class="ct-field-value">' + esc(todo.category) + '</div></div>';
          if (todo.priority) html += '<div class="ct-field"><div class="ct-field-label">Priority</div><div class="ct-field-value">' + esc(todo.priority) + '</div></div>';
          if (todo.due_date) html += '<div class="ct-field"><div class="ct-field-label">Due</div><div class="ct-field-value">' + esc(fmtDate(todo.due_date)) + '</div></div>';
          html += '<div class="ct-field"><div class="ct-field-label">Status</div><div class="ct-field-value">' + (todo.completed ? '✅ Completed' : '⬜ Open') + '</div></div>';
          if (!todo.completed) {
            html += '<button class="btn btn-primary btn-block mt-16" id="todo-complete-btn">✅ Mark Complete</button>';
          }
          html += '<div class="ct-form-actions"><button class="btn btn-secondary" data-close-sheet="todo-detail">Close</button></div>';
          openSheet('todo-detail', html, { title: 'Todo' });
          var completeBtn = document.querySelector('#todo-complete-btn');
          if (completeBtn) completeBtn.addEventListener('click', function () {
            TourOS.updateEntity('todos', id, { completed: true, completed_at: new Date().toISOString() });
            toast('Todo completed', 'success');
            closeSheet('todo-detail');
          });
        }
        break;
      case 'income':
      case 'expense':
        // Show simple detail
        var entity = TourOS.getEntity(type === 'income' ? 'income_log' : 'expense_log', id);
        if (entity) {
          var h = '<div class="ct-field"><div class="ct-field-label">Amount</div><div class="ct-field-value">$' + (entity.amount || 0).toFixed(2) + '</div></div>';
          if (entity.date) h += '<div class="ct-field"><div class="ct-field-label">Date</div><div class="ct-field-value">' + esc(fmtDate(entity.date)) + '</div></div>';
          if (type === 'income') {
            h += '<div class="ct-field"><div class="ct-field-label">Type</div><div class="ct-field-value">' + esc(entity.type || '') + '</div></div>';
          } else {
            h += '<div class="ct-field"><div class="ct-field-label">Category</div><div class="ct-field-value">' + esc(entity.category || '') + '</div></div>';
          }
          var desc = entity.notes || entity.description;
          if (desc) h += '<div class="ct-field"><div class="ct-field-label">Notes</div><div class="ct-field-value">' + esc(desc) + '</div></div>';
          h += '<div class="ct-form-actions"><button class="btn btn-secondary" data-close-sheet="entry-detail">Close</button></div>';
          openSheet('entry-detail', h, { title: type === 'income' ? '💰 Income Entry' : '🧾 Expense Entry' });
        }
        break;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 6: SETTINGS PAGE
     ═══════════════════════════════════════════════════════════════════════ */

  /** Open Settings modal */
  function openSettingsModal() {
    var data = D();
    var meta = data.meta || {};
    var artist = meta.artist || {};
    var config = data.config || {};

    var html = '';

    // Profile section
    html += '<div class="st-section">';
    html += '<div class="st-section-title">👤 Profile</div>';
    html += _settingsInput('Artist Name', 'st-artist-name', artist.name || '');
    html += _settingsInput('Email', 'st-artist-email', artist.email || '', 'email');
    html += _settingsInput('Phone', 'st-artist-phone', artist.phone || '', 'tel');
    html += _settingsInput('Instagram', 'st-artist-ig', artist.ig || '');
    html += _settingsInput('YouTube', 'st-artist-yt', artist.yt || '');
    html += '</div>';

    // Tour Settings
    html += '<div class="st-section">';
    html += '<div class="st-section-title">🎯 Tour Settings</div>';
    html += _settingsInput('Tour Name', 'st-tour-name', config.tour_name || '');
    html += _settingsInput('Tour Target ($)', 'st-tour-target', config.tour_target || 0, 'number');
    html += _settingsInput('Busking Min Session ($)', 'st-busking-min', config.busking_min_session || 0, 'number');
    html += _settingsInput('Gig Target ($)', 'st-gig-target', config.gig_target || 0, 'number');
    html += '<button class="btn btn-primary btn-block mt-16" id="st-save-settings">💾 Save Settings</button>';
    html += '</div>';

    // Data Management
    html += '<div class="st-section">';
    html += '<div class="st-section-title">💾 Data Management</div>';
    html += '<div class="st-row"><div class="st-row-label">Export Data (JSON)</div><button class="btn" id="st-export-btn">📥 Export</button></div>';
    html += '<div class="st-row"><div class="st-row-label">Import Data (JSON)</div><button class="btn" id="st-import-btn">📤 Import</button></div>';
    html += '<input type="file" id="st-import-file" accept=".json" style="display:none;">';
    html += '<div class="st-danger-zone">';
    html += '<div class="st-row-label" style="color:var(--red);font-weight:700;">⚠️ Danger Zone</div>';
    html += '<div class="st-row"><div class="st-row-label">Clear All Data</div><button class="btn btn-danger" id="st-clear-btn">🗑️ Clear</button></div>';
    html += '<div class="st-confirm-wrap" id="st-clear-confirm">';
    html += '<p style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">This will permanently delete ALL tour data and reset to seed. Type "DELETE" to confirm:</p>';
    html += '<input type="text" class="form-input" id="st-clear-confirm-input" placeholder="DELETE" style="margin-bottom:8px;">';
    html += '<div class="ct-form-actions"><button class="btn btn-secondary" id="st-clear-cancel">Cancel</button><button class="btn btn-danger" id="st-clear-confirm-btn">Confirm Delete</button></div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Appearance
    html += '<div class="st-section">';
    html += '<div class="st-section-title">🎨 Appearance</div>';
    html += '<div class="st-row"><div class="st-row-label">Dark Theme</div><div class="st-toggle on"></div></div>';
    html += '<div class="st-row"><div class="st-row-label">Light Theme</div><div class="st-toggle disabled"></div></div>';
    html += '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Light theme coming in Phase 2</div>';
    html += '</div>';

    // About
    html += '<div class="st-section">';
    html += '<div class="st-section-title">ℹ️ About</div>';
    html += '<div class="st-info-row"><span class="st-info-label">App Version</span><span class="st-info-value">' + esc(meta.version || '3.0') + '</span></div>';
    html += '<div class="st-info-row"><span class="st-info-label">Schema Version</span><span class="st-info-value">' + esc(meta.schema_version || '3.0') + '</span></div>';
    html += '<div class="st-info-row"><span class="st-info-label">Last Updated</span><span class="st-info-value">' + esc(fmtDateTime(meta.updated_at)) + '</span></div>';
    html += '<div class="st-info-row"><span class="st-info-label">Storage Key</span><span class="st-info-value" style="font-size:11px;">' + esc(TourOS.STORAGE_KEY) + '</span></div>';
    html += '<div style="text-align:center;margin-top:16px;font-size:12px;color:var(--text-muted);">Tour OS v3 — Dylan Crowe Music<br>Built with ❤️ for the road</div>';
    html += '</div>';

    openSheet('settings', html, { title: '⚙️ Settings' });

    // Bind events
    var sheet = document.getElementById('ct-sheet-settings');
    if (!sheet) return;

    // Save settings
    var saveBtn = sheet.querySelector('#st-save-settings');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var updates = {
        meta: {
          artist: {
            name: sheet.querySelector('#st-artist-name').value.trim(),
            email: sheet.querySelector('#st-artist-email').value.trim(),
            phone: sheet.querySelector('#st-artist-phone').value.trim(),
            ig: sheet.querySelector('#st-artist-ig').value.trim(),
            yt: sheet.querySelector('#st-artist-yt').value.trim()
          }
        },
        config: {
          tour_name: sheet.querySelector('#st-tour-name').value.trim(),
          tour_target: parseFloat(sheet.querySelector('#st-tour-target').value) || 0,
          busking_min_session: parseFloat(sheet.querySelector('#st-busking-min').value) || 0,
          gig_target: parseFloat(sheet.querySelector('#st-gig-target').value) || 0
        }
      };

      // Merge updates into existing data
      var data = D();
      data.meta = data.meta || {};
      data.meta.artist = updates.meta.artist;
      data.config = data.config || {};
      data.config.tour_name = updates.config.tour_name;
      data.config.tour_target = updates.config.tour_target;
      data.config.busking_min_session = updates.config.busking_min_session;
      data.config.gig_target = updates.config.gig_target;
      TourOS.saveData();

      toast('Settings saved', 'success');
    });

    // Export
    var exportBtn = sheet.querySelector('#st-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      var json = TourOS.exportData();
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tour-os-v3-export-' + todayStr() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Data exported', 'success');
    });

    // Import
    var importBtn = sheet.querySelector('#st-import-btn');
    var importFile = sheet.querySelector('#st-import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function () { importFile.click(); });
      importFile.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          var success = TourOS.importData(ev.target.result);
          if (success) {
            toast('Data imported successfully', 'success');
            closeSheet('settings');
            renderPeople();
          } else {
            toast('Import failed: invalid JSON', 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    // Clear data
    var clearBtn = sheet.querySelector('#st-clear-btn');
    var clearConfirm = sheet.querySelector('#st-clear-confirm');
    var clearCancel = sheet.querySelector('#st-clear-cancel');
    var clearConfirmBtn = sheet.querySelector('#st-clear-confirm-btn');
    var clearInput = sheet.querySelector('#st-clear-confirm-input');

    if (clearBtn) clearBtn.addEventListener('click', function () {
      clearConfirm.classList.add('show');
    });
    if (clearCancel) clearCancel.addEventListener('click', function () {
      clearConfirm.classList.remove('show');
      clearInput.value = '';
    });
    if (clearConfirmBtn) clearConfirm.addEventListener('click', function () {
      if (clearInput.value.trim().toUpperCase() === 'DELETE') {
        TourOS.resetToSeed();
        toast('All data cleared and reset to seed', 'success');
        closeSheet('settings');
        renderPeople();
      } else {
        toast('Type "DELETE" to confirm', 'error');
      }
    });
  }

  /** Helper: render a settings input row */
  function _settingsInput(label, id, value, type) {
    type = type || 'text';
    return '<div class="st-row">' +
      '<div class="st-row-label">' + esc(label) + '</div>' +
      '<input type="' + type + '" class="st-row-input" id="' + id + '" value="' + esc(value) + '">' +
      '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 7: INITIALIZATION
     Wire up FAB, search button, settings button.
     ═══════════════════════════════════════════════════════════════════════ */

  function init() {
    // Inject styles
    var styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    if (!document.getElementById(STYLE_ID)) {
      document.head.appendChild(styleEl);
      styleEl.textContent = ''; // already injected above
    }

    // FAB click → Create Sheet
    var fab = document.getElementById('fab');
    if (fab) {
      fab.addEventListener('click', function (e) {
        e.preventDefault();
        openCreateSheet();
      });
    }

    // Settings button → Settings modal
    var settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openSettingsModal();
      });
    }

    // Search button — we add a search icon to the header dynamically
    // The shell HTML has a settings-btn; we also need a search button.
    // We'll inject a search button next to the settings button if it doesn't exist.
    var header = document.querySelector('.app-header');
    if (header && !document.getElementById('search-btn')) {
      var searchBtn = document.createElement('button');
      searchBtn.id = 'search-btn';
      searchBtn.className = 'settings-btn';
      searchBtn.setAttribute('aria-label', 'Search');
      searchBtn.innerHTML = '🔍';
      searchBtn.style.marginRight = '4px';
      // Insert before settings button
      header.appendChild(searchBtn);
      settingsBtn = document.getElementById('settings-btn');
      if (settingsBtn) {
        header.insertBefore(searchBtn, settingsBtn);
      }
      searchBtn.addEventListener('click', function (e) {
        e.preventDefault();
        openSearchOverlay();
      });
    } else if (document.getElementById('search-btn')) {
      document.getElementById('search-btn').addEventListener('click', function (e) {
        e.preventDefault();
        openSearchOverlay();
      });
    }

    // Listen for tab switches to render People tab
    document.addEventListener('click', function (e) {
      var navItem = e.target.closest('.nav-item[data-tab="people"]');
      if (navItem) {
        setTimeout(renderPeople, 50);
      }
    });

    // Initial render if People tab is active
    var peopleView = document.getElementById('view-people');
    if (peopleView && peopleView.classList.contains('active')) {
      renderPeople();
    }

    // Listen for data changes to re-render People tab
    if (typeof TourOS !== 'undefined' && TourOS.onDataChange) {
      TourOS.onDataChange(function () {
        var activeView = document.querySelector('.view-container.active');
        if (activeView && activeView.id === 'view-people') {
          renderPeople();
        }
      });
    }
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION 8: PUBLIC API
     Expose functions for integration agent and other modules.
     ═══════════════════════════════════════════════════════════════════════ */

  window.TourOSContacts = {
    renderPeople: renderPeople,
    openCreateSheet: openCreateSheet,
    openSearchOverlay: openSearchOverlay,
    openSettingsModal: openSettingsModal,
    openContactForm: openContactForm,
    openContactDetail: openContactDetail,
    openBuskingSessionModal: openBuskingSessionModal,
    openGigIncomeModal: openGigIncomeModal,
    openExpenseModal: openExpenseModal,
    openVenueAddModal: openVenueAddModal,
    openHCAddModal: openHCAddModal,
    openSpotAddModal: openSpotAddModal,
    openStopAddModal: openStopAddModal,
    openTodoAddModal: openTodoAddModal,
    openQuickNoteModal: openQuickNoteModal,
    openSheet: openSheet,
    closeSheet: closeSheet,
    closeAllSheets: closeAllSheets,
    toast: toast
  };

})();

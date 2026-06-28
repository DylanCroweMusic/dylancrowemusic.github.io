/* ═══════════════════════════════════════════════════════════════════════
   TOUR OS v3 — COMMAND CENTER (Home tab)
   The morning standup. Answers: "What do I need to do today?"
   ═══════════════════════════════════════════════════════════════════════

   Depends on v3-foundation.js which exposes:
     loadData()            -> full data object
     getCurrentStop()     -> current tour stop object | null
     getAllEntities(type) -> array of entities for the given type
     getEntity(type, id)   -> single entity

   Entity types (strings passed to getAllEntities/getEntity):
     'tour_stops', 'venues', 'gigs', 'house_concerts',
     'busking_spots', 'income_log', 'expense_log', 'todos', 'contacts'

   Renders into <div id="view-home">.
   Exposes: renderCommandCenter()
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Brand palette (mirrors foundation CSS vars; kept here so the
        command center is self-documenting and resilient if a var is
        missing). ───────────────────────────────────────────────────── */
  const COLORS = {
    busking: '#22c55e',   // green
    venue:   '#00d2ff',   // cyan
    house:   '#f59e0b',   // amber
    merch:   '#a855f7',
    expense: '#ef4444',
    cyan:    '#00d2ff',
    magenta: '#D946EF',
    muted:   'rgba(245,240,232,0.55)',
    card:    'rgba(255,255,255,0.03)',
    cardBrd: 'rgba(255,255,255,0.08)',
    cardHov: 'rgba(255,255,255,0.06)',
    text:    '#F5F0E8',
    bgCard:  '#1A1A3E'
  };

  /* ── Helpers ──────────────────────────────────────────────────────── */

  /** Format a number as AUD-style money: $1,234 (no decimals shown for
   *  whole dollars; two decimals if cents present). */
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '$0';
    const v = Math.abs(n) < 0.005 ? 0 : n;
    const rounded = Math.round(v * 100) / 100;
    const hasCents = Math.abs(rounded - Math.round(rounded)) > 0.005;
    const str = hasCents
      ? rounded.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.round(rounded).toLocaleString('en-AU');
    return '$' + str;
  }

  /** Today's date as YYYY-MM-DD in the user's local timezone. */
  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Date string offset by `days` from today (can be negative). */
  function dateOffsetStr(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Pretty date: "15 Aug" or "15 Aug 2026" if year differs. */
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const base = `${d.getDate()} ${months[d.getMonth()]}`;
    if (d.getFullYear() !== new Date().getFullYear()) return base + ' ' + d.getFullYear();
    return base;
  }

  /** Relative time: "2h ago", "3d ago", etc. */
  function relTime(iso) {
    if (!iso) return '';
    let d;
    if (typeof iso === 'string' && iso.includes('T')) {
      d = new Date(iso);
    } else {
      d = new Date(iso + 'T00:00:00');
    }
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const mins = Math.round((now - d) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks + 'w ago';
    return fmtDate(typeof iso === 'string' && iso.includes('T') ? iso.slice(0, 10) : iso);
  }

  /** Clamp a value 0..100 for progress bars. */
  function pct(actual, target) {
    if (!target || target <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((actual / target) * 100)));
  }

  /** Escape text for safe HTML insertion. */
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Compute net earnings = total income - total expenses across the tour. */
  function computeNet(data) {
    const income = (data.income_log || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const expenses = (data.expense_log || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { income, expenses, net: income - expenses };
  }

  /** Compute gross earnings = total income. */
  function computeGross(data) {
    return (data.income_log || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }

  /** Count stops completed (status === 'completed'). */
  function stopsCompleted(data) {
    return (data.tour_stops || []).filter(s => s.status && s.status.toLowerCase() === 'completed').length;
  }

  /** Income entries in the last 7 days, grouped by type. */
  function incomeThisWeek(data) {
    const cutoff = dateOffsetStr(-6); // 7 days inclusive of today
    const entries = (data.income_log || []).filter(e => e.date && e.date >= cutoff);
    const byType = { busking: 0, gig: 0, house_concert: 0, merch: 0, other: 0 };
    let total = 0;
    entries.forEach(e => {
      const amt = Number(e.amount) || 0;
      total += amt;
      const t = e.type;
      if (t === 'busking') byType.busking += amt;
      else if (t === 'gig' || t === 'venue_gig') byType.gig += amt;
      else if (t === 'house_concert' || t === 'hc') byType.house_concert += amt;
      else if (t === 'merch') byType.merch += amt;
      else byType.other += amt;
    });
    return { total, byType, count: entries.length };
  }

  /** Most-recent stage change date for an entity (from stage_history). */
  function lastStageChange(entity) {
    if (!entity.stage_history || !entity.stage_history.length) {
      return entity.updated_at || entity.created_at || null;
    }
    const dates = entity.stage_history
      .map(h => h.date || h.timestamp)
      .filter(Boolean)
      .sort();
    return dates.length ? dates[dates.length - 1] : null;
  }

  /** Hours since a given ISO date string (or 0 if unparseable). */
  function hoursSince(iso) {
    if (!iso) return Infinity;
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    if (isNaN(d.getTime())) return Infinity;
    return (Date.now() - d.getTime()) / 3600000;
  }

  /** Recent activity items (income, expense, pipeline, todos), last 5. */
  function recentActivity(data) {
    const items = [];
    (data.income_log || []).forEach(e => {
      items.push({
        ts: e.created_at || e.date,
        icon: '💰',
        color: COLORS.busking,
        text: `${fmtMoney(e.amount)} ${e.type || 'income'} — ${e.notes || ''}`
      });
    });
    (data.expense_log || []).forEach(e => {
      items.push({
        ts: e.created_at || e.date,
        icon: '🧾',
        color: COLORS.expense,
        text: `${fmtMoney(e.amount)} ${e.category || 'expense'} — ${e.description || ''}`
      });
    });
    (data.venues || []).forEach(v => {
      (v.stage_history || []).forEach(h => {
        items.push({
          ts: h.date || h.timestamp,
          icon: '📍',
          color: COLORS.venue,
          text: `${v.name} → ${h.stage}`
        });
      });
    });
    (data.house_concerts || []).forEach(hc => {
      (hc.stage_history || []).forEach(h => {
        items.push({
          ts: h.date || h.timestamp,
          icon: '🏠',
          color: COLORS.house,
          text: `${hc.host_name} HC → ${h.stage}`
        });
      });
    });
    (data.todos || []).forEach(t => {
      if (t.completed && t.completed_at) {
        items.push({
          ts: t.completed_at,
          icon: '✅',
          color: COLORS.cyan,
          text: `Todo: ${t.text}`
        });
      }
    });
    items.sort((a, b) => {
      const ta = new Date(a.ts && a.ts.includes('T') ? a.ts : (a.ts || '') + 'T00:00:00').getTime() || 0;
      const tb = new Date(b.ts && b.ts.includes('T') ? b.ts : (b.ts || '') + 'T00:00:00').getTime() || 0;
      return tb - ta;
    });
    return items.slice(0, 5);
  }

  /* ── Priority computation ────────────────────────────────────────── */

  /**
   * Build the list of today's priority cards. Each card:
   *   { type, icon, color, title, subtitle, action }
   * `action` is a string token the host page can interpret, e.g.
   *   'open:venue:ven_001'  → open venue detail
   *   'open:house_concert:hc_001'
   *   'open:gig:gig_001'
   *   'log:busking:yesterday'
   *   'open:todo:todo_001'
   */
  function computePriorities(data) {
    const today = todayStr();
    const yesterday = dateOffsetStr(-1);
    const priorities = [];

    /* 1. Venues needing follow-up (stage = "follow_up", last change > 72h) */
    (data.venues || []).forEach(v => {
      if (v.stage === 'follow_up') {
        const last = lastStageChange(v);
        if (hoursSince(last) > 72) {
          priorities.push({
            type: 'venue_followup',
            icon: '📍',
            color: COLORS.venue,
            title: `Follow up: ${v.name}`,
            subtitle: `In "follow_up" for ${Math.round(hoursSince(last) / 24)}d`,
            action: `open:venue:${v.id}`
          });
        }
      }
    });

    /* 2. House concerts needing action:
          - posted but no responses (no stage_history beyond "posted")
          - interested needing confirmation */
    (data.house_concerts || []).forEach(hc => {
      if (hc.stage === 'posted') {
        const last = lastStageChange(hc);
        if (hoursSince(last) > 48) {
          priorities.push({
            type: 'hc_action',
            icon: '🏠',
            color: COLORS.house,
            title: `HC posted, no responses: ${hc.host_name}`,
            subtitle: 'Posted but no interest yet — re-post or chase',
            action: `open:house_concert:${hc.id}`
          });
        }
      } else if (hc.stage === 'interested') {
        priorities.push({
          type: 'hc_confirm',
          icon: '🏠',
          color: COLORS.house,
          title: `Confirm HC: ${hc.host_name}`,
          subtitle: 'Host is interested — confirm the date',
          action: `open:house_concert:${hc.id}`
        });
      }
    });

    /* 3. Gigs tonight (gig.date = today) */
    (data.gigs || []).forEach(g => {
      if (g.date === today) {
        const venue = getEntity ? getEntity('venues', g.venue_id) : null;
        const name = venue ? venue.name : 'Venue';
        priorities.push({
          type: 'gig_tonight',
          icon: '🎸',
          color: COLORS.venue,
          title: `Gig tonight: ${name}`,
          subtitle: g.set_times ? `Sets: ${g.set_times}` : 'Check set times',
          action: `open:gig:${g.id}`
        });
      }
    });

    /* 4. House concerts tonight (event.date = today) */
    (data.house_concerts || []).forEach(hc => {
      if (hc.event && hc.event.date === today) {
        priorities.push({
          type: 'hc_tonight',
          icon: '🎵',
          color: COLORS.house,
          title: `House concert tonight: ${hc.host_name}`,
          subtitle: hc.event.start_time ? `Starts ${hc.event.start_time}` : 'Tonight',
          action: `open:house_concert:${hc.id}`
        });
      }
    });

    /* 5. Unlogged busking sessions — if yesterday has no busking income
          entry, prompt to log. */
    const yBusking = (data.income_log || []).some(
      e => e.type === 'busking' && e.date === yesterday
    );
    if (!yBusking) {
      priorities.push({
        type: 'unlogged_busking',
        icon: '🪕',
        color: COLORS.busking,
        title: "Log yesterday's busking session",
        subtitle: 'No busking income logged for yesterday',
        action: 'log:busking:yesterday'
      });
    }

    /* 6. Open todos with due_date ≤ today */
    (data.todos || []).forEach(t => {
      if (!t.completed && t.due_date && t.due_date <= today) {
        const overdue = t.due_date < today;
        priorities.push({
          type: 'todo_due',
          icon: overdue ? '⚠️' : '✓',
          color: overdue ? COLORS.expense : COLORS.cyan,
          title: t.text,
          subtitle: overdue ? `Overdue (${fmtDate(t.due_date)})` : `Due today`,
          action: `open:todo:${t.id}`
        });
      }
    });

    return priorities;
  }

  /* ── HTML fragment builders ──────────────────────────────────────── */

  /** Inject scoped styles for the command center once. */
  let _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const css = `
      .cc-wrap { max-width: 720px; margin: 0 auto; }

      /* Tour progress header */
      .cc-tour-hdr {
        background: linear-gradient(135deg, rgba(0,180,216,0.08), rgba(217,70,239,0.05));
        border: 1px solid var(--card-brd, ${COLORS.cardBrd});
        border-radius: 12px; padding: 1rem; margin-bottom: 1rem;
      }
      .cc-tour-name { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em;
        color: ${COLORS.muted}; font-weight: 600; }
      .cc-tour-net { font-size: 1.6rem; font-weight: 800; margin: 0.2rem 0; }
      .cc-tour-target { font-size: 0.7rem; color: ${COLORS.muted}; margin-bottom: 0.6rem; }
      .cc-progbar { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08);
        overflow: hidden; margin: 0.5rem 0; }
      .cc-progbar-fill { height: 100%; border-radius: 4px;
        background: linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.magenta});
        transition: width 0.8s ease; }
      .cc-tour-stats { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.6rem;
        font-size: 0.72rem; color: ${COLORS.muted}; }
      .cc-tour-stats b { color: ${COLORS.text}; font-weight: 700; }
      .cc-current-stop { margin-top: 0.5rem; font-size: 0.78rem; }
      .cc-current-stop .cs-name { font-weight: 700; color: ${COLORS.cyan}; }

      /* Section heading */
      .cc-sec { margin-bottom: 1.2rem; }
      .cc-sec-title {
        font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em;
        color: ${COLORS.muted}; font-weight: 600; margin-bottom: 0.6rem;
      }

      /* Snapshot stream cards */
      .cc-snap-grid { display: grid; grid-template-columns: 1fr; gap: 0.6rem; }
      @media(min-width:600px){ .cc-snap-grid { grid-template-columns: repeat(3,1fr); } }
      .cc-snap-card {
        background: ${COLORS.card}; border: 1px solid ${COLORS.cardBrd};
        border-radius: 12px; padding: 0.75rem;
      }
      .cc-snap-card.busking { border-left: 3px solid ${COLORS.busking}; }
      .cc-snap-card.venue   { border-left: 3px solid ${COLORS.venue}; }
      .cc-snap-card.house   { border-left: 3px solid ${COLORS.house}; }
      .cc-snap-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em;
        color: ${COLORS.muted}; font-weight: 600; }
      .cc-snap-val { font-size: 1.05rem; font-weight: 800; margin: 0.15rem 0; }
      .cc-snap-sub { font-size: 0.65rem; color: ${COLORS.muted}; }
      .cc-snap-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06);
        margin-top: 0.5rem; overflow: hidden; }
      .cc-snap-bar-fill { height: 100%; border-radius: 2px; transition: width 0.6s ease; }
      .cc-snap-bar-fill.busking { background: ${COLORS.busking}; }
      .cc-snap-bar-fill.venue   { background: ${COLORS.venue}; }
      .cc-snap-bar-fill.house   { background: ${COLORS.house}; }

      /* Priority cards */
      .cc-priority {
        display: flex; align-items: center; gap: 0.7rem;
        background: ${COLORS.card}; border: 1px solid ${COLORS.cardBrd};
        border-radius: 12px; padding: 0.7rem 0.85rem; margin-bottom: 0.45rem;
        cursor: pointer; transition: background 0.2s, transform 0.1s;
        text-align: left; width: 100%; font-family: inherit;
        border-left: 3px solid var(--cc-pcolor, ${COLORS.muted});
      }
      .cc-priority:hover { background: ${COLORS.cardHov}; }
      .cc-priority:active { transform: scale(0.99); }
      .cc-pri-icon { font-size: 1.15rem; flex-shrink: 0; width: 1.8rem; text-align: center; }
      .cc-pri-body { flex: 1; min-width: 0; }
      .cc-pri-title { font-size: 0.82rem; font-weight: 700; color: ${COLORS.text}; }
      .cc-pri-sub { font-size: 0.65rem; color: ${COLORS.muted}; margin-top: 1px; }
      .cc-pri-chev { color: rgba(245,240,232,0.3); font-size: 0.9rem; flex-shrink: 0; }
      .cc-empty { text-align: center; padding: 1.2rem; color: ${COLORS.muted};
        font-size: 0.78rem; }

      /* Quick actions */
      .cc-quick-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
      .cc-quick-btn {
        padding: 0.85rem 0.5rem; border-radius: 12px; border: 1px solid;
        background: ${COLORS.card}; font-family: inherit; font-size: 0.72rem;
        font-weight: 700; color: ${COLORS.text}; cursor: pointer;
        display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
        transition: background 0.2s, transform 0.1s; text-align: center;
      }
      .cc-quick-btn:active { transform: scale(0.97); }
      .cc-quick-btn.busking { border-color: rgba(34,197,94,0.4); color: ${COLORS.busking}; }
      .cc-quick-btn.busking:hover { background: rgba(34,197,94,0.08); }
      .cc-quick-btn.gig { border-color: rgba(0,210,255,0.4); color: ${COLORS.venue}; }
      .cc-quick-btn.gig:hover { background: rgba(0,210,255,0.08); }
      .cc-quick-btn.expense { border-color: rgba(239,68,68,0.4); color: ${COLORS.expense}; }
      .cc-quick-btn.expense:hover { background: rgba(239,68,68,0.08); }
      .cc-quick-icon { font-size: 1.3rem; }

      /* Income this week */
      .cc-week-total { font-size: 1.4rem; font-weight: 800; margin: 0.2rem 0; }
      .cc-week-sub { font-size: 0.7rem; color: ${COLORS.muted}; margin-bottom: 0.7rem; }
      .cc-week-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; }
      .cc-week-label { font-size: 0.72rem; width: 5.5rem; flex-shrink: 0; }
      .cc-week-track { flex: 1; height: 14px; border-radius: 7px;
        background: rgba(255,255,255,0.06); overflow: hidden; position: relative; }
      .cc-week-fill { height: 100%; border-radius: 7px; transition: width 0.6s ease; }
      .cc-week-amt { font-size: 0.72rem; font-weight: 700; width: 4.5rem; text-align: right; flex-shrink: 0; }

      /* Recent activity */
      .cc-activity { display: flex; align-items: center; gap: 0.6rem;
        padding: 0.55rem 0.7rem; background: ${COLORS.card};
        border: 1px solid ${COLORS.cardBrd}; border-radius: 10px; margin-bottom: 0.35rem; }
      .cc-act-icon { font-size: 1rem; flex-shrink: 0; width: 1.6rem; text-align: center; }
      .cc-act-text { flex: 1; min-width: 0; font-size: 0.72rem; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; }
      .cc-act-time { font-size: 0.6rem; color: ${COLORS.muted}; flex-shrink: 0; }
    `;
    const style = document.createElement('style');
    style.id = 'cc-v3-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ── Section renderers ────────────────────────────────────────────── */

  function renderTourHeader(data, stop) {
    const cfg = data.config || {};
    const tourName = cfg.tour_name || 'Tour';
    const target = cfg.tour_target || 37000;
    const { net, income, expenses } = computeNet(data);
    const gross = computeGross(data);
    const completed = stopsCompleted(data);
    const totalStops = (data.tour_stops || []).length;
    const netPct = pct(net, target);

    let stopHtml = '';
    if (stop) {
      stopHtml = `
        <div class="cc-current-stop">
          <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.06em;color:${COLORS.muted};">Current stop</span><br>
          <span class="cs-name">${esc(stop.name)}</span>
          <span style="color:${COLORS.muted};font-size:0.7rem;">
            · ${fmtDate(stop.arrival_date)} → ${fmtDate(stop.departure_date)}
          </span>
        </div>`;
    }

    return `
      <div class="cc-tour-hdr">
        <div class="cc-tour-name">${esc(tourName)}</div>
        <div class="cc-tour-net">${fmtMoney(net)}</div>
        <div class="cc-tour-target">net earnings · target ${fmtMoney(target)}</div>
        <div class="cc-progbar" role="progressbar" aria-valuenow="${netPct}" aria-valuemin="0" aria-valuemax="100">
          <div class="cc-progbar-fill" style="width:${netPct}%"></div>
        </div>
        <div class="cc-tour-stats">
          <span>Gross <b>${fmtMoney(gross)}</b></span>
          <span>Stops <b>${completed}/${totalStops}</b></span>
          <span>Expenses <b>${fmtMoney(expenses)}</b></span>
        </div>
        ${stopHtml}
      </div>`;
  }

  function renderSnapshot(data, stop) {
    if (!stop) {
      return `<div class="cc-sec">
        <div class="cc-sec-title">Today's Snapshot</div>
        <div class="cc-empty">No current tour stop set.</div>
      </div>`;
    }
    const t = stop.targets || {};
    const a = stop.actuals || {};

    // Busking
    const bT = t.busking_sessions || (t.busking && t.busking.sessions_target) || 0;
    const bA = a.busking_sessions || (a.busking && a.busking.sessions_completed) || 0;
    const bET = t.busking_earnings || (t.busking && t.busking.earnings_target) || 0;
    const bEA = a.busking_earnings || (a.busking && a.busking.earnings_actual) || 0;

    // Venue gigs
    const gT = t.gigs || (t.venue_gig && t.venue_gig.gigs_booked_target) || 0;
    const gA = a.gigs_played || (a.venue_gig && a.venue_gig.gigs_played) || 0;
    const gET = t.gig_earnings || (t.venue_gig && t.venue_gig.earnings_target) || 0;
    const gEA = a.gig_earnings || (a.venue_gig && a.venue_gig.earnings_actual) || 0;

    // House concerts
    const hT = t.hc_shows || (t.house_concert && t.house_concert.shows_confirmed_target) || 0;
    const hA = a.hc_completed || (a.house_concert && a.house_concert.shows_completed) || 0;
    const hET = t.hc_earnings || (t.house_concert && t.house_concert.earnings_target) || 0;
    const hEA = a.hc_earnings || (a.house_concert && a.house_concert.earnings_actual) || 0;

    function streamCard(cls, label, countTxt, earnTxt, earnPct) {
      return `
        <div class="cc-snap-card ${cls}">
          <div class="cc-snap-label">${label}</div>
          <div class="cc-snap-val">${esc(countTxt)}</div>
          <div class="cc-snap-sub">${esc(earnTxt)}</div>
          <div class="cc-snap-bar"><div class="cc-snap-bar-fill ${cls}" style="width:${earnPct}%"></div></div>
        </div>`;
    }

    return `
      <div class="cc-sec">
        <div class="cc-sec-title">Today's Snapshot — ${esc(stop.name)}</div>
        <div class="cc-snap-grid">
          ${streamCard('busking', 'Busking', `${bA}/${bT} sessions`,
              `${fmtMoney(bEA)} / ${fmtMoney(bET)}`, pct(bEA, bET))}
          ${streamCard('venue', 'Venue Gigs', `${gA}/${gT} gigs`,
              `${fmtMoney(gEA)} / ${fmtMoney(gET)}`, pct(gEA, gET))}
          ${streamCard('house', 'House Concerts', `${hA}/${hT} shows`,
              `${fmtMoney(hEA)} / ${fmtMoney(hET)}`, pct(hEA, hET))}
        </div>
      </div>`;
  }

  function renderPriorities(data) {
    const priorities = computePriorities(data);
    let html = `<div class="cc-sec">
      <div class="cc-sec-title">Today's Priorities</div>`;

    if (!priorities.length) {
      html += `<div class="cc-empty">✨ Nothing urgent today. You're on track.</div>`;
    } else {
      priorities.forEach(p => {
        html += `
          <button class="cc-priority" style="--cc-pcolor:${p.color}" data-action="${esc(p.action)}">
            <span class="cc-pri-icon">${p.icon}</span>
            <span class="cc-pri-body">
              <div class="cc-pri-title">${esc(p.title)}</div>
              <div class="cc-pri-sub">${esc(p.subtitle)}</div>
            </span>
            <span class="cc-pri-chev">›</span>
          </button>`;
      });
    }
    html += `</div>`;
    return html;
  }

  function renderQuickActions() {
    return `
      <div class="cc-sec">
        <div class="cc-sec-title">Quick Actions</div>
        <div class="cc-quick-row">
          <button class="cc-quick-btn busking" data-action="create:busking">
            <span class="cc-quick-icon">🪕</span>Log Busking
          </button>
          <button class="cc-quick-btn gig" data-action="create:gig_income">
            <span class="cc-quick-icon">🎸</span>Log Gig Income
          </button>
          <button class="cc-quick-btn expense" data-action="create:expense">
            <span class="cc-quick-icon">🧾</span>Log Expense
          </button>
        </div>
      </div>`;
  }

  function renderIncomeWeek(data) {
    const week = incomeThisWeek(data);
    const rows = [
      { label: 'Busking',  amt: week.byType.busking,        color: COLORS.busking },
      { label: 'Gigs',     amt: week.byType.gig,            color: COLORS.venue },
      { label: 'House',    amt: week.byType.house_concert,  color: COLORS.house },
      { label: 'Merch',    amt: week.byType.merch,          color: COLORS.merch }
    ];
    if (week.byType.other > 0) {
      rows.push({ label: 'Other', amt: week.byType.other, color: COLORS.muted });
    }
    const maxAmt = Math.max(1, ...rows.map(r => r.amt));

    let rowsHtml = '';
    rows.forEach(r => {
      const w = Math.max(2, Math.round((r.amt / maxAmt) * 100));
      rowsHtml += `
        <div class="cc-week-row">
          <span class="cc-week-label" style="color:${r.color}">${r.label}</span>
          <span class="cc-week-track"><span class="cc-week-fill" style="width:${w}%;background:${r.color}"></span></span>
          <span class="cc-week-amt">${fmtMoney(r.amt)}</span>
        </div>`;
    });

    return `
      <div class="cc-sec">
        <div class="cc-sec-title">Income This Week</div>
        <div style="background:${COLORS.card};border:1px solid ${COLORS.cardBrd};border-radius:12px;padding:0.85rem;">
          <div class="cc-week-total">${fmtMoney(week.total)}</div>
          <div class="cc-week-sub">last 7 days · ${week.count} entries</div>
          ${rowsHtml}
        </div>
      </div>`;
  }

  function renderRecentActivity(data) {
    const items = recentActivity(data);
    let html = `<div class="cc-sec">
      <div class="cc-sec-title">Recent Activity</div>`;
    if (!items.length) {
      html += `<div class="cc-empty">No recent activity yet.</div>`;
    } else {
      items.forEach(it => {
        html += `
          <div class="cc-activity">
            <span class="cc-act-icon" style="color:${it.color}">${it.icon}</span>
            <span class="cc-act-text">${esc(it.text)}</span>
            <span class="cc-act-time">${esc(relTime(it.ts))}</span>
          </div>`;
      });
    }
    html += `</div>`;
    return html;
  }

  /* ── Event wiring ─────────────────────────────────────────────────── */

  /** Dispatch a command-center action token to the host page.
   *  We try several well-known global hooks so this file is decoupled
   *  from the exact integration layer:
   *    1. window.openEntity(type, id)        — open detail
   *    2. window.openCreateSheet(type)       — open create sheet
   *    3. window.logBuskingSession(dateHint) — quick busking log
   *  If none exist, we dispatch a CustomEvent on document so the host
   *  can listen: 'tour-os:action' with detail.token. */
  function dispatchAction(token) {
    if (!token) return;
    const parts = token.split(':');
    const kind = parts[0];

    if (kind === 'open') {
      const type = parts[1];
      const id = parts[2];
      if (typeof window.openEntity === 'function') {
        window.openEntity(type, id);
        return;
      }
    } else if (kind === 'create') {
      const subtype = parts[1];
      if (typeof window.openCreateSheet === 'function') {
        window.openCreateSheet(subtype);
        return;
      }
    } else if (kind === 'log') {
      const sub = parts[1];
      const hint = parts[2];
      if (sub === 'busking' && typeof window.logBuskingSession === 'function') {
        window.logBuskingSession(hint);
        return;
      }
      // Fallback: treat like create:busking
      if (typeof window.openCreateSheet === 'function') {
        window.openCreateSheet('busking');
        return;
      }
    }

    // Generic fallback: emit a custom event
    document.dispatchEvent(new CustomEvent('tour-os:action', { detail: { token } }));
  }

  /** Attach click handlers to all [data-action] elements inside the view. */
  function wireActions(container) {
    container.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => dispatchAction(el.getAttribute('data-action')));
    });
  }

  /* ── Main render entry point ─────────────────────────────────────── */

  /**
   * renderCommandCenter() — builds the Home tab content and injects it
   * into <div id="view-home">. Safe to call repeatedly (idempotent).
   */
  function renderCommandCenter() {
    injectStyles();

    let data;
    try {
      data = (typeof loadData === 'function') ? loadData() : window.__tourOSData;
    } catch (e) {
      console.error('[CommandCenter] loadData failed:', e);
      data = null;
    }
    if (!data) {
      const view = document.getElementById('view-home');
      if (view) view.innerHTML = `<div class="cc-empty">Unable to load tour data.</div>`;
      return;
    }

    let stop = null;
    try {
      stop = (typeof getCurrentStop === 'function') ? getCurrentStop() : null;
    } catch (e) {
      console.warn('[CommandCenter] getCurrentStop failed:', e);
    }
    // Fallback: find stop with status 'current'
    if (!stop && data.tour_stops) {
      stop = data.tour_stops.find(s => s.status && s.status.toLowerCase() === 'current') || null;
    }

    const html = `
      <div class="cc-wrap">
        ${renderTourHeader(data, stop)}
        ${renderSnapshot(data, stop)}
        ${renderPriorities(data)}
        ${renderQuickActions()}
        ${renderIncomeWeek(data)}
        ${renderRecentActivity(data)}
      </div>`;

    const view = document.getElementById('view-home');
    if (!view) {
      console.error('[CommandCenter] #view-home not found');
      return;
    }
    view.innerHTML = html;
    wireActions(view);
  }

  /* ── Public export ───────────────────────────────────────────────── */

  // Expose globally so foundation.js / index.html can call it.
  window.renderCommandCenter = renderCommandCenter;

  // Also re-render when the host signals a data change, if it dispatches
  // a 'tour-os:data-changed' event.
  document.addEventListener('tour-os:data-changed', renderCommandCenter);

})();

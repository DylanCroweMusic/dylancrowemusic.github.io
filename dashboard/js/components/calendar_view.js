/**
 * calendar_view.js — Month/week calendar grid (v4 UI)
 * renderCalendarView(year, month) returns DOM month grid.
 * 7 columns, day cells show date number + up to 3 event chips.
 * Events from calendar.getEvents(monthStart, monthEnd).
 * Color: gigs=cyan, HCs=magenta, busking=amber, tour_stops=muted.
 * "+N more" overflow. Click day opens popup. Click event opens card.
 * Week view toggle.
 *
 * @module components/calendar_view
 */
import { h } from '../utils/dom.js?v=4';
import { openModal } from './modal.js?v=4';
import { renderCard } from './card.js?v=4';
import * as calendar from '../calendar.js?v=4';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const EVENT_STYLES = {
  gig:        { bg: 'rgba(0,212,200,.18)',  color: '#00d4c8' },
  hc:         { bg: 'rgba(220,120,220,.18)', color: '#dc78dc' },
  busking:    { bg: 'rgba(245,176,66,.18)',  color: '#f5b042' },
  tour_stop:  { bg: 'rgba(150,150,160,.15)', color: '#9a9aa5' },
  default:    { bg: 'rgba(0,212,200,.12)',  color: '#7ad9d2' },
};

function _eventStyle(type) {
  const key = (type || '').toLowerCase().replace(/[-\s]/g, '_');
  return EVENT_STYLES[key] || EVENT_STYLES.default;
}

function _fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function _getEvents(start, end) {
  if (calendar && typeof calendar.getEvents === 'function') {
    return calendar.getEvents(start, end) || [];
  }
  return [];
}

function _eventChip(ev) {
  const st = _eventStyle(ev.type);
  const label = ev.title || ev.name || ev.type || 'Event';
  return h('button', {
    type: 'button',
    class: 'cal-event-chip',
    title: label,
    onClick: (e) => {
      e.stopPropagation();
      if (ev.entityType && ev.entityId) {
        try {
          const card = renderCard(ev.entityType, ev.entityId);
          openModal(card);
        } catch (_) {}
      }
    },
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '2px 6px',
      fontSize: '11px',
      lineHeight: '1.3',
      background: st.bg,
      color: st.color,
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      marginBottom: '2px',
    },
  }, label);
}

function _dayPopup(date, events) {
  const list = events.map(ev => _eventChip(ev));
  return h('div', { class: 'cal-day-popup', style: { width: '100%' } }, [
    h('div', {
      style: { fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: 'var(--text, #f1f1f5)' },
    }, date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })),
    ...list,
    events.length === 0 ? h('div', { style: { fontSize: '12px', color: 'var(--text-muted, #7a7a85)' } }, 'No events') : null,
  ].filter(Boolean));
}

function _buildMonthGrid(year, month, events) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // leading blanks
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  // trailing blanks to fill 6 rows (42 cells) for stable height
  while (cells.length < 42) cells.push(null);

  return cells.map(date => {
    if (!date) return h('div', { class: 'cal-cell empty', style: _cellStyle(true) });
    const dayEvents = events.filter(ev => {
      const evDate = ev.date instanceof Date ? ev.date : new Date(ev.date);
      return _sameDay(evDate, date);
    });
    const visible = dayEvents.slice(0, 3);
    const overflow = dayEvents.length - visible.length;

    return h('div', {
      class: 'cal-cell',
      style: _cellStyle(false),
      onClick: () => openModal(_dayPopup(date, dayEvents)),
    }, [
      h('div', {
        class: 'cal-date-num',
        style: { fontSize: '12px', fontWeight: '600', color: 'var(--text-muted, #9a9aa5)', marginBottom: '2px' },
      }, String(date.getDate())),
      ...visible.map(ev => _eventChip(ev)),
      overflow > 0 ? h('div', {
        class: 'cal-more',
        style: { fontSize: '11px', color: 'var(--text-muted, #7a7a85)', padding: '0 4px', cursor: 'pointer' },
        onClick: (e) => { e.stopPropagation(); openModal(_dayPopup(date, dayEvents)); },
      }, `+${overflow} more`) : null,
    ].filter(Boolean));
  });
}

function _cellStyle(empty) {
  return {
    minHeight: '92px',
    padding: '4px',
    borderTop: '1px solid var(--border, #222230)',
    borderLeft: '1px solid var(--border, #222230)',
    borderRight: '1px solid var(--border, #222230)',
    borderBottom: '1px solid var(--border, #222230)',
    background: empty ? 'var(--bg, #0b0b10)' : 'var(--bg-elevated, #11111a)',
    cursor: empty ? 'default' : 'pointer',
    overflow: 'hidden',
  };
}

function _buildWeekGrid(year, month, weekStart, events) {
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const dayEvents = events.filter(ev => {
      const evDate = ev.date instanceof Date ? ev.date : new Date(ev.date);
      return _sameDay(evDate, date);
    });
    const visible = dayEvents.slice(0, 5);
    const overflow = dayEvents.length - visible.length;

    cells.push(h('div', {
      class: 'cal-cell week',
      style: Object.assign(_cellStyle(false), { minHeight: '160px' }),
      onClick: () => openModal(_dayPopup(date, dayEvents)),
    }, [
      h('div', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--text-muted, #9a9aa5)', marginBottom: '4px' } },
        `${DAY_NAMES[i]} ${date.getDate()}`),
      ...visible.map(ev => _eventChip(ev)),
      overflow > 0 ? h('div', {
        class: 'cal-more',
        style: { fontSize: '11px', color: 'var(--text-muted, #7a7a85)', padding: '0 4px', cursor: 'pointer' },
        onClick: (e) => { e.stopPropagation(); openModal(_dayPopup(date, dayEvents)); },
      }, `+${overflow} more`) : null,
    ].filter(Boolean)));
  }
  return cells;
}

/**
 * @param {number} year
 * @param {number} month - 0-indexed (0=January)
 * @returns {HTMLElement} calendar view root
 */
export function renderCalendarView(year, month) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  const events = _getEvents(monthStart, monthEnd);

  let viewMode = 'month';
  // start of the week containing the 1st (for week view default)
  const firstWeekStart = new Date(year, month, 1 - monthStart.getDay());

  function _render() {
    if (viewMode === 'week') {
      const cells = _buildWeekGrid(year, month, firstWeekStart, events);
      return h('div', {
        class: 'cal-grid cal-week',
        style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0' },
      }, cells);
    }
    const cells = _buildMonthGrid(year, month, events);
    return h('div', {
      class: 'cal-grid cal-month',
      style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0' },
    }, cells);
  }

  const headerRow = DAY_NAMES.map(dn => h('div', {
    style: { fontSize: '11px', fontWeight: '600', color: 'var(--text-muted, #7a7a85)', textAlign: 'center', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '.05em' },
  }, dn));

  // toggle
  const monthBtn = h('button', {
    type: 'button',
    class: 'cal-toggle-btn active',
    style: _toggleBtnStyle(true),
    onClick: () => {
      viewMode = 'month';
      gridWrap.querySelector('.cal-grid')?.replaceWith(_render());
      monthBtn.classList.add('active'); weekBtn.classList.remove('active');
      monthBtn.style.background = 'var(--brand-accent, #00d4c8)'; monthBtn.style.color = '#0b0b0f';
      weekBtn.style.background = 'transparent'; weekBtn.style.color = 'var(--text-muted, #9a9aa5)';
    },
  }, 'Month');
  const weekBtn = h('button', {
    type: 'button',
    class: 'cal-toggle-btn',
    style: _toggleBtnStyle(false),
    onClick: () => {
      viewMode = 'week';
      gridWrap.querySelector('.cal-grid')?.replaceWith(_render());
      weekBtn.classList.add('active'); monthBtn.classList.remove('active');
      weekBtn.style.background = 'var(--brand-accent, #00d4c8)'; weekBtn.style.color = '#0b0b0f';
      monthBtn.style.background = 'transparent'; monthBtn.style.color = 'var(--text-muted, #9a9aa5)';
    },
  }, 'Week');

  const toggle = h('div', {
    class: 'cal-toggle',
    style: { display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border, #2a2a35)' },
  }, [monthBtn, weekBtn]);

  const monthLabel = h('div', {
    style: { fontSize: '16px', fontWeight: '600', color: 'var(--text, #f1f1f5)' },
  }, monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));

  const gridWrap = h('div', {
    class: 'calendar-view',
    style: { width: '100%' },
  }, [
    h('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' },
    }, [monthLabel, toggle]),
    h('div', {
      class: 'cal-header-row',
      style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' },
    }, headerRow),
    _render(),
  ]);

  return gridWrap;
}

function _toggleBtnStyle(active) {
  return {
    minHeight: '44px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    border: 'none',
    background: active ? 'var(--brand-accent, #00d4c8)' : 'transparent',
    color: active ? '#0b0b0f' : 'var(--text-muted, #9a9aa5)',
    cursor: 'pointer',
  };
}

export default renderCalendarView;

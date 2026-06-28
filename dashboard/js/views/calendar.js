// views/calendar.js — Calendar tab for the v4 dashboard.
//
// Exports renderCalendarView() which returns a DOM node. Contains a
// month/week toggle, a calendar grid (delegated to components/calendar_view.js
// renderCalendarView(year, month)), and prev/next month navigation buttons.
//
// Dark theme, mobile-first, 44px touch targets. Built with h() from utils/dom.

import { getState } from '../store.js';
import * as calendar from '../calendar.js';
import { renderCalendarView as renderCalendarGrid } from '../components/calendar_view.js';
import { renderCard } from '../components/card.js';
import { openModal } from '../components/modal.js';
import { h } from '../utils/dom.js';

// Module-scoped anchor date (persists across re-renders within session).
let _anchor = new Date();

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

function _navBtnStyle() {
  return {
    minHeight: '44px',
    minWidth: '44px',
    padding: '8px 14px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text, #f1f1f5)',
    background: 'rgba(150,150,160,.06)',
    border: '1px solid var(--border, #2a2a35)',
    borderRadius: '8px',
    cursor: 'pointer',
  };
}

// ─── Public: renderCalendarView() ────────────────────────────────────────────

export function renderCalendarView() {
  const year = _anchor.getFullYear();
  const month = _anchor.getMonth();

  // Grid host — the calendar_view component renders into here and manages its
  // own internal month/week toggle state.
  const gridHost = h('div', { class: 'cal-grid-host', style: { width: '100%' } });
  try {
    const grid = renderCalendarGrid(year, month);
    if (grid) gridHost.appendChild(grid);
  } catch (err) {
    gridHost.appendChild(h('div', {
      style: { padding: '24px', textAlign: 'center', color: 'var(--text-muted, #7a7a85)', fontSize: '13px' },
    }, 'Calendar grid unavailable.'));
    console.error('renderCalendarGrid failed:', err);
  }

  // Month label
  const monthLabel = h('div', {
    style: { fontSize: '16px', fontWeight: '700', color: 'var(--text, #f1f1f5)' },
  }, `${MONTH_NAMES[month]} ${year}`);

  // Prev / Next buttons
  const prevBtn = h('button', {
    type: 'button',
    class: 'cal-nav-btn',
    'aria-label': 'Previous month',
    on: { click: () => {
      _anchor = new Date(_anchor.getFullYear(), _anchor.getMonth() - 1, 1);
      _refresh();
    } },
    style: _navBtnStyle(),
  }, '←');

  const nextBtn = h('button', {
    type: 'button',
    class: 'cal-nav-btn',
    'aria-label': 'Next month',
    on: { click: () => {
      _anchor = new Date(_anchor.getFullYear(), _anchor.getMonth() + 1, 1);
      _refresh();
    } },
    style: _navBtnStyle(),
  }, '→');

  const todayBtn = h('button', {
    type: 'button',
    class: 'cal-today-btn',
    on: { click: () => {
      _anchor = new Date();
      _refresh();
    } },
    style: Object.assign({}, _navBtnStyle(), { padding: '8px 16px' }),
  }, 'Today');

  // Header row: prev | label | next | today
  const header = h('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '8px', marginBottom: '14px', flexWrap: 'wrap',
    },
  }, [
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [prevBtn, monthLabel, nextBtn]),
    todayBtn,
  ]);

  const root = h('div', {
    class: 'calendar-view-root',
    style: { width: '100%', maxWidth: '900px', margin: '0 auto', boxSizing: 'border-box' },
  }, [header, gridHost]);

  function _refresh() {
    const ny = _anchor.getFullYear();
    const nm = _anchor.getMonth();
    // Update label
    monthLabel.textContent = `${MONTH_NAMES[nm]} ${ny}`;
    // Rebuild grid
    gridHost.innerHTML = '';
    try {
      const fresh = renderCalendarGrid(ny, nm);
      if (fresh) gridHost.appendChild(fresh);
    } catch (err) {
      gridHost.appendChild(h('div', {
        style: { padding: '24px', textAlign: 'center', color: 'var(--text-muted, #7a7a85)', fontSize: '13px' },
      }, 'Calendar grid unavailable.'));
      console.error('renderCalendarGrid failed:', err);
    }
  }

  return root;
}

export default renderCalendarView;

// views/home.js — Home tab for the v4 dashboard.
//
// Exports renderHome() which returns a DOM node (does NOT touch a container).
// Composes: tour status banner, gigs-needed widget, financial summary,
// today's todos (grouped by priority), and quick-add buttons.
//
// Dark theme, mobile-first, 44px touch targets. Built with h() from utils/dom.

import { getState } from '../store.js';
import * as finance from '../finance.js';
import * as gigsNeeded from '../gigs_needed.js';
import * as todos from '../todos.js';
import * as crud from '../crud.js';
import { renderForm } from '../components/form.js';
import { openModal, closeModal } from '../components/modal.js';
import { renderBadge } from '../components/badge.js';
import { renderTodoList } from '../components/todo_list.js';
import { h } from '../utils/dom.js';
import { formatAUD } from '../utils/money.js';
import { formatDate, today } from '../utils/dates.js';
import { generateId } from '../utils/id.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _config() {
  const s = getState() || {};
  const e = s.entities || {};
  return (e.config || [])[0] || {};
}

function _num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function _tourStops() {
  const s = getState() || {};
  return (s.entities && s.entities.tour_stops) || [];
}

function _activeTourStops() {
  return _tourStops().filter((t) => (t.status || 'active') === 'active');
}

function _sectionStyle() {
  return {
    background: 'var(--bg-elevated, #15151c)',
    border: '1px solid var(--border, #2a2a35)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '14px',
    boxSizing: 'border-box',
    width: '100%',
  };
}

function _cardTitleStyle() {
  return {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-muted, #9a9aa5)',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    marginBottom: '12px',
  };
}

// ─── Tour status banner ──────────────────────────────────────────────────────

function _renderTourBanner() {
  const cfg = _config();
  const stops = _activeTourStops();
  const total = stops.length;
  const completed = stops.filter((t) => t.completed).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const target = _num(cfg.revenue_target_aud);
  const earned = finance.getTourActualIncome();
  const earnedPct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
  const targetStr = target > 0 ? formatAUD(target) : '$37,000.00';

  const barColor = earnedPct >= 80 ? '#4cd980' : earnedPct >= 50 ? '#f5b042' : '#eb5757';

  return h('section', { class: 'home-tour-banner', style: _sectionStyle() }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' } }, [
      h('div', { style: { flex: '1 1 60%', minWidth: '0' } }, [
        h('div', { style: { fontSize: '11px', color: 'var(--text-muted, #7a7a85)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '4px' } }, 'Tour'),
        h('div', { style: { fontSize: '18px', fontWeight: '700', color: 'var(--text, #f1f1f5)', lineHeight: '1.2' } }, cfg.tour_name || 'Untitled Tour'),
      ]),
      h('div', { style: { flex: '0 0 auto', textAlign: 'right' } }, [
        h('div', { style: { fontSize: '11px', color: 'var(--text-muted, #7a7a85)' } }, `${cfg.tour_start_date || '—'} → ${cfg.tour_end_date || '—'}`),
      ]),
    ]),

    // Tour-stop progress
    h('div', { style: { marginBottom: '14px' } }, [
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' } }, [
        h('span', { style: { fontSize: '12px', color: 'var(--text-muted, #9a9aa5)' } }, 'Tour stops completed'),
        h('span', { style: { fontSize: '12px', fontWeight: '600', color: 'var(--text, #f1f1f5)' } }, `${completed} / ${total} · ${pct}%`),
      ]),
      h('div', { style: { position: 'relative', height: '10px', background: 'rgba(150,150,160,.12)', borderRadius: '5px', overflow: 'hidden' } }, [
        h('div', { style: { position: 'absolute', inset: '0 auto 0 0', width: `${pct}%`, background: '#00d4c8', borderRadius: '5px', transition: 'width .3s ease' } }),
      ]),
    ]),

    // Revenue progress vs target
    h('div', {}, [
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' } }, [
        h('span', { style: { fontSize: '12px', color: 'var(--text-muted, #9a9aa5)' } }, 'Earned vs target'),
        h('span', { style: { fontSize: '12px', fontWeight: '600', color: barColor } }, `${formatAUD(earned)} / ${targetStr}`),
      ]),
      h('div', { style: { position: 'relative', height: '10px', background: 'rgba(150,150,160,.12)', borderRadius: '5px', overflow: 'hidden' } }, [
        h('div', { style: { position: 'absolute', inset: '0 auto 0 0', width: `${earnedPct}%`, background: barColor, borderRadius: '5px', transition: 'width .3s ease' } }),
      ]),
    ]),
  ]);
}

// ─── Gigs-needed widget ──────────────────────────────────────────────────────

function _renderGigsNeeded() {
  const cfg = _config();
  const target = _num(cfg.revenue_target_aud);
  const targetStr = target > 0 ? formatAUD(target) : '$37,000.00';
  const needed = gigsNeeded.getTourGigsNeeded();

  return h('section', { class: 'home-gigs-needed', style: _sectionStyle() }, [
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
      h('div', { style: { fontSize: '28px', lineHeight: '1' } }, '📊'),
      h('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [
        h('div', { style: { fontSize: '20px', fontWeight: '700', color: needed > 0 ? '#f5b042' : '#4cd980' } }, String(needed)),
        h('div', { style: { fontSize: '13px', color: 'var(--text-muted, #9a9aa5)' } }, `more gigs needed to hit ${targetStr}`),
      ]),
    ]),
  ]);
}

// ─── Financial summary ───────────────────────────────────────────────────────

function _renderFinancialSummary() {
  const earned = finance.getTourActualIncome();
  const projected = finance.getTourProjectedIncome();
  const expenses = finance.getTourActualExpenses();
  const net = finance.getTourNetActual();
  const netColor = net >= 0 ? '#4cd980' : '#eb5757';

  const tile = (label, amount, color) => h('div', {
    style: {
      flex: '1 1 40%',
      minWidth: '140px',
      background: 'rgba(150,150,160,.05)',
      border: '1px solid var(--border, #222230)',
      borderRadius: '10px',
      padding: '14px',
      boxSizing: 'border-box',
    },
  }, [
    h('div', { style: { fontSize: '11px', color: 'var(--text-muted, #7a7a85)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' } }, label),
    h('div', { style: { fontSize: '20px', fontWeight: '700', color } }, formatAUD(amount)),
  ]);

  return h('section', { class: 'home-financials', style: _sectionStyle() }, [
    h('div', { style: _cardTitleStyle() }, 'Financial Summary'),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px' } }, [
      tile('Earned', earned, '#4cd980'),
      tile('Projected', projected, '#00d4c8'),
      tile('Expenses', expenses, '#f5b042'),
      tile('Net (actual)', net, netColor),
    ]),
  ]);
}

// ─── Today's todos ───────────────────────────────────────────────────────────

function _renderTodosSection() {
  const all = todos.getActiveTodos();
  const todayStr = today();
  // "Today's todos" = due today or overdue or no due date (still actionable now).
  const todays = all.filter((t) => {
    if (!t.due_date) return true; // no due date — show it
    return t.due_date <= todayStr; // due today or earlier (overdue)
  });

  const groups = { high: [], medium: [], low: [] };
  for (const t of todays) {
    const p = (t.priority || 'medium').toLowerCase();
    if (groups[p]) groups[p].push(t);
    else groups.medium.push(t);
  }
  const order = ['high', 'medium', 'low'];
  const labels = { high: 'High', medium: 'Medium', low: 'Low' };

  const sections = order
    .filter((k) => groups[k].length > 0)
    .map((k) => _renderTodoGroup(k, labels[k], groups[k]));

  return h('section', { class: 'home-todos', style: _sectionStyle() }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } }, [
      h('div', { style: _cardTitleStyle(), margin: '0' }, "Today's Todos"),
      h('span', { style: { fontSize: '11px', color: 'var(--text-muted, #7a7a85)' } }, `${todays.length} active`),
    ]),
    sections.length > 0
      ? h('div', {}, ...sections)
      : h('div', { style: { padding: '24px 8px', textAlign: 'center', color: 'var(--text-muted, #7a7a85)', fontSize: '13px' } }, 'No todos due today. 🎉'),
  ]);
}

function _renderTodoGroup(priority, label, items) {
  return h('div', { class: 'todo-group', data: { priority }, style: { marginBottom: '12px' } }, [
    h('div', {
      style: {
        fontSize: '11px', fontWeight: '700', color: 'var(--text-muted, #9a9aa5)',
        textTransform: 'uppercase', letterSpacing: '.05em', padding: '4px 0',
        borderBottom: '1px solid var(--border, #222230)', marginBottom: '4px',
      },
    }, `${label} · ${items.length}`),
    ...items.map((t) => _renderTodoRow(t)),
  ]);
}

function _renderTodoRow(todo) {
  const done = !!todo.completed;
  const overdue = todo.due_date && todo.due_date < today();

  const checkbox = h('input', {
    type: 'checkbox',
    checked: done,
    'aria-label': 'Mark complete',
    on: { change: (ev) => {
      const checked = ev.target.checked;
      const now = new Date().toISOString();
      crud.update('todos', todo.id, { completed: checked, completed_at: checked ? now : null })
        .then(() => {
          document.dispatchEvent(new CustomEvent('tour-os:crud-changed'));
        })
        .catch(() => {});
      titleEl.style.textDecoration = checked ? 'line-through' : 'none';
      titleEl.style.opacity = checked ? '.55' : '1';
    } },
    style: { width: '20px', height: '20px', minHeight: '44px', minWidth: '44px', flex: '0 0 auto', marginTop: '2px' },
  });

  const titleEl = h('div', {
    style: {
      flex: '1 1 auto', minWidth: '0', fontSize: '14px', color: 'var(--text, #f1f1f5)',
      textDecoration: done ? 'line-through' : 'none', opacity: done ? '.55' : '1',
      wordBreak: 'break-word', padding: '4px 6px', minHeight: '44px',
      display: 'flex', alignItems: 'center',
    },
  }, todo.title || 'Untitled');

  const meta = [];
  if (todo.is_auto_generated) meta.push(renderBadge('auto'));
  if (todo.due_date) {
    meta.push(h('span', {
      style: { fontSize: '11px', color: overdue ? '#eb5757' : 'var(--text-muted, #9a9aa5)', whiteSpace: 'nowrap' },
    }, '📅 ' + formatDate(todo.due_date)));
  }

  return h('div', {
    class: 'todo-row', data: { id: todo.id, priority: (todo.priority || 'medium').toLowerCase() },
    style: { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 4px', borderBottom: '1px solid var(--border, #222230)', minHeight: '44px' },
  }, [checkbox, titleEl, meta.length ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flexShrink: '0' } }, meta) : null].filter(Boolean));
}

// ─── Quick-add buttons ───────────────────────────────────────────────────────

const QUICK_ADDS = [
  { label: 'New Venue', type: 'venue', icon: '🎸' },
  { label: 'New HC Lead', type: 'hc', icon: '🏠' },
  { label: 'New Busking Spot', type: 'busking_spot', icon: '🎷' },
  { label: 'Log Busking Session', type: 'busking_session', icon: '💵' },
  { label: 'Log Expense', type: 'expense', icon: '🧾' },
];

const FORM_FIELDS = {
  venue: [
    { name: 'name', label: 'Venue name', type: 'text', required: true },
    { name: 'city', label: 'City', type: 'text' },
    { name: 'capacity', label: 'Capacity', type: 'number' },
    { name: 'pipeline_status', label: 'Pipeline status', type: 'select', options: [
      { value: 'not_contacted', label: 'Not contacted' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'follow_up', label: 'Follow up' },
      { value: 'booked', label: 'Booked' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'played', label: 'Played' },
    ] },
  ],
  hc: [
    { name: 'host_contact_id', label: 'Host contact (id)', type: 'text' },
    { name: 'hc_date', label: 'Date', type: 'date' },
    { name: 'capacity', label: 'Capacity', type: 'number' },
    { name: 'suggested_donation_aud', label: 'Suggested donation ($)', type: 'number' },
    { name: 'pipeline_status', label: 'Pipeline status', type: 'select', options: [
      { value: 'posted', label: 'Posted' },
      { value: 'interested', label: 'Interested' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'completed', label: 'Completed' },
    ] },
  ],
  busking_spot: [
    { name: 'name', label: 'Spot name', type: 'text', required: true },
    { name: 'address_hint', label: 'Address hint', type: 'text' },
    { name: 'council_permit_required', label: 'Permit required?', type: 'checkbox' },
    { name: 'pipeline_status', label: 'Pipeline status', type: 'select', options: [
      { value: 'discovered', label: 'Discovered' },
      { value: 'tested', label: 'Tested' },
      { value: 'regular', label: 'Regular' },
    ] },
  ],
  busking_session: [
    { name: 'session_date', label: 'Date', type: 'date', required: true },
    { name: 'start_time', label: 'Start time', type: 'time' },
    { name: 'duration_min', label: 'Duration (min)', type: 'number' },
    { name: 'income_aud', label: 'Income ($)', type: 'number' },
    { name: 'income_source', label: 'Income source', type: 'text' },
  ],
  expense: [
    { name: 'category', label: 'Category', type: 'select', options: [
      { value: 'fuel', label: 'Fuel' },
      { value: 'food', label: 'Food' },
      { value: 'accommodation', label: 'Accommodation' },
      { value: 'vet', label: 'Vet' },
      { value: 'gear', label: 'Gear' },
      { value: 'permit', label: 'Permit' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'other', label: 'Other' },
    ] },
    { name: 'amount_aud', label: 'Amount ($)', type: 'number', required: true },
    { name: 'incurred_date', label: 'Date incurred', type: 'date' },
    { name: 'vendor', label: 'Vendor', type: 'text' },
    { name: 'description', label: 'Description', type: 'text' },
  ],
};

const STORE_BY_TYPE = {
  venue: 'venues',
  hc: 'house_concerts',
  busking_spot: 'busking_spots',
  busking_session: 'busking_sessions',
  expense: 'expense_log',
};

function _openCreateForm(type) {
  const fields = FORM_FIELDS[type] || [];
  const storeName = STORE_BY_TYPE[type];
  if (!storeName) return;

  const form = renderForm(type, fields, null, (values) => {
    const record = { ...values, id: generateId(type + '_') };
    // Normalize numeric fields
    for (const f of fields) {
      if (f.type === 'number' && record[f.name] != null) {
        record[f.name] = parseFloat(record[f.name]) || 0;
      }
    }
    crud.create(storeName, record)
      .then(() => {
        closeModal();
        document.dispatchEvent(new CustomEvent('tour-os:crud-changed'));
      })
      .catch((err) => {
        console.error('Create failed:', err);
      });
  });

  const wrap = h('div', { style: { width: '100%' } }, [
    h('div', { style: { fontSize: '16px', fontWeight: '700', color: 'var(--text, #f1f1f5)', marginBottom: '14px' } }, `New ${type.replace(/_/g, ' ')}`),
    form,
  ]);
  openModal(wrap);
}

function _renderQuickAdd() {
  const buttons = QUICK_ADDS.map((qa) => h('button', {
    type: 'button',
    class: 'quick-add-btn',
    on: { click: () => _openCreateForm(qa.type) },
    style: {
      minHeight: '44px',
      padding: '10px 12px',
      fontSize: '13px',
      fontWeight: '600',
      color: 'var(--text, #f1f1f5)',
      background: 'rgba(150,150,160,.06)',
      border: '1px solid var(--border, #2a2a35)',
      borderRadius: '10px',
      cursor: 'pointer',
      flex: '1 1 120px',
      minWidth: '120px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
    },
  }, qa.icon + ' ' + qa.label));

  return h('section', { class: 'home-quick-add', style: _sectionStyle() }, [
    h('div', { style: _cardTitleStyle() }, 'Quick Add'),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } }, buttons),
  ]);
}

// ─── Public: renderHome() ────────────────────────────────────────────────────

export function renderHome() {
  return h('div', {
    class: 'home-view',
    style: { width: '100%', maxWidth: '720px', margin: '0 auto', boxSizing: 'border-box', padding: '4px' },
  }, [
    _renderTourBanner(),
    _renderGigsNeeded(),
    _renderFinancialSummary(),
    _renderTodosSection(),
    _renderQuickAdd(),
  ]);
}

export default renderHome;

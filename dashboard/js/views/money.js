// views/money.js — Money tab for the v4 dashboard.
//
// Exports renderMoney() which returns a DOM node. Contains:
//  - Summary cards: earned, projected, expenses, net, % to target
//  - Income ledger (derived from busking_sessions + gigs.actual_income +
//    house_concerts.actual_income), filterable by type
//  - Expense ledger (from expense_log), filterable by category, each entry
//    editable/deletable
//  - Tour progress bar: $ earned vs $ target
//  - Settings card: editable config (tour target, default gig/busking targets)
//
// Dark theme, mobile-first, 44px touch targets. Built with h() from utils/dom.

import { getState } from '../store.js';
import * as crud from '../crud.js';
import * as finance from '../finance.js';
import { renderForm } from '../components/form.js';
import { openModal, closeModal } from '../components/modal.js';
import { renderBadge } from '../components/badge.js';
import { h } from '../utils/dom.js';
import { formatAUD } from '../utils/money.js';
import { formatDate } from '../utils/dates.js';
import { generateId } from '../utils/id.js';

// Module-scoped UI state (persists across re-renders within session).
let _incomeFilter = 'all';   // 'all' | 'busking' | 'gig' | 'hc'
let _expenseFilter = 'all';  // 'all' | <category>
let _incomeSortDir = 'desc'; // 'desc' (newest first) | 'asc'

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLORS = {
  cyan: '#00d4c8',
  magenta: '#dc78dc',
  amber: '#f5b042',
  green: '#4cd980',
  red: '#eb5757',
  gray: '#9a9aa5',
  text: '#f1f1f5',
  bg: '#15151c',
  muted: '#9a9aa5',
};

const INCOME_TYPE_COLORS = { busking: COLORS.amber, gig: COLORS.cyan, hc: COLORS.magenta };
const INCOME_TYPE_LABELS = { busking: 'Busking', gig: 'Gig', hc: 'House Concert' };

const EXPENSE_CATEGORY_COLORS = {
  fuel: COLORS.amber, food: COLORS.amber, accommodation: COLORS.cyan,
  vet: COLORS.magenta, gear: COLORS.cyan, permit: COLORS.green,
  marketing: COLORS.magenta, other: COLORS.gray,
};
const EXPENSE_FILTERS = ['all', 'fuel', 'food', 'accommodation', 'vet', 'gear', 'permit', 'marketing', 'other'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _entities() {
  const s = getState() || {};
  return s.entities || {};
}

function _config() {
  return (_entities().config || [])[0] || {};
}

function _expenseLog() {
  return (_entities().expense_log || []).filter((r) => (r.status || 'active') === 'active');
}

function _num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
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

function _sectionTitleStyle() {
  return {
    margin: '0 0 12px',
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text, #f1f1f5)',
  };
}

// ─── Summary cards ───────────────────────────────────────────────────────────

function _renderSummaryCards() {
  const earned = finance.getTourActualIncome();
  const projected = finance.getTourProjectedIncome();
  const expenses = finance.getTourActualExpenses();
  const net = finance.getTourNetActual();
  const target = _num(_config().revenue_target_aud);
  const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
  const netColor = net >= 0 ? COLORS.green : COLORS.red;

  const tile = (label, value, color) => h('div', {
    style: {
      flex: '1 1 40%', minWidth: '140px', boxSizing: 'border-box',
      background: 'rgba(150,150,160,.05)', border: '1px solid var(--border, #222230)',
      borderRadius: '10px', padding: '14px',
    },
  }, [
    h('div', { style: { fontSize: '11px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '6px' } }, label),
    h('div', { style: { fontSize: '20px', fontWeight: '700', color } }, value),
  ]);

  return h('section', { class: 'money-summary', style: _sectionStyle() }, [
    h('h3', { style: _sectionTitleStyle() }, 'Summary'),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px' } }, [
      tile('Earned', formatAUD(earned), COLORS.green),
      tile('Projected', formatAUD(projected), COLORS.cyan),
      tile('Expenses', formatAUD(expenses), COLORS.amber),
      tile('Net', formatAUD(net), netColor),
      tile('% to target', pct.toFixed(1) + '%', pct >= 80 ? COLORS.green : pct >= 50 ? COLORS.amber : COLORS.red),
    ]),
  ]);
}

// ─── Tour progress bar ───────────────────────────────────────────────────────

function _renderProgressBar() {
  const earned = finance.getTourActualIncome();
  const target = _num(_config().revenue_target_aud);
  const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
  const barColor = pct >= 80 ? COLORS.green : pct >= 50 ? COLORS.amber : COLORS.red;
  const targetStr = target > 0 ? formatAUD(target) : '—';

  return h('section', { class: 'money-progress', style: _sectionStyle() }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' } }, [
      h('span', { style: { fontSize: '13px', fontWeight: '600', color: COLORS.text } }, 'Tour Revenue Progress'),
      h('span', { style: { fontSize: '12px', color: COLORS.muted } }, `${formatAUD(earned)} of ${targetStr}`),
    ]),
    h('div', { style: { position: 'relative', height: '14px', background: 'rgba(150,150,160,.12)', borderRadius: '7px', overflow: 'hidden' } }, [
      h('div', { style: { position: 'absolute', inset: '0 auto 0 0', width: pct + '%', background: barColor, borderRadius: '7px', transition: 'width .3s ease' } }),
    ]),
    h('div', { style: { marginTop: '6px', fontSize: '12px', fontWeight: '600', color: barColor } }, `${pct.toFixed(1)}% to goal`),
  ]);
}

// ─── Filter chips ────────────────────────────────────────────────────────────

function _renderFilterChips(active, filters, onPick) {
  return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' } },
    filters.map((f) => {
      const isActive = f === active;
      const label = f === 'all' ? 'All' : (f.charAt(0).toUpperCase() + f.slice(1));
      return h('button', {
        type: 'button',
        data: { filter: f },
        on: { click: () => onPick(f) },
        style: {
          minHeight: '44px', padding: '6px 12px', fontSize: '12px', fontWeight: '600',
          borderRadius: '999px', border: '1px solid ' + (isActive ? COLORS.cyan : 'transparent'),
          background: isActive ? 'rgba(0,212,200,.12)' : 'transparent',
          color: isActive ? COLORS.cyan : COLORS.muted, cursor: 'pointer', whiteSpace: 'nowrap',
        },
      }, label);
    }),
  );
}

// ─── Income ledger ───────────────────────────────────────────────────────────

function _renderIncomeLedger(refresh) {
  let rows = finance.getIncomeLedger();
  if (_incomeFilter !== 'all') rows = rows.filter((r) => r.type === _incomeFilter);
  rows.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    const cmp = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    return _incomeSortDir === 'desc' ? -cmp : cmp;
  });
  const total = rows.reduce((a, r) => a + _num(r.amount), 0);
  const sortLabel = _incomeSortDir === 'desc' ? 'Newest first ↓' : 'Oldest first ↑';

  const rowEls = rows.length === 0
    ? [h('div', { style: { padding: '20px', textAlign: 'center', color: COLORS.muted, fontSize: '13px' } }, 'No income entries.')]
    : rows.map((r) => {
        const color = INCOME_TYPE_COLORS[r.type] || COLORS.gray;
        const label = INCOME_TYPE_LABELS[r.type] || r.type;
        return h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border, #222230)', minHeight: '44px' },
        }, [
          h('div', { style: { flex: '0 0 90px', fontSize: '12px', color: COLORS.muted } }, r.date ? formatDate(r.date) : '—'),
          h('div', { style: { flex: '0 0 auto' } }, [h('span', {
            style: { display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', letterSpacing: '.04em', textTransform: 'uppercase', background: color + '22', color, whiteSpace: 'nowrap' },
          }, label)]),
          h('div', { style: { flex: '1', fontSize: '13px', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, r.source || ''),
          h('div', { style: { flex: '0 0 auto', fontSize: '14px', fontWeight: '700', color: COLORS.green } }, formatAUD(r.amount)),
        ]);
      });

  return h('section', { class: 'money-income-ledger', style: _sectionStyle() }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } }, [
      h('h3', { style: _sectionTitleStyle(), margin: '0' }, 'Income Ledger'),
      h('button', {
        type: 'button',
        on: { click: () => { _incomeSortDir = _incomeSortDir === 'desc' ? 'asc' : 'desc'; refresh(); } },
        style: { background: 'none', border: 'none', color: COLORS.muted, fontSize: '12px', cursor: 'pointer', padding: '4px 8px', minHeight: '44px' },
      }, sortLabel),
    ]),
    _renderFilterChips(_incomeFilter, ['all', 'busking', 'gig', 'hc'], (f) => { _incomeFilter = f; refresh(); }),
    h('div', { class: 'income-list' }, rowEls),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 0', marginTop: '4px', borderTop: '1px solid var(--border, #2a2a35)' } }, [
      h('span', { style: { fontSize: '13px', fontWeight: '600', color: COLORS.muted } }, 'Total'),
      h('span', { style: { fontSize: '15px', fontWeight: '700', color: COLORS.green } }, formatAUD(total)),
    ]),
  ]);
}

// ─── Expense ledger ──────────────────────────────────────────────────────────

const EXPENSE_FIELDS = [
  { name: 'category', label: 'Category', type: 'select', options: [
    { value: 'fuel', label: 'Fuel' }, { value: 'food', label: 'Food' },
    { value: 'accommodation', label: 'Accommodation' }, { value: 'vet', label: 'Vet' },
    { value: 'gear', label: 'Gear' }, { value: 'permit', label: 'Permit' },
    { value: 'marketing', label: 'Marketing' }, { value: 'other', label: 'Other' },
  ] },
  { name: 'amount_aud', label: 'Amount ($)', type: 'number', required: true },
  { name: 'incurred_date', label: 'Date incurred', type: 'date' },
  { name: 'vendor', label: 'Vendor', type: 'text' },
  { name: 'description', label: 'Description', type: 'text' },
];

function _openExpenseForm(existing, onSaved) {
  const form = renderForm('expense', EXPENSE_FIELDS, existing, (values) => {
    const cleaned = { ...values };
    if (cleaned.amount_aud != null) cleaned.amount_aud = parseFloat(cleaned.amount_aud) || 0;
    if (existing) {
      crud.update('expense_log', existing.id, cleaned)
        .then(() => { closeModal(); onSaved(); })
        .catch((err) => console.error('Update failed:', err));
    } else {
      const record = { ...cleaned, id: generateId('exp_') };
      crud.create('expense_log', record)
        .then(() => { closeModal(); onSaved(); })
        .catch((err) => console.error('Create failed:', err));
    }
  });

  const wrap = h('div', { style: { width: '100%' } }, [
    h('div', { style: { fontSize: '16px', fontWeight: '700', color: COLORS.text, marginBottom: '14px' } }, existing ? 'Edit Expense' : 'New Expense'),
    form,
  ]);
  openModal(wrap);
}

function _renderExpenseLedger(refresh) {
  let rows = _expenseLog().slice().sort((a, b) => {
    const da = a.incurred_date || '';
    const db = b.incurred_date || '';
    if (da === db) return 0;
    return da < db ? 1 : -1; // newest first
  });
  if (_expenseFilter !== 'all') rows = rows.filter((r) => r.category === _expenseFilter);
  const total = rows.reduce((a, r) => a + _num(r.amount_aud), 0);

  const rowEls = rows.length === 0
    ? [h('div', { style: { padding: '20px', textAlign: 'center', color: COLORS.muted, fontSize: '13px' } }, 'No expense entries.')]
    : rows.map((r) => {
        const color = EXPENSE_CATEGORY_COLORS[r.category] || COLORS.gray;
        const catLabel = r.category ? (r.category.charAt(0).toUpperCase() + r.category.slice(1)) : 'Other';
        return h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border, #222230)', minHeight: '44px' },
        }, [
          h('div', { style: { flex: '0 0 90px', fontSize: '12px', color: COLORS.muted } }, r.incurred_date ? formatDate(r.incurred_date) : '—'),
          h('div', { style: { flex: '0 0 auto' } }, [h('span', {
            style: { display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '700', letterSpacing: '.04em', textTransform: 'uppercase', background: color + '22', color, whiteSpace: 'nowrap' },
          }, catLabel)]),
          h('div', { style: { flex: '1', minWidth: '0', fontSize: '13px', color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            (r.vendor || '') + (r.description ? ' — ' + r.description : '')),
          h('div', { style: { flex: '0 0 auto', fontSize: '14px', fontWeight: '700', color: COLORS.amber } }, formatAUD(r.amount_aud)),
          h('div', { style: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '6px' } }, [
            h('button', {
              type: 'button', 'aria-label': 'Edit expense',
              on: { click: () => _openExpenseForm(r, refresh) },
              style: { minHeight: '44px', minWidth: '44px', background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', fontSize: '16px', padding: '4px', lineHeight: '1' },
            }, '✎'),
            h('button', {
              type: 'button', 'aria-label': 'Delete expense',
              on: { click: () => {
                if (confirm('Delete this expense? This cannot be undone.')) {
                  crud.deleteEntity('expense_log', r.id)
                    .then(() => refresh())
                    .catch((err) => console.error('Delete failed:', err));
                }
              } },
              style: { minHeight: '44px', minWidth: '44px', background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: '16px', padding: '4px', lineHeight: '1' },
            }, '🗑'),
          ]),
        ]);
      });

  return h('section', { class: 'money-expense-ledger', style: _sectionStyle() }, [
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } }, [
      h('h3', { style: _sectionTitleStyle(), margin: '0' }, 'Expense Ledger'),
      h('button', {
        type: 'button',
        on: { click: () => _openExpenseForm(null, refresh) },
        style: { background: COLORS.cyan, color: '#0b0b0f', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', minHeight: '44px' },
      }, '+ Add Expense'),
    ]),
    _renderFilterChips(_expenseFilter, EXPENSE_FILTERS, (f) => { _expenseFilter = f; refresh(); }),
    h('div', { class: 'expense-list' }, rowEls),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 0', marginTop: '4px', borderTop: '1px solid var(--border, #2a2a35)' } }, [
      h('span', { style: { fontSize: '13px', fontWeight: '600', color: COLORS.muted } }, 'Total'),
      h('span', { style: { fontSize: '15px', fontWeight: '700', color: COLORS.amber } }, formatAUD(total)),
    ]),
  ]);
}

// ─── Settings card ───────────────────────────────────────────────────────────

const SETTINGS_FIELDS = [
  { name: 'revenue_target_aud', label: 'Tour target ($)', type: 'number' },
  { name: 'default_gig_target_aud', label: 'Default gig target ($)', type: 'number' },
  { name: 'default_busking_target_aud', label: 'Default busking target ($)', type: 'number' },
];

function _renderSettings(refresh) {
  const cfg = _config();

  const form = renderForm('config', SETTINGS_FIELDS, {
    revenue_target_aud: cfg.revenue_target_aud,
    default_gig_target_aud: cfg.default_gig_target_aud,
    default_busking_target_aud: cfg.default_busking_target_aud,
  }, (values) => {
    const changes = {};
    for (const f of SETTINGS_FIELDS) {
      if (values[f.name] != null) changes[f.name] = parseFloat(values[f.name]) || 0;
    }
    crud.update('config', cfg.id || 'cfg_singleton', changes)
      .then(() => { closeModal(); refresh(); })
      .catch((err) => console.error('Config save failed:', err));
  });

  const wrap = h('div', { style: { width: '100%' } }, [
    h('h3', { style: _sectionTitleStyle() }, 'Settings'),
    h('div', { style: { fontSize: '12px', color: COLORS.muted, marginBottom: '12px' } }, 'Edit tour target and default per-gig / per-busking income targets.'),
    form,
  ]);

  return h('section', { class: 'money-settings', style: _sectionStyle() }, [wrap]);
}

// ─── Public: renderMoney() ───────────────────────────────────────────────────

export function renderMoney() {
  // A host we rebuild on refresh. The refresh() callback rebuilds all sections
  // except the settings form (which is modal-only) so the user's scroll position
  // within the form is preserved.
  const host = h('div', {
    class: 'money-view',
    style: { width: '100%', maxWidth: '900px', margin: '0 auto', boxSizing: 'border-box' },
  });

  function _refresh() {
    host.innerHTML = '';
    host.appendChild(_renderSummaryCards());
    host.appendChild(_renderProgressBar());
    host.appendChild(_renderIncomeLedger(_refresh));
    host.appendChild(_renderExpenseLedger(_refresh));
    host.appendChild(_renderSettings(_refresh));
  }

  _refresh();
  return host;
}

export default renderMoney;

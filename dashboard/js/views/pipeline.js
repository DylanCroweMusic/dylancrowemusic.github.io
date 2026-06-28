// views/pipeline.js — Pipeline tab (Kanban board) for the v4 dashboard.
//
// Exports renderPipeline() which returns a DOM node. Contains a segmented
// control [Venues | House Concerts | Busking], a Kanban board (delegated to
// components/kanban.js renderKanban), and a FAB that opens a create form for
// the current pipeline type.
//
// Dark theme, mobile-first, 44px touch targets. Built with h() from utils/dom.

import { getState } from '../store.js';
import * as crud from '../crud.js';
import * as pipeline from '../pipeline.js';
import { renderKanban } from '../components/kanban.js';
import { renderForm } from '../components/form.js';
import { openModal, closeModal } from '../components/modal.js';
import { h } from '../utils/dom.js';
import { generateId } from '../utils/id.js';

// ─── Pipeline types ──────────────────────────────────────────────────────────

const PIPELINE_TYPES = [
  { key: 'venue', label: 'Venues', segmentKey: 'venues', formType: 'venue', store: 'venues' },
  { key: 'hc', label: 'House Concerts', segmentKey: 'hcs', formType: 'hc', store: 'house_concerts' },
  { key: 'busking', label: 'Busking', segmentKey: 'busking', formType: 'busking_spot', store: 'busking_spots' },
];

// Module-scoped current selection (persists across re-renders within session).
let _currentKey = 'venue';

function _currentDef() {
  return PIPELINE_TYPES.find((p) => p.key === _currentKey) || PIPELINE_TYPES[0];
}

// ─── Create-form field definitions ───────────────────────────────────────────

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
    { name: 'host_name', label: 'Host name', type: 'text', required: true },
    { name: 'city', label: 'City', type: 'text' },
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
    { name: 'area', label: 'Area', type: 'text' },
    { name: 'address_hint', label: 'Address hint', type: 'text' },
    { name: 'council_permit_required', label: 'Permit required?', type: 'checkbox' },
    { name: 'pipeline_status', label: 'Pipeline status', type: 'select', options: [
      { value: 'discovered', label: 'Discovered' },
      { value: 'tested', label: 'Tested' },
      { value: 'regular', label: 'Regular' },
    ] },
  ],
};

// ─── Segmented control ───────────────────────────────────────────────────────

function _renderSegmentedControl(onSwitch) {
  const buttons = PIPELINE_TYPES.map((p) => {
    const isActive = p.key === _currentKey;
    return h('button', {
      type: 'button',
      class: 'seg-btn' + (isActive ? ' active' : ''),
      data: { seg: p.key },
      on: { click: () => onSwitch(p.key) },
      style: {
        minHeight: '44px',
        flex: '1',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: '600',
        border: 'none',
        background: isActive ? 'var(--brand-accent, #00d4c8)' : 'transparent',
        color: isActive ? '#0b0b0f' : 'var(--text-muted, #9a9aa5)',
        cursor: 'pointer',
        transition: 'background .15s, color .15s',
      },
    }, p.label);
  });

  return h('div', {
    class: 'segmented-control',
    style: {
      display: 'flex',
      gap: '0',
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid var(--border, #2a2a35)',
      background: 'rgba(0,0,0,.25)',
      padding: '4px',
      marginBottom: '14px',
    },
  }, buttons);
}

// ─── FAB ─────────────────────────────────────────────────────────────────────

function _renderFab(def) {
  return h('button', {
    type: 'button',
    class: 'pipeline-fab',
    'aria-label': `Add new ${def.label.toLowerCase()}`,
    on: { click: () => _openCreateForm(_currentDef()) },
    style: {
      position: 'fixed',
      right: '20px',
      bottom: '80px',
      width: '52px',
      height: '52px',
      borderRadius: '50%',
      background: 'var(--brand-accent, #00d4c8)',
      color: '#0b0b0f',
      border: 'none',
      fontSize: '28px',
      fontWeight: '700',
      lineHeight: '1',
      cursor: 'pointer',
      zIndex: '8000',
      boxShadow: '0 4px 14px rgba(0,212,200,.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }, '+');
}

// ─── Create form ─────────────────────────────────────────────────────────────

function _openCreateForm(def) {
  const fields = FORM_FIELDS[def.formType] || [];
  const form = renderForm(def.formType, fields, null, (values) => {
    const record = { ...values, id: generateId(def.formType + '_') };
    // Normalize numeric fields
    for (const f of fields) {
      if (f.type === 'number' && record[f.name] != null) {
        record[f.name] = parseFloat(record[f.name]) || 0;
      }
    }
    // Sensible defaults for new pipeline entities
    if (def.formType === 'venue' && !record.pipeline_status) record.pipeline_status = 'not_contacted';
    if (def.formType === 'hc' && !record.pipeline_status) record.pipeline_status = 'posted';
    if (def.formType === 'busking_spot' && !record.pipeline_status) record.pipeline_status = 'discovered';

    crud.create(def.store, record)
      .then(() => {
        closeModal();
        document.dispatchEvent(new CustomEvent('tour-os:crud-changed'));
      })
      .catch((err) => {
        console.error('Create failed:', err);
      });
  });

  const wrap = h('div', { style: { width: '100%' } }, [
    h('div', { style: { fontSize: '16px', fontWeight: '700', color: 'var(--text, #f1f1f5)', marginBottom: '14px' } }, `New ${def.label.replace(/s$/, '')}`),
    form,
  ]);
  openModal(wrap);
}

// ─── Public: renderPipeline() ────────────────────────────────────────────────

export function renderPipeline() {
  const def = _currentDef();

  // Board host — the kanban component renders into here and manages its own
  // internal segment state. We pass the current pipeline key so it picks the
  // right entity set initially.
  const boardHost = h('div', { class: 'pipeline-board-host', style: { width: '100%', minHeight: '200px' } });
  try {
    const board = renderKanban(def.key);
    if (board) boardHost.appendChild(board);
  } catch (err) {
    // If the kanban component fails to render (e.g. service import issue),
    // show a friendly placeholder so the tab still mounts.
    boardHost.appendChild(h('div', {
      style: { padding: '24px', textAlign: 'center', color: 'var(--text-muted, #7a7a85)', fontSize: '13px' },
    }, 'Kanban board unavailable.'));
    console.error('renderKanban failed:', err);
  }

  // Segmented control: on switch, swap the board in place and update button styles.
  const seg = _renderSegmentedControl((newKey) => {
    if (newKey === _currentKey) return;
    _currentKey = newKey;
    const newDef = _currentDef();
    // Update button active states
    seg.querySelectorAll('.seg-btn').forEach((b) => {
      const on = b.getAttribute('data-seg') === newKey;
      b.classList.toggle('active', on);
      b.style.background = on ? 'var(--brand-accent, #00d4c8)' : 'transparent';
      b.style.color = on ? '#0b0b0f' : 'var(--text-muted, #9a9aa5)';
    });
    // Rebuild board
    boardHost.innerHTML = '';
    try {
      const fresh = renderKanban(newDef.key);
      if (fresh) boardHost.appendChild(fresh);
    } catch (err) {
      boardHost.appendChild(h('div', {
        style: { padding: '24px', textAlign: 'center', color: 'var(--text-muted, #7a7a85)', fontSize: '13px' },
      }, 'Kanban board unavailable.'));
      console.error('renderKanban failed:', err);
    }
    // Update FAB label/context
    fab.setAttribute('aria-label', `Add new ${newDef.label.toLowerCase()}`);
  });

  const fab = _renderFab(def);

  return h('div', {
    class: 'pipeline-view',
    style: { width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: '0' },
  }, [seg, boardHost, fab]);
}

export default renderPipeline;

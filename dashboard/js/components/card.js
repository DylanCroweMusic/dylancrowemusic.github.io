/**
 * card.js — Generic entity card shell (v4 UI)
 * renderCard(entityType, entityId) returns DOM card.
 * Header (entity name + status badge), body (fields as label:value pairs),
 * edit toggle (fields become inputs), save/archive/delete buttons,
 * cross-link chips at bottom (clicking opens another card via openModal).
 *
 * Field configs per entity are defined inline as ENTITY_CONFIG.
 *
 * @module components/card
 */
import { h } from '../utils/dom.js?v=4';
import * as crud from '../crud.js?v=4';
import * as pipeline from '../pipeline.js?v=4';
import { openModal, closeModal } from './modal.js?v=4';
import { renderBadge } from './badge.js?v=4';

// Map entityType (used by kanban/card) → IndexedDB store name
const STORE_BY_TYPE = {
  venue: 'venues',
  hc: 'house_concerts',
  busking: 'busking_spots',
  gig: 'gigs',
  contact: 'contacts',
};

function _storeName(entityType) {
  return STORE_BY_TYPE[entityType] || entityType;
}

/* ------------------------------------------------------------------ *
 * Inline per-entity config.
 * `fields`    : [{ name, label, type, options? }] for display + editing
 * `crossLinks`: [{ label, toEntity, linkField }]
 *   linkField is the key on this record whose value holds the foreign id.
 * ------------------------------------------------------------------ */
export const ENTITY_CONFIG = {
  venue: {
    label: 'Venue',
    fields: [
      { name: 'name',     label: 'Name',     type: 'text', required: true },
      { name: 'city',     label: 'City',     type: 'text' },
      { name: 'capacity', label: 'Capacity', type: 'number' },
      { name: 'contact',  label: 'Contact',  type: 'text' },
      { name: 'email',    label: 'Email',    type: 'email' },
      { name: 'phone',    label: 'Phone',    type: 'tel' },
      { name: 'fee',      label: 'Fee',      type: 'number' },
      { name: 'notes',    label: 'Notes',    type: 'textarea' },
      { name: 'pipeline_status', label: 'Pipeline status', type: 'select',
        options: [
          { value: 'not_contacted', label: 'Not contacted' },
          { value: 'contacted',     label: 'Contacted' },
          { value: 'follow_up',     label: 'Follow up' },
          { value: 'booked',        label: 'Booked' },
          { value: 'confirmed',     label: 'Confirmed' },
          { value: 'played',        label: 'Played' },
          { value: 'declined',      label: 'Declined' },
          { value: 'cancelled',     label: 'Cancelled' },
        ] },
    ],
    crossLinks: [
      { label: 'House concerts', toEntity: 'hc',     linkField: 'venue_id' },
      { label: 'Gigs',           toEntity: 'gig',    linkField: 'venue_id' },
    ],
  },
  hc: {
    label: 'House concert',
    fields: [
      { name: 'host_name', label: 'Host',    type: 'text', required: true },
      { name: 'date',      label: 'Date',    type: 'date' },
      { name: 'city',      label: 'City',    type: 'text' },
      { name: 'capacity',  label: 'Capacity',type: 'number' },
      { name: 'donation',  label: 'Donation',type: 'number' },
      { name: 'fb_ad_posted', label: 'FB ad posted', type: 'checkbox' },
      { name: 'materials_sent', label: 'Materials sent', type: 'checkbox' },
      { name: 'actual_income', label: 'Actual income', type: 'number' },
      { name: 'pipeline_status', label: 'Pipeline status', type: 'select',
        options: [
          { value: 'posted', label: 'Posted' },
          { value: 'interested', label: 'Interested' },
          { value: 'confirmed',  label: 'Confirmed' },
          { value: 'completed',  label: 'Completed' },
          { value: 'cancelled',  label: 'Cancelled' },
        ] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    crossLinks: [
      { label: 'Venue', toEntity: 'venue', linkField: 'venue_id' },
    ],
  },
  busking: {
    label: 'Busking spot',
    fields: [
      { name: 'name',     label: 'Spot',     type: 'text', required: true },
      { name: 'city',     label: 'City',     type: 'text' },
      { name: 'best_time', label: 'Best time', type: 'text' },
      { name: 'earnings_avg', label: 'Avg earnings', type: 'number' },
      { name: 'permit_required', label: 'Permit?', type: 'checkbox' },
      { name: 'pipeline_status', label: 'Pipeline status', type: 'select',
        options: [
          { value: 'not_contacted', label: 'Not contacted' },
          { value: 'contacted',     label: 'Contacted' },
          { value: 'follow_up',     label: 'Follow up' },
          { value: 'booked',        label: 'Booked' },
          { value: 'confirmed',     label: 'Confirmed' },
          { value: 'played',        label: 'Played' },
          { value: 'declined',      label: 'Declined' },
          { value: 'cancelled',     label: 'Cancelled' },
        ] },
    ],
    crossLinks: [],
  },
  gig: {
    label: 'Gig',
    fields: [
      { name: 'title',  label: 'Title',  type: 'text', required: true },
      { name: 'date',   label: 'Date',   type: 'date' },
      { name: 'fee',    label: 'Fee',    type: 'number' },
      { name: 'status', label: 'Status', type: 'select',
        options: [
          { value: 'tentative', label: 'Tentative' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'played',    label: 'Played' },
          { value: 'cancelled',label: 'Cancelled' },
        ] },
    ],
    crossLinks: [
      { label: 'Venue', toEntity: 'venue', linkField: 'venue_id' },
    ],
  },
  contact: {
    label: 'Contact',
    fields: [
      { name: 'name',  label: 'Name',  type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'role',  label: 'Role',  type: 'text' },
    ],
    crossLinks: [],
  },
};

const STATUS_FIELD_CANDIDATES = ['pipeline_status', 'status'];

function _cfg(entityType) {
  return ENTITY_CONFIG[entityType] || {
    label: entityType,
    fields: [{ name: 'name', label: 'Name', type: 'text' }],
    crossLinks: [],
  };
}

function _isArchived(rec) {
  return !!(rec && (rec.archived || rec._archived));
}

function _statusField(cfg) {
  return cfg.fields.find(f => STATUS_FIELD_CANDIDATES.includes(f.name)) || null;
}

function _displayValue(value, field) {
  if (value == null || value === '') return '—';
  if (field && field.type === 'checkbox') return value ? 'Yes' : 'No';
  if (field && field.type === 'select' && field.options) {
    const opt = field.options.find(o => String(o.value) === String(value));
    return opt ? (opt.label || opt.value) : value;
  }
  return String(value);
}

function _inputForField(field, value) {
  if (field.type === 'textarea') {
    const el = h('textarea', { 'data-field': field.name, style: _inputStyle({ minHeight: '64px' }) });
    if (value != null) el.value = String(value);
    return el;
  }
  if (field.type === 'select') {
    return h('select', { 'data-field': field.name, style: _inputStyle() },
      (field.options || []).map(o => {
        const opt = h('option', { value: o.value }, o.label || o.value);
        if (value != null && String(value) === String(o.value)) opt.selected = true;
        return opt;
      }));
  }
  if (field.type === 'checkbox') {
    return h('input', { type: 'checkbox', 'data-field': field.name, checked: !!value,
      style: { width: '20px', height: '20px', minHeight: '44px' } });
  }
  const t = ['text','email','tel','url','number','date','time','datetime-local','password'].includes(field.type) ? field.type : 'text';
  const el = h('input', { type: t, 'data-field': field.name, style: _inputStyle() });
  if (value != null) el.value = String(value);
  return el;
}

function _inputStyle(overrides = {}) {
  return Object.assign({
    width: '100%',
    minHeight: '44px',
    padding: '8px 10px',
    fontSize: '14px',
    color: 'var(--text, #f1f1f5)',
    background: 'var(--bg-input, #0d0d12)',
    border: '1px solid var(--border, #2a2a35)',
    borderRadius: '6px',
    boxSizing: 'border-box',
    outline: 'none',
  }, overrides);
}

function _collectFromCard(cardEl) {
  const out = {};
  cardEl.querySelectorAll('[data-field]').forEach(el => {
    const key = el.getAttribute('data-field');
    if (el.type === 'checkbox') out[key] = el.checked;
    else if (el.tagName === 'SELECT' && el.hasAttribute('multiple')) {
      out[key] = Array.from(el.selectedOptions).map(o => o.value);
    } else out[key] = el.value;
  });
  return out;
}

/**
 * @param {string} entityType
 * @param {string} entityId
 * @returns {HTMLElement} card root element
 */
export function renderCard(entityType, entityId) {
  const cfg = _cfg(entityType);
  const storeName = _storeName(entityType);

  // Skeleton card that gets populated once the record loads
  const cardEl = h('div', {
    class: 'entity-card',
    'data-entity': entityType,
    'data-id': entityId,
    style: {
      background: 'var(--bg-elevated, #15151c)',
      border: '1px solid var(--border, #2a2a35)',
      borderRadius: '12px',
      padding: '16px',
      width: '100%',
      boxSizing: 'border-box',
    },
  }, [h('div', { style: { padding: '20px', textAlign: 'center', color: 'var(--text-muted, #7a7a85)' } }, 'Loading…')]);

  // Async-load the record then re-render the card content
  crud.read(storeName, entityId).then((record) => {
    if (!record) {
      cardEl.innerHTML = '';
      cardEl.appendChild(h('div', { style: { padding: '20px', textAlign: 'center', color: '#eb5757' } }, 'Record not found.'));
      return;
    }
    _populateCard(cardEl, cfg, entityType, storeName, entityId, record);
  }).catch((err) => {
    cardEl.innerHTML = '';
    cardEl.appendChild(h('div', { style: { padding: '20px', textAlign: 'center', color: '#eb5757' } }, 'Error: ' + err.message));
  });

  return cardEl;
}

function _populateCard(cardEl, cfg, entityType, storeName, entityId, record) {
  const archived = record.status === 'archived';
  const statusField = _statusField(cfg);

  const title = record.name || record.host_name || record.title || record.host_contact_id || cfg.label;
  const statusBadge = statusField
    ? renderBadge(entityType === 'venue' || entityType === 'busking' ? 'pipeline_status' : 'pipeline_status',
        record[statusField.name] || (statusField.options && statusField.options[0] && statusField.options[0].value))
    : null;

  /* ---- Header ---- */
  const headerEl = h('div', {
    class: 'card-header',
    style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' },
  }, [
    h('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [
      h('div', {
        class: 'card-type',
        style: { fontSize: '11px', color: 'var(--text-muted, #7a7a85)', textTransform: 'uppercase', letterSpacing: '.05em' },
      }, cfg.label),
      h('div', {
        class: 'card-title',
        style: { fontSize: '16px', fontWeight: '600', color: 'var(--text, #f1f1f5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      }, title),
    ]),
    statusBadge ? h('div', { class: 'card-status', style: { flex: '0 0 auto' } }, statusBadge) : null,
  ].filter(Boolean));

  /* ---- Body (display mode) ---- */
  function _buildBodyDisplay() {
    const rows = cfg.fields.filter(f => f.name !== statusField?.name).map(field => {
      const val = _displayValue(record[field.name], field);
      return h('div', {
        class: 'card-field',
        style: { display: 'flex', gap: '8px', padding: '4px 0', fontSize: '13px', borderBottom: '1px solid var(--border, #222230)' },
      }, [
        h('div', { class: 'field-label', style: { flex: '0 0 110px', color: 'var(--text-muted, #9a9aa5)', fontSize: '12px' } }, field.label),
        h('div', { class: 'field-value', style: { flex: '1 1 auto', color: 'var(--text, #f1f1f5)', wordBreak: 'break-word', fontSize: '13px' } }, val),
      ]);
    });
    return h('div', { class: 'card-body-display' }, rows);
  }

  /* ---- Body (edit mode) ---- */
  function _buildBodyEdit() {
    const rows = cfg.fields.filter(f => f.name !== statusField?.name).map(field => {
      return h('div', { style: { marginBottom: '10px' } }, [
        h('label', { style: { display: 'block', fontSize: '12px', color: 'var(--text-muted, #9a9aa5)', marginBottom: '4px' } }, field.label),
        _inputForField(field, record[field.name]),
      ]);
    });
    return h('div', { class: 'card-body-edit' }, rows);
  }

  /* ---- Action buttons ---- */
  function _btn(label, kind, onClick) {
    const colors = {
      primary: { bg: 'var(--brand-accent, #00d4c8)', color: '#0b0b0f' },
      neutral: { bg: 'transparent', color: 'var(--text, #f1f1f5)' },
      danger:  { bg: 'rgba(235,87,87,.15)', color: '#eb5757' },
      warn:    { bg: 'rgba(245,176,66,.15)', color: '#f5b042' },
    };
    const c = colors[kind] || colors.neutral;
    return h('button', {
      type: 'button',
      class: `card-btn card-btn-${kind}`,
      onClick,
      style: Object.assign({
        minHeight: '44px',
        minWidth: '44px',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: '600',
        border: '1px solid var(--border, #2a2a35)',
        borderRadius: '8px',
        cursor: 'pointer',
        flex: '1 1 auto',
      }, { background: c.bg, color: c.color }),
    }, label);
  }

  /* ---- Cross-link chips ---- */
  function _buildCrossLinks() {
    if (!cfg.crossLinks || cfg.crossLinks.length === 0) return null;
    const chips = cfg.crossLinks.map(cl => {
      const foreignId = record[cl.linkField];
      const has = foreignId != null && foreignId !== '';
      return h('button', {
        type: 'button',
        class: 'crosslink-chip',
        disabled: !has,
        onClick: () => {
          if (!has) return;
          const childCard = renderCard(cl.toEntity, foreignId);
          openModal(childCard);
        },
        style: {
          minHeight: '44px',
          padding: '6px 12px',
          fontSize: '12px',
          color: has ? 'var(--brand-accent, #00d4c8)' : 'var(--text-muted, #5a5a65)',
          background: 'rgba(0,212,200,.08)',
          border: '1px solid rgba(0,212,200,.25)',
          borderRadius: '999px',
          cursor: has ? 'pointer' : 'not-allowed',
        },
      }, '🔗 ' + cl.label);
    });
    return h('div', {
      class: 'card-crosslinks',
      style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' },
    }, chips);
  }

  /* ---- Assemble card ---- */
  const bodyContainer = h('div', { class: 'card-body' }, _buildBodyDisplay());
  const actionsEl = h('div', {
    class: 'card-actions',
    style: { display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' },
  }, [
    _btn('Edit', 'neutral', () => _toggleEdit(true)),
    _btn('Save', 'primary', () => _save()),
    _btn(archived ? 'Unarchive' : 'Archive', 'warn', () => _archive()),
    _btn('Delete', 'danger', () => _delete()),
  ]);

  function _toggleEdit(on) {
    bodyContainer.innerHTML = '';
    if (on) {
      bodyContainer.appendChild(_buildBodyEdit());
      actionsEl.querySelectorAll('.card-btn').forEach(b => b.style.display = '');
      // show Save as primary action
    } else {
      bodyContainer.appendChild(_buildBodyDisplay());
    }
  }

  function _save() {
    const values = _collectFromCard(cardEl);
    crud.update(storeName, entityId, values)
      .then(() => {
        Object.assign(record, values);
        _toggleEdit(false);
        // re-render status badge if statusField
        if (statusField && statusBadge) {
          const newBadge = renderBadge('pipeline_status', record[statusField.name]);
          statusBadge.replaceWith(newBadge);
        }
        document.dispatchEvent(new CustomEvent('tour-os:crud-changed'));
      })
      .catch((err) => console.error('Save failed:', err));
  }

  function _archive() {
    if (archived) {
      crud.unarchive(storeName, entityId)
        .then(() => {
          record.status = 'active';
          document.dispatchEvent(new CustomEvent('tour-os:crud-changed'));
          closeModal();
        })
        .catch((err) => console.error('Unarchive failed:', err));
    } else {
      crud.archive(storeName, entityId)
        .then(() => {
          record.status = 'archived';
          document.dispatchEvent(new CustomEvent('tour-os:crud-changed'));
          closeModal();
        })
        .catch((err) => console.error('Archive failed:', err));
    }
  }

  function _delete() {
    crud.deleteEntity(storeName, entityId)
      .then(() => {
        document.dispatchEvent(new CustomEvent('tour-os:crud-changed'));
        closeModal();
      })
      .catch((err) => console.error('Delete failed:', err));
  }

  // Populate the existing card element (passed as parameter)
  cardEl.innerHTML = '';
  cardEl.className = 'entity-card';
  cardEl.dataset.entity = entityType;
  cardEl.dataset.id = entityId;
  cardEl.style.background = 'var(--bg-elevated, #15151c)';
  cardEl.style.border = '1px solid var(--border, #2a2a35)';
  cardEl.style.borderRadius = '12px';
  cardEl.style.padding = '16px';
  cardEl.style.width = '100%';
  cardEl.style.boxSizing = 'border-box';
  cardEl.style.opacity = archived ? '.65' : '1';

  const fragment = document.createDocumentFragment();
  [headerEl, bodyContainer, actionsEl, _buildCrossLinks()].filter(Boolean).forEach(el => fragment.appendChild(el));
  cardEl.appendChild(fragment);

  return;
}

export default renderCard;

/**
 * form.js — Generic entity form (v4 UI)
 * renderForm(entityType, fields, existingRecord, onSubmit) returns a DOM <form>.
 * Fields: [{ name, label, type, required, options? }]
 * DOM IDs generated via generateId. Import h, guarded, generateId.
 *
 * @module components/form
 */
import { h } from '../utils/dom.js?v=4';
import { generateId } from '../utils/id.js?v=4';

const INPUT_TYPES = new Set([
  'text', 'email', 'tel', 'url', 'number', 'date', 'time', 'datetime-local', 'password',
]);

/**
 * Build a labeled input row for a field.
 * @param {object} field
 * @param {*} value
 * @returns {HTMLElement}
 */
function _renderField(field, value) {
  const id = generateId(`form-${field.name}`);
  const labelText = field.label || field.name;
  const isRequired = !!field.required;

  const labelEl = h('label', {
    for: id,
    style: {
      display: 'block',
      fontSize: '12px',
      fontWeight: '500',
      color: 'var(--text-muted, #9a9aa5)',
      marginBottom: '4px',
    },
  }, labelText + (isRequired ? ' *' : ''));

  let inputEl;

  if (field.type === 'textarea') {
    inputEl = h('textarea', {
      id,
      name: field.name,
      'data-field': field.name,
      required: isRequired,
      style: _inputStyle(),
    });
    if (value != null) inputEl.value = String(value);
  } else if (field.type === 'select' || (field.options && field.type !== 'multiselect')) {
    inputEl = h('select', {
      id,
      name: field.name,
      'data-field': field.name,
      style: _inputStyle(),
    }, (field.options || []).map(opt => {
      const optEl = h('option', { value: opt.value }, opt.label || opt.value);
      if (value != null && String(value) === String(opt.value)) optEl.selected = true;
      return optEl;
    }));
  } else if (field.type === 'multiselect') {
    inputEl = h('select', {
      id,
      name: field.name,
      'data-field': field.name,
      multiple: true,
      style: _inputStyle({ minHeight: '88px' }),
    }, (field.options || []).map(opt => {
      const optEl = h('option', { value: opt.value }, opt.label || opt.value);
      if (Array.isArray(value) && value.includes(opt.value)) optEl.selected = true;
      else if (value != null && String(value) === String(opt.value)) optEl.selected = true;
      return optEl;
    }));
  } else if (field.type === 'checkbox') {
    inputEl = h('input', {
      id,
      type: 'checkbox',
      name: field.name,
      'data-field': field.name,
      checked: !!value,
      style: { width: '20px', height: '20px', minHeight: '44px', minWidth: '44px' },
    });
  } else {
    const t = INPUT_TYPES.has(field.type) ? field.type : 'text';
    inputEl = h('input', {
      id,
      type: t,
      name: field.name,
      'data-field': field.name,
      required: isRequired,
      placeholder: field.placeholder || '',
      style: _inputStyle(),
    });
    if (value != null) inputEl.value = String(value);
  }

  return h('div', {
    class: 'form-field',
    style: { marginBottom: '14px' },
  }, [labelEl, inputEl]);
}

function _inputStyle(overrides = {}) {
  return Object.assign({
    width: '100%',
    minHeight: '44px',
    padding: '10px 12px',
    fontSize: '14px',
    color: 'var(--text, #f1f1f5)',
    background: 'var(--bg-input, #0d0d12)',
    border: '1px solid var(--border, #2a2a35)',
    borderRadius: '8px',
    boxSizing: 'border-box',
    outline: 'none',
  }, overrides);
}

/**
 * Collect form values from input elements with [data-field].
 * @param {HTMLElement} formEl
 * @returns {Record<string, any>}
 */
function _collect(formEl) {
  const out = {};
  formEl.querySelectorAll('[data-field]').forEach(el => {
    const key = el.getAttribute('data-field');
    if (el.type === 'checkbox') {
      out[key] = el.checked;
    } else if (el.tagName === 'SELECT' && el.hasAttribute('multiple')) {
      out[key] = Array.from(el.selectedOptions).map(o => o.value);
    } else {
      out[key] = el.value;
    }
  });
  return out;
}

/**
 * @param {string} entityType
 * @param {Array} fields
 * @param {object} [existingRecord]
 * @param {(values: object) => void} [onSubmit]
 * @returns {HTMLElement} <form>
 */
export function renderForm(entityType, fields, existingRecord, onSubmit) {
  const rec = existingRecord || {};

  const fieldRows = (fields || []).map(f => _renderField(f, rec[f.name]));

  const submitBtn = h('button', {
    type: 'submit',
    class: 'form-submit',
    style: {
      minHeight: '44px',
      minWidth: '44px',
      width: '100%',
      padding: '12px',
      fontSize: '14px',
      fontWeight: '600',
      color: '#0b0b0f',
      background: 'var(--brand-accent, #00d4c8)',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
    },
  }, existingRecord ? 'Save' : 'Create');

  const form = h('form', {
    class: 'entity-form',
    'data-entity': entityType,
    style: { width: '100%', boxSizing: 'border-box' },
    onSubmit: (ev) => {
      ev.preventDefault();
      const values = _collect(form);
      if (typeof onSubmit === 'function') onSubmit(values);
    },
  }, [...fieldRows, submitBtn]);

  return form;
}

export default renderForm;

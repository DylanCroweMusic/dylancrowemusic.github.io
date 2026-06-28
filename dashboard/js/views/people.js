// views/people.js — People tab for the v4 dashboard.
//
// Exports renderPeople() which returns a DOM node. Contains a search input
// (filters contacts by name/role/email), a contact list with role badge,
// linked entity, last contact date, edit/archive buttons, an Add Contact
// button, and click-to-open contact cards (via components/card.js).
//
// Dark theme, mobile-first, 44px touch targets. Built with h() from utils/dom.

import { getState } from '../store.js?v=4';
import * as crud from '../crud.js?v=4';
import { renderCard } from '../components/card.js?v=4';
import { renderBadge } from '../components/badge.js?v=4';
import { renderForm } from '../components/form.js?v=4';
import { openModal, closeModal } from '../components/modal.js?v=4';
import { h } from '../utils/dom.js?v=4';
import { formatDate } from '../utils/dates.js?v=4';
import { generateId } from '../utils/id.js?v=4';

// ─── Role config ─────────────────────────────────────────────────────────────

const ROLE_LABELS = {
  venue_booker: 'Venue Booker',
  hc_host: 'HC Host',
  manager: 'Manager',
};

function _roleLabel(role) {
  return ROLE_LABELS[role] || (role ? role.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Other');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _entities() {
  const s = getState() || {};
  return s.entities || {};
}

function _activeContacts() {
  return (_entities().contacts || []).filter((c) => (c.status || 'active') === 'active');
}

function _venues() {
  return (_entities().venues || []).filter((v) => (v.status || 'active') === 'active');
}

function _houseConcerts() {
  return (_entities().house_concerts || []).filter((hc) => (hc.status || 'active') === 'active');
}

function _findVenueForContact(contactId, venues) {
  return venues.find((v) => v.primary_contact_id === contactId) || null;
}

function _findHcForContact(contactId, hcs) {
  return hcs.find((hc) => hc.host_contact_id === contactId) || null;
}

function _linkedEntity(contact, venues, hcs) {
  if (contact.role === 'venue_booker') {
    const v = _findVenueForContact(contact.id, venues);
    if (v) {
      return { name: v.name, type: 'venue', lastContactedAt: v.last_contacted_at || null };
    }
  }
  if (contact.role === 'hc_host') {
    const hc = _findHcForContact(contact.id, hcs);
    if (hc) {
      return { name: 'House Concert', type: 'hc', lastContactedAt: null };
    }
  }
  return null;
}

// ─── Filter ──────────────────────────────────────────────────────────────────

function _filterContacts(contacts, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return contacts;
  return contacts.filter((c) => {
    const name = (c.name || '').toLowerCase();
    const role = (c.role || '').toLowerCase();
    const roleLabel = _roleLabel(c.role).toLowerCase();
    const email = (c.email || '').toLowerCase();
    return name.includes(q) || role.includes(q) || roleLabel.includes(q) || email.includes(q);
  });
}

// ─── Search input ────────────────────────────────────────────────────────────

function _renderSearch(query, onSearch) {
  const input = h('input', {
    type: 'text',
    placeholder: 'Search contacts…',
    value: query,
    autocomplete: 'off',
    on: {
      input: (ev) => onSearch(ev.target.value),
    },
    style: {
      width: '100%',
      minHeight: '44px',
      padding: '10px 14px',
      fontSize: '15px',
      color: 'var(--text, #f1f1f5)',
      background: 'rgba(150,150,160,.06)',
      border: '1px solid var(--border, #2a2a35)',
      borderRadius: '8px',
      boxSizing: 'border-box',
      outline: 'none',
    },
  });
  return h('div', { class: 'people-search', style: { marginBottom: '12px' } }, input);
}

// ─── Contact row ─────────────────────────────────────────────────────────────

function _renderContactRow(contact, venues, hcs, onEdit, onArchive, onOpen) {
  const linked = _linkedEntity(contact, venues, hcs);
  const lastContact = linked && linked.lastContactedAt ? formatDate(linked.lastContactedAt) : '—';

  const editBtn = h('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': 'Edit contact',
    on: { click: (ev) => { ev.stopPropagation(); onEdit(contact); } },
    style: {
      minHeight: '44px', minWidth: '44px', width: '44px', height: '44px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px', color: 'var(--text, #f1f1f5)',
      background: 'rgba(150,150,160,.06)', border: '1px solid var(--border, #2a2a35)',
      borderRadius: '8px', cursor: 'pointer',
    },
  }, '✎');

  const archiveBtn = h('button', {
    type: 'button',
    class: 'icon-btn',
    'aria-label': 'Archive contact',
    on: { click: (ev) => { ev.stopPropagation(); onArchive(contact); } },
    style: {
      minHeight: '44px', minWidth: '44px', width: '44px', height: '44px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px', color: '#f5b042',
      background: 'rgba(245,176,66,.08)', border: '1px solid rgba(245,176,66,.25)',
      borderRadius: '8px', cursor: 'pointer',
    },
  }, '📦');

  return h('div', {
    class: 'contact-row',
    data: { id: contact.id },
    on: { click: () => onOpen(contact) },
    style: {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '14px', cursor: 'pointer',
      background: 'rgba(150,150,160,.04)', border: '1px solid var(--border, #222230)',
      borderRadius: '10px', transition: 'border-color .15s',
    },
  }, [
    h('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' } }, [
        h('span', { style: { fontSize: '16px', fontWeight: '700', color: 'var(--text, #f1f1f5)' } }, contact.name || '(unnamed)'),
        h('span', {
          style: {
            display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
            fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap',
            background: 'rgba(0,212,200,.12)', color: '#00d4c8',
          },
        }, _roleLabel(contact.role)),
      ]),
      linked ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '4px', flexWrap: 'wrap' } }, [
        h('span', { style: { color: 'var(--text-muted, #9a9aa5)' } }, '🔗 ' + linked.name),
        h('span', {
          style: {
            display: 'inline-block', padding: '1px 6px', borderRadius: '4px',
            fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.04em',
            background: linked.type === 'venue' ? 'rgba(0,212,200,.1)' : 'rgba(220,120,220,.1)',
            color: linked.type === 'venue' ? '#00d4c8' : '#dc78dc',
          },
        }, linked.type === 'venue' ? 'Venue' : 'HC'),
      ]) : null,
      h('div', { style: { fontSize: '12px', color: 'var(--text-muted, #7a7a85)' } }, [
        h('span', { style: { marginRight: '4px' } }, 'Last contact:'),
        h('span', {}, lastContact),
      ]),
    ].filter(Boolean)),
    h('div', { style: { display: 'flex', gap: '6px', flexShrink: '0' } }, [editBtn, archiveBtn]),
  ]);
}

// ─── Add / edit form ─────────────────────────────────────────────────────────

const CONTACT_FIELDS = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'role', label: 'Role', type: 'select', options: [
    { value: 'venue_booker', label: 'Venue Booker' },
    { value: 'hc_host', label: 'HC Host' },
    { value: 'manager', label: 'Manager' },
    { value: 'other', label: 'Other' },
  ] },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'facebook_profile_url', label: 'Facebook profile URL', type: 'url' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

function _openContactForm(existing) {
  const form = renderForm('contact', CONTACT_FIELDS, existing, (values) => {
    if (existing) {
      crud.update('contacts', existing.id, values)
        .then(() => closeModal())
        .catch((err) => console.error('Update failed:', err));
    } else {
      const record = { ...values, id: generateId('ct_') };
      crud.create('contacts', record)
        .then(() => closeModal())
        .catch((err) => console.error('Create failed:', err));
    }
  });

  const wrap = h('div', { style: { width: '100%' } }, [
    h('div', { style: { fontSize: '16px', fontWeight: '700', color: 'var(--text, #f1f1f5)', marginBottom: '14px' } }, existing ? 'Edit Contact' : 'New Contact'),
    form,
  ]);
  openModal(wrap);
}

// ─── Public: renderPeople() ──────────────────────────────────────────────────

export function renderPeople() {
  const venues = _venues();
  const hcs = _houseConcerts();
  let query = '';

  const listHost = h('div', { class: 'people-list', style: { display: 'flex', flexDirection: 'column', gap: '8px' } });

  function _refreshList() {
    const contacts = _activeContacts();
    const filtered = _filterContacts(contacts, query);
    listHost.innerHTML = '';

    if (filtered.length === 0) {
      listHost.appendChild(h('div', {
        style: { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted, #7a7a85)', fontSize: '14px' },
      }, contacts.length === 0 ? 'No contacts yet. Tap "Add Contact" to create one.' : 'No contacts match your search.'));
      return;
    }

    for (const c of filtered) {
      listHost.appendChild(_renderContactRow(
        c, venues, hcs,
        (contact) => _openContactForm(contact),                // onEdit
        (contact) => {                                          // onArchive
          if (confirm(`Archive contact "${contact.name}"?`)) {
            crud.archive('contacts', contact.id).catch((err) => console.error('Archive failed:', err));
          }
        },
        (contact) => {                                          // onOpen
          try {
            const card = renderCard('contact', contact.id);
            if (card) openModal(card);
          } catch (err) {
            // Fallback: open the edit form if card rendering fails
            console.error('renderCard failed:', err);
            _openContactForm(contact);
          }
        },
      ));
    }
  }

  const searchInput = _renderSearch('', (val) => {
    query = val;
    _refreshList();
  });

  const addBtn = h('button', {
    type: 'button',
    class: 'add-contact-btn',
    on: { click: () => _openContactForm(null) },
    style: {
      minHeight: '44px', padding: '8px 16px', fontSize: '14px', fontWeight: '600',
      color: '#0b0b0f', background: 'var(--brand-accent, #00d4c8)',
      border: 'none', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap',
    },
  }, '+ Add Contact');

  const header = h('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' },
  }, [
    h('h2', { style: { margin: '0', fontSize: '22px', fontWeight: '700', color: 'var(--text, #f1f1f5)' } }, 'People'),
    addBtn,
  ]);

  _refreshList();

  return h('div', {
    class: 'people-view',
    style: { width: '100%', maxWidth: '720px', margin: '0 auto', boxSizing: 'border-box' },
  }, [header, searchInput, listHost]);
}

export default renderPeople;

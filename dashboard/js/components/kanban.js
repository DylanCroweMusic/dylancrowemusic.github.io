/**
 * kanban.js — Pipeline kanban board (v4 UI)
 * renderKanban(pipelineType) returns DOM board.
 * Columns from pipeline stages. Cards from store data
 * (venues/house_concerts/busking_spots filtered by pipeline_status).
 * Drag-and-drop via pointer events. On drop: pipeline.transition.
 * Segmented control [Venues|HCs|Busking].
 *
 * @module components/kanban
 */
import { h } from '../utils/dom.js';
import * as crud from '../crud.js';
import * as pipeline from '../pipeline.js';
import { getState } from '../store.js';
import { renderCard } from './card.js';
import { renderBadge } from './badge.js';
import { openModal } from './modal.js';

const ENTITY_MAP = {
  venues: { entity: 'venue',  storeKey: 'venues',          label: 'Venues' },
  hcs:    { entity: 'hc',     storeKey: 'house_concerts',  label: 'HCs' },
  busking:{ entity: 'busking', storeKey: 'busking_spots',   label: 'Busking' },
};

const SEGMENT_ORDER = ['venues', 'hcs', 'busking']; // kept for reference

// Map pipelineType → segment key for ENTITY_MAP lookup
const SEGMENT_BY_TYPE = {
  venue: 'venues',
  hc: 'hcs',
  busking: 'busking',
};

function _stages(pipelineType) {
  // pipeline module expected to expose stages(pipelineType?) -> [{key,label}]
  if (pipeline.stages) {
    const s = pipeline.stages(pipelineType);
    if (Array.isArray(s) && s.length) return s;
  }
  // fallback defaults
  return [
    { key: 'not_contacted', label: 'Not contacted' },
    { key: 'contacted',     label: 'Contacted' },
    { key: 'follow_up',     label: 'Follow up' },
    { key: 'booked',        label: 'Booked' },
    { key: 'confirmed',     label: 'Confirmed' },
    { key: 'played',        label: 'Played' },
    { key: 'declined',      label: 'Declined' },
    { key: 'cancelled',     label: 'Cancelled' },
  ];
}

function _recordsFor(segmentKey) {
  const cfg = ENTITY_MAP[_activeSegment];
  if (!cfg) return [];
  const state = getState() || {};
  const entities = state.entities || {};
  let all = entities[cfg.storeKey] || [];
  if (!Array.isArray(all)) return [];
  return all.filter(r => (r.pipeline_status || r.status) === segmentKey && r.status !== 'archived');
}

let _activeSegment = 'venues'; // module-scoped default; re-set per render

function _kanbanCardEl(rec, cfg) {
  const title = rec.host_name || rec.name || rec.title || rec.host_contact_id || cfg.label;
  return h('div', {
    class: 'kanban-card',
    'data-id': rec.id,
    draggable: 'true',
    style: {
      background: 'var(--bg-input, #0d0d12)',
      border: '1px solid var(--border, #2a2a35)',
      borderRadius: '8px',
      padding: '10px',
      marginBottom: '8px',
      cursor: 'grab',
      minHeight: '44px',
      touchAction: 'none', // prevent scroll while dragging
    },
  }, [
    h('div', { style: { fontSize: '13px', fontWeight: '600', color: 'var(--text, #f1f1f5)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, title),
    h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
      rec.city ? [h('span', { style: { fontSize: '11px', color: 'var(--text-muted, #7a7a85)' } }, rec.city)] : []),
  ]);
}

/**
 * Set up pointer-based drag-and-drop for a card element.
 * On drop into a column, call pipeline.transition.
 */
function _wireDrag(cardEl, rec, cfg, boardEl) {
  // boardEl may be null if called during board construction; resolve lazily
  const getBoard = () => boardEl || cardEl.closest('.kanban-board');
  let dragging = false;
  let ghost = null;
  let startX = 0, startY = 0;
  let lastPointerId = null;

  cardEl.addEventListener('pointerdown', (ev) => {
    // Ignore secondary buttons
    if (ev.button !== 0) return;
    startX = ev.clientX; startY = ev.clientY;
    lastPointerId = ev.pointerId;
  });

  cardEl.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== lastPointerId) return;
    if (!dragging) {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (dx < 5 && dy < 5) return; // threshold
      dragging = true;
      cardEl.setPointerCapture(ev.pointerId);
      cardEl.style.opacity = '.4';
      ghost = cardEl.cloneNode(true);
      ghost.style.position = 'fixed';
      ghost.style.pointerEvents = 'none';
      ghost.style.opacity = '.9';
      ghost.style.zIndex = '9999';
      ghost.style.width = cardEl.offsetWidth + 'px';
      ghost.style.transform = 'rotate(2deg)';
      document.body.appendChild(ghost);
    }
    if (ghost) {
      ghost.style.left = (ev.clientX - cardEl.offsetWidth / 2) + 'px';
      ghost.style.top = (ev.clientY - 20) + 'px';
    }
    // highlight target column
    const b = getBoard();
    if (b) {
      b.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drop-target'));
      const target = _columnAtPoint(b, ev.clientX, ev.clientY);
      if (target) target.classList.add('drop-target');
    }
  });

  function _end(ev) {
    if (!dragging) return;
    dragging = false;
    try { cardEl.releasePointerCapture(ev.pointerId); } catch (_) {}
    cardEl.style.opacity = '';
    if (ghost) { ghost.parentNode && ghost.parentNode.removeChild(ghost); ghost = null; }
    const b = getBoard();
    if (b) {
      b.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('drop-target'));
      const targetCol = _columnAtPoint(b, ev.clientX, ev.clientY);
      if (targetCol) {
        const toStage = targetCol.getAttribute('data-stage');
        const fromStage = rec.pipeline_status || rec.status;
        if (toStage && toStage !== fromStage) {
          if (pipeline.transition) {
            pipeline.transition(cfg.entity, rec.id, toStage)
              .then(() => {
                document.dispatchEvent(new CustomEvent('tour-os:crud-changed'));
              })
              .catch((err) => console.error('Pipeline transition failed:', err));
          } else if (crud.update) {
            crud.update(cfg.storeKey, rec.id, { pipeline_status: toStage })
              .then(() => {
                document.dispatchEvent(new CustomEvent('tour-os:crud-changed'));
              })
              .catch((err) => console.error('Update failed:', err));
          }
          // remove from current column visually
          if (cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
        }
      }
    }
  }
  cardEl.addEventListener('pointerup', _end);
  cardEl.addEventListener('pointercancel', _end);
}

function _columnAtPoint(boardEl, x, y) {
  const cols = boardEl.querySelectorAll('.kanban-col');
  for (const col of cols) {
    const r = col.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return col;
  }
  return null;
}

/**
 * @param {string} [pipelineType] - optional pipeline type passed to pipeline.stages
 * @returns {HTMLElement} kanban board wrapper
 */
export function renderKanban(pipelineType) {
  // Sync active segment with the pipelineType passed from the view
  const segKey = SEGMENT_BY_TYPE[pipelineType] || 'venues';
  _activeSegment = segKey;

  function _currentCfg() {
    return ENTITY_MAP[_activeSegment] || ENTITY_MAP.venues;
  }

  function _currentStages() {
    // Map segment key back to pipeline type for stages lookup
    const cfg = _currentCfg();
    return _stages(cfg.entity);
  }

  let boardEl;
  function _buildBoard() {
    const stages = _currentStages();
    const cfg = _currentCfg();
    const columns = stages.map(stage => {
      const recs = _recordsFor(stage.key);
      const cards = recs.map(rec => {
        const el = _kanbanCardEl(rec, cfg);
        el.addEventListener('click', (ev) => {
          // open card in modal unless this was a drag
          if (ev.target.classList.contains('kanban-card') || ev.target.closest('.kanban-card')) {
            // avoid opening right after a drag
          }
        });
        el.addEventListener('click', () => {
          const card = renderCard(cfg.entity, rec.id);
          openModal(card);
        });
        _wireDrag(el, rec, cfg, null); // boardEl resolved lazily in _wireDrag
        return el;
      });

      return h('div', {
        class: 'kanban-col',
        'data-stage': stage.key,
        style: {
          flex: '1 1 220px',
          minWidth: '220px',
          background: 'var(--bg, #0b0b10)',
          border: '1px solid var(--border, #2a2a35)',
          borderRadius: '10px',
          padding: '10px',
          minHeight: '200px',
          transition: 'background .12s ease',
        },
      }, [
        h('div', {
          class: 'kanban-col-header',
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
        }, [
          h('span', { style: { fontSize: '13px', fontWeight: '600', color: 'var(--text, #f1f1f5)' } }, stage.label),
          h('span', { style: { fontSize: '11px', color: 'var(--text-muted, #7a7a85)', background: 'rgba(150,150,160,.12)', padding: '1px 7px', borderRadius: '999px' } }, String(cards.length)),
        ]),
        h('div', { class: 'kanban-col-body', style: { minHeight: '40px' } }, cards),
      ]);
    });

    return h('div', {
      class: 'kanban-board',
      style: {
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        paddingBottom: '8px',
        alignItems: 'flex-start',
      },
    }, columns);
  }

  boardEl = _buildBoard();

  // Wrapper — no internal segmented control (the Pipeline view provides one).
  const boardWrapper = h('div', {
    class: 'kanban-wrapper',
    style: { width: '100%' },
  }, [boardEl]);

  return boardWrapper;
}

const ENTITY_CONFIG_FALLBACK = ENTITY_MAP.venues;
export { renderKanban as default };

/**
 * modal.js — Stack-aware modal overlay (v4 UI)
 * openModal(contentNode): creates overlay, appends to #modal-root,
 *   click-outside-to-close + ESC-to-close. Returns overlay element.
 * closeModal(): removes the topmost overlay. Stack-aware.
 *
 * @module components/modal
 */
import { h } from '../utils/dom.js';

const _stack = [];

/**
 * @returns {HTMLElement|null} #modal-root, creating it if missing.
 */
function _ensureRoot() {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '1000';
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Close the topmost modal. Safe to call when none open.
 */
export function closeModal() {
  const overlay = _stack.pop();
  if (!overlay) return;
  try {
    overlay.classList.remove('modal-open');
    // allow fade-out transition before removal
    setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 150);
  } catch (_) {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  // restore body scroll only when stack empties
  if (_stack.length === 0) {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', _onKeydown, true);
  }
}

function _onKeydown(ev) {
  if (ev.key === 'Escape' || ev.key === 'Esc') {
    ev.preventDefault();
    ev.stopPropagation();
    closeModal();
  }
}

/**
 * @param {HTMLElement} contentNode - DOM node to display inside the modal panel
 * @param {{ closable?: boolean, onClosed?: () => void }} [opts]
 * @returns {HTMLElement} the overlay element
 */
export function openModal(contentNode, opts = {}) {
  const { closable = true, onClosed } = opts;
  const root = _ensureRoot();

  const overlay = h('div', {
    class: 'modal-overlay',
    style: {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      pointerEvents: 'auto',
      zIndex: String(1000 + _stack.length),
    },
  }, [
    h('div', {
      class: 'modal-panel',
      role: 'dialog',
      'aria-modal': 'true',
      style: {
        background: 'var(--bg-elevated, #15151c)',
        border: '1px solid var(--border, #2a2a35)',
        borderRadius: '12px',
        maxWidth: '560px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '20px',
        boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      },
    }, contentNode ? [contentNode] : []),
  ]);

  // Click outside the panel to close
  if (closable) {
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        ev.stopPropagation();
        _closeWithCallback();
      }
    });
  }

  function _closeWithCallback() {
    closeModal();
    if (typeof onClosed === 'function') onClosed();
  }

  _stack.push(overlay);
  // lock body scroll while any modal open
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', _onKeydown, true);

  root.appendChild(overlay);
  // trigger fade-in
  requestAnimationFrame(() => overlay.classList.add('modal-open'));

  return overlay;
}

export default { openModal, closeModal };

/**
 * nav.js — Navigation bar component (v4 UI)
 * Renders a <nav> with 5 tabs: Home, Pipeline, Calendar, People, Money.
 * Active button gets .active class. Brand colors. Mobile fixed bottom bar.
 * Saves last tab to localStorage key "tourOS_v4_ui_tab".
 *
 * @module components/nav
 */
import { h } from '../utils/dom.js?v=4';

const TABS = [
  { key: 'home',     label: 'Home',     icon: '🏠' },
  { key: 'pipeline', label: 'Pipeline', icon: '⚙️' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
  { key: 'people',   label: 'People',   icon: '👤' },
  { key: 'money',    label: 'Money',    icon: '💰' },
];

/**
 * @param {string} activeView - key of the currently-active tab
 * @param {(tabKey: string) => void} onTabClick - invoked when a tab is tapped
 * @returns {HTMLElement} <nav> element
 */
export function renderNav(activeView, onTabClick) {
  const stored = (() => {
    try { return localStorage.getItem('tourOS_v4_ui_tab'); } catch (_) { return null; }
  })();
  const effectiveActive = activeView || stored || 'home';

  // Restore last tab into localStorage on mount-ify if not present
  try {
    if (!localStorage.getItem('tourOS_v4_ui_tab')) {
      localStorage.setItem('tourOS_v4_ui_tab', effectiveActive);
    }
  } catch (_) { /* storage unavailable */ }

  const buttons = TABS.map(tab => {
    const isActive = tab.key === effectiveActive;
    return h('button', {
      class: 'nav-btn' + (isActive ? ' active' : ''),
      type: 'button',
      'aria-pressed': isActive ? 'true' : 'false',
      'data-tab': tab.key,
      onClick: (ev) => {
        ev.preventDefault();
        try { localStorage.setItem('tourOS_v4_ui_tab', tab.key); } catch (_) { /* noop */ }
        // update active state in-DOM (live)
        navEl.querySelectorAll('.nav-btn').forEach(b => {
          const on = b.getAttribute('data-tab') === tab.key;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (typeof onTabClick === 'function') onTabClick(tab.key);
      },
      style: {
        flex: '1 1 0',
        minWidth: '0',
        height: '44px',
        minHeight: '44px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        padding: '6px 4px',
        border: 'none',
        background: 'transparent',
        color: isActive ? 'var(--brand-accent, #00d4c8)' : 'var(--text-muted, #888)',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: isActive ? '600' : '400',
        transition: 'color .15s ease',
      },
    }, [
      h('span', { class: 'nav-icon', style: { fontSize: '16px', lineHeight: '1' } }, tab.icon),
      h('span', { class: 'nav-label', style: { fontSize: '12px', lineHeight: '1' } }, tab.label),
    ]);
  });

  const navEl = h('nav', {
    class: 'app-nav',
    role: 'navigation',
    'aria-label': 'Primary',
    style: {
      display: 'flex',
      width: '100%',
      maxWidth: '600px',
      margin: '0 auto',
      background: 'var(--bg-elevated, #15151c)',
      borderTop: '1px solid var(--border, #2a2a35)',
      boxShadow: '0 -2px 12px rgba(0,0,0,.35)',
    },
  }, buttons);

  return navEl;
}

export default renderNav;

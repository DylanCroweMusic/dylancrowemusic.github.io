// main.js — App entry point and wiring for Dylan Crowe Music Tour OS v4
// This module boots the app: init DB → load seed → run todos → mount nav → render

import { initDB } from './db.js';
import { getState, update, setActiveView, setModal, setRenderFn } from './store.js';
import * as crud from './crud.js';
import { loadSeedIfEmpty } from './seed.js';
import * as todos from './todos.js';
import { renderNav } from './components/nav.js';
import { openModal, closeModal } from './components/modal.js';
import { renderHome } from './views/home.js';
import { renderPipeline } from './views/pipeline.js';
import { renderCalendarView } from './views/calendar.js';
import { renderPeople } from './views/people.js';
import { renderMoney } from './views/money.js';

// ─── State ───────────────────────────────────────────────────────────
let renderScheduled = false;

// ─── Root Render ─────────────────────────────────────────────────────
function render() {
  renderScheduled = false;
  const state = getState();
  const app = document.getElementById('app');
  if (!app) return;

  // Render nav bar
  const tabBar = document.getElementById('tab-bar');
  if (tabBar) {
    tabBar.innerHTML = '';
    tabBar.appendChild(renderNav(state.ui.activeView, (view) => {
      update(s => { s.ui.activeView = view; });
      // Save to localStorage
      try { localStorage.setItem('tourOS_v4_ui_tab', view); } catch(e) {}
      render();
    }));
  }

  // Render active view
  app.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'view-container';
  app.appendChild(container);

  try {
    let viewNode = null;
    switch (state.ui.activeView) {
      case 'home':
        if (typeof renderHome === 'function') {
          viewNode = renderHome();
        }
        break;
      case 'pipeline':
        if (typeof renderPipeline === 'function') {
          viewNode = renderPipeline();
        }
        break;
      case 'calendar':
        if (typeof renderCalendarView === 'function') {
          viewNode = renderCalendarView();
        }
        break;
      case 'people':
        if (typeof renderPeople === 'function') {
          viewNode = renderPeople();
        }
        break;
      case 'money':
        if (typeof renderMoney === 'function') {
          viewNode = renderMoney();
        }
        break;
    }
    if (viewNode) {
      container.appendChild(viewNode);
    } else {
      container.innerHTML = '<div class="empty-state">View not available</div>';
    }
  } catch (err) {
    console.error('Render error:', err);
    container.innerHTML = `<div class="empty-state" style="padding:20px;text-align:center;color:#a0a0c8;">⚠️ Error rendering ${state.ui.activeView}: ${err.message}<br><br><button onclick="location.reload()" style="padding:10px 20px;background:#00B4D8;border:none;border-radius:8px;color:white;cursor:pointer;">Reload</button></div>`;
  }

  // Render modal if open
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot && state.ui.modal) {
    // Modal is managed by modal.js openModal/closeModal
    // We don't re-render it here to avoid duplicating
  }
}

// ─── Store update hook ──────────────────────────────────────────────
// Override update to trigger re-render
const _originalUpdate = update;
function updateAndRender(mutator) {
  _originalUpdate(mutator);
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(render);
  }
}

// Replace the global update reference
// (Note: modules that imported update before this won't see the override,
//  but they call it via the imported binding. We use a custom event instead.)
document.addEventListener('tour-os:state-changed', () => {
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(render);
  }
});

// ─── CRUD refresh: reload entities from IndexedDB after any CRUD operation ─
document.addEventListener('tour-os:crud-changed', async () => {
  try {
    // Re-evaluate todos BEFORE reloading entities so new/changed entities
    // generate their auto-todos in the same pass (fixes B9 test: HC create
    // should immediately produce "Post FB ad" todo, etc).
    try {
      await todos.reevaluateAll();
    } catch (e) {
      console.warn('Todo re-evaluation failed:', e.message);
    }

    const entityTypes = ['config', 'tour_stops', 'contacts', 'venues', 'gigs', 'house_concerts', 'busking_spots', 'busking_sessions', 'expense_log', 'todos'];
    const entitiesData = {};
    for (const type of entityTypes) {
      try {
        entitiesData[type] = await crud.readAll(type);
      } catch (e) {
        entitiesData[type] = [];
      }
    }
    update(s => { s.entities = entitiesData; });
    render();
  } catch (e) {
    console.warn('CRUD refresh failed:', e.message);
  }
});

// ─── Event Delegation ───────────────────────────────────────────────
function setupEventDelegation() {
  const app = document.getElementById('app');
  if (!app) return;

  // Click delegation
  app.addEventListener('click', (e) => {
    // Handle data-action attributes
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      const action = actionEl.dataset.action;
      const entityId = actionEl.dataset.entityId;
      const entityType = actionEl.dataset.entityType;
      
      switch (action) {
        case 'switch-tab':
          update(s => { s.ui.activeView = entityType; });
          try { localStorage.setItem('tourOS_v4_ui_tab', entityType); } catch(e) {}
          render();
          break;
        case 'open-create-form':
          // Dispatch event for views to handle
          document.dispatchEvent(new CustomEvent('open-create-form', {
            detail: { entityType: entityType }
          }));
          break;
      }
    }
  });

  // ESC to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
}

// ─── Toast ──────────────────────────────────────────────────────────
function showToast(message, duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#252555;color:#F5F0E8;padding:12px 24px;border-radius:8px;z-index:2000;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, duration);
}

// ─── Boot ───────────────────────────────────────────────────────────
async function boot() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('#app element not found');
    return;
  }

  // Show loading state
  app.innerHTML = '<div class="empty-state">⏳ Loading Tour OS v4...</div>';

  try {
    // 1. Initialize IndexedDB
    await initDB();
    console.log('✓ DB initialized');

    // 2. Load seed data if empty
    await loadSeedIfEmpty();
    console.log('✓ Seed data loaded');

    // 3. Load all entities into store state
    const entityTypes = ['config', 'tour_stops', 'contacts', 'venues', 'gigs', 'house_concerts', 'busking_spots', 'busking_sessions', 'expense_log', 'todos'];
    const entitiesData = {};
    for (const type of entityTypes) {
      try {
        entitiesData[type] = await crud.readAll(type);
      } catch (e) {
        console.warn(`Could not load ${type}:`, e.message);
        entitiesData[type] = [];
      }
    }
    update(s => { s.entities = entitiesData; });
    console.log('✓ Entities loaded into store');

    // 4. Run todo re-evaluation (boot sweep)
    try {
      await todos.reevaluateAll();
      // Reload todos after re-evaluation
      const updatedTodos = await crud.readAll('todos');
      update(s => { s.entities.todos = updatedTodos; });
      console.log('✓ Todos re-evaluated');
    } catch (e) {
      console.warn('Todo re-evaluation warning:', e.message);
    }

    // 5. Setup event delegation
    setupEventDelegation();

    // 5.5 Register render function with store so update() triggers re-render
    setRenderFn(render);

    // 6. Restore last-opened tab
    let lastTab = 'home';
    try { lastTab = localStorage.getItem('tourOS_v4_ui_tab') || 'home'; } catch(e) {}
    update(s => { s.ui.activeView = lastTab; });

    // 7. Initial render
    render();
    console.log('✓ Tour OS v4 booted successfully');

    // 8. Set up periodic todo sweep (every 5 minutes)
    setInterval(async () => {
      try {
        await todos.reevaluateAll();
        const updatedTodos = await crud.readAll('todos');
        update(s => { s.entities.todos = updatedTodos; });
        render();
      } catch (e) {
        console.warn('Periodic todo sweep warning:', e.message);
      }
    }, 300000); // 5 minutes

  } catch (err) {
    console.error('❌ Boot failed:', err);
    app.innerHTML = `
      <div class="empty-state" style="padding:40px;text-align:center;">
        <h2>⚠️ Storage Error</h2>
        <p>Your browser doesn't support storage or private browsing is enabled.</p>
        <p>Try a different browser or disable private browsing.</p>
        <p style="color:#a0a0c8;font-size:12px;margin-top:20px;">Error: ${err.message}</p>
      </div>
    `;
  }
}

// ─── Global error handler ───────────────────────────────────────────
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error || e.message);
  showToast('⚠️ ' + (e.message || 'An error occurred'));
});

// ─── DOM Ready ──────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

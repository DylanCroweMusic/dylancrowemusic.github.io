// store.js — Minimal state store with requestAnimationFrame render coalescing.
// NO subscribe() (amendment C3). Unidirectional: update() is the only mutation path.
// render() reads getState() → DOM, never calls update().

let state = {
  // Entity arrays keyed by entity type
  entities: {
    config: [],
    tour_stops: [],
    contacts: [],
    venues: [],
    gigs: [],
    house_concerts: [],
    busking_spots: [],
    busking_sessions: [],
    expense_log: [],
    todos: [],
  },
  // UI state
  ui: {
    activeView: 'home', // default tab
    modal: null, // DOM node or null
  },
};

let _renderFn = null;
let _rafScheduled = false;

/**
 * Get the current state object. Returns the live reference (components read from it).
 * @returns {Object}
 */
export function getState() {
  return state;
}

/**
 * Apply a mutator function to the state, then schedule a render via rAF.
 * The mutator receives a draft (the state object) and mutates it in place.
 *
 * @param {Function} mutator — (state) => void
 */
export function update(mutator) {
  mutator(state);
  _scheduleRender();
}

/**
 * Set the active view/tab.
 * @param {string} viewName
 */
export function setActiveView(viewName) {
  update((s) => {
    s.ui.activeView = viewName;
  });
}

/**
 * Set or clear the modal content.
 * @param {Node|null} contentNode
 */
export function setModal(contentNode) {
  update((s) => {
    s.ui.modal = contentNode;
  });
}

/**
 * Register the render function. Called once at app boot by main.js.
 * @param {Function} fn — () => void, reads getState() and renders to DOM
 */
export function setRenderFn(fn) {
  _renderFn = fn;
}

/**
 * Schedule a render via requestAnimationFrame. Coalesces multiple updates
 * into a single render per frame (prevents thrashing).
 * @private
 */
function _scheduleRender() {
  if (_rafScheduled) return;
  _rafScheduled = true;
  requestAnimationFrame(() => {
    _rafScheduled = false;
    if (_renderFn) {
      _renderFn();
    }
  });
}

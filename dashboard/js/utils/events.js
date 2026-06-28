/**
 * Event helper utilities for Tour OS v4.
 */

/**
 * Guard an async handler against concurrent invocation.
 * If already running, subsequent calls are dropped (return undefined).
 * @param {Function} fn - async function to guard
 * @returns {Function} guarded async wrapper
 */
export function guarded(fn) {
  let busy = false;
  return async function (...args) {
    if (busy) return;
    busy = true;
    try {
      return await fn(...args);
    } finally {
      busy = false;
    }
  };
}

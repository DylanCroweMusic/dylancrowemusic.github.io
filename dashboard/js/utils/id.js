/**
 * ID generator for Tour OS v4.
 */

/**
 * Generate a unique ID with a prefix.
 * @param {string} prefix - e.g. "show", "task"
 * @returns {string} e.g. "show_lq2x3k_ab12cd"
 */
export function generateId(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

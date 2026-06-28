/**
 * Money helpers (AUD) for Tour OS v4.
 */

/**
 * Format a number as AUD currency, e.g. 380 -> "$380.00".
 */
export function formatAUD(amount) {
  const n = Number(amount);
  if (isNaN(n)) return "$0.00";
  return "$" + n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parse a currency string like "$380.00" or "380" into a number.
 */
export function parseAUD(str) {
  if (typeof str === "number") return str;
  if (!str) return 0;
  const cleaned = String(str).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

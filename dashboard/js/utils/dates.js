/**
 * Date helpers for Tour OS v4.
 * All date strings are ISO "YYYY-MM-DD" unless noted.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parse(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return new Date(dateStr.getTime());
  // Accept "YYYY-MM-DD" without timezone drift.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date string as "15 Aug 2026".
 */
export function formatDate(dateStr) {
  const d = parse(dateStr);
  if (!d) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Integer number of days between two dates (d2 - d1).
 */
export function daysBetween(d1, d2) {
  const a = parse(d1);
  const b = parse(d2);
  if (!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

/**
 * Return today's date as "YYYY-MM-DD" in local time.
 */
export function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Return true if dateStr is before today.
 */
export function isOverdue(dateStr) {
  const d = parse(dateStr);
  if (!d) return false;
  const t = parse(today());
  if (!t) return false;
  return d.getTime() < t.getTime();
}

/**
 * Add n days to dateStr, return "YYYY-MM-DD".
 */
export function addDays(dateStr, n) {
  const d = parse(dateStr);
  if (!d) return "";
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

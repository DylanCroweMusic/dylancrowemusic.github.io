/**
 * badge.js — Status / shortfall / auto badges (v4 UI)
 * renderBadge(type, value) returns a DOM <span> with .badge class
 * and color based on type.
 *
 * Colors:
 *  pipeline_status:
 *    not_contacted=gray, contacted=cyan, follow_up=amber,
 *    booked=cyan, confirmed=green, played=green,
 *    declined=red, cancelled=red
 *  shortfall: red if >0, green if 0
 *  auto: small "AUTO" badge
 *
 * @module components/badge
 */
import { h } from '../utils/dom.js';

const PIPELINE_COLORS = {
  not_contacted: { bg: 'rgba(150,150,160,.18)', color: '#9a9aa5', label: 'Not contacted' },
  contacted:     { bg: 'rgba(0,212,200,.18)',   color: '#00d4c8', label: 'Contacted' },
  follow_up:     { bg: 'rgba(245,176,66,.18)',  color: '#f5b042', label: 'Follow up' },
  booked:        { bg: 'rgba(0,212,200,.18)',   color: '#00d4c8', label: 'Booked' },
  confirmed:     { bg: 'rgba(76,217,128,.18)',  color: '#4cd980', label: 'Confirmed' },
  played:        { bg: 'rgba(76,217,128,.18)',  color: '#4cd980', label: 'Played' },
  declined:      { bg: 'rgba(235,87,87,.18)',   color: '#eb5757', label: 'Declined' },
  cancelled:     { bg: 'rgba(235,87,87,.18)',   color: '#eb5757', label: 'Cancelled' },
};

function _pretty(value) {
  if (value == null) return '';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * @param {"pipeline_status"|"shortfall"|"auto"} type
 * @param {*} value
 * @returns {HTMLElement} <span class="badge">
 */
export function renderBadge(type, value) {
  let bg = 'rgba(150,150,160,.18)';
  let color = '#9a9aa5';
  let text = _pretty(value);
  let extraStyle = {};

  if (type === 'pipeline_status') {
    const cfg = PIPELINE_COLORS[value] || { bg, color, label: _pretty(value) };
    bg = cfg.bg; color = cfg.color; text = cfg.label;
  } else if (type === 'shortfall') {
    const n = Number(value) || 0;
    if (n > 0) { bg = 'rgba(235,87,87,.18)'; color = '#eb5757'; }
    else { bg = 'rgba(76,217,128,.18)'; color = '#4cd980'; }
    text = `−${n}`; // minus sign + number (shortfall)
    if (n === 0) text = '0';
  } else if (type === 'auto') {
    bg = 'rgba(150,150,160,.14)';
    color = '#7a7a85';
    text = 'AUTO';
    extraStyle = { fontSize: '10px', letterSpacing: '.05em', padding: '2px 5px' };
  }

  return h('span', {
    class: 'badge',
    'data-badge-type': type,
    'data-badge-value': String(value ?? ''),
    style: Object.assign({
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '600',
      lineHeight: '1.4',
      background: bg,
      color: color,
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    }, extraStyle),
  }, text);
}

export default renderBadge;

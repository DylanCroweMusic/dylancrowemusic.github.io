/**
 * DOM helpers for Tour OS v4.
 */

/**
 * Create a DOM element, set props/attributes/listeners, and append children.
 * @param {string} tag - tag name, e.g. "div", "button"
 * @param {object} props - { class, id, text, data, on, ...attrs }
 * @param {...Node|string|number} children
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;

    if (key === "class") {
      el.className = value;
    } else if (key === "text" || key === "textContent") {
      el.textContent = value;
    } else if (key === "html" || key === "innerHTML") {
      el.innerHTML = value;
    } else if (key === "style" && typeof value === "object") {
      Object.assign(el.style, value);
    } else if (key === "data" && typeof value === "object") {
      for (const [dk, dv] of Object.entries(value)) {
        el.dataset[dk] = dv;
      }
    } else if (key === "on" && typeof value === "object") {
      for (const [evt, handler] of Object.entries(value)) {
        el.addEventListener(evt, handler);
      }
    } else if (key.startsWith("on") && typeof value === "function") {
      // Handle onClick, onChange, onInput, etc.
      const eventType = key.slice(2).toLowerCase();
      el.addEventListener(eventType, value);
    } else if (key === "dataset" && typeof value === "object") {
      Object.assign(el.dataset, value);
    } else if (key in el && key !== "list") {
      try {
        el[key] = value;
      } catch {
        el.setAttribute(key, value);
      }
    } else {
      el.setAttribute(key, value);
    }
  }

  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }

  return el;
}

/** Query selector. */
export const $ = (sel, root = document) => root.querySelector(sel);

/** Query selector all (returns array). */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

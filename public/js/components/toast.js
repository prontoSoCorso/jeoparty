// Messaggi brevi in basso, che spariscono da soli.
import { h } from '../dom.js';

const area = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
document.body.append(area);

export function toast(message, { ms = 3500, kind = 'info' } = {}) {
  const el = h('div', { class: ['toast', `toast--${kind}`] }, message);
  area.append(el);
  setTimeout(() => el.remove(), ms);
}

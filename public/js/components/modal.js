// Finestre modali fatte a mano (il browser in sala non deve mostrare alert/confirm di sistema).
import { h } from '../dom.js';
import { T } from '../strings.js';

const layer = h('div', { class: 'modal-layer', hidden: true });
document.body.append(layer);
let closeCurrent = null;

export const isModalOpen = () => closeCurrent !== null;

/**
 * Apre una modale. actions: [{ label, kind: 'primary'|'ghost'|'danger', onClick, keep }].
 * Un'azione chiude la modale, a meno che onClick restituisca false o keep sia true.
 */
export function openModal({ title, body, actions = [{ label: T.close, kind: 'primary' }], onClose }) {
  closeCurrent?.();
  const previousFocus = document.activeElement;
  const close = () => {
    if (closeCurrent !== close) return;
    closeCurrent = null;
    layer.hidden = true;
    layer.replaceChildren();
    document.removeEventListener('keydown', onKey, true);
    onClose?.();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  };
  const buttons = actions.map((a) =>
    h('button', {
      class: ['btn', a.kind === 'primary' && 'btn--primary', a.kind === 'danger' && 'btn--ko', a.kind === 'ghost' && 'btn--ghost'],
      type: 'button',
      on: {
        click: () => {
          const result = a.onClick?.();
          if (result !== false && !a.keep) close();
        },
      },
    }, a.label));
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('h2', { class: 'modal__title' }, title),
    h('div', { class: 'modal__body' }, body),
    h('div', { class: 'modal__actions' }, buttons));
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      // Trappola del focus: Tab resta dentro la modale.
      const focusables = [...box.querySelectorAll('button, input, select, textarea')].filter((el) => !el.disabled);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  layer.replaceChildren(box);
  layer.hidden = false;
  closeCurrent = close;
  document.addEventListener('keydown', onKey, true);
  (box.querySelector('input, select') ?? buttons.find((b) => b.classList.contains('btn--primary')) ?? buttons[0])?.focus();
  return close;
}

/** Conferma sì/no; onYes viene chiamata solo se si conferma. */
export function confirmDialog(message, onYes, { yes = T.yes, no = T.cancel } = {}) {
  return openModal({
    title: T.confirm,
    body: h('p', null, message),
    actions: [
      { label: no, kind: 'ghost' },
      { label: yes, kind: 'primary', onClick: onYes },
    ],
  });
}

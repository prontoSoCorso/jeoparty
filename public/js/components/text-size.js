// Pulsanti S/M/L per la dimensione del testo (variabile CSS --scala, salvata nelle impostazioni).
import { h } from '../dom.js';
import { T } from '../strings.js';
import { TEXT_SCALES } from '../state.js';

export function textSizeButtons(ctx, { onChange } = {}) {
  const current = ctx.store.settings.textScale;
  return h('div', { class: 'size-buttons', role: 'group', 'aria-label': T.settings.textSize },
    Object.keys(TEXT_SCALES).map((size) => h('button', {
      class: ['btn btn--small', size === current && 'btn--primary'],
      type: 'button',
      'aria-pressed': String(size === current),
      'data-fk': `size-${size}`,
      on: {
        click: () => {
          ctx.actions.setTextScale(size);
          onChange?.();
        },
      },
    }, T.settings.sizes[size])));
}

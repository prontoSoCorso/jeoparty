// 🚩 Segnala: salva l'indizio (id, categoria, testo) fra le segnalazioni, da copiare poi dalle Impostazioni.
import { h } from '../dom.js';
import { T } from '../strings.js';

/** item: { key, category, value, clue, answer } */
export function flagButton(ctx, item) {
  const flagged = ctx.store.flags.some((f) => f.key === item.key);
  return h('button', {
    class: 'btn btn--ghost btn--small',
    type: 'button',
    'data-fk': 'flag',
    title: T.clue.flagHint,
    disabled: flagged,
    on: { click: () => ctx.actions.flagClue(item) },
  }, flagged ? T.clue.flaggedShort : T.clue.flag);
}

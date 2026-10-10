// Barra dei punteggi: evidenzia la squadra di turno; sul tabellone un clic la rende "di turno".
import { h } from '../dom.js';
import { T } from '../strings.js';

export function scorebar(ctx, { clickable = false } = {}) {
  const game = ctx.store.game;
  return h('ol', { class: 'scorebar' }, game.teams.map((t, i) => {
    const isTurn = t.id === game.turn;
    const content = [
      h('span', { class: 'team__key', 'aria-hidden': 'true' }, i + 1),
      h('span', { class: 'team__info' },
        h('span', { class: 'team__name' }, t.name),
        h('span', { class: ['team__score', t.score < 0 && 'team__score--neg'] }, t.score)),
      isTurn && h('span', { class: 'team__turn', title: T.board.turn(t.name) }, '🎯'),
    ];
    return h('li', { class: ['team', isTurn && 'team--turn'], style: { '--team': t.color } },
      clickable
        ? h('button', {
          class: 'team__btn',
          type: 'button',
          'data-fk': `turn-${t.id}`,
          title: T.board.setTurn(t.name),
          'aria-pressed': String(isTurn),
          on: { click: () => ctx.dispatch({ type: 'SET_TURN', teamId: t.id }) },
        }, content)
        : h('div', { class: 'team__btn' }, content));
  }));
}

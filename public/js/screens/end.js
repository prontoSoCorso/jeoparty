// Classifica finale, con pari merito.
import { h } from '../dom.js';
import { T } from '../strings.js';
import { ranking } from '../rules.js';

export function renderEnd(ctx) {
  const game = ctx.store.game;
  const rows = ranking(game.teams);
  const tied = (rank) => rows.filter((r) => r.rank === rank).length > 1;
  ctx.autofocus = 'rematch';
  return h('section', { class: 'screen end' },
    h('h1', { class: 'screen__title' }, T.end.title),
    h('ol', { class: 'ranking' }, rows.map(({ team, rank }) =>
      h('li', { class: ['ranking__row', rank === 1 && 'ranking__row--first'], style: { '--team': team.color } },
        h('span', { class: 'ranking__pos' }, `${rank}°`),
        h('span', { class: 'ranking__name' }, team.name),
        tied(rank) && h('span', { class: 'ranking__tie' }, T.end.tie),
        h('span', { class: 'ranking__score' }, T.end.points(team.score))))),
    h('div', { class: 'end__actions' },
      h('button', { class: 'btn btn--primary btn--big', type: 'button', 'data-fk': 'rematch', on: { click: ctx.actions.rematch } }, T.end.rematch),
      h('button', { class: 'btn btn--big', type: 'button', 'data-fk': 'new', on: { click: ctx.actions.newGame } }, T.end.newGame),
      h('button', { class: 'btn btn--ghost btn--big', type: 'button', 'data-fk': 'home', on: { click: ctx.actions.goHome } }, T.end.home)));
}

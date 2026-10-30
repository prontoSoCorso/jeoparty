// Fine partita: podio (con pari merito, niente spareggio), classifica completa, coriandoli.
import { h } from '../dom.js';
import { T } from '../strings.js';
import { TEAM_COLORS, ranking } from '../rules.js';

const STEP_CLASS = ['podium__step--1', 'podium__step--2', 'podium__step--3'];
const listNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0]);

// Coriandoli solo CSS: posizione, ritardo, durata e colore casuali (solo grafica, nessun effetto sul gioco).
function confetti() {
  const colors = [...TEAM_COLORS, '#ffd34d', '#ffffff'];
  return h('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: 90 }, (_, i) => h('span', {
    class: 'confetti__piece',
    style: {
      '--x': `${Math.random() * 100}vw`,
      '--delay': `${Math.random() * 2.5}s`,
      '--dur': `${3 + Math.random() * 3}s`,
      '--rot': `${Math.floor(Math.random() * 360)}deg`,
      '--c': colors[i % colors.length],
    },
  })));
}

export function renderEnd(ctx) {
  const game = ctx.store.game;
  const rows = ranking(game.teams);
  const tied = (rank) => rows.filter((r) => r.rank === rank).length > 1;
  // Fino a tre posizioni distinte: al centro la prima, a sinistra la seconda, a destra la terza.
  const ranks = [...new Set(rows.map((r) => r.rank))].slice(0, 3);
  const steps = ranks.map((rank, i) => h('li', { class: ['podium__step', STEP_CLASS[i]] },
    h('span', { class: 'podium__teams' }, rows.filter((r) => r.rank === rank).map(({ team }) =>
      h('span', { class: 'podium__team', style: { '--team': team.color } }, team.name))),
    h('span', { class: 'podium__block' }, h('span', { class: 'podium__pos' }, `${rank}°`))));
  const order = [steps[1], steps[0], steps[2]].filter(Boolean);
  const winners = rows.filter((r) => r.rank === 1).map((r) => r.team.name);

  ctx.autofocus = 'rematch';
  return h('section', { class: 'screen end' },
    confetti(),
    h('h1', { class: 'screen__title end__title' }, winners.length > 1 ? T.end.winners(listNames(winners)) : T.end.winner(winners[0])),
    h('ol', { class: 'podium' }, order),
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

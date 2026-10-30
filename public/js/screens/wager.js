// Daily Double: la squadra di turno punta da 5 al maggiore tra il suo punteggio e 1000, poi si apre l'indizio.
import { h } from '../dom.js';
import { T } from '../strings.js';
import { DD_MIN_WAGER, ddLimits, teamById } from '../rules.js';
import { scorebar } from '../components/scorebar.js';

const round5 = (n) => Math.round(n / 5) * 5;

export function renderWager(ctx) {
  const game = ctx.store.game;
  const cur = game.current;
  const cat = game.board.categories[cur.col];
  const cell = game.board.cells[cur.col][cur.row];
  const team = teamById(game, cur.owner);
  const { min, max } = ddLimits(game);

  const input = h('input', {
    class: 'input wager__input',
    type: 'number',
    inputmode: 'numeric',
    step: 100,
    value: Math.min(max, cell.value),
    'aria-label': T.wager.amount,
    'data-fk': 'wager',
  });
  const hint = h('p', { class: 'wager__limits' }, T.wager.limits(min, max));
  const check = () => {
    const n = Number(input.value);
    const bad = input.value.trim() === '' || !Number.isFinite(n) || n < min || n > max;
    hint.classList.toggle('wager__limits--bad', bad);
  };
  input.addEventListener('input', check);
  const quick = (label, amount) => h('button', {
    class: 'btn',
    type: 'button',
    on: {
      click: () => {
        input.value = String(amount);
        check();
        input.focus();
      },
    },
  }, label);

  ctx.autofocus = 'wager';
  return h('section', { class: 'screen wager' }, h('div', { class: 'wager__main' },
    h('p', { class: 'wager__cat' }, h('span', { 'aria-hidden': 'true' }, cat.emoji), ' ', cat.name, ' · ', String(cell.value)),
    h('h1', { class: 'wager__title' }, T.wager.title),
    h('p', { class: 'wager__team', style: { '--team': team.color } }, T.wager.team(team.name, team.score)),
    h('form', {
      class: 'wager__form',
      novalidate: true,
      on: {
        submit: (e) => {
          e.preventDefault();
          ctx.dispatch({ type: 'SET_WAGER', amount: input.value.trim() === '' ? DD_MIN_WAGER : input.value });
        },
      },
    },
    h('div', { class: 'wager__row' },
      input,
      h('button', { class: 'btn btn--primary btn--big', type: 'submit' }, T.wager.confirm, h('kbd', null, 'Invio'))),
    hint,
    h('div', { class: 'wager__quick' },
      quick('500', Math.min(max, 500)),
      quick(T.wager.half, Math.max(min, round5(max / 2))),
      quick(T.wager.all, max)))),
  scorebar(ctx));
}

// Indizio a tutto schermo: ✓/✗ per le squadre che possono rispondere, Mostra risposta, Nessuno/Salta.
import { h } from '../dom.js';
import { T } from '../strings.js';
import { answerableTeams, stealOrder, teamById } from '../rules.js';
import { scorebar } from '../components/scorebar.js';

function statusText(game, cell, cur, answerable) {
  const owner = teamById(game, cur.owner);
  if (cur.resolved) {
    const winner = cur.winner ? teamById(game, cur.winner) : null;
    return winner ? T.clue.won(winner.name, cell.dd ? cur.wager : cell.value) : T.clue.nobody;
  }
  if (cell.dd) return T.clue.dd(owner.name, cur.wager);
  if (game.options.mode === 'race') return T.clue.race;
  if (cur.stage === 'owner') return T.clue.answering(owner.name);
  return `${T.clue.steal} ${answerable.map((id) => teamById(game, id).name).join(', ')}`;
}

export function renderClue(ctx) {
  const game = ctx.store.game;
  const cur = game.current;
  const cat = game.board.categories[cur.col];
  const cell = game.board.cells[cur.col][cur.row];
  const answerable = answerableTeams(game);
  const teamNumber = (id) => game.teams.findIndex((t) => t.id === id) + 1;
  const order = game.options.mode === 'turn' && cur.stage === 'steal' ? stealOrder(game.teams, cur.owner) : game.teams.map((t) => t.id);

  const tried = Object.entries(cur.results).map(([id, result]) => {
    const t = teamById(game, id);
    return h('span', { class: ['pill', `pill--${result}`], style: { '--team': t.color } }, `${result === 'correct' ? '✓' : '✗'} ${t.name}`);
  });

  const teamControls = !cur.resolved && h('div', { class: 'clue__teams' },
    order.filter((id) => answerable.includes(id)).map((id) => {
      const t = teamById(game, id);
      const n = teamNumber(id);
      return h('div', { class: 'clue__team', style: { '--team': t.color } },
        h('span', { class: 'clue__team-name' }, t.name),
        h('button', {
          class: 'btn btn--ok',
          type: 'button',
          'data-fk': `ok-${id}`,
          'aria-label': T.clue.correct(t.name),
          on: { click: () => ctx.dispatch({ type: 'CORRECT', teamId: id }) },
        }, '✓', h('kbd', null, n)),
        h('button', {
          class: 'btn btn--ko',
          type: 'button',
          'data-fk': `ko-${id}`,
          'aria-label': T.clue.wrong(t.name),
          on: { click: () => ctx.dispatch({ type: 'WRONG', teamId: id }) },
        }, '✗', h('kbd', null, `⇧${n}`)));
    }));

  const answer = cur.revealed && h('div', { class: 'clue__answer' },
    h('p', { class: 'clue__answer-text' }, cell.answer),
    cell.accept?.length > 0 && h('p', { class: 'clue__accept' }, `${T.clue.accept} ${cell.accept.join(', ')}`),
    cell.notes && h('p', { class: 'clue__notes' }, `${T.clue.notes} ${cell.notes}`),
    !cell.verified && h('p', { class: 'clue__warn' }, T.clue.unverified));

  const actions = h('div', { class: 'clue__actions' },
    cur.resolved
      ? h('button', {
        class: 'btn btn--primary btn--big',
        type: 'button',
        'data-fk': 'back',
        on: { click: () => ctx.dispatch({ type: 'CLOSE' }) },
      }, T.clue.back, h('kbd', null, 'Invio'))
      : [
        !cur.revealed && h('button', {
          class: 'btn',
          type: 'button',
          'data-fk': 'reveal',
          on: { click: () => ctx.dispatch({ type: 'REVEAL' }) },
        }, T.clue.reveal, h('kbd', null, 'Spazio')),
        h('button', {
          class: 'btn btn--ghost',
          type: 'button',
          'data-fk': 'skip',
          on: { click: () => ctx.dispatch({ type: 'SKIP' }) },
        }, T.clue.skip, h('kbd', null, '0')),
      ]);

  ctx.autofocus = 'clue';
  ctx.onKey = (e) => {
    const digit = /^(Digit|Numpad)([1-6])$/.exec(e.code);
    if (digit) {
      const team = game.teams[Number(digit[2]) - 1];
      if (team && answerable.includes(team.id)) {
        e.preventDefault();
        ctx.dispatch({ type: e.shiftKey ? 'WRONG' : 'CORRECT', teamId: team.id });
      }
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!cur.revealed) ctx.dispatch({ type: 'REVEAL' });
    } else if (['Digit0', 'Numpad0', 'KeyN'].includes(e.code) && !cur.resolved) {
      e.preventDefault();
      ctx.dispatch({ type: 'SKIP' });
    } else if ((e.key === 'Enter' || e.key === 'Escape') && cur.resolved) {
      e.preventDefault();
      ctx.dispatch({ type: 'CLOSE' });
    }
  };

  return h('section', { class: ['screen clue', cell.dd && 'clue--dd'] },
    h('header', { class: 'clue__head' },
      h('span', { class: 'clue__cat' }, h('span', { 'aria-hidden': 'true' }, cat.emoji), ' ', cat.name),
      h('span', { class: 'clue__value' }, cell.dd ? `Daily Double · ${cur.wager}` : String(cell.value))),
    cat.description && h('p', { class: 'clue__desc' }, cat.description),
    h('div', { class: 'clue__main', tabindex: '-1', 'data-fk': 'clue' },
      h('p', { class: 'clue__text' }, cell.clue),
      answer),
    h('p', { class: 'clue__status', role: 'status' },
      h('span', null, statusText(game, cell, cur, answerable)),
      tried.length > 0 && h('span', { class: 'clue__tried' }, tried)),
    teamControls,
    actions,
    scorebar(ctx));
}

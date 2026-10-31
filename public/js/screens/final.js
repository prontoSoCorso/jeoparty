// Gran Finale: categoria (rilanciabile una volta) → puntate segrete → indizio con timer e musica → rivelazione
// dalla squadra con meno punti alla prima.
import { h } from '../dom.js';
import { T } from '../strings.js';
import { finalNext, finalWagersReady, teamById } from '../rules.js';
import { stopMusic } from '../audio.js';
import { gameBar } from '../components/game-bar.js';
import { scorebar } from '../components/scorebar.js';
import { flagButton } from '../components/flag.js';
import { timerElement, toggleTimer } from '../components/timer.js';
import { textFit } from './clue.js';

const names = (game, ids) => ids.map((id) => teamById(game, id).name).join(', ');
const teamDigit = (game, id) => game.teams.findIndex((t) => t.id === id) + 1;

function catLine(f) {
  return h('p', { class: 'final__cat' }, h('span', { 'aria-hidden': 'true' }, f.category.emoji), ' ', f.category.name);
}

function pending(ctx) {
  ctx.actions.prepareFinal();
  const failed = ctx.ui.finalError;
  return h('div', { class: 'final__main' },
    h('p', { class: 'final__kicker' }, failed ? T.final.noCategory : T.final.preparing),
    failed && h('div', { class: 'final__actions' },
      h('button', { class: 'btn', type: 'button', on: { click: () => { ctx.ui.finalError = false; ctx.actions.prepareFinal(); } } }, T.final.retry),
      h('button', { class: 'btn btn--primary', type: 'button', 'data-fk': 'final-skip', on: { click: () => ctx.dispatch({ type: 'FINISH' }) } }, T.final.skip)));
}

function categoryStage(ctx, game, f) {
  const out = game.teams.filter((t) => !f.teams.includes(t.id)).map((t) => t.id);
  ctx.autofocus = 'final-next';
  return h('div', { class: 'final__main' },
    h('p', { class: 'final__kicker' }, T.final.category),
    h('p', { class: 'final__cat final__cat--big' }, h('span', { 'aria-hidden': 'true' }, f.category.emoji), ' ', f.category.name),
    f.category.description && h('p', { class: 'final__desc' }, f.category.description),
    h('p', { class: 'final__players' }, T.final.players(names(game, f.teams))),
    out.length > 0 && h('p', { class: 'final__excluded' }, T.final.excluded(names(game, out))),
    h('div', { class: 'final__actions' },
      h('button', {
        class: 'btn',
        type: 'button',
        'data-fk': 'final-reroll',
        disabled: f.rerolled,
        on: { click: () => ctx.actions.prepareFinal({ reroll: true }) },
      }, f.rerolled ? T.final.rerollUsed : T.final.reroll),
      h('button', {
        class: 'btn btn--primary btn--big',
        type: 'button',
        'data-fk': 'final-next',
        on: { click: () => ctx.dispatch({ type: 'FINAL_WAGERS' }) },
      }, T.final.toWagers)));
}

function wagersStage(ctx, game, f) {
  const status = h('ul', { class: 'final__status' }, f.teams.map((id) => {
    const t = teamById(game, id);
    const label = !(id in f.wagers) ? T.final.waiting : f.wagers[id] === null ? T.final.paper : T.final.ready;
    return h('li', { class: ['final__chip', id in f.wagers && 'final__chip--done'], style: { '--team': t.color } }, `${t.name}: ${label}`);
  }));
  const current = f.teams.find((id) => !(id in f.wagers));
  if (!current) {
    ctx.autofocus = 'final-clue';
    return h('div', { class: 'final__main' },
      catLine(f),
      status,
      h('p', { class: 'final__desc' }, T.final.allSet),
      h('button', {
        class: 'btn btn--primary btn--big',
        type: 'button',
        'data-fk': 'final-clue',
        disabled: !finalWagersReady(game),
        on: { click: () => ctx.dispatch({ type: 'FINAL_CLUE' }) },
      }, T.final.showClue));
  }
  const team = teamById(game, current);
  const input = h('input', {
    class: 'input final__wager',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': T.final.wagerTitle(team.name),
    'data-fk': `final-wager-${current}`,
  });
  const hint = h('p', { class: 'final__hint' }, T.final.wagerHint(team.score));
  ctx.autofocus = `final-wager-${current}`;
  return h('div', { class: 'final__main' },
    catLine(f),
    status,
    h('h2', { class: 'final__who', style: { '--team': team.color } }, T.final.wagerTitle(team.name)),
    h('form', {
      class: 'final__form',
      novalidate: true,
      autocomplete: 'off',
      on: {
        submit: (e) => {
          e.preventDefault();
          const v = input.value.trim();
          if (!/^\d+$/.test(v) || Number(v) > team.score) {
            hint.textContent = T.final.wagerBad(team.score);
            hint.classList.add('final__hint--bad');
            input.select();
            return;
          }
          ctx.dispatch({ type: 'FINAL_WAGER', teamId: current, amount: Number(v) });
        },
      },
    },
    h('div', { class: 'final__row' },
      input,
      h('button', { class: 'btn btn--primary', type: 'submit' }, T.final.confirm, h('kbd', null, 'Invio')),
      h('button', {
        class: 'btn btn--ghost',
        type: 'button',
        on: { click: () => ctx.dispatch({ type: 'FINAL_WAGER', teamId: current, amount: null }) },
      }, T.final.onPaper)),
    hint));
}

function clueStage(ctx, game, f) {
  const key = `final:${f.clue.key}`;
  const timed = game.options.timer.enabled;
  if (timed) ctx.timer = { key, seconds: game.options.timer.seconds, onExpire: stopMusic };
  ctx.music = { key, maxSeconds: timed ? null : 60 };
  ctx.autofocus = 'final-reveal';
  ctx.onKey = (e) => {
    if (e.code === 'KeyT' && !e.ctrlKey) {
      e.preventDefault();
      toggleTimer();
    }
  };
  return [
    timed && timerElement(),
    h('div', { class: 'final__main' },
      catLine(f),
      h('p', { class: ['clue__text', textFit(f.clue.clue)] }, f.clue.clue),
      h('div', { class: 'final__actions' },
        flagButton(ctx, { key: f.clue.key, category: f.category.name, value: 1000, clue: f.clue.clue, answer: f.clue.answer }),
        h('button', {
          class: 'btn btn--primary btn--big',
          type: 'button',
          'data-fk': 'final-reveal',
          on: { click: () => ctx.dispatch({ type: 'FINAL_REVEAL' }) },
        }, T.final.toReveal))),
  ];
}

function revealStage(ctx, game, f) {
  const next = finalNext(game);
  let paperInput = null;
  const paperHint = h('p', { class: 'final__hint' });
  const judge = (correct) => {
    const amount = paperInput ? paperInput.value.trim() : undefined;
    if (paperInput && (!/^\d+$/.test(amount) || Number(amount) > teamById(game, next).score)) {
      paperHint.textContent = T.final.wagerBad(teamById(game, next).score);
      paperHint.classList.add('final__hint--bad');
      paperInput.focus();
      return;
    }
    ctx.dispatch({ type: 'FINAL_JUDGE', teamId: next, correct, amount });
  };
  const rows = h('ol', { class: 'final__reveal' }, f.order.map((id) => {
    const t = teamById(game, id);
    const result = f.results[id];
    const isNext = id === next;
    let detail;
    if (result) {
      detail = h('span', { class: ['final__result', `final__result--${result}`] },
        `${result === 'correct' ? '✓' : '✗'} ${T.final.result(result === 'correct' ? '+' : '−', f.wagers[id])}`);
    } else if (isNext) {
      const n = teamDigit(game, id);
      if (f.wagers[id] === null) {
        paperInput = h('input', {
          class: 'input input--number',
          type: 'text',
          inputmode: 'numeric',
          autocomplete: 'off',
          'aria-label': T.final.paperWager,
          placeholder: '0',
          'data-fk': 'final-paper',
        });
      }
      detail = h('span', { class: 'final__judge' },
        paperInput ? h('label', { class: 'final__paper' }, h('span', null, T.final.paperWager), paperInput) : h('span', { class: 'final__secret' }, T.final.secret),
        h('button', { class: 'btn btn--ok', type: 'button', 'data-fk': `final-ok-${id}`, on: { click: () => judge(true) } }, '✓', h('kbd', null, n)),
        h('button', { class: 'btn btn--ko', type: 'button', 'data-fk': `final-ko-${id}`, on: { click: () => judge(false) } }, '✗', h('kbd', null, `⇧${n}`)));
    } else {
      detail = h('span', { class: 'final__secret' }, T.final.secret);
    }
    return h('li', { class: ['final__team', isNext && 'final__team--next'], style: { '--team': t.color } },
      h('span', { class: 'final__team-name' }, isNext ? T.final.turnOf(t.name) : t.name),
      detail);
  }));

  // Il focus non va su ✓/✗ (un Invio di troppo giudicherebbe): sul campo della puntata su carta o sul riquadro.
  ctx.autofocus = next ? (paperInput ? 'final-paper' : 'final-main') : 'final-end';
  ctx.onKey = (e) => {
    const digit = /^(Digit|Numpad)([1-6])$/.exec(e.code);
    if (digit && next && game.teams[Number(digit[2]) - 1]?.id === next) {
      e.preventDefault();
      judge(!e.shiftKey);
    }
  };
  return h('div', { class: 'final__main final__main--top', tabindex: '-1', 'data-fk': 'final-main' },
    catLine(f),
    h('p', { class: 'final__clue-small' }, f.clue.clue),
    h('div', { class: 'final__answer' },
      h('span', { class: 'final__answer-label' }, T.final.answer),
      h('p', { class: 'clue__answer-text' }, f.clue.answer),
      f.clue.accept?.length > 0 && h('p', { class: 'clue__accept' }, `${T.clue.accept} ${f.clue.accept.join(', ')}`),
      f.clue.notes && h('p', { class: 'clue__notes' }, `${T.clue.notes} ${f.clue.notes}`),
      !f.clue.verified && h('p', { class: 'clue__warn' }, T.clue.unverified)),
    rows,
    paperInput && paperHint,
    !next && h('button', {
      class: 'btn btn--primary btn--big',
      type: 'button',
      'data-fk': 'final-end',
      on: { click: () => ctx.dispatch({ type: 'FINAL_FINISH' }) },
    }, T.final.toRanking));
}

const STAGES = { category: categoryStage, wagers: wagersStage, clue: clueStage, reveal: revealStage, done: revealStage };

export function renderFinal(ctx) {
  const game = ctx.store.game;
  const f = game.final;
  const body = !f || f.stage === 'pending' ? pending(ctx) : STAGES[f.stage](ctx, game, f);
  return h('section', { class: 'screen final' },
    gameBar(ctx, h('span', { class: 'game__turn final__badge' }, `🏆 ${T.final.title}`)),
    body,
    scorebar(ctx, { showTurn: false }));
}

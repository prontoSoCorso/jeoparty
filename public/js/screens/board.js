// Tabellone 5×5: frecce per muoversi, Invio per aprire; tessere usate oscurate col colore di chi le ha prese.
import { h, qs } from '../dom.js';
import { T } from '../strings.js';
import { VALUES, canUndo, teamById } from '../rules.js';
import { scorebar } from '../components/scorebar.js';

// Prima tessera libera in ordine di lettura a partire da `from` (così, tornando al tabellone, il focus è già su una libera).
function nextFree(cells, from = { col: 0, row: 0 }) {
  const cols = cells.length;
  const total = cols * VALUES.length;
  const start = from.row * cols + from.col;
  for (let i = 0; i < total; i++) {
    const pos = (start + i) % total;
    const col = pos % cols;
    const row = Math.floor(pos / cols);
    if (!cells[col][row].used) return { col, row };
  }
  return from;
}

const MOVES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

export function renderBoard(ctx) {
  const game = ctx.store.game;
  const { categories, cells } = game.board;
  const turnTeam = teamById(game, game.turn);
  const focus = ctx.ui.focus;
  if (!focus || !cells[focus.col]?.[focus.row]) ctx.ui.focus = nextFree(cells);
  else if (cells[focus.col][focus.row].used) ctx.ui.focus = nextFree(cells, focus);
  ctx.autofocus = `cell-${ctx.ui.focus.col}-${ctx.ui.focus.row}`;

  const grid = h('div', { class: 'board', style: { '--cols': String(categories.length) } },
    categories.map((cat) => h('div', { class: 'board__head' },
      h('span', { class: 'board__emoji', 'aria-hidden': 'true' }, cat.emoji),
      h('span', { class: 'board__cat' }, cat.name))),
    VALUES.map((value, row) => categories.map((cat, col) => {
      const cell = cells[col][row];
      const taker = cell.takenBy ? teamById(game, cell.takenBy) : null;
      return h('button', {
        class: ['board__cell', cell.used && 'board__cell--used'],
        type: 'button',
        'data-fk': `cell-${col}-${row}`,
        'aria-label': cell.used ? `${T.board.cellLabel(cat.name, value)}, ${T.board.used}` : T.board.cellLabel(cat.name, value),
        on: {
          click: () => {
            ctx.ui.focus = { col, row };
            if (!cell.used) ctx.dispatch({ type: 'OPEN_CELL', col, row });
          },
          focus: () => { ctx.ui.focus = { col, row }; },
        },
      }, cell.used
        ? taker && h('span', { class: 'board__dot', style: { '--team': taker.color }, title: taker.name })
        : String(value));
    })));

  ctx.onKey = (e) => {
    if (MOVES[e.key]) {
      e.preventDefault();
      const [dc, dr] = MOVES[e.key];
      const col = Math.min(categories.length - 1, Math.max(0, ctx.ui.focus.col + dc));
      const row = Math.min(VALUES.length - 1, Math.max(0, ctx.ui.focus.row + dr));
      ctx.ui.focus = { col, row };
      qs(`[data-fk="cell-${col}-${row}"]`)?.focus();
      return;
    }
    const onCell = e.target === document.body || e.target.classList?.contains('board__cell');
    if ((e.key === 'Enter' || e.key === ' ') && onCell) {
      e.preventDefault();
      const { col, row } = ctx.ui.focus;
      if (!cells[col][row].used) ctx.dispatch({ type: 'OPEN_CELL', col, row });
    }
  };

  return h('section', { class: 'screen game' },
    h('header', { class: 'game__bar' },
      h('span', { class: 'game__logo' }, T.appName),
      h('span', { class: 'game__turn', style: { '--team': turnTeam.color } }, T.board.turn(turnTeam.name)),
      h('span', { class: 'game__tools' },
        h('button', {
          class: 'btn btn--small',
          type: 'button',
          'data-fk': 'undo',
          title: 'Ctrl+Z',
          disabled: !canUndo(game),
          on: { click: () => ctx.dispatch({ type: 'UNDO' }) },
        }, `↶ ${T.board.undo}`),
        h('button', { class: 'btn btn--small', type: 'button', 'data-fk': 'fullscreen', title: 'F', on: { click: ctx.actions.toggleFullscreen } }, `⛶ ${T.board.fullscreen}`),
        h('button', { class: 'btn btn--small', type: 'button', 'data-fk': 'menu', on: { click: ctx.actions.openMenu } }, `⚙ ${T.board.menu}`))),
    grid,
    scorebar(ctx, { clickable: true }));
}

// Avvio dell'app: store, caricamento dell'indice, scelta della schermata dallo stato, azioni e tastiera.
import { h, qs } from './dom.js';
import { T } from './strings.js';
import { createStore, TEXT_SCALES } from './state.js';
import { SLOTS, buildColumns, loadCategory, loadIndex, rememberPlayed } from './content.js';
import { createRng } from './random.js';
import { NAME_MAX, canUndo, createGame, defaultOptions, makeTeams, reduce, sanitizeOptions } from './rules.js';
import { openModal, confirmDialog, isModalOpen } from './components/modal.js';
import { toast } from './components/toast.js';
import { textSizeButtons } from './components/text-size.js';
import { renderHome } from './screens/home.js';
import { renderSetup, DAILY_DOUBLE_READY, FINAL_READY } from './screens/setup.js';
import { renderCategories } from './screens/categories.js';
import { renderBoard } from './screens/board.js';
import { renderClue } from './screens/clue.js';
import { renderEnd } from './screens/end.js';

const app = document.getElementById('app');
const store = createStore();
const rng = createRng();

const ctx = {
  store,
  index: null,
  indexError: false,
  ui: { query: '', focus: null },
  onKey: null,
  autofocus: null,
  actions: {},
  dispatch(action) {
    const game = store.game;
    if (!game) return;
    const next = reduce(game, action);
    if (next !== game) store.setGame(next);
  },
};

const screens = {
  loading: () => h('section', { class: 'screen screen--center' }, h('p', null, T.loading)),
  home: renderHome,
  setup: renderSetup,
  categories: renderCategories,
  board: renderBoard,
  clue: renderClue,
  end: renderEnd,
};

function currentScreen() {
  const game = store.game;
  if (!game || game.view !== 'game') return ctx.index || ctx.indexError ? 'home' : 'loading';
  if ((game.phase === 'setup' || game.phase === 'categories') && !ctx.index) return ctx.indexError ? 'home' : 'loading';
  return screens[game.phase] ? game.phase : 'home';
}

// Ridisegna la schermata; il focus torna sull'elemento che lo aveva (attributo data-fk)
// oppure, se non esiste più, su quello indicato dalla schermata (ctx.autofocus).
function render() {
  const focusKey = document.activeElement?.dataset?.fk;
  ctx.onKey = null;
  ctx.autofocus = null;
  app.replaceChildren(screens[currentScreen()](ctx));
  const byKey = (key) => (key ? qs(`[data-fk="${CSS.escape(key)}"]`, app) : null);
  const target = [byKey(focusKey), byKey(ctx.autofocus)].find((el) => el && !el.disabled);
  if (target && !isModalOpen()) target.focus({ preventScroll: true });
}
store.subscribe(render);

function applyTextScale(size) {
  document.documentElement.style.setProperty('--scala', String(TEXT_SCALES[size] ?? 1));
}

function freshSetup() {
  const last = store.settings.lastSetup;
  return {
    v: 1,
    view: 'game',
    phase: 'setup',
    options: sanitizeOptions(last?.options ?? defaultOptions()),
    teams: makeTeams(last?.teamNames ?? []),
    firstTeam: 'random',
  };
}

Object.assign(ctx.actions, {
  updateGame(fn, opts) {
    store.setGame(fn(store.game), opts);
  },
  newGame() {
    const start = () => {
      ctx.ui.focus = null;
      store.setGame(freshSetup());
    };
    if (store.game && !['setup', 'end'].includes(store.game.phase)) confirmDialog(T.home.confirmNew, start);
    else start();
  },
  resume() {
    store.setGame({ ...store.game, view: 'game' });
  },
  goHome() {
    if (store.game) store.setGame({ ...store.game, view: 'home' });
    else render();
  },
  toSetup() {
    store.setGame({ ...store.game, phase: 'setup' });
  },
  toCategories() {
    const game = store.game;
    store.setSettings({ lastSetup: { teamNames: game.teams.map((t) => t.name), options: game.options } }, { render: false });
    const groups = ctx.index?.groups.map((g) => g.id) ?? [];
    const draft = game.draft ?? { slots: Array(SLOTS).fill(null), groups };
    store.setGame({ ...game, phase: 'categories', draft });
  },
  async startBoard() {
    const game = store.game;
    const entries = game.draft.slots.map((id) => ctx.index.categories.find((c) => c.id === id));
    if (entries.some((e) => !e)) return;
    toast(T.categories.loadingBoard, { ms: 1500 });
    let categories;
    try {
      categories = await Promise.all(entries.map(loadCategory));
    } catch (err) {
      toast(`${T.loadError} (${err.message})`, { kind: 'error', ms: 8000 });
      return;
    }
    const columns = buildColumns(categories, { history: store.history.variants, onlyVerified: game.options.onlyVerified, rng });
    const options = {
      ...game.options,
      dailyDoubles: DAILY_DOUBLE_READY ? game.options.dailyDoubles : 0,
      final: FINAL_READY ? game.options.final : false,
    };
    const next = createGame({ options, teams: game.teams, columns, firstTeam: game.firstTeam, rng });
    next.draft = game.draft;
    next.firstTeam = game.firstTeam;
    store.setHistory(rememberPlayed(store.history, {
      variantKeys: columns.flatMap((c) => c.cells.map((cell) => cell.key)),
      categoryIds: entries.map((e) => e.id),
    }));
    ctx.ui.focus = null;
    store.setGame(next);
  },
  // Rivincita: stesse squadre e opzioni, punti a zero, stesse categorie già scelte (modificabili).
  rematch() {
    const game = store.game;
    const slots = game.board ? game.board.categories.map((c) => c.id) : Array(SLOTS).fill(null);
    const groups = game.draft?.groups ?? ctx.index?.groups.map((g) => g.id) ?? [];
    ctx.ui.focus = null;
    store.setGame({
      v: 1,
      view: 'game',
      phase: 'categories',
      options: game.options,
      teams: game.teams.map((t) => ({ ...t, score: 0 })),
      firstTeam: game.firstTeam ?? 'random',
      draft: { slots, groups },
    });
  },
  setTextScale(size) {
    applyTextScale(size);
    store.setSettings({ textScale: size });
  },
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  },
  openRules() {
    openModal({ title: T.rules.title, body: h('ul', { class: 'rules' }, T.rules.lines.map((line) => h('li', null, line))) });
  },
  openHelp() {
    openModal({
      title: T.help.title,
      body: h('table', { class: 'keys' }, h('tbody', null, T.help.rows.map(([k, v]) => h('tr', null, h('th', null, k), h('td', null, v))))),
    });
  },
  openSettings() {
    const box = h('div', { class: 'settings' });
    const fill = () => box.replaceChildren(
      h('div', { class: 'field' }, h('span', { class: 'field__label' }, T.settings.textSize), textSizeButtons(ctx, { onChange: fill })),
      h('button', {
        class: 'btn btn--ghost',
        type: 'button',
        on: {
          click: () => {
            store.setHistory({ variants: [], categories: [] });
            toast(T.settings.historyReset);
          },
        },
      }, T.settings.resetHistory));
    fill();
    openModal({ title: T.settings.title, body: box });
  },
  openTeams() {
    const game = store.game;
    const rows = game.teams.map((t) => ({
      team: t,
      name: h('input', { class: 'input', type: 'text', value: t.name, maxlength: NAME_MAX, 'aria-label': `${T.teamsDialog.name} ${t.name}` }),
      score: h('input', { class: 'input input--number', type: 'number', step: 100, value: t.score, 'aria-label': `${T.teamsDialog.score} ${t.name}` }),
    }));
    const body = h('table', { class: 'teams-table' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', null, T.teamsDialog.name), h('th', null, T.teamsDialog.score))),
      h('tbody', null, rows.map((r) => h('tr', null,
        h('td', null, h('span', { class: 'team-row__swatch', style: { '--team': r.team.color } })),
        h('td', null, r.name),
        h('td', null, r.score)))));
    openModal({
      title: T.teamsDialog.title,
      body,
      actions: [
        { label: T.cancel, kind: 'ghost' },
        {
          label: T.save,
          kind: 'primary',
          onClick: () => {
            for (const r of rows) {
              if (r.name.value.trim() !== r.team.name) ctx.dispatch({ type: 'RENAME', teamId: r.team.id, name: r.name.value });
              if (Number(r.score.value) !== r.team.score) ctx.dispatch({ type: 'SET_SCORE', teamId: r.team.id, score: r.score.value });
            }
          },
        },
      ],
    });
  },
  openMenu() {
    const game = store.game;
    const item = (label, fn, kind) => h('button', { class: ['btn', kind], type: 'button', on: { click: () => { close(); fn(); } } }, label);
    const body = h('div', { class: 'menu' },
      item(T.board.teamsAndScores, ctx.actions.openTeams),
      FINAL_READY && game.options.final && item(T.board.goFinal, () => ctx.dispatch({ type: 'END_BOARD' })),
      item(T.board.endGame, () => confirmDialog(T.board.endGameConfirm, () => ctx.dispatch({ type: 'FINISH' }))),
      item(T.home.rules, ctx.actions.openRules),
      item(T.home.settings, ctx.actions.openSettings),
      item(T.board.home, ctx.actions.goHome, 'btn--ghost'));
    const close = openModal({ title: T.board.menu, body });
  },
});

// Tastiera: scorciatoie globali, poi quelle della schermata (ctx.onKey). Mai mentre si scrive in un campo.
function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}
document.addEventListener('keydown', (e) => {
  if (isModalOpen() || e.altKey || e.metaKey) return;
  if (isTyping(e.target)) return;
  const inGame = store.game?.view === 'game';
  if (e.key === '?') {
    e.preventDefault();
    ctx.actions.openHelp();
    return;
  }
  if (e.code === 'KeyF' && !e.ctrlKey) {
    e.preventDefault();
    ctx.actions.toggleFullscreen();
    return;
  }
  if (inGame && ((e.ctrlKey && e.code === 'KeyZ') || (e.code === 'KeyU' && !e.ctrlKey))) {
    e.preventDefault();
    if (canUndo(store.game)) ctx.dispatch({ type: 'UNDO' });
    return;
  }
  ctx.onKey?.(e);
});

window.addEventListener('error', (e) => toast(`${T.unexpected}: ${e.message}`, { kind: 'error', ms: 8000 }));
window.addEventListener('unhandledrejection', (e) => toast(`${T.unexpected}: ${e.reason?.message ?? e.reason}`, { kind: 'error', ms: 8000 }));

async function boot() {
  applyTextScale(store.settings.textScale);
  for (const notice of store.notices) toast(T[notice], { kind: 'error', ms: 8000 });
  render();
  try {
    ctx.index = await loadIndex();
  } catch {
    ctx.indexError = true;
  }
  render();
}

boot();

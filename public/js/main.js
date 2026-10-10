// Avvio dell'app: store, caricamento dell'indice, scelta della schermata dallo stato, azioni e tastiera.
import { h, qs } from './dom.js';
import { T } from './strings.js';
import { createStore, TEXT_SCALES } from './state.js';
import { SLOTS, buildColumns, loadCategory, loadIndex, rememberPlayed } from './content.js';
import { createRng } from './random.js';
import { createGame, defaultOptions, makeTeams, sanitizeOptions } from './rules.js';
import { openModal, confirmDialog, isModalOpen } from './components/modal.js';
import { toast } from './components/toast.js';
import { textSizeButtons } from './components/text-size.js';
import { renderHome } from './screens/home.js';
import { renderSetup, DAILY_DOUBLE_READY } from './screens/setup.js';
import { renderCategories } from './screens/categories.js';

const app = document.getElementById('app');
const store = createStore();
const rng = createRng();

const ctx = {
  store,
  index: null,
  indexError: false,
  ui: { query: '' },
  onKey: null,
  actions: {},
};

const screens = {
  loading: () => h('section', { class: 'screen screen--center' }, h('p', null, T.loading)),
  home: renderHome,
  setup: renderSetup,
  categories: renderCategories,
  board: (c) => h('section', { class: 'screen screen--center' },
    h('h1', { class: 'screen__title' }, c.store.game.board.categories.map((x) => `${x.emoji} ${x.name}`).join(' · ')),
    h('p', null, 'Tabellone pronto: le schermate di gioco arrivano con la milestone M3.'),
    h('button', { class: 'btn', type: 'button', on: { click: c.actions.goHome } }, T.board.home)),
};

function currentScreen() {
  const game = store.game;
  if (!game || game.view !== 'game') return ctx.index || ctx.indexError ? 'home' : 'loading';
  if ((game.phase === 'setup' || game.phase === 'categories') && !ctx.index) return ctx.indexError ? 'home' : 'loading';
  return screens[game.phase] ? game.phase : 'home';
}

// Ridisegna la schermata e rimette il focus sull'elemento che lo aveva (attributo data-fk).
function render() {
  const focusKey = document.activeElement?.dataset?.fk;
  ctx.onKey = null;
  app.replaceChildren(screens[currentScreen()](ctx));
  const target = (focusKey && qs(`[data-fk="${CSS.escape(focusKey)}"]`, app)) || null;
  if (target && !target.disabled) target.focus();
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
    const start = () => store.setGame(freshSetup());
    if (store.game && store.game.phase !== 'setup' && store.game.phase !== 'end') confirmDialog(T.home.confirmNew, start);
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
    toast(T.categories.loadingBoard, { ms: 1500 });
    let categories;
    try {
      categories = await Promise.all(entries.map(loadCategory));
    } catch (err) {
      toast(`${T.loadError} (${err.message})`, { kind: 'error', ms: 8000 });
      return;
    }
    const columns = buildColumns(categories, { history: store.history.variants, onlyVerified: game.options.onlyVerified, rng });
    const options = DAILY_DOUBLE_READY ? game.options : { ...game.options, dailyDoubles: 0 };
    const next = createGame({ options, teams: game.teams, columns, firstTeam: game.firstTeam, rng });
    next.draft = game.draft;
    store.setHistory(rememberPlayed(store.history, {
      variantKeys: columns.flatMap((c) => c.cells.map((cell) => cell.key)),
      categoryIds: entries.map((e) => e.id),
    }));
    store.setGame(next);
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
});

// Tastiera: scorciatoie globali, poi quelle della schermata (ctx.onKey). Mai mentre si scrive in un campo.
function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}
document.addEventListener('keydown', (e) => {
  if (isModalOpen() || e.altKey || e.metaKey) return;
  if (isTyping(e.target)) return;
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

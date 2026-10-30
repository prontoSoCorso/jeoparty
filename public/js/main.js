// Avvio dell'app: store, caricamento dell'indice, scelta della schermata dallo stato, azioni e tastiera.
import { h, qs } from './dom.js';
import { T } from './strings.js';
import { createStore, TEXT_SCALES } from './state.js';
import {
  SLOTS, buildColumns, loadCategory, loadIndex, pickFinalCategory, pickVariant, rememberPlayed,
} from './content.js';
import { createRng } from './random.js';
import { MAX_VALUE, NAME_MAX, canUndo, createGame, defaultOptions, makeTeams, reduce, sanitizeOptions } from './rules.js';
import { openModal, confirmDialog, isModalOpen } from './components/modal.js';
import { toast } from './components/toast.js';
import { textSizeButtons } from './components/text-size.js';
import { syncTimer } from './components/timer.js';
import { configureAudio, play, syncMusic, unlockAudio } from './audio.js';
import { renderHome } from './screens/home.js';
import { renderSetup } from './screens/setup.js';
import { renderCategories } from './screens/categories.js';
import { renderBoard } from './screens/board.js';
import { renderWager } from './screens/wager.js';
import { renderClue } from './screens/clue.js';
import { renderFinal } from './screens/final.js';
import { renderEnd } from './screens/end.js';

const app = document.getElementById('app');
const store = createStore();
const rng = createRng();

// Suono da fare dopo un'azione andata a buon fine (prev → next).
function soundFor(action, prev, next) {
  switch (action.type) {
    case 'OPEN_CELL': return next.phase === 'wager' ? 'dailyDouble' : 'blip';
    case 'CORRECT': return 'correct';
    case 'WRONG': return 'wrong';
    case 'REVEAL':
    case 'SKIP':
    case 'FINAL_SETUP': return 'reveal';
    case 'FINAL_JUDGE': return action.correct ? 'correct' : 'wrong';
    default: return next.phase === 'end' && prev.phase !== 'end' ? 'applause' : null;
  }
}

const ctx = {
  store,
  index: null,
  indexError: false,
  ui: { query: '', focus: null },
  onKey: null,
  autofocus: null,
  timer: null,
  music: null,
  actions: {},
  dispatch(action) {
    const game = store.game;
    if (!game) return;
    const next = reduce(game, action);
    if (next === game) return;
    store.setGame(next);
    const sound = action.type === 'UNDO' ? null : soundFor(action, game, next);
    if (sound) play(sound);
  },
};

const screens = {
  loading: () => h('section', { class: 'screen screen--center' }, h('p', null, T.loading)),
  home: renderHome,
  setup: renderSetup,
  categories: renderCategories,
  board: renderBoard,
  wager: renderWager,
  clue: renderClue,
  final: renderFinal,
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
  ctx.timer = null;
  ctx.music = null;
  app.replaceChildren(screens[currentScreen()](ctx));
  syncTimer(ctx.timer);
  syncMusic(ctx.music);
  syncWakeLock();
  const byKey = (key) => (key ? qs(`[data-fk="${CSS.escape(key)}"]`, app) : null);
  const target = [byKey(focusKey), byKey(ctx.autofocus)].find((el) => el && !el.disabled);
  if (target && !isModalOpen()) target.focus({ preventScroll: true });
}
store.subscribe(render);

function applyTextScale(size) {
  document.documentElement.style.setProperty('--scala', String(TEXT_SCALES[size] ?? 1));
}

// Screen Wake Lock: durante la partita lo schermo non va in standby (se il browser lo permette).
let wakeLock = null;
let wakeLockPending = false;
async function syncWakeLock() {
  if (!('wakeLock' in navigator)) return;
  const game = store.game;
  const hold = game?.view === 'game' && ['board', 'wager', 'clue', 'final'].includes(game.phase) && document.visibilityState === 'visible';
  if (hold && !wakeLock && !wakeLockPending) {
    wakeLockPending = true;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {
      // Batteria scarica o permesso negato: si gioca lo stesso.
    } finally {
      wakeLockPending = false;
    }
  } else if (!hold && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}
document.addEventListener('visibilitychange', syncWakeLock);

function setSound(sound) {
  store.setSettings({ sound }, { render: false });
  configureAudio(store.settings);
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
    const next = createGame({ options: game.options, teams: game.teams, columns, firstTeam: game.firstTeam, rng });
    next.draft = game.draft;
    next.firstTeam = game.firstTeam;
    ctx.ui.finalError = false;
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
  // Gran Finale: categoria casuale fuori dal tabellone (se possibile) e una sua variante da 1000.
  async prepareFinal({ reroll = false } = {}) {
    const game = store.game;
    if (ctx.ui.preparingFinal || (!reroll && ctx.ui.finalError) || game?.phase !== 'final') return;
    if (!ctx.index) {
      if (ctx.indexError) {
        ctx.ui.finalError = true;
        render();
      }
      return;
    }
    const current = reroll ? game.final.category.id : null;
    const onBoard = game.board?.categories.map((c) => c.id) ?? [];
    const opts = { recent: store.history.categories, onlyVerified: game.options.onlyVerified, rng };
    const entry = pickFinalCategory(ctx.index.categories, { ...opts, exclude: [...onBoard, current] })
      ?? pickFinalCategory(ctx.index.categories, { ...opts, exclude: [current] });
    ctx.ui.preparingFinal = true;
    try {
      if (!entry) throw new Error(T.final.noCategory);
      const category = await loadCategory(entry);
      const { variant, key } = pickVariant(category, MAX_VALUE, { history: store.history.variants, onlyVerified: game.options.onlyVerified, rng });
      ctx.ui.preparingFinal = false;
      ctx.dispatch({
        type: 'FINAL_SETUP',
        reroll,
        category: { id: category.id, name: category.name, emoji: category.emoji, description: category.description },
        clue: {
          key,
          clue: variant.clue,
          answer: variant.answer,
          accept: variant.accept ?? [],
          notes: variant.notes ?? '',
          verified: variant.verified === true,
        },
      });
      store.setHistory(rememberPlayed(store.history, { variantKeys: [key], categoryIds: [category.id] }));
    } catch (err) {
      ctx.ui.preparingFinal = false;
      if (reroll) {
        toast(`${T.loadError} (${err.message})`, { kind: 'error', ms: 6000 });
      } else {
        ctx.ui.finalError = true;
        render();
      }
    }
  },
  flagClue(item) {
    if (store.flags.some((f) => f.key === item.key)) return;
    store.setFlags([...store.flags, { ...item, at: new Date().toISOString() }]);
    toast(T.clue.flagged);
    render();
  },
  // "Copia segnalazioni": id, categoria e testo di ogni indizio segnalato.
  async copyFlags() {
    const flags = store.flags;
    const text = [
      T.settings.flagsTitle(flags.length),
      '',
      ...flags.flatMap((f, i) => [T.settings.flagLine(i + 1, f), T.settings.flagClue(f.clue), T.settings.flagAnswer(f.answer), '']),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast(T.settings.copied(flags.length));
    } catch {
      const area = h('textarea', { class: 'input copy-area', readonly: true, rows: 12 }, text);
      openModal({ title: T.settings.copyFlags, body: h('div', null, h('p', null, T.settings.copyManual), area) });
      area.focus();
      area.select();
    }
  },
  setTextScale(size) {
    applyTextScale(size);
    store.setSettings({ textScale: size });
  },
  toggleSound() {
    setSound(!store.settings.sound);
    toast(store.settings.sound ? T.settings.soundOn : T.settings.soundOff, { ms: 1500 });
    render();
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
      h('label', { class: 'switch' },
        h('input', {
          type: 'checkbox',
          checked: store.settings.sound,
          on: {
            change: (e) => {
              setSound(e.target.checked);
              fill();
            },
          },
        }),
        h('span', { class: 'switch__text' }, h('strong', null, T.settings.sound))),
      h('label', { class: 'field' },
        h('span', { class: 'field__label' }, T.settings.volume),
        h('input', {
          class: 'range',
          type: 'range',
          min: 0,
          max: 100,
          step: 5,
          value: Math.round(store.settings.volume * 100),
          disabled: !store.settings.sound,
          on: {
            input: (e) => {
              store.setSettings({ volume: Number(e.target.value) / 100 }, { render: false });
              configureAudio(store.settings);
            },
            change: () => play('correct'),
          },
        })),
      h('div', { class: 'field' },
        h('span', { class: 'field__label' }, T.settings.flags(store.flags.length)),
        h('button', {
          class: 'btn btn--small',
          type: 'button',
          'data-fk': 'copy-flags',
          disabled: store.flags.length === 0,
          on: { click: () => ctx.actions.copyFlags() },
        }, T.settings.copyFlags),
        h('button', {
          class: 'btn btn--small btn--ghost',
          type: 'button',
          disabled: store.flags.length === 0,
          on: {
            click: () => confirmDialog(T.settings.clearFlagsConfirm, () => {
              store.setFlags([]);
              ctx.actions.openSettings();
            }),
          },
        }, T.settings.clearFlags)),
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
      game.phase === 'board' && game.options.final && item(T.board.goFinal, () => ctx.dispatch({ type: 'END_BOARD' })),
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
  if (e.code === 'KeyM' && !e.ctrlKey) {
    e.preventDefault();
    ctx.actions.toggleSound();
    return;
  }
  if (inGame && ((e.ctrlKey && e.code === 'KeyZ') || (e.code === 'KeyU' && !e.ctrlKey))) {
    e.preventDefault();
    if (canUndo(store.game)) ctx.dispatch({ type: 'UNDO' });
    return;
  }
  ctx.onKey?.(e);
});

// L'audio si può attivare solo dopo un gesto dell'utente (regole dei browser sull'autoplay).
document.addEventListener('pointerdown', unlockAudio, true);
document.addEventListener('keydown', unlockAudio, true);

window.addEventListener('error', (e) => toast(`${T.unexpected}: ${e.message}`, { kind: 'error', ms: 8000 }));
window.addEventListener('unhandledrejection', (e) => toast(`${T.unexpected}: ${e.reason?.message ?? e.reason}`, { kind: 'error', ms: 8000 }));

async function boot() {
  applyTextScale(store.settings.textScale);
  configureAudio(store.settings);
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

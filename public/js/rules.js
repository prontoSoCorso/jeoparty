// Regole del gioco. Modulo PURO: niente DOM né rete, ogni funzione restituisce un nuovo stato.
import { randomInt, shuffle, weightedIndex } from './random.js';

export const VALUES = [200, 400, 600, 800, 1000];
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 6;
export const NAME_MAX = 24;
// Palette Okabe-Ito senza il blu (si confonderebbe con il tabellone): distinguibile anche da chi è daltonico.
export const TEAM_COLORS = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#D55E00', '#CC79A7'];
export const TIMER_MIN = 5;
export const TIMER_MAX = 60;
export const MODES = ['turn', 'race'];
export const MAX_VALUE = VALUES[VALUES.length - 1];
export const DD_MIN_WAGER = 5;
export const UNDO_LIMIT = 30;

export function defaultOptions() {
  return {
    mode: 'turn',
    steal: false,
    penalty: true,
    timer: { enabled: true, seconds: 30 },
    dailyDoubles: 1,
    final: true,
    onlyVerified: false,
  };
}

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Completa e corregge le opzioni (anche quelle salvate da versioni precedenti). */
export function sanitizeOptions(raw) {
  const d = defaultOptions();
  const o = raw && typeof raw === 'object' ? raw : {};
  const timer = o.timer && typeof o.timer === 'object' ? o.timer : {};
  return {
    mode: MODES.includes(o.mode) ? o.mode : d.mode,
    steal: typeof o.steal === 'boolean' ? o.steal : d.steal,
    penalty: typeof o.penalty === 'boolean' ? o.penalty : d.penalty,
    timer: {
      enabled: typeof timer.enabled === 'boolean' ? timer.enabled : d.timer.enabled,
      seconds: clampInt(timer.seconds, TIMER_MIN, TIMER_MAX, d.timer.seconds),
    },
    dailyDoubles: clampInt(o.dailyDoubles, 0, 2, d.dailyDoubles),
    final: typeof o.final === 'boolean' ? o.final : d.final,
    onlyVerified: typeof o.onlyVerified === 'boolean' ? o.onlyVerified : d.onlyVerified,
  };
}

export function cleanName(name, position) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return n || `Squadra ${position + 1}`;
}

/** Crea le squadre (2–6) con id stabili e colori della palette. */
export function makeTeams(names) {
  const list = (Array.isArray(names) ? names : []).slice(0, MAX_TEAMS);
  while (list.length < MIN_TEAMS) list.push('');
  return list.map((name, i) => ({ id: `t${i + 1}`, name: cleanName(name, i), color: TEAM_COLORS[i], score: 0 }));
}

export function addTeam(teams) {
  if (teams.length >= MAX_TEAMS) return teams;
  let n = 1;
  while (teams.some((t) => t.id === `t${n}`)) n++;
  const color = TEAM_COLORS.find((c) => !teams.some((t) => t.color === c)) ?? TEAM_COLORS[0];
  return [...teams, { id: `t${n}`, name: cleanName('', teams.length), color, score: 0 }];
}

export function removeTeam(teams, id) {
  if (teams.length <= MIN_TEAMS) return teams;
  return teams.filter((t) => t.id !== id);
}

export const teamById = (state, id) => state.teams.find((t) => t.id === id);

/** Squadra successiva nell'ordine del Setup (ciclico). */
export function nextTeamId(teams, id) {
  const i = teams.findIndex((t) => t.id === id);
  return teams[(i + 1) % teams.length].id;
}

// Probabilità del Daily Double per riga (200…1000): mai sulla prima, più spesso sulla quarta.
export const DD_ROW_WEIGHTS = [0, 8, 27, 40, 25];

/** Posizioni dei Daily Double: righe pesate, colonne tutte diverse. */
export function placeDailyDoubles(count, columns, rng) {
  const cols = shuffle(rng, [...Array(columns).keys()]).slice(0, Math.max(0, Math.min(count, columns)));
  return cols.map((col) => ({ col, row: weightedIndex(rng, DD_ROW_WEIGHTS) }));
}

/**
 * Nuova partita sul tabellone. columns: [{ category, cells: [{ value, clue, answer, … }] }] da content.buildColumns.
 * firstTeam: id della squadra che inizia, oppure 'random'.
 */
export function createGame({ options, teams, columns, firstTeam = 'random', rng }) {
  const opts = sanitizeOptions(options);
  const dd = placeDailyDoubles(opts.dailyDoubles, columns.length, rng);
  const turn = teams.some((t) => t.id === firstTeam) ? firstTeam : teams[randomInt(rng, teams.length)].id;
  return {
    v: 1,
    view: 'game',
    phase: 'board',
    options: opts,
    teams: teams.map((t) => ({ ...t, score: 0 })),
    turn,
    board: {
      categories: columns.map((c) => c.category),
      cells: columns.map((c, col) =>
        c.cells.map((cell, row) => ({
          ...cell,
          dd: dd.some((d) => d.col === col && d.row === row),
          used: false,
          takenBy: null,
          results: {},
        }))),
    },
    current: null,
    final: null,
    undo: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Partita: tessere, risposte, turni. Ogni funzione restituisce lo stesso stato se l'azione non è ammessa.

// Copia profonda dello stato, tranne la pila di Annulla (che non viene mai modificata, solo sostituita).
function clone(state) {
  const { undo, ...rest } = state;
  const copy = structuredClone(rest);
  copy.undo = undo ?? [];
  return copy;
}

export const cellAt = (state, col, row) => state.board.cells[col][row];
export const isBoardComplete = (state) => state.board.cells.every((column) => column.every((c) => c.used));

// Con la penalità disattivata nessun punteggio scende sotto zero (Daily Double e Gran Finale compresi).
function applyDelta(state, teamId, delta) {
  const team = teamById(state, teamId);
  const raw = team.score + delta;
  team.score = state.options.penalty ? raw : Math.max(Math.min(team.score, 0), raw);
}

/** Ordine della rubata: le altre squadre a partire da quella dopo `ownerId`. */
export function stealOrder(teams, ownerId) {
  const ids = teams.map((t) => t.id);
  const i = ids.indexOf(ownerId);
  return [...ids.slice(i + 1), ...ids.slice(0, i)];
}

/** Squadre che in questo momento possono ricevere ✓/✗ (le cifre 1–6 valgono solo per loro). */
export function answerableTeams(state) {
  const cur = state.current;
  if (state.phase !== 'clue' || !cur || cur.resolved) return [];
  const cell = cellAt(state, cur.col, cur.row);
  const untried = (id) => cur.results[id] === undefined;
  if (cell.dd) return untried(cur.owner) ? [cur.owner] : [];
  if (state.options.mode === 'race') return state.teams.map((t) => t.id).filter(untried);
  if (cur.stage === 'owner') return untried(cur.owner) ? [cur.owner] : [];
  return stealOrder(state.teams, cur.owner).filter(untried);
}

/** Limiti della puntata del Daily Double: da 5 al maggiore tra punteggio e valore massimo (1000). */
export function ddLimits(state) {
  const team = teamById(state, state.current?.owner ?? state.turn);
  return { min: DD_MIN_WAGER, max: Math.max(team.score, MAX_VALUE) };
}

export function openCell(state, col, row) {
  const cell = state.board?.cells[col]?.[row];
  if (state.phase !== 'board' || !cell || cell.used) return state;
  const s = clone(state);
  s.current = { col, row, owner: s.turn, stage: 'owner', revealed: false, resolved: false, wager: null, results: {}, winner: null };
  s.phase = cell.dd ? 'wager' : 'clue';
  return s;
}

export function setWager(state, amount) {
  const n = Math.round(Number(amount));
  if (state.phase !== 'wager' || !Number.isFinite(n)) return state;
  const { min, max } = ddLimits(state);
  const s = clone(state);
  s.current.wager = Math.min(max, Math.max(min, n));
  s.phase = 'clue';
  return s;
}

// Chiude la tessera e passa il turno secondo il modo di gioco.
function resolve(s, winnerId) {
  const cur = s.current;
  const cell = cellAt(s, cur.col, cur.row);
  cell.used = true;
  cell.takenBy = winnerId;
  cell.results = { ...cur.results };
  if (cell.dd) cell.wager = cur.wager;
  cur.resolved = true;
  cur.revealed = true;
  cur.winner = winnerId;
  if (s.options.mode === 'turn') s.turn = nextTeamId(s.teams, cur.owner);
  else if (winnerId && !cell.dd) s.turn = winnerId;
}

export function markCorrect(state, teamId) {
  if (!answerableTeams(state).includes(teamId)) return state;
  const s = clone(state);
  const cur = s.current;
  const cell = cellAt(s, cur.col, cur.row);
  applyDelta(s, teamId, cell.dd ? cur.wager : cell.value);
  cur.results[teamId] = 'correct';
  resolve(s, teamId);
  return s;
}

export function markWrong(state, teamId) {
  if (!answerableTeams(state).includes(teamId)) return state;
  const s = clone(state);
  const cur = s.current;
  const cell = cellAt(s, cur.col, cur.row);
  const loss = cell.dd ? cur.wager : s.options.penalty ? cell.value : 0;
  applyDelta(s, teamId, -loss);
  cur.results[teamId] = 'wrong';
  if (cell.dd) {
    resolve(s, null);
    return s;
  }
  if (s.options.mode === 'turn' && cur.stage === 'owner') {
    if (!s.options.steal) {
      resolve(s, null);
      return s;
    }
    cur.stage = 'steal';
  }
  if (answerableTeams(s).length === 0) resolve(s, null);
  return s;
}

/** Nessuno / Salta: nessun punto, la tessera si chiude (il turno segue comunque la regola del modo). */
export function skipClue(state) {
  if (state.phase !== 'clue' || !state.current || state.current.resolved) return state;
  const s = clone(state);
  resolve(s, null);
  return s;
}

export function revealAnswer(state) {
  if (state.phase !== 'clue' || !state.current || state.current.revealed) return state;
  const s = clone(state);
  s.current.revealed = true;
  return s;
}

export const finalEligible = (state) => state.teams.filter((t) => t.score > 0).map((t) => t.id);

/** Fine del tabellone: Gran Finale (se attiva e se qualcuno è sopra zero) oppure classifica. */
export function endBoard(state) {
  if (state.phase !== 'board') return state;
  const s = clone(state);
  s.current = null;
  if (s.options.final && finalEligible(s).length > 0) {
    s.phase = 'final';
    s.final = { stage: 'pending' };
  } else {
    s.phase = 'end';
  }
  return s;
}

/** Torna al tabellone dopo un indizio concluso; se le tessere sono finite, passa alla fase successiva. */
export function closeClue(state) {
  if (state.phase !== 'clue' || !state.current?.resolved) return state;
  const s = clone(state);
  s.current = null;
  s.phase = 'board';
  return isBoardComplete(s) ? endBoard(s) : s;
}

/** Termina la partita subito (menu): niente Gran Finale. */
export function finishGame(state) {
  if (state.phase !== 'board') return state;
  const s = clone(state);
  s.phase = 'end';
  s.current = null;
  return s;
}

export function setTurn(state, teamId) {
  if (state.phase !== 'board' || !teamById(state, teamId) || state.turn === teamId) return state;
  const s = clone(state);
  s.turn = teamId;
  return s;
}

export function setScore(state, teamId, score) {
  const n = Math.round(Number(score));
  const team = teamById(state, teamId);
  if (!team || !Number.isFinite(n) || team.score === n) return state;
  const s = clone(state);
  teamById(s, teamId).score = n;
  return s;
}

export function renameTeam(state, teamId, name) {
  const i = state.teams.findIndex((t) => t.id === teamId);
  if (i < 0 || cleanName(name, i) === state.teams[i].name) return state;
  const s = clone(state);
  s.teams[i].name = cleanName(name, i);
  return s;
}

/** Classifica con pari merito: chi ha lo stesso punteggio ha la stessa posizione. */
export function ranking(teams) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  return sorted.map((team) => ({ team, rank: 1 + sorted.filter((t) => t.score > team.score).length }));
}

// ---------------------------------------------------------------------------------------------
// Riduttore con Annulla: le azioni che cambiano punti, tessere o turno salvano lo stato precedente.

const UNDOABLE = new Set(['OPEN_CELL', 'SET_WAGER', 'CORRECT', 'WRONG', 'SKIP', 'SET_TURN', 'SET_SCORE', 'END_BOARD', 'FINISH']);

function apply(state, action) {
  switch (action.type) {
    case 'OPEN_CELL': return openCell(state, action.col, action.row);
    case 'SET_WAGER': return setWager(state, action.amount);
    case 'CORRECT': return markCorrect(state, action.teamId);
    case 'WRONG': return markWrong(state, action.teamId);
    case 'SKIP': return skipClue(state);
    case 'REVEAL': return revealAnswer(state);
    case 'CLOSE': return closeClue(state);
    case 'SET_TURN': return setTurn(state, action.teamId);
    case 'SET_SCORE': return setScore(state, action.teamId, action.score);
    case 'RENAME': return renameTeam(state, action.teamId, action.name);
    case 'END_BOARD': return endBoard(state);
    case 'FINISH': return finishGame(state);
    default: return state;
  }
}

export const canUndo = (state) => (state?.undo?.length ?? 0) > 0;

/** Ripristina lo stato prima dell'ultima azione annullabile (punti, tessera e turno). */
export function undo(state) {
  if (!canUndo(state)) return state;
  const stack = state.undo;
  return { ...structuredClone(stack[stack.length - 1]), view: state.view, undo: stack.slice(0, -1) };
}

export function reduce(state, action) {
  if (action.type === 'UNDO') return undo(state);
  const next = apply(state, action);
  if (next === state || !UNDOABLE.has(action.type)) return next;
  const { undo: _stack, ...previous } = state;
  return { ...next, undo: [...(state.undo ?? []), structuredClone(previous)].slice(-UNDO_LIMIT) };
}

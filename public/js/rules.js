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

// Regole di gioco: modi "A turno" (con Rubata) e "Gara", penalità, Daily Double, Annulla, fine partita.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNDO_LIMIT, VALUES, answerableTeams, canUndo, createGame, ddLimits, makeTeams, ranking, reduce, stealOrder,
} from '../public/js/rules.js';
import { createRng } from '../public/js/random.js';

function game({ mode = 'turn', steal = false, penalty = true, final = false, teams = 3, dd = [] } = {}) {
  const columns = Array.from({ length: 5 }, (_, c) => ({
    category: { id: `c${c}`, name: `C${c}`, emoji: '🧪', description: '' },
    cells: VALUES.map((value, r) => ({ value, key: `c${c}:${value}:0`, clue: `indizio ${c}-${r}`, answer: `Cos'è ${c}-${r}?`, accept: [], notes: '', verified: true })),
  }));
  const names = Array.from({ length: teams }, (_, i) => `S${i + 1}`);
  const s = createGame({ options: { mode, steal, penalty, final, dailyDoubles: 0 }, teams: makeTeams(names), columns, firstTeam: 't1', rng: createRng(1) });
  for (const { col, row } of dd) s.board.cells[col][row].dd = true;
  return s;
}
const play = (state, ...actions) => actions.reduce((s, a) => reduce(s, a), state);
const open = (col, row) => ({ type: 'OPEN_CELL', col, row });
const ok = (teamId) => ({ type: 'CORRECT', teamId });
const ko = (teamId) => ({ type: 'WRONG', teamId });
const SKIP = { type: 'SKIP' };
const CLOSE = { type: 'CLOSE' };
const UNDO = { type: 'UNDO' };
const score = (s, id) => s.teams.find((t) => t.id === id).score;
const scores = (s) => s.teams.map((t) => t.score);

test('A turno: ordine del Setup e turno che passa sempre alla successiva dopo ✓, ✗ e Salta', () => {
  let s = game();
  assert.equal(s.turn, 't1');
  s = play(s, open(0, 0));
  assert.deepEqual(answerableTeams(s), ['t1'], 'risponde solo la squadra di turno');
  assert.equal(reduce(s, ok('t2')), s, 'le altre squadre non possono rispondere');
  s = play(s, ok('t1'), CLOSE);
  assert.equal(s.turn, 't2');
  s = play(s, open(0, 1), ko('t2'), CLOSE);
  assert.deepEqual(scores(s), [200, -400, 0]);
  assert.equal(s.turn, 't3');
  s = play(s, open(0, 2), SKIP, CLOSE);
  assert.equal(s.turn, 't1', 'dopo l\'ultima squadra si ricomincia dalla prima');
  assert.equal(s.board.cells[0][2].used, true);
});

test('Rubata: dopo l\'errore provano le altre a partire dalla successiva; il turno passa comunque', () => {
  let s = game({ steal: true });
  s = play(s, open(1, 0), ko('t1'));
  assert.equal(s.current.stage, 'steal');
  assert.deepEqual(answerableTeams(s), ['t2', 't3']);
  s = play(s, ko('t2'));
  assert.deepEqual(answerableTeams(s), ['t3']);
  s = play(s, ok('t3'));
  assert.deepEqual(scores(s), [-200, -200, 200]);
  assert.equal(s.board.cells[1][0].takenBy, 't3');
  assert.equal(s.turn, 't2', 'il turno va alla squadra dopo quella di turno, non a chi ha rubato');
  s = play(s, CLOSE, open(1, 1), ko('t2'), ko('t3'), ko('t1'));
  assert.equal(s.current.resolved, true, 'se sbagliano tutte la tessera si chiude');
  assert.equal(s.turn, 't3');
  assert.deepEqual(stealOrder(s.teams, 't2'), ['t3', 't1']);
});

test('Gara: tutti possono rispondere, chi indovina sceglie; se nessuno indovina sceglie ancora chi aveva scelto', () => {
  let s = game({ mode: 'race' });
  s = play(s, open(0, 0));
  assert.deepEqual(answerableTeams(s), ['t1', 't2', 't3']);
  s = play(s, ko('t2'));
  assert.deepEqual(answerableTeams(s), ['t1', 't3']);
  s = play(s, ok('t3'), CLOSE);
  assert.equal(s.turn, 't3');
  s = play(s, open(0, 1), ko('t1'), ko('t2'), ko('t3'));
  assert.equal(s.current.resolved, true);
  assert.equal(s.current.revealed, true, 'se sbagliano tutte la risposta si rivela da sola');
  s = play(s, CLOSE);
  assert.equal(s.turn, 't3');
  s = play(s, open(0, 2), SKIP, CLOSE);
  assert.equal(s.turn, 't3');
});

test('Daily Double in Gara: gioca solo chi l\'ha trovato e poi sceglie di nuovo lui', () => {
  let s = game({ mode: 'race', dd: [{ col: 0, row: 3 }] });
  s = play(s, open(0, 3));
  assert.equal(s.phase, 'wager');
  assert.deepEqual(ddLimits(s), { min: 5, max: 1000 });
  s = play(s, { type: 'SET_WAGER', amount: 5000 });
  assert.equal(s.current.wager, 1000, 'la puntata viene limitata al massimo');
  assert.deepEqual(answerableTeams(s), ['t1']);
  s = play(s, ok('t1'), CLOSE);
  assert.equal(score(s, 't1'), 1000);
  assert.equal(s.turn, 't1');
});

test('Daily Double in A turno: conta come la tessera della squadra di turno, niente rubata', () => {
  let s = game({ steal: true, dd: [{ col: 2, row: 3 }] });
  s = play(s, open(2, 3), { type: 'SET_WAGER', amount: 1 });
  assert.equal(s.current.wager, 5, 'puntata minima 5');
  s = play(s, ko('t1'));
  assert.equal(s.current.resolved, true);
  assert.equal(score(s, 't1'), -5);
  s = play(s, CLOSE);
  assert.equal(s.turn, 't2');
});

test('limiti della puntata: fino al proprio punteggio se supera 1000, altrimenti 1000', () => {
  let s = game({ dd: [{ col: 4, row: 4 }] });
  s.teams[0].score = 2500;
  assert.deepEqual(ddLimits(play(s, open(4, 4))), { min: 5, max: 2500 });
  s.teams[0].score = -400;
  assert.deepEqual(ddLimits(play(s, open(4, 4))), { min: 5, max: 1000 });
});

test('penalità disattivata: ✗ vale 0 e nessuno scende sotto zero, nemmeno col Daily Double', () => {
  let s = game({ penalty: false, dd: [{ col: 1, row: 4 }] });
  s = play(s, open(0, 0), ko('t1'), CLOSE);
  assert.equal(score(s, 't1'), 0);
  assert.equal(s.turn, 't2', 'la squadra resta esclusa e la tessera si chiude');
  s.teams[1].score = 400;
  s = play(s, open(1, 4), { type: 'SET_WAGER', amount: 1000 }, ko('t2'));
  assert.equal(score(s, 't2'), 0);
});

test('penalità disattivata con Rubata: le ✗ valgono 0 e la squadra resta esclusa dall\'indizio', () => {
  let s = game({ penalty: false, steal: true });
  s = play(s, open(0, 0), ko('t1'), ko('t2'));
  assert.deepEqual(scores(s), [0, 0, 0]);
  assert.deepEqual(answerableTeams(s), ['t3']);
});

test('Annulla ripristina punti, tessera e turno (anche dopo un ricaricamento)', () => {
  let s = game();
  s = play(s, open(0, 0), ok('t1'), CLOSE);
  assert.equal(s.turn, 't2');
  s = JSON.parse(JSON.stringify(s));
  s = play(s, UNDO);
  assert.equal(s.phase, 'clue');
  assert.equal(score(s, 't1'), 0);
  assert.equal(s.board.cells[0][0].used, false);
  assert.equal(s.turn, 't1');
  s = play(s, UNDO);
  assert.equal(s.phase, 'board');
  assert.equal(s.current, null);
  assert.equal(canUndo(s), false);
  s = play(s, { type: 'SET_TURN', teamId: 't3' });
  assert.equal(s.turn, 't3');
  assert.equal(play(s, UNDO).turn, 't1', 'anche il cambio manuale del turno si annulla');
});

test('la pila di Annulla ha un limite', () => {
  let s = game();
  for (let i = 0; i < 40; i++) s = play(s, { type: 'SET_TURN', teamId: i % 2 ? 't1' : 't2' });
  assert.equal(s.undo.length, UNDO_LIMIT);
});

test('azioni non ammesse: lo stato non cambia', () => {
  const s = game();
  assert.equal(reduce(s, ok('t1')), s);
  assert.equal(reduce(s, CLOSE), s);
  const opened = play(s, open(0, 0));
  assert.equal(reduce(opened, CLOSE), opened, 'non si chiude un indizio senza esito');
  const done = play(opened, ok('t1'), CLOSE);
  assert.equal(reduce(done, open(0, 0)), done, 'una tessera usata non si riapre');
});

test('partita completa: 25 tessere poi classifica, oppure Gran Finale se attiva', () => {
  for (const mode of ['turn', 'race']) {
    let s = game({ mode });
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 5; row++) s = play(s, open(col, row), ok(s.turn), CLOSE);
    }
    assert.equal(s.phase, 'end', mode);
    assert.equal(s.teams.reduce((n, t) => n + t.score, 0), 5 * VALUES.reduce((a, b) => a + b, 0));
  }
  let f = game({ final: true });
  for (let col = 0; col < 5; col++) for (let row = 0; row < 5; row++) f = play(f, open(col, row), ok(f.turn), CLOSE);
  assert.equal(f.phase, 'final');
  let none = game({ final: true });
  for (let col = 0; col < 5; col++) for (let row = 0; row < 5; row++) none = play(none, open(col, row), SKIP, CLOSE);
  assert.equal(none.phase, 'end', 'senza squadre sopra zero si salta il Gran Finale');
});

test('classifica con pari merito', () => {
  const r = ranking([{ id: 'a', score: 100 }, { id: 'b', score: 500 }, { id: 'c', score: 500 }]);
  assert.deepEqual(r.map((x) => [x.team.id, x.rank]), [['b', 1], ['c', 1], ['a', 3]]);
});

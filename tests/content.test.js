// Scelte casuali e pesca delle varianti: niente doppioni, niente ripetizioni finché ci sono alternative.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLOTS, buildColumns, eligibleCategories, fillSlots, matchesSearch, normalizeSearch,
  pickFinalCategory, pickVariant, rememberPlayed, rerollSlot,
} from '../public/js/content.js';
import { createRng } from '../public/js/random.js';
import { DD_ROW_WEIGHTS, VALUES, placeDailyDoubles } from '../public/js/rules.js';

const entry = (id, group = 'classiche', extra = {}) => ({ id, name: id, description: '', group, playableVerified: true, ...extra });
const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => entry(id));
const unique = (list) => new Set(list.filter(Boolean)).size === list.filter(Boolean).length;

function category(id, variantsPerLevel = 3, verified = () => false) {
  return {
    id,
    name: id,
    emoji: '🧪',
    description: 'prova',
    group: 'custom',
    clues: VALUES.map((value) => ({
      value,
      variants: Array.from({ length: variantsPerLevel }, (_, i) => ({
        clue: `${id} ${value} ${i}`,
        answer: `Cos'è ${i}?`,
        verified: verified(value, i),
      })),
    })),
  };
}

test('ricerca senza accenti: "citta" trova "Città italiane"', () => {
  assert.equal(normalizeSearch('  Città '), 'citta');
  assert.ok(matchesSearch({ id: 'x', name: 'Città italiane', description: '' }, 'citta'));
  assert.ok(matchesSearch({ id: 'x', name: 'Nomi', description: 'Il vero nome dietro le star' }, 'VERO'));
  assert.ok(!matchesSearch({ id: 'x', name: 'Sport', description: 'Calcio' }, 'tennis'));
  assert.ok(matchesSearch({ id: 'x', name: 'Sport', description: '' }, ''));
});

test('filtro per gruppo e per "solo verificati"', () => {
  const list = [entry('a', 'custom'), entry('b', 'classiche'), entry('c', 'custom', { playableVerified: false })];
  assert.deepEqual(eligibleCategories(list, { groups: ['custom'] }).map((c) => c.id), ['a', 'c']);
  assert.deepEqual(eligibleCategories(list, { groups: ['custom'], onlyVerified: true }).map((c) => c.id), ['a']);
});

test('🎲 Casuale riempie gli slot vuoti senza doppioni e, se sono pieni, rilancia tutto', () => {
  const rng = createRng(1);
  for (let i = 0; i < 200; i++) {
    const partial = ['c', null, null, 'a', null];
    const filled = fillSlots(partial, pool, { rng });
    assert.equal(filled.length, SLOTS);
    assert.ok(filled.every(Boolean) && unique(filled));
    assert.equal(filled[0], 'c');
    assert.equal(filled[3], 'a');
    const again = fillSlots(filled, pool, { rng });
    assert.ok(again.every(Boolean) && unique(again));
  }
  const few = fillSlots([null, null, null, null, null], pool.slice(0, 3), { rng });
  assert.deepEqual(few.filter(Boolean).length, 3);
});

test('🔄 rilancio di uno slot: mai doppioni, null se non ci sono alternative', () => {
  const rng = createRng(2);
  const slots = ['a', 'b', 'c', 'd', 'e'];
  for (let i = 0; i < 200; i++) {
    const next = rerollSlot(slots, 2, pool, { rng });
    assert.ok(unique(next));
    assert.ok(!slots.includes(next[2]));
  }
  assert.equal(rerollSlot(slots, 0, pool.slice(0, 5), { rng }), null);
});

test('le categorie uscite di recente vengono pescate per ultime', () => {
  const rng = createRng(3);
  const filled = fillSlots([null, null, null, null, null], pool, { rng, recent: ['a', 'b', 'c'] });
  assert.deepEqual(new Set(filled), new Set(['d', 'e', 'f', 'g', 'h']));
});

test('pesca delle varianti: prima quelle mai uscite, poi la meno recente', () => {
  const rng = createRng(4);
  const cat = category('cat', 3);
  const history = ['cat:200:0', 'cat:200:2'];
  assert.equal(pickVariant(cat, 200, { history, rng }).key, 'cat:200:1');
  const all = ['cat:200:1', 'cat:200:0', 'cat:200:2'];
  assert.equal(pickVariant(cat, 200, { history: all, rng }).key, 'cat:200:1');
});

test('"solo verificati" usa le varianti verificate e segnala quando non ce ne sono', () => {
  const rng = createRng(5);
  const cat = category('cat', 3, (value, i) => value === 400 && i === 2);
  for (let i = 0; i < 20; i++) assert.equal(pickVariant(cat, 400, { onlyVerified: true, rng }).key, 'cat:400:2');
  assert.equal(pickVariant(cat, 600, { onlyVerified: true, rng }).fallback, true);
});

test('tabellone: 5 indizi per colonna, testo copiato e storico aggiornato', () => {
  const rng = createRng(6);
  const columns = buildColumns([category('x'), category('y')], { rng });
  assert.equal(columns.length, 2);
  assert.deepEqual(columns[0].cells.map((c) => c.value), VALUES);
  assert.match(columns[1].cells[4].clue, /^y 1000/);
  const history = rememberPlayed({ variants: ['x:200:0'], categories: ['x'] }, {
    variantKeys: ['x:200:0', 'y:400:1'],
    categoryIds: ['y', 'x'],
  });
  assert.deepEqual(history.variants, ['x:200:0', 'y:400:1']);
  assert.deepEqual(history.categories, ['y', 'x']);
});

test('Gran Finale: mai una categoria già sul tabellone', () => {
  const rng = createRng(7);
  for (let i = 0; i < 50; i++) {
    const pick = pickFinalCategory(pool, { exclude: ['a', 'b', 'c', 'd', 'e'], rng });
    assert.ok(['f', 'g', 'h'].includes(pick.id));
  }
  assert.equal(pickFinalCategory(pool.slice(0, 2), { exclude: ['a', 'b'], rng }), null);
});

test('Daily Double: mai nella riga da 200, colonne diverse, più spesso nella quarta riga', () => {
  const rng = createRng(8);
  const rows = [0, 0, 0, 0, 0];
  for (let i = 0; i < 4000; i++) {
    const dd = placeDailyDoubles(2, 5, rng);
    assert.equal(dd.length, 2);
    assert.notEqual(dd[0].col, dd[1].col);
    for (const d of dd) rows[d.row]++;
  }
  assert.equal(rows[0], 0);
  assert.equal(DD_ROW_WEIGHTS.indexOf(Math.max(...DD_ROW_WEIGHTS)), 3);
  assert.equal(rows.indexOf(Math.max(...rows)), 3);
  assert.deepEqual(placeDailyDoubles(0, 5, rng), []);
});

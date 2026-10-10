// Il validatore deve riconoscere ogni tipo di errore e i dati veri devono essere in regola.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, buildIndex, rebuildIndex, unverifiedReport, MIN_VARIANTS_CUSTOM } from '../scripts/lib/catalog.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');

const issuesOf = (catalog, file, level) => catalog.issues.filter((i) => i.file === file && i.level === level);

test('fixture: ogni file rotto ha il suo errore, con livello e variante', async () => {
  const catalog = await loadCatalog(FIXTURES);
  const valid = catalog.entries.filter((e) => e.valid).map((e) => e.file).sort();
  assert.deepEqual(valid, ['avvisi.json', 'base-ok.json', 'custom-due-varianti.json']);
  assert.ok(!catalog.entries.some((e) => e.file === '_bozza.json'), 'le bozze con "_" sono ignorate');

  const expect = {
    'json-rotto.json': [/JSON non valido/, undefined],
    'id-sbagliato.json': [/diverso dal nome del file/, undefined],
    'gruppo-sbagliato.json': [/gruppo "boh" non ammesso/, undefined],
    'livello-mancante.json': [/esattamente 5 livelli/, undefined],
    'una-variante.json': [/almeno 2 varianti/, 'livello 600'],
    'campo-vuoto.json': [/"answer" mancante o vuoto/, 'livello 400, variante 2'],
    'verified-non-booleano.json': [/"verified" mancante o non booleano/, 'livello 200, variante 1'],
    'duplicato.json': [/indizio duplicato di base-ok\.json/, 'livello 1000, variante 1'],
  };
  for (const [file, [pattern, at]] of Object.entries(expect)) {
    const errors = issuesOf(catalog, file, 'error');
    assert.ok(errors.some((e) => pattern.test(e.message) && e.at === at), `${file}: ${JSON.stringify(errors)}`);
  }
});

test('fixture: gli avvisi non escludono la categoria', async () => {
  const catalog = await loadCatalog(FIXTURES);
  const warnings = issuesOf(catalog, 'avvisi.json', 'warning').map((w) => w.message).join('\n');
  for (const pattern of [/campo sconosciuto "anwser"/, /verified è true ma manca "source"/, /dovrebbe essere una domanda/, /emoji bandiera/, /oltre 8 parole/]) {
    assert.match(warnings, pattern);
  }
  const custom = issuesOf(catalog, 'custom-due-varianti.json', 'warning');
  assert.equal(custom.filter((w) => /almeno 3 varianti/.test(w.message)).length, 5);
});

test('un file con BOM viene letto lo stesso, con un avviso', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'jeoparty-bom-'));
  try {
    const text = await readFile(path.join(FIXTURES, 'base-ok.json'), 'utf8');
    await writeFile(path.join(dir, 'base-ok.json'), `﻿${text}`, 'utf8');
    const catalog = await loadCatalog(dir);
    assert.equal(catalog.entries[0].valid, true);
    assert.match(issuesOf(catalog, 'base-ok.json', 'warning')[0].message, /BOM/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('la CLI esce con codice 1 e indica file, livello e variante', () => {
  const run = spawnSync(process.execPath, ['scripts/validate.js', '--dir', FIXTURES], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /campo-vuoto\.json — livello 400, variante 2: campo "answer" mancante o vuoto/);
  assert.match(run.stdout, /Errori: 8/);
});

test('indice: solo categorie valide, ordinate per gruppo e nome', async () => {
  const catalog = await loadCatalog(FIXTURES);
  const index = buildIndex(catalog);
  assert.deepEqual(index.categories.map((c) => c.id), ['custom-due-varianti', 'avvisi', 'base-ok']);
  assert.equal(index.categories[0].playableVerified, false);
  assert.match(unverifiedReport(catalog), /# Da verificare/);
});

test('dati veri: nessun errore, Custom con almeno 3 varianti, verified sempre con fonte', async () => {
  const { catalog, index } = await rebuildIndex(ROOT, { write: false });
  assert.deepEqual(catalog.issues.filter((i) => i.level === 'error'), []);
  const ids = index.categories.map((c) => c.id);
  for (const id of ['violetta', 'high-school-musical', 'trap-italiana', 'ai', 'trash-italiano']) {
    assert.ok(ids.includes(id), `manca la categoria ${id}`);
  }
  for (const { data } of catalog.entries) {
    for (const level of data.clues) {
      if (data.group === 'custom') assert.ok(level.variants.length >= MIN_VARIANTS_CUSTOM, `${data.id} ${level.value}`);
      for (const v of level.variants) {
        if (v.verified) assert.match(v.source ?? '', /^https?:\/\//, `${data.id} ${level.value}: verified senza fonte`);
      }
    }
  }
});

// Valida le categorie e rigenera data/index.json.
// Uso: node scripts/validate.js [--strict] [--report] [--no-write] [--dir <cartella>]
//   --strict    gli avvisi contano come errori
//   --report    scrive docs/DA-VERIFICARE.md (varianti verified:false per categoria)
//   --no-write  non aggiorna data/index.json
//   --dir       valida un'altra cartella (usato dai test); implica --no-write
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebuildIndex, unverifiedReport, writeIfChanged, GROUPS } from './lib/catalog.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const dirIndex = argv.indexOf('--dir');
const customDir = dirIndex >= 0 ? path.resolve(argv[dirIndex + 1] ?? '') : null;
const write = !flags.has('--no-write') && !customDir;

const { catalog, index, written } = await rebuildIndex(ROOT, { write, categoriesDir: customDir ?? undefined });
const rel = (p) => path.relative(ROOT, p) || p;
const dirLabel = rel(customDir ?? path.join(ROOT, 'data', 'categories'));

console.log(`Jeoparty · validazione di ${dirLabel}\n`);
const errors = catalog.issues.filter((i) => i.level === 'error');
const warnings = catalog.issues.filter((i) => i.level === 'warning');
for (const issue of [...errors, ...warnings]) {
  const icon = issue.level === 'error' ? '✖ errore' : '⚠ avviso';
  console.log(`${icon}  ${issue.file}${issue.at ? ` — ${issue.at}` : ''}: ${issue.message}`);
}
if (errors.length || warnings.length) console.log('');

const valid = index.categories;
const perGroup = GROUPS.map((g) => `${g.name.toLowerCase()} ${valid.filter((c) => c.group === g.id).length}`).join(', ');
const excluded = catalog.entries.filter((e) => !e.valid).map((e) => e.file);
const variants = valid.reduce((n, c) => n + c.variants, 0);
const unverified = valid.reduce((n, c) => n + c.unverified, 0);
console.log(`Categorie valide: ${valid.length} (${perGroup})${excluded.length ? ` · escluse per errori: ${excluded.join(', ')}` : ''}`);
console.log(`Varianti: ${variants} · da verificare (verified: false): ${unverified}`);
for (const c of valid.filter((c) => c.unverified > 0)) console.log(`  ${c.id}: ${c.unverified} su ${c.variants}`);
console.log(`Errori: ${errors.length} · Avvisi: ${warnings.length}`);
if (write) console.log(written ? 'Indice aggiornato: data/index.json' : 'Indice già aggiornato: data/index.json');

if (flags.has('--report')) {
  const reportPath = path.join(ROOT, 'docs', 'DA-VERIFICARE.md');
  await writeIfChanged(reportPath, unverifiedReport(catalog));
  console.log(`Report scritto: ${rel(reportPath)}`);
}

const failed = errors.length > 0 || (flags.has('--strict') && warnings.length > 0);
process.exitCode = failed ? 1 : 0;

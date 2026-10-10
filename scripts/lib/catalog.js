// Catalogo delle categorie: lettura, validazione, indice e report. Solo moduli built-in di Node.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const SCHEMA_VERSION = 1;
export const GROUPS = [
  { id: 'classiche', name: 'Classiche' },
  { id: 'custom', name: 'Custom' },
  { id: 'inventate', name: 'Inventate' },
];
export const VALUES = [200, 400, 600, 800, 1000];
export const MIN_VARIANTS = 2;
export const MIN_VARIANTS_CUSTOM = 3;
export const LIMITS = { clue: 200, answer: 60, name: 24, description: 90 };

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CATEGORY_KEYS = new Set(['id', 'name', 'group', 'emoji', 'description', 'clues']);
const LEVEL_KEYS = new Set(['value', 'variants']);
const VARIANT_KEYS = new Set(['clue', 'answer', 'accept', 'notes', 'source', 'verified']);
const INTERROGATIVE_RE = /^(chi|cos'?|cosa|che|qual|quale|quali|quanto|quanta|quanti|quante|dove|dov'|quando|come|perche|in che|in quale|in quali|di che|di chi|a chi|a che|da chi|da che|con chi|per chi)\b/;
const FLAG_RE = /[\u{1F1E6}-\u{1F1FF}]/u;
const CONTROL_RE = /[\u0000-\u001F\u007F]/;
const QUOTE_RE = /[«“"]([^»”"]+)[»”"]/g;
const graphemes = new Intl.Segmenter('it', { granularity: 'grapheme' });

/** Minuscole, senza accenti, apostrofi uniformati. */
export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'");
}

/** Forma usata per trovare indizi duplicati: anche senza punteggiatura. */
export function fingerprint(text) {
  return normalize(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function where(levelIndex, value, variantIndex) {
  const level = value !== undefined ? `livello ${value}` : `livello #${levelIndex + 1}`;
  return variantIndex === undefined ? level : `${level}, variante ${variantIndex + 1}`;
}

function textWarnings(text, label, add) {
  if (CONTROL_RE.test(text)) add('warning', `${label}: contiene caratteri di controllo`);
  if (/^\s|\s$/.test(text) || / {2,}/.test(text)) add('warning', `${label}: spazi doppi, iniziali o finali`);
  if (FLAG_RE.test(text)) add('warning', `${label}: emoji bandiera (Windows la mostra come lettere)`);
  for (const match of text.matchAll(QUOTE_RE)) {
    if (match[1].trim().split(/\s+/).length > 8) {
      add('warning', `${label}: testo tra virgolette di oltre 8 parole (citazione o testo di canzone?)`);
    }
  }
}

/** Valida una categoria già letta dal JSON. Restituisce l'elenco dei problemi. */
export function validateCategory(data, file) {
  const issues = [];
  const add = (level, message, at) => issues.push({ level, file, at, message });

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    add('error', 'il file deve contenere un oggetto JSON');
    return issues;
  }
  for (const key of Object.keys(data)) {
    if (!CATEGORY_KEYS.has(key)) add('warning', `campo sconosciuto "${key}"`);
  }
  for (const key of ['id', 'name', 'group', 'emoji', 'description']) {
    if (!isNonEmptyString(data[key])) add('error', `campo "${key}" mancante o vuoto`);
    else textWarnings(data[key], `"${key}"`, (lvl, msg) => add(lvl, msg));
  }

  const expectedId = path.basename(file, '.json');
  if (isNonEmptyString(data.id)) {
    if (!ID_RE.test(data.id)) add('error', `id "${data.id}" non valido: solo minuscole, cifre e trattini`);
    if (data.id !== expectedId) add('error', `id "${data.id}" diverso dal nome del file "${expectedId}"`);
  }
  if (isNonEmptyString(data.group) && !GROUPS.some((g) => g.id === data.group)) {
    add('error', `gruppo "${data.group}" non ammesso (usa ${GROUPS.map((g) => g.id).join(', ')})`);
  }
  if (isNonEmptyString(data.name) && data.name.length > LIMITS.name) {
    add('warning', `nome lungo ${data.name.length} caratteri (consigliati ≤ ${LIMITS.name})`);
  }
  if (isNonEmptyString(data.description) && data.description.length > LIMITS.description) {
    add('warning', `descrizione lunga ${data.description.length} caratteri (consigliati ≤ ${LIMITS.description})`);
  }
  if (isNonEmptyString(data.emoji) && [...graphemes.segment(data.emoji)].length !== 1) {
    add('warning', 'emoji: usa una sola emoji');
  }

  if (!Array.isArray(data.clues)) {
    add('error', 'campo "clues" mancante o non è un elenco');
    return issues;
  }
  const values = data.clues.map((c) => (c && typeof c === 'object' ? c.value : undefined));
  if (data.clues.length !== VALUES.length || VALUES.some((v, i) => values[i] !== v)) {
    add('error', `servono esattamente 5 livelli in ordine ${VALUES.join(', ')} (trovati: ${values.join(', ') || 'nessuno'})`);
  }

  const minVariants = data.group === 'custom' ? MIN_VARIANTS_CUSTOM : MIN_VARIANTS;
  const seenAnswers = new Map();
  data.clues.forEach((level, li) => {
    if (!level || typeof level !== 'object' || Array.isArray(level)) {
      add('error', 'il livello deve essere un oggetto', where(li));
      return;
    }
    const value = level.value;
    for (const key of Object.keys(level)) {
      if (!LEVEL_KEYS.has(key)) add('warning', `campo sconosciuto "${key}"`, where(li, value));
    }
    if (!Array.isArray(level.variants)) {
      add('error', 'campo "variants" mancante o non è un elenco', where(li, value));
      return;
    }
    if (level.variants.length < MIN_VARIANTS) {
      add('error', `servono almeno ${MIN_VARIANTS} varianti (trovate ${level.variants.length})`, where(li, value));
    } else if (level.variants.length < minVariants) {
      add('warning', `le Custom dovrebbero avere almeno ${minVariants} varianti (trovate ${level.variants.length})`, where(li, value));
    }
    level.variants.forEach((v, vi) => {
      const at = where(li, value, vi);
      if (!v || typeof v !== 'object' || Array.isArray(v)) {
        add('error', 'la variante deve essere un oggetto', at);
        return;
      }
      for (const key of Object.keys(v)) {
        if (!VARIANT_KEYS.has(key)) add('warning', `campo sconosciuto "${key}"`, at);
      }
      for (const key of ['clue', 'answer']) {
        if (!isNonEmptyString(v[key])) add('error', `campo "${key}" mancante o vuoto`, at);
        else textWarnings(v[key], `"${key}"`, (lvl, msg) => add(lvl, msg, at));
      }
      if (typeof v.verified !== 'boolean') add('error', 'campo "verified" mancante o non booleano (true/false)', at);
      if (v.accept !== undefined && (!Array.isArray(v.accept) || !v.accept.every(isNonEmptyString))) {
        add('error', '"accept" deve essere un elenco di testi non vuoti', at);
      }
      for (const key of ['notes', 'source']) {
        if (v[key] !== undefined && !isNonEmptyString(v[key])) add('error', `"${key}" deve essere un testo non vuoto`, at);
      }
      if (isNonEmptyString(v.clue) && v.clue.length > LIMITS.clue) {
        add('warning', `indizio lungo ${v.clue.length} caratteri (consigliati ≤ ${LIMITS.clue})`, at);
      }
      if (isNonEmptyString(v.answer)) {
        const answer = v.answer.trim();
        if (answer.length > LIMITS.answer) add('warning', `risposta lunga ${answer.length} caratteri (consigliati ≤ ${LIMITS.answer})`, at);
        if (!answer.endsWith('?') || !INTERROGATIVE_RE.test(normalize(answer))) {
          add('warning', 'la risposta dovrebbe essere una domanda ("Chi è…?", "Cos\'è…?")', at);
        }
        const key = fingerprint(answer);
        if (seenAnswers.has(key)) add('warning', `stessa risposta di ${seenAnswers.get(key)}`, at);
        else seenAnswers.set(key, at);
      }
      if (v.verified === true && !isNonEmptyString(v.source)) add('warning', 'verified è true ma manca "source"', at);
      if (isNonEmptyString(v.source) && !/^https?:\/\/\S+$/.test(v.source.trim())) {
        add('warning', '"source" dovrebbe essere un URL http(s)', at);
      }
    });
  });
  return issues;
}

function parseJson(text, file) {
  try {
    return { data: JSON.parse(text) };
  } catch (err) {
    let message = err.message;
    const pos = /position (\d+)/.exec(message);
    if (pos && !/line \d+/.test(message)) {
      const before = text.slice(0, Number(pos[1]));
      const line = before.split('\n').length;
      const column = before.length - before.lastIndexOf('\n');
      message += ` (riga ${line}, colonna ${column})`;
    }
    return { error: { level: 'error', file, message: `JSON non valido: ${message}` } };
  }
}

/**
 * Legge e valida tutte le categorie di una cartella (i file che iniziano con "_" sono bozze ignorate).
 * Restituisce { entries: [{ file, data, valid }], issues }.
 */
export async function loadCatalog(categoriesDir) {
  const names = (await readdir(categoriesDir)).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort();
  const entries = [];
  const issues = [];
  for (const file of names) {
    let text = await readFile(path.join(categoriesDir, file), 'utf8');
    const fileIssues = [];
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
      fileIssues.push({ level: 'warning', file, message: 'il file inizia con un BOM UTF-8: salvalo come "UTF-8" senza BOM' });
    }
    const parsed = parseJson(text, file);
    if (parsed.error) fileIssues.push(parsed.error);
    else fileIssues.push(...validateCategory(parsed.data, file));
    issues.push(...fileIssues);
    entries.push({ file, data: parsed.data ?? null, issues: fileIssues });
  }

  // Controlli fra categorie diverse: id e nomi ripetuti, indizi duplicati.
  const ids = new Map();
  const namesSeen = new Map();
  const clues = new Map();
  for (const entry of entries) {
    const d = entry.data;
    if (!d || typeof d !== 'object') continue;
    const add = (level, message, at) => {
      const issue = { level, file: entry.file, at, message };
      issues.push(issue);
      entry.issues.push(issue);
    };
    if (isNonEmptyString(d.id)) {
      if (ids.has(d.id)) add('error', `id "${d.id}" già usato da ${ids.get(d.id)}`);
      else ids.set(d.id, entry.file);
    }
    if (isNonEmptyString(d.name)) {
      const key = fingerprint(d.name);
      if (namesSeen.has(key)) add('warning', `nome "${d.name}" già usato da ${namesSeen.get(key)}`);
      else namesSeen.set(key, entry.file);
    }
    if (!Array.isArray(d.clues)) continue;
    d.clues.forEach((level, li) => {
      if (!level || !Array.isArray(level.variants)) return;
      level.variants.forEach((v, vi) => {
        if (!v || !isNonEmptyString(v.clue)) return;
        const at = where(li, level.value, vi);
        const key = fingerprint(v.clue);
        if (clues.has(key)) add('error', `indizio duplicato di ${clues.get(key)}`, at);
        else clues.set(key, `${entry.file} (${at})`);
      });
    });
  }
  for (const entry of entries) entry.valid = !entry.issues.some((i) => i.level === 'error');
  return { entries, issues };
}

/** Costruisce l'indice con le sole categorie valide, ordinate per gruppo e nome. */
export function buildIndex(catalog) {
  const groupOrder = new Map(GROUPS.map((g, i) => [g.id, i]));
  const categories = catalog.entries
    .filter((e) => e.valid)
    .map(({ file, data }) => {
      const variants = data.clues.flatMap((c) => c.variants);
      return {
        id: data.id,
        name: data.name,
        group: data.group,
        emoji: data.emoji,
        description: data.description,
        file: `categories/${file}`,
        variants: variants.length,
        unverified: variants.filter((v) => v.verified !== true).length,
        playableVerified: data.clues.every((c) => c.variants.some((v) => v.verified === true)),
      };
    })
    .sort((a, b) => groupOrder.get(a.group) - groupOrder.get(b.group) || a.name.localeCompare(b.name, 'it'));
  return { schemaVersion: SCHEMA_VERSION, groups: GROUPS, categories };
}

/** Scrive il file solo se il contenuto cambia (niente modifiche inutili per git e OneDrive). */
export async function writeIfChanged(filePath, content) {
  let current = null;
  try {
    current = await readFile(filePath, 'utf8');
  } catch {
    // il file non esiste ancora
  }
  if (current === content) return false;
  await mkdir(path.dirname(filePath), { recursive: true });
  for (let attempt = 1; ; attempt++) {
    try {
      await writeFile(filePath, content, 'utf8');
      return true;
    } catch (err) {
      // OneDrive può bloccare il file per un attimo durante la sincronizzazione.
      if (attempt >= 3 || !['EBUSY', 'EPERM'].includes(err.code)) throw err;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
}

/** Valida le categorie di `root/data/categories` e, se richiesto, aggiorna `root/data/index.json`. */
export async function rebuildIndex(root, { write = true, categoriesDir } = {}) {
  const dir = categoriesDir ?? path.join(root, 'data', 'categories');
  const catalog = await loadCatalog(dir);
  const index = buildIndex(catalog);
  let written = false;
  if (write) {
    written = await writeIfChanged(path.join(root, 'data', 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  }
  return { catalog, index, written };
}

/** Testo Markdown con le varianti `verified: false`, raggruppate per categoria. */
export function unverifiedReport(catalog) {
  const lines = [
    '# Da verificare',
    '',
    'Generato da `node scripts/validate.js --report`: varianti con `verified: false`, raggruppate per categoria.',
    'Quando hai controllato un fatto, metti `verified: true` e l\'URL della fonte in `source`.',
    '',
  ];
  let total = 0;
  for (const { file, data } of catalog.entries) {
    if (!data || !Array.isArray(data.clues)) continue;
    const rows = [];
    for (const level of data.clues) {
      (level.variants ?? []).forEach((v, vi) => {
        if (v && v.verified !== true) rows.push(`- **${level.value}** · variante ${vi + 1} — ${v.clue} → *${v.answer}*`);
      });
    }
    if (rows.length === 0) continue;
    total += rows.length;
    lines.push(`## ${data.emoji ?? ''} ${data.name ?? file} (\`${file}\`) — ${rows.length}`.replace(/^## {2}/, '## '), '', ...rows, '');
  }
  lines.splice(4, 0, `Totale: ${total}.`, '');
  return `${lines.join('\n').trimEnd()}\n`;
}

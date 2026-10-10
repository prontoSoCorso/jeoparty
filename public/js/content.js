// Contenuti: caricamento di indice e categorie (rete) e scelte casuali (funzioni PURE, testabili in Node).
import { pick, shuffle } from './random.js';
import { VALUES } from './rules.js';

const HISTORY_VARIANTS = 3000;
const HISTORY_CATEGORIES = 40;
export const SLOTS = 5;

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export const loadIndex = () => fetchJson('/data/index.json');
export const loadCategory = (entry) => fetchJson(`/data/${entry.file}`);

export function normalizeSearch(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** "citta" trova "Città italiane": confronto senza accenti su nome, descrizione e id. */
export function matchesSearch(category, query) {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(`${category.name} ${category.description} ${category.id}`).includes(q);
}

/** Categorie che si possono pescare con i gruppi scelti (e, se richiesto, giocabili con soli indizi verificati). */
export function eligibleCategories(categories, { groups, onlyVerified = false }) {
  return categories.filter((c) => groups.includes(c.group) && (!onlyVerified || c.playableVerified));
}

// Prima le categorie non uscite di recente, poi le altre; ognuna dei due gruppi in ordine casuale.
function freshFirst(rng, items, recent) {
  const isRecent = (c) => recent.includes(c.id);
  return [...shuffle(rng, items.filter((c) => !isRecent(c))), ...shuffle(rng, items.filter(isRecent))];
}

/**
 * 🎲 Casuale: riempie gli slot vuoti senza doppioni; se sono tutti pieni, rilancia tutti e 5
 * (evitando, se possibile, le categorie appena scelte).
 */
export function fillSlots(slots, pool, { rng, recent = [] }) {
  const empty = slots.filter((id) => !id).length;
  if (empty === 0) {
    const others = pool.filter((c) => !slots.includes(c.id));
    const source = others.length >= SLOTS ? others : pool;
    return freshFirst(rng, source, recent).slice(0, SLOTS).map((c) => c.id).concat(Array(SLOTS).fill(null)).slice(0, SLOTS);
  }
  const queue = freshFirst(rng, pool.filter((c) => !slots.includes(c.id)), recent).map((c) => c.id);
  return slots.map((id) => id ?? queue.shift() ?? null);
}

/** 🔄 Rilancia un solo slot con una categoria non già scelta. Restituisce null se non c'è alternativa. */
export function rerollSlot(slots, index, pool, { rng, recent = [] }) {
  const candidates = pool.filter((c) => !slots.includes(c.id));
  if (candidates.length === 0) return null;
  const next = [...slots];
  next[index] = freshFirst(rng, candidates, recent)[0].id;
  return next;
}

/**
 * Sceglie una variante per un livello: prima quelle mai uscite; se sono uscite tutte,
 * la meno recente (così "ricomincia il giro"). Con onlyVerified usa solo quelle verificate, se esistono.
 */
export function pickVariant(category, value, { history = [], onlyVerified = false, rng }) {
  const level = category.clues.find((c) => c.value === value);
  let candidates = level.variants.map((variant, i) => ({ variant, key: `${category.id}:${value}:${i}` }));
  let fallback = false;
  if (onlyVerified) {
    const verified = candidates.filter((c) => c.variant.verified === true);
    if (verified.length > 0) candidates = verified;
    else fallback = true;
  }
  const fresh = candidates.filter((c) => !history.includes(c.key));
  const chosen = fresh.length > 0
    ? pick(rng, fresh)
    : candidates.reduce((oldest, c) => (history.lastIndexOf(c.key) < history.lastIndexOf(oldest.key) ? c : oldest));
  return { variant: chosen.variant, key: chosen.key, fallback };
}

/** Colonne del tabellone: per ogni categoria, i 5 indizi pescati (testo copiato nello stato). */
export function buildColumns(categories, { history = [], onlyVerified = false, rng }) {
  return categories.map((cat) => ({
    category: { id: cat.id, name: cat.name, emoji: cat.emoji, description: cat.description },
    cells: VALUES.map((value) => {
      const { variant, key } = pickVariant(cat, value, { history, onlyVerified, rng });
      return {
        value,
        key,
        clue: variant.clue,
        answer: variant.answer,
        accept: variant.accept ?? [],
        notes: variant.notes ?? '',
        verified: variant.verified === true,
      };
    }),
  }));
}

/** Aggiorna lo storico (le voci più recenti in fondo). */
export function rememberPlayed(history, { variantKeys = [], categoryIds = [] }) {
  const push = (list, items, cap) => {
    const next = list.filter((x) => !items.includes(x));
    next.push(...items);
    return next.slice(-cap);
  };
  return {
    variants: push(history?.variants ?? [], variantKeys, HISTORY_VARIANTS),
    categories: push(history?.categories ?? [], categoryIds, HISTORY_CATEGORIES),
  };
}

/** Categoria per il Gran Finale: una non presente sul tabellone, preferendo quelle non uscite di recente. */
export function pickFinalCategory(categories, { exclude = [], recent = [], onlyVerified = false, rng }) {
  const pool = categories.filter((c) => !exclude.includes(c.id) && (!onlyVerified || c.playableVerified));
  return pool.length > 0 ? freshFirst(rng, pool, recent)[0] : null;
}

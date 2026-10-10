// Numeri casuali: crypto.getRandomValues in gioco, oppure un generatore con seme (mulberry32) per i test.

export function createRng(seed) {
  if (seed === undefined) {
    const buf = new Uint32Array(1);
    return () => {
      crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    };
  }
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomInt = (rng, n) => Math.floor(rng() * n);

export const pick = (rng, items) => items[randomInt(rng, items.length)];

export function shuffle(rng, items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Indice scelto con probabilità proporzionale ai pesi (peso 0 = mai). */
export function weightedIndex(rng, weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.findLastIndex((w) => w > 0);
}

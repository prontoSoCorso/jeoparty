// localStorage con chiavi versionate e senza eccezioni: se il browser non salva, il gioco funziona lo stesso.
const PREFIX = 'jeoparty:v1:';

/** Legge una chiave: { value } oppure { value: null, error: 'unavailable' | 'corrupted', raw }. */
export function read(key) {
  let raw;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    return { value: null, error: 'unavailable' };
  }
  if (raw === null) return { value: null };
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { value: null, error: 'corrupted', raw };
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // niente da fare
  }
}

/** Conserva una copia del dato danneggiato prima di ripartire da zero. */
export function backup(key, raw) {
  try {
    localStorage.setItem(`${PREFIX}${key}:backup`, typeof raw === 'string' ? raw : JSON.stringify(raw));
  } catch {
    // niente da fare
  }
}

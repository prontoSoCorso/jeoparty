// Store dell'app: partita, impostazioni, storico e segnalazioni. Ogni modifica viene salvata subito.
import * as storage from './storage.js';

const DEFAULT_SETTINGS = { textScale: 'm', sound: true, volume: 0.7, lastSetup: null };
export const TEXT_SCALES = { s: 0.85, m: 1, l: 1.2 };

export function isValidGame(game) {
  return Boolean(game) && typeof game === 'object' && game.v === 1 && typeof game.phase === 'string'
    && Array.isArray(game.teams) && game.teams.length >= 2 && game.options && typeof game.options === 'object';
}

export function createStore() {
  const notices = [];
  let game = null;
  const saved = storage.read('game');
  if (saved.error === 'unavailable') notices.push('storageOff');
  if (saved.error === 'corrupted') {
    storage.backup('game', saved.raw);
    notices.push('corrupted');
  } else if (saved.value) {
    if (isValidGame(saved.value)) game = saved.value;
    else {
      storage.backup('game', saved.value);
      notices.push('corrupted');
    }
  }
  let settings = { ...DEFAULT_SETTINGS, ...(storage.read('settings').value ?? {}) };
  if (!(settings.textScale in TEXT_SCALES)) settings.textScale = 'm';
  let history = storage.read('history').value ?? { variants: [], categories: [] };
  let flags = storage.read('flags').value ?? [];
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());

  return {
    notices,
    get game() { return game; },
    get settings() { return settings; },
    get history() { return history; },
    get flags() { return flags; },
    /** Sostituisce la partita; con render:false salva senza ridisegnare (campi di testo). */
    setGame(next, { render = true } = {}) {
      game = next;
      if (next) storage.write('game', next);
      else storage.remove('game');
      if (render) notify();
    },
    setSettings(patch, { render = true } = {}) {
      settings = { ...settings, ...patch };
      storage.write('settings', settings);
      if (render) notify();
    },
    setHistory(next) {
      history = next;
      storage.write('history', next);
    },
    setFlags(next) {
      flags = next;
      storage.write('flags', next);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

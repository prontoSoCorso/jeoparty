// Timer dell'indizio: parte da solo, T (o un clic) lo mette in pausa; negli ultimi 5 secondi fa tic, a zero suona.
// Non assegna mai punti: decide sempre il conduttore. Vive solo in memoria, quindi dopo un refresh riparte da capo.
import { h } from '../dom.js';
import { T } from '../strings.js';
import { play } from '../audio.js';

const fill = h('span', { class: 'timer__fill' });
const label = h('span', { class: 'timer__label' });
// Fuori dall'ordine di tabulazione e senza rubare il focus: da tastiera si usa T.
const el = h('button', {
  class: 'timer',
  type: 'button',
  tabindex: '-1',
  title: T.timer.hint,
  on: { mousedown: (e) => e.preventDefault(), click: () => toggleTimer() },
}, h('span', { class: 'timer__track' }, fill), label);

let run = null; // { key, totalMs, leftMs, since, paused, expired, lastSecond }
let raf = 0;

const remaining = (now) => (run.paused || run.expired ? run.leftMs : Math.max(0, run.leftMs - (now - run.since)));

function draw(ms) {
  const secs = Math.ceil(ms / 1000);
  fill.style.transform = `scaleX(${run.totalMs ? ms / run.totalMs : 0})`;
  label.textContent = run.expired ? T.clue.timeUp : run.paused ? `⏸ ${secs}` : String(secs);
  el.classList.toggle('timer--warn', !run.expired && secs <= 5);
  el.classList.toggle('timer--expired', run.expired);
  el.classList.toggle('timer--paused', run.paused);
  el.setAttribute('aria-label', run.paused ? T.timer.paused(secs) : T.timer.left(secs));
}

function frame() {
  raf = 0;
  if (!run) return;
  const ms = remaining(performance.now());
  const secs = Math.ceil(ms / 1000);
  if (!run.paused && !run.expired) {
    if (secs !== run.lastSecond) {
      run.lastSecond = secs;
      if (secs > 0 && secs <= 5) play('tick');
    }
    if (ms <= 0) {
      run.expired = true;
      run.leftMs = 0;
      play('timeout');
      run.onExpire?.();
    }
  }
  draw(ms);
  if (!run.paused && !run.expired) raf = requestAnimationFrame(frame);
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(frame);
}

/**
 * Da chiamare dopo ogni rendering: spec = { key, seconds, onExpire? } se c'è un timer attivo, altrimenti null.
 * Una chiave nuova (altra tessera, rubata) fa ripartire il timer; la stessa chiave lo lascia correre.
 */
export function syncTimer(spec) {
  if (!spec) {
    run = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    return;
  }
  if (run?.key !== spec.key) {
    const totalMs = spec.seconds * 1000;
    run = { key: spec.key, totalMs, leftMs: totalMs, since: performance.now(), paused: false, expired: false, lastSecond: spec.seconds };
    draw(totalMs);
  }
  run.onExpire = spec.onExpire;
  schedule();
}

/** Elemento del timer (sempre lo stesso nodo, così sopravvive ai ridisegni della schermata). */
export const timerElement = () => el;

/** Pausa/ripresa (tasto T). Restituisce false se non c'è un timer che corre. */
export function toggleTimer() {
  if (!run || run.expired) return false;
  const now = performance.now();
  if (run.paused) {
    run.since = now;
    run.paused = false;
  } else {
    run.leftMs = remaining(now);
    run.paused = true;
  }
  draw(remaining(now));
  schedule();
  return true;
}

// Effetti sonori sintetizzati con Web Audio: nessun file audio, tutto originale (niente musiche del programma TV).
let ac = null;
let master = null;
let enabled = true;
let volume = 0.7;
let music = null;
let applauseBuffer = null;

// I browser attivano l'audio solo dopo un gesto dell'utente: prima di allora i suoni vengono saltati.
function context({ create = false } = {}) {
  if (!ac) {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    const activated = navigator.userActivation?.hasBeenActive ?? true;
    if (!AC || (!create && !activated)) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = enabled ? volume : 0;
    master.connect(ac.destination);
  }
  return ac;
}

/** Da chiamare al primo clic o tasto: crea o riattiva l'AudioContext. */
export function unlockAudio() {
  const c = context({ create: true });
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

/** Applica le impostazioni salvate (audio sì/no e volume 0–1). */
export function configureAudio({ sound, volume: v }) {
  enabled = sound !== false;
  volume = Math.min(1, Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0.7));
  if (master) master.gain.setTargetAtTime(enabled ? volume : 0, ac.currentTime, 0.02);
  if (!enabled) stopMusic();
}

// Nota con inviluppo semplice; slideTo fa un glissando.
function tone({ freq, type = 'sine', start = 0, dur = 0.2, gain = 0.25, attack = 0.005, release = 0.06, slideTo, out = master }) {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Colpo di rumore filtrato (charleston della musica d'attesa).
function noiseHit({ start = 0, dur = 0.05, gain = 0.05, freq = 7000, out = master }) {
  const t0 = ac.currentTime + start;
  const length = Math.ceil(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = freq;
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(out);
  src.start(t0);
}

// Fanfara originale del Daily Double: arpeggio che sale e accordo maggiore tenuto, timbro "ottoni".
function fanfare() {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2400;
  filter.connect(master);
  [392, 523.25, 659.25, 783.99].forEach((freq, i) => tone({ freq, type: 'sawtooth', start: i * 0.07, dur: 0.16, gain: 0.12, out: filter }));
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => tone({ freq, type: 'sawtooth', start: 0.32, dur: 0.9, gain: 0.08, release: 0.4, out: filter }));
  tone({ freq: 1046.5, slideTo: 2093, type: 'triangle', start: 0.32, dur: 0.5, gain: 0.06 });
}

// Applausi: rumore filtrato modulato da tanti battiti di mani casuali (calcolato una volta sola).
function applause() {
  if (!applauseBuffer) {
    const seconds = 2.8;
    const rate = ac.sampleRate;
    const length = Math.ceil(rate * seconds);
    applauseBuffer = ac.createBuffer(1, length, rate);
    const data = applauseBuffer.getChannelData(0);
    const env = new Float32Array(length);
    for (let k = 0; k < 160; k++) {
      const at = Math.floor(Math.random() * (length - rate * 0.05));
      const amp = 0.4 + Math.random() * 0.6;
      for (let i = 0; i < rate * 0.05; i++) env[at + i] += amp * Math.exp(-i / (rate * 0.012));
    }
    for (let i = 0; i < length; i++) {
      const fade = Math.min(1, i / (rate * 0.3), (length - i) / (rate * 0.9));
      data[i] = (Math.random() * 2 - 1) * Math.min(1, env[i]) * fade;
    }
  }
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = applauseBuffer;
  filter.type = 'bandpass';
  filter.frequency.value = 2200;
  filter.Q.value = 0.6;
  g.gain.value = 0.9;
  src.connect(filter).connect(g).connect(master);
  src.start();
}

const SOUNDS = {
  blip: () => {
    tone({ freq: 660, type: 'triangle', dur: 0.07, gain: 0.22 });
    tone({ freq: 990, type: 'triangle', start: 0.06, dur: 0.09, gain: 0.18 });
  },
  reveal: () => tone({ freq: 330, slideTo: 990, type: 'sine', dur: 0.35, gain: 0.22 }),
  correct: () => [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone({ freq, type: 'triangle', start: i * 0.09, dur: 0.24, gain: 0.22 })),
  wrong: () => {
    tone({ freq: 110, type: 'sawtooth', dur: 0.55, gain: 0.14 });
    tone({ freq: 116.5, type: 'sawtooth', dur: 0.55, gain: 0.14 });
  },
  tick: () => tone({ freq: 1500, type: 'square', dur: 0.03, gain: 0.07, attack: 0.001, release: 0.02 }),
  timeout: () => [0, 0.24].forEach((start, i) => tone({ freq: i ? 330 : 440, type: 'square', start, dur: 0.22, gain: 0.12 })),
  dailyDouble: fanfare,
  applause,
};

/** Suona un effetto: blip, reveal, correct, wrong, tick, timeout, dailyDouble, applause. */
export function play(name) {
  if (!enabled || !SOUNDS[name]) return;
  const c = context();
  if (!c) return;
  if (c.state === 'running') SOUNDS[name]();
  else if (navigator.userActivation?.isActive) c.resume().then(() => SOUNDS[name]()).catch(() => {});
}

// Musica d'attesa originale del Gran Finale (re minore, 104 bpm): basso, arpeggio e charleston, in loop.
const CHORDS = [
  { bass: 73.42, notes: [293.66, 349.23, 440, 349.23, 587.33, 440, 349.23, 440] },
  { bass: 58.27, notes: [293.66, 349.23, 466.16, 349.23, 587.33, 466.16, 349.23, 466.16] },
  { bass: 87.31, notes: [261.63, 349.23, 440, 349.23, 523.25, 440, 349.23, 440] },
  { bass: 65.41, notes: [261.63, 329.63, 392, 329.63, 523.25, 392, 329.63, 392] },
];

export function startMusic() {
  if (!enabled || music) return;
  const c = context();
  if (!c) return;
  const out = c.createGain();
  out.gain.value = 0.9;
  out.connect(master);
  const eighth = 60 / 104 / 2;
  let step = 0;
  let next = c.currentTime + 0.05;
  const schedule = () => {
    while (next < c.currentTime + 0.25) {
      const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
      const at = next - c.currentTime;
      tone({ freq: chord.notes[step % 8], type: 'triangle', start: at, dur: eighth * 0.9, gain: 0.07, out });
      if (step % 4 === 0) tone({ freq: chord.bass, type: 'sine', start: at, dur: eighth * 3.6, gain: 0.2, release: 0.2, out });
      if (step % 2 === 0) noiseHit({ start: at, gain: 0.03, out });
      next += eighth;
      step++;
    }
  };
  schedule();
  music = { out, timer: setInterval(schedule, 60) };
}

export function stopMusic() {
  if (!music) return;
  clearInterval(music.timer);
  clearTimeout(music.limit);
  const { out } = music;
  out.gain.setTargetAtTime(0, ac.currentTime, 0.15);
  setTimeout(() => out.disconnect(), 1200);
  music = null;
}

let musicKey = null;

/**
 * Da chiamare dopo ogni rendering: spec = { key, maxSeconds? } finché la musica deve suonare, altrimenti null.
 * Una chiave nuova la fa partire; fermata dal timer, la musica non riparte finché la chiave resta la stessa.
 */
export function syncMusic(spec) {
  const key = spec?.key ?? null;
  if (key === musicKey) return;
  musicKey = key;
  stopMusic();
  if (!key) return;
  startMusic();
  if (music && spec.maxSeconds) music.limit = setTimeout(stopMusic, spec.maxSeconds * 1000);
}

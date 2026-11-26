// Small piano-like synth with the Web Audio API (no samples to download).
import { frequency } from '/shared/theory.js';

let ctx = null;
let master = null;

/** Must be called from a click: browsers only allow audio after a user gesture. */
export async function unlockAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createDynamicsCompressor();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') await ctx.resume();
  return ctx;
}

export const audioReady = () => !!ctx && ctx.state === 'running';

function tone(freq, start, dur, vol = 0.22) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.012);
  g.gain.exponentialRampToValueAtTime(vol * 0.35, start + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  g.connect(master);
  // Fundamental + two quieter partials gives a soft, piano-ish timbre.
  [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]].forEach(([mult, type, level]) => {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = type;
    o.frequency.value = freq * mult;
    og.gain.value = level;
    o.connect(og).connect(g);
    o.start(start);
    o.stop(start + dur + 0.05);
  });
}

/**
 * melodic: one after another. harmonic: together, then broken.
 * Returns the duration in seconds.
 */
export function play(notes, how = 'melodic', speed = 1) {
  if (!ctx) return 0;
  const t0 = ctx.currentTime + 0.05;
  const step = (notes.length > 4 ? 0.38 : 0.6) / speed;
  if (how === 'harmonic') {
    notes.forEach((n) => tone(frequency(n), t0, 1.6, 0.18));
    notes.forEach((n, i) => tone(frequency(n), t0 + 1.8 + i * 0.34, 0.9, 0.2));
    return 1.8 + notes.length * 0.34 + 0.9;
  }
  notes.forEach((n, i) => tone(frequency(n), t0 + i * step, step * 1.6));
  if (notes.length === 2) {
    // Intervals: also play both notes together.
    notes.forEach((n) => tone(frequency(n), t0 + 2 * step + 0.25, 1.3, 0.17));
    return 2 * step + 1.6;
  }
  return notes.length * step + 0.6;
}

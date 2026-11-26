// Music theory model and exercise generator. Pure JavaScript, used by the browser and the server.
// A note is { letter: 0..6 (Dó..Si), acc: -2..2 (♭♭..♯♯), oct } — spelled, so it can be drawn on a staff.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SOLFEGE = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const ACC_SIGN = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };

export const note = (letter, acc = 0, oct = 4) => ({ letter, acc, oct });
export const midi = (n) => 12 * (n.oct + 1) + NATURAL[n.letter] + n.acc;
export const frequency = (n) => 440 * 2 ** ((midi(n) - 69) / 12);
export const noteName = (n, withOctave = false) => SOLFEGE[n.letter] + ACC_SIGN[n.acc] + (withOctave ? n.oct : '');
/** Diatonic position, used for vertical placement on the staff (E4 = bottom line of the treble clef). */
export const staffStep = (n) => n.letter + 7 * n.oct;

/** All intervals by id. `steps` = letter distance, `semis` = size in semitones. */
export const IV = {
  P1: { semis: 0, steps: 0, name: 'Uníssono' },
  m2: { semis: 1, steps: 1, name: '2ª menor' },
  M2: { semis: 2, steps: 1, name: '2ª maior' },
  m3: { semis: 3, steps: 2, name: '3ª menor' },
  M3: { semis: 4, steps: 2, name: '3ª maior' },
  P4: { semis: 5, steps: 3, name: '4ª perfeita' },
  A4: { semis: 6, steps: 3, name: '4ª aumentada (trítono)' },
  d5: { semis: 6, steps: 4, name: '5ª diminuta' },
  P5: { semis: 7, steps: 4, name: '5ª perfeita' },
  A5: { semis: 8, steps: 4, name: '5ª aumentada' },
  m6: { semis: 8, steps: 5, name: '6ª menor' },
  M6: { semis: 9, steps: 5, name: '6ª maior' },
  d7: { semis: 9, steps: 6, name: '7ª diminuta' },
  m7: { semis: 10, steps: 6, name: '7ª menor' },
  M7: { semis: 11, steps: 6, name: '7ª maior' },
  P8: { semis: 12, steps: 7, name: 'Oitava perfeita' },
};

/** Note `iv` above `n`, spelled correctly (e.g. 3ª menor de Mi = Sol, not Fá♯♯). */
export function above(n, iv) {
  const { steps, semis } = typeof iv === 'string' ? IV[iv] : iv;
  const l = n.letter + steps;
  const letter = l % 7;
  const oct = n.oct + Math.floor(l / 7);
  const acc = midi(n) + semis - (12 * (oct + 1) + NATURAL[letter]);
  return { letter, acc, oct };
}

// Items of each category, in the order they are unlocked (easier first).
export const CHORDS = {
  maj: { name: 'Maior', ivs: ['M3', 'P5'] },
  min: { name: 'Menor', ivs: ['m3', 'P5'] },
  dim: { name: 'Diminuto', ivs: ['m3', 'd5'] },
  aug: { name: 'Aumentado', ivs: ['M3', 'A5'] },
  dom7: { name: 'Sétima da dominante', ivs: ['M3', 'P5', 'm7'] },
  maj7: { name: 'Sétima maior', ivs: ['M3', 'P5', 'M7'] },
  m7: { name: 'Menor com sétima', ivs: ['m3', 'P5', 'm7'] },
  m7b5: { name: 'Meio-diminuto', ivs: ['m3', 'd5', 'm7'] },
  dim7: { name: 'Diminuto com sétima', ivs: ['m3', 'd5', 'd7'] },
};

export const SCALES = {
  major: { name: 'Maior', ivs: ['M2', 'M3', 'P4', 'P5', 'M6', 'M7', 'P8'] },
  minor: { name: 'Menor natural', ivs: ['M2', 'm3', 'P4', 'P5', 'm6', 'm7', 'P8'] },
  harmonic: { name: 'Menor harmónica', ivs: ['M2', 'm3', 'P4', 'P5', 'm6', 'M7', 'P8'] },
  pentatonic: { name: 'Pentatónica maior', ivs: ['M2', 'M3', 'P5', 'M6', 'P8'] },
  melodic: { name: 'Menor melódica', ivs: ['M2', 'm3', 'P4', 'P5', 'M6', 'M7', 'P8'] },
  dorian: { name: 'Dórica', ivs: ['M2', 'm3', 'P4', 'P5', 'M6', 'm7', 'P8'] },
  mixolydian: { name: 'Mixolídia', ivs: ['M2', 'M3', 'P4', 'P5', 'M6', 'm7', 'P8'] },
  lydian: { name: 'Lídia', ivs: ['M2', 'M3', 'A4', 'P5', 'M6', 'M7', 'P8'] },
  phrygian: { name: 'Frígia', ivs: ['m2', 'm3', 'P4', 'P5', 'm6', 'm7', 'P8'] },
  locrian: { name: 'Lócria', ivs: ['m2', 'm3', 'P4', 'd5', 'm6', 'm7', 'P8'] },
};

const INTERVAL_ORDER = ['P5', 'P8', 'M3', 'm3', 'P4', 'M2', 'm2', 'M6', 'm6', 'm7', 'M7', 'A4'];
// Natural notes from Dó4 to Lá5 — the comfortable range of the treble clef.
const NOTE_ITEMS = Array.from({ length: 13 }, (_, i) => `${LETTERS[i % 7]}${4 + Math.floor(i / 7)}`);

export const CATEGORIES = {
  notes: {
    title: 'Notas', modes: ['read'],
    items: NOTE_ITEMS.map((id) => ({ id, name: noteName(parseNoteId(id), true) })),
  },
  intervals: {
    title: 'Intervalos', modes: ['ear', 'read'],
    items: INTERVAL_ORDER.map((id) => ({ id, name: IV[id].name })),
  },
  chords: {
    title: 'Acordes', modes: ['ear', 'read'],
    items: Object.entries(CHORDS).map(([id, c]) => ({ id, name: c.name })),
  },
  scales: {
    title: 'Escalas e modos', modes: ['ear', 'read'],
    items: Object.entries(SCALES).map(([id, s]) => ({ id, name: s.name })),
  },
};

export function parseNoteId(id) {
  return note(LETTERS.indexOf(id[0]), 0, Number(id.slice(1)));
}

// Roots used for intervals, chords and scales: common spellings, no double accidentals at the root.
const ROOTS = [[0, 0], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1]];
const LOW = midi(note(0, 0, 4)); // Dó4
const HIGH = midi(note(5, 0, 5)); // Lá5

/** Small deterministic RNG (mulberry32) so exercises can be reproduced in tests. */
export function rng(seed = Date.now()) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickOne = (arr, r) => arr[Math.floor(r() * arr.length)];
function shuffle(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Notes of an item built on a root. */
export function build(category, itemId, root) {
  if (category === 'intervals') return [root, above(root, itemId)];
  if (category === 'chords') return [root, ...CHORDS[itemId].ivs.map((iv) => above(root, iv))];
  if (category === 'scales') return [root, ...SCALES[itemId].ivs.map((iv) => above(root, iv))];
  throw new Error(`Categoria sem raiz: ${category}`);
}

const fits = (notes) => notes.every((n) => Math.abs(n.acc) <= 1 && midi(n) >= LOW && midi(n) <= HIGH);

/**
 * Generates one exercise.
 * @param category  'notes' | 'intervals' | 'chords' | 'scales'
 * @param mode      'ear' (listen and identify) | 'read' (read the staff and identify)
 * @param itemId    the correct answer (chosen by the adaptive selector)
 * @param pool      item ids the learner has unlocked; wrong options come from here first
 */
export function makeExercise(category, mode, itemId, pool = [], r = Math.random) {
  const cat = CATEGORIES[category];
  if (!cat) throw new Error(`Categoria desconhecida: ${category}`);
  if (!cat.modes.includes(mode)) throw new Error(`Modo ${mode} não existe em ${category}`);
  if (!cat.items.some((i) => i.id === itemId)) throw new Error(`Item desconhecido: ${itemId}`);

  let notes;
  let options;
  let answer = itemId;

  if (category === 'notes') {
    notes = [parseNoteId(itemId)];
    // Answer by name only (Dó..Si): the octave is visible on the staff.
    answer = itemId[0];
    options = LETTERS.map((l, i) => ({ id: l, label: SOLFEGE[i] }));
  } else {
    for (let tries = 0; tries < 100 && !notes; tries++) {
      const [letter, acc] = pickOne(ROOTS, r);
      const candidate = build(category, itemId, note(letter, acc, 4));
      if (fits(candidate)) notes = candidate;
    }
    if (!notes) throw new Error(`Não foi possível gerar ${category}/${itemId}`);
    const all = cat.items.map((i) => i.id).filter((id) => id !== itemId);
    const fromPool = shuffle(all.filter((id) => pool.includes(id)), r);
    const rest = shuffle(all.filter((id) => !pool.includes(id)), r);
    const n = Math.min(category === 'intervals' ? 5 : 3, all.length);
    const wrong = [...fromPool, ...rest].slice(0, n);
    options = shuffle([itemId, ...wrong], r).map((id) => ({ id, label: cat.items.find((i) => i.id === id).name }));
  }

  return {
    category,
    mode,
    itemId,
    answer,
    notes,
    root: noteName(notes[0]),
    // How to play it: chords together then broken, scales and intervals in sequence.
    playback: category === 'chords' ? 'harmonic' : 'melodic',
    options,
  };
}

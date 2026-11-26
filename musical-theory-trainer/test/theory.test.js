import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, IV, above, build, frequency, makeExercise, midi, note, noteName, rng } from '../shared/theory.js';

const names = (ns) => ns.map((n) => noteName(n)).join(' ');

test('midi and frequency of Lá4 = 440 Hz', () => {
  assert.equal(midi(note(5, 0, 4)), 69);
  assert.equal(frequency(note(5, 0, 4)), 440);
  assert.equal(midi(note(0, 0, 4)), 60);
});

test('intervals are spelled by letter distance, not just semitones', () => {
  assert.equal(noteName(above(note(2, 0, 4), 'm3')), 'Sol'); // Mi + 3ª menor = Sol (not Fá𝄪)
  assert.equal(noteName(above(note(3, 0, 4), 'A4')), 'Si'); // Fá + trítono = Si
  assert.equal(noteName(above(note(6, 0, 4), 'd5')), 'Fá'); // Si + 5ª diminuta = Fá
  assert.equal(noteName(above(note(0, 0, 4), 'm7')), 'Si♭');
  for (const [id, iv] of Object.entries(IV)) {
    const r = note(0, 0, 4);
    assert.equal(midi(above(r, id)) - midi(r), iv.semis, id);
  }
});

test('chords and scales', () => {
  assert.equal(names(build('chords', 'dom7', note(4, 0, 4))), 'Sol Si Ré Fá');
  assert.equal(names(build('chords', 'dim7', note(6, 0, 4))), 'Si Ré Fá Lá♭');
  assert.equal(names(build('scales', 'major', note(3, 0, 4))), 'Fá Sol Lá Si♭ Dó Ré Mi Fá');
  assert.equal(names(build('scales', 'harmonic', note(5, 0, 4))), 'Lá Si Dó Ré Mi Fá Sol♯ Lá');
  assert.equal(names(build('scales', 'dorian', note(1, 0, 4))), 'Ré Mi Fá Sol Lá Si Dó Ré');
});

test('every item of every category produces a valid exercise in range', () => {
  const r = rng(42);
  for (const [category, cat] of Object.entries(CATEGORIES)) {
    for (const mode of cat.modes) {
      for (const item of cat.items) {
        for (let k = 0; k < 20; k++) {
          const ex = makeExercise(category, mode, item.id, [], r);
          assert.ok(ex.options.some((o) => o.id === ex.answer), `${category}/${item.id} answer among options`);
          assert.equal(new Set(ex.options.map((o) => o.id)).size, ex.options.length, 'options are distinct');
          for (const n of ex.notes) {
            assert.ok(midi(n) >= 60 && midi(n) <= 81, `${category}/${item.id} ${noteName(n, true)} in Dó4..Lá5`);
            assert.ok(Math.abs(n.acc) <= 1, 'no double accidentals');
          }
        }
      }
    }
  }
});

test('wrong options come from the unlocked pool first', () => {
  const ex = makeExercise('chords', 'ear', 'maj', ['maj', 'min', 'dim'], rng(7));
  const ids = ex.options.map((o) => o.id).sort();
  assert.ok(ids.includes('min') && ids.includes('dim'));
});

test('the same seed gives the same exercise', () => {
  const a = makeExercise('scales', 'read', 'lydian', [], rng(99));
  const b = makeExercise('scales', 'read', 'lydian', [], rng(99));
  assert.deepEqual(a, b);
});

test('invalid input is rejected', () => {
  assert.throws(() => makeExercise('notes', 'ear', 'C4'), /Modo/);
  assert.throws(() => makeExercise('chords', 'ear', 'nope'), /Item/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BOX, START_UNLOCKED, pickItem, statKey, summarize, unlockedItems, updateStat } from '../shared/adaptive.js';
import { CATEGORIES, rng } from '../shared/theory.js';

test('Leitner boxes: right moves up (max 5), wrong goes back to 1', () => {
  let s;
  for (let i = 0; i < 7; i++) s = updateStat(s, true);
  assert.equal(s.box, MAX_BOX);
  assert.deepEqual(updateStat(s, false), { box: 1, attempts: 8, correct: 7 });
});

test('items unlock progressively as the current ones are mastered', () => {
  const stats = {};
  assert.equal(unlockedItems('ear', 'intervals', stats).length, START_UNLOCKED);
  const first = CATEGORIES.intervals.items.slice(0, START_UNLOCKED).map((i) => i.id);
  first.forEach((id) => (stats[statKey('ear', 'intervals', id)] = { box: 3, attempts: 3, correct: 3 }));
  assert.equal(unlockedItems('ear', 'intervals', stats).length, START_UNLOCKED + 1);
  // Progress in one mode does not unlock the other.
  assert.equal(unlockedItems('read', 'intervals', stats).length, START_UNLOCKED);
});

test('items in box 1 are picked far more often than mastered ones', () => {
  const stats = {
    [statKey('ear', 'chords', 'maj')]: { box: 5, attempts: 9, correct: 9 },
    [statKey('ear', 'chords', 'min')]: { box: 5, attempts: 9, correct: 9 },
    [statKey('ear', 'chords', 'dim')]: { box: 1, attempts: 4, correct: 1 },
  };
  const r = rng(3);
  const count = { maj: 0, min: 0, dim: 0 };
  for (let i = 0; i < 3000; i++) count[pickItem('ear', 'chords', stats, r).itemId]++;
  assert.ok(count.dim > 5 * count.maj, JSON.stringify(count));
});

test('summary reports accuracy and unlocked counts', () => {
  const stats = { [statKey('read', 'notes', 'C4')]: { box: 2, attempts: 4, correct: 3 } };
  const s = summarize(stats)['read:notes'];
  assert.equal(s.attempts, 4);
  assert.equal(s.accuracy, 0.75);
  assert.equal(s.unlocked, START_UNLOCKED);
});

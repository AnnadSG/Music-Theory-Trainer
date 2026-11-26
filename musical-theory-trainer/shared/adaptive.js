// Adaptive practice: a Leitner system (boxes 1..5) per item, plus progressive unlocking.
// Items you get wrong go back to box 1 and come up far more often; mastered items rarely.
import { CATEGORIES } from './theory.js';

export const MAX_BOX = 5;
export const START_UNLOCKED = 3;
export const UNLOCK_AT_BOX = 3;

/** Statistics key: one entry per (mode, category, item). */
export const statKey = (mode, category, itemId) => `${mode}:${category}:${itemId}`;

export const emptyStat = () => ({ box: 1, attempts: 0, correct: 0 });

/** Returns the new statistics after one answer (does not mutate). */
export function updateStat(stat = emptyStat(), correct) {
  return {
    box: correct ? Math.min(MAX_BOX, stat.box + 1) : 1,
    attempts: stat.attempts + 1,
    correct: stat.correct + (correct ? 1 : 0),
  };
}

/** 0..1, how well an item is known. */
export const mastery = (stat) => (stat ? (stat.box - 1) / (MAX_BOX - 1) : 0);

/**
 * Items available to practise. Starts with the first few; the next one unlocks once every
 * unlocked item has been answered and they average at least box 3.
 */
export function unlockedItems(mode, category, stats) {
  const items = CATEGORIES[category].items.map((i) => i.id);
  let n = Math.min(START_UNLOCKED, items.length);
  while (n < items.length) {
    const current = items.slice(0, n).map((id) => stats[statKey(mode, category, id)]);
    const ready = current.every((s) => s && s.attempts > 0) &&
      current.reduce((sum, s) => sum + s.box, 0) / n >= UNLOCK_AT_BOX;
    if (!ready) break;
    n++;
  }
  return items.slice(0, n);
}

/** Weighted random choice: weight 2^(5 - box), so box 1 is 16x likelier than box 5. */
export function pickItem(mode, category, stats, r = Math.random, avoid = null) {
  const pool = unlockedItems(mode, category, stats);
  const weights = pool.map((id) => {
    const s = stats[statKey(mode, category, id)];
    let w = 2 ** (MAX_BOX - (s?.box ?? 1));
    if (id === avoid && pool.length > 1) w *= 0.15; // rarely the same item twice in a row
    return w;
  });
  let x = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    x -= weights[i];
    if (x <= 0) return { itemId: pool[i], pool };
  }
  return { itemId: pool[pool.length - 1], pool };
}

/** Summary per mode/category for the progress screen. */
export function summarize(stats) {
  const out = {};
  for (const [category, cat] of Object.entries(CATEGORIES)) {
    for (const mode of cat.modes) {
      const rows = cat.items.map((item) => ({ ...item, ...(stats[statKey(mode, category, item.id)] ?? emptyStat()) }));
      const attempts = rows.reduce((a, r) => a + r.attempts, 0);
      const correct = rows.reduce((a, r) => a + r.correct, 0);
      out[`${mode}:${category}`] = {
        attempts,
        accuracy: attempts ? correct / attempts : null,
        unlocked: unlockedItems(mode, category, stats).length,
        total: rows.length,
        mastery: rows.reduce((a, r) => a + mastery(r), 0) / rows.length,
      };
    }
  }
  return out;
}

// Draws notes on a treble staff as SVG (whole notes, no stems).
import { staffStep } from '/shared/theory.js';

const S = 12; // distance between staff lines
const TOP = 46; // y of the top line (Fá5)
const BOTTOM = TOP + 4 * S; // y of the bottom line (Mi4)
const E4 = 30; // staffStep of Mi4
const ACC = { '-2': '𝄫', '-1': '♭', 1: '♯', 2: '𝄪' };

const yOf = (step) => BOTTOM - (step - E4) * (S / 2);

function head(x, y, cls) {
  return `<g class="${cls}" transform="translate(${x} ${y})">
    <ellipse rx="8.6" ry="6.1" class="nh"/>
    <ellipse rx="4.6" ry="2.9" transform="rotate(-38)" class="hole"/></g>`;
}

function ledgers(x, step) {
  let out = '';
  for (let s = 28; s >= step; s -= 2) out += `<line x1="${x - 14}" x2="${x + 14}" y1="${yOf(s)}" y2="${yOf(s)}" class="ln"/>`;
  for (let s = 40; s <= step; s += 2) out += `<line x1="${x - 14}" x2="${x + 14}" y1="${yOf(s)}" y2="${yOf(s)}" class="ln"/>`;
  return out;
}

/**
 * @param notes   spelled notes
 * @param layout  'melodic' (side by side) or 'chord' (stacked)
 * @param hidden  draw placeholders instead of the notes (ear training before answering)
 */
export function drawStaff(notes, { layout = 'melodic', hidden = false } = {}) {
  const cols = layout === 'chord' ? 1 : notes.length;
  const gap = cols > 6 ? 52 : 66;
  const x0 = 104;
  const W = Math.max(260, x0 + cols * gap + 20);
  const H = 150;
  let body = '';

  for (let i = 0; i < 5; i++) body += `<line x1="8" x2="${W - 8}" y1="${TOP + i * S}" y2="${TOP + i * S}" class="ln"/>`;
  body += `<line x1="${W - 8}" x2="${W - 8}" y1="${TOP}" y2="${BOTTOM}" class="ln"/>`;
  body += `<text x="14" y="${BOTTOM + 14}" class="clef">𝄞</text>`;

  if (hidden) {
    for (let c = 0; c < cols; c++) body += `<text x="${x0 + c * gap + gap / 2}" y="${TOP + 2 * S + 9}" class="qm">?</text>`;
  } else {
    let lastAccStep = null;
    let lastAccOffset = 0;
    notes.forEach((n, i) => {
      const x = x0 + (layout === 'chord' ? 0 : i) * gap + gap / 2;
      const step = staffStep(n);
      const y = yOf(step);
      body += ledgers(x, step);
      if (n.acc) {
        // In a chord, push an accidental further left if it would touch the previous one.
        let off = 20;
        if (layout === 'chord' && lastAccStep !== null && Math.abs(step - lastAccStep) < 6) off = lastAccOffset === 20 ? 32 : 20;
        body += `<text x="${x - off}" y="${y + 8}" class="acc" text-anchor="middle">${ACC[n.acc]}</text>`;
        lastAccStep = step;
        lastAccOffset = off;
      }
      body += head(x, y, 'note');
    });
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pauta em clave de sol" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

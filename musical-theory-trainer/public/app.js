import { CATEGORIES, makeExercise, noteName } from '/shared/theory.js';
import { emptyStat, mastery, pickItem, statKey, unlockedItems, updateStat } from '/shared/adaptive.js';
import { drawStaff } from '/staff.js';
import { audioReady, play, unlockAudio } from '/audio.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const MODE_LABEL = { ear: 'De ouvido', read: 'Na pauta' };
const PROMPT = {
  notes: { read: 'Que nota é esta?' },
  intervals: { ear: 'Que intervalo ouviste?', read: 'Que intervalo é este?' },
  chords: { ear: 'Que acorde ouviste?', read: 'Que acorde é este?' },
  scales: { ear: 'Que escala ou modo ouviste?', read: 'Que escala ou modo é este?' },
};

const local = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const state = {
  category: 'intervals',
  mode: 'ear',
  ex: null,
  answered: false,
  shownAt: 0,
  token: local.get('mtt:token'),
  user: null,
  stats: local.get('mtt:guest') ?? {},
  session: { answers: 0, correct: 0, streak: 0 },
};

// ---------- API ----------
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Erro de rede'), { status: res.status });
  return data;
}

// ---------- Rendering ----------
function renderTabs() {
  $('tabs').innerHTML = Object.entries(CATEGORIES)
    .map(([id, c]) => `<button type="button" role="tab" data-c="${id}" aria-selected="${id === state.category}">${esc(c.title)}</button>`).join('');
  const modes = CATEGORIES[state.category].modes;
  if (!modes.includes(state.mode)) state.mode = modes[0];
  $('modes').innerHTML = modes
    .map((m) => `<button type="button" role="radio" data-m="${m}" aria-checked="${m === state.mode}">${MODE_LABEL[m]}</button>`).join('');
}

function renderExercise() {
  const { ex, answered } = state;
  const hidden = ex.mode === 'ear' && !answered;
  $('prompt').textContent = PROMPT[ex.category][ex.mode];
  $('play').hidden = ex.mode === 'read' && !answered;
  $('staff').innerHTML = drawStaff(ex.notes, { layout: ex.category === 'chords' ? 'chord' : 'melodic', hidden });
  $('options').innerHTML = ex.options
    .map((o, i) => `<button type="button" class="opt" data-id="${esc(o.id)}"><kbd>${i + 1}</kbd><span>${esc(o.label)}</span></button>`).join('');
  $('feedback').innerHTML = ex.mode === 'ear' ? '<span class="hint">Carrega em Ouvir (ou espaço) as vezes que precisares.</span>' : '';
  $('next').disabled = !answered;
}

function renderSession() {
  const s = state.session;
  $('kAns').textContent = s.answers;
  $('kAcc').textContent = s.answers ? `${Math.round((100 * s.correct) / s.answers)}%` : '–';
  $('kStreak').textContent = s.streak;
}

function renderMastery() {
  const { category, mode, stats, ex } = state;
  const cat = CATEGORIES[category];
  const open = new Set(unlockedItems(mode, category, stats));
  $('masteryTitle').textContent = `Domínio · ${cat.title} ${MODE_LABEL[mode].toLowerCase()}`;
  $('mastery').innerHTML = cat.items.map((item) => {
    const st = stats[statKey(mode, category, item.id)];
    const m = Math.round(mastery(st) * 100);
    const locked = !open.has(item.id);
    const acc = st?.attempts ? `${st.correct}/${st.attempts}` : locked ? 'bloqueado' : 'novo';
    return `<li class="${locked ? 'locked' : ''}${ex?.itemId === item.id ? ' now' : ''}"><span>${esc(item.name)}</span><span class="pct">${acc}</span><span class="bar"><i style="width:${m}%"></i></span></li>`;
  }).join('');
  const left = cat.items.length - open.size;
  $('unlockNote').textContent = left
    ? `Faltam ${left} por desbloquear. O próximo abre quando dominares os atuais (todos tentados, média da caixa ≥ 3).`
    : 'Tudo desbloqueado. Os itens que erras aparecem mais vezes.';
}

function renderAccount() {
  $('authForm').hidden = !!state.user;
  $('logged').hidden = !state.user;
  if (state.user) $('uname').textContent = state.user.username;
}

function renderActivity(rows) {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  const by = Object.fromEntries((rows ?? []).map((r) => [r.day, r]));
  const max = Math.max(1, ...days.map((d) => by[d]?.answers ?? 0));
  $('activity').innerHTML = days.map((d) => {
    const r = by[d];
    const h = r ? Math.max(6, (100 * r.answers) / max) : 4;
    const op = r ? 0.35 + 0.65 * (r.correct / r.answers) : 0.15;
    return `<i style="height:${h}%;opacity:${op.toFixed(2)}" title="${d}: ${r ? `${r.correct}/${r.answers} certas` : 'sem respostas'}"></i>`;
  }).join('');
}

// ---------- Flow ----------
function newExercise() {
  const { mode, category, stats } = state;
  const { itemId, pool } = pickItem(mode, category, stats, Math.random, state.ex?.itemId);
  state.ex = makeExercise(category, mode, itemId, pool);
  state.answered = false;
  state.shownAt = performance.now();
  renderExercise();
  renderMastery();
  // Browsers block sound until the first click, so only auto-play once audio is running.
  if (mode === 'ear' && audioReady()) playCurrent();
}

async function playCurrent() {
  try {
    await unlockAudio();
    play(state.ex.notes, state.ex.playback);
  } catch {
    $('feedback').innerHTML = '<span class="bad">O browser não deixou tocar som.</span>';
  }
}

async function answer(id) {
  if (state.answered) return;
  const { ex } = state;
  const correct = id === ex.answer;
  const ms = Math.round(performance.now() - state.shownAt);
  state.answered = true;

  const key = statKey(ex.mode, ex.category, ex.itemId);
  state.stats[key] = updateStat(state.stats[key] ?? emptyStat(), correct);
  const s = state.session;
  s.answers++;
  s.correct += correct ? 1 : 0;
  s.streak = correct ? s.streak + 1 : 0;

  renderExercise();
  document.querySelectorAll('.opt').forEach((b) => {
    b.disabled = true;
    if (b.dataset.id === ex.answer) b.classList.add('right');
    else if (b.dataset.id === id) b.classList.add('wrong');
  });
  const label = ex.options.find((o) => o.id === ex.answer).label;
  const detail = ex.category === 'notes' ? noteName(ex.notes[0], true) : `${label} a partir de ${ex.root}`;
  const spelled = ex.notes.map((n) => noteName(n)).join(' – ');
  $('feedback').innerHTML = `${correct ? '<span class="ok">Certo!</span>' : '<span class="bad">Não foi desta.</span>'} ${esc(detail)}.${ex.category === 'notes' ? '' : ` <span class="hint">(${esc(spelled)})</span>`}`;
  $('next').disabled = false;
  $('next').focus();
  if (ex.mode === 'read') playCurrent();
  renderSession();
  renderMastery();

  if (state.user) {
    try {
      const r = await api('/api/answers', { method: 'POST', body: { category: ex.category, mode: ex.mode, itemId: ex.itemId, correct, ms } });
      state.stats[r.key] = r.stat; // the server's copy is the reference
      loadActivity();
    } catch (e) {
      $('err').textContent = e.status === 401 ? 'A sessão expirou. Entra outra vez.' : 'Não foi possível guardar esta resposta.';
      if (e.status === 401) logoutLocal();
    }
  } else {
    local.set('mtt:guest', state.stats);
  }
}

async function loadActivity() {
  try {
    const p = await api('/api/progress');
    renderActivity(p.activity);
  } catch { /* keep the last chart */ }
}

async function startUserSession() {
  const [{ user }, progress] = await Promise.all([api('/api/me'), api('/api/progress')]);
  state.user = user;
  state.stats = progress.stats;
  renderAccount();
  renderActivity(progress.activity);
  renderMastery();
}

function logoutLocal() {
  state.token = null;
  state.user = null;
  local.del('mtt:token');
  state.stats = local.get('mtt:guest') ?? {};
  renderAccount();
  renderMastery();
}

// ---------- Events ----------
$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.category = b.dataset.c;
  renderTabs();
  newExercise();
});
$('modes').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.mode = b.dataset.m;
  renderTabs();
  newExercise();
});
$('options').addEventListener('click', (e) => {
  const b = e.target.closest('.opt');
  if (b) answer(b.dataset.id);
});
$('play').addEventListener('click', playCurrent);
$('next').addEventListener('click', newExercise);

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ' && !$('play').hidden) { e.preventDefault(); playCurrent(); }
  else if (e.key === 'Enter' && state.answered && !e.target.closest('button')) { e.preventDefault(); newExercise(); }
  else if (/^[1-9]$/.test(e.key)) {
    const o = state.ex?.options[Number(e.key) - 1];
    if (o) answer(o.id);
  }
});

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const act = e.submitter?.dataset.act ?? 'login';
  $('err').textContent = '';
  try {
    const r = await api(`/api/${act}`, { method: 'POST', body: { username: $('user').value.trim(), password: $('pass').value } });
    state.token = r.token;
    local.set('mtt:token', r.token);
    $('pass').value = '';
    await startUserSession();
  } catch (err) {
    $('err').textContent = err.message;
  }
});

$('logout').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch { /* already gone */ }
  logoutLocal();
});

// ---------- Boot ----------
renderTabs();
renderSession();
renderAccount();
newExercise();
if (state.token) startUserSession().catch(() => logoutLocal());

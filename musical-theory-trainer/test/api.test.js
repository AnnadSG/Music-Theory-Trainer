// End-to-end tests against the real HTTP app with the in-memory store.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStore } from '../server/db/memory.js';
import { createApp } from '../server/app.js';

let server;
let base;

before(async () => {
  server = createApp({ store: createMemoryStore() }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => new Promise((r) => server.close(r)));

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

test('health and static files', async () => {
  assert.deepEqual((await call('/api/health')).data, { ok: true, store: 'memory' });
  assert.equal((await fetch(`${base}/shared/theory.js`)).status, 200);
  assert.equal((await fetch(`${base}/`)).status, 200);
});

test('register, login, wrong password, duplicate name', async () => {
  const reg = await call('/api/register', { method: 'POST', body: { username: 'ana', password: 'segredo123' } });
  assert.equal(reg.status, 200);
  assert.ok(reg.data.token);
  assert.equal((await call('/api/register', { method: 'POST', body: { username: 'ANA', password: 'outra12345' } })).status, 409);
  assert.equal((await call('/api/login', { method: 'POST', body: { username: 'ana', password: 'errada123' } })).status, 401);
  assert.equal((await call('/api/register', { method: 'POST', body: { username: 'x', password: 'segredo123' } })).status, 400);
  assert.equal((await call('/api/register', { method: 'POST', body: { username: 'bruno', password: 'curta' } })).status, 400);
  const login = await call('/api/login', { method: 'POST', body: { username: 'Ana', password: 'segredo123' } });
  assert.equal(login.data.user.username, 'ana');
});

test('answers update the Leitner box on the server', async () => {
  const { data } = await call('/api/register', { method: 'POST', body: { username: 'carla', password: 'segredo123' } });
  const token = data.token;
  assert.equal((await call('/api/progress')).status, 401, 'needs a session');

  const send = (correct) => call('/api/answers', { method: 'POST', token, body: { category: 'intervals', mode: 'ear', itemId: 'P5', correct, ms: 1500 } });
  await send(true);
  const second = await send(true);
  assert.deepEqual(second.data.stat, { box: 3, attempts: 2, correct: 2 });
  assert.equal((await send(false)).data.stat.box, 1);

  const bad = await call('/api/answers', { method: 'POST', token, body: { category: 'notes', mode: 'ear', itemId: 'C4', correct: true } });
  assert.equal(bad.status, 400, 'notes have no ear mode');

  const p = await call('/api/progress', { token });
  assert.equal(p.data.stats['ear:intervals:P5'].attempts, 3);
  assert.equal(p.data.summary['ear:intervals'].attempts, 3);
  assert.equal(p.data.activity.at(-1).answers, 3);
});

test('logout invalidates the token', async () => {
  const { data } = await call('/api/register', { method: 'POST', body: { username: 'duarte', password: 'segredo123' } });
  assert.equal((await call('/api/me', { token: data.token })).status, 200);
  await call('/api/logout', { method: 'POST', token: data.token });
  assert.equal((await call('/api/me', { token: data.token })).status, 401);
});

test('auth routes are rate limited', async () => {
  let last;
  for (let i = 0; i < 35; i++) last = await call('/api/login', { method: 'POST', body: { username: 'ninguem', password: 'segredo123' } });
  assert.equal(last.status, 429);
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { CATEGORIES } from '../shared/theory.js';
import { statKey, summarize, updateStat } from '../shared/adaptive.js';
import { MIN_PASSWORD, USERNAME_RE, hashPassword, hashToken, newToken, verifyPassword } from './auth.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Simple fixed-window rate limit per IP for the auth routes. */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const h = hits.get(req.ip);
    if (!h || now - h.start > windowMs) hits.set(req.ip, { start: now, n: 1 });
    else if (++h.n > max) return res.status(429).json({ error: 'Demasiadas tentativas. Espera um pouco.' });
    next();
  };
}

export function createApp({ store, sessionDays = 30 }) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8kb' }));
  app.use(express.static(path.join(ROOT, 'public')));
  app.use('/shared', express.static(path.join(ROOT, 'shared')));

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  /** Resolves the user from "Authorization: Bearer <token>". */
  const auth = (required) => wrap(async (req, res, next) => {
    const token = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    req.token = token;
    req.user = token ? await store.sessionUser(hashToken(token)) : null;
    if (required && !req.user) throw new HttpError(401, 'Sessão inválida ou expirada');
    next();
  });

  async function startSession(res, user) {
    const token = newToken();
    await store.createSession(hashToken(token), user.id, new Date(Date.now() + sessionDays * 864e5));
    res.json({ token, user: { id: user.id, username: user.username } });
  }

  const credentials = (body) => {
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Nome de utilizador: 3 a 24 letras, números, _ . -');
    if (password.length < MIN_PASSWORD || password.length > 200) throw new HttpError(400, `A palavra-passe precisa de pelo menos ${MIN_PASSWORD} caracteres`);
    return { username, password };
  };

  app.get('/api/health', (req, res) => res.json({ ok: true, store: store.kind }));

  app.post('/api/register', rateLimit({ windowMs: 15 * 60e3, max: 20 }), wrap(async (req, res) => {
    const { username, password } = credentials(req.body);
    const user = await store.createUser(username, await hashPassword(password));
    if (!user) throw new HttpError(409, 'Esse nome de utilizador já existe');
    await startSession(res, user);
  }));

  app.post('/api/login', rateLimit({ windowMs: 15 * 60e3, max: 30 }), wrap(async (req, res) => {
    const { username, password } = credentials(req.body);
    const user = await store.findUser(username);
    if (!user || !(await verifyPassword(password, user.pass_hash))) throw new HttpError(401, 'Utilizador ou palavra-passe errados');
    await startSession(res, user);
  }));

  app.post('/api/logout', auth(true), wrap(async (req, res) => {
    await store.deleteSession(hashToken(req.token));
    res.json({ ok: true });
  }));

  app.get('/api/me', auth(true), (req, res) => res.json({ user: req.user }));

  app.get('/api/progress', auth(true), wrap(async (req, res) => {
    const stats = await store.getStats(req.user.id);
    res.json({ stats, summary: summarize(stats), activity: await store.activity(req.user.id, 14) });
  }));

  /** Records one answer. The server recomputes the Leitner box itself. */
  app.post('/api/answers', auth(true), wrap(async (req, res) => {
    const { category, mode, itemId, correct, ms } = req.body ?? {};
    const cat = CATEGORIES[category];
    if (!cat || !cat.modes.includes(mode) || !cat.items.some((i) => i.id === itemId) || typeof correct !== 'boolean') {
      throw new HttpError(400, 'Resposta inválida');
    }
    const key = statKey(mode, category, itemId);
    const stat = updateStat((await store.getStat(req.user.id, key)) ?? undefined, correct);
    const time = Number.isFinite(ms) ? Math.max(0, Math.min(Math.round(ms), 600000)) : null;
    await store.recordAnswer(req.user.id, key, stat, correct, time);
    res.json({ key, stat });
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Não encontrado' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  });

  return app;
}

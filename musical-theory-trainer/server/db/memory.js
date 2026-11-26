/** In-memory store with the same interface as the PostgreSQL store (local dev and tests). */
export function createMemoryStore() {
  const users = [];
  const sessions = new Map(); // token_hash -> { userId, expiresAt }
  const stats = new Map(); // `${userId}|${key}` -> stat
  const answers = [];

  return {
    kind: 'memory',
    async init() {},
    async close() {},

    async createUser(username, passHash) {
      if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return null;
      const u = { id: users.length + 1, username, pass_hash: passHash };
      users.push(u);
      return { id: u.id, username: u.username };
    },
    async findUser(username) {
      return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
    },

    async createSession(tokenHash, userId, expiresAt) {
      sessions.set(tokenHash, { userId, expiresAt });
    },
    async sessionUser(tokenHash) {
      const s = sessions.get(tokenHash);
      if (!s || s.expiresAt < new Date()) return null;
      const u = users.find((x) => x.id === s.userId);
      return u ? { id: u.id, username: u.username } : null;
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },

    async getStats(userId) {
      const out = {};
      for (const [k, v] of stats) {
        const [id, key] = k.split('|');
        if (Number(id) === userId) out[key] = { ...v };
      }
      return out;
    },
    async getStat(userId, key) {
      return stats.get(`${userId}|${key}`) ?? null;
    },
    /** Saves the new item statistics and logs the answer. */
    async recordAnswer(userId, key, stat, correct, ms) {
      stats.set(`${userId}|${key}`, { ...stat });
      answers.push({ userId, key, correct, ms, at: new Date() });
    },
    async activity(userId, days = 14) {
      const since = Date.now() - days * 864e5;
      const byDay = new Map();
      for (const a of answers) {
        if (a.userId !== userId || a.at.getTime() < since) continue;
        const d = a.at.toISOString().slice(0, 10);
        const row = byDay.get(d) ?? { day: d, answers: 0, correct: 0 };
        row.answers++;
        row.correct += a.correct ? 1 : 0;
        byDay.set(d, row);
      }
      return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    },
  };
}

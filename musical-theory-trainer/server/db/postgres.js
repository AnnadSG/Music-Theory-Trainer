import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export function createPostgresStore({ connectionString, ssl }) {
  const pool = new pg.Pool({ connectionString, ssl: ssl ? { rejectUnauthorized: false } : false });
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0] ?? null;

  return {
    kind: 'postgres',

    /** Runs every migration in order; they are idempotent (IF NOT EXISTS). */
    async init() {
      const files = (await fs.readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
      for (const f of files) await pool.query(await fs.readFile(path.join(MIGRATIONS, f), 'utf8'));
    },
    async close() {
      await pool.end();
    },

    async createUser(username, passHash) {
      const existing = await one('SELECT id FROM users WHERE lower(username) = lower($1)', [username]);
      if (existing) return null;
      return one('INSERT INTO users (username, pass_hash) VALUES ($1, $2) RETURNING id, username', [username, passHash]);
    },
    async findUser(username) {
      return one('SELECT id, username, pass_hash FROM users WHERE lower(username) = lower($1)', [username]);
    },

    async createSession(tokenHash, userId, expiresAt) {
      await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt]);
    },
    async sessionUser(tokenHash) {
      return one(
        `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [tokenHash],
      );
    },
    async deleteSession(tokenHash) {
      await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    },

    async getStats(userId) {
      const { rows } = await pool.query('SELECT key, box, attempts, correct FROM item_stats WHERE user_id = $1', [userId]);
      return Object.fromEntries(rows.map(({ key, ...s }) => [key, s]));
    },
    async getStat(userId, key) {
      return one('SELECT box, attempts, correct FROM item_stats WHERE user_id = $1 AND key = $2', [userId, key]);
    },
    async recordAnswer(userId, key, stat, correct, ms) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO item_stats (user_id, key, box, attempts, correct) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, key) DO UPDATE
           SET box = EXCLUDED.box, attempts = EXCLUDED.attempts, correct = EXCLUDED.correct, updated_at = now()`,
          [userId, key, stat.box, stat.attempts, stat.correct],
        );
        await client.query('INSERT INTO answers (user_id, key, correct, ms) VALUES ($1, $2, $3, $4)', [userId, key, correct, ms]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    async activity(userId, days = 14) {
      const { rows } = await pool.query(
        `SELECT to_char(date_trunc('day', answered_at), 'YYYY-MM-DD') AS day,
                count(*)::int AS answers, count(*) FILTER (WHERE correct)::int AS correct
         FROM answers WHERE user_id = $1 AND answered_at > now() - make_interval(days => $2)
         GROUP BY 1 ORDER BY 1`,
        [userId, days],
      );
      return rows;
    },
  };
}

import { config } from '../config.js';
import { createMemoryStore } from './memory.js';
import { createPostgresStore } from './postgres.js';

/** PostgreSQL when DATABASE_URL is set, otherwise in memory (data lost on restart). */
export async function createStore() {
  const store = config.databaseUrl
    ? createPostgresStore({ connectionString: config.databaseUrl, ssl: config.databaseSsl })
    : createMemoryStore();
  await store.init();
  return store;
}

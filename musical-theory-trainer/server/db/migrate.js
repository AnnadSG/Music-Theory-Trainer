// Usage: DATABASE_URL=postgres://... npm run migrate
import { config } from '../config.js';
import { createPostgresStore } from './postgres.js';

if (!config.databaseUrl) {
  console.error('DATABASE_URL não está definido.');
  process.exit(1);
}
const store = createPostgresStore({ connectionString: config.databaseUrl, ssl: config.databaseSsl });
await store.init();
await store.close();
console.log('Migrações aplicadas.');

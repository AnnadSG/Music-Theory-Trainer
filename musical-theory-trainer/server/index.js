import { config } from './config.js';
import { createStore } from './db/index.js';
import { createApp } from './app.js';

const store = await createStore();
const server = createApp({ store, sessionDays: config.sessionDays }).listen(config.port, () => {
  console.log(`Musical Theory Trainer em http://localhost:${config.port} (armazenamento: ${store.kind})`);
});

const shutdown = async () => {
  server.close();
  await store.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

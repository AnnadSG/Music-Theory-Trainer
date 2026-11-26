export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  // Managed Postgres reached over the internet usually needs TLS; Render's internal URL does not.
  databaseSsl: process.env.DATABASE_SSL === 'true',
  sessionDays: Number(process.env.SESSION_DAYS ?? 30),
};

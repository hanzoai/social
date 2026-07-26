import { PostgresStore } from '@mastra/pg';

// DATABASE_URL is Prisma's, and since the SQLite migration it is a `file:` URL.
// Mastra needs a Postgres connection string, so it gets its own variable rather
// than sharing one that now means two different things.
//
// Fallback keeps deployments whose DATABASE_URL is still Postgres working
// unchanged; a `file:` URL is never handed to PostgresStore.
const databaseUrl = process.env.DATABASE_URL ?? '';
const connectionString =
  process.env.MASTRA_DATABASE_URL ||
  (databaseUrl.startsWith('postgres') ? databaseUrl : '');

export const pStore = connectionString
  ? new PostgresStore({ id: 'social-store', connectionString })
  : null;

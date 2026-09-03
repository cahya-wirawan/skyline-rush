import { IDatabase } from './database.interface';
import { InMemoryDatabase } from './in-memory-db';
import { PostgresDatabase } from './postgres-db';

let globalDb: IDatabase | null = null;

export function getDatabase(): IDatabase {
  if (!globalDb) {
    if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
      try {
        globalDb = new PostgresDatabase();
      } catch (err) {
        console.warn('[DB] Failed to initialize Postgres database, falling back to InMemoryDatabase:', err);
        globalDb = new InMemoryDatabase();
      }
    } else {
      globalDb = new InMemoryDatabase();
    }
  }
  return globalDb;
}

export function setDatabase(db: IDatabase): void {
  globalDb = db;
}

export * from './database.interface';
export * from './in-memory-db';
export * from './postgres-db';
export * from './migrate';

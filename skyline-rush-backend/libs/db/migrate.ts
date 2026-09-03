import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export async function runMigrations(connectionString?: string): Promise<void> {
  const url = connectionString || process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/skyline_rush';
  console.log(`[DB Migrate] Connecting to PostgreSQL at: ${url.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new Pool({ connectionString: url });
  
  try {
    const schemaPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log(`[DB Migrate] Applying initial schema migration from ${schemaPath}...`);
    
    await pool.query(sql);
    console.log('[DB Migrate] Schema migration successfully applied.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch(err => {
    console.error('[DB Migrate] Migration failed:', err);
    process.exit(1);
  });
}

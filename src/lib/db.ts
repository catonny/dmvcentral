
import { Pool } from 'pg';

// This check ensures that the connection pool is created only once in a serverless environment.
const globalForDb = global as unknown as { dbPool: Pool };

if (!globalForDb.dbPool) {
  if (!process.env.SUPABASE_POSTGRES_URL) {
    throw new Error('Database connection string is not set. Please set SUPABASE_POSTGRES_URL in your .env file.');
  }
  globalForDb.dbPool = new Pool({
    connectionString: process.env.SUPABASE_POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

export const db: Pool = globalForDb.dbPool;

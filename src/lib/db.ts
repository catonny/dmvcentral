
import { Pool } from 'pg';

// This check ensures that the connection pool is created only once.
if (!global.dbPool) {
  if (!process.env.SUPABASE_POSTGRES_URL) {
    throw new Error('Database connection string is not set. Please set SUPABASE_POSTGRES_URL in your .env file.');
  }
  (global as any).dbPool = new Pool({
    connectionString: process.env.SUPABASE_POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

export const db: Pool = (global as any).dbPool;

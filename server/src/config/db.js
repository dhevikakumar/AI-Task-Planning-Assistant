import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const poolConfig = {};

if (env.databaseUrl) {
  poolConfig.connectionString = env.databaseUrl;
}

export const pool = new Pool(poolConfig);

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

export async function connectDatabase() {
  if (!env.databaseUrl) {
    console.warn('DATABASE_URL is not configured. Database features will be unavailable until it is set.');
    return false;
  }

  const client = await pool.connect();

  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL connection established');
    return true;
  } finally {
    client.release();
  }
}

export async function queryDatabase(text, params = []) {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  return pool.query(text, params);
}

export async function ensureDatabaseSchema() {
  if (!env.databaseUrl) {
    return false;
  }

  await queryDatabase(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await queryDatabase(`
    CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);
  `);

  // Keep the users table intact while adding the task-owned data for Stage 2.
  await queryDatabase(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      priority VARCHAR(10) NOT NULL DEFAULT 'medium',
      category VARCHAR(100) NOT NULL DEFAULT '',
      estimated_duration INTEGER,
      due_date DATE,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT tasks_status_check CHECK (status IN ('pending', 'in_progress', 'completed')),
      CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'medium', 'high'))
    );
  `);

  await queryDatabase(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS estimated_duration INTEGER;
  `);

  await queryDatabase(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id
    ON tasks (user_id);
  `);

  await queryDatabase(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date
    ON tasks (user_id, due_date);
  `);

  return true;
}

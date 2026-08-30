import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';

/** Walk up from a starting dir looking for the workspace-root `.env`. */
function findEnvFile(start: string): string | undefined {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

const envPath = findEnvFile(process.cwd()) ?? findEnvFile(__dirname);
loadDotenv(envPath ? { path: envPath } : {});

export const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

export const MIGRATIONS_DIR = resolve(__dirname, '..', 'migrations');

export function createPool(): Pool {
 return new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
}

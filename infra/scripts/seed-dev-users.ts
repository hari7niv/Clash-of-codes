import bcrypt from 'bcryptjs';
import { createPool } from './db';

const DEV_PASSWORD = 'password123';

const USERS = [
  { username: 'alice', email: 'alice@clash.dev', rating: 1500 },
  { username: 'bob', email: 'bob@clash.dev', rating: 1520 },
  { username: 'carol', email: 'carol@clash.dev', rating: 1480 },
  { username: 'dave', email: 'dave@clash.dev', rating: 1650 },
];

async function main(): Promise<void> {
  const pool = createPool();
  try {
    const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
    for (const u of USERS) {
      await pool.query(
        `INSERT INTO users (username, email, password_hash, rating)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING`,
        [u.username, u.email, passwordHash, u.rating],
      );
      console.log(`seeded user "${u.username}" (password: ${DEV_PASSWORD})`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seeding users failed:', err);
  process.exit(1);
});

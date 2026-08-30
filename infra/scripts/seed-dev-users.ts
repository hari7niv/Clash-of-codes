import bcrypt from 'bcryptjs';
import { createPool } from './db';

const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'password123';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);

interface SeedUser {
  username: string;
  email: string;
  rating: number;
}

const USERS: readonly SeedUser[] = [
  {
    username: 'alice',
    email: 'alice@clash.dev',
    rating: 1500,
  },
  {
    username: 'bob',
    email: 'bob@clash.dev',
    rating: 1520,
  },
  {
    username: 'carol',
    email: 'carol@clash.dev',
    rating: 1480,
  },
  {
    username: 'dave',
    email: 'dave@clash.dev',
    rating: 1650,
  },
];

function validateSeedConfiguration(): void {
  if (!Number.isInteger(BCRYPT_ROUNDS) || BCRYPT_ROUNDS < 10 || BCRYPT_ROUNDS > 15) {
    throw new Error(
      `Invalid BCRYPT_ROUNDS: ${BCRYPT_ROUNDS}. ` +
        'Expected an integer between 10 and 15.',
    );
  }

  if (SEED_PASSWORD.length < 8) {
    throw new Error('SEED_USER_PASSWORD must contain at least 8 characters.');
  }
}

function validateUsers(users: readonly SeedUser[]): void {
  const usernames = new Set<string>();
  const emails = new Set<string>();

  for (const user of users) {
    const username = user.username.trim().toLowerCase();
    const email = user.email.trim().toLowerCase();

    if (!username) {
      throw new Error('Seed user username cannot be empty.');
    }

    if (!email) {
      throw new Error(`Seed user "${username}" has an empty email.`);
    }

    if (user.rating < 0) {
      throw new Error(
        `Seed user "${username}" has an invalid rating: ${user.rating}.`,
      );
    }

    if (usernames.has(username)) {
      throw new Error(`Duplicate seed username: "${username}".`);
    }

    if (emails.has(email)) {
      throw new Error(`Duplicate seed email: "${email}".`);
    }

    usernames.add(username);
    emails.add(email);
  }
}

async function main(): Promise<void> {
  validateSeedConfiguration();
  validateUsers(USERS);

  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(
      SEED_PASSWORD,
      BCRYPT_ROUNDS,
    );

    for (const user of USERS) {
      const username = user.username.trim().toLowerCase();
      const email = user.email.trim().toLowerCase();

      /**
       * Seed users are identified by username.
       *
       * If the user already exists, update the deterministic seed fields.
       * This makes the script safely repeatable while keeping development
       * data consistent.
       */
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO users (
            username,
            email,
            password_hash,
            rating
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (username)
          DO UPDATE SET
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            rating = EXCLUDED.rating
          RETURNING id
        `,
        [
          username,
          email,
          passwordHash,
          user.rating,
        ],
      );

      if (result.rowCount !== 1) {
        throw new Error(
          `Failed to seed user "${username}".`,
        );
      }

      console.log(`seeded user "${username}"`);
    }

    await client.query('COMMIT');

    console.log(
      `\nSuccessfully seeded ${USERS.length} user(s).`,
    );
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('\nUser seeding failed. Transaction rolled back.');

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Seeding users failed:',
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
});
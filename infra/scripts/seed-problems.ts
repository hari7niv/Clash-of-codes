import { createPool } from './db';

interface SeedTest {
  input: string;
  expected: string;
  isSample: boolean;
}

interface SeedProblem {
  slug: string;
  title: string;
  statement: string;
  difficulty: 'easy' | 'medium' | 'hard';
  rating: number;
  timeLimitMs: number;
  memoryLimitKb: number;
  tags: string[];
  tests: SeedTest[];
}

const PROBLEMS: SeedProblem[] = [
  {
    slug: 'a-plus-b',
    title: 'A + B',
    statement:
      'Read two integers `a` and `b` on a single line separated by a space, and print their sum.',
    difficulty: 'easy',
    rating: 800,
    timeLimitMs: 2000,
    memoryLimitKb: 262144,
    tags: ['math', 'implementation'],
    tests: [
      { input: '1 2\n', expected: '3', isSample: true },
      { input: '-5 5\n', expected: '0', isSample: true },
      { input: '1000000 2000000\n', expected: '3000000', isSample: false },
      { input: '0 0\n', expected: '0', isSample: false },
      { input: '-100 -250\n', expected: '-350', isSample: false },
    ],
  },
  {
    slug: 'sum-of-array',
    title: 'Sum of an Array',
    statement:
      'The first line contains an integer `n`. The second line contains `n` space-separated integers. Print their sum.',
    difficulty: 'easy',
    rating: 1000,
    timeLimitMs: 2000,
    memoryLimitKb: 262144,
    tags: ['arrays', 'implementation'],
    tests: [
      { input: '3\n1 2 3\n', expected: '6', isSample: true },
      { input: '1\n5\n', expected: '5', isSample: false },
      { input: '5\n10 20 30 40 50\n', expected: '150', isSample: false },
      { input: '4\n-1 -2 -3 -4\n', expected: '-10', isSample: false },
    ],
  },
  {
    slug: 'reverse-string',
    title: 'Reverse a String',
    statement: 'Read a single line containing a string `s` and print it reversed.',
    difficulty: 'easy',
    rating: 900,
    timeLimitMs: 2000,
    memoryLimitKb: 262144,
    tags: ['strings', 'implementation'],
    tests: [
      { input: 'hello\n', expected: 'olleh', isSample: true },
      { input: 'abc\n', expected: 'cba', isSample: false },
      { input: 'racecar\n', expected: 'racecar', isSample: false },
    ],
  },
];

async function main(): Promise<void> {
  const pool = createPool();
  const client = await pool.connect();
  try {
    for (const p of PROBLEMS) {
      await client.query('BEGIN');
      try {
        const res = await client.query<{ id: string }>(
          `INSERT INTO problems (slug, title, statement, difficulty, rating, time_limit_ms, memory_limit_kb, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (slug) DO UPDATE SET
             title = EXCLUDED.title,
             statement = EXCLUDED.statement,
             difficulty = EXCLUDED.difficulty,
             rating = EXCLUDED.rating,
             time_limit_ms = EXCLUDED.time_limit_ms,
             memory_limit_kb = EXCLUDED.memory_limit_kb,
             tags = EXCLUDED.tags
           RETURNING id`,
          [p.slug, p.title, p.statement, p.difficulty, p.rating, p.timeLimitMs, p.memoryLimitKb, p.tags],
        );
        const problemId = res.rows[0].id;

        // Rewrite test cases so re-seeding stays idempotent.
        await client.query('DELETE FROM test_cases WHERE problem_id = $1', [problemId]);
        let ordinal = 0;
        for (const t of p.tests) {
          await client.query(
            `INSERT INTO test_cases (problem_id, input, expected_output, is_sample, ordinal)
             VALUES ($1, $2, $3, $4, $5)`,
            [problemId, t.input, t.expected, t.isSample, ordinal],
          );
          ordinal += 1;
        }
        await client.query('COMMIT');
        console.log(`seeded problem "${p.slug}" (${p.tests.length} tests)`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seeding problems failed:', err);
  process.exit(1);
});

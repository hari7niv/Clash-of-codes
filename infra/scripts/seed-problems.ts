import { createPool } from './db';

type Difficulty = 'easy' | 'medium' | 'hard';

interface SeedTest {
  input: string;
  expected: string;
  isSample: boolean;
}

interface SeedProblem {
  slug: string;
  title: string;
  statement: string;
  difficulty: Difficulty;
  rating: number;
  timeLimitMs: number;
  memoryLimitKb: number;
  tags: readonly string[];
  tests: readonly SeedTest[];
}

const PROBLEMS: readonly SeedProblem[] = [
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
      {
        input: '1 2\n',
        expected: '3',
        isSample: true,
      },
      {
        input: '-5 5\n',
        expected: '0',
        isSample: true,
      },
      {
        input: '1000000 2000000\n',
        expected: '3000000',
        isSample: false,
      },
      {
        input: '0 0\n',
        expected: '0',
        isSample: false,
      },
      {
        input: '-100 -250\n',
        expected: '-350',
        isSample: false,
      },
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
      {
        input: '3\n1 2 3\n',
        expected: '6',
        isSample: true,
      },
      {
        input: '1\n5\n',
        expected: '5',
        isSample: false,
      },
      {
        input: '5\n10 20 30 40 50\n',
        expected: '150',
        isSample: false,
      },
      {
        input: '4\n-1 -2 -3 -4\n',
        expected: '-10',
        isSample: false,
      },
    ],
  },

  {
    slug: 'reverse-string',
    title: 'Reverse a String',
    statement:
      'Read a single line containing a string `s` and print it reversed.',
    difficulty: 'easy',
    rating: 900,
    timeLimitMs: 2000,
    memoryLimitKb: 262144,
    tags: ['strings', 'implementation'],
    tests: [
      {
        input: 'hello\n',
        expected: 'olleh',
        isSample: true,
      },
      {
        input: 'abc\n',
        expected: 'cba',
        isSample: false,
      },
      {
        input: 'racecar\n',
        expected: 'racecar',
        isSample: false,
      },
    ],
  },
];

function validateProblemSeedData(
  problems: readonly SeedProblem[],
): void {
  if (problems.length === 0) {
    throw new Error('No problems defined in seed data.');
  }

  const slugs = new Set<string>();

  for (const problem of problems) {
    const slug = problem.slug.trim();

    if (!slug) {
      throw new Error('Problem slug cannot be empty.');
    }

    if (slugs.has(slug)) {
      throw new Error(`Duplicate problem slug: "${slug}".`);
    }

    slugs.add(slug);

    if (!problem.title.trim()) {
      throw new Error(
        `Problem "${slug}" has an empty title.`,
      );
    }

    if (!problem.statement.trim()) {
      throw new Error(
        `Problem "${slug}" has an empty statement.`,
      );
    }

    if (!['easy', 'medium', 'hard'].includes(problem.difficulty)) {
      throw new Error(
        `Problem "${slug}" has invalid difficulty: ${problem.difficulty}.`,
      );
    }

    if (!Number.isInteger(problem.rating) || problem.rating < 0) {
      throw new Error(
        `Problem "${slug}" has invalid rating: ${problem.rating}.`,
      );
    }

    if (
      !Number.isInteger(problem.timeLimitMs) ||
      problem.timeLimitMs <= 0
    ) {
      throw new Error(
        `Problem "${slug}" has invalid time limit: ${problem.timeLimitMs}.`,
      );
    }

    if (
      !Number.isInteger(problem.memoryLimitKb) ||
      problem.memoryLimitKb <= 0
    ) {
      throw new Error(
        `Problem "${slug}" has invalid memory limit: ${problem.memoryLimitKb}.`,
      );
    }

    if (problem.tags.length === 0) {
      throw new Error(
        `Problem "${slug}" must have at least one tag.`,
      );
    }

    const normalizedTags = problem.tags.map((tag) =>
      tag.trim().toLowerCase(),
    );

    if (normalizedTags.some((tag) => !tag)) {
      throw new Error(
        `Problem "${slug}" contains an empty tag.`,
      );
    }

    if (new Set(normalizedTags).size !== normalizedTags.length) {
      throw new Error(
        `Problem "${slug}" contains duplicate tags.`,
      );
    }

    if (problem.tests.length === 0) {
      throw new Error(
        `Problem "${slug}" must contain at least one test case.`,
      );
    }

    let sampleCount = 0;

    for (const [index, test] of problem.tests.entries()) {
      if (test.input === undefined || test.expected === undefined) {
        throw new Error(
          `Problem "${slug}" test ${index} has invalid input/output.`,
        );
      }

      if (test.isSample) {
        sampleCount += 1;
      }
    }

    if (sampleCount === 0) {
      throw new Error(
        `Problem "${slug}" must contain at least one sample test.`,
      );
    }
  }
}

async function seedProblem(
  client: import('pg').PoolClient,
  problem: SeedProblem,
): Promise<void> {
  const slug = problem.slug.trim();

  const tags = [...new Set(
    problem.tags.map((tag) => tag.trim().toLowerCase()),
  )];

  const result = await client.query<{ id: string }>(
    `
      INSERT INTO problems (
        slug,
        title,
        statement,
        difficulty,
        rating,
        time_limit_ms,
        memory_limit_kb,
        tags
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (slug)
      DO UPDATE SET
        title = EXCLUDED.title,
        statement = EXCLUDED.statement,
        difficulty = EXCLUDED.difficulty,
        rating = EXCLUDED.rating,
        time_limit_ms = EXCLUDED.time_limit_ms,
        memory_limit_kb = EXCLUDED.memory_limit_kb,
        tags = EXCLUDED.tags
      RETURNING id
    `,
    [
      slug,
      problem.title.trim(),
      problem.statement.trim(),
      problem.difficulty,
      problem.rating,
      problem.timeLimitMs,
      problem.memoryLimitKb,
      tags,
    ],
  );

  if (result.rowCount !== 1) {
    throw new Error(
      `Failed to insert/update problem "${slug}".`,
    );
  }

  const problemId = result.rows[0].id;

  /**
   * Test cases are treated as seed-owned data.
   *
   * Delete and recreate them so that changes to the seed definition
   * are reflected exactly in the database.
   *
   * This is safe because the caller wraps all problems in one transaction.
   */
  await client.query(
    `
      DELETE FROM test_cases
      WHERE problem_id = $1
    `,
    [problemId],
  );

  for (const [ordinal, test] of problem.tests.entries()) {
    await client.query(
      `
        INSERT INTO test_cases (
          problem_id,
          input,
          expected_output,
          is_sample,
          ordinal
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        problemId,
        test.input,
        test.expected,
        test.isSample,
        ordinal,
      ],
    );
  }

  console.log(
    `seeded problem "${slug}" (${problem.tests.length} tests)`,
  );
}

async function main(): Promise<void> {
  validateProblemSeedData(PROBLEMS);

  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const problem of PROBLEMS) {
      await seedProblem(client, problem);
    }

    await client.query('COMMIT');

    console.log(
      `\nSuccessfully seeded ${PROBLEMS.length} problem(s).`,
    );
  } catch (error) {
    await client.query('ROLLBACK');

    console.error(
      '\nProblem seeding failed. Transaction rolled back.',
    );

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Seeding problems failed:',
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
});
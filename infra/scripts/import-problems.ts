import { createPool } from './db';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  const problemsDir = path.resolve(__dirname, '../../extracted_problems');
  if (!fs.existsSync(problemsDir)) {
    console.error('Extracted problems directory not found:', problemsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(problemsDir).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} problem JSON files.`);

  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const file of files) {
      const filePath = path.join(problemsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      const slug = data.slug;
      const title = data.title;
      const statement = data.statement;
      const difficulty = data.difficulty.toLowerCase();
      const tags = data.tags || [];
      const examples = JSON.stringify(data.public_tests || []);
      const constraints = `{${(Array.isArray(data.constraints) ? data.constraints : [data.constraints]).map((c: string) => `"${c.replace(/"/g, '\\"')}"`).join(',')}}`;
      const starterCode = JSON.stringify(data.languages || {});

      // Upsert problem
      const res = await client.query(
        `
        INSERT INTO problems (
          slug, title, statement, difficulty,
          rating, time_limit_ms, memory_limit_kb, tags, is_draft,
          examples, constraints, starter_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          statement = EXCLUDED.statement,
          difficulty = EXCLUDED.difficulty,
          tags = EXCLUDED.tags,
          examples = EXCLUDED.examples,
          constraints = EXCLUDED.constraints,
          starter_code = EXCLUDED.starter_code
        RETURNING id
        `,
        [
          slug, title, statement, difficulty,
          1200, 2000, 262144, tags, false,
          examples, constraints, starterCode
        ]
      );

      const problemId = res.rows[0].id;

      // Delete old tests
      await client.query(`DELETE FROM test_cases WHERE problem_id = $1`, [problemId]);

      // Insert public tests (as sample)
      let ordinal = 0;
      if (data.public_tests) {
        for (const test of data.public_tests) {
          const expectedOutput = Array.isArray(test.expected_output) ? JSON.stringify(test.expected_output) : 
            (typeof test.expected_output === 'object' ? JSON.stringify(test.expected_output) : String(test.expected_output));
          
          await client.query(
            `INSERT INTO test_cases (problem_id, input, expected_output, is_sample, ordinal) VALUES ($1, $2, $3, $4, $5)`,
            [problemId, JSON.stringify(test.input), expectedOutput, true, ordinal++]
          );
        }
      }

      // Insert hidden tests
      if (data.hidden_tests) {
        for (const test of data.hidden_tests) {
          const expectedOutput = Array.isArray(test.expected_output) ? JSON.stringify(test.expected_output) : 
            (typeof test.expected_output === 'object' ? JSON.stringify(test.expected_output) : String(test.expected_output));
            
          await client.query(
            `INSERT INTO test_cases (problem_id, input, expected_output, is_sample, ordinal) VALUES ($1, $2, $3, $4, $5)`,
            [problemId, JSON.stringify(test.input), expectedOutput, false, ordinal++]
          );
        }
      }

      console.log(`Imported problem: ${slug}`);
    }

    await client.query('COMMIT');
    console.log(`Successfully imported ${files.length} problems.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

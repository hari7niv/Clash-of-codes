/**
 * Test Script: Judge Worker → Mock Judge0 Pipeline
 * 
 * This creates a test job in BullMQ to verify the complete judge flow works:
 * 1. Add job to judge_submissions queue
 * 2. Judge worker picks it up
 * 3. Worker calls Mock Judge0 (port 2359)
 * 4. Verdict is returned
 * 5. Job completes
 */

const { Queue } = require('bullmq');
const { Pool } = require('pg');

async function testJudgeFlow() {
  console.log('🧪 Testing Judge Flow...\n');

  // Connect to database
  const pool = new Pool({
    connectionString: 'postgres://clash:clash@localhost:5440/clashofcode'
  });

  // Create a test submission in database
  const submissionResult = await pool.query(`
    INSERT INTO submissions (
      user_id,
      problem_id,
      source_code,
      language,
      status,
      submitted_at
    ) VALUES (
      '92ca41f8-5c8f-4bf5-8850-afe5ee0285c1',
      '49656f5c-ea4c-4438-9078-71b1ddec7e30',
      'a, b = map(int, input().split())\nprint(a + b)',
      'python',
      'pending',
      NOW()
    ) RETURNING id
  `);

  const submissionId = submissionResult.rows[0].id;
  console.log(`✅ Created test submission: ${submissionId}`);

  // Get problem test cases
  const testCasesResult = await pool.query(`
    SELECT input, expected_output, is_sample
    FROM test_cases
    WHERE problem_id = '49656f5c-ea4c-4438-9078-71b1ddec7e30'
    ORDER BY is_sample DESC, id
  `);

  console.log(`✅ Found ${testCasesResult.rows.length} test cases`);

  // Connect to BullMQ
  const queue = new Queue('judge_submissions', {
    connection: {
      url: 'redis://localhost:6379',
      maxRetriesPerRequest: null
    }
  });

  console.log('✅ Connected to BullMQ queue: judge_submissions\n');

  // Add job
  const job = await queue.add('judge', {
    submissionId,
    problemId: '49656f5c-ea4c-4438-9078-71b1ddec7e30',
    sourceCode: 'a, b = map(int, input().split())\nprint(a + b)',
    language: 'python',
    testCases: testCasesResult.rows,
    userId: '92ca41f8-5c8f-4bf5-8850-afe5ee0285c1'
  });

  console.log(`📤 Added job to queue: ${job.id}\n`);
  console.log('⏳ Waiting for worker to process...\n');

  // Wait for completion
  await job.waitUntilFinished(queue.events);

  console.log('✅ Job completed!\n');

  // Check result
  const result = await job.returnvalue;
  console.log('📊 Result:', JSON.stringify(result, null, 2));

  // Check database
  const updatedSubmission = await pool.query(`
    SELECT status, verdict, runtime_ms, passed_tests, total_tests
    FROM submissions
    WHERE id = $1
  `, [submissionId]);

  console.log('\n📊 Database record:', updatedSubmission.rows[0]);

  await queue.close();
  await pool.end();
  
  console.log('\n✅ Test complete!');
}

testJudgeFlow().catch(console.error);

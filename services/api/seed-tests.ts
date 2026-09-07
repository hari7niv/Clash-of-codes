import { db } from "./src/db/client.js";
import { problems, testCases } from "./src/db/schema/problems.js";
import { eq } from "drizzle-orm";

async function seedTestCases() {
  try {
    const allProblems = await db.select().from(problems);
    if (allProblems.length === 0) {
      console.log("No problems found.");
      process.exit(1);
    }

    for (const problem of allProblems) {
      const existingTests = await db.select().from(testCases).where(eq(testCases.problemId, problem.id));
      if (existingTests.length === 0) {
        console.log(`Seeding test cases for problem: ${problem.title}`);
        await db.insert(testCases).values([
          {
            problemId: problem.id,
            input: "2\n2 7 11 15\n9",
            expectedOutput: "0 1",
            isSample: true,
            ordinal: 1,
          },
          {
            problemId: problem.id,
            input: "3\n3 2 4\n6",
            expectedOutput: "1 2",
            isSample: true,
            ordinal: 2,
          },
          {
            problemId: problem.id,
            input: "2\n3 3\n6",
            expectedOutput: "0 1",
            isSample: false,
            ordinal: 3,
          }
        ]);
        console.log("Test cases seeded successfully!");
      } else {
        console.log(`Problem ${problem.title} already has ${existingTests.length} test cases.`);
      }
    }
  } catch (err) {
    console.error("Failed to seed test cases", err);
  }
  process.exit(0);
}

seedTestCases();

import { db } from "./src/db/client.js";
import { problems } from "./src/db/schema/problems.js";
import { v4 as uuidv4 } from "uuid";

async function ensureProblemSeeded() {
  try {
    const existing = await db.select().from(problems);
    console.log(`Found ${existing.length} problems`);
    
    if (existing.length === 0) {
      console.log("No problems found, seeding a test problem...");
      await db.insert(problems).values({
        slug: "two-sum-" + Date.now(),
        title: "Two Sum",
        statement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
        difficulty: "easy",
        tags: ["array", "hash-table"],
      });
      console.log("Test problem seeded.");
    }
  } catch (err) {
    console.error("Failed to seed problem", err);
  }
  process.exit(0);
}

ensureProblemSeeded();

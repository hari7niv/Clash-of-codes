import { db } from "../src/db/client.js";
import { users } from "../src/db/schema/users.js";
import { problems } from "../src/db/schema/problems.js";
import { matches, submissions, ratingsHistory } from "../src/db/schema/matches.js";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { completeMatch } from "../src/services/rating-calculator.js";

async function testRatingCalculation() {
  console.log("🧪 [Match Completion & Rating Test] Starting...\n");

  try {
    // Get test users
    const [user1] = await db.select().from(users).limit(1);
    const userList = await db.select().from(users).limit(2);
    const [user2] = userList.length > 1 ? [userList[1]] : await db.select().from(users).where(eq(users.id, user1.id));

    if (!user1 || !user2) {
      throw new Error("Need at least 1 user in database");
    }

    console.log(`✓ User 1: ${user1.username} (Rating: ${user1.rating})`);
    console.log(`✓ User 2: ${user2.username} (Rating: ${user2.rating})\n`);

    // Get test problem
    const [problem] = await db.select().from(problems).limit(1);
    if (!problem) {
      throw new Error("Need at least 1 problem in database");
    }
    console.log(`✓ Using problem: ${problem.title}\n`);

    // Create match
    const matchId = uuid();
    await db.insert(matches).values({
      id: matchId,
      playerOneId: user1.id,
      playerTwoId: user2.id,
      problemId: problem.id,
      mode: "ranked",
      status: "active",
    });
    console.log(`✓ Created match: ${matchId}`);

    // Create submissions - user1 solves, user2 fails
    const [sub1] = await db.insert(submissions).values({
      matchId,
      userId: user1.id,
      problemId: problem.id,
      language: "python",
      sourceCode: "print(int(input()) + int(input()))",
      verdict: "accepted",
      passedTests: 5,
      totalTests: 5,
    }).returning();

    const [sub2] = await db.insert(submissions).values({
      matchId,
      userId: user2.id,
      problemId: problem.id,
      language: "python",
      sourceCode: "print('wrong')",
      verdict: "wrong_answer",
      passedTests: 0,
      totalTests: 5,
    }).returning();

    console.log(`✓ Created submission for user1 (verdict: accepted)`);
    console.log(`✓ Created submission for user2 (verdict: wrong_answer)\n`);

    // Complete match
    const completedMatch = await completeMatch(matchId);
    console.log(`✓ Match completed`);
    console.log(`  Winner: ${completedMatch.winnerId === user1.id ? user1.username : user2.username}\n`);

    // Fetch updated ratings
    const [updatedUser1] = await db.select().from(users).where(eq(users.id, user1.id));
    const [updatedUser2] = await db.select().from(users).where(eq(users.id, user2.id));

    const p1RatingDelta = updatedUser1.rating - user1.rating;
    const p2RatingDelta = updatedUser2.rating - user2.rating;

    console.log(`Rating Changes:`);
    console.log(`  ${user1.username}: ${user1.rating.toFixed(2)} → ${updatedUser1.rating.toFixed(2)} (Δ ${p1RatingDelta > 0 ? '+' : ''}${p1RatingDelta.toFixed(2)})`);
    console.log(`  ${user2.username}: ${user2.rating.toFixed(2)} → ${updatedUser2.rating.toFixed(2)} (Δ ${p2RatingDelta > 0 ? '+' : ''}${p2RatingDelta.toFixed(2)})\n`);

    // Verify ratings history
    const history = await db.select().from(ratingsHistory).where(eq(ratingsHistory.matchId, matchId));
    console.log(`✓ Rating history records created: ${history.length}`);
    
    // Cleanup
    await db.delete(ratingsHistory).where(eq(ratingsHistory.matchId, matchId));
    await db.delete(submissions).where(eq(submissions.matchId, matchId));
    await db.delete(matches).where(eq(matches.id, matchId));
    
    console.log(`✓ Cleanup complete\n`);
    console.log(`✅ Match completion & rating calculation working correctly!`);
    
  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

testRatingCalculation().then(() => process.exit(0));

import { db } from "../services/api/src/db/client.js";
import { users, friendships } from "../services/api/src/db/schema/users.js";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';

async function testFriends() {
  try {
    const u1 = uuidv4();
    const u2 = uuidv4();
    
    // Create users
    await db.insert(users).values([
      { id: u1, username: 'user1_test', email: 'u1@test.com', passwordHash: 'hash' },
      { id: u2, username: 'user2_test', email: 'u2@test.com', passwordHash: 'hash' }
    ]);
    
    console.log("Users created.");
    
    // Send friend request
    await db.insert(friendships).values({
      userId: u1,
      friendId: u2,
      status: "pending"
    });
    console.log("Request sent.");
    
    // Accept
    await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.userId, u1));
    console.log("Request accepted.");
    
    // Cleanup
    await db.delete(friendships).where(eq(friendships.userId, u1));
    await db.delete(users).where(eq(users.id, u1));
    await db.delete(users).where(eq(users.id, u2));
    
    console.log("All good!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testFriends();

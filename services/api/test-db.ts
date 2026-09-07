import { db } from "./src/db/client.js";
import { rooms, roomMembers } from "./src/db/schema/matches.js";
import { users } from "./src/db/schema/users.js";

async function test() {
  try {
    const user = await db.insert(users).values({
      username: "testuser_" + Date.now(),
      email: "testuser_" + Date.now() + "@test.com",
      passwordHash: "hash"
    }).returning();
    console.log("User created:", user[0].id);

    const room = await db.insert(rooms).values({
      code: "T" + Date.now().toString().slice(-5),
      hostUserId: user[0].id
    }).returning();
    console.log("Room created:", room[0].id);

    const rm = await db.insert(roomMembers).values({
      roomId: room[0].id,
      userId: user[0].id,
      ready: true,
      joinedAt: new Date()
    }).returning();
    console.log("Room member created:", rm);
  } catch (err) {
    console.error("DB Error:", err);
  }
  process.exit(0);
}

test();

import { db } from "./src/db/client.js";

async function test() {
  try {
    const res = await db.execute(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'room_members'`);
    console.log("Columns:", res);
  } catch (err) {
    console.error("DB Error:", err);
  }
  process.exit(0);
}

test();

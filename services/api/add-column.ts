import { db } from "./src/db/client.js";

async function addReadyColumn() {
  try {
    await db.execute(`ALTER TABLE room_members ADD COLUMN IF NOT EXISTS ready BOOLEAN NOT NULL DEFAULT false;`);
    console.log("Column added successfully!");
  } catch (err) {
    console.error("DB Error:", err);
  }
  process.exit(0);
}

addReadyColumn();

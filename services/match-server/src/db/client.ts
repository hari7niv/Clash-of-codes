import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://clash:clash@localhost:5440/clashofcode";

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool);

export async function checkDbConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ Match Server connected to PostgreSQL (Drizzle)");
  } catch (err) {
    console.error("❌ Match Server failed to connect to PostgreSQL:", err);
    throw err;
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
  console.log("✅ Match Server database connection closed");
}

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import dotenv from "dotenv";
import * as usersSchema from "./schema/users.js";
import * as problemsSchema from "./schema/problems.js";
import * as matchesSchema from "./schema/matches.js";

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://clash:clash@localhost:5440/clashofcode";

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, {
  schema: { ...usersSchema, ...problemsSchema, ...matchesSchema }
});

export const checkDbConnection = async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log("✅ Connected to PostgreSQL (Drizzle)");
  } catch (err) {
    console.error("❌ Failed to connect to PostgreSQL:", err);
  }
};

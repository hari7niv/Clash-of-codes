import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://clash:clash@localhost:5440/clashofcode";

let db: ReturnType<typeof drizzle> | null = null;

export async function getDatabase() {
  if (!db) {
    const client = postgres(DATABASE_URL);
    db = drizzle(client);
  }
  return db;
}

export async function closeDatabase() {
  if (db) {
    // Close the underlying postgres client
    // This is typically done through the client if needed
    db = null;
  }
}

import { db } from "../index.js";
import { users } from "../schema.js";

export async function createUser(name: string) {
  const [result] = await db.insert(users).values({ name: name }).returning();
  return result;
}
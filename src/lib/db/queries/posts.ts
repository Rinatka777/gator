import { db } from "../index.js";
import { posts } from "../schema.js";

export async function createPost(
  title: string,
  url: string,
  description: string,
  publishedAt: Date,
  feedId: string
) {
  const [result] = await db
    .insert(posts)
    .values({ title, url, description, publishedAt, feedId })
    .onConflictDoNothing()
    .returning();
  return result;
}
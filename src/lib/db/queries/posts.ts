import { db } from "../index.js";
import { posts, feeds, follows } from "../schema.js";
import { desc, eq } from "drizzle-orm";

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

export async function getPostsForUser(userId: string, limit: number = 2) {
  return await db
    .select({
      title: posts.title,
      url: posts.url,
      description: posts.description,
      publishedAt: posts.publishedAt,
      feedName: feeds.name,
    })
    .from(posts)
    .innerJoin(feeds, eq(posts.feedId, feeds.id))
    .innerJoin(follows, eq(follows.feedId, feeds.id))
    .where(eq(follows.userId, userId))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}
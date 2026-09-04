import { db } from "../index.js";
import { feeds } from "../schema.js";
import { eq, sql } from "drizzle-orm";

export async function createFeed(name: string, url: string, userId: string) {
  const [result] = await db.insert(feeds).values({ name, url, userId }).returning();
  return result;
}

export async function markFeedFetched(feedId: string) {
  await db.update(feeds).set({ lastFetchedAt: new Date() }).where(eq(feeds.id, feedId));
}

export async function getNextFeedToFetch() {
  const [result] = await db
    .select()
    .from(feeds)
    .orderBy(sql`${feeds.lastFetchedAt} asc nulls first`)
    .limit(1);
  return result;
}

export async function getFeedByUrl(url:string){
  return await db.select().from(feeds).where(eq(feeds.url, url))
}


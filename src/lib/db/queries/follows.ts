import { db } from "../index.js";
import { follows, feeds } from "../schema.js";
import { eq, sql, and } from "drizzle-orm";

export async function createFollow(feedId: string, userId: string) {
  const [result] = await db.insert(follows).values({ feedId, userId }).returning();
  return result;
}

export async function getFollowsForUser(userId: string) {
  return await db
    .select({ feedName: feeds.name, feedUrl: feeds.url })
    .from(follows)
    .innerJoin(feeds, eq(follows.feedId, feeds.id))
    .where(eq(follows.userId, userId));
}

export async function getFollow(userId: string, feedId: string) {
  const [result] = await db
    .select()
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.feedId, feedId)));
  return result;
}

export async function deleteFollow(userId: string, feedId:string){
    await db.delete(follows).where(and(eq(follows.userId, userId), eq(follows.feedId, feedId)));
}
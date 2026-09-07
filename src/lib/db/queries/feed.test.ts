import { describe, it, expect, afterEach, afterAll } from "vitest";

// INTEGRATION TESTS — hit a real Postgres database. See users.test.ts for
// the full setup notes (createdb, test-config.json, running migrations).
//
// Run:
//   GATORCONFIG=./test-config.json GATOR_INTEGRATION=1 npm test

const integration = process.env.GATOR_INTEGRATION === "1";

describe.skipIf(!integration)("feed queries (integration)", () => {
  afterEach(async () => {
    // Deleting users cascades to feeds/follows/posts (all FKs are ON DELETE CASCADE).
    const { db } = await import("../index.js");
    const { users } = await import("../schema.js");
    await db.delete(users);
  });

  afterAll(async () => {
    const { conn } = await import("../index.js");
    await conn.end();
  });

  it("createFeed returns the inserted row with generated fields", async () => {
    const { createUser } = await import("./users.js");
    const { createFeed } = await import("./feed.js");

    const user = await createUser("dana");
    const feed = await createFeed("Wagslane", "https://wagslane.dev/index.xml", user.id);

    expect(feed.name).toBe("Wagslane");
    expect(feed.url).toBe("https://wagslane.dev/index.xml");
    expect(feed.userId).toBe(user.id);
    expect(feed.lastFetchedAt).toBeNull();
  });

  it("getFeedByUrl finds a feed that was created", async () => {
    const { createUser } = await import("./users.js");
    const { createFeed, getFeedByUrl } = await import("./feed.js");

    const user = await createUser("erin");
    const created = await createFeed("Boot.dev Blog", "https://boot.dev/blog", user.id);

    const found = await getFeedByUrl("https://boot.dev/blog");

    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
  });

  it("getFeedByUrl returns undefined for an unknown url", async () => {
    const { getFeedByUrl } = await import("./feed.js");

    const found = await getFeedByUrl("https://nope.example.com/rss");

    expect(found).toBeUndefined();
  });

  it("getNextFeedToFetch prefers a feed that has never been fetched", async () => {
    const { createUser } = await import("./users.js");
    const { createFeed, markFeedFetched, getNextFeedToFetch } = await import("./feed.js");

    const user = await createUser("frank");
    const fetched = await createFeed("Fetched", "https://a.example.com/rss", user.id);
    await markFeedFetched(fetched.id);
    const neverFetched = await createFeed("Never fetched", "https://b.example.com/rss", user.id);

    const next = await getNextFeedToFetch();

    expect(next!.id).toBe(neverFetched.id);
  });

  it("getFeeds returns each feed together with its creator's name", async () => {
    const { createUser } = await import("./users.js");
    const { createFeed, getFeeds } = await import("./feed.js");

    const user = await createUser("gina");
    await createFeed("Gina's Feed", "https://gina.example.com/rss", user.id);

    const feeds = await getFeeds();

    expect(feeds).toContainEqual({
      feedName: "Gina's Feed",
      feedUrl: "https://gina.example.com/rss",
      userName: "gina",
    });
  });
});

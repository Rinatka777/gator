import { describe, it, expect, afterEach, afterAll } from "vitest";

// INTEGRATION TESTS — hit a real Postgres database. See users.test.ts for
// the full setup notes (createdb, test-config.json, running migrations).
//
// Run:
//   GATORCONFIG=./test-config.json GATOR_INTEGRATION=1 npm test

const integration = process.env.GATOR_INTEGRATION === "1";

describe.skipIf(!integration)("follows queries (integration)", () => {
  afterEach(async () => {
    const { db } = await import("../index.js");
    const { users } = await import("../schema.js");
    await db.delete(users);
  });

  afterAll(async () => {
    const { conn } = await import("../index.js");
    await conn.end();
  });

  async function makeUserAndFeed(userName: string, feedName: string, feedUrl: string) {
    const { createUser } = await import("./users.js");
    const { createFeed } = await import("./feed.js");
    const user = await createUser(userName);
    const feed = await createFeed(feedName, feedUrl, user.id);
    return { user, feed };
  }

  it("createFollow creates a follow between a user and a feed", async () => {
    const { createFollow, getFollow } = await import("./follows.js");
    const { user, feed } = await makeUserAndFeed("hank", "Hank's Feed", "https://hank.example.com/rss");

    await createFollow(feed.id, user.id);

    const found = await getFollow(user.id, feed.id);
    expect(found).toBeDefined();
  });

  it("getFollow returns undefined when no follow exists", async () => {
    const { getFollow } = await import("./follows.js");
    const { user, feed } = await makeUserAndFeed("ivy", "Ivy's Feed", "https://ivy.example.com/rss");

    const found = await getFollow(user.id, feed.id);

    expect(found).toBeUndefined();
  });

  it("createFollow rejects a duplicate follow (unique constraint)", async () => {
    const { createFollow } = await import("./follows.js");
    const { user, feed } = await makeUserAndFeed("jack", "Jack's Feed", "https://jack.example.com/rss");

    await createFollow(feed.id, user.id);

    const error = await createFollow(feed.id, user.id).then(
      () => {
        throw new Error("expected duplicate follow to reject");
      },
      (err) => err
    );
    expect((error.cause as Error).message).toMatch(
      /duplicate key value violates unique constraint/
    );
  });

  it("getFollowsForUser returns the feed name and url for each follow", async () => {
    const { createFollow, getFollowsForUser } = await import("./follows.js");
    const { user, feed } = await makeUserAndFeed("kim", "Kim's Feed", "https://kim.example.com/rss");
    await createFollow(feed.id, user.id);

    const follows = await getFollowsForUser(user.id);

    expect(follows).toEqual([
      { feedName: "Kim's Feed", feedUrl: "https://kim.example.com/rss" },
    ]);
  });

  it("deleteFollow removes only the matching follow", async () => {
    const { createFollow, deleteFollow, getFollow } = await import("./follows.js");
    const { user, feed } = await makeUserAndFeed("liam", "Liam's Feed", "https://liam.example.com/rss");
    await createFollow(feed.id, user.id);

    await deleteFollow(user.id, feed.id);

    const found = await getFollow(user.id, feed.id);
    expect(found).toBeUndefined();
  });
});

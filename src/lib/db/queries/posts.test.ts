import { describe, it, expect, afterEach, afterAll } from "vitest";

// INTEGRATION TESTS — hit a real Postgres database. See users.test.ts for
// the full setup notes (createdb, test-config.json, running migrations).
//
// Run:
//   GATORCONFIG=./test-config.json GATOR_INTEGRATION=1 npm test

const integration = process.env.GATOR_INTEGRATION === "1";

describe.skipIf(!integration)("posts queries (integration)", () => {
  afterEach(async () => {
    const { db } = await import("../index.js");
    const { users } = await import("../schema.js");
    await db.delete(users);
  });

  afterAll(async () => {
    const { conn } = await import("../index.js");
    await conn.end();
  });

  it("createPost returns the inserted row", async () => {
    const { createUser } = await import("./users.js");
    const { createFeed } = await import("./feed.js");
    const { createPost } = await import("./posts.js");

    const user = await createUser("mona");
    const feed = await createFeed("Mona's Feed", "https://mona.example.com/rss", user.id);

    const post = await createPost(
      "Hello World",
      "https://mona.example.com/hello",
      "First post",
      new Date("2026-01-01T00:00:00Z"),
      feed.id
    );

    expect(post.title).toBe("Hello World");
    expect(post.feedId).toBe(feed.id);
  });

  it("createPost silently ignores a duplicate url instead of throwing", async () => {
    const { createUser } = await import("./users.js");
    const { createFeed } = await import("./feed.js");
    const { createPost } = await import("./posts.js");

    const user = await createUser("nate");
    const feed = await createFeed("Nate's Feed", "https://nate.example.com/rss", user.id);
    await createPost("Post A", "https://nate.example.com/a", "desc", new Date(), feed.id);

    const duplicate = await createPost(
      "Post A again",
      "https://nate.example.com/a",
      "desc2",
      new Date(),
      feed.id
    );

    expect(duplicate).toBeUndefined(); // onConflictDoNothing returns nothing
  });

  it("getPostsForUser only returns posts from feeds the user follows, newest first", async () => {
    const { createUser } = await import("./users.js");
    const { createFeed } = await import("./feed.js");
    const { createFollow } = await import("./follows.js");
    const { createPost, getPostsForUser } = await import("./posts.js");

    const user = await createUser("olga");
    const followedFeed = await createFeed("Followed", "https://followed.example.com/rss", user.id);
    const otherFeed = await createFeed("Other", "https://other.example.com/rss", user.id);
    await createFollow(followedFeed.id, user.id);

    await createPost("Old post", "https://followed.example.com/old", "desc", new Date("2026-01-01"), followedFeed.id);
    await createPost("New post", "https://followed.example.com/new", "desc", new Date("2026-02-01"), followedFeed.id);
    await createPost("Unfollowed post", "https://other.example.com/x", "desc", new Date("2026-03-01"), otherFeed.id);

    const result = await getPostsForUser(user.id, 10);

    expect(result.map((p) => p.title)).toEqual(["New post", "Old post"]);
  });

  it("getPostsForUser respects the limit", async () => {
    const { createUser } = await import("./users.js");
    const { createFeed } = await import("./feed.js");
    const { createFollow } = await import("./follows.js");
    const { createPost, getPostsForUser } = await import("./posts.js");

    const user = await createUser("pete");
    const feed = await createFeed("Pete's Feed", "https://pete.example.com/rss", user.id);
    await createFollow(feed.id, user.id);
    await createPost("Post 1", "https://pete.example.com/1", "d", new Date("2026-01-01"), feed.id);
    await createPost("Post 2", "https://pete.example.com/2", "d", new Date("2026-01-02"), feed.id);

    const result = await getPostsForUser(user.id, 1);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Post 2");
  });
});

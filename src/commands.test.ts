import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CommandsRegistry,
  registerCommand,
  runCommand,
  handlerLogin,
  handlerRegister,
  handlerReset,
  handlerUsers,
  handlerAddFeed,
  handlerFollow,
  handlerUnfollow,
  handlerFollowing,
  handlerFeeds,
  handlerBrowse,
  handlerAgg,
  middlewareLoggedIn,
  parseDuration,
  parsePublishedAt,
  scrapeFeeds,
} from "./commands.js";
import { readConfig, setUser } from "./config.js";
import { createUser, getUserByName, deleteAllUsers, getUsers } from "./lib/db/queries/users.js";
import { createFeed, getFeedByUrl, getNextFeedToFetch, markFeedFetched, getFeeds } from "./lib/db/queries/feed.js";
import { createFollow, deleteFollow, getFollow, getFollowsForUser } from "./lib/db/queries/follows";
import { createPost, getPostsForUser } from "./lib/db/queries/posts.js";
import { fetchFeed } from "./lib/rss.js";

// vi.mock replaces these modules everywhere they are imported, so the
// handlers never touch the real config file or the real database.
// This is the single most important testing technique for backend work:
// unit-test your logic by faking its boundaries (fs, db, network).
vi.mock("./config.js", () => ({
  readConfig: vi.fn(() => ({ dbUrl: "postgres://fake", currentUserName: undefined })),
  setUser: vi.fn(),
}));

vi.mock("./lib/db/queries/users.js", () => ({
  createUser: vi.fn(),
  getUserByName: vi.fn(),
  deleteAllUsers: vi.fn(),
  getUsers: vi.fn(),
}));

vi.mock("./lib/db/queries/feed.js", () => ({
  createFeed: vi.fn(),
  getFeedByUrl: vi.fn(),
  getNextFeedToFetch: vi.fn(),
  markFeedFetched: vi.fn(),
  getFeeds: vi.fn(),
}));

// note: commands.ts imports this one without the ".js" extension, so the
// mock specifier has to match that exactly or vitest won't intercept it.
vi.mock("./lib/db/queries/follows", () => ({
  createFollow: vi.fn(),
  deleteFollow: vi.fn(),
  getFollow: vi.fn(),
  getFollowsForUser: vi.fn(),
}));

vi.mock("./lib/db/queries/posts.js", () => ({
  createPost: vi.fn(),
  getPostsForUser: vi.fn(),
}));

vi.mock("./lib/rss.js", () => ({
  fetchFeed: vi.fn(),
}));

beforeEach(() => {
  // Reset call counts/mockResolvedValue between tests so tests stay independent.
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Registry plumbing (pure logic, no mocks needed) — written for you.
// ---------------------------------------------------------------------------
describe("registerCommand / runCommand", () => {
  it("runs a registered handler with the command name and args", async () => {
    const registry: CommandsRegistry = {};
    const handler = vi.fn(async () => {});
    registerCommand(registry, "greet", handler);

    await runCommand(registry, "greet", "alice", "bob");

    expect(handler).toHaveBeenCalledWith("greet", "alice", "bob");
  });

  it("throws for an unknown command", async () => {
    const registry: CommandsRegistry = {};

    await expect(runCommand(registry, "nope")).rejects.toThrow(
      "Unknown command: nope"
    );
  });
});

// ---------------------------------------------------------------------------
// Handlers — ONE worked example, the rest are yours (see it.todo hints).
// ---------------------------------------------------------------------------
describe("handlerLogin", () => {
  // WORKED EXAMPLE: how to control what a mocked async function returns.
  it("throws when the user does not exist", async () => {
    // vi.mocked() gives you the mock with proper TypeScript types.
    vi.mocked(getUserByName).mockResolvedValue(undefined);
    await expect(handlerLogin("login", "ghost")).rejects.toThrow(
      "User ghost does not exist"
    );
    // The guard must fire BEFORE any config write:
    expect(setUser).not.toHaveBeenCalled();
  });

  // YOUR TURN — hints in the names. Delete `.todo` and write the body.
  // Hint: call handlerLogin("login") with no username and use
  // `.rejects.toThrow(...)` like the example above.
  it("throws a usage error when no username is given", async () => {
    await expect(handlerLogin("login")).rejects.toThrow(
      "usage: login <username>"
    );
    expect(getUserByName).not.toHaveBeenCalled();
  });

  // Hint: mockResolvedValue a fake user object ({ id, name, ... }),
  // then assert setUser was called with the right username, e.g.
  // expect(setUser).toHaveBeenCalledWith(expect.anything(), "rinat")
  it("sets the current user in config when the user exists", async () => {
    vi.mocked(getUserByName).mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "rinat",
    });

    await handlerLogin("login", "rinat");

    expect(getUserByName).toHaveBeenCalledWith("rinat");
    expect(setUser).toHaveBeenCalledWith(expect.anything(), "rinat");
  });
});

describe("handlerRegister", () => {
  it("throws when the username is already taken", async () => {
    vi.mocked(getUserByName).mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "lane",
    });

    await expect(handlerRegister("register", "lane")).rejects.toThrow(
      "User lane already exists"
    );
    expect(createUser).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
  });

  it("creates the user and logs them in", async () => {
    vi.mocked(getUserByName).mockResolvedValue(undefined);
    vi.mocked(createUser).mockResolvedValue({
      id: "22222222-2222-2222-2222-222222222222",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "lane",
    });

    await handlerRegister("register", "lane");

    expect(createUser).toHaveBeenCalledWith("lane");
    expect(setUser).toHaveBeenCalledWith(expect.anything(), "lane");
  });

  it("throws a usage error when no username is given", async () => {
    await expect(handlerRegister("register")).rejects.toThrow(
      "usage: register <username>"
    );
    expect(getUserByName).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// middlewareLoggedIn — the higher-order wrapper that resolves the current
// user and only calls the wrapped handler when a real user is logged in.
// ---------------------------------------------------------------------------
describe("middlewareLoggedIn", () => {
  it("throws before calling the handler when no user is logged in", async () => {
    vi.mocked(readConfig).mockReturnValue({ dbUrl: "postgres://fake", currentUserName: undefined });
    const handler = vi.fn(async () => {});

    const wrapped = middlewareLoggedIn(handler);

    await expect(wrapped("follow", "url")).rejects.toThrow(
      "no user is currently logged in"
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("throws when the logged-in username no longer exists", async () => {
    vi.mocked(readConfig).mockReturnValue({ dbUrl: "postgres://fake", currentUserName: "ghost" });
    vi.mocked(getUserByName).mockResolvedValue(undefined);
    const handler = vi.fn(async () => {});

    const wrapped = middlewareLoggedIn(handler);

    await expect(wrapped("follow")).rejects.toThrow("user ghost does not exist");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls the handler with the resolved user when logged in", async () => {
    const user = { id: "1", createdAt: new Date(), updatedAt: new Date(), name: "rinat" };
    vi.mocked(readConfig).mockReturnValue({ dbUrl: "postgres://fake", currentUserName: "rinat" });
    vi.mocked(getUserByName).mockResolvedValue(user);
    const handler = vi.fn(async () => {});

    const wrapped = middlewareLoggedIn(handler);
    await wrapped("follow", "url1");

    expect(handler).toHaveBeenCalledWith("follow", user, "url1");
  });
});

describe("handlerReset", () => {
  it("deletes all users", async () => {
    await handlerReset("reset");

    expect(deleteAllUsers).toHaveBeenCalled();
  });
});

describe("handlerUsers", () => {
  it("marks the current user with (current)", async () => {
    vi.mocked(getUsers).mockResolvedValue([
      { id: "1", createdAt: new Date(), updatedAt: new Date(), name: "alice" },
      { id: "2", createdAt: new Date(), updatedAt: new Date(), name: "bob" },
    ]);
    vi.mocked(readConfig).mockReturnValue({ dbUrl: "postgres://fake", currentUserName: "bob" });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await handlerUsers("users");

    expect(logSpy).toHaveBeenCalledWith("* alice");
    expect(logSpy).toHaveBeenCalledWith("* bob (current)");
    logSpy.mockRestore();
  });
});

describe("handlerAddFeed", () => {
  const user = { id: "u1", createdAt: new Date(), updatedAt: new Date(), name: "rinat" };

  it("throws a usage error when name or url is missing", async () => {
    await expect(handlerAddFeed("addfeed", user, "OnlyName")).rejects.toThrow(
      "usage: addfeed <name> <url>"
    );
    expect(createFeed).not.toHaveBeenCalled();
  });

  it("creates the feed and auto-follows it for the creator", async () => {
    const feed = {
      id: "f1",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Blog",
      url: "https://x.example.com",
      userId: user.id,
      lastFetchedAt: null,
    };
    vi.mocked(createFeed).mockResolvedValue(feed);

    await handlerAddFeed("addfeed", user, "Blog", "https://x.example.com");

    expect(createFeed).toHaveBeenCalledWith("Blog", "https://x.example.com", user.id);
    expect(createFollow).toHaveBeenCalledWith(feed.id, user.id);
  });
});

describe("handlerFollow", () => {
  const user = { id: "u1", createdAt: new Date(), updatedAt: new Date(), name: "rinat" };
  const feed = {
    id: "f1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Blog",
    url: "https://x.example.com",
    userId: "someone-else",
    lastFetchedAt: null,
  };

  it("throws when the feed does not exist", async () => {
    vi.mocked(getFeedByUrl).mockResolvedValue(undefined);

    await expect(
      handlerFollow("follow", user, "https://nope.example.com")
    ).rejects.toThrow("feed https://nope.example.com does not exist");
    expect(createFollow).not.toHaveBeenCalled();
  });

  it("throws when already following", async () => {
    vi.mocked(getFeedByUrl).mockResolvedValue(feed);
    vi.mocked(getFollow).mockResolvedValue({
      id: "fl1",
      createdAt: new Date(),
      updatedAt: new Date(),
      feedId: feed.id,
      userId: user.id,
    });

    await expect(handlerFollow("follow", user, feed.url)).rejects.toThrow(
      `user ${user.name} is already following ${feed.name}`
    );
    expect(createFollow).not.toHaveBeenCalled();
  });

  it("creates the follow when not already following", async () => {
    vi.mocked(getFeedByUrl).mockResolvedValue(feed);
    vi.mocked(getFollow).mockResolvedValue(undefined);

    await handlerFollow("follow", user, feed.url);

    expect(createFollow).toHaveBeenCalledWith(feed.id, user.id);
  });
});

describe("handlerUnfollow", () => {
  const user = { id: "u1", createdAt: new Date(), updatedAt: new Date(), name: "rinat" };
  const feed = {
    id: "f1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Blog",
    url: "https://x.example.com",
    userId: "someone-else",
    lastFetchedAt: null,
  };

  it("throws when the feed does not exist", async () => {
    vi.mocked(getFeedByUrl).mockResolvedValue(undefined);

    await expect(
      handlerUnfollow("unfollow", user, "https://nope.example.com")
    ).rejects.toThrow("feed https://nope.example.com does not exist");
    expect(deleteFollow).not.toHaveBeenCalled();
  });

  it("deletes the follow", async () => {
    vi.mocked(getFeedByUrl).mockResolvedValue(feed);

    await handlerUnfollow("unfollow", user, feed.url);

    expect(deleteFollow).toHaveBeenCalledWith(user.id, feed.id);
  });
});

describe("handlerFollowing", () => {
  const user = { id: "u1", createdAt: new Date(), updatedAt: new Date(), name: "rinat" };

  it("prints each followed feed's name", async () => {
    vi.mocked(getFollowsForUser).mockResolvedValue([
      { feedName: "Blog A", feedUrl: "https://a.example.com" },
      { feedName: "Blog B", feedUrl: "https://b.example.com" },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await handlerFollowing("following", user);

    expect(logSpy).toHaveBeenCalledWith("* Blog A");
    expect(logSpy).toHaveBeenCalledWith("* Blog B");
    logSpy.mockRestore();
  });
});

describe("handlerFeeds", () => {
  it("prints each feed with its creator", async () => {
    vi.mocked(getFeeds).mockResolvedValue([
      { feedName: "Blog A", feedUrl: "https://a.example.com", userName: "alice" },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await handlerFeeds("feeds");

    expect(logSpy).toHaveBeenCalledWith(
      "* Blog A (https://a.example.com) added by alice"
    );
    logSpy.mockRestore();
  });
});

describe("handlerBrowse", () => {
  const user = { id: "u1", createdAt: new Date(), updatedAt: new Date(), name: "rinat" };

  it("defaults to a limit of 2 posts", async () => {
    vi.mocked(getPostsForUser).mockResolvedValue([]);

    await handlerBrowse("browse", user);

    expect(getPostsForUser).toHaveBeenCalledWith(user.id, 2);
  });

  it("uses a provided limit", async () => {
    vi.mocked(getPostsForUser).mockResolvedValue([]);

    await handlerBrowse("browse", user, "5");

    expect(getPostsForUser).toHaveBeenCalledWith(user.id, 5);
  });

  it("throws a usage error for a non-numeric limit", async () => {
    await expect(handlerBrowse("browse", user, "abc")).rejects.toThrow(
      "usage: browse [limit]"
    );
  });
});

describe("parseDuration", () => {
  it("parses seconds, minutes, and hours", () => {
    expect(parseDuration("30s")).toBe(30_000);
    expect(parseDuration("1m")).toBe(60_000);
    expect(parseDuration("2h")).toBe(2 * 60 * 60 * 1000);
  });

  it("throws on an invalid format", () => {
    expect(() => parseDuration("soon")).toThrow(/invalid duration/);
  });
});

describe("parsePublishedAt", () => {
  it("parses RFC 822 dates (the usual RSS pubDate format)", () => {
    const date = parsePublishedAt("Wed, 02 Oct 2002 08:00:00 EST");
    expect(date.toISOString()).toBe("2002-10-02T13:00:00.000Z");
  });

  it("parses ISO 8601 dates (some feeds use this instead)", () => {
    const date = parsePublishedAt("2003-12-13T18:30:02Z");
    expect(date.toISOString()).toBe("2003-12-13T18:30:02.000Z");
  });

  it("throws a clear error for a date it cannot parse", () => {
    expect(() => parsePublishedAt("not a date")).toThrow(
      'could not parse published date: "not a date"'
    );
  });
});

describe("scrapeFeeds", () => {
  const feed = {
    id: "f1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Blog",
    url: "https://x.example.com/rss",
    userId: "u1",
    lastFetchedAt: null,
  };

  it("does nothing when there is no feed to fetch", async () => {
    vi.mocked(getNextFeedToFetch).mockResolvedValue(undefined);

    await scrapeFeeds();

    expect(markFeedFetched).not.toHaveBeenCalled();
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  it("marks the feed fetched and saves each item as a post", async () => {
    vi.mocked(getNextFeedToFetch).mockResolvedValue(feed);
    vi.mocked(fetchFeed).mockResolvedValue({
      title: "Blog",
      link: feed.url,
      description: "desc",
      items: [
        { title: "Post 1", link: "https://x.example.com/1", description: "d1", pubDate: "2026-01-01T00:00:00Z" },
        { title: "Post 2", link: "https://x.example.com/2", description: "d2", pubDate: "2026-01-02T00:00:00Z" },
      ],
    });

    await scrapeFeeds();

    expect(markFeedFetched).toHaveBeenCalledWith(feed.id);
    expect(createPost).toHaveBeenCalledTimes(2);
    expect(createPost).toHaveBeenCalledWith(
      "Post 1",
      "https://x.example.com/1",
      "d1",
      new Date("2026-01-01T00:00:00Z"),
      feed.id
    );
  });

  it("logs and returns without throwing when fetching the feed fails", async () => {
    vi.mocked(getNextFeedToFetch).mockResolvedValue(feed);
    vi.mocked(fetchFeed).mockRejectedValue(new Error("network down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(scrapeFeeds()).resolves.toBeUndefined();

    expect(createPost).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("logs and skips an item whose published date cannot be parsed", async () => {
    vi.mocked(getNextFeedToFetch).mockResolvedValue(feed);
    vi.mocked(fetchFeed).mockResolvedValue({
      title: "Blog",
      link: feed.url,
      description: "desc",
      items: [
        { title: "Bad date", link: "https://x.example.com/bad", description: "d", pubDate: "not a date" },
        { title: "Good date", link: "https://x.example.com/good", description: "d", pubDate: "2026-01-02T00:00:00Z" },
      ],
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await scrapeFeeds();

    expect(createPost).toHaveBeenCalledTimes(1);
    expect(createPost).toHaveBeenCalledWith(
      "Good date",
      "https://x.example.com/good",
      "d",
      new Date("2026-01-02T00:00:00Z"),
      feed.id
    );
    errSpy.mockRestore();
  });

  it("logs and continues when saving one post fails", async () => {
    vi.mocked(getNextFeedToFetch).mockResolvedValue(feed);
    vi.mocked(fetchFeed).mockResolvedValue({
      title: "Blog",
      link: feed.url,
      description: "desc",
      items: [
        { title: "Bad", link: "https://x.example.com/bad", description: "d", pubDate: "2026-01-01T00:00:00Z" },
        { title: "Good", link: "https://x.example.com/good", description: "d", pubDate: "2026-01-02T00:00:00Z" },
      ],
    });
    vi.mocked(createPost)
      .mockRejectedValueOnce(new Error("duplicate"))
      .mockResolvedValueOnce(undefined as any);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await scrapeFeeds();

    expect(createPost).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });
});

describe("handlerAgg", () => {
  it("throws a usage error when no duration is given", async () => {
    await expect(handlerAgg("agg")).rejects.toThrow(
      "usage: agg <time_between_reqs>"
    );
  });

  it("throws for an invalid duration", async () => {
    await expect(handlerAgg("agg", "soon")).rejects.toThrow(/invalid duration/);
  });
});
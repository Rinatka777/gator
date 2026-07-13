import { describe, it, expect, afterEach, afterAll } from "vitest";

// INTEGRATION TESTS — these hit a real Postgres database.
//
// Unlike the mocked tests in commands.test.ts, these verify what mocks
// can't: the schema, the SQL drizzle generates, and Postgres behavior
// (unique constraints, parameterization). Backend engineers need both
// layers; the mistakes live in the gaps between them.
//
// Setup (one time):
//   createdb gator_test
//   Create test-config.json in the repo root (it's gitignored territory —
//   do NOT commit real credentials):
//     { "db_url": "postgres://<you>@localhost:5432/gator_test?sslmode=disable" }
//   Run migrations against it (drizzle.config reads the same db_url you
//   point it at, or run the SQL from src/lib/db/migrations manually).
//
// Run:
//   GATORCONFIG=./test-config.json GATOR_INTEGRATION=1 npm test
//
// Without GATOR_INTEGRATION the whole suite is skipped, so plain
// `npm test` stays fast and never needs a database.

const integration = process.env.GATOR_INTEGRATION === "1";

describe.skipIf(!integration)("users queries (integration)", () => {
  afterEach(async () => {
    // Wipe the table between tests. Only safe because GATORCONFIG points
    // at a dedicated throwaway database — never do this against real data.
    const { db } = await import("../index.js");
    const { users } = await import("../schema.js");
    await db.delete(users);
  });

  afterAll(async () => {
    // Close the pool so vitest can exit instead of hanging on the socket.
    const { conn } = await import("../index.js");
    await conn.end();
  });

  // WORKED EXAMPLE: dynamic import so the db module (which connects using
  // GATORCONFIG at load time) is only loaded when integration mode is on.
  it("createUser returns the inserted row with generated fields", async () => {
    const { createUser } = await import("./users.js");

    const user = await createUser("alice");

    expect(user.name).toBe("alice");
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/); // uuid
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("getUserByName finds a user that was created", async () => {
    const { createUser, getUserByName } = await import("./users.js");

    const created = await createUser("bob");
    const found = await getUserByName("bob");

    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe("bob");
  });

  it("getUserByName returns undefined for a missing user", async () => {
    const { getUserByName } = await import("./users.js");

    const found = await getUserByName("nobody");

    expect(found).toBeUndefined();
  });

  it("createUser rejects a duplicate name (unique constraint)", async () => {
    const { createUser } = await import("./users.js");

    await createUser("carol");

    // drizzle wraps db errors in a DrizzleQueryError ("Failed query: ...");
    // the actual Postgres unique-violation error is attached as `cause`.
    const error = await createUser("carol").then(
      () => {
        throw new Error("expected duplicate insert to reject");
      },
      (err) => err
    );
    expect((error.cause as Error).message).toMatch(
      /duplicate key value violates unique constraint/
    );
  });

  it("treats a SQL-injection-looking name as literal data", async () => {
    const { createUser, getUserByName } = await import("./users.js");
    const evil = "'; DROP TABLE users; --";

    await createUser(evil);

    // If the input had been executed as SQL, the table would be gone and
    // this query would blow up. Instead we find the name stored verbatim.
    const found = await getUserByName(evil);
    expect(found).toBeDefined();
    expect(found!.name).toBe(evil);
  });
});
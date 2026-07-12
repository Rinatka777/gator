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

  // YOUR TURN:

  // Hint: createUser("bob"), then getUserByName("bob") — same id back?
  it.todo("getUserByName finds a user that was created");

  // Hint: what does your function return for a name that isn't there?
  // (You relied on this in handlerLogin — now prove it.)
  it.todo("getUserByName returns undefined for a missing user");

  // Hint: createUser("carol") twice. The schema says name is .unique() —
  // expect the second call to reject. Knowing WHICH errors the db throws
  // is how you write handlers that fail gracefully instead of leaking
  // stack traces to users.
  it.todo("createUser rejects a duplicate name (unique constraint)");

  // SECURITY: the classic. Create a user literally named
  //   "'; DROP TABLE users; --"
  // then prove the users table still exists (e.g. getUserByName finds
  // that exact name). This passes because drizzle/postgres.js send
  // parameterized queries — the input is data, never SQL. If you ever
  // build queries by string concatenation, this test is the one that
  // catches it.
  it.todo("treats a SQL-injection-looking name as literal data");
});
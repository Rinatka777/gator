import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { readConfig, setUser } from "./config.js";

// Technique: filesystem isolation. Instead of mocking fs, we point the code
// at a REAL temp file via the GATORCONFIG env var. This tests the actual
// read/write/JSON logic end-to-end without touching ~/.gatorconfig.json.
// (Security habit: tests must never read or clobber real user state.)

let tempDir: string;
let configPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "gator-test-"));
  configPath = join(tempDir, "config.json");
  process.env.GATORCONFIG = configPath;
});

afterEach(() => {
  delete process.env.GATORCONFIG;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("readConfig", () => {
  // WORKED EXAMPLE: the on-disk format is snake_case, the in-memory type
  // is camelCase. This mapping is exactly the kind of boring code that
  // silently breaks — which is why it deserves a test.
  it("maps snake_case JSON keys to camelCase fields", () => {
    writeFileSync(
      configPath,
      JSON.stringify({ db_url: "postgres://x", current_user_name: "rinat" })
    );

    const config = readConfig();

    expect(config).toEqual({ dbUrl: "postgres://x", currentUserName: "rinat" });
  });

  // YOUR TURN:

  // Hint: write a file with only db_url. What should currentUserName be?
  it("handles a config file with no current_user_name", () => {
    writeFileSync(configPath, JSON.stringify({ db_url: "postgres://x" }));

    const config = readConfig();

    expect(config.dbUrl).toBe("postgres://x");
    expect(config.currentUserName).toBeUndefined();
  });

  // Hint: don't create the file at all. Wrap the call:
  // expect(() => readConfig()).toThrow()
  // Then think: is a raw ENOENT error a good user experience for a CLI?
  it("throws when the config file does not exist", () => {
  // No arrange step: beforeEach gave us an empty temp dir,
  // and we deliberately never create the file.
    expect(() => readConfig()).toThrow(/ENOENT/);
});

  // Hint: write literal garbage like "not json{" to the file.
  // This is defensive-programming thinking: never trust file contents.
  it("throws on malformed JSON", () => {
    writeFileSync(configPath, "not json{");

    expect(() => readConfig()).toThrow(SyntaxError);
  });
});

describe("setUser", () => {
  // Hint: call setUser({ dbUrl: "postgres://x" }, "rinat"), then
  // readFileSync(configPath) and JSON.parse it yourself. Assert the file
  // contains db_url and current_user_name (snake_case!) — test what's on
  // disk, not what the function claims.
  it("writes the config back in snake_case", () => {
    // Act: setUser doesn't need the file to exist — it only writes.
    setUser({ dbUrl: "postgres://x" }, "rinat");

    // Assert on what actually landed on disk, not on the function's
    // in-memory return value: parse the file back ourselves.
    const onDisk = JSON.parse(readFileSync(configPath, "utf-8"));

    expect(onDisk).toEqual({
      db_url: "postgres://x",
      current_user_name: "rinat",
    });
  });

  // Hint: call setUser twice with different names; the file should hold
  // only the last one, and db_url must survive both writes.
  it("preserves dbUrl when updating the user", () => {
    setUser({ dbUrl: "postgres://x" }, "rinat");
    setUser({ dbUrl: "postgres://x" }, "bob");

    const onDisk = JSON.parse(readFileSync(configPath, "utf-8"));

    expect(onDisk).toEqual({
      db_url: "postgres://x",
      current_user_name: "bob", // last write wins
    });
  });

});
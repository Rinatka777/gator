import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CommandsRegistry,
  registerCommand,
  runCommand,
  handlerLogin,
  handlerRegister,
} from "./commands.js";
import { readConfig, setUser } from "./config.js";
import { createUser, getUserByName } from "./lib/db/queries/users.js";

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
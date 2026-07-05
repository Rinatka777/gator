import { homedir } from "os";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

export type Config = {
  dbUrl: string;
  currentUserName?: string;
};

// Overridable via env var so tests can point at a temp file
// instead of the real ~/.gatorconfig.json.
function getConfigPath(): string {
  return process.env.GATORCONFIG ?? join(homedir(), ".gatorconfig.json");
}

export function readConfig(): Config {
  const raw = readFileSync(getConfigPath(), "utf-8");
  const parsed = JSON.parse(raw);
  return {
    dbUrl: parsed.db_url,
    currentUserName: parsed.current_user_name,
  };
}

export function setUser(config: Config, username: string): void {
  const updated: Config = { ...config, currentUserName: username };
  const json = JSON.stringify(
    { db_url: updated.dbUrl, current_user_name: updated.currentUserName },
    null,
    2
  );
  writeFileSync(getConfigPath(), json, "utf-8");
}


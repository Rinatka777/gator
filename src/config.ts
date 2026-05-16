import { homedir } from "os";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

export type Config = {
  dbUrl: string;
  currentUserName?: string;
};

const CONFIG_PATH = join(homedir(), ".gatorconfig.json");

export function readConfig(): Config {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
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
  writeFileSync(CONFIG_PATH, json, "utf-8");
}
import { readConfig, setUser } from "./config.js";

function main() {
  const config = readConfig();
  setUser(config, "Rinat");
  const updated = readConfig();
  console.log(updated);
}

main();
import {
  CommandsRegistry,
  registerCommand,
  runCommand,
  handlerLogin,
} from "./commands.js";
import { handlerRegister, handlerReset, handlerUsers } from "./commands.js";

async function main() {
  const registry: CommandsRegistry = {};
  registerCommand(registry, "login", handlerLogin);
  registerCommand(registry, "register", handlerRegister);
  registerCommand(registry, "reset", handlerReset);
  registerCommand(registry, "users", handlerUsers);

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Error: not enough arguments. Usage: <command> [args...]");
    process.exit(1);
  }

  const cmdName = args[0];
  const cmdArgs = args.slice(1);

  try {
    await runCommand(registry, cmdName, ...cmdArgs);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  process.exit(0);
}

main();
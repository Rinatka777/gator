import {
  CommandsRegistry,
  registerCommand,
  runCommand,
  handlerLogin,
} from "./commands.js";

function main() {
  const registry: CommandsRegistry = {};
  registerCommand(registry, "login", handlerLogin);

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Error: not enough arguments. Usage: <command> [args...]");
    process.exit(1);
  }

  const cmdName = args[0];
  const cmdArgs = args.slice(1);

  try {
    runCommand(registry, cmdName, ...cmdArgs);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
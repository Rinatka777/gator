import {
  CommandsRegistry,
  registerCommand,
  runCommand,
  handlerLogin, handlerUnfollow,
  middlewareLoggedIn,
} from "./commands.js";
import { handlerRegister, handlerReset, handlerUsers, handlerAgg, handlerAddFeed, handlerFollow, handlerFollowing, handlerFeeds, handlerBrowse } from "./commands.js";

async function main() {
  const registry: CommandsRegistry = {};
  registerCommand(registry, "login", handlerLogin);
  registerCommand(registry, "register", handlerRegister);
  registerCommand(registry, "reset", handlerReset);
  registerCommand(registry, "users", handlerUsers);
  registerCommand(registry, "agg", handlerAgg);
  registerCommand(registry, "addfeed", middlewareLoggedIn(handlerAddFeed));
  registerCommand(registry, "follow", middlewareLoggedIn(handlerFollow));
  registerCommand(registry, "unfollow", middlewareLoggedIn(handlerUnfollow));
  registerCommand(registry, "following", middlewareLoggedIn(handlerFollowing));
  registerCommand(registry, "feeds", handlerFeeds);
  registerCommand(registry, "browse", middlewareLoggedIn(handlerBrowse));


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
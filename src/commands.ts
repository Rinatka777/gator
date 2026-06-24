import { readConfig, setUser } from "./config.js";

type CommandHandler = (cmdName: string, ...args: string[]) => void;
export type CommandsRegistry = Record<string, CommandHandler>;


export function handlerLogin(cmdName: string, ...args: string[]): void {
    if (args.length === 0) {
        throw new Error(`usage: ${cmdName} <username>`);
    }
    const username = args[0]
    const config = readConfig();
    setUser(config, username);
    console.log(`Logged in as ${username}`);
}

export function registerCommand(
    registry: CommandsRegistry,
    cmdName: string,
    handler: CommandHandler
): void {
    registry[cmdName] = handler;
}

export function runCommand(
    registry: CommandsRegistry,
    cmdName: string,
    ...args: string[]
): void {
    const handler = registry[cmdName];
    if (!handler) {
        throw new Error(`Unknown command: ${cmdName}`);
    }
    handler(cmdName, ...args);
}
import { readConfig, setUser } from "./config.js";
import { createUser, getUserByName, deleteAllUsers, getUsers } from "./lib/db/queries/users.js";
import {createFeed, getFeedByUrl} from "./lib/db/queries/feed.js";
import { fetchFeed } from "./lib/rss.js";
import { Feed, User } from "./lib/db/schema.js";
import {createFollow, deleteFollow, getFollow} from "./lib/db/queries/follows";

type CommandHandler = (cmdName: string, ...args: string[]) => Promise<void>;
export type CommandsRegistry = Record<string, CommandHandler>;


export async function handlerLogin(cmdName: string, ...args: string[]): Promise<void> {
    if (args.length === 0) {
        throw new Error(`usage: ${cmdName} <username>`);
    }
    const username = args[0]
    const existing = await getUserByName(username);
    if (!existing) {
        throw new Error(`User ${username} does not exist`);
    }
    const config = readConfig();
    setUser(config, username);
    console.log(`Logged in as ${username}`);
}

export async function handlerRegister(cmdName:string, ...args:string[]){
    if (args.length === 0) {
        throw new Error(`usage: ${cmdName} <username>`)
    }
    const username = args[0];
    const existing = await getUserByName(username);
    if (existing){
        throw new Error(`User ${username} already exists`)
    }
    const user = await createUser(username);
    const config = readConfig();
    setUser(config, username);
    console.log(`User created: ${JSON.stringify(user)}`);
}

export async function handlerReset(cmdName: string, ...args: string[]): Promise<void> {
    await deleteAllUsers();
    console.log("Database reset: all users deleted");
}

export function registerCommand(
    registry: CommandsRegistry,
    cmdName: string,
    handler: CommandHandler
): void {
    registry[cmdName] = handler;
}

export async function runCommand(
    registry: CommandsRegistry,
    cmdName: string,
    ...args: string[]
): Promise<void> {
    const handler = registry[cmdName];
    if (!handler) {
        throw new Error(`Unknown command: ${cmdName}`);
    }
    await handler(cmdName, ...args);
}

export async function handlerAgg(cmdName: string, ...args: string[]): Promise<void> {
    const feed = await fetchFeed("https://www.wagslane.dev/index.xml");
    console.log(JSON.stringify(feed, null, 2));
}

export async function handlerUsers(cmdName: string, ...args: string[]): Promise<void> {
    const allUsers = await getUsers();
    const config = readConfig();
    for (const user of allUsers) {
        let suffix;
        if (user.name === config.currentUserName) {
            suffix = " (current)";
        } else {
            suffix = "";
        }
        console.log(`* ${user.name}${suffix}`);
    }
}

function printFeed(feed: Feed, user: User): void {
    console.log(`* ${feed.name} (${feed.url}) added by ${user.name}`);
}

export async function handlerAddFeed(cmdName: string, ...args: string[]): Promise<void> {
    if (args.length < 2) {
        throw new Error(`usage: ${cmdName} <name> <url>`);
    }
    const [name, url] = args;
    const config = readConfig();
    if (!config.currentUserName) {
        throw new Error("no user is currently logged in");
    }
    const user = await getUserByName(config.currentUserName);
    if (!user) {
        throw new Error(`user ${config.currentUserName} does not exist`);
    }
    const feed = await createFeed(name, url, user.id);
    printFeed(feed, user);
}

export async function handlerFollow(cmdName: string, ...args: string[]): Promise<void> {
    const config = readConfig()
    if (!config.currentUserName) {
        throw new Error("no user is currently logged in");
    }
    const user = await getUserByName(config.currentUserName);
    if(!user){
        throw new Error(`user ${config.currentUserName} does not exist`);}
    const feed = await getFeedByUrl(args[0])

    if(!feed){
        throw new Error(`feed ${args[0]} does not exist`);
    }
    const existing = await getFollow(user.id, feed.id);
    if (existing) {
        throw new Error(`user ${user.name} is already following ${feed.name}`);
    }
    await createFollow(feed.id, user.id)
    console.log(`user ${user.name} is now following ${feed.name} (${feed.url})`)
}

export async function handlerUnfollow(cmdName: string, ...args:string[]):Promise<void>{
    const config = readConfig()
    if(!config.currentUserName){
        throw new Error("no user is currently logged in");
    }
    const user = await getUserByName(config.currentUserName)
    if(!user){
        throw new Error(`user ${config.currentUserName} does not exist`);}

    const feed = await getFeedByUrl(args[0])

    if(!feed){
        throw new Error(`feed ${args[0]} does not exist`);
    }

    await deleteFollow(user.id, feed.id)
    console.log(`user ${user.name} unfollowed ${feed.name}`)
}
import { readConfig, setUser } from "./config.js";
import { createUser, getUserByName, deleteAllUsers, getUsers } from "./lib/db/queries/users.js";
import {createFeed, getFeedByUrl, getNextFeedToFetch, markFeedFetched, getFeeds} from "./lib/db/queries/feed.js";
import { fetchFeed } from "./lib/rss.js";
import { Feed, User } from "./lib/db/schema.js";
import {createFollow, deleteFollow, getFollow, getFollowsForUser} from "./lib/db/queries/follows";
import { createPost, getPostsForUser } from "./lib/db/queries/posts.js";

type CommandHandler = (cmdName: string, ...args: string[]) => Promise<void>;
export type CommandsRegistry = Record<string, CommandHandler>;

type LoggedInCommandHandler = (
    cmdName: string,
    user: User,
    ...args: string[]
) => Promise<void>;

export function middlewareLoggedIn(handler: LoggedInCommandHandler): CommandHandler {
    return async (cmdName: string, ...args: string[]) => {
        const config = readConfig();
        if (!config.currentUserName) {
            throw new Error("no user is currently logged in");
        }
        const user = await getUserByName(config.currentUserName);
        if (!user) {
            throw new Error(`user ${config.currentUserName} does not exist`);
        }
        await handler(cmdName, user, ...args);
    };
}


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

export function parseDuration(durationStr: string): number {
    const match = durationStr.match(/^(\d+)(ms|s|m|h)$/);
    if (!match) {
        throw new Error(`invalid duration: ${durationStr} (expected e.g. "1s", "1m", "1h")`);
    }
    const [, amountStr, unit] = match;
    const unitToMs: Record<string, number> = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000 };
    return Number(amountStr) * unitToMs[unit];
}

export function parsePublishedAt(pubDate: string): Date {
    const date = new Date(pubDate);
    if (isNaN(date.getTime())) {
        throw new Error(`could not parse published date: "${pubDate}"`);
    }
    return date;
}

export async function scrapeFeeds(): Promise<void> {
    const feed = await getNextFeedToFetch();
    if (!feed) {
        return;
    }
    await markFeedFetched(feed.id);

    let rssFeed;
    try {
        rssFeed = await fetchFeed(feed.url);
    } catch (err) {
        console.error(`error fetching feed ${feed.name}: ${err instanceof Error ? err.message : err}`);
        return;
    }

    for (const item of rssFeed.items) {
        try {
            const publishedAt = parsePublishedAt(item.pubDate);
            await createPost(item.title, item.link, item.description, publishedAt, feed.id);
        } catch (err) {
            console.error(`error saving post "${item.title}": ${err instanceof Error ? err.message : err}`);
        }
    }
}

export async function handlerAgg(cmdName: string, ...args: string[]): Promise<void> {
    if (args.length < 1) {
        throw new Error(`usage: ${cmdName} <time_between_reqs>`);
    }
    const timeBetweenRequests = parseDuration(args[0]);
    console.log(`Collecting feeds every ${args[0]}`);

    await scrapeFeeds();
    setInterval(scrapeFeeds, timeBetweenRequests);

    await new Promise<void>(() => {});
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

export async function handlerAddFeed(cmdName: string, user: User, ...args: string[]): Promise<void> {
    if (args.length < 2) {
        throw new Error(`usage: ${cmdName} <name> <url>`);
    }
    const [name, url] = args;
    const feed = await createFeed(name, url, user.id);
    await createFollow(feed.id, user.id);
    printFeed(feed, user);
}

export async function handlerFollow(cmdName: string, user: User, ...args: string[]): Promise<void> {
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

export async function handlerUnfollow(cmdName: string, user: User, ...args:string[]):Promise<void>{
    const feed = await getFeedByUrl(args[0])

    if(!feed){
        throw new Error(`feed ${args[0]} does not exist`);
    }

    await deleteFollow(user.id, feed.id)
    console.log(`user ${user.name} unfollowed ${feed.name}`)
}

export async function handlerFollowing(cmdName: string, user: User, ...args:string[]): Promise <void>{
    const follows = await getFollowsForUser(user.id);
    for (const follow of follows) {
        console.log(`* ${follow.feedName}`);
    }
}

export async function handlerFeeds(cmdName: string, ...args: string[]): Promise<void> {
    const allFeeds = await getFeeds();
    for (const feed of allFeeds) {
        console.log(`* ${feed.feedName} (${feed.feedUrl}) added by ${feed.userName}`);
    }
}

export async function handlerBrowse(cmdName: string, user: User, ...args: string[]): Promise<void> {
    let limit = 2;
    if (args.length > 0) {
        const parsed = Number(args[0]);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new Error(`usage: ${cmdName} [limit]`);
        }
        limit = parsed;
    }

    const userPosts = await getPostsForUser(user.id, limit);
    for (const post of userPosts) {
        console.log(`* ${post.title} (${post.feedName})`);
        console.log(`  ${post.url}`);
        console.log(`  ${post.publishedAt.toISOString()}`);
        console.log(`  ${post.description}`);
        console.log();
    }
}
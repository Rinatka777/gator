import { XMLParser } from "fast-xml-parser";

export type RSSItem = {
    title: string;
    link: string;
    description: string;
    pubDate: string;
};

export type RSSFeed = {
    title: string;
    link: string;
    description: string;
    items: RSSItem[];
};

export async function fetchFeed(feedURL: string): Promise<RSSFeed>{
    const response = await fetch(feedURL, {
        headers:{
            "User-Agent": "gator"
        }
    });
    const feed = await response.text();
    const parser = new XMLParser({
        processEntities: false,
    });
    const parsedXml = parser.parse(feed);
    if (!parsedXml.rss?.channel){
        throw new Error(`Invalid RSS feed: no channel found in response from ${feedURL}`);
    }
    const channel = parsedXml.rss.channel;
    if (!channel.title || !channel.link || !channel.description) {
        throw new Error(`Invalid RSS feed: missing required fields in channel from ${feedURL}`);
    }
    const rawItems = Array.isArray(channel.item)
        ? channel.item
        : channel.item
          ? [channel.item]
          : [];
    const items: RSSItem[] = rawItems
        .filter((item: any) => item.title && item.link && item.description && item.pubDate)
        .map((item: any) => ({
            title: String(item.title),
            link: String(item.link),
            description: String(item.description),
            pubDate: String(item.pubDate),
        }));
    return {
        title: String(channel.title),
        link: String(channel.link),
        description: String(channel.description),
        items,
    };
}
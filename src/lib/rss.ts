import { XMLParser } from "fast-xml-parser";

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
}
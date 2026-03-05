"use server";
import yts from "yt-search";

export type SearchResult = {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  seconds: number;
};

export async function searchYouTube(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) return [];

  try {
    const r = await yts(query);

    return r.videos
      .filter((v) => v.seconds < 480) // Filter out videos > 8 mins
      .slice(0, 8)
      .map((v) => ({
        videoId: v.videoId,
        title: v.title,
        thumbnail:
          v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        duration: v.timestamp,
        seconds: v.seconds,
      }));
  } catch {
    console.error("YouTube search failed");
    return [];
  }
}

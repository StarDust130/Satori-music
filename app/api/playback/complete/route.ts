import { NextResponse } from "next/server";
import { playNextSong } from "@/actions/queue-actions";

// POST /api/playback/complete
// Called when a song finishes playing on the gym screen
export async function POST() {
  try {
    const next = await playNextSong();

    if (next) {
      return NextResponse.json({
        success: true,
        nowPlaying: next,
      });
    }

    return NextResponse.json({
      success: true,
      nowPlaying: null,
      message: "No more songs in queue",
    });
  } catch (error) {
    console.error("Playback complete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to advance queue" },
      { status: 500 },
    );
  }
}

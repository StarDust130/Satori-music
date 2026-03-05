"use server";

import { getServiceSupabase } from "@/lib/supabase";

// ─── Types ──────────────────────────────────────────────
export type QueueItem = {
  id: string;
  video_id: string;
  title: string;
  thumbnail: string;
  duration: string;
  added_by: string;
  added_by_name: string;
  is_played: boolean;
  is_now_playing: boolean;
  created_at: string;
  net_score: number;
  upvotes: number;
  downvotes: number;
};

// ─── Add to Queue ───────────────────────────────────────
export async function addToQueue(data: {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  clientId: string;
  userName: string;
}) {
  const sb = getServiceSupabase();

  // First, ensure the user exists in the database.
  // This prevents the foreign key constraint error when a user's localStorage
  // has a clientID but they aren't in the database (e.g. after a DB reset)
  await sb.from("users").upsert(
    {
      client_id: data.clientId,
      name: data.userName,
    },
    { onConflict: "client_id" },
  );

  // Check if user is banned
  const { data: user } = await sb
    .from("users")
    .select("is_banned")
    .eq("client_id", data.clientId)
    .single();

  if (user?.is_banned) {
    return { error: "You have been banned from adding songs." };
  }

  // Check if user already has 2 unplayed songs
  const { count } = await sb
    .from("queue")
    .select("*", { count: "exact", head: true })
    .eq("added_by", data.clientId)
    .eq("is_played", false);

  if (count !== null && count >= 2) {
    return { error: "limit_reached" };
  }

  // Check if song is already in unplayed queue
  const { count: existing } = await sb
    .from("queue")
    .select("*", { count: "exact", head: true })
    .eq("video_id", data.videoId)
    .eq("is_played", false);

  if (existing !== null && existing > 0) {
    return { error: "already_in_queue" };
  }

  // Insert into queue
  const { error } = await sb.from("queue").insert({
    video_id: data.videoId,
    title: data.title,
    thumbnail: data.thumbnail,
    duration: data.duration,
    added_by: data.clientId,
    added_by_name: data.userName,
  });

  if (error) {
    console.error("Add to queue error:", error);
    return { error: "Failed to add song to queue." };
  }

  return { success: true };
}

// ─── Get Unplayed Queue (sorted by score) ───────────────
export async function getQueue(): Promise<QueueItem[]> {
  const sb = getServiceSupabase();

  const { data, error } = await sb
    .from("queue_with_scores")
    .select("*")
    .eq("is_played", false)
    .order("is_now_playing", { ascending: false })
    .order("net_score", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Get queue error:", error);
    return [];
  }

  return (data as QueueItem[]) || [];
}

// ─── Get Now Playing ────────────────────────────────────
export async function getNowPlaying(): Promise<QueueItem | null> {
  const sb = getServiceSupabase();

  const { data, error } = await sb
    .from("queue_with_scores")
    .select("*")
    .eq("is_now_playing", true)
    .single();

  if (error || !data) return null;
  return data as QueueItem;
}

// ─── Get Next Song (highest voted unplayed) ─────────────
export async function getNextSong(): Promise<QueueItem | null> {
  const sb = getServiceSupabase();

  const { data, error } = await sb
    .from("queue_with_scores")
    .select("*")
    .eq("is_played", false)
    .eq("is_now_playing", false)
    .order("net_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as QueueItem;
}

// ─── Play Next Song ─────────────────────────────────────
export async function playNextSong(): Promise<QueueItem | null> {
  const sb = getServiceSupabase();

  // Find currently playing
  const { data: currentItems } = await sb
    .from("queue")
    .select("id")
    .eq("is_now_playing", true);

  if (currentItems && currentItems.length > 0) {
    const currentId = currentItems[0].id;
    // Delete old votes so score resets to 0
    await sb.from("votes").delete().eq("queue_id", currentId);
    // Put it back at the bottom of the queue
    await sb
      .from("queue")
      .update({
        is_now_playing: false,
        is_played: false, // keep it in queue
        created_at: new Date().toISOString(),
      })
      .eq("id", currentId);
  }

  // Get next song
  const next = await getNextSong();
  if (!next) return null;

  // Mark it as now playing
  await sb.from("queue").update({ is_now_playing: true }).eq("id", next.id);

  return { ...next, is_now_playing: true };
}

// ─── Skip Current Song (Admin) ──────────────────────────
export async function skipCurrentSong(): Promise<{ success: boolean }> {
  const sb = getServiceSupabase();

  // Find currently playing
  const { data: currentItems } = await sb
    .from("queue")
    .select("id")
    .eq("is_now_playing", true);

  if (currentItems && currentItems.length > 0) {
    const currentId = currentItems[0].id;
    // Delete old votes
    await sb.from("votes").delete().eq("queue_id", currentId);
    // Put it back at the bottom
    await sb
      .from("queue")
      .update({
        is_now_playing: false,
        is_played: false,
        created_at: new Date().toISOString(),
      })
      .eq("id", currentId);
  }

  return { success: true };
}

// ─── Delete Queue Entry (Admin) ─────────────────────────
export async function deleteQueueEntry(
  id: string,
): Promise<{ success: boolean }> {
  const sb = getServiceSupabase();

  const { error } = await sb.from("queue").delete().eq("id", id);
  if (error) {
    console.error("Delete queue entry error:", error);
    return { success: false };
  }
  return { success: true };
}

// ─── Mark Song Complete (from player) ───────────────────
export async function markSongComplete(queueId: string) {
  const sb = getServiceSupabase();

  await sb.from("votes").delete().eq("queue_id", queueId);

  await sb
    .from("queue")
    .update({
      is_now_playing: false,
      is_played: false,
      created_at: new Date().toISOString(),
    })
    .eq("id", queueId);

  return { success: true };
}

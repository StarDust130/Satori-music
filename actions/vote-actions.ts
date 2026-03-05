"use server";

import { getServiceSupabase } from "@/lib/supabase";

export type VoteType = 1 | -1;

// ─── Cast Vote ──────────────────────────────────────────
export async function castVote(data: {
  queueId: string;
  clientId: string;
  voteType: VoteType;
}): Promise<{ success: boolean; error?: string }> {
  const sb = getServiceSupabase();

  // First, ensure the user exists to prevent foreign key errors on votes
  await sb.from("users").upsert(
    {
      client_id: data.clientId,
      name: "Anonymous User", // Fallback if they somehow vote without a name stored
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
    return { success: false, error: "You have been banned." };
  }

  // Upsert vote (insert or update the existing vote)
  const { error } = await sb.from("votes").upsert(
    {
      queue_id: data.queueId,
      client_id: data.clientId,
      vote_type: data.voteType,
    },
    {
      onConflict: "queue_id,client_id",
    },
  );

  if (error) {
    console.error("Vote error:", error);
    return { success: false, error: "Failed to cast vote." };
  }

  return { success: true };
}

// ─── Remove Vote ────────────────────────────────────────
export async function removeVote(data: {
  queueId: string;
  clientId: string;
}): Promise<{ success: boolean }> {
  const sb = getServiceSupabase();

  await sb
    .from("votes")
    .delete()
    .eq("queue_id", data.queueId)
    .eq("client_id", data.clientId);

  return { success: true };
}

// ─── Get User Votes ─────────────────────────────────────
export async function getUserVotes(
  clientId: string,
): Promise<Record<string, VoteType>> {
  const sb = getServiceSupabase();

  const { data, error } = await sb
    .from("votes")
    .select("queue_id, vote_type")
    .eq("client_id", clientId);

  if (error || !data) return {};

  const voteMap: Record<string, VoteType> = {};
  for (const v of data) {
    voteMap[v.queue_id] = v.vote_type as VoteType;
  }
  return voteMap;
}

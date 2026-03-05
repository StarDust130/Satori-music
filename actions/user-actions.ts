"use server";

import { getServiceSupabase } from "@/lib/supabase";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Register User ──────────────────────────────────────
export async function registerUser(data: {
  name: string;
  gender?: string;
  clientId: string;
}): Promise<{ success: boolean; gender: string }> {
  const sb = getServiceSupabase();

  let gender = data.gender || "";

  // If gender not provided, predict with Groq AI
  if (!gender) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a gender prediction assistant. Given a name, predict if the person is likely male or female. Respond with ONLY one word: 'male' or 'female'. Nothing else.",
          },
          {
            role: "user",
            content: `Predict the gender for the name: "${data.name}"`,
          },
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0,
        max_tokens: 5,
      });

      const predicted = completion.choices[0]?.message?.content
        ?.trim()
        .toLowerCase();
      gender = predicted === "female" ? "female" : "male";
    } catch {
      gender = "unknown";
    }
  }

  // Upsert user
  const { error } = await sb.from("users").upsert(
    {
      name: data.name,
      gender,
      client_id: data.clientId,
    },
    { onConflict: "client_id" },
  );

  if (error) {
    console.error("Register user error:", error);
    return { success: false, gender: "unknown" };
  }

  return { success: true, gender };
}

// ─── Get Vibe Label (AI) ────────────────────────────────
export async function getVibeLabel(songTitles: string[]): Promise<string> {
  if (songTitles.length === 0) return "No Vibe Yet";

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a music vibe analyst. Given a list of song titles currently in a gym playlist queue, return a 2-3 word vibe label that describes the overall energy. Examples: 'Hardcore Metal', 'Chill Warmup', 'Bollywood Beats', 'High Energy Pop', 'Desi Pump'. Respond with ONLY the 2-3 word label. Nothing else.",
        },
        {
          role: "user",
          content: `Songs in queue:\n${songTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 15,
    });

    return completion.choices[0]?.message?.content?.trim() || "Mixed Vibes";
  } catch {
    return "Mixed Vibes";
  }
}

// ─── Admin: Ban/Unban User ──────────────────────────────
export async function toggleBanUser(
  clientId: string,
  ban: boolean,
): Promise<{ success: boolean }> {
  const sb = getServiceSupabase();

  const { error } = await sb
    .from("users")
    .update({ is_banned: ban })
    .eq("client_id", clientId);

  if (error) {
    console.error("Ban user error:", error);
    return { success: false };
  }

  return { success: true };
}

// ─── Admin: Get All Users ───────────────────────────────
export async function getAllUsers() {
  const sb = getServiceSupabase();

  const { data, error } = await sb
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}

// ─── Admin: Verify Password ────────────────────────────
export async function verifyAdminPassword(password: string): Promise<boolean> {
  return password === process.env.ADMIN_PASSWORD;
}
